import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AgeVerificationService } from '../services/ageVerificationService';
import { logger } from '../utils/logger';

const router = Router();
const ageVerificationService = AgeVerificationService.getInstance();

// Webhook endpoints for external services
router.post('/persona', asyncHandler(async (req, res) => {
  try {
    logger.info('Received Persona webhook:', req.body);

    // Validate webhook signature if configured
    // TODO: Add webhook signature validation for production

    const event = req.body;
    
    // Validate required fields
    if (!event.type || !event.data?.object?.id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook payload'
      });
    }

    // Process the webhook event
    await ageVerificationService.handleWebhook(event);

    res.json({ 
      success: true, 
      message: 'Webhook processed successfully'
    });
  } catch (error: any) {
    logger.error('Failed to process Persona webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook'
    });
  }
}));

router.post('/ccbill', asyncHandler(async (req, res) => {
  try {
    logger.info('Received CCBill webhook:', req.body);

    const FiatPaymentService = (await import('../services/fiatPaymentService')).default;
    const fiatPaymentService = new FiatPaymentService();
    
    const result = await fiatPaymentService.handleWebhook('ccbill', req.body);
    
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (error) {
    logger.error('Failed to process CCBill webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook'
    });
  }
}));

router.post('/segpay', asyncHandler(async (req, res) => {
  try {
    logger.info('Received Segpay webhook:', req.body);

    const FiatPaymentService = (await import('../services/fiatPaymentService')).default;
    const fiatPaymentService = new FiatPaymentService();
    
    const result = await fiatPaymentService.handleWebhook('segpay', req.body);
    
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (error) {
    logger.error('Failed to process Segpay webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook'
    });
  }
}));

router.post('/livepeer', asyncHandler(async (req, res) => {
  try {
    logger.info('Received Livepeer webhook:', req.body);

    // Validate webhook signature if configured
    const signature = req.headers['livepeer-signature'];
    const webhookSecret = process.env.LIVEPEER_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      // Verify webhook signature (implementation would depend on Livepeer's signing method)
      // For now, we'll just log it
      logger.debug('Livepeer webhook signature:', signature);
    }

    const event = req.body;
    
    // Handle different event types
    switch (event.type) {
      case 'asset.ready':
        logger.info(`Asset ready: ${event.asset?.id}`);
        // Update upload progress if this is part of our pipeline
        break;
      case 'asset.failed':
        logger.error(`Asset failed: ${event.asset?.id}`, event.asset?.status?.errorMessage);
        // Update upload progress with error
        break;
      case 'asset.updated':
        logger.info(`Asset updated: ${event.asset?.id}`);
        // Update progress if needed
        break;
      default:
        logger.debug(`Unhandled Livepeer event type: ${event.type}`);
    }

    res.json({ 
      success: true, 
      message: 'Livepeer webhook processed successfully'
    });
  } catch (error) {
    logger.error('Failed to process Livepeer webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook'
    });
  }
}));

export default router;