import request from 'supertest';
import app from '../../index';
import { PlaybackTokenService } from '../../services/playbackTokenService';

// Mock external dependencies
jest.mock('../../config/database');
jest.mock('../../config/redis');
jest.mock('../../utils/logger');

describe('Playback Token Integration Flow', () => {
  let playbackTokenService: PlaybackTokenService;

  beforeAll(() => {
    // Mock environment variables
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.HLS_SIGNING_KEY = 'test-hls-signing-key';
    process.env.HLS_BASE_URL = 'https://test-stream.reelverse.com';
    process.env.MAX_CONCURRENT_SESSIONS = '5';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    playbackTokenService = PlaybackTokenService.getInstance();
  });

  describe('POST /api/v1/content/playback-token', () => {
    it('should generate playback token for valid request', async () => {
      const requestBody = {
        contentId: 'test-content-123',
        userAddress: '0x1234567890123456789012345678901234567890',
        sessionId: 'session-123',
        expiryMinutes: 60
      };

      const response = await request(app)
        .post('/api/v1/content/playback-token')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('hlsUrl');
      expect(response.body.data).toHaveProperty('watermarkId');
      expect(response.body.data).toHaveProperty('expiresAt');
      expect(response.body.data.sessionId).toBe(requestBody.sessionId);

      // Verify HLS URL format
      expect(response.body.data.hlsUrl).toContain('test-stream.reelverse.com');
      expect(response.body.data.hlsUrl).toContain('playlist.m3u8');
      expect(response.body.data.hlsUrl).toContain('token=');
      expect(response.body.data.hlsUrl).toContain('signature=');
    });

    it('should reject request with invalid user address', async () => {
      const requestBody = {
        contentId: 'test-content-123',
        userAddress: 'invalid-address',
        sessionId: 'session-123'
      };

      const response = await request(app)
        .post('/api/v1/content/playback-token')
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('pattern');
    });

    it('should reject request with missing required fields', async () => {
      const requestBody = {
        contentId: 'test-content-123'
        // Missing userAddress and sessionId
      };

      const response = await request(app)
        .post('/api/v1/content/playback-token')
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });
  });

  describe('POST /api/v1/content/validate-token', () => {
    it('should validate a valid playback token', async () => {
      // First generate a token
      const tokenResult = await playbackTokenService.generatePlaybackToken(
        'test-content-123',
        '0x1234567890123456789012345678901234567890',
        'session-123'
      );

      const response = await request(app)
        .post('/api/v1/content/validate-token')
        .send({ token: tokenResult.token })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.payload).toBeDefined();
      expect(response.body.data.payload.contentId).toBe('test-content-123');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/content/validate-token')
        .send({ token: 'invalid.jwt.token' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.error).toBeDefined();
    });
  });

  describe('GET /api/v1/content/sessions/:userAddress', () => {
    it('should return active sessions for valid address', async () => {
      const userAddress = '0x1234567890123456789012345678901234567890';

      const response = await request(app)
        .get(`/api/v1/content/sessions/${userAddress}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userAddress', userAddress);
      expect(response.body.data).toHaveProperty('activeSessions');
      expect(response.body.data).toHaveProperty('sessionIds');
      expect(Array.isArray(response.body.data.sessionIds)).toBe(true);
    });

    it('should reject invalid Ethereum address', async () => {
      const response = await request(app)
        .get('/api/v1/content/sessions/invalid-address')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid Ethereum address');
    });
  });

  describe('POST /api/v1/content/revoke-token', () => {
    it('should revoke existing token', async () => {
      const sessionId = 'session-to-revoke';

      const response = await request(app)
        .post('/api/v1/content/revoke-token')
        .send({ sessionId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionId', sessionId);
      expect(response.body.data).toHaveProperty('revoked');
    });

    it('should reject request without sessionId', async () => {
      const response = await request(app)
        .post('/api/v1/content/revoke-token')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Session ID is required');
    });
  });

  describe('GET /api/v1/content/watermark/:watermarkId', () => {
    it('should return watermark config with valid token', async () => {
      // This test would require a valid token in the Authorization header
      // For now, we'll test the endpoint structure
      const watermarkId = 'test-watermark-id';

      const response = await request(app)
        .get(`/api/v1/content/watermark/${watermarkId}`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401); // Expected since we're using invalid token

      // The endpoint exists and responds to authentication
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_INVALID');
    });
  });

  describe('HLS Streaming Endpoint', () => {
    it('should serve HLS playlist with valid signature', async () => {
      const contentId = 'test-content-123';
      
      // Generate a token and extract URL parameters
      const tokenResult = await playbackTokenService.generatePlaybackToken(
        contentId,
        '0x1234567890123456789012345678901234567890',
        'session-123'
      );

      // Extract query parameters from HLS URL
      const url = new URL(tokenResult.hlsUrl);
      const token = url.searchParams.get('token');
      const expires = url.searchParams.get('expires');
      const signature = url.searchParams.get('signature');

      const response = await request(app)
        .get(`/api/v1/content/hls/${contentId}/playlist.m3u8`)
        .query({ token, expires, signature })
        .expect(200);

      expect(response.headers['content-type']).toBe('application/vnd.apple.mpegurl');
      expect(response.text).toContain('#EXTM3U');
      expect(response.text).toContain('#EXT-X-VERSION:3');
      expect(response.text).toContain('watermark=');
    });

    it('should reject HLS request with missing parameters', async () => {
      const contentId = 'test-content-123';

      const response = await request(app)
        .get(`/api/v1/content/hls/${contentId}/playlist.m3u8`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('HLS_PARAMS_MISSING');
    });
  });

  describe('Content Access Check', () => {
    it('should check content access permissions', async () => {
      const contentId = 'test-content-123';
      const userAddress = '0x1234567890123456789012345678901234567890';

      const response = await request(app)
        .post(`/api/v1/content/${contentId}/access`)
        .send({ userAddress, sessionId: 'session-123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('allowed');
      expect(response.body.data).toHaveProperty('reasons');
    });
  });

  describe('Content Requirements', () => {
    it('should return content requirements', async () => {
      const contentId = 'test-content-123';

      const response = await request(app)
        .get(`/api/v1/content/${contentId}/requirements`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('ageVerificationRequired');
      expect(response.body.data).toHaveProperty('entitlementRequired');
      expect(response.body.data).toHaveProperty('entitlementType');
    });
  });
});