import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import USDCPaymentService from '../services/usdcPaymentService';
import { logger } from '../utils/logger';

const router = Router();
const usdcPaymentService = new USDCPaymentService();

// Validation middleware
const validatePaymentRequest = [
  body('contentId').isString().notEmpty().withMessage('Content ID is required'),
  body('userAddress').isEthereumAddress().withMessage('Valid Ethereum address required'),
  body('priceUSDC').isString().notEmpty().withMessage('Price in USDC is required'),
  body('permitSignature').optional().isObject().withMessage('Permit signature must be an object')
];

const validateCheckoutRequest = [
  body('contentId').isString().notEmpty().withMessage('Content ID is required'),
  body('userAddress').isEthereumAddress().withMessage('Valid Ethereum address required')
];

const validateConfirmRequest = [
  body('contentId').isString().notEmpty().withMessage('Content ID is required'),
  body('providerRef').isString().notEmpty().withMessage('Provider reference is required')
];

// USDC payment processing endpoints
router.post('/checkout/usdc', 
  authenticateToken,
  validateCheckoutRequest,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { contentId, userAddress } = req.body;
      
      // Verify the authenticated user matches the request
      if (req.user?.address?.toLowerCase() !== userAddress.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Address mismatch'
        });
      }

      const checkoutData = await usdcPaymentService.prepareUSDCCheckout(contentId, userAddress);
      
      res.json({
        success: true,
        ...checkoutData
      });

    } catch (error) {
      logger.error('USDC checkout error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  })
);

router.post('/process/usdc',
  authenticateToken,
  validatePaymentRequest,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { contentId, userAddress, priceUSDC, permitSignature } = req.body;
      
      // Verify the authenticated user matches the request
      if (req.user?.address?.toLowerCase() !== userAddress.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Address mismatch'
        });
      }

      const paymentResult = await usdcPaymentService.processUSDCPayment({
        contentId,
        userAddress,
        priceUSDC,
        permitSignature
      });

      if (paymentResult.success) {
        res.json(paymentResult);
      } else {
        res.status(400).json(paymentResult);
      }

    } catch (error) {
      logger.error('USDC payment processing error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  })
);

// Fiat payment processing
router.post('/checkout/fiat', 
  authenticateToken,
  validateCheckoutRequest,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { contentId, userAddress, userEmail, returnUrl, cancelUrl } = req.body;
      
      // Verify the authenticated user matches the request
      if (req.user?.address?.toLowerCase() !== userAddress.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Address mismatch'
        });
      }

      const fiatPaymentService = new (await import('../services/fiatPaymentService')).default();
      const checkoutResult = await fiatPaymentService.createFiatCheckout({
        contentId,
        userAddress,
        userEmail,
        returnUrl,
        cancelUrl
      });

      if (checkoutResult.success) {
        res.json(checkoutResult);
      } else {
        res.status(400).json(checkoutResult);
      }

    } catch (error) {
      logger.error('Fiat checkout error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  })
);

// Payment confirmation endpoint
router.post('/checkout/confirm', 
  authenticateToken,
  validateConfirmRequest,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { contentId, providerRef } = req.body;
      const userAddress = req.user?.address;

      if (!userAddress) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const entitlementId = await usdcPaymentService.confirmPayment(contentId, userAddress, providerRef);
      
      res.json({ 
        success: true,
        entitlementId
      });

    } catch (error) {
      logger.error('Payment confirmation error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  })
);

// Get payment status
router.get('/status/:contentId',
  authenticateToken,
  param('contentId').isString().notEmpty(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { contentId } = req.params;
      const userAddress = req.user?.address;

      if (!userAddress) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const status = await usdcPaymentService.getPaymentStatus(contentId, userAddress);
      
      res.json({
        success: true,
        ...status
      });

    } catch (error) {
      logger.error('Payment status error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  })
);

// Get fiat payment session
router.get('/session/:sessionId',
  authenticateToken,
  param('sessionId').isString().notEmpty(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { sessionId } = req.params;
      const userAddress = req.user?.address;

      if (!userAddress) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const FiatPaymentService = (await import('../services/fiatPaymentService')).default;
      const fiatPaymentService = new FiatPaymentService();
      const session = await fiatPaymentService.getPaymentSession(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Payment session not found'
        });
      }

      // Verify user owns this session
      if (session.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.json({
        success: true,
        session: {
          sessionId,
          contentId: session.contentId,
          status: session.status,
          priceUSD: session.priceUSD,
          provider: session.provider,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt
        }
      });

    } catch (error) {
      logger.error('Payment session error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  })
);

// Cancel fiat payment session
router.post('/session/:sessionId/cancel',
  authenticateToken,
  param('sessionId').isString().notEmpty(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { sessionId } = req.params;
      const userAddress = req.user?.address;

      if (!userAddress) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const FiatPaymentService = (await import('../services/fiatPaymentService')).default;
      const fiatPaymentService = new FiatPaymentService();
      
      // Get session to verify ownership
      const session = await fiatPaymentService.getPaymentSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Payment session not found'
        });
      }

      if (session.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const cancelled = await fiatPaymentService.cancelPaymentSession(sessionId);
      
      if (cancelled) {
        res.json({
          success: true,
          message: 'Payment session cancelled'
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to cancel payment session'
        });
      }

    } catch (error) {
      logger.error('Payment cancellation error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  })
);

// Get available payment methods
router.get('/methods/:contentId',
  optionalAuth, // Optional auth to allow checking without login
  param('contentId').isString().notEmpty(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { contentId } = req.params;
      const userAddress = req.user?.address || '0x0000000000000000000000000000000000000000';

      const FiatPaymentService = (await import('../services/fiatPaymentService')).default;
      const fiatPaymentService = new FiatPaymentService();
      const methods = await fiatPaymentService.getAvailablePaymentMethods(userAddress, contentId);

      res.json({
        success: true,
        ...methods
      });

    } catch (error) {
      logger.error('Payment methods error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  })
);

export default router;