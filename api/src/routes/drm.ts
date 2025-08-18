/**
 * DRM License and Key Delivery Routes
 * Handles license issuance, device management, and key delivery with SLA monitoring
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { drmService } from '../services/drmService';
import { observability } from '../core/observability';
import { metrics } from '../core/metrics';

const router = Router();

/**
 * Issue DRM license
 */
router.post('/licenses',
  requireAuth,
  [
    body('contentId').isString().notEmpty().withMessage('Content ID is required'),
    body('deviceId').isString().notEmpty().withMessage('Device ID is required'),
    body('playbackTicket').isString().notEmpty().withMessage('Playback ticket is required'),
    body('drmSystem').isIn(['widevine', 'fairplay', 'playready', 'aes-hls']).withMessage('Invalid DRM system'),
    body('clientInfo').optional().isObject().withMessage('Client info must be an object')
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

    const { contentId, deviceId, playbackTicket, drmSystem, clientInfo } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // Add client IP and user agent to client info
    const enrichedClientInfo = {
      ...clientInfo,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    };

    try {
      const license = await drmService.issueLicense({
        contentId,
        userId,
        deviceId,
        playbackTicket,
        drmSystem,
        clientInfo: enrichedClientInfo
      });

      // Return license without sensitive key data
      const sanitizedLicense = {
        licenseId: license.licenseId,
        contentId: license.contentId,
        drmSystem: license.drmSystem,
        licenseData: license.licenseData, // This is already encoded/encrypted
        keyIds: license.keyIds,
        issuedAt: license.issuedAt,
        expiresAt: license.expiresAt,
        sessionId: license.sessionId,
        signature: license.signature
      };

      res.json({
        success: true,
        data: sanitizedLicense
      });

    } catch (error) {
      const statusCode = error instanceof Error && error.message.includes('ticket') ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to issue license'
      });
    }
  })
);

/**
 * Get license status
 */
router.get('/licenses/:licenseId',
  requireAuth,
  [
    param('licenseId').isString().notEmpty().withMessage('License ID is required')
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

    const { licenseId } = req.params;

    try {
      const license = drmService.getLicenseStatus(licenseId);
      
      if (!license) {
        return res.status(404).json({
          success: false,
          error: 'License not found or expired'
        });
      }

      // Return status without sensitive data
      const licenseStatus = {
        licenseId: license.licenseId,
        contentId: license.contentId,
        drmSystem: license.drmSystem,
        issuedAt: license.issuedAt,
        expiresAt: license.expiresAt,
        deviceTrust: license.deviceTrust,
        sessionId: license.sessionId,
        isValid: license.expiresAt > new Date()
      };

      res.json({
        success: true,
        data: licenseStatus
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get license status'
      });
    }
  })
);

/**
 * Revoke license
 */
router.delete('/licenses/:licenseId',
  requireAuth,
  [
    param('licenseId').isString().notEmpty().withMessage('License ID is required'),
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

    const { licenseId } = req.params;
    const { reason = 'Manual revocation' } = req.body;

    try {
      await drmService.revokeLicense(licenseId, reason);

      res.json({
        success: true,
        data: {
          licenseId,
          message: 'License revoked successfully',
          reason
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke license'
      });
    }
  })
);

/**
 * Register device
 */
router.post('/devices',
  requireAuth,
  [
    body('deviceName').optional().isString().withMessage('Device name must be a string'),
    body('deviceType').optional().isIn(['mobile', 'desktop', 'tv', 'tablet']).withMessage('Invalid device type'),
    body('platform').optional().isString().withMessage('Platform must be a string'),
    body('isJailbroken').optional().isBoolean().withMessage('isJailbroken must be boolean'),
    body('isRooted').optional().isBoolean().withMessage('isRooted must be boolean')
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

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const deviceInfo = {
      ...req.body,
      userAgent: req.get('User-Agent') || 'unknown'
    };

    try {
      const deviceId = await drmService.registerDevice(userId, deviceInfo);

      res.status(201).json({
        success: true,
        data: {
          deviceId,
          message: 'Device registered successfully'
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to register device'
      });
    }
  })
);

