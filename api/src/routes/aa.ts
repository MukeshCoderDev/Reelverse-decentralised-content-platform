import { Router, Request, Response, NextFunction } from 'express';
import { SmartAccountService } from '../services/onchain/smartAccountService';
import { SessionKeyService } from '../services/onchain/sessionKeyService';
import { UnifiedPaymasterService } from '../services/onchain/biconomyPaymasterService';
import { currentChainConfig } from '../config/chain';
import { logger } from '../utils/logger';
import { getDatabase } from '../config/database';
import { ethers, JsonRpcProvider, Wallet } from 'ethers';
import { env } from '../config/env';
import {
  UserOperationV06,
  buildCallData,
  fillNonce,
  signUserOp,
  fillGas,
  ensurePaymaster,
} from '../services/onchain/userOp';
import { BundlerClient } from '../services/onchain/bundlerClient';

const router = Router();
const smartAccountService = new SmartAccountService();
const sessionKeyService = new SessionKeyService();
const paymasterService = new UnifiedPaymasterService();
const bundlerClient = new BundlerClient(env.BUNDLER_URL!); // BUNDLER_URL is required now
const provider = new JsonRpcProvider(env.POLYGON_RPC_URL || env.MUMBAI_RPC_URL || 'http://localhost:8545'); // Use a suitable RPC URL

// Extend Request to include user property
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      orgId: string;
    };
  }
}

// Middleware to ensure user is authenticated and has an organization ID
const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  // Placeholder for actual authentication logic
  req.user = { id: 'mockUserId', orgId: 'mockOrgId' }; // Mock user
  if (!req.user || !req.user.orgId) {
    return res.status(401).json({ error: 'Unauthorized: User not authenticated or missing organization ID.' });
  }
  next();
};

// Helper to get the appropriate signer
const getSigner = async (orgId: string, useSessionKey: boolean = false): Promise<Wallet | undefined> => {
  if (useSessionKey && env.SESSION_KEY_MANAGER_ADDRESS) {
    // In a real scenario, you'd fetch the active session key's private key for the user
    // For this demo, we'll assume the session key is managed client-side or by a secure vault
    // and the backend only needs to know if it's "active".
    // For backend signing with session key, the private key would need to be accessible here.
    // Since the prompt implies session key is for frontend, we'll fall back to DEV_OWNER_PRIVATE_KEY for backend signing.
    logger.warn('Backend signing with session key is not fully implemented. Falling back to DEV_OWNER_PRIVATE_KEY.');
  }

  if (env.DEV_OWNER_PRIVATE_KEY) {
    return new Wallet(env.DEV_OWNER_PRIVATE_KEY, provider);
  }
  return undefined;
};

