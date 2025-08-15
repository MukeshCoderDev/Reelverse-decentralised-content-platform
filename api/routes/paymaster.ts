import express from 'express';
import { PaymasterService } from '../../services/paymasterService';
import { UnifiedPaymasterService } from '../../services/biconomyPaymasterService';

const router = express.Router();

// Middleware for authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Sponsor a user operation
 * POST /api/paymaster/sponsor
 */
router.post('/sponsor', requireAuth, async (req, res) => {
  try {
    const { userOperation, provider } = req.body;
    
    if (!userOperation) {
      return res.status(400).json({ error: 'userOperation is required' });
    }

    if (!userOperation.sender) {
      return res.status(400).json({ error: 'userOperation.sender is required' });
    }

    const unifiedPaymaster: UnifiedPaymasterService = req.app.get('unifiedPaymaster');
    
    // Get paymaster data
    const paymasterResult = await unifiedPaymaster.getPaymasterData(userOperation);

    res.json({
      success: true,
      paymasterResult,
      provider: provider || 'auto',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error sponsoring user operation:', error);
    res.status(500).json({ 
      error: 'Failed to sponsor user operation',
      details: error.message 
    });
  }
});

/**
 * Submit sponsored user operation
 * POST /api/paymaster/submit
 */
router.post('/submit', requireAuth, async (req, res) => {
  try {
    const { userOperation } = req.body;
    
    if (!userOperation) {
      return res.status(400).json({ error: 'userOperation is required' });
    }

    // Validate required fields
    const requiredFields = ['sender', 'nonce', 'callData', 'signature', 'paymasterAndData'];
    for (const field of requiredFields) {
      if (!userOperation[field]) {
        return res.status(400).json({ error: `userOperation.${field} is required` });
      }
    }

    const unifiedPaymaster: UnifiedPaymasterService = req.app.get('unifiedPaymaster');
    
    // Submit user operation
    const userOpHash = await unifiedPaymaster.submitUserOperation(userOperation);

    res.json({
      success: true,
      userOpHash,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error submitting user operation:', error);
    res.status(500).json({ 
      error: 'Failed to submit user operation',
      details: error.message 
    });
  }
});

/**
 * Get paymaster statistics (admin only)
 * GET /api/paymaster/stats
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const paymasterService: PaymasterService = req.app.get('paymasterService');
    const unifiedPaymaster: UnifiedPaymasterService = req.app.get('unifiedPaymaster');
    
    const [stats, healthCheck] = await Promise.all([
      paymasterService.getPaymasterStats(),
      unifiedPaymaster.healthCheck()
    ]);

    res.json({
      success: true,
      stats,
      providerHealth: healthCheck,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting paymaster stats:', error);
    res.status(500).json({ 
      error: 'Failed to get paymaster stats',
      details: error.message 
    });
  }
});

/**
 * Get spending limits for user
 * GET /api/paymaster/limits/:userAddress
 */
router.get('/limits/:userAddress', requireAuth, async (req, res) => {
  try {
    const { userAddress } = req.params;
    
    if (!userAddress || !userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Valid userAddress is required' });
    }

    const paymasterService: PaymasterService = req.app.get('paymasterService');
    
    const limits = await paymasterService.getSpendingLimits(userAddress);

    res.json({
      success: true,
      userAddress,
      limits,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting spending limits:', error);
    res.status(500).json({ 
      error: 'Failed to get spending limits',
      details: error.message 
    });
  }
});

/**
 * Fund paymaster (admin only)
 * POST /api/paymaster/fund
 */
router.post('/fund', requireAdmin, async (req, res) => {
  try {
    const { amountEth } = req.body;
    
    if (!amountEth || parseFloat(amountEth) <= 0) {
      return res.status(400).json({ error: 'Valid amountEth is required' });
    }

    const paymasterService: PaymasterService = req.app.get('paymasterService');
    
    const txHash = await paymasterService.fundPaymaster(amountEth);

    res.json({
      success: true,
      txHash,
      amountEth,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error funding paymaster:', error);
    res.status(500).json({ 
      error: 'Failed to fund paymaster',
      details: error.message 
    });
  }
});

/**
 * Withdraw from paymaster (admin only)
 * POST /api/paymaster/withdraw
 */
router.post('/withdraw', requireAdmin, async (req, res) => {
  try {
    const { amountEth, recipient } = req.body;
    
    if (!amountEth || parseFloat(amountEth) <= 0) {
      return res.status(400).json({ error: 'Valid amountEth is required' });
    }

    if (!recipient || !recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Valid recipient address is required' });
    }

    const paymasterService: PaymasterService = req.app.get('paymasterService');
    
    const txHash = await paymasterService.withdrawFromPaymaster(amountEth, recipient);

    res.json({
      success: true,
      txHash,
      amountEth,
      recipient,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error withdrawing from paymaster:', error);
    res.status(500).json({ 
      error: 'Failed to withdraw from paymaster',
      details: error.message 
    });
  }
});

/**
 * Batch sponsor multiple user operations
 * POST /api/paymaster/batch-sponsor
 */
router.post('/batch-sponsor', requireAuth, async (req, res) => {
  try {
    const { userOperations } = req.body;
    
    if (!Array.isArray(userOperations) || userOperations.length === 0) {
      return res.status(400).json({ error: 'userOperations array is required' });
    }

    if (userOperations.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 operations per batch' });
    }

    const paymasterService: PaymasterService = req.app.get('paymasterService');
    
    const results = await paymasterService.batchSponsorOperations(userOperations);

    res.json({
      success: true,
      results,
      total: userOperations.length,
      successful: results.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error batch sponsoring operations:', error);
    res.status(500).json({ 
      error: 'Failed to batch sponsor operations',
      details: error.message 
    });
  }
});

/**
 * Health check for paymaster providers
 * GET /api/paymaster/health
 */
router.get('/health', async (req, res) => {
  try {
    const unifiedPaymaster: UnifiedPaymasterService = req.app.get('unifiedPaymaster');
    
    const health = await unifiedPaymaster.healthCheck();

    const overallHealth = health.biconomy || health.alchemy;

    res.status(overallHealth ? 200 : 503).json({
      success: overallHealth,
      providers: health,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error checking paymaster health:', error);
    res.status(503).json({ 
      success: false,
      error: 'Health check failed',
      details: error.message 
    });
  }
});

/**
 * Validate paymaster configuration (admin only)
 * GET /api/paymaster/validate-config
 */
router.get('/validate-config', requireAdmin, async (req, res) => {
  try {
    const paymasterService: PaymasterService = req.app.get('paymasterService');
    
    const isValid = await paymasterService.validateConfiguration();

    res.json({
      success: true,
      configValid: isValid,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error validating paymaster config:', error);
    res.status(500).json({ 
      error: 'Failed to validate paymaster configuration',
      details: error.message 
    });
  }
});

/**
 * Estimate gas for user operation
 * POST /api/paymaster/estimate-gas
 */
router.post('/estimate-gas', requireAuth, async (req, res) => {
  try {
    const { userOperation } = req.body;
    
    if (!userOperation) {
      return res.status(400).json({ error: 'userOperation is required' });
    }

    // This would use the gas estimation from the paymaster service
    // For now, return mock estimates
    const gasEstimate = {
      preVerificationGas: '21000',
      verificationGasLimit: '100000',
      callGasLimit: '200000',
      maxFeePerGas: '20000000000', // 20 gwei
      maxPriorityFeePerGas: '2000000000', // 2 gwei
      totalCostEth: '0.00644', // Estimated total cost in ETH
      canSponsor: true
    };

    res.json({
      success: true,
      gasEstimate,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error estimating gas:', error);
    res.status(500).json({ 
      error: 'Failed to estimate gas',
      details: error.message 
    });
  }
});

/**
 * Get user operation receipt
 * GET /api/paymaster/receipt/:userOpHash
 */
router.get('/receipt/:userOpHash', requireAuth, async (req, res) => {
  try {
    const { userOpHash } = req.params;
    
    if (!userOpHash || !userOpHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      return res.status(400).json({ error: 'Valid userOpHash is required' });
    }

    // This would query the receipt from the blockchain
    // For now, return mock receipt
    const receipt = {
      userOpHash,
      transactionHash: '0x' + '1'.repeat(64),
      blockNumber: 12345678,
      blockHash: '0x' + '2'.repeat(64),
      gasUsed: '150000',
      effectiveGasPrice: '15000000000',
      status: 'success',
      logs: []
    };

    res.json({
      success: true,
      receipt,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting user operation receipt:', error);
    res.status(500).json({ 
      error: 'Failed to get user operation receipt',
      details: error.message 
    });
  }
});

export default router;