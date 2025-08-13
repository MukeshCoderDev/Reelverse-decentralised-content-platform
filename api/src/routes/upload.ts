import { Router } from 'express';
import multer from 'multer';
import { body, param, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, requireVerified } from '../middleware/auth';
import UploadPipelineService from '../services/uploadPipelineService';
import FileUtils from '../utils/fileUtils';
import { logger } from '../utils/logger';

const router = Router();
const uploadPipelineService = new UploadPipelineService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB max file size
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Validation middleware
const validateUploadRequest = [
  body('metadata.title').isString().isLength({ min: 1, max: 200 }).withMessage('Title is required (1-200 characters)'),
  body('metadata.description').isString().isLength({ max: 2000 }).withMessage('Description too long (max 2000 characters)'),
  body('metadata.tags').isArray().withMessage('Tags must be an array'),
  body('metadata.ageRating').isIn(['18+', '21+']).withMessage('Age rating must be 18+ or 21+'),
  body('metadata.categories').isArray().withMessage('Categories must be an array'),
  body('metadata.participants').isArray().withMessage('Participants must be an array'),
  body('pricing.priceUSDC').isString().notEmpty().withMessage('Price in USDC is required'),
  body('pricing.splitterAddress').isEthereumAddress().withMessage('Valid splitter address required'),
  body('settings.storageClass').isIn(['shreddable', 'permanent']).withMessage('Storage class must be shreddable or permanent'),
  body('settings.geoMask').isInt({ min: 0 }).withMessage('Geographic mask must be a positive integer'),
  body('settings.enableWatermark').isBoolean().withMessage('Enable watermark must be boolean')
];

// Start upload pipeline
router.post('/start',
  authenticateToken,
  requireVerified,
  upload.single('video'),
  validateUploadRequest,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Video file is required'
        });
      }

      // Validate video file
      const validation = FileUtils.validateVideoFile({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      });

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      const creatorAddress = req.user?.address;
      if (!creatorAddress) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Parse request data
      const { metadata, pricing, settings } = req.body;

      // Validate participants array
      if (metadata.participants && Array.isArray(metadata.participants)) {
        for (const participant of metadata.participants) {
          if (!participant.wallet || !participant.role) {
            return res.status(400).json({
              success: false,
              error: 'Each participant must have wallet and role'
            });
          }
        }
      }

      const uploadRequest = {
        creatorAddress,
        file: {
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size
        },
        metadata: {
          title: metadata.title,
          description: metadata.description || '',
          tags: metadata.tags || [],
          ageRating: metadata.ageRating,
          categories: metadata.categories || [],
          participants: metadata.participants || []
        },
        pricing: {
          priceUSDC: pricing.priceUSDC,
          splitterAddress: pricing.splitterAddress
        },
        settings: {
          storageClass: settings.storageClass,
          geoMask: parseInt(settings.geoMask) || 0xFFFFFFFF,
          enableWatermark: settings.enableWatermark !== false
        }
      };

      const result = await uploadPipelineService.startUpload(uploadRequest);

      if (result.success) {
        res.json({
          success: true,
          uploadId: result.uploadId,
          message: 'Upload pipeline started successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to start upload pipeline'
        });
      }

    } catch (error) {
      logger.error('Upload start error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  })
);

// Get upload progress
router.get('/progress/:uploadId',
  authenticateToken,
  param('uploadId').isString().notEmpty(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { uploadId } = req.params;
      const progress = await uploadPipelineService.getUploadProgress(uploadId);

      if (!progress) {
        return res.status(404).json({
          success: false,
          error: 'Upload not found'
        });
      }

      res.json({
        success: true,
        progress
      });

    } catch (error) {
      logger.error('Upload progress error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  })
);

// Cancel upload
router.post('/cancel/:uploadId',
  authenticateToken,
  param('uploadId').isString().notEmpty(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { uploadId } = req.params;
      const cancelled = await uploadPipelineService.cancelUpload(uploadId);

      if (cancelled) {
        res.json({
          success: true,
          message: 'Upload cancelled successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to cancel upload or upload not found'
        });
      }

    } catch (error) {
      logger.error('Upload cancellation error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  })
);

// Legacy endpoints for backward compatibility
router.post('/request', asyncHandler(async (req, res) => {
  res.status(301).json({
    success: false,
    message: 'This endpoint has been moved to POST /upload/start',
    redirectTo: '/api/v1/upload/start'
  });
}));

router.get('/:provisionalId/status', asyncHandler(async (req, res) => {
  res.status(301).json({
    success: false,
    message: 'This endpoint has been moved to GET /upload/progress/:uploadId',
    redirectTo: `/api/v1/upload/progress/${req.params.provisionalId}`
  });
}));

// WebSocket endpoint for real-time progress updates
router.get('/progress/:uploadId/stream',
  authenticateToken,
  param('uploadId').isString().notEmpty(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { uploadId } = req.params;
      
      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial progress
      const initialProgress = await uploadPipelineService.getUploadProgress(uploadId);
      if (initialProgress) {
        res.write(`data: ${JSON.stringify(initialProgress)}\n\n`);
      }

      // Set up Redis subscription for real-time updates
      const redisService = new (await import('../config/redis')).RedisService();
      
      // This would require a separate Redis client for pub/sub
      // For now, we'll poll every 2 seconds
      const pollInterval = setInterval(async () => {
        try {
          const progress = await uploadPipelineService.getUploadProgress(uploadId);
          if (progress) {
            res.write(`data: ${JSON.stringify(progress)}\n\n`);
            
            // Close connection when upload is complete or failed
            if (progress.status === 'completed' || progress.status === 'failed') {
              clearInterval(pollInterval);
              res.end();
            }
          }
        } catch (error) {
          logger.error('Error polling upload progress:', error);
          clearInterval(pollInterval);
          res.end();
        }
      }, 2000);

      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(pollInterval);
      });

    } catch (error) {
      logger.error('Upload progress stream error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  })
);

export default router;