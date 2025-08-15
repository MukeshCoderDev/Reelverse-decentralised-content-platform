import express from 'express';
import { GaslessPaymentService } from '../../services/gaslessPaymentService';
import { GaslessCheckoutService } from '../../services/gaslessCheckoutService';

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
 * Initialize gasless checkout
 * POST /api/gasless-payments/checkout/init
 */
router.post('/checkout/init', requireAuth, async (req, res) => {
  try {
    const { contentId, amount, userWalletAddress, paymentMethod } = req.body;
    
    if (!contentId) {
      return res.status(400).json({ error: 'contentId is required' });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    if (!userWalletAddress || !userWalletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Valid userWalletAddress is required' });
    }

    const checkoutService: GaslessCheckoutService = req.app.get('gaslessCheckoutService');
    
    const checkoutRequest = {
      userId: req.user.id,
      contentId,
      amount,
      userWalletAddress,
      paymentMethod: paymentMethod || 'auto'
    };

    const session = await checkoutService.initializeCheckout(checkoutRequest);

    res.json({
      success: true,
      session: {
        checkoutId: session.id,
        amount: session.amount,
        expiresAt: session.expiresAt,
        permitSignatureData: session.permitSignatureData
      }
    });

  } catch (error) {
    console.error('Error initializing gasless checkout:', error);
    res.status(500).json({ 
      error: 'Failed to initialize checkout',
      details: error.message 
    });
  }
});

/**
 * Complete gasless checkout
 * POST /api/gasless-payments/checkout/complete
 */
router.post('/checkout/complete', requireAuth, async (req, res) => {
  try {
    const { checkoutId, permitSignature } = req.body;
    
    if (!checkoutId) {
      return res.status(400).json({ error: 'checkoutId is required' });
    }

    const checkoutService: GaslessCheckoutService = req.app.get('gaslessCheckoutService');
    
    const result = await checkoutService.completeCheckout(checkoutId, permitSignature);

    res.json({
      success: result.success,
      checkoutId: result.checkoutId,
      paymentMethod: result.paymentMethod,
      gasSponsored: result.paymentResult?.gasSponsored,
      transactionHash: result.paymentResult?.transactionHash,
      userOpHash: result.paymentResult?.userOpHash,
      gasSavings: result.gasSavings,
      error: result.error
    });

  } catch (error) {
    console.error('Error completing gasless checkout:', error);
    res.status(500).json({ 
      error: 'Failed to complete checkout',
      details: error.message 
    });
  }
});

/**
 * Execute gasless payment directly
 * POST /api/gasless-payments/execute
 */
router.post('/execute', requireAuth, async (req, res) => {
  try {
    const { from, to, amount, permit, metadata } = req.body;
    
    if (!from || !from.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Valid from address is required' });
    }

    if (!to || !to.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Valid to address is required' });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    if (!permit || !permit.signature) {
      return res.status(400).json({ error: 'Valid permit signature is required' });
    }

    const gaslessPaymentService: GaslessPaymentService = req.app.get('gaslessPaymentService');
    
    const paymentRequest = {
      from,
      to,
      amount,
      permit,
      metadata
    };

    const result = await gaslessPaymentService.executeGaslessPayment(paymentRequest);

    res.json({
      success: result.success,
      gasSponsored: result.gasSponsored,
      fallbackUsed: result.fallbackUsed,
      userOpHash: result.userOpHash,
      transactionHash: result.transactionHash,
      error: result.error
    });

  } catch (error) {
    console.error('Error executing gasless payment:', error);
    res.status(500).json({ 
      error: 'Failed to execute gasless payment',
      details: error.message 
    });
  }
});

/**
 * Generate permit signature data
 * POST /api/gasless-payments/permit-data
 */
router.post('/permit-data', requireAuth, async (req, res) => {
  try {
    const { token, spender, amount, deadline } = req.body;
    
    if (!token || !token.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Valid token address is required' });
    }

    if (!spender || !spender.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Valid spender address is required' });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const gaslessPaymentService: GaslessPaymentService = req.app.get('gaslessPaymentService');
    
    const permitData = await gaslessPaymentService.generatePermitSignatureData(
      token,
      spender,
      amount,
      deadline || Math.floor(Date.now() / 1000) + 3600 // 1 hour default
    );

    res.json({
      success: true,
      permitData
    });

  } catch (error) {
    console.error('Error generating permit data:', error);
    res.status(500).json({ 
      error: 'Failed to generate permit data',
      details: error.message 
    });
  }
});

/**
 * Validate payment preconditions
 * POST /api/gasless-payments/validate
 */
router.post('/validate', requireAuth, async (req, res) => {
  try {
    const { from, amount } = req.body;
    
    if (!from || !from.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Valid from address is required' });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const gaslessPaymentService: GaslessPaymentService = req.app.get('gaslessPaymentService');
    
    const validation = await gaslessPaymentService.validatePaymentPreconditions(from, amount);

    res.json({
      success: true,
      valid: validation.valid,
      error: validation.error
    });

  } catch (error) {
    console.error('Error validating payment preconditions:', error);
    res.status(500).json({ 
      error: 'Failed to validate payment preconditions',
      details: error.message 
    });
  }
});

/**
 * Estimate gas savings
 * POST /api/gasless-payments/estimate-savings
 */
router.post('/estimate-savings', requireAuth, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const gaslessPaymentService: GaslessPaymentService = req.app.get('gaslessPaymentService');
    
    const savings = await gaslessPaymentService.estimateGasSavings(amount);

    res.json({
      success: true,
      savings
    });

  } catch (error) {
    console.error('Error estimating gas savings:', error);
    res.status(500).json({ 
      error: 'Failed to estimate gas savings',
      details: error.message 
    });
  }
});

/**
 * Batch execute gasless payments (admin only)
 * POST /api/gasless-payments/batch-execute
 */
router.post('/batch-execute', requireAdmin, async (req, res) => {
  try {
    const { paymentRequests } = req.body;
    
    if (!Array.isArray(paymentRequests) || paymentRequests.length === 0) {
      return res.status(400).json({ error: 'paymentRequests array is required' });
    }

    if (paymentRequests.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 payments per batch' });
    }

    const gaslessPaymentService: GaslessPaymentService = req.app.get('gaslessPaymentService');
    
    const results = await gaslessPaymentService.batchExecuteGaslessPayments(paymentRequests);

    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      gasSponsored: results.filter(r => r.gasSponsored).length,
      fallbackUsed: results.filter(r => r.fallbackUsed).length
    };

    res.json({
      success: true,
      summary,
      results
    });

  } catch (error) {
    console.error('Error batch executing gasless payments:', error);
    res.status(500).json({ 
      error: 'Failed to batch execute gasless payments',
      details: error.message 
    });
  }
});

