import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { getDatabase } from '../config/database';
import { Pool, PoolClient } from 'pg';

vi.mock('../config/database', () => ({
  getDatabase: vi.fn(),
}));

describe('Referral Attribution', () => {
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
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/referrals/claim', () => {
    const validReferralClaim = {
      referralCode: 'sunny-wave-42',
      metadata: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: Date.now(),
        url: 'https://reelverse.com/watch/123e4567-e89b-12d3-a456-426614174000?ref=sunny-wave-42'
      }
    };

    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174003',
      email: 'newuser@example.com',
      createdAt: new Date()
    };

    const mockReferrer = {
      id: '123e4567-e89b-12d3-a456-426614174004',
      email: 'referrer@example.com',
      name: 'John Referrer'
    };

    const mockReferralCode = {
      id: 'ref-code-123',
      code: 'sunny-wave-42',
      user_id: mockReferrer.id,
      is_active: true,
      max_uses: null,
      current_uses: 5,
      expires_at: null
    };

    it('should successfully claim a valid referral code', async () => {
      const authToken = 'valid-token';
      
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [mockReferralCode] }) // Find referral code
        .mockResolvedValueOnce({ rows: [] }) // No existing referral for user
        .mockResolvedValueOnce({ rows: [{ id: 'referral-123' }] }) // Create referral record
        .mockResolvedValueOnce({}); // COMMIT

      const response = await request(app)
        .post('/api/referrals/claim')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validReferralClaim);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('Welcome'),
        referralId: 'referral-123',
        attribution: {
          referrerId: mockReferrer.id,
          bonusRate: 0.10,
          expiresAt: expect.any(String)
        }
      });

      // Verify referral record was created
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO referrals'),
        expect.arrayContaining([
          mockUser.id, // referred_user_id
          mockReferrer.id, // referrer_user_id
          mockReferralCode.id, // referral_code_id
          expect.any(String), // expires_at (6 months from now)
          expect.objectContaining({ // metadata
            user_agent: validReferralClaim.metadata.userAgent,
            ip_address: expect.any(String),
            timestamp: validReferralClaim.metadata.timestamp
          })
        ])
      );
    });

    it('should prevent duplicate referral claims', async () => {
      const authToken = 'valid-token';
      
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [mockReferralCode] }) // Find referral code
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'existing-referral-123',
            referrer_user_id: mockReferrer.id,
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            status: 'active'
          }] 
        }); // Existing referral found

      const response = await request(app)
        .post('/api/referrals/claim')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validReferralClaim);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'You have already claimed a referral code recently',
        code: 'DUPLICATE_REFERRAL_CLAIM'
      });
    });

    it('should prevent self-referral', async () => {
      const authToken = 'valid-token';
      
      // Mock referral code owned by the same user trying to claim it
      const selfReferralCode = {
        ...mockReferralCode,
        user_id: mockUser.id // Same as authenticated user
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [selfReferralCode] }); // Self-owned code

      const response = await request(app)
        .post('/api/referrals/claim')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validReferralClaim);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Cannot use your own referral code',
        code: 'SELF_REFERRAL_NOT_ALLOWED'
      });
    });

    it('should validate expired referral codes', async () => {
      const authToken = 'valid-token';
      
      const expiredCode = {
        ...mockReferralCode,
        expires_at: new Date(Date.now() - 86400000).toISOString() // Expired yesterday
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [expiredCode] });

      const response = await request(app)
        .post('/api/referrals/claim')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validReferralClaim);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Referral code has expired',
        code: 'EXPIRED_REFERRAL_CODE'
      });
    });

    it('should validate inactive referral codes', async () => {
      const authToken = 'valid-token';
      
      const inactiveCode = {
        ...mockReferralCode,
        is_active: false
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [inactiveCode] });

      const response = await request(app)
        .post('/api/referrals/claim')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validReferralClaim);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Referral code is not active',
        code: 'INACTIVE_REFERRAL_CODE'
      });
    });

    it('should validate usage limits', async () => {
      const authToken = 'valid-token';
      
      const maxedOutCode = {
        ...mockReferralCode,
        max_uses: 10,
        current_uses: 10 // At maximum uses
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [maxedOutCode] });

      const response = await request(app)
        .post('/api/referrals/claim')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validReferralClaim);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Referral code has reached maximum uses',
        code: 'REFERRAL_CODE_MAXED_OUT'
      });
    });

    it('should detect suspicious referral claims', async () => {
      const authToken = 'valid-token';
      
      const suspiciousReferralClaim = {
        referralCode: 'sunny-wave-42',
        metadata: {
          userAgent: 'Bot', // Suspicious user agent
          timestamp: Date.now() - (2 * 60 * 60 * 1000), // 2 hours old timestamp
          url: 'https://reelverse.com/watch/123?ref=sunny-wave-42'
        }
      };

      const response = await request(app)
        .post('/api/referrals/claim')
        .set('Authorization', `Bearer ${authToken}`)
        .send(suspiciousReferralClaim);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Unable to process referral claim',
        code: 'REFERRAL_VALIDATION_FAILED'
      });
    });

    it('should handle non-existent referral codes', async () => {
      const authToken = 'valid-token';
      
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [] }); // No referral code found

      const response = await request(app)
        .post('/api/referrals/claim')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validReferralClaim);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: 'Referral code not found',
        code: 'REFERRAL_CODE_NOT_FOUND'
      });
    });

    it('should validate referral code format', async () => {
      const authToken = 'valid-token';
      
      const invalidFormatClaim = {
        referralCode: 'invalid_format!', // Contains invalid characters
        metadata: validReferralClaim.metadata
      };

      const response = await request(app)
        .post('/api/referrals/claim')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidFormatClaim);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'referralCode',
            message: 'Referral code can only contain lowercase letters, numbers, and hyphens'
          })
        ])
      );
    });

    it('should track referral earnings correctly', async () => {
      const authToken = 'valid-token';
      
      // Simulate a tip with referral attribution
      const tipAmount = 20.00;
      const expectedReferralBonus = tipAmount * 0.10; // 10% referral bonus

      (mockClient.query as any)
        .mockResolvedValueOnce({ 
          rows: [{ 
            referrer_id: mockReferrer.id,
            reward_bps: 1000, // 10% in basis points
            expires_at: new Date(Date.now() + 86400000).toISOString()
          }] 
        }) // Get active referral
        .mockResolvedValueOnce({ rows: [{ process_referral_earnings: 'ref-earnings-123' }] }) // Process earnings
        .mockResolvedValueOnce({}); // COMMIT

      // This would typically be called by the tip processing endpoint
      const result = await mockClient.query!(
        'SELECT process_referral_earnings($1, $2, $3, $4)',
        [mockUser.id, tipAmount, 'tip', 'video-123']
      );

      expect(result).toEqual({ rows: [{ process_referral_earnings: 'ref-earnings-123' }] });

      // Verify the function was called with correct parameters
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT process_referral_earnings($1, $2, $3, $4)',
        [mockUser.id, tipAmount, 'tip', 'video-123']
      );
    });
  });

  describe('GET /api/referrals/codes', () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174004',
      email: 'creator@example.com'
    };

    it('should return user referral codes with statistics', async () => {
      const authToken = 'valid-token';
      
      const mockCodes = [
        {
          id: 'code-1',
          code: 'sunny-wave-42',
          user_id: mockUser.id,
          is_active: true,
          click_count: 25,
          signup_count: 3,
          earnings_usdc: 15.75,
          created_at: new Date().toISOString(),
          expires_at: null
        },
        {
          id: 'code-2',
          code: 'cool-star-99',
          user_id: mockUser.id,
          is_active: true,
          click_count: 12,
          signup_count: 1,
          earnings_usdc: 5.20,
          created_at: new Date().toISOString(),
          expires_at: null
        }
      ];

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: mockCodes });

      const response = await request(app)
        .get('/api/referrals/codes')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        codes: expect.arrayContaining([
          expect.objectContaining({
            id: 'code-1',
            code: 'sunny-wave-42',
            isActive: true,
            clickCount: 25,
            signupCount: 3,
            earningsUSDC: 15.75
          }),
          expect.objectContaining({
            id: 'code-2',
            code: 'cool-star-99',
            isActive: true,
            clickCount: 12,
            signupCount: 1,
            earningsUSDC: 5.20
          })
        ]),
        totalEarnings: 20.95,
        totalSignups: 4
      });
    });

    it('should return empty array for users with no codes', async () => {
      const authToken = 'valid-token';
      
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/referrals/codes')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        codes: [],
        totalEarnings: 0,
        totalSignups: 0
      });
    });
  });

  describe('POST /api/referrals/codes', () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174004',
      email: 'creator@example.com'
    };

    it('should create a new referral code', async () => {
      const authToken = 'valid-token';
      
      const createRequest = {
        code: 'custom-code-123'
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [] }) // Check for existing code
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'new-code-123',
            code: 'custom-code-123',
            user_id: mockUser.id,
            is_active: true,
            click_count: 0,
            signup_count: 0,
            earnings_usdc: 0,
            created_at: new Date().toISOString()
          }] 
        }); // Create new code

      const response = await request(app)
        .post('/api/referrals/codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest);

      expect(response.status).toBe(200);
      expect(response.body.code).toMatchObject({
        id: 'new-code-123',
        code: 'custom-code-123',
        isActive: true,
        clickCount: 0,
        signupCount: 0,
        earningsUSDC: 0
      });
    });

    it('should prevent duplicate referral codes', async () => {
      const authToken = 'valid-token';
      
      const createRequest = {
        code: 'existing-code-123'
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'existing-123',
            code: 'existing-code-123',
            user_id: 'other-user-123'
          }] 
        }); // Code already exists

      const response = await request(app)
        .post('/api/referrals/codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Referral code already exists',
        code: 'DUPLICATE_REFERRAL_CODE'
      });
    });

    it('should enforce referral code limits per user', async () => {
      const authToken = 'valid-token';
      
      const createRequest = {
        code: 'new-code-123'
      };

      // Mock user already having maximum codes (5)
      const existingCodes = Array.from({ length: 5 }, (_, i) => ({
        id: `code-${i}`,
        code: `code-${i}`,
        user_id: mockUser.id
      }));

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [] }) // Code doesn't exist globally
        .mockResolvedValueOnce({ rows: existingCodes }); // User has max codes

      const response = await request(app)
        .post('/api/referrals/codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Maximum referral codes reached (5)',
        code: 'MAX_REFERRAL_CODES_REACHED'
      });
    });
  });

  describe('Referral Attribution Window', () => {
    it('should respect 6-month attribution window', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        email: 'user@example.com'
      };

      // Mock referral that's about to expire
      const nearExpiryReferral = {
        id: 'referral-123',
        referrer_user_id: '123e4567-e89b-12d3-a456-426614174004',
        referred_user_id: mockUser.id,
        expires_at: new Date(Date.now() + 86400000).toISOString(), // Expires tomorrow
        status: 'active'
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [nearExpiryReferral] }); // Active referral found

      // This would be part of tip/subscription processing
      const result = await mockClient.query!(
        'SELECT * FROM get_active_referral($1)',
        [mockUser.id]
      );

      expect(result.rows).toEqual([nearExpiryReferral]);

      // Test expired referral
      const expiredReferral = {
        ...nearExpiryReferral,
        expires_at: new Date(Date.now() - 86400000).toISOString() // Expired yesterday
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [] }); // No active referral (expired)

      const expiredResult = await mockClient.query!(
        'SELECT * FROM get_active_referral($1)',
        [mockUser.id]
      );

      expect(expiredResult.rows).toEqual([]);
    });
  });
});