// GET /api/aa/account → { smartAccountAddress, deployed, entryPoint, chainId, sessionKeyManagerSupported }
router.get('/account', authenticateUser, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId; // Asserting req.user is defined due to middleware
    const ownerAddress = ethers.getAddress(ethers.keccak256(ethers.toUtf8Bytes(orgId)).slice(0, 42));
    const smartAccountAddress = await smartAccountService.getCounterfactualAddress(ownerAddress);
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
router.post('/session/create', authenticateUser, async (req: Request, res: Response) => {
  if (!env.SESSION_KEY_MANAGER_ADDRESS) {
    return res.status(501).json({
      supported: false,
      message: 'Session Key Manager is not configured. Set SESSION_KEY_MANAGER_ADDRESS in your environment.',
    });
  }

  try {
    const { ttlMins, scope } = req.body;
    const orgId = req.user!.orgId;

    if (!ttlMins || !scope) {
      return res.status(400).json({ error: 'Missing ttlMins or scope.' });
    }

    const ownerAddress = ethers.getAddress(ethers.keccak256(ethers.toUtf8Bytes(orgId)).slice(0, 42));
    const smartAccountAddress = await smartAccountService.getCounterfactualAddress(ownerAddress);

    // 1. Generate session key
    const { publicKey, encryptedPrivateKey, expiresAt } = await sessionKeyService.generateSessionKey({ ttlMins, scope });

    // 2. Store session key in DB
    const storedSessionKey = await sessionKeyService.storeSessionKey({
      smartAccountId: orgId,
      publicKey,
      encryptedPrivateKey,
      scope,
      expiresAt,
    });

    // 3. Build UserOp to register session key on-chain
    const registerUserOpPartial = await sessionKeyService.buildRegisterSessionKeyUserOp({
      smartAccountAddress,
      sessionPubKey: publicKey,
      targets: scope.targets || [],
      selectors: scope.selectors || [],
      expiry: Math.floor(expiresAt.getTime() / 1000),
    });

    let userOp: UserOperationV06 = {
      sender: smartAccountAddress,
      nonce: BigInt(0), // Will be filled
      initCode: '0x', // Will be filled by ensureDeployedSmartAccount if needed
      callData: registerUserOpPartial.callData || '0x',
      callGasLimit: BigInt(0), // Will be filled
      verificationGasLimit: BigInt(0), // Will be filled
      preVerificationGas: BigInt(0), // Will be filled
      maxFeePerGas: BigInt(0), // Will be filled
      maxPriorityFeePerGas: BigInt(0), // Will be filled
      paymasterAndData: '0x', // Will be filled
      signature: '0x', // Will be signed
    };

    // Ensure smart account is deployed and get initCode if needed
    userOp.initCode = await smartAccountService.ensureDeployedSmartAccount(smartAccountAddress, ownerAddress);

    // Fill nonce
    userOp.nonce = await fillNonce(env.ENTRY_POINT_ADDRESS, smartAccountAddress, provider);

    // Get paymaster data (sponsorship)
    userOp = await ensurePaymaster({ userOp, paymasterService });

    // Fill gas estimates
    userOp = await fillGas({ bundlerClient, userOp, entryPointAddress: env.ENTRY_POINT_ADDRESS });

    // Sign the UserOperation
    const signer = await getSigner(orgId);
    if (!signer) {
      return res.status(500).json({ error: 'No signer available for user operation.' });
    }
    userOp.signature = await signUserOp({
      userOp,
      signer,
      entryPointAddress: env.ENTRY_POINT_ADDRESS,
      chainId: BigInt(env.CHAIN_ID),
    });

    const userOpHash = await bundlerClient.sendUserOperation(userOp, env.ENTRY_POINT_ADDRESS);
    logger.info(`Session key registration UserOp submitted: ${userOpHash}`);

    res.status(201).json({
      sessionKeyId: storedSessionKey.id,
      publicKey: storedSessionKey.publicKey,
      expiresAt: storedSessionKey.expiresAt,
      userOpHash,
    });

  } catch (error: any) {
    logger.error('Error creating session key:', error);
    res.status(500).json({ error: 'Failed to create session key.' });
  }
});

// POST /api/aa/session/revoke { sessionKeyId }
router.post('/session/revoke', authenticateUser, async (req: Request, res: Response) => {
  if (!env.SESSION_KEY_MANAGER_ADDRESS) {
    return res.status(501).json({
      supported: false,
      message: 'Session Key Manager is not configured. Set SESSION_KEY_MANAGER_ADDRESS in your environment.',
    });
  }

  try {
    const { sessionKeyId } = req.body;
    const orgId = req.user!.orgId;

    if (!sessionKeyId) {
      return res.status(400).json({ error: 'Missing sessionKeyId.' });
    }

    // Fetch the session key from the database to get its public key and smart account ID
    const pool = getDatabase();
    const client = await pool.connect();
    let sessionKeyToRevoke;
    try {
      const resDb = await client.query(
        `SELECT * FROM session_keys WHERE id = $1 AND smart_account_id = $2`,
        [sessionKeyId, orgId]
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
    await sessionKeyService.revokeSessionKey(sessionKeyId);

    const ownerAddress = ethers.getAddress(ethers.keccak256(ethers.toUtf8Bytes(orgId)).slice(0, 42));
    const smartAccountAddress = await smartAccountService.getCounterfactualAddress(ownerAddress);

    // Build UserOp to revoke session key on-chain
    const revokeUserOpPartial = await sessionKeyService.revokeSessionKeyUserOp({
      smartAccountAddress: smartAccountAddress,
      sessionPubKey: sessionKeyToRevoke.public_key,
    });

    let userOp: UserOperationV06 = {
      sender: smartAccountAddress,
      nonce: BigInt(0), // Will be filled
      initCode: '0x', // Not needed for revocation if account is already deployed
      callData: revokeUserOpPartial.callData || '0x',
      callGasLimit: BigInt(0), // Will be filled
      verificationGasLimit: BigInt(0), // Will be filled
      preVerificationGas: BigInt(0), // Will be filled
      maxFeePerGas: BigInt(0), // Will be filled
      maxPriorityFeePerGas: BigInt(0), // Will be filled
      paymasterAndData: '0x', // Will be filled
      signature: '0x', // Will be signed
    };

    // Fill nonce
    userOp.nonce = await fillNonce(env.ENTRY_POINT_ADDRESS, smartAccountAddress, provider);

    // Get paymaster data (sponsorship)
    userOp = await ensurePaymaster({ userOp, paymasterService });

    // Fill gas estimates
    userOp = await fillGas({ bundlerClient, userOp, entryPointAddress: env.ENTRY_POINT_ADDRESS });

    // Sign the UserOperation
    const signer = await getSigner(orgId);
    if (!signer) {
      return res.status(500).json({ error: 'No signer available for user operation.' });
    }
    userOp.signature = await signUserOp({
      userOp,
      signer,
      entryPointAddress: env.ENTRY_POINT_ADDRESS,
      chainId: BigInt(env.CHAIN_ID),
    });

    const userOpHash = await bundlerClient.sendUserOperation(userOp, env.ENTRY_POINT_ADDRESS);
    logger.info(`Session key revocation UserOp submitted: ${userOpHash}`);

    res.status(200).json({ message: 'Session key revoked successfully.', userOpHash });
  } catch (error: any) {
    logger.error('Error revoking session key:', error);
    res.status(500).json({ error: 'Failed to revoke session key.' });
  }
});

// POST /api/aa/sponsor-and-send { to, data, value? }
router.post('/sponsor-and-send', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { to, data, value } = req.body;
    const orgId = req.user!.orgId;

    if (!to || !data) {
      return res.status(400).json({ error: 'Missing "to" or "data" in request body.' });
    }

    const ownerAddress = ethers.getAddress(ethers.keccak256(ethers.toUtf8Bytes(orgId)).slice(0, 42));
    const smartAccountAddress = await smartAccountService.getCounterfactualAddress(ownerAddress);

    let userOp: UserOperationV06 = {
      sender: smartAccountAddress,
      nonce: BigInt(0), // Will be filled
      initCode: '0x', // Will be filled if account is not deployed
      callData: buildCallData(to, data, value ? BigInt(value) : BigInt(0)),
      callGasLimit: BigInt(0), // Will be filled
      verificationGasLimit: BigInt(0), // Will be filled
      preVerificationGas: BigInt(0), // Will be filled
      maxFeePerGas: BigInt(0), // Will be filled
      maxPriorityFeePerGas: BigInt(0), // Will be filled
      paymasterAndData: '0x', // Will be filled
      signature: '0x', // Will be signed
    };

    // Ensure smart account is deployed and get initCode if needed
    userOp.initCode = await smartAccountService.ensureDeployedSmartAccount(smartAccountAddress, ownerAddress);

    // Fill nonce
    userOp.nonce = await fillNonce(env.ENTRY_POINT_ADDRESS, smartAccountAddress, provider);

    // Get paymaster data (sponsorship)
    userOp = await ensurePaymaster({ userOp, paymasterService });

    // Fill gas estimates
    userOp = await fillGas({ bundlerClient, userOp, entryPointAddress: env.ENTRY_POINT_ADDRESS });

    // Sign the UserOperation
    const signer = await getSigner(orgId, true); // Try to use session key, fallback to owner
    if (!signer) {
      return res.status(500).json({ error: 'No signer available for user operation.' });
    }
    userOp.signature = await signUserOp({
      userOp,
      signer,
      entryPointAddress: env.ENTRY_POINT_ADDRESS,
      chainId: BigInt(env.CHAIN_ID),
    });

    const userOpHash = await bundlerClient.sendUserOperation(userOp, env.ENTRY_POINT_ADDRESS);
    logger.info(`Sponsored UserOp submitted: ${userOpHash}`);

    let txHash: string | undefined;
    try {
      const receipt = await bundlerClient.getUserOperationReceipt(userOpHash);
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
    const orgId = req.user!.orgId;
    const activeSessions = await sessionKeyService.getActiveSessionKeys(orgId);
    res.json(activeSessions.map(session => ({
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

export default router;