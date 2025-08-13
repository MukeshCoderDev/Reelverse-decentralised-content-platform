import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { RedisService } from '../config/redis';

export interface PlaybackTokenPayload {
  contentId: string;
  userAddress: string;
  sessionId: string;
  watermarkId: string;
  issuedAt: number;
  expiresAt: number;
  hlsBaseUrl: string;
}

export interface WatermarkConfig {
  userAddress: string;
  sessionId: string;
  timestamp: number;
  displayText: string;
}

export interface HLSSigningConfig {
  baseUrl: string;
  keyId: string;
  expiryMinutes: number;
}

export class PlaybackTokenService {
  private static instance: PlaybackTokenService;
  private redisService: RedisService;
  private jwtSecret: string;
  private hlsSigningKey: string;

  private constructor() {
    this.redisService = RedisService.getInstance();
    this.jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret-key';
    this.hlsSigningKey = process.env.HLS_SIGNING_KEY || 'your-hls-signing-key';
  }

  public static getInstance(): PlaybackTokenService {
    if (!PlaybackTokenService.instance) {
      PlaybackTokenService.instance = new PlaybackTokenService();
    }
    return PlaybackTokenService.instance;
  }

  /**
   * Generate a signed JWT token for video playback
   */
  async generatePlaybackToken(
    contentId: string,
    userAddress: string,
    sessionId: string,
    expiryMinutes: number = 240 // 4 hours default
  ): Promise<{
    token: string;
    hlsUrl: string;
    watermarkId: string;
    expiresAt: Date;
  }> {
    try {
      const now = Date.now();
      const expiresAt = new Date(now + (expiryMinutes * 60 * 1000));
      
      // Generate watermark ID
      const watermarkId = await this.generateWatermarkId(userAddress, sessionId);
      
      // Create JWT payload
      const payload: PlaybackTokenPayload = {
        contentId,
        userAddress,
        sessionId,
        watermarkId,
        issuedAt: now,
        expiresAt: expiresAt.getTime(),
        hlsBaseUrl: process.env.HLS_BASE_URL || 'https://stream.reelverse.com'
      };

      // Sign JWT token
      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: `${expiryMinutes}m`,
        issuer: 'reelverse-api',
        audience: 'reelverse-player'
      });

      // Generate signed HLS URL
      const hlsUrl = await this.generateSignedHLSUrl(contentId, token, expiryMinutes);

      // Store session in Redis for tracking
      await this.storePlaybackSession(sessionId, {
        contentId,
        userAddress,
        token,
        watermarkId,
        startedAt: new Date(),
        expiresAt
      });

      logger.info(`Generated playback token for content ${contentId}, user ${userAddress}, session ${sessionId}`);

