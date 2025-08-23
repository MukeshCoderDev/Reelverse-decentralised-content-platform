import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { getUploadSessionService, UploadSessionService } from '../services/uploads/uploadSessionService';
import { getTranscodeAndPinJobService } from '../services/jobs/transcodeAndPinJob';
import { createUploadMiddleware, StreamingUploadRequest, isStatusProbe, getRequestStream } from '../middleware/streamingUpload';
import { 
  parseContentRange, 
  validateChunk, 
  generateRangeHeader, 
  generateUploadOffsetHeader,
  logContentRangeInfo
} from '../utils/contentRange';
import { logger } from '../utils/logger';
import { requirePrivyAuth } from '../middleware/authPrivy';
import rateLimit from 'express-rate-limit';

const router = Router();
const uploadService = getUploadSessionService();
const jobService = getTranscodeAndPinJobService();

// Rate limiting for upload operations
const createSessionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.RATE_LIMIT_UPLOAD_SESSION || '10', 10),
  keyGenerator: (req) => {
    return `upload-session:${req.user?.userId || req.ip}`;
  },
  message: { error: 'Too many upload sessions created. Please try again later.' },
});

const chunkUploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute  
  max: parseInt(process.env.RATE_LIMIT_UPLOAD_CHUNK || '100', 10),
  keyGenerator: (req) => {
    return `upload-chunk:${req.user?.userId || req.ip}`;
  },
  message: { error: 'Too many chunk uploads. Please slow down.' },
});

/**
 * POST /api/uploads?uploadType=resumable
 * Initialize resumable upload session with Google-style semantics
 */
router.post(
  '/',
  requirePrivyAuth,
  createSessionLimiter,
  [
    body('filename').notEmpty().trim().isLength({ max: 255 }),
    body('size').isInt({ min: 1 }),
    body('mimeType').notEmpty().trim(),
    body('title').optional().trim().isLength({ max: 500 }),
    body('description').optional().trim().isLength({ max: 5000 }),
    body('tags').optional().isArray(),
    body('visibility').optional().isIn(['public', 'private', 'unlisted']),
    body('category').optional().trim().isLength({ max: 100 }),
  ],
  async (req: Request, res: Response) => {
    try {
      // Check uploadType query parameter
      if (req.query.uploadType !== 'resumable') {
        return res.status(400).json({
          error: 'Invalid uploadType. Use ?uploadType=resumable',
        });
      }

      // Validate request body
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { filename, size, mimeType, title, description, tags, visibility, category } = req.body;
      const userId = req.user.userId;
      const idempotencyKey = req.headers['idempotency-key'] as string;

      const startTime = Date.now();

      // Create upload session
      const session = await uploadService.createSession({
        userId,
        filename,
        size,
        mimeType,
        idempotencyKey,
      });

      // Create content draft for metadata
      let draftId: string | undefined;
      try {
        const draft = await uploadService.createDraft({
          uploadId: session.id,
          userId,
          title,
          description,
          tags,
          visibility,
          category,
        });
        draftId = draft.id;
      } catch (error) {
        logger.warn('Failed to create content draft', {
          uploadId: session.id,
          error: error.message,
        });
      }

      const processingTime = Date.now() - startTime;

      // Record metrics
      await uploadService.recordMetric({
        uploadId: session.id,
        userId,
        eventType: 'session_created',
        processingTimeMs: processingTime,
        clientIp: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          filename,
          size,
          mimeType,
          idempotencyKey: !!idempotencyKey,
        },
      });

      // Determine if this is a new session or existing (for idempotency)
      const isNewSession = !idempotencyKey || session.createdAt.getTime() > Date.now() - 5000;
      const statusCode = isNewSession ? 201 : 200;

      const sessionUrl = `${req.protocol}://${req.get('host')}/api/v1/uploads/${session.id}`;

      // Set Google-style response headers
      res.set({
        'Location': sessionUrl,
        'X-Upload-Content-Length': size.toString(),
        'X-Upload-Content-Type': mimeType,
        'Cache-Control': 'no-store',
      });

      res.status(statusCode).json({
        uploadId: session.id,
        sessionUrl,
        chunkSize: session.chunkSize,
        draftId,
      });

    } catch (error) {
      logger.error('Failed to create upload session', {
        userId: req.user?.userId,
        error: error.message,
        stack: error.stack,
      });

      if (error.message.includes('File size') || error.message.includes('Unsupported file type')) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: 'Failed to create upload session' });
    }
  }
);

