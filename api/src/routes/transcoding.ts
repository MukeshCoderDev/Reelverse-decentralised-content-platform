/**
 * Transcoding Routes
 * Handles transcoding job management and webhook callbacks
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { transcodingService } from '../services/transcodingService';
import { observability } from '../core/observability';
import { metrics } from '../core/metrics';

const router = Router();

/**
 * Create transcoding job
 */
router.post('/jobs',
  requireAuth,
  [
    body('contentId').isString().notEmpty().withMessage('Content ID is required'),
    body('inputUrl').isURL().withMessage('Valid input URL is required'),
    body('inputSize').isInt({ min: 1 }).withMessage('Input size must be positive integer'),
    body('organizationId').isString().notEmpty().withMessage('Organization ID is required'),
    body('profiles').optional().isArray().withMessage('Profiles must be an array')
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { contentId, inputUrl, inputSize, organizationId, profiles } = req.body;
    const creatorId = req.user?.id;

    if (!creatorId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    try {
      const jobId = await transcodingService.createJob(
        contentId,
        inputUrl,
        inputSize,
        organizationId,
        creatorId,
        profiles
      );

      res.status(201).json({
        success: true,
        data: {
          jobId,
          status: 'pending',
          message: 'Transcoding job created successfully'
        }
      });

    } catch (error) {
      await observability.logEvent('error', 'Failed to create transcoding job', {
        contentId,
        organizationId,
        creatorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create transcoding job'
      });
    }
  })
);

/**
 * Get job status
 */
router.get('/jobs/:jobId',
  requireAuth,
  [
    param('jobId').isString().notEmpty().withMessage('Job ID is required')
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { jobId } = req.params;

    try {
      const status = transcodingService.getJobStatus(jobId);
      
      if (!status) {
        return res.status(404).json({
          success: false,
          error: 'Transcoding job not found'
        });
      }

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get job status'
      });
    }
  })
);

/**
 * Retry failed job
 */
router.post('/jobs/:jobId/retry',
  requireAuth,
  [
    param('jobId').isString().notEmpty().withMessage('Job ID is required')
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { jobId } = req.params;

    try {
      const livepeerAssetId = await transcodingService.retryJob(jobId);

      res.json({
        success: true,
        data: {
          jobId,
          livepeerAssetId,
          message: 'Job retry initiated successfully'
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retry job'
      });
    }
  })
);

/**
 * Cancel job
 */
router.post('/jobs/:jobId/cancel',
  requireAuth,
  [
    param('jobId').isString().notEmpty().withMessage('Job ID is required'),
    body('reason').optional().isString().withMessage('Reason must be a string')
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { jobId } = req.params;
    const { reason = 'Cancelled by user' } = req.body;

    try {
      await transcodingService.cancelJob(jobId, reason);

      res.json({
        success: true,
        data: {
          jobId,
          message: 'Job cancelled successfully'
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to cancel job'
      });
    }
  })
);

/**
 * Livepeer webhook handler for specific job
 */
router.post('/webhook/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const timerId = metrics.startTimer('transcoding_webhook', {
      jobId: req.params.jobId.substr(0, 8)
    });

    try {
      const { jobId } = req.params;
      const signature = req.headers['livepeer-signature'] as string;
      const payload = req.body;

      if (!signature) {
        metrics.endTimer(timerId, false, 'Missing signature');
        return res.status(400).json({
          success: false,
          error: 'Missing webhook signature'
        });
      }

      await transcodingService.handleWebhook(payload, signature, jobId);

      metrics.endTimer(timerId, true);
      res.json({
        success: true,
        message: 'Webhook processed successfully'
      });

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      
      await observability.logEvent('error', 'Transcoding webhook processing failed', {
        jobId: req.params.jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
        payload: req.body
      });

      // Return 200 to prevent webhook retries for invalid requests
      if (error instanceof Error && 
          (error.message.includes('not found') || 
           error.message.includes('signature') ||
           error.message.includes('timestamp'))) {
        return res.status(200).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to process webhook'
      });
    }
  })
);

/**
 * Health check endpoint
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'transcoding',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
}));

export default router;