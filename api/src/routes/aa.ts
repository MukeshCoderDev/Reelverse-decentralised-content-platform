import { Router, Request, Response, NextFunction } from 'express';
import { SmartAccountService } from '../services/onchain/smartAccountService';
import { SessionKeyService } from '../services/onchain/sessionKeyService';
import { UnifiedPaymasterService } from '../services/onchain/biconomyPaymasterService';
import { currentChainConfig } from '../config/chain';
import { logger } from '../utils/logger';
import { getDatabase } from '../config/database';
import { ethers, JsonRpcProvider, Wallet } from 'ethers';
import { env } from '../config/env';
import { rateLimit } from '../middleware/rateLimit';
import { parseRateLimit } from '../utils/rateLimitParser';
import { UserOperationStruct } from '@account-abstraction/contracts'; // Import directly from contracts
import { BundlerClient } from '../services/onchain/bundlerClient';
import aaClientSignRoutes from './aaClientSign';
import { PaymasterService, UserOperation } from '../services/onchain/paymasterService'; // Import PaymasterService and UserOperation
import { computeUserOpHash } from '../services/onchain/userOp'; // Import computeUserOpHash

const router = Router();
const paymasterService = new UnifiedPaymasterService();
const bundlerClient = new BundlerClient(env.BUNDLER_URL || 'http://localhost:4337'); // BUNDLER_URL is required now
const provider = new JsonRpcProvider(env.POLYGON_RPC_URL || env.MUMBAI_RPC_URL || 'http://localhost:8545'); // Use a suitable RPC URL
// Extend Request to include user property
declare module 'express-serve-static-core' {
  interface Request {
    user?: { // This type is extended in authPrivy.ts
      id: string;
      orgId?: string; // Make optional for Privy
      ownerAddress?: string; // Add ownerAddress for Privy
    };
  }
}

// Middleware to ensure user is authenticated and has an organization ID
const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  if (env.AUTH_PROVIDER === 'dev') {
    req.user = { id: 'mockUserId', orgId: 'mockOrgId', ownerAddress: env.DEV_OWNER_PRIVATE_KEY ? new Wallet(env.DEV_OWNER_PRIVATE_KEY).address : '0xMockOwnerAddress' }; // Mock user for dev
    if (!req.user || !req.user.orgId) {
      return res.status(401).json({ error: 'Unauthorized: User not authenticated or missing organization ID.' });
    }
  } else if (env.AUTH_PROVIDER === 'privy') {
    // Privy auth is handled by requirePrivyAuth middleware, which sets req.user.ownerAddress
    if (!req.user || !req.user.ownerAddress) {
      return res.status(401).json({ error: 'Unauthorized: User not authenticated or missing owner address.' });
    }
    // For Privy, orgId is not directly used from the backend perspective for AA operations,
    // but rather the ownerAddress derived from Privy's embedded wallet.
    // We can set a placeholder or derive it if needed for other parts of the system.
    req.user.orgId = req.user.id; // Using Privy userId as orgId for consistency if needed elsewhere
  } else {
    return res.status(500).json({ error: 'Server configuration error: Unknown AUTH_PROVIDER.' });
  }
  next();
};

// Helper to get the appropriate signer
const getSigner = async (ownerAddress: string): Promise<Wallet | undefined> => {
 if (env.AUTH_PROVIDER === 'dev' && env.DEV_OWNER_PRIVATE_KEY) {
   return new Wallet(env.DEV_OWNER_PRIVATE_KEY, provider);
 }
 // For Privy, signing happens client-side, so no server-side signer is returned here.
 return undefined;
};

// GET /api/aa/account → { smartAccountAddress, deployed, entryPoint, chainId, sessionKeyManagerSupported }
router.get('/account', authenticateUser, async (req: Request, res: Response) => {
  try {
    const ownerAddress = req.user!.ownerAddress!;
    const smartAccountService = new SmartAccountService(ownerAddress);
    const smartAccountAddress = await smartAccountService.getCounterfactualAddress();
    const deployed = await smartAccountService.isSmartAccountDeployed(smartAccountAddress);

    res.json({
      smartAccountAddress,
      deployed,
      entryPoint: currentChainConfig.entryPointAddress,
      chainId: currentChainConfig.chainId,
      sessionKeyManagerSupported: !!env.SESSION_KEY_MANAGER_ADDRESS,
    });
  } catch (error: any) {
    logger.error('Error fetching smart account details:', error);
    res.status(500).json({ error: 'Failed to fetch smart account details.' });
  }
});

