import express from 'express';
import { PolicyEngine, PolicyEvaluationRequest, ValidationContext } from '../services/policyEngine';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { createUnifiedError } from '../utils/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import axios from 'axios';

const router = express.Router();
const policyEngine = PolicyEngine.getInstance();

/**
 * Get geolocation from IP address
 */
async function getGeolocation(ip: string) {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`, {
      timeout: 5000
    });

    if (response.data.status === 'success') {
      return {
        country: response.data.countryCode,
        region: response.data.regionName,
        city: response.data.city,
        latitude: response.data.lat,
        longitude: response.data.lon,
        asn: response.data.as
      };
    }

    throw new Error('Geolocation lookup failed');
  } catch (error) {
    logger.error('Error getting geolocation:', error);
    // Return default location on error
    return {
      country: 'US',
      region: 'Unknown',
      city: 'Unknown',
      latitude: 0,
      longitude: 0
    };
  }
}

/**
 * Evaluate access policies for content
 * POST /api/policy/evaluate
 */
router.post('/evaluate',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const { contentId, deviceId, sessionId } = req.body;
      const userId = req.user?.address;
      const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
      const userAgent = req.get('User-Agent') || '';

      if (!contentId || !userId || !deviceId) {
        throw createUnifiedError.badRequest(
          'Missing required fields: contentId, userId, deviceId',
          { contentId, userId, deviceId }
        );
      }

      // Get geolocation
      const geolocation = await getGeolocation(ipAddress);

      const evaluationRequest: PolicyEvaluationRequest = {
        contentId,
        userId,
        deviceId,
        ipAddress,
        geolocation,
        userAgent,
        sessionId
      };

      const policyDecision = await policyEngine.evaluateAccess(evaluationRequest);

      // Log the evaluation for audit
      logger.info('Policy evaluation completed', {
        contentId,
        userId,
        deviceId,
        allowed: policyDecision.allowed,
        restrictionCount: policyDecision.restrictions.length,
        entitlementCount: policyDecision.entitlements.length
      });

      res.json({
        success: true,
        data: {
          allowed: policyDecision.allowed,
          reason: policyDecision.reason,
          restrictions: policyDecision.restrictions,
          entitlements: policyDecision.entitlements,
          deviceLimits: policyDecision.deviceLimits,
          watermarkProfile: policyDecision.watermarkProfile
        }
      });

    } catch (error) {
      logger.error('Error evaluating access policies:', error);
      throw createUnifiedError.internal(
        'Failed to evaluate access policies',
        { error: error.message }
      );
    }
  })
);

/**
 * Create playback ticket
 * POST /api/policy/ticket
 */
router.post('/ticket',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const { contentId, deviceId, sessionId, ttlMinutes = 5 } = req.body;
      const userId = req.user?.address;
      const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
      const userAgent = req.get('User-Agent') || '';

      if (!contentId || !userId || !deviceId) {
        throw createUnifiedError.badRequest(
          'Missing required fields: contentId, userId, deviceId',
          { contentId, userId, deviceId }
        );
      }

      // First evaluate access
      const geolocation = await getGeolocation(ipAddress);
      
      const evaluationRequest: PolicyEvaluationRequest = {
        contentId,
        userId,
        deviceId,
        ipAddress,
        geolocation,
        userAgent,
        sessionId
      };

      const policyDecision = await policyEngine.evaluateAccess(evaluationRequest);

      if (!policyDecision.allowed) {
        throw createUnifiedError.forbidden(
          'Access denied by policy engine',
          {
            reason: policyDecision.reason,
            restrictions: policyDecision.restrictions
          }
        );
      }

      // Create playback ticket
      const ticket = await policyEngine.createPlaybackTicket(
        contentId,
        userId,
        policyDecision,
        deviceId,
        ttlMinutes
      );

      logger.info('Playback ticket created', {
        ticketId: ticket.ticketId,
        contentId,
        userId,
        deviceId,
        expiresAt: ticket.expiresAt
      });

      res.json({
        success: true,
        data: {
          ticket: {
            ticketId: ticket.ticketId,
            contentId: ticket.contentId,
            expiresAt: ticket.expiresAt,
            entitlements: ticket.entitlements,
            watermarkProfile: ticket.watermarkProfile
          }
        }
      });

    } catch (error) {
      logger.error('Error creating playback ticket:', error);
      if (error.statusCode) {
        throw error; // Re-throw unified errors
      }
      throw createUnifiedError.internal(
        'Failed to create playback ticket',
        { error: error.message }
      );
    }
  })
);

/**
 * Validate playback ticket
 * POST /api/policy/validate
 */
router.post('/validate',
  asyncHandler(async (req, res) => {
    try {
      const { ticketId, deviceId, segmentRange } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
      const userAgent = req.get('User-Agent') || '';

      if (!ticketId || !deviceId) {
        throw createUnifiedError.badRequest(
          'Missing required fields: ticketId, deviceId',
          { ticketId, deviceId }
        );
      }

      const validationContext: ValidationContext = {
        ipAddress,
        userAgent,
        deviceId,
        segmentRange,
        timestamp: new Date()
      };

      const validation = await policyEngine.validateTicket(ticketId, validationContext);

      if (!validation.valid) {
        throw createUnifiedError.unauthorized(
          'Invalid or expired ticket',
          { error: validation.error }
        );
      }

      res.json({
        success: true,
        data: {
          valid: validation.valid,
          ticket: {
            ticketId: validation.ticket!.ticketId,
            contentId: validation.ticket!.contentId,
            userId: validation.ticket!.userId,
            expiresAt: validation.ticket!.expiresAt,
            entitlements: validation.ticket!.entitlements
          },
          remainingTTL: validation.remainingTTL
        }
      });

    } catch (error) {
      logger.error('Error validating ticket:', error);
      if (error.statusCode) {
        throw error; // Re-throw unified errors
      }
      throw createUnifiedError.internal(
        'Failed to validate ticket',
        { error: error.message }
      );
    }
  })
);

/**
 * Revoke user tickets (emergency access revocation)
 * POST /api/policy/revoke/user
 */
router.post('/revoke/user',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const { userId } = req.body;
      const requestingUser = req.user?.address;

      if (!userId) {
        throw createUnifiedError.badRequest(
          'Missing required field: userId',
          { userId }
        );
      }

      // Only allow users to revoke their own tickets or admin users
      if (userId !== requestingUser && req.user?.role !== 'admin') {
        throw createUnifiedError.forbidden(
          'Insufficient permissions to revoke user tickets',
          { requestingUser, targetUser: userId }
        );
      }

      const revokedCount = await policyEngine.revokeUserTickets(userId);

      logger.info('User tickets revoked', {
        userId,
        revokedBy: requestingUser,
        revokedCount
      });

      res.json({
        success: true,
        data: {
          revokedCount,
          message: `Revoked ${revokedCount} active tickets for user`
        }
      });

    } catch (error) {
      logger.error('Error revoking user tickets:', error);
      if (error.statusCode) {
        throw error; // Re-throw unified errors
      }
      throw createUnifiedError.internal(
        'Failed to revoke user tickets',
        { error: error.message }
      );
    }
  })
);

/**
 * Revoke content tickets (for takedown scenarios)
 * POST /api/policy/revoke/content
 */
router.post('/revoke/content',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const { contentId } = req.body;
      const requestingUser = req.user?.address;

      if (!contentId) {
        throw createUnifiedError.badRequest(
          'Missing required field: contentId',
          { contentId }
        );
      }

      // Only allow admin users or content owners to revoke content tickets
      if (req.user?.role !== 'admin') {
        // TODO: Check if requesting user is the content owner
        throw createUnifiedError.forbidden(
          'Insufficient permissions to revoke content tickets',
          { requestingUser, contentId }
        );
      }

      const revokedCount = await policyEngine.revokeContentTickets(contentId);

      logger.info('Content tickets revoked', {
        contentId,
        revokedBy: requestingUser,
        revokedCount
      });

      res.json({
        success: true,
        data: {
          revokedCount,
          message: `Revoked ${revokedCount} active tickets for content`
        }
      });

    } catch (error) {
      logger.error('Error revoking content tickets:', error);
      if (error.statusCode) {
        throw error; // Re-throw unified errors
      }
      throw createUnifiedError.internal(
        'Failed to revoke content tickets',
        { error: error.message }
      );
    }
  })
);

/**
 * Get user device information
 * GET /api/policy/devices
 */
router.get('/devices',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const userId = req.user?.address;

      if (!userId) {
        throw createUnifiedError.unauthorized(
          'User not authenticated',
          {}
        );
      }

      // This would require implementing device management in PolicyEngine
      // For now, return a placeholder response
      res.json({
        success: true,
        data: {
          devices: [],
          maxDevices: 3,
          currentDevices: 0
        }
      });

    } catch (error) {
      logger.error('Error getting user devices:', error);
      if (error.statusCode) {
        throw error; // Re-throw unified errors
      }
      throw createUnifiedError.internal(
        'Failed to get user devices',
        { error: error.message }
      );
    }
  })
);

/**
 * Health check endpoint
 * GET /api/policy/health
 */
router.get('/health',
  asyncHandler(async (req, res) => {
    try {
      // Basic health check - could be expanded to check Redis connectivity, etc.
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'policy-engine'
        }
      });
    } catch (error) {
      logger.error('Policy engine health check failed:', error);
      throw createUnifiedError.internal(
        'Policy engine health check failed',
        { error: error.message }
      );
    }
  })
);

export default router;