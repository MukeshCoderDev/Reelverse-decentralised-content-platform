import { Router, Request, Response } from 'express';
import { payoutService } from '../services/payoutService';
import { authenticateWallet } from '../middleware/auth';

const router = Router();

/**
 * Get creator balance
 * GET /api/payout/balance
 */
router.get('/balance', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const creatorWallet = (req as any).walletAddress;
    
    const balance = await payoutService.getCreatorBalance(creatorWallet);
    
    res.json(balance);
  } catch (error) {
    console.error('Balance retrieval error:', error);
    res.status(500).json({
      code: 'PAYOUT_001',
      message: 'Failed to retrieve balance',
      timestamp: Date.now()
    });
  }
});

/**
 * Add payout method
 * POST /api/payout/methods
 */
router.post('/methods', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { type, details, isDefault } = req.body;
    const creatorWallet = (req as any).walletAddress;

    if (!type || !details) {
      return res.status(400).json({
        code: 'PAYOUT_002',
        message: 'Missing required fields: type, details',
        timestamp: Date.now()
      });
    }

    if (!['usdc', 'paxum', 'bank_transfer'].includes(type)) {
      return res.status(400).json({
        code: 'PAYOUT_003',
        message: 'Invalid payout method type. Must be: usdc, paxum, or bank_transfer',
        timestamp: Date.now()
      });
    }

    // Validate required details based on type
    if (type === 'usdc' && !details.walletAddress) {
      return res.status(400).json({
        code: 'PAYOUT_004',
        message: 'USDC payout method requires walletAddress',
        timestamp: Date.now()
      });
    }

    if (type === 'paxum' && !details.paxumEmail) {
      return res.status(400).json({
        code: 'PAYOUT_005',
        message: 'Paxum payout method requires paxumEmail',
        timestamp: Date.now()
      });
    }

    if (type === 'bank_transfer' && (!details.accountNumber || !details.routingNumber)) {
      return res.status(400).json({
        code: 'PAYOUT_006',
        message: 'Bank transfer requires accountNumber and routingNumber',
        timestamp: Date.now()
      });
    }

    const payoutMethod = await payoutService.addPayoutMethod(
      creatorWallet,
      type,
      details,
      isDefault || false
    );

    res.json({
      success: true,
      payoutMethod: {
        id: payoutMethod.id,
        type: payoutMethod.type,
        isDefault: payoutMethod.isDefault,
        isVerified: payoutMethod.isVerified,
        createdAt: payoutMethod.createdAt
      }
    });
  } catch (error) {
    console.error('Payout method creation error:', error);
    res.status(500).json({
      code: 'PAYOUT_007',
      message: 'Failed to add payout method',
      timestamp: Date.now()
    });
  }
});

/**
 * Get payout methods
 * GET /api/payout/methods
 */
router.get('/methods', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const creatorWallet = (req as any).walletAddress;
    
    const methods = await payoutService.getPayoutMethods(creatorWallet);
    
    // Don't expose sensitive details in the response
    const safeMethods = methods.map(method => ({
      id: method.id,
      type: method.type,
      isDefault: method.isDefault,
      isVerified: method.isVerified,
      createdAt: method.createdAt,
      // Only show partial details for security
      details: {
        walletAddress: method.details.walletAddress ? 
          `${method.details.walletAddress.slice(0, 6)}...${method.details.walletAddress.slice(-4)}` : undefined,
        paxumEmail: method.details.paxumEmail ? 
          `${method.details.paxumEmail.split('@')[0].slice(0, 3)}***@${method.details.paxumEmail.split('@')[1]}` : undefined,
        bankName: method.details.bankName,
        accountNumber: method.details.accountNumber ? 
          `***${method.details.accountNumber.slice(-4)}` : undefined
      }
    }));
    
    res.json({
      methods: safeMethods
    });
  } catch (error) {
    console.error('Payout methods retrieval error:', error);
    res.status(500).json({
      code: 'PAYOUT_008',
      message: 'Failed to retrieve payout methods',
      timestamp: Date.now()
    });
  }
});

/**
 * Request USDC payout
 * POST /api/payout/usdc
 */
