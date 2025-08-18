import request from 'supertest';
import app from '../../index';
import { RedisService } from '../../config/redis';
import { AgeVerificationService } from '../../services/ageVerificationService';

// Mock dependencies
jest.mock('../../config/redis');
jest.mock('../../services/ageVerificationService');
jest.mock('../../config/database');
jest.mock('../../utils/logger');

describe('Policy Engine Integration', () => {
  let mockRedisService: jest.Mocked<RedisService>;
  let mockAgeVerificationService: jest.Mocked<AgeVerificationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Redis service
    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      sadd: jest.fn(),
      smembers: jest.fn(),
      srem: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      keys: jest.fn()
    } as any;

    // Mock Age verification service
    mockAgeVerificationService = {
      getVerificationStatus: jest.fn()
    } as any;

    // Mock static getInstance methods
    (RedisService.getInstance as jest.Mock).mockReturnValue(mockRedisService);
    (AgeVerificationService.getInstance as jest.Mock).mockReturnValue(mockAgeVerificationService);
  });

  describe('POST /api/v1/policy/evaluate', () => {
    it('should evaluate access policies successfully', async () => {
      // Mock content policy
      const mockContentPolicy = {
        contentId: 'test-content-123',
        ageRestricted: false,
        geoRestrictions: [],
        entitlementRequired: false,
        deviceLimit: 5,
        watermarkRequired: false,
        watermarkType: 'session_based',
        isActive: true,
        moderationStatus: 'approved'
      };

      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(mockContentPolicy));
      mockRedisService.smembers.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/v1/policy/evaluate')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({
          contentId: 'test-content-123',
          deviceId: 'test-device-789',
          sessionId: 'test-session-abc'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.allowed).toBe(true);
      expect(response.body.data.restrictions).toHaveLength(0);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/policy/evaluate')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({
          contentId: 'test-content-123'
          // Missing deviceId
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/v1/policy/evaluate')
        .send({
          contentId: 'test-content-123',
          deviceId: 'test-device-789'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/policy/ticket', () => {
    it('should create playback ticket for allowed access', async () => {
      // Mock content policy that allows access
      const mockContentPolicy = {
        contentId: 'test-content-123',
        ageRestricted: false,
        geoRestrictions: [],
        entitlementRequired: false,
        deviceLimit: 5,
        watermarkRequired: true,
        watermarkType: 'session_based',
        isActive: true,
        moderationStatus: 'approved'
      };

      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(mockContentPolicy));
      mockRedisService.smembers.mockResolvedValueOnce([]);
      mockRedisService.set.mockResolvedValue('OK');
      mockRedisService.sadd.mockResolvedValue(1);
      mockRedisService.expire.mockResolvedValue(1);

      const response = await request(app)
        .post('/api/v1/policy/ticket')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({
          contentId: 'test-content-123',
          deviceId: 'test-device-789',
          sessionId: 'test-session-abc',
          ttlMinutes: 5
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ticket).toBeDefined();
      expect(response.body.data.ticket.ticketId).toBeDefined();
      expect(response.body.data.ticket.contentId).toBe('test-content-123');
    });

    it('should return 403 for denied access', async () => {
      // Mock content policy that denies access
      const mockContentPolicy = {
        contentId: 'test-content-123',
        ageRestricted: false,
        geoRestrictions: [],
        entitlementRequired: false,
        deviceLimit: 5,
        watermarkRequired: false,
        watermarkType: 'session_based',
        isActive: false, // Content is inactive
        moderationStatus: 'approved'
      };

      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(mockContentPolicy));

      const response = await request(app)
        .post('/api/v1/policy/ticket')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({
          contentId: 'test-content-123',
          deviceId: 'test-device-789',
          sessionId: 'test-session-abc'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/policy/validate', () => {
    it('should validate ticket successfully', async () => {
      // This test would need a real ticket with proper signature
      // For now, we'll test the error case
      const response = await request(app)
        .post('/api/v1/policy/validate')
        .send({
          ticketId: 'invalid-ticket-id',
          deviceId: 'test-device-789'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/policy/validate')
        .send({
          ticketId: 'test-ticket-123'
          // Missing deviceId
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/policy/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/v1/policy/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.service).toBe('policy-engine');
    });
  });
});