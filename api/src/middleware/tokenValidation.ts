import { Request, Response, NextFunction } from 'express';
import { PlaybackTokenService } from '../services/playbackTokenService';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  tokenPayload?: {
    contentId: string;
    userAddress: string;
    sessionId: string;
    watermarkId: string;
    issuedAt: number;
    expiresAt: number;
  };
}

/**
 * Middleware to validate playback tokens for HLS streaming endpoints
 */
export const validatePlaybackToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromRequest(req);
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Playback token required',
        code: 'TOKEN_MISSING'
      });
      return;
    }

    const playbackTokenService = PlaybackTokenService.getInstance();
    const validation = await playbackTokenService.validatePlaybackToken(token);

    if (!validation.valid) {
      res.status(401).json({
        success: false,
        error: validation.error || 'Invalid playback token',
        code: 'TOKEN_INVALID'
      });
      return;
    }

    // Attach token payload to request for downstream use
    req.tokenPayload = validation.payload;
    
    // Log token validation for audit trail
    logger.info(`Playback token validated for user ${validation.payload?.userAddress}, content ${validation.payload?.contentId}`);
    
    next();
  } catch (error) {
    logger.error('Error validating playback token:', error);
    res.status(500).json({
      success: false,
      error: 'Token validation failed',
      code: 'TOKEN_VALIDATION_ERROR'
    });
  }
};

/**
 * Middleware to validate HLS URL signatures
 */
export const validateHLSSignature = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, expires, signature } = req.query;
    const contentId = req.params.contentId;

    if (!token || !expires || !signature || !contentId) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters for HLS validation',
        code: 'HLS_PARAMS_MISSING'
      });
      return;
    }

    const playbackTokenService = PlaybackTokenService.getInstance();
    const isValid = await playbackTokenService.validateHLSSignature(
      contentId,
      token as string,
      expires as string,
      signature as string
    );

    if (!isValid) {
      res.status(403).json({
        success: false,
        error: 'Invalid or expired HLS signature',
        code: 'HLS_SIGNATURE_INVALID'
      });
      return;
    }

    // Also validate the embedded token
    const tokenValidation = await playbackTokenService.validatePlaybackToken(token as string);
    if (!tokenValidation.valid) {
      res.status(401).json({
        success: false,
        error: 'Invalid playback token in HLS URL',
        code: 'HLS_TOKEN_INVALID'
      });
      return;
    }

    // Attach token payload to request
    (req as AuthenticatedRequest).tokenPayload = tokenValidation.payload;
    
    logger.debug(`HLS signature validated for content ${contentId}`);
    next();
  } catch (error) {
    logger.error('Error validating HLS signature:', error);
    res.status(500).json({
      success: false,
      error: 'HLS signature validation failed',
      code: 'HLS_VALIDATION_ERROR'
    });
  }
};

/**
 * Middleware to check content access permissions before token generation
 */
export const checkContentAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { contentId, userAddress } = req.body;
    
    if (!contentId || !userAddress) {
      res.status(400).json({
        success: false,
        error: 'Content ID and user address are required',
        code: 'ACCESS_PARAMS_MISSING'
      });
      return;
    }

    // This would typically check:
    // 1. Age verification status
    // 2. Geographic restrictions
    // 3. Entitlement ownership (NFT/subscription)
    // 4. Content moderation status
    
    // For now, we'll do a basic check
    // In production, this should integrate with ContentAccessService
    
    // TODO: Integrate with ContentAccessService.checkAccess()
    // const contentAccessService = ContentAccessService.getInstance();
    // const accessResult = await contentAccessService.checkAccess({
    //   contentId,
    //   userAddress,
    //   userIP: req.ip,
    //   userAgent: req.headers['user-agent'],
    //   sessionId: req.body.sessionId
    // });
    
    // if (!accessResult.allowed) {
    //   return res.status(403).json({
    //     success: false,
    //     error: 'Access denied',
    //     reasons: accessResult.reasons,
    //     code: 'ACCESS_DENIED'
    //   });
    // }

    logger.info(`Content access check passed for user ${userAddress}, content ${contentId}`);
    next();
  } catch (error) {
    logger.error('Error checking content access:', error);
    res.status(500).json({
      success: false,
      error: 'Content access check failed',
      code: 'ACCESS_CHECK_ERROR'
    });
  }
};

/**
 * Middleware to rate limit token generation per user
 */
export const rateLimitTokenGeneration = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userAddress } = req.body;
    
    if (!userAddress) {
      res.status(400).json({
        success: false,
        error: 'User address required for rate limiting',
        code: 'RATE_LIMIT_PARAMS_MISSING'
      });
      return;
    }

    // Check if user has exceeded token generation rate limit
    // This prevents abuse and ensures fair usage
    
    const playbackTokenService = PlaybackTokenService.getInstance();
    const activeSessions = await playbackTokenService.getUserActiveSessions(userAddress);
    
    const maxConcurrentSessions = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5');
    
    if (activeSessions.length >= maxConcurrentSessions) {
      res.status(429).json({
        success: false,
        error: `Maximum concurrent sessions (${maxConcurrentSessions}) exceeded`,
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          activeSessions: activeSessions.length,
          maxAllowed: maxConcurrentSessions
        }
      });
      return;
    }

    logger.debug(`Rate limit check passed for user ${userAddress} (${activeSessions.length}/${maxConcurrentSessions} sessions)`);
    next();
  } catch (error) {
    logger.error('Error checking rate limit:', error);
    res.status(500).json({
      success: false,
      error: 'Rate limit check failed',
      code: 'RATE_LIMIT_ERROR'
    });
  }
};

/**
 * Extract token from various request sources
 */
function extractTokenFromRequest(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check query parameter
  if (req.query.token) {
    return req.query.token as string;
  }

  // Check request body
  if (req.body && req.body.token) {
    return req.body.token;
  }

  // Check custom header
  const customToken = req.headers['x-playback-token'];
  if (customToken) {
    return customToken as string;
  }

  return null;
}

/**
 * Middleware to log playback activity for analytics
 */
export const logPlaybackActivity = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.tokenPayload) {
      const activityData = {
        contentId: req.tokenPayload.contentId,
        userAddress: req.tokenPayload.userAddress,
        sessionId: req.tokenPayload.sessionId,
        timestamp: new Date(),
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        endpoint: req.path,
        method: req.method
      };

      // Log activity (could be sent to analytics service)
      logger.info('Playback activity:', activityData);

      // Update session activity
      const playbackTokenService = PlaybackTokenService.getInstance();
      await playbackTokenService.updateSessionActivity(req.tokenPayload.sessionId, {
        lastActiveAt: new Date()
      });
    }

    next();
  } catch (error) {
    logger.error('Error logging playback activity:', error);
    // Don't fail the request for logging errors
    next();
  }
};