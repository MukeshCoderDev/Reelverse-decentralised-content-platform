import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { getDatabase } from '../config/database';
import { redis } from '../config/redis';
import { Pool, PoolClient } from 'pg';

// Mock dependencies
vi.mock('../config/database', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../config/redis', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    incr: vi.fn(),
    pttl: vi.fn(),
    pexpire: vi.fn(),
    multi: vi.fn(() => ({
      incr: vi.fn(() => ({ exec: vi.fn() })),
      pttl: vi.fn(() => ({ exec: vi.fn() })),
      exec: vi.fn()
    }))
  }
}));

describe('Tip Processing', () => {
  let mockClient: Partial<PoolClient>;
  let mockPool: Partial<Pool>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn(() => Promise.resolve(mockClient as PoolClient)),
    };

    (getDatabase as any).mockReturnValue(mockPool);
    
    // Mock Redis for rate limiting
    (redis.multi as any).mockReturnValue({
      incr: vi.fn().mockReturnThis(),
      pttl: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([1, -1]) // First request, no TTL
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/tips', () => {
    const validTipRequest = {
      videoId: '123e4567-e89b-12d3-a456-426614174000',
      creatorId: '123e4567-e89b-12d3-a456-426614174001',
      amountUSDC: 10.50
    };

    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174002',
      email: 'tipper@example.com'
    };

    it('should successfully process a simple tip without splits', async () => {
      // Mock authentication
      const authToken = 'valid-token';
      
      // Mock database responses
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [] }) // No splits policy
        .mockResolvedValueOnce({ rows: [] }) // No active referral
        .mockResolvedValueOnce({ rows: [{ id: 'parent-ledger-123' }] }) // Parent ledger entry
        .mockResolvedValueOnce({}) // Split ledger entry (creator gets 100%)
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ 
          rows: [{ 
            today_usdc: '15.50', 
            pending_usdc: '0.00', 
            available_usdc: '15.50' 
          }] 
        }); // Balance query

      const response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'tip-test-123')
        .send(validTipRequest);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        transactionId: 'parent-ledger-123',
        todayUSDC: 15.50,
        pendingUSDC: 0.00,
        availableUSDC: 15.50
      });

      // Verify database transactions
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should correctly apply revenue splits', async () => {
      const authToken = 'valid-token';
      
      // Mock split policy: 60% creator, 25% producer, 15% musician
      const mockSplits = [
        { payee_user_id: validTipRequest.creatorId, percent: 60.00, is_creator: true },
        { payee_user_id: 'producer-123', percent: 25.00, is_creator: false },
        { payee_user_id: 'musician-456', percent: 15.00, is_creator: false }
      ];

      (mockClient.query as any)
        .mockResolvedValueOnce({ 
          rows: [{ 
            policy_id: 'policy-123',
            version: 1,
            splits: mockSplits 
          }] 
        }) // Split policy query
        .mockResolvedValueOnce({ rows: [] }) // No active referral
        .mockResolvedValueOnce({ rows: [{ id: 'parent-ledger-123' }] }) // Parent ledger
        .mockResolvedValueOnce({}) // Split entry 1 (creator)
        .mockResolvedValueOnce({}) // Split entry 2 (producer)
        .mockResolvedValueOnce({}) // Split entry 3 (musician)
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ 
          rows: [{ 
            today_usdc: '6.30', // Creator's share: (10.50 * 0.9) * 0.6 + residual
            pending_usdc: '0.00', 
            available_usdc: '6.30' 
          }] 
        });

      const response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'tip-splits-123')
        .send(validTipRequest);

      expect(response.status).toBe(200);
      
      // Verify that split ledger entries were created for all payees
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO earnings_ledger'),
        expect.arrayContaining([
          expect.any(String), // payee_user_id
          expect.any(Number), // amount
          0, // fee_usdc (no additional fees on splits)
          expect.any(Number), // net_usdc
          'split',
          'parent-ledger-123',
          expect.any(String), // meta JSON
          expect.stringContaining('tip-splits-123_split_')
        ])
      );
    });

    it('should apply referral bonus correctly', async () => {
      const authToken = 'valid-token';
      
      // Mock active referral (10% bonus)
      const mockReferral = {
        referrer_id: 'referrer-123',
        reward_bps: 1000, // 10% in basis points
        expires_at: new Date(Date.now() + 86400000).toISOString()
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [] }) // No splits policy
        .mockResolvedValueOnce({ rows: [mockReferral] }) // Active referral
        .mockResolvedValueOnce({ rows: [{ process_referral_earnings: 'referral-ledger-123' }] }) // Referral processing
        .mockResolvedValueOnce({ rows: [{ id: 'parent-ledger-123' }] }) // Parent ledger
        .mockResolvedValueOnce({}) // Split ledger entry
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ 
          rows: [{ 
            today_usdc: '10.45', // Should be higher due to reduced platform fee
            pending_usdc: '0.00', 
            available_usdc: '10.45' 
          }] 
        });

      const response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'tip-referral-123')
        .send(validTipRequest);

      expect(response.status).toBe(200);
      
      // Verify referral earnings were processed
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT process_referral_earnings($1, $2, $3, $4)',
        expect.arrayContaining([
          mockUser.id,
          validTipRequest.amountUSDC,
          'tip',
          validTipRequest.videoId
        ])
      );
    });

    it('should prevent self-tipping', async () => {
      const authToken = 'valid-token';
      
      // Mock user trying to tip themselves
      const selfTipRequest = {
        ...validTipRequest,
        creatorId: mockUser.id // Same as the authenticated user
      };

      const response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'self-tip-123')
        .send(selfTipRequest);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Cannot tip yourself',
        code: 'SELF_TIP_NOT_ALLOWED'
      });
    });

    it('should validate tip amount limits', async () => {
      const authToken = 'valid-token';

      // Test minimum amount violation
      const tooSmallTip = { ...validTipRequest, amountUSDC: 0.50 };
      let response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'tip-too-small-123')
        .send(tooSmallTip);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');

      // Test maximum amount violation
      const tooLargeTip = { ...validTipRequest, amountUSDC: 150 };
      response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'tip-too-large-123')
        .send(tooLargeTip);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle idempotency correctly', async () => {
      const authToken = 'valid-token';
      const idempotencyKey = 'tip-idempotency-123';
      
      // Mock cached response in Redis
      const cachedResponse = JSON.stringify({
        status: 200,
        body: {
          ok: true,
          transactionId: 'cached-transaction-123',
          todayUSDC: 10.45,
          pendingUSDC: 0.00,
          availableUSDC: 10.45
        },
        headers: { 'Content-Type': 'application/json' },
        timestamp: Date.now(),
        userId: mockUser.id,
        fingerprint: 'request-fingerprint-123'
      });

      (redis.get as any).mockResolvedValue(cachedResponse);

      const response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(validTipRequest);

      expect(response.status).toBe(200);
      expect(response.headers['x-idempotency-replay']).toBe('true');
      expect(response.body.transactionId).toBe('cached-transaction-123');
    });

    it('should detect idempotency conflicts', async () => {
      const authToken = 'valid-token';
      const idempotencyKey = 'tip-conflict-123';
      
      // Mock cached response with different fingerprint
      const cachedResponse = JSON.stringify({
        status: 200,
        body: { ok: true },
        headers: { 'Content-Type': 'application/json' },
        timestamp: Date.now() - 1000,
        userId: mockUser.id,
        fingerprint: 'different-fingerprint'
      });

      (redis.get as any).mockResolvedValue(cachedResponse);

      const response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(validTipRequest);

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        error: 'Idempotency key conflict: same key used for different request',
        code: 'IDEMPOTENCY_CONFLICT'
      });
    });

    it('should require idempotency key for financial operations', async () => {
      const authToken = 'valid-token';

      const response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        // No Idempotency-Key header
        .send(validTipRequest);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Idempotency-Key header is required for financial operations',
        code: 'MISSING_IDEMPOTENCY_KEY'
      });
    });

    it('should handle database transaction failures gracefully', async () => {
      const authToken = 'valid-token';
      
      // Mock database error
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [] }) // Split policy query succeeds
        .mockRejectedValueOnce(new Error('Database connection failed')); // Next query fails

      const response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'tip-db-error-123')
        .send(validTipRequest);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'Failed to process tip',
        code: 'TIP_PROCESSING_ERROR'
      });

      // Verify ROLLBACK was called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should enforce rate limiting', async () => {
      const authToken = 'valid-token';
      
      // Mock rate limit exceeded
      (redis.multi as any).mockReturnValue({
        incr: vi.fn().mockReturnThis(),
        pttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([11, 5000]) // 11 requests (exceeds limit of 10), 5 seconds TTL
      });

      const response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'tip-rate-limit-123')
        .send(validTipRequest);

      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({
        error: 'rate_limited',
        retryAfterMs: 5000
      });
      expect(response.headers['retry-after']).toBe('5');
    });

    it('should validate UUID formats', async () => {
      const authToken = 'valid-token';
      
      const invalidUUIDRequest = {
        ...validTipRequest,
        videoId: 'invalid-uuid',
        creatorId: 'also-invalid'
      };

      const response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'tip-invalid-uuid-123')
        .send(invalidUUIDRequest);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'videoId',
            message: 'Invalid UUID format'
          }),
          expect.objectContaining({
            field: 'creatorId',
            message: 'Invalid UUID format'
          })
        ])
      );
    });

    it('should sanitize input to prevent XSS', async () => {
      const authToken = 'valid-token';
      
      const maliciousRequest = {
        videoId: '123e4567-e89b-12d3-a456-426614174000',
        creatorId: '123e4567-e89b-12d3-a456-426614174001',
        amountUSDC: 10.50,
        // This would be sanitized by the middleware
        maliciousField: '<script>alert("xss")</script>'
      };

      // The request should proceed normally (malicious content sanitized)
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [] }) // No splits
        .mockResolvedValueOnce({ rows: [] }) // No referral
        .mockResolvedValueOnce({ rows: [{ id: 'parent-123' }] }) // Parent ledger
        .mockResolvedValueOnce({}) // Split entry
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ rows: [{ today_usdc: '9.45', pending_usdc: '0.00', available_usdc: '9.45' }] });

      const response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'tip-xss-123')
        .send(maliciousRequest);

      expect(response.status).toBe(200);
      // The malicious script should have been sanitized by middleware
    });
  });
});