// POST /api/aa/session/create { ttlMins, scope } → creates session key, registers via bundler, returns {sessionKeyId, publicKey, expiresAt}
router.post('/session/create', authenticateUser, rateLimit({ key: 'aa_session_create', ...parseRateLimit(env.RATE_LIMIT_AA_SESSION) }), async (req: Request, res: Response) => {
  if (env.AUTH_PROVIDER === 'privy') {
    // Option: internally call aaClientSign.prepare(kind='session_install') and return userOpHash to sign + userOp (but do NOT sign server-side).
    // For now, returning 501 as per instructions.
    return res.status(501).json({
      error: 'not_implemented',
      message: 'Please use the /api/v1/aa/userop/prepare + /api/v1/aa/userop/submit flow for session key installation with Privy.',
    });
  }

  if (!env.SESSION_KEY_MANAGER_ADDRESS) {
    return res.status(501).json({
      supported: false,
      message: 'Session Key Manager is not configured. Set SESSION_KEY_MANAGER_ADDRESS in your environment.',
    });
  }

  try {
    const { ttlMins, scope } = req.body;
    const ownerAddress = req.user!.ownerAddress!;

    if (!ttlMins || !scope) {
      return res.status(400).json({ error: 'Missing ttlMins or scope.' });
    }

    const smartAccountService = new SmartAccountService(ownerAddress);
    const sessionKeyService = new SessionKeyService(ownerAddress);

    // 1. Generate session key and build UserOp
    // 1. Generate session key and build UserOp
    let userOpStruct: UserOperationStruct = await sessionKeyService.buildRegisterSessionKeyUserOp(JSON.stringify(scope), ttlMins);

    // 2. Ensure smart account is deployed and get initCode if needed
    userOpStruct.initCode = await smartAccountService.ensureDeployedSmartAccount(await Promise.resolve(userOpStruct.sender));

    // 3. Fill nonce
    userOpStruct = await (bundlerClient as any).fillNonce(userOpStruct); // Cast to any for now

    // 4. Get paymaster data (sponsorship) and fill gas estimates
    const partialUserOp: Partial<UserOperation> = {
      sender: await Promise.resolve(userOpStruct.sender),
      nonce: userOpStruct.nonce.toString(),
      initCode: ethers.hexlify(await Promise.resolve(userOpStruct.initCode)),
      callData: ethers.hexlify(await Promise.resolve(userOpStruct.callData)),
      callGasLimit: userOpStruct.callGasLimit.toString(),
      verificationGasLimit: userOpStruct.verificationGasLimit.toString(),
      preVerificationGas: userOpStruct.preVerificationGas.toString(),
      maxFeePerGas: userOpStruct.maxFeePerGas.toString(),
      maxPriorityFeePerGas: userOpStruct.maxPriorityFeePerGas.toString(),
      paymasterAndData: ethers.hexlify(await Promise.resolve(userOpStruct.paymasterAndData)),
      signature: ethers.hexlify(await Promise.resolve(userOpStruct.signature)),
    };
    const paymasterResult = await paymasterService.getPaymasterData(partialUserOp);
    userOpStruct.paymasterAndData = paymasterResult.paymasterAndData;
    userOpStruct.preVerificationGas = BigInt(paymasterResult.preVerificationGas);
    userOpStruct.verificationGasLimit = BigInt(paymasterResult.verificationGasLimit);
    userOpStruct.callGasLimit = BigInt(paymasterResult.callGasLimit);
    userOpStruct.maxFeePerGas = BigInt(paymasterResult.maxFeePerGas);
    userOpStruct.maxPriorityFeePerGas = BigInt(paymasterResult.maxPriorityFeePerGas);

    // 5. Sign the UserOperation (server-side for dev mode)
    const signer = await getSigner(ownerAddress);
    if (!signer) {
      return res.status(500).json({ error: 'No signer available for user operation.' });
    }
    userOpStruct.signature = await signer.signMessage(ethers.getBytes(computeUserOpHash(userOpStruct, currentChainConfig.entryPointAddress, BigInt(env.CHAIN_ID))));
    const userOpHash = await (bundlerClient as any).sendUserOperation(userOpStruct); // Cast to any for now

    // In dev mode, we don't return session key details directly as it's server-managed.
    // The frontend will poll /session/status to confirm.
    res.status(201).json({
      message: 'Session key registration initiated.',
      userOpHash,
    });

  } catch (error: any) {
    logger.error('Error creating session key:', error);
    res.status(500).json({ error: 'Failed to create session key.' });
  }
});