/**
 * Get payment statistics (admin only)
 * GET /api/gasless-payments/stats
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const gaslessPaymentService: GaslessPaymentService = req.app.get('gaslessPaymentService');
    const checkoutService: GaslessCheckoutService = req.app.get('gaslessCheckoutService');
    
    const [paymentStats, checkoutStats] = await Promise.all([
      gaslessPaymentService.getPaymentStats(),
      checkoutService.getCheckoutStats()
    ]);

    res.json({
      success: true,
      payments: paymentStats,
      checkouts: checkoutStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting gasless payment stats:', error);
    res.status(500).json({ 
      error: 'Failed to get gasless payment stats',
      details: error.message 
    });
  }
});

/**
 * Cancel checkout
 * POST /api/gasless-payments/checkout/cancel
 */
router.post('/checkout/cancel', requireAuth, async (req, res) => {
  try {
    const { checkoutId } = req.body;
    
    if (!checkoutId) {
      return res.status(400).json({ error: 'checkoutId is required' });
    }

    const checkoutService: GaslessCheckoutService = req.app.get('gaslessCheckoutService');
    
    await checkoutService.cancelCheckout(checkoutId);

    res.json({
      success: true,
      message: `Checkout ${checkoutId} cancelled`
    });

  } catch (error) {
    console.error('Error cancelling checkout:', error);
    res.status(500).json({ 
      error: 'Failed to cancel checkout',
      details: error.message 
    });
  }
});

/**
 * Get user checkout history
 * GET /api/gasless-payments/checkout/history
 */
router.get('/checkout/history', requireAuth, async (req, res) => {
  try {
    const { limit } = req.query;
    const checkoutService: GaslessCheckoutService = req.app.get('gaslessCheckoutService');
    
    const history = await checkoutService.getUserCheckoutHistory(
      req.user.id,
      limit ? parseInt(limit as string) : 10
    );

    res.json({
      success: true,
      history
    });

  } catch (error) {
    console.error('Error getting checkout history:', error);
    res.status(500).json({ 
      error: 'Failed to get checkout history',
      details: error.message 
    });
  }
});

/**
 * Get completion rate estimates
 * GET /api/gasless-payments/completion-rates
 */
router.get('/completion-rates', requireAuth, async (req, res) => {
  try {
    const checkoutService: GaslessCheckoutService = req.app.get('gaslessCheckoutService');
    
    const [gaslessRate, traditionalRate] = await Promise.all([
      checkoutService.estimateCompletionRate('gasless'),
      checkoutService.estimateCompletionRate('traditional')
    ]);

    res.json({
      success: true,
      completionRates: {
        gasless: gaslessRate,
        traditional: traditionalRate,
        improvement: gaslessRate - traditionalRate
      }
    });

  } catch (error) {
    console.error('Error getting completion rates:', error);
    res.status(500).json({ 
      error: 'Failed to get completion rates',
      details: error.message 
    });
  }
});

/**
 * Cleanup expired sessions (admin only)
 * POST /api/gasless-payments/cleanup
 */
router.post('/cleanup', requireAdmin, async (req, res) => {
  try {
    const checkoutService: GaslessCheckoutService = req.app.get('gaslessCheckoutService');
    
    const cleanedCount = await checkoutService.cleanupExpiredSessions();

    res.json({
      success: true,
      cleanedSessions: cleanedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup expired sessions',
      details: error.message 
    });
  }
});

export default router;