      return {
        token,
        hlsUrl,
        watermarkId,
        expiresAt
      };
    } catch (error) {
      logger.error('Error generating playback token:', error);
      throw new Error('Failed to generate playback token');
    }
  }

  /**
   * Generate session-based watermark ID
   */
  async generateWatermarkId(userAddress: string, sessionId: string): Promise<string> {
    try {
      const watermarkConfig: WatermarkConfig = {
        userAddress,
        sessionId: sessionId.substring(0, 8),
        timestamp: Date.now(),
        displayText: `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)} | ${sessionId.substring(0, 8)}`
      };

      // Create a unique watermark ID
      const watermarkData = JSON.stringify(watermarkConfig);
      const watermarkId = crypto
        .createHash('sha256')
        .update(watermarkData)
        .digest('hex')
        .substring(0, 16);

      // Store watermark config in Redis for retrieval during playback
      const watermarkKey = `watermark:${watermarkId}`;
      await this.redisService.set(
        watermarkKey, 
        JSON.stringify(watermarkConfig), 
        24 * 60 * 60 // 24 hours
      );

      return watermarkId;
    } catch (error) {
      logger.error('Error generating watermark ID:', error);
      throw new Error('Failed to generate watermark ID');
    }
  }

  /**
   * Generate signed HLS URL with expiry management
   */
  async generateSignedHLSUrl(
    contentId: string, 
    token: string, 
    expiryMinutes: number
  ): Promise<string> {
    try {
      const baseUrl = process.env.HLS_BASE_URL || 'https://stream.reelverse.com';
      const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryMinutes * 60);
      
      // Create URL parameters
      const params = new URLSearchParams({
        token,
        expires: expiryTimestamp.toString(),
        content: contentId
      });

      // Create signature for URL integrity
      const signatureData = `${contentId}:${token}:${expiryTimestamp}`;
      const signature = crypto
        .createHmac('sha256', this.hlsSigningKey)
        .update(signatureData)
        .digest('hex');

      params.append('signature', signature);

      const signedUrl = `${baseUrl}/hls/${contentId}/playlist.m3u8?${params.toString()}`;
      
      logger.debug(`Generated signed HLS URL for content ${contentId}`);
      return signedUrl;
    } catch (error) {
      logger.error('Error generating signed HLS URL:', error);
      throw new Error('Failed to generate signed HLS URL');
    }
  }

  /**
   * Validate playback token
   */
  async validatePlaybackToken(token: string): Promise<{
    valid: boolean;
    payload?: PlaybackTokenPayload;
    error?: string;
  }> {
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'reelverse-api',
        audience: 'reelverse-player'
      }) as PlaybackTokenPayload;

      // Check if token has expired
      if (Date.now() > decoded.expiresAt) {
        return {
          valid: false,
          error: 'Token has expired'
        };
      }

      // Check if session still exists in Redis
      const sessionExists = await this.redisService.exists(`session:${decoded.sessionId}`);
      if (!sessionExists) {
        return {
          valid: false,
          error: 'Session not found or expired'
        };
      }

      return {
        valid: true,
        payload: decoded
      };
    } catch (error) {
      logger.error('Error validating playback token:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid token'
      };
    }
  }

  /**
   * Validate HLS URL signature
   */
  async validateHLSSignature(
    contentId: string,
    token: string,
    expires: string,
    signature: string
  ): Promise<boolean> {
    try {
      const expiryTimestamp = parseInt(expires);
      
      // Check if URL has expired
      if (Date.now() / 1000 > expiryTimestamp) {
        logger.warn(`HLS URL expired for content ${contentId}`);
        return false;
      }

      // Recreate signature
      const signatureData = `${contentId}:${token}:${expiryTimestamp}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.hlsSigningKey)
        .update(signatureData)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      if (!isValid) {
        logger.warn(`Invalid HLS signature for content ${contentId}`);
      }

      return isValid;
    } catch (error) {
      logger.error('Error validating HLS signature:', error);
      return false;
    }
  }

  /**
   * Get watermark configuration for display
   */
  async getWatermarkConfig(watermarkId: string): Promise<WatermarkConfig | null> {
    try {
      const watermarkKey = `watermark:${watermarkId}`;
      const configData = await this.redisService.get(watermarkKey);
      
      if (!configData) {
        return null;
      }

      return JSON.parse(configData) as WatermarkConfig;
    } catch (error) {
      logger.error('Error getting watermark config:', error);
      return null;
    }
  }

  /**
   * Store playback session for tracking
   */
  private async storePlaybackSession(
    sessionId: string,
    sessionData: {
      contentId: string;
      userAddress: string;
      token: string;
      watermarkId: string;
      startedAt: Date;
      expiresAt: Date;
    }
  ): Promise<void> {
    try {
      const sessionKey = `session:${sessionId}`;
      const ttl = Math.floor((sessionData.expiresAt.getTime() - Date.now()) / 1000);
      
      await this.redisService.set(
        sessionKey,
        JSON.stringify(sessionData),
        ttl
      );

      // Also store in a user-specific key for tracking active sessions
      const userSessionKey = `user_sessions:${sessionData.userAddress}`;
      await this.redisService.sadd(userSessionKey, sessionId);
      await this.redisService.expire(userSessionKey, ttl);

      logger.debug(`Stored playback session ${sessionId} for user ${sessionData.userAddress}`);
    } catch (error) {
      logger.error('Error storing playback session:', error);
    }
  }

  /**
   * Revoke playback token (for emergency stops)
   */
  async revokePlaybackToken(sessionId: string): Promise<boolean> {
    try {
      const sessionKey = `session:${sessionId}`;
      const sessionData = await this.redisService.get(sessionKey);
      
      if (!sessionData) {
        return false;
      }

      const session = JSON.parse(sessionData);
      
      // Remove session from Redis
      await this.redisService.del(sessionKey);
      
      // Remove from user sessions
      const userSessionKey = `user_sessions:${session.userAddress}`;
      await this.redisService.srem(userSessionKey, sessionId);

      logger.info(`Revoked playback token for session ${sessionId}`);
      return true;
    } catch (error) {
      logger.error('Error revoking playback token:', error);
      return false;
    }
  }

  /**
   * Get active sessions for a user
   */
  async getUserActiveSessions(userAddress: string): Promise<string[]> {
    try {
      const userSessionKey = `user_sessions:${userAddress}`;
      const sessions = await this.redisService.smembers(userSessionKey);
      return sessions || [];
    } catch (error) {
      logger.error('Error getting user active sessions:', error);
      return [];
    }
  }

  /**
   * Update session activity (for tracking playback progress)
   */
  async updateSessionActivity(
    sessionId: string,
    activityData: {
      lastActiveAt: Date;
      bytesStreamed?: number;
      currentPosition?: number;
    }
  ): Promise<void> {
    try {
      const sessionKey = `session:${sessionId}`;
      const sessionData = await this.redisService.get(sessionKey);
      
      if (!sessionData) {
        logger.warn(`Session ${sessionId} not found for activity update`);
        return;
      }

      const session = JSON.parse(sessionData);
      const updatedSession = {
        ...session,
        ...activityData,
        lastActiveAt: activityData.lastActiveAt.toISOString()
      };

      // Update session with remaining TTL
      const ttl = await this.redisService.ttl(sessionKey);
      if (ttl > 0) {
        await this.redisService.set(
          sessionKey,
          JSON.stringify(updatedSession),
          ttl
        );
      }
    } catch (error) {
      logger.error('Error updating session activity:', error);
    }
  }
}