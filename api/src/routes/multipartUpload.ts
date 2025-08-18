/**
 * Multipart Upload Routes
 * Handles resumable uploads up to 50GB with malware/CSAM scanning
 */

import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, requireVerified } from '../middleware/auth';
import { uploadService } from '../services/uploadService';
import { observability } from '../core/observability';
import { metrics } from '../core/metrics';

const router = Router();

// Validation middleware
const validateInitiateUpload = [
  body('fileSize').isInt({ min: 1 }).withMessage('File size must be a positive integer'),
  body('contentType').isString().notEmpty().withMessage('Content type is required'),
  body('fileName').isString().notEmpty().withMessage('File name is required'),
  body('organizationId').isString().notEmpty().withMessage('Organization ID is required'),
  body('idempotencyKey').isString().notEmpty().withMessage('Idempotency key is required'),
  body('metadata.title').isString().isLength({ min: 1, max: 200 }).withMessage('Title is required (1-200 characters)'),
  body('metadata.description').optional().isString().isLength({ max: 2000 }).withMessage('Description too long (max 2000 characters)'),
  body('metadata.tags').isArray().withMessage('Tags must be an array'),
  body('metadata.ageRating').isIn(['general', 'mature', 'adult']).withMessage('Age rating must be general, mature, or adult'),
  body('metadata.category').isString().notEmpty().withMessage('Category is required'),
  body('metadata.isPrivate').isBoolean().withMessage('isPrivate must be boolean')
];

const validateUploadChunk = [
  param('sessionId').isUUID().withMessage('Valid session ID is required'),
  body('chunkIndex').isInt({ min: 0 }).withMessage('Chunk index must be non-negative integer'),
  body('checksum').isString().notEmpty().withMessage('Chunk checksum is required')
];

const validateCompleteUpload = [
  param('sessionId').isUUID().withMessage('Valid session ID is required')
];

/**
 * Initiate multipart upload
 */
router.post('/initiate',
  authenticateToken,
  requireVerified,
  validateInitiateUpload,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const timerId = metrics.startTimer('multipart_upload_initiate');

    try {
      const creatorId = req.user?.address;
      if (!creatorId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const {
        fileSize,
        contentType,
        fileName,
        organizationId,
        idempotencyKey,
        metadata
      } = req.body;

      const uploadRequest = {
        fileSize,
        contentType,
        fileName,
        organizationId,
        creatorId,
        idempotencyKey,
        metadata
      };

      const session = await uploadService.initiateUpload(uploadRequest);

      await observability.logEvent('info', 'Multipart upload initiated', {
        sessionId: session.sessionId,
        uploadId: session.uploadId,
        fileSize,
        organizationId,
        userId: creatorId
      });

      metrics.endTimer(timerId, true);

      res.status(201).json({
        success: true,
        session: {
          sessionId: session.sessionId,
          uploadId: session.uploadId,
          chunkSize: session.chunkSize,
          totalChunks: session.totalChunks,
          expiresAt: session.expiresAt
        }
      });

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      
      await observability.logEvent('error', 'Failed to initiate multipart upload', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.address
      });

      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate upload'
      });
    }
  })
);

/**
 * Upload chunk
 */
router.post('/:sessionId/chunk',
  authenticateToken,
  requireVerified,
  validateUploadChunk,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const timerId = metrics.startTimer('multipart_chunk_upload');

    try {
      const { sessionId } = req.params;
      const { chunkIndex, checksum } = req.body;

      // Get chunk data from request body (in production, handle binary data properly)
      const chunkData = req.body.data ? Buffer.from(req.body.data, 'base64') : Buffer.alloc(0);

      if (chunkData.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Chunk data is required'
        });
      }

      const chunkResponse = await uploadService.uploadChunk(sessionId, {
        chunkIndex,
        data: chunkData,
        checksum
      });

      metrics.endTimer(timerId, true);

      res.json({
        success: true,
        chunk: chunkResponse
      });

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      
      await observability.logEvent('error', 'Failed to upload chunk', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.address
      });

      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload chunk'
      });
    }
  })
);

/**
 * Complete multipart upload
 */
router.post('/:sessionId/complete',
  authenticateToken,
  requireVerified,
  validateCompleteUpload,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const timerId = metrics.startTimer('multipart_upload_complete');

    try {
      const { sessionId } = req.params;

      const result = await uploadService.completeUpload(sessionId);

      await observability.logEvent('info', 'Multipart upload completed', {
        sessionId,
        uploadId: result.uploadId,
        contentId: result.contentId,
        fileSize: result.fileSize,
        scanStatus: result.scanStatus,
        userId: req.user?.address
      });

      metrics.endTimer(timerId, true);

      res.json({
        success: true,
        result: {
          uploadId: result.uploadId,
          contentId: result.contentId,
          status: result.status,
          fileSize: result.fileSize,
          checksum: result.checksum,
          scanStatus: result.scanStatus,
          processingStage: result.processingStage
        }
      });

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      
      await observability.logEvent('error', 'Failed to complete multipart upload', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.address
      });

      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete upload'
      });
    }
  })
);

/**
 * Get upload session status
 */
router.get('/:sessionId/status',
  authenticateToken,
  param('sessionId').isUUID().withMessage('Valid session ID is required'),
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
      const session = uploadService.getSessionStatus(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Upload session not found'
        });
      }

      const uploadProgress = (session.uploadedBytes / session.fileSize) * 100;

      res.json({
        success: true,
        session: {
          sessionId: session.sessionId,
          uploadId: session.uploadId,
          status: session.status,
          chunksUploaded: session.chunksUploaded,
          totalChunks: session.totalChunks,
          uploadedBytes: session.uploadedBytes,
          fileSize: session.fileSize,
          uploadProgress,
          scanStatus: session.scanStatus,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          expiresAt: session.expiresAt
        }
      });

    } catch (error) {
      await observability.logEvent('error', 'Failed to get upload session status', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.address
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get session status'
      });
    }
  })
);

/**
 * Cancel upload session
 */
router.post('/:sessionId/cancel',
  authenticateToken,
  param('sessionId').isUUID().withMessage('Valid session ID is required'),
  body('reason').optional().isString().withMessage('Reason must be a string'),
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
      const { reason = 'User cancelled' } = req.body;

      await uploadService.cancelUpload(sessionId, reason);

      await observability.logEvent('info', 'Upload session cancelled', {
        sessionId,
        reason,
        userId: req.user?.address
      });

      res.json({
        success: true,
        message: 'Upload session cancelled successfully'
      });

    } catch (error) {
      await observability.logEvent('error', 'Failed to cancel upload session', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.address
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel upload session'
      });
    }
  })
);

/**
 * Get upload metrics (admin only)
 */
router.get('/metrics',
  authenticateToken,
  // Add admin role check here
  asyncHandler(async (req, res) => {
    try {
      const healthMetrics = metrics.getHealthMetrics();
      
      res.json({
        success: true,
        metrics: {
          upload_processing: healthMetrics.upload_processing,
          timestamp: healthMetrics.timestamp
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get upload metrics'
      });
    }
  })
);

export default router;