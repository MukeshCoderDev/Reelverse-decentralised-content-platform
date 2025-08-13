import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { ContentAccessService } from '../services/contentAccessService';
import { PlaybackTokenService } from '../services/playbackTokenService';
import { 
  validatePlaybackToken, 
  validateHLSSignature, 
  checkContentAccess, 
  rateLimitTokenGeneration,
  logPlaybackActivity,
  AuthenticatedRequest 
} from '../middleware/tokenValidation';
import Joi from 'joi';

const router = Router();
const contentAccessService = ContentAccessService.getInstance();
const playbackTokenService = PlaybackTokenService.getInstance();

// Validation schemas
const accessCheckSchema = Joi.object({
  userAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  sessionId: Joi.string().optional()
});

const playbackTokenSchema = Joi.object({
  contentId: Joi.string().required(),
  userAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  sessionId: Joi.string().required(),
  expiryMinutes: Joi.number().min(1).max(480).optional() // 1 minute to 8 hours
});

// Check content access permissions
router.post('/:contentId/access', asyncHandler(async (req, res) => {
  const { error, value } = accessCheckSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  const contentId = req.params.contentId;
  const userIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string;

  try {
    const accessRequest = {
      contentId,
      userAddress: value.userAddress,
      userIP,
      userAgent: req.headers['user-agent'],
      sessionId: value.sessionId
    };

    const accessResult = await contentAccessService.checkAccess(accessRequest);
    
    // Log the access attempt
    await contentAccessService.logAccessAttempt(accessRequest, accessResult);

    res.json({
      success: true,
      data: {
        allowed: accessResult.allowed,
        reasons: accessResult.reasons,
        accessToken: accessResult.accessToken,
        expiresAt: accessResult.expiresAt,
        watermarkId: accessResult.watermarkId
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check content access'
    });
  }
}));

// Generate playback token for authorized content
router.post('/playback-token', 
  checkContentAccess,
  rateLimitTokenGeneration,
  asyncHandler(async (req, res) => {
    const { error, value } = playbackTokenSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    try {
      const { contentId, userAddress, sessionId, expiryMinutes = 240 } = value;

      // Generate signed JWT playback token with HLS integration
      const tokenResult = await playbackTokenService.generatePlaybackToken(
        contentId,
        userAddress,
        sessionId,
        expiryMinutes
      );

      res.json({
        success: true,
        data: {
          token: tokenResult.token,
          hlsUrl: tokenResult.hlsUrl,
          watermarkId: tokenResult.watermarkId,
          expiresAt: tokenResult.expiresAt,
          sessionId: sessionId
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate playback token'
      });
    }
  })
);

// Validate playback token (for streaming service)
router.post('/validate-token', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'Token is required'
    });
  }

  try {
    const validation = await playbackTokenService.validatePlaybackToken(token);
    
    res.json({
      success: true,
      data: {
        valid: validation.valid,
        payload: validation.payload,
        error: validation.error
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate token'
    });
  }
}));

// Get access requirements for content (public endpoint)
router.get('/:contentId/requirements', asyncHandler(async (req, res) => {
  const contentId = req.params.contentId;

  try {
    // This would typically fetch from database/blockchain
    // For now, return mock requirements
    const requirements = {
      ageVerificationRequired: true,
      geographicRestrictions: ['US', 'UK'],
      entitlementRequired: true,
      entitlementType: 'ppv',
      price: '10.00',
      currency: 'USDC'
    };

    res.json({
      success: true,
      data: requirements
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get content requirements'
    });
  }
}));

// HLS streaming endpoint with signature validation
router.get('/hls/:contentId/playlist.m3u8', 
  validateHLSSignature,
  logPlaybackActivity,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    try {
      const contentId = req.params.contentId;
      const tokenPayload = req.tokenPayload!;

      // In production, this would fetch the actual HLS playlist
      // and inject watermarking information
      const hlsPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:10.0,
segment-0.ts?watermark=${tokenPayload.watermarkId}
#EXTINF:10.0,
segment-1.ts?watermark=${tokenPayload.watermarkId}
#EXTINF:10.0,
segment-2.ts?watermark=${tokenPayload.watermarkId}
#EXT-X-ENDLIST`;

      res.set({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.send(hlsPlaylist);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to serve HLS playlist'
      });
    }
  })
);

// Get watermark configuration for player
router.get('/watermark/:watermarkId', 
  validatePlaybackToken,
  asyncHandler(async (req, res) => {
    try {
      const watermarkId = req.params.watermarkId;
      const watermarkConfig = await playbackTokenService.getWatermarkConfig(watermarkId);

      if (!watermarkConfig) {
        return res.status(404).json({
          success: false,
          error: 'Watermark configuration not found'
        });
      }

      res.json({
        success: true,
        data: watermarkConfig
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get watermark configuration'
      });
    }
  })
);

// Revoke playback token (for emergency stops)
router.post('/revoke-token', asyncHandler(async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'Session ID is required'
    });
  }

  try {
    const revoked = await playbackTokenService.revokePlaybackToken(sessionId);
    
    res.json({
      success: true,
      data: {
        revoked,
        sessionId
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to revoke token'
    });
  }
}));

// Get user's active playback sessions
router.get('/sessions/:userAddress', asyncHandler(async (req, res) => {
  const userAddress = req.params.userAddress;

  // Validate Ethereum address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Ethereum address format'
    });
  }

  try {
    const activeSessions = await playbackTokenService.getUserActiveSessions(userAddress);
    
    res.json({
      success: true,
      data: {
        userAddress,
        activeSessions: activeSessions.length,
        sessionIds: activeSessions
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get active sessions'
    });
  }
}));

export default router;