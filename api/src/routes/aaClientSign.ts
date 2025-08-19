import { Router, Request, Response } from 'express';
import { ethers } from 'ethers'; // Import ethers
import { UserOperation, PaymasterService } from '../services/onchain/paymasterService';
import { BundlerClient } from '../services/onchain/bundlerClient';
import { SmartAccountService } from '../services/onchain/smartAccountService';
import { SessionKeyService } from '../services/onchain/sessionKeyService';
import { UserOperationStruct } from '@account-abstraction/contracts'; // Import UserOperationStruct
import { computeUserOpHash } from '../services/onchain/userOp'; // Import computeUserOpHash
import { currentChainConfig } from '../config/chain'; // Import currentChainConfig
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { parseRateLimit } from '../utils/rateLimitParser';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();
const bundlerClient = new BundlerClient(env.BUNDLER_URL || 'http://localhost:4337'); // Provide a fallback URL
const paymasterService = new PaymasterService();
let smartAccountService: SmartAccountService;
let sessionKeyService: SessionKeyService;

// Rate limiting for prepare and submit endpoints
const prepareRateLimit = rateLimit({ key: 'aa_prepare', ...parseRateLimit(env.RATE_LIMIT_SPONSOR) });
const submitRateLimit = rateLimit({ key: 'aa_submit', ...parseRateLimit(env.RATE_LIMIT_SUBMIT) });

/**
 * POST /api/v1/aa/userop/prepare
 * Prepares a user operation for client-side signing.
 * Body: { kind: 'call' | 'session_install', to?, data?, value?, scope?, ttlMins? }
 * Returns: { userOp, userOpHash }
 */
router.post('/userop/prepare', prepareRateLimit, async (req: Request, res: Response) => {
  try {
    const ownerAddress = req.user?.ownerAddress;

    if (!ownerAddress) {
      return res.status(400).json({ error: 'ownerAddress is required' });
    }

    // Initialize services with ownerAddress
    smartAccountService = new SmartAccountService(ownerAddress);
    sessionKeyService = new SessionKeyService(ownerAddress);

    let userOpStruct: UserOperationStruct; // Use UserOperationStruct initially
    const { kind, to, data, value, scope, ttlMins } = req.body; // Destructure body here

    if (kind === 'call') {
      if (!to || !data) {
        return res.status(400).json({ error: 'to and data are required for kind "call"' });
      }
      userOpStruct = await smartAccountService.buildExecuteCallUserOp(to, data, value || '0');
    } else if (kind === 'session_install') {
      const policyJson = scope ? JSON.stringify(scope) : env.SESSION_KEY_POLICY_JSON || '[]';
      userOpStruct = await sessionKeyService.buildRegisterSessionKeyUserOp(policyJson, ttlMins);
    } else {
      return res.status(400).json({ error: 'Invalid kind provided' });
    }

    // Fill nonce
    userOpStruct = await (bundlerClient as any).fillNonce(userOpStruct); // Cast to any for now

    // Convert UserOperationStruct to Partial<UserOperation> compatible format for paymaster
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

    // Call paymaster and fill gas
    const paymasterResult = await paymasterService.sponsorUserOperation(partialUserOp); // Use partialUserOp
    
    // Update userOpStruct with paymaster results (convert back to BigInt for gas fields)
    userOpStruct.paymasterAndData = paymasterResult.paymasterAndData;
    userOpStruct.preVerificationGas = BigInt(paymasterResult.preVerificationGas);
    userOpStruct.verificationGasLimit = BigInt(paymasterResult.verificationGasLimit);
    userOpStruct.callGasLimit = BigInt(paymasterResult.callGasLimit);
    userOpStruct.maxFeePerGas = BigInt(paymasterResult.maxFeePerGas);
    userOpStruct.maxPriorityFeePerGas = BigInt(paymasterResult.maxPriorityFeePerGas);

    // Compute userOpHash
    // Compute userOpHash using the imported function
    const userOpHash = computeUserOpHash(userOpStruct, currentChainConfig.entryPointAddress, BigInt(env.CHAIN_ID));
    res.json({ userOp: userOpStruct, userOpHash }); // Corrected userOp to userOpStruct
  } catch (error: any) { // Cast error to any
    logger.error('Error preparing user operation:', error);
    res.status(500).json({ error: 'Failed to prepare user operation', details: error.message });
  }
});

/**
 * POST /api/v1/aa/userop/submit
 * Accepts a signed user operation and submits it to the bundler.
 * Body: { userOp, signature }
 * Returns: { userOpHash, txHash?, receipt }
 */
router.post('/userop/submit', submitRateLimit, async (req: Request, res: Response) => {
  try {
    const { userOp, signature } = req.body;

    if (!userOp || !signature) {
      return res.status(400).json({ error: 'userOp and signature are required' });
    }

    // Attach the signature to the userOp
    userOp.signature = signature;

    // Submit to bundler
    // Submit to bundler
    const userOpHash = await (bundlerClient as any).sendUserOperation(userOp); // Cast to any for now

    // Poll for receipt
    const receipt = await (bundlerClient as any).pollUserOperationReceipt(userOpHash); // Cast to any for now
    res.json({ userOpHash, txHash: receipt?.receipt?.transactionHash, receipt });
  } catch (error: any) { // Cast error to any
    logger.error('Error submitting user operation:', error);
    res.status(500).json({ error: 'Failed to submit user operation', details: error.message });
  }
});

export default router;