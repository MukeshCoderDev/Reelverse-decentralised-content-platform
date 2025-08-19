import { Router, Request, Response, NextFunction } from 'express';
import { SmartAccountService } from '../services/onchain/smartAccountService';
import { SessionKeyService } from '../services/onchain/sessionKeyService';
import { UnifiedPaymasterService } from '../services/onchain/biconomyPaymasterService';
import { currentChainConfig } from '../config/chain';
import { logger } from '../utils/logger';
import { getDatabase } from '../config/database';
import { ethers } from 'ethers';
import { UserOperation } from '../services/onchain/paymasterService';

const router = Router();
const smartAccountService = new SmartAccountService();
const sessionKeyService = new SessionKeyService();
const paymasterService = new UnifiedPaymasterService();

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

// GET /api/aa/account → { smartAccountAddress, deployed, entryPoint, chainId }
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
    });
  } catch (error: any) {
    logger.error('Error fetching smart account details:', error);
    res.status(500).json({ error: 'Failed to fetch smart account details.' });
  }
});

// POST /api/aa/session/create { ttlMins, scope } → creates session key, registers via bundler, returns {sessionKeyId, publicKey, expiresAt}
router.post('/session/create', authenticateUser, async (req: Request, res: Response) => {
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

    // 3. Build and submit UserOp to register session key on-chain
    const registerUserOpPartial = await sessionKeyService.buildRegisterSessionKeyUserOp({
      smartAccountAddress,
      sessionPubKey: publicKey,
      targets: scope.targets || [],
      selectors: scope.selectors || [],
      expiry: Math.floor(expiresAt.getTime() / 1000),
    });

    // For a complete UserOperation, we need to fill in all fields.
    const fullUserOp: UserOperation = {
      sender: smartAccountAddress,
      nonce: '0x0', // Placeholder: should be fetched from entryPoint.getNonce(sender, key)
      initCode: '0x', // Will be filled by ensureDeployedSmartAccount if needed
      callData: registerUserOpPartial.callData || '0x',
      callGasLimit: '0x50000', // Placeholder
      verificationGasLimit: '0x100000', // Placeholder
      preVerificationGas: '0x10000', // Placeholder
      maxFeePerGas: '0x1', // Placeholder
      maxPriorityFeePerGas: '0x1', // Placeholder
      paymasterAndData: '0x', // Will be filled by paymasterService.getPaymasterData
      signature: '0x' // Placeholder: will be signed by the smart account owner or session key
    };

    // Ensure smart account is deployed and get initCode if needed
    fullUserOp.initCode = await smartAccountService.ensureDeployedSmartAccount(smartAccountAddress, ownerAddress);

    // Get paymaster data
    const paymasterResult = await paymasterService.getPaymasterData(fullUserOp);
    fullUserOp.paymasterAndData = paymasterResult.paymasterAndData;
    fullUserOp.preVerificationGas = paymasterResult.preVerificationGas;
    fullUserOp.verificationGasLimit = paymasterResult.verificationGasLimit;
    fullUserOp.callGasLimit = paymasterResult.callGasLimit;
    fullUserOp.maxFeePerGas = paymasterResult.maxFeePerGas;
    fullUserOp.maxPriorityFeePerGas = paymasterResult.maxPriorityFeePerGas;

    // Sign the UserOperation (placeholder - in a real app, this would be done by the user's wallet/signer)
    fullUserOp.signature = '0xdeadbeef'; // Dummy signature

    const userOpHash = await paymasterService.submitUserOperation(fullUserOp);
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

    // 2. Build and submit UserOp to revoke session key on-chain
    const revokeUserOpPartial = await sessionKeyService.revokeSessionKeyUserOp({
      smartAccountAddress: smartAccountAddress,
      sessionPubKey: sessionKeyToRevoke.public_key,
    });

    // For a complete UserOperation, we need to fill in all fields.
    const fullUserOp: UserOperation = {
      sender: smartAccountAddress,
      nonce: '0x0', // Placeholder: should be fetched from entryPoint.getNonce(sender, key)
      initCode: '0x', // Not needed for revocation if account is already deployed
      callData: revokeUserOpPartial.callData || '0x',
      callGasLimit: '0x50000', // Placeholder
      verificationGasLimit: '0x100000', // Placeholder
      preVerificationGas: '0x10000', // Placeholder
      maxFeePerGas: '0x1', // Placeholder
      maxPriorityFeePerGas: '0x1', // Placeholder
      paymasterAndData: '0x', // Will be filled by paymasterService.getPaymasterData
      signature: '0x' // Placeholder: will be signed by the smart account owner or session key
    };

    // Get paymaster data
    const paymasterResult = await paymasterService.getPaymasterData(fullUserOp);
    fullUserOp.paymasterAndData = paymasterResult.paymasterAndData;
    fullUserOp.preVerificationGas = paymasterResult.preVerificationGas;
    fullUserOp.verificationGasLimit = paymasterResult.verificationGasLimit;
    fullUserOp.callGasLimit = paymasterResult.callGasLimit;
    fullUserOp.maxFeePerGas = paymasterResult.maxFeePerGas;
    fullUserOp.maxPriorityFeePerGas = paymasterResult.maxPriorityFeePerGas;

    // Sign the UserOperation (placeholder)
    fullUserOp.signature = '0xdeadbeef'; // Dummy signature

    const userOpHash = await paymasterService.submitUserOperation(fullUserOp);
    logger.info(`Session key revocation UserOp submitted: ${userOpHash}`);

    res.status(200).json({ message: 'Session key revoked successfully.', userOpHash });
  } catch (error: any) {
    logger.error('Error revoking session key:', error);
    res.status(500).json({ error: 'Failed to revoke session key.' });
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