// POST /api/aa/session/revoke { sessionKeyId }
router.post('/session/revoke', authenticateUser, async (req: Request, res: Response) => {
  if (env.AUTH_PROVIDER === 'privy') {
    return res.status(501).json({
      error: 'not_implemented',
      message: 'Session key revocation for Privy flow is not implemented via this endpoint. Revoke client-side.',
    });
  }

  if (!env.SESSION_KEY_MANAGER_ADDRESS) {
    return res.status(501).json({
      supported: false,
      message: 'Session Key Manager is not configured. Set SESSION_KEY_MANAGER_ADDRESS in your environment.',
    });
  }

  try {
    const { sessionKeyId } = req.body;
    const ownerAddress = req.user!.ownerAddress!;

    if (!sessionKeyId) {
      return res.status(400).json({ error: 'Missing sessionKeyId.' });
    }

    const smartAccountService = new SmartAccountService(ownerAddress);
    const sessionKeyService = new SessionKeyService(ownerAddress);

    // Fetch the session key from the database to get its public key and smart account ID
    const pool = getDatabase();
    const client = await pool.connect();
    let sessionKeyToRevoke;
    try {
      const resDb = await client.query(
        `SELECT * FROM session_keys WHERE id = $1 AND smart_account_id = $2`,
        [sessionKeyId, ownerAddress] // Use ownerAddress as smart_account_id for consistency
      );
      if (resDb.rowCount === 0) {
        return res.status(404).json({ error: 'Session key not found or unauthorized.' });
      }
      sessionKeyToRevoke = resDb.rows[0];
    } finally {
      client.release();
    }

    if (!sessionKeyToRevoke) {
      return res.status(404).json({ error: 'Session key not found.' });
    }

    // Mark as revoked in DB first
    await (sessionKeyService as any).revokeSessionKey(sessionKeyId);

    // Build UserOp to revoke session key on-chain
    // Build UserOp to revoke session key on-chain
    let userOpStruct: UserOperationStruct = await (sessionKeyService as any).revokeSessionKeyUserOp(sessionKeyToRevoke.public_key);

    // Fill nonce
    userOpStruct = await (bundlerClient as any).fillNonce(userOpStruct); // Cast to any for now

    // Get paymaster data (sponsorship) and fill gas estimates
    const partialUserOp: Partial<UserOperation> = {
      sender: await Promise.resolve(userOpStruct.sender),
      nonce: userOpStruct.nonce.toString(),
      initCode: ethers.hexlify(await Promise.resolve(userOpStruct.initCode)),
      callData: ethers.hexlify(await Promise.resolve(userOpStruct.callData)),
      callGasLimit: userOpStruct.callGasLimit.toString(),
      verificationGasLimit: userOpStruct.verificationGasLimit.toString(),
      preVerificationGas: userOpStruct.preVerificationGas.toString(),
      maxFeePerGas: userOpStruct.maxFeePerGas.toString(),
      maxPriorityFeePerGas: userOpStruct.maxPriorityFeePerGas.toString(),
      paymasterAndData: ethers.hexlify(await Promise.resolve(userOpStruct.paymasterAndData)),
      signature: ethers.hexlify(await Promise.resolve(userOpStruct.signature)),
    };
    const paymasterResult = await paymasterService.getPaymasterData(partialUserOp);
    userOpStruct.paymasterAndData = paymasterResult.paymasterAndData;
    userOpStruct.preVerificationGas = BigInt(paymasterResult.preVerificationGas);
    userOpStruct.verificationGasLimit = BigInt(paymasterResult.verificationGasLimit);
    userOpStruct.callGasLimit = BigInt(paymasterResult.callGasLimit);
    userOpStruct.maxFeePerGas = BigInt(paymasterResult.maxFeePerGas);
    userOpStruct.maxPriorityFeePerGas = BigInt(paymasterResult.maxPriorityFeePerGas);

    // Sign the UserOperation
    const signer = await getSigner(ownerAddress);
    if (!signer) {
      return res.status(500).json({ error: 'No signer available for user operation.' });
    }
    userOpStruct.signature = await signer.signMessage(ethers.getBytes(computeUserOpHash(userOpStruct, currentChainConfig.entryPointAddress, BigInt(env.CHAIN_ID))));

    const userOpHash = await (bundlerClient as any).sendUserOperation(userOpStruct); // Cast to any for now

    res.status(200).json({ message: 'Session key revoked successfully.', userOpHash });
  } catch (error: any) {
    logger.error('Error revoking session key:', error);
    res.status(500).json({ error: 'Failed to revoke session key.' });
  }
});

