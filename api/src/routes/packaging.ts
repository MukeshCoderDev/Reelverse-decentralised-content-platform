/**
 * Content Packaging Routes
 * Handles packaging job management and key rotation
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { packagingService } from '../services/packagingService';
import { observability } from '../core/observability';
import { metrics } from '../core/metrics';

const router = Router();

/**
 * Create packaging job
 */
router.post('/jobs',
  requireAuth,
  [
    body('contentId').isString().notEmpty().withMessage('Content ID is required'),
    body('transcodingJobId').isString().notEmpty().withMessage('Transcoding job ID is required'),
    body('renditions').isArray({ min: 1 }).withMessage('At least one rendition is required'),
    body('organizationId').isString().notEmpty().withMessage('Organization ID is required')
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

    const { contentId, transcodingJobId, renditions, organizationId } = req.body;
    const creatorId = req.user?.id;

    if (!creatorId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    try {
      const jobId = await packagingService.packageContent(
        contentId,
        transcodingJobId,
        renditions,
        organizationId,
        creatorId
      );

      res.status(201).json({
        success: true,
        data: {
          jobId,
          status: 'pending',
          message: 'Packaging job created successfully'
        }
      });

    } catch (error) {
      await observability.logEvent('error', 'Failed to create packaging job', {
        contentId,
        transcodingJobId,
        organizationId,
        creatorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create packaging job'
      });
    }
  })
);

/**
 * Get packaging job status
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
      const job = packagingService.getJobStatus(jobId);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Packaging job not found'
        });
      }

      // Remove sensitive key information from response
      const sanitizedJob = {
        jobId: job.jobId,
        contentId: job.contentId,
        transcodingJobId: job.transcodingJobId,
        status: job.status,
        packages: job.packages.map(pkg => ({
          format: pkg.format,
          manifestUrl: pkg.manifestUrl,
          segmentCount: pkg.segmentUrls.length
        })),
        manifestUrls: job.manifestUrls,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
        lastError: job.lastError,
        retryCount: job.retryCount
      };

      res.json({
        success: true,
        data: sanitizedJob
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
 * Generate manifests for content
 */
router.post('/manifests/:contentId',
  requireAuth,
  [
    param('contentId').isString().notEmpty().withMessage('Content ID is required'),
    body('format').isIn(['hls', 'dash', 'cmaf']).withMessage('Format must be hls, dash, or cmaf')
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

    const { contentId } = req.params;
    const { format } = req.body;

    try {
      const manifestUrls = await packagingService.generateManifests(contentId, format);

      res.json({
        success: true,
        data: {
          contentId,
          format,
          manifestUrls,
          count: manifestUrls.length
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate manifests'
      });
    }
  })
);

/**
 * Rotate encryption keys
 */
router.post('/keys/:contentId/rotate',
  requireAuth,
  [
    param('contentId').isString().notEmpty().withMessage('Content ID is required')
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

    const { contentId } = req.params;

    try {
      const result = await packagingService.rotateKeys(contentId);

      res.json({
        success: true,
        data: {
          contentId,
          oldKeyId: result.oldKeyId,
          newKeyId: result.newKeyId,
          manifestsUpdated: result.manifestsUpdated.length,
          rotationCompletedAt: result.rotationCompletedAt,
          message: 'Key rotation completed successfully'
        }
      });

    } catch (error) {
      await observability.logEvent('error', 'Key rotation failed', {
        contentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rotate keys'
      });
    }
  })
);

/**
 * Emergency key rotation
 */
router.post('/keys/:contentId/emergency-rotate',
  requireAuth,
  [
    param('contentId').isString().notEmpty().withMessage('Content ID is required'),
    body('reason').isString().notEmpty().withMessage('Reason is required for emergency rotation')
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

    const { contentId } = req.params;
    const { reason } = req.body;

    const timerId = metrics.startTimer('emergency_key_rotation', {
      contentId: contentId.substr(0, 8)
    });

    try {
      const result = await packagingService.rotateKeys(contentId);

      // Log emergency rotation
      await observability.logEvent('warn', 'Emergency key rotation performed', {
        contentId,
        reason,
        oldKeyId: result.oldKeyId,
        newKeyId: result.newKeyId,
        manifestsUpdated: result.manifestsUpdated.length,
        userId: req.user?.id
      });

      metrics.endTimer(timerId, true);
      metrics.counter('emergency_key_rotations_total', 1, {
        contentId: contentId.substr(0, 8)
      });

      res.json({
        success: true,
        data: {
          contentId,
          oldKeyId: result.oldKeyId,
          newKeyId: result.newKeyId,
          manifestsUpdated: result.manifestsUpdated.length,
          rotationCompletedAt: result.rotationCompletedAt,
          reason,
          message: 'Emergency key rotation completed successfully'
        }
      });

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      
      await observability.logEvent('error', 'Emergency key rotation failed', {
        contentId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to perform emergency key rotation'
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
    service: 'packaging',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
}));

export default router;