/**
 * Revoke device
 */
router.delete('/devices/:deviceId',
  requireAuth,
  [
    param('deviceId').isString().notEmpty().withMessage('Device ID is required'),
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

    const { deviceId } = req.params;
    const { reason = 'Manual revocation' } = req.body;

    try {
      await drmService.revokeDevice(deviceId, reason);

      res.json({
        success: true,
        data: {
          deviceId,
          message: 'Device revoked successfully',
          reason
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke device'
      });
    }
  })
);

/**
 * Generate content keys
 */
router.post('/keys/:contentId',
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
      const contentKeys = await drmService.generateContentKeys(contentId);

      // Return key metadata without the actual key
      const keyInfo = {
        contentId: contentKeys.contentId,
        keyId: contentKeys.keyId,
        algorithm: contentKeys.algorithm,
        keyRotationVersion: contentKeys.keyRotationVersion,
        createdAt: contentKeys.createdAt
      };

      res.status(201).json({
        success: true,
        data: keyInfo
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate content keys'
      });
    }
  })
);

/**
 * Rotate content keys
 */
router.post('/keys/:contentId/rotate',
  requireAuth,
  [
    param('contentId').isString().notEmpty().withMessage('Content ID is required'),
    body('rotationType').optional().isIn(['scheduled', 'emergency']).withMessage('Invalid rotation type')
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
    const { rotationType = 'scheduled' } = req.body;

    try {
      const result = await drmService.rotateKeys(contentId, rotationType);

      res.json({
        success: true,
        data: {
          contentId: result.contentId,
          oldKeyId: result.oldKeyId,
          newKeyId: result.newKeyId,
          rotationType: result.rotationType,
          rotationCompletedAt: result.rotationCompletedAt,
          affectedLicenses: result.affectedLicenses,
          message: 'Key rotation completed successfully'
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rotate keys'
      });
    }
  })
);

/**
 * Update session heartbeat
 */
router.post('/sessions/:sessionId/heartbeat',
  requireAuth,
  [
    param('sessionId').isString().notEmpty().withMessage('Session ID is required'),
    body('position').isNumeric().withMessage('Position must be a number'),
    body('metrics').optional().isObject().withMessage('Metrics must be an object')
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

    const { sessionId } = req.params;
    const { position, metrics: sessionMetrics } = req.body;

    try {
      await drmService.updateSessionHeartbeat(sessionId, position, sessionMetrics);

      res.json({
        success: true,
        data: {
          sessionId,
          message: 'Heartbeat updated successfully',
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update heartbeat'
      });
    }
  })
);

/**
 * Key delivery endpoint for AES-HLS
 */
router.get('/keys/:keyId',
  [
    param('keyId').isString().notEmpty().withMessage('Key ID is required'),
    query('token').isString().notEmpty().withMessage('Authorization token is required')
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const timerId = metrics.startTimer('key_delivery', {
      keyId: req.params.keyId.substr(0, 8)
    });

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        metrics.endTimer(timerId, false, 'Validation failed');
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { keyId } = req.params;
      const { token } = req.query;

      // Validate authorization token (should contain license info)
      // In production, this would verify JWT token with license claims
      
      // For now, return a mock key response
      const keyData = Buffer.from('mock-aes-key-16-bytes').toString('base64');

      metrics.endTimer(timerId, true);
      metrics.counter('key_deliveries_total', 1, {
        keyId: keyId.substr(0, 8)
      });

      // Set appropriate headers for key delivery
      res.set({
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.send(Buffer.from(keyData, 'base64'));

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      
      res.status(403).json({
        success: false,
        error: 'Key delivery failed'
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
    service: 'drm',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
}));

export default router;