// POST /api/aa/sponsor-and-send { to, data, value? }
router.post('/sponsor-and-send', authenticateUser, async (req: Request, res: Response) => {
  if (env.AUTH_PROVIDER === 'privy') {
    return res.status(501).json({
      error: 'not_implemented',
      message: 'Please use the /api/v1/aa/userop/prepare + /api/v1/aa/userop/submit flow for sponsored actions with Privy.',
    });
  }

  try {
    const { to, data, value } = req.body;
    const ownerAddress = req.user!.ownerAddress!;

    if (!to || !data) {
      return res.status(400).json({ error: 'Missing "to" or "data" in request body.' });
    }

    const smartAccountService = new SmartAccountService(ownerAddress); // Instantiate here

    let userOpStruct: UserOperationStruct = await smartAccountService.buildExecuteCallUserOp(to, data, value ? value.toString() : '0');

    // Ensure smart account is deployed and get initCode if needed
    userOpStruct.initCode = await smartAccountService.ensureDeployedSmartAccount(await Promise.resolve(userOpStruct.sender));

    // Fill nonce
    userOpStruct = await (bundlerClient as any).fillNonce(userOpStruct); // Cast to any for now

    // Get paymaster data (sponsorship) and fill gas estimates
    const partialUserOp: Partial<UserOperation> = {
      sender: await Promise.resolve(userOpStruct.sender),
      nonce: userOpStruct.nonce.toString(),
      initCode: ethers.hexlify(await Promise.resolve(userOpStruct.initCode)),
      callData: ethers.hexlify(await Promise.resolve(userOpStruct.callData)),
      callGasLimit: userOpStruct.callGasLimit.toString(),
      verificationGasLimit: userOpStruct.verificationGasLimit.toString(),
      preVerificationGas: userOpStruct.preVerificationGas.toString(),
      maxFeePerGas: userOpStruct.maxFeePerGas.toString(),
      maxPriorityFeePerGas: userOpStruct.maxPriorityFeePerGas.toString(),
      paymasterAndData: ethers.hexlify(await Promise.resolve(userOpStruct.paymasterAndData)),
      signature: ethers.hexlify(await Promise.resolve(userOpStruct.signature)),
    };
    const paymasterResult = await paymasterService.getPaymasterData(partialUserOp);
    userOpStruct.paymasterAndData = paymasterResult.paymasterAndData;
    userOpStruct.preVerificationGas = BigInt(paymasterResult.preVerificationGas);
    userOpStruct.verificationGasLimit = BigInt(paymasterResult.verificationGasLimit);
    userOpStruct.callGasLimit = BigInt(paymasterResult.callGasLimit);
    userOpStruct.maxFeePerGas = BigInt(paymasterResult.maxFeePerGas);
    userOpStruct.maxPriorityFeePerGas = BigInt(paymasterResult.maxPriorityFeePerGas);

    // Sign the UserOperation
    const signer = await getSigner(ownerAddress);
    if (!signer) {
      return res.status(500).json({ error: 'No signer available for user operation.' });
    }
    userOpStruct.signature = await signer.signMessage(ethers.getBytes(computeUserOpHash(userOpStruct, currentChainConfig.entryPointAddress, BigInt(env.CHAIN_ID))));

    const userOpHash = await (bundlerClient as any).sendUserOperation(userOpStruct); // Cast to any for now
    logger.info(`Sponsored UserOp submitted: ${userOpHash}`);

    let txHash: string | undefined;
    try {
      const receipt = await (bundlerClient as any).pollUserOperationReceipt(userOpHash); // Cast to any for now
      txHash = receipt.receipt.transactionHash;
      logger.info(`Sponsored UserOp confirmed with tx hash: ${txHash}`);
    } catch (receiptError: any) {
      logger.warn(`Could not get receipt for userOpHash ${userOpHash}: ${receiptError.message}`);
    }

    res.status(200).json({ userOpHash, txHash });

  } catch (error: any) {
    logger.error('Error sponsoring and sending user operation:', error);
    if (error.message.includes('paymaster returns no sponsorship')) {
      return res.status(402).json({ error: 'Paymaster did not provide sponsorship.', details: error.message });
    }
    res.status(500).json({ error: 'Failed to sponsor and send user operation.' });
  }
});


// GET /api/aa/session/status → list active sessions for current user
router.get('/session/status', authenticateUser, async (req: Request, res: Response) => {
  try {
    const ownerAddress = req.user!.ownerAddress!;
    const sessionKeyService = new SessionKeyService(ownerAddress);
    const activeSessions = await (sessionKeyService as any).getActiveSessionKeys(ownerAddress); // Cast to any for now
    res.json(activeSessions.map((session: any) => ({ // Explicitly type session as any for now
      id: session.id,
      publicKey: session.publicKey,
      scope: session.scope,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    })));
  } catch (error: any) {
    logger.error('Error fetching session status:', error);
    res.status(500).json({ error: 'Failed to fetch session status.' });
  }
});

// Wire the new client-side signing routes
router.use(aaClientSignRoutes);

export default router;