/**
 * PUT /api/uploads/:id
 * Upload chunk or status probe with Google 308 semantics
 */
router.put(
  '/:id',
  requirePrivyAuth,
  chunkUploadLimiter,
  createUploadMiddleware(),
  [
    param('id').isUUID(),
  ],
  async (req: StreamingUploadRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid session ID',
          details: errors.array(),
        });
      }

      const sessionId = req.params.id;
      const userId = req.user.userId;
      const contentRange = req.headers['content-range'] as string;
      const contentLength = req.contentLength || 0;

      const startTime = Date.now();

      // Get upload session
      const session = await uploadService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Upload session not found' });
      }

      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Check session status
      if (session.status !== 'uploading') {
        return res.status(409).json({
          error: `Cannot upload to session with status: ${session.status}`,
        });
      }

      // Parse Content-Range header
      const rangeInfo = parseContentRange(contentRange);
      logContentRangeInfo(contentRange, rangeInfo, sessionId);

      if (!rangeInfo) {
        return res.status(400).json({
          error: 'Invalid or missing Content-Range header',
        });
      }

      // Handle status probe requests (bytes */total or bytes */)
      if (rangeInfo.isStatusProbe) {
        const headers: Record<string, string> = {
          'Cache-Control': 'no-store',
          'Upload-Offset': generateUploadOffsetHeader(session.bytesReceived),
        };

        const rangeHeader = generateRangeHeader(session.bytesReceived);
        if (rangeHeader) {
          headers['Range'] = rangeHeader;
        }

        return res.status(308).set(headers).end();
      }

      // Validate chunk against session state
      const validation = validateChunk(
        rangeInfo,
        session.bytesReceived,
        session.totalBytes,
        session.chunkSize,
        contentLength
      );

      // Always respond with 308 for corrections (Google semantics)
      if (!validation.valid) {
        logger.debug('Chunk validation failed, sending 308 correction', {
          sessionId,
          error: validation.error,
          expectedOffset: session.bytesReceived,
          receivedStart: rangeInfo.start,
        });

        const headers: Record<string, string> = {
          'Cache-Control': 'no-store',
          'Upload-Offset': generateUploadOffsetHeader(session.bytesReceived),
        };

        const rangeHeader = generateRangeHeader(session.bytesReceived);
        if (rangeHeader) {
          headers['Range'] = rangeHeader;
        }

        return res.status(308).set(headers).end();
      }

      const { partNumber, expectedSize } = validation;

      try {
        // Upload part to storage (streaming, no buffering)
        const uploadResult = await uploadService.storage.uploadPart({
          bucket: process.env.STORAGE_BUCKET_UPLOADS!,
          key: session.storageKey,
          uploadId: session.storageUploadId!,
          partNumber: partNumber!,
          body: getRequestStream(req),
          contentLength,
        });

        // Update session with new part
        await uploadService.updateSessionWithPart(sessionId, uploadResult);

        const newBytesReceived = session.bytesReceived + contentLength;
        const processingTime = Date.now() - startTime;

        // Record metrics
        await uploadService.recordMetric({
          uploadId: sessionId,
          userId,
          eventType: 'chunk_uploaded',
          chunkNumber: partNumber,
          chunkSizeBytes: contentLength,
          processingTimeMs: processingTime,
          clientIp: req.ip,
          userAgent: req.headers['user-agent'],
        });

        // Check if upload is complete
        if (newBytesReceived === session.totalBytes) {
          // Complete multipart upload
          const completionResult = await uploadService.completeUpload(sessionId);

          // Enqueue background processing job
          try {
            const draft = await uploadService.getDraftByUploadId(sessionId);
            await jobService.enqueueJob({
              uploadId: sessionId,
              storageKey: session.storageKey,
              userId: session.userId,
              metadata: {
                title: draft?.title,
                description: draft?.description,
                filename: session.filename,
                mimeType: session.mimeType,
                totalBytes: session.totalBytes,
              },
            });
            
            logger.info('Enqueued transcode and pin job', {
              sessionId,
              storageKey: session.storageKey,
              totalBytes: session.totalBytes,
            });
          } catch (jobError) {
            logger.error('Failed to enqueue background job', {
              sessionId,
              error: jobError.message,
            });
            // Don't fail the upload if job enqueuing fails
          }

          return res.status(201).json({
            uploadId: sessionId,
            storageKey: session.storageKey,
            size: session.totalBytes,
          });
        }

        // Return 308 with progress
        const headers: Record<string, string> = {
          'Cache-Control': 'no-store',
          'Upload-Offset': generateUploadOffsetHeader(newBytesReceived),
        };

        const rangeHeader = generateRangeHeader(newBytesReceived);
        if (rangeHeader) {
          headers['Range'] = rangeHeader;
        }

        return res.status(308).set(headers).end();

      } catch (error) {
        logger.error('Chunk upload failed', {
          sessionId,
          partNumber,
          error: error.message,
        });

        await uploadService.updateSessionStatus(sessionId, 'failed', error.message);

        return res.status(500).json({ error: 'Chunk upload failed' });
      }

    } catch (error) {
      logger.error('Upload request failed', {
        sessionId: req.params.id,
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({ error: 'Upload request failed' });
    }
  }
);

