import { PlaybackTokenService } from '../services/playbackTokenService';
import { RedisService } from '../config/redis';
import jwt from 'jsonwebtoken';

// Mock Redis service
jest.mock('../config/redis');
jest.mock('../utils/logger');

describe('PlaybackTokenService', () => {
  let playbackTokenService: PlaybackTokenService;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock Redis service methods
    mockRedisService = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      ttl: jest.fn().mockResolvedValue(-1),
      expire: jest.fn().mockResolvedValue(true),
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
      scard: jest.fn().mockResolvedValue(0)
    } as any;

    // Mock RedisService.getInstance()
    (RedisService.getInstance as jest.Mock).mockReturnValue(mockRedisService);
    
    playbackTokenService = PlaybackTokenService.getInstance();
  });

  describe('generatePlaybackToken', () => {
    it('should generate a valid JWT token with correct payload', async () => {
      const contentId = 'test-content-123';
      const userAddress = '0x1234567890123456789012345678901234567890';
      const sessionId = 'session-123';
      const expiryMinutes = 60;

      const result = await playbackTokenService.generatePlaybackToken(
        contentId,
        userAddress,
        sessionId,
        expiryMinutes
      );

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('hlsUrl');
      expect(result).toHaveProperty('watermarkId');
      expect(result).toHaveProperty('expiresAt');

      // Verify JWT token structure
      const decoded = jwt.decode(result.token) as any;
      expect(decoded.contentId).toBe(contentId);
      expect(decoded.userAddress).toBe(userAddress);
      expect(decoded.sessionId).toBe(sessionId);
      expect(decoded.watermarkId).toBe(result.watermarkId);

      // Verify Redis calls for session storage
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        expect.any(String),
        expect.any(Number)
      );

      // Verify Redis calls for watermark storage
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('watermark:'),
        expect.any(String),
        expect.any(Number)
      );
    });

    it('should generate unique watermark IDs for different sessions', async () => {
      const contentId = 'test-content-123';
      const userAddress = '0x1234567890123456789012345678901234567890';

      const result1 = await playbackTokenService.generatePlaybackToken(
        contentId,
        userAddress,
        'session-1'
      );

      const result2 = await playbackTokenService.generatePlaybackToken(
        contentId,
        userAddress,
        'session-2'
      );

      expect(result1.watermarkId).not.toBe(result2.watermarkId);
    });
  });

  describe('validatePlaybackToken', () => {
    it('should validate a valid token', async () => {
      const contentId = 'test-content-123';
      const userAddress = '0x1234567890123456789012345678901234567890';
      const sessionId = 'session-123';

      // Generate a token first
      const tokenResult = await playbackTokenService.generatePlaybackToken(
        contentId,
        userAddress,
        sessionId
      );

      // Mock Redis to return session exists
      mockRedisService.exists.mockResolvedValue(true);

      const validation = await playbackTokenService.validatePlaybackToken(tokenResult.token);

      expect(validation.valid).toBe(true);
      expect(validation.payload).toBeDefined();
      expect(validation.payload?.contentId).toBe(contentId);
      expect(validation.payload?.userAddress).toBe(userAddress);
    });

    it('should reject an invalid token', async () => {
      const invalidToken = 'invalid.jwt.token';

      const validation = await playbackTokenService.validatePlaybackToken(invalidToken);

      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });

    it('should reject a token when session does not exist', async () => {
      const contentId = 'test-content-123';
      const userAddress = '0x1234567890123456789012345678901234567890';
      const sessionId = 'session-123';

      // Generate a token first
      const tokenResult = await playbackTokenService.generatePlaybackToken(
        contentId,
        userAddress,
        sessionId
      );

      // Mock Redis to return session does not exist
      mockRedisService.exists.mockResolvedValue(false);

      const validation = await playbackTokenService.validatePlaybackToken(tokenResult.token);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Session not found');
    });
  });

  describe('generateWatermarkId', () => {
    it('should generate a consistent watermark ID for same inputs', async () => {
      const userAddress = '0x1234567890123456789012345678901234567890';
      const sessionId = 'session-123';

      const watermarkId1 = await playbackTokenService.generateWatermarkId(userAddress, sessionId);
      const watermarkId2 = await playbackTokenService.generateWatermarkId(userAddress, sessionId);

      expect(watermarkId1).toBe(watermarkId2);
      expect(watermarkId1).toHaveLength(16); // SHA256 substring
    });

    it('should store watermark config in Redis', async () => {
      const userAddress = '0x1234567890123456789012345678901234567890';
      const sessionId = 'session-123';

      await playbackTokenService.generateWatermarkId(userAddress, sessionId);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('watermark:'),
        expect.stringContaining(userAddress.substring(0, 6)),
        24 * 60 * 60 // 24 hours
      );
    });
  });

  describe('validateHLSSignature', () => {
    it('should validate a correct HLS signature', async () => {
      const contentId = 'test-content-123';
      const token = 'test-token';
      const expires = Math.floor(Date.now() / 1000 + 3600).toString(); // 1 hour from now
      
      // Generate expected signature
      const crypto = require('crypto');
      const signatureData = `${contentId}:${token}:${expires}`;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.HLS_SIGNING_KEY || 'your-hls-signing-key')
        .update(signatureData)
        .digest('hex');

      const isValid = await playbackTokenService.validateHLSSignature(
        contentId,
        token,
        expires,
        expectedSignature
      );

      expect(isValid).toBe(true);
    });

    it('should reject an expired HLS signature', async () => {
      const contentId = 'test-content-123';
      const token = 'test-token';
      const expires = Math.floor(Date.now() / 1000 - 3600).toString(); // 1 hour ago
      const signature = 'any-signature';

      const isValid = await playbackTokenService.validateHLSSignature(
        contentId,
        token,
        expires,
        signature
      );

      expect(isValid).toBe(false);
    });

    it('should reject an incorrect signature', async () => {
      const contentId = 'test-content-123';
      const token = 'test-token';
      const expires = Math.floor(Date.now() / 1000 + 3600).toString();
      const wrongSignature = 'wrong-signature';

      const isValid = await playbackTokenService.validateHLSSignature(
        contentId,
        token,
        expires,
        wrongSignature
      );

      expect(isValid).toBe(false);
    });
  });

  describe('revokePlaybackToken', () => {
    it('should successfully revoke an existing token', async () => {
      const sessionId = 'session-123';
      const sessionData = {
        contentId: 'test-content',
        userAddress: '0x1234567890123456789012345678901234567890',
        token: 'test-token',
        watermarkId: 'watermark-123'
      };

      // Mock Redis to return session data
      mockRedisService.get.mockResolvedValue(JSON.stringify(sessionData));

      const result = await playbackTokenService.revokePlaybackToken(sessionId);

      expect(result).toBe(true);
      expect(mockRedisService.del).toHaveBeenCalledWith(`session:${sessionId}`);
      expect(mockRedisService.srem).toHaveBeenCalledWith(
        `user_sessions:${sessionData.userAddress}`,
        sessionId
      );
    });

    it('should return false for non-existent session', async () => {
      const sessionId = 'non-existent-session';

      // Mock Redis to return null (session not found)
      mockRedisService.get.mockResolvedValue(null);

      const result = await playbackTokenService.revokePlaybackToken(sessionId);

      expect(result).toBe(false);
    });
  });

  describe('getUserActiveSessions', () => {
    it('should return active sessions for a user', async () => {
      const userAddress = '0x1234567890123456789012345678901234567890';
      const expectedSessions = ['session-1', 'session-2', 'session-3'];

      mockRedisService.smembers.mockResolvedValue(expectedSessions);

      const sessions = await playbackTokenService.getUserActiveSessions(userAddress);

      expect(sessions).toEqual(expectedSessions);
      expect(mockRedisService.smembers).toHaveBeenCalledWith(`user_sessions:${userAddress}`);
    });

    it('should return empty array when no active sessions', async () => {
      const userAddress = '0x1234567890123456789012345678901234567890';

      mockRedisService.smembers.mockResolvedValue([]);

      const sessions = await playbackTokenService.getUserActiveSessions(userAddress);

      expect(sessions).toEqual([]);
    });
  });
});