router.post('/usdc', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { amount, payoutMethodId } = req.body;
    const creatorWallet = (req as any).walletAddress;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        code: 'PAYOUT_009',
        message: 'Invalid amount. Must be greater than 0',
        timestamp: Date.now()
      });
    }

    const payoutRequest = await payoutService.requestUSDCPayout(
      creatorWallet,
      amount,
      payoutMethodId
    );

    res.json({
      success: true,
      payoutRequest: {
        id: payoutRequest.id,
        amount: payoutRequest.amount,
        currency: payoutRequest.currency,
        status: payoutRequest.status,
        transactionHash: payoutRequest.transactionHash,
        requestedAt: payoutRequest.requestedAt,
        completedAt: payoutRequest.completedAt
      }
    });
  } catch (error) {
    console.error('USDC payout error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Minimum') || error.message.includes('Insufficient')) {
        return res.status(400).json({
          code: 'PAYOUT_010',
          message: error.message,
          timestamp: Date.now()
        });
      }
    }

    res.status(500).json({
      code: 'PAYOUT_011',
      message: 'Failed to process USDC payout',
      timestamp: Date.now()
    });
  }
});

/**
 * Request fiat payout
 * POST /api/payout/fiat
 */
router.post('/fiat', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { amount, payoutMethodId } = req.body;
    const creatorWallet = (req as any).walletAddress;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        code: 'PAYOUT_012',
        message: 'Invalid amount. Must be greater than 0',
        timestamp: Date.now()
      });
    }

    if (!payoutMethodId) {
      return res.status(400).json({
        code: 'PAYOUT_013',
        message: 'Payout method ID is required for fiat payouts',
        timestamp: Date.now()
      });
    }

    const payoutRequest = await payoutService.requestFiatPayout(
      creatorWallet,
      amount,
      payoutMethodId
    );

    res.json({
      success: true,
      payoutRequest: {
        id: payoutRequest.id,
        amount: payoutRequest.amount,
        currency: payoutRequest.currency,
        status: payoutRequest.status,
        paxumTransactionId: payoutRequest.paxumTransactionId,
        requestedAt: payoutRequest.requestedAt,
        completedAt: payoutRequest.completedAt
      }
    });
  } catch (error) {
    console.error('Fiat payout error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Minimum') || 
          error.message.includes('Insufficient') || 
          error.message.includes('not found') ||
          error.message.includes('Invalid payout method')) {
        return res.status(400).json({
          code: 'PAYOUT_014',
          message: error.message,
          timestamp: Date.now()
        });
      }
    }

    res.status(500).json({
      code: 'PAYOUT_015',
      message: 'Failed to process fiat payout',
      timestamp: Date.now()
    });
  }
});

/**
 * Get payout history
 * GET /api/payout/history
 */
router.get('/history', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const creatorWallet = (req as any).walletAddress;

    const history = await payoutService.getPayoutHistory(
      creatorWallet,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      history,
      total: history.length,
      hasMore: history.length === parseInt(limit as string)
    });
  } catch (error) {
    console.error('Payout history error:', error);
    res.status(500).json({
      code: 'PAYOUT_016',
      message: 'Failed to retrieve payout history',
      timestamp: Date.now()
    });
  }
});

/**
 * Get payout statistics (admin only)
 * GET /api/payout/stats
 */
router.get('/stats', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { timeframe = 'month' } = req.query;

    if (!['day', 'week', 'month'].includes(timeframe as string)) {
      return res.status(400).json({
        code: 'PAYOUT_017',
        message: 'Invalid timeframe. Must be: day, week, or month',
        timestamp: Date.now()
      });
    }

    // TODO: Add admin role check
    const stats = await payoutService.getPayoutStats(timeframe as any);

    res.json({
      timeframe,
      stats,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Payout stats error:', error);
    res.status(500).json({
      code: 'PAYOUT_018',
      message: 'Failed to retrieve payout statistics',
      timestamp: Date.now()
    });
  }
});

/**
 * Check payout eligibility
 * GET /api/payout/eligibility
 */
router.get('/eligibility', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const creatorWallet = (req as any).walletAddress;
    
    const balance = await payoutService.getCreatorBalance(creatorWallet);
    const now = new Date();
    
    const eligibility = {
      canPayoutUSDC: balance.usdcBalance >= 10, // $10 minimum
      canPayoutFiat: balance.fiatBalance >= 50, // $50 minimum
      nextPayoutEligible: balance.nextPayoutEligible,
      canPayoutNow: now >= balance.nextPayoutEligible,
      timeUntilNextPayout: balance.nextPayoutEligible > now ? 
        Math.ceil((balance.nextPayoutEligible.getTime() - now.getTime()) / (1000 * 60 * 60)) : 0, // hours
      balances: {
        usdc: balance.usdcBalance,
        fiat: balance.fiatBalance,
        pendingUSDC: balance.pendingUSDC,
        pendingFiat: balance.pendingFiat
      }
    };

    res.json(eligibility);
  } catch (error) {
    console.error('Payout eligibility error:', error);
    res.status(500).json({
      code: 'PAYOUT_019',
      message: 'Failed to check payout eligibility',
      timestamp: Date.now()
    });
  }
});

export default router;