/**
 * DELETE /api/uploads/:id
 * Abort upload session and cleanup
 */
router.delete(
  '/:id',
  requirePrivyAuth,
  [param('id').isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid session ID',
          details: errors.array(),
        });
      }

      const sessionId = req.params.id;
      const userId = req.user.userId;

      const session = await uploadService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Upload session not found' });
      }

      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Abort session
      await uploadService.abortSession(sessionId);

      // Record metrics
      await uploadService.recordMetric({
        uploadId: sessionId,
        userId,
        eventType: 'session_aborted',
        clientIp: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(204).end();

    } catch (error) {
      logger.error('Failed to abort upload session', {
        sessionId: req.params.id,
        error: error.message,
      });

      res.status(500).json({ error: 'Failed to abort upload session' });
    }
  }
);

/**
 * GET /api/uploads/:id/status
 * Get upload and processing status
 */
router.get(
  '/:id/status',
  requirePrivyAuth,
  [param('id').isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid session ID',
          details: errors.array(),
        });
      }

      const sessionId = req.params.id;
      const userId = req.user.userId;

      const session = await uploadService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Upload session not found' });
      }

      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({
        status: session.status,
        bytesReceived: session.bytesReceived,
        totalBytes: session.totalBytes,
        progress: session.totalBytes > 0 ? (session.bytesReceived / session.totalBytes) * 100 : 0,
        cid: session.cid,
        playbackUrl: session.playbackUrl,
        errorCode: session.errorCode,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      });

    } catch (error) {
      logger.error('Failed to get upload status', {
        sessionId: req.params.id,
        error: error.message,
      });

      res.status(500).json({ error: 'Failed to get upload status' });
    }
  }
);

/**
 * PUT /api/uploads/:id/draft
 * Update content draft metadata
 */
router.put(
  '/:id/draft',
  requirePrivyAuth,
  [
    param('id').isUUID(),
    body('title').optional().trim().isLength({ max: 500 }),
    body('description').optional().trim().isLength({ max: 5000 }),
    body('tags').optional().isArray(),
    body('visibility').optional().isIn(['public', 'private', 'unlisted']),
    body('category').optional().trim().isLength({ max: 100 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const sessionId = req.params.id;
      const userId = req.user.userId;

      const session = await uploadService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Upload session not found' });
      }

      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const draft = await uploadService.getDraftByUploadId(sessionId);
      if (!draft) {
        return res.status(404).json({ error: 'Content draft not found' });
      }

      const { title, description, tags, visibility, category } = req.body;

      const updatedDraft = await uploadService.updateDraft(draft.id, {
        title,
        description,
        tags,
        visibility,
        category,
      });

      res.json(updatedDraft);

    } catch (error) {
      logger.error('Failed to update content draft', {
        sessionId: req.params.id,
        error: error.message,
      });

      res.status(500).json({ error: 'Failed to update content draft' });
    }
  }
);

export default router;