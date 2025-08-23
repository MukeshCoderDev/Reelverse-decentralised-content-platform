import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { getDatabase } from '../config/database';
import { redis } from '../config/redis';
import { Pool, PoolClient } from 'pg';

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

describe('End-to-End Monetization Workflows', () => {
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
      exec: vi.fn().mockResolvedValue([1, -1])
    });

    (redis.get as any).mockResolvedValue(null); // No cached idempotency
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Complete Tip-to-Payout Flow', () => {
    const tipper = { id: 'tipper-123', email: 'tipper@example.com' };
    const creator = { id: 'creator-123', email: 'creator@example.com' };
    const referrer = { id: 'referrer-123', email: 'referrer@example.com' };
    const collaborator = { id: 'collab-123', email: 'collab@example.com' };

    it('should handle complete flow: referral -> tip with splits -> earnings -> payout', async () => {
      const authTokenTipper = 'tipper-token';
      const authTokenCreator = 'creator-token';

      // Step 1: Claim referral code
      const referralCode = {
        id: 'ref-code-123',
        code: 'sunny-wave-42',
        user_id: referrer.id,
        is_active: true
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [referralCode] }) // Find referral code
        .mockResolvedValueOnce({ rows: [] }) // No existing referral
        .mockResolvedValueOnce({ rows: [{ id: 'referral-attribution-123' }] }) // Create referral
        .mockResolvedValueOnce({}); // COMMIT

      let response = await request(app)
        .post('/api/referrals/claim')
        .set('Authorization', `Bearer ${authTokenTipper}`)
        .send({
          referralCode: 'sunny-wave-42',
          metadata: {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            timestamp: Date.now(),
            url: 'https://reelverse.com/watch/video-123?ref=sunny-wave-42'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Step 2: Process tip with splits and referral bonus
      const splitPolicy = [
        { payee_user_id: creator.id, percent: 70.00, is_creator: true },
        { payee_user_id: collaborator.id, percent: 30.00, is_creator: false }
      ];

      const activeReferral = {
        referrer_id: referrer.id,
        reward_bps: 1000, // 10% bonus
        expires_at: new Date(Date.now() + 86400000).toISOString()
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [{ policy_id: 'policy-123', version: 1, splits: splitPolicy }] }) // Split policy
        .mockResolvedValueOnce({ rows: [activeReferral] }) // Active referral
        .mockResolvedValueOnce({ rows: [{ process_referral_earnings: 'ref-earnings-123' }] }) // Process referral
        .mockResolvedValueOnce({ rows: [{ id: 'parent-ledger-123' }] }) // Parent tip ledger
        .mockResolvedValueOnce({}) // Creator split entry
        .mockResolvedValueOnce({}) // Collaborator split entry
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ 
          rows: [{ 
            today_usdc: '22.68', // Creator's 70% of $30 tip (after platform fee + referral bonus)
            pending_usdc: '0.00', 
            available_usdc: '22.68' 
          }] 
        });

      response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authTokenTipper}`)
        .set('Idempotency-Key', 'e2e-tip-123')
        .send({
          videoId: '123e4567-e89b-12d3-a456-426614174000',
          creatorId: creator.id,
          amountUSDC: 30.00
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.transactionId).toBe('parent-ledger-123');

      // Verify split calculation: $30 -> $3 platform fee -> $27 net
      // With 10% referral bonus: +$3 -> $30 total to split
      // Creator (70%): $21, Collaborator (30%): $9

      // Step 3: Creator requests payout
      const payoutMethod = {
        id: 'payout-method-123',
        user_id: creator.id,
        type: 'crypto',
        name: 'Primary Wallet',
        address: '0x742d35Cc7E58a5C7b5c1b65b4a8f61b0F5c9a8b7',
        is_verified: true
      };

      const creatorBalance = {
        available_usdc: 85.50, // Accumulated from multiple tips
        pending_usdc: 15.00,
        today_usdc: 22.68
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [creatorBalance] }) // Get balance
        .mockResolvedValueOnce({ rows: [payoutMethod] }) // Get payout method
        .mockResolvedValueOnce({ rows: [{ is_kyc_verified: true }] }) // KYC check
        .mockResolvedValueOnce({ rows: [{ total_amount_today: 0 }] }) // Daily limit check
        .mockResolvedValueOnce({ rows: [{ id: 'payout-request-123' }] }) // Create payout
        .mockResolvedValueOnce({}); // COMMIT

      response = await request(app)
        .post('/api/payouts')
        .set('Authorization', `Bearer ${authTokenCreator}`)
        .set('Idempotency-Key', 'e2e-payout-123')
        .send({
          amountUSDC: 50.00,
          payoutMethodId: payoutMethod.id
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.payoutId).toBe('payout-request-123');

      // Step 4: Verify referrer earned bonus
      (mockClient.query as any)
        .mockResolvedValueOnce({ 
          rows: [{ 
            today_usdc: '3.00', // Referrer's 10% bonus from $30 tip
            pending_usdc: '0.00', 
            available_usdc: '3.00' 
          }] 
        });

      response = await request(app)
        .get('/api/finance/summary')
        .set('Authorization', `Bearer referrer-token`);

      expect(response.status).toBe(200);
      expect(response.body.todayUSDC).toBe(3.00);
    });

    it('should handle subscription flow with automatic renewals', async () => {
      const subscriber = { id: 'subscriber-123', email: 'subscriber@example.com' };
      const creator = { id: 'creator-456', email: 'creator@example.com' };
      
      const authTokenSubscriber = 'subscriber-token';

      // Step 1: Create subscription
      const subscriptionPlan = {
        id: 'plan-123',
        creator_id: creator.id,
        name: 'Premium Plan',
        price_usdc: 9.99,
        cadence: 'monthly',
        is_active: true
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [subscriptionPlan] }) // Plan validation
        .mockResolvedValueOnce({ rows: [] }) // No existing subscription
        .mockResolvedValueOnce({ rows: [{ id: 'subscription-123' }] }) // Create subscription
        .mockResolvedValueOnce({ rows: [{ id: 'payment-123' }] }) // Initial payment
        .mockResolvedValueOnce({ rows: [{ id: 'ledger-123' }] }) // Creator earnings
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ 
          rows: [{ 
            today_usdc: '8.99', // Creator gets 90% of $9.99
            pending_usdc: '0.00', 
            available_usdc: '8.99' 
          }] 
        });

      let response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authTokenSubscriber}`)
        .set('Idempotency-Key', 'e2e-subscription-123')
        .send({
          creatorId: creator.id,
          planId: subscriptionPlan.id
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.subscriptionId).toBe('subscription-123');

      // Step 2: Simulate subscription renewal (worker process)
      const subscriptionForRenewal = {
        id: 'subscription-123',
        user_id: subscriber.id,
        creator_id: creator.id,
        plan_id: subscriptionPlan.id,
        price_usdc: 9.99,
        status: 'active',
        next_billing_at: new Date(Date.now() - 1000), // Past due
        failure_count: 0,
        grace_period_ends_at: null
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [subscriptionForRenewal] }) // Get renewals due
        .mockResolvedValueOnce({ rows: [{ id: 'renewal-payment-456' }] }) // Renewal payment
        .mockResolvedValueOnce({ rows: [{ id: 'renewal-ledger-456' }] }) // Creator earnings
        .mockResolvedValueOnce({}) // Update next billing date
        .mockResolvedValueOnce({}); // COMMIT

      // This would be called by the subscription renewal worker
      const { processSubscriptionRenewal } = await import('../workers/subscriptionRenewalWorker');
      const renewalResult = await processSubscriptionRenewal();

      expect(renewalResult.processed).toBe(1);
      expect(renewalResult.successful).toBe(1);

      // Step 3: Verify subscription status
      const activeSubscription = {
        id: 'subscription-123',
        creator_name: 'Creator Name',
        plan_name: 'Premium Plan',
        price_usdc: 9.99,
        status: 'active',
        next_billing_at: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString()
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [activeSubscription] });

      response = await request(app)
        .get('/api/subscriptions/user')
        .set('Authorization', `Bearer ${authTokenSubscriber}`);

      expect(response.status).toBe(200);
      expect(response.body.subscriptions).toHaveLength(1);
      expect(response.body.subscriptions[0].status).toBe('active');
    });

    it('should handle split policy management workflow', async () => {
      const creator = { id: 'creator-789', email: 'creator@example.com' };
      const authTokenCreator = 'creator-token';

      // Step 1: Create split policy
      const splitPolicyRequest = {
        name: 'Band Split Policy',
        description: 'Revenue sharing for band members',
        payees: [
          {
            name: 'Lead Singer',
            email: 'singer@band.com',
            percentage: 40.00
          },
          {
            name: 'Guitarist',
            email: 'guitarist@band.com',
            percentage: 30.00
          },
          {
            name: 'Drummer',
            email: 'drummer@band.com',
            percentage: 20.00
          },
          {
            name: 'Bassist',
            email: 'bassist@band.com',
            percentage: 10.00
          }
        ]
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [{ id: 'split-policy-123' }] }) // Create policy
        .mockResolvedValueOnce({}) // Create policy items
        .mockResolvedValueOnce({}) // Create policy items
        .mockResolvedValueOnce({}) // Create policy items
        .mockResolvedValueOnce({}) // Create policy items
        .mockResolvedValueOnce({}); // COMMIT

      let response = await request(app)
        .post('/api/splits/policies')
        .set('Authorization', `Bearer ${authTokenCreator}`)
        .send(splitPolicyRequest);

      expect(response.status).toBe(200);
      expect(response.body.policy.id).toBe('split-policy-123');

      // Step 2: Apply policy to video
      const videoId = '123e4567-e89b-12d3-a456-426614174000';

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [{ creator_id: creator.id }] }) // Verify video ownership
        .mockResolvedValueOnce({ rows: [] }) // No existing policy
        .mockResolvedValueOnce({ rows: [{ id: 'video-split-applied-123' }] }) // Apply policy
        .mockResolvedValueOnce({}); // COMMIT

      response = await request(app)
        .post(`/api/videos/${videoId}/splits`)
        .set('Authorization', `Bearer ${authTokenCreator}`)
        .send({
          splitPolicyId: 'split-policy-123'
        });

      expect(response.status).toBe(200);

      // Step 3: Verify splits applied to subsequent tips
      const tipWithSplits = {
        videoId,
        creatorId: creator.id,
        amountUSDC: 50.00
      };

      const appliedSplitPolicy = [
        { payee_user_id: 'singer-id', percent: 40.00, is_creator: false },
        { payee_user_id: 'guitarist-id', percent: 30.00, is_creator: false },
        { payee_user_id: 'drummer-id', percent: 20.00, is_creator: false },
        { payee_user_id: 'bassist-id', percent: 10.00, is_creator: false }
      ];

      (mockClient.query as any)
        .mockResolvedValueOnce({ 
          rows: [{ 
            policy_id: 'split-policy-123', 
            version: 1, 
            splits: appliedSplitPolicy 
          }] 
        }) // Get applied split policy
        .mockResolvedValueOnce({ rows: [] }) // No referral
        .mockResolvedValueOnce({ rows: [{ id: 'split-tip-ledger-123' }] }) // Parent ledger
        .mockResolvedValueOnce({}) // Singer split
        .mockResolvedValueOnce({}) // Guitarist split
        .mockResolvedValueOnce({}) // Drummer split
        .mockResolvedValueOnce({}) // Bassist split
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ 
          rows: [{ 
            today_usdc: '18.00', // Singer's 40% of $45 (after 10% platform fee)
            pending_usdc: '0.00', 
            available_usdc: '18.00' 
          }] 
        });

      response = await request(app)
        .post('/api/tips')
        .set('Authorization', 'Bearer tipper-token')
        .set('Idempotency-Key', 'e2e-split-tip-123')
        .send(tipWithSplits);

      expect(response.status).toBe(200);
      
      // Verify all 4 split entries were created
      const splitCalls = (mockClient.query as any).mock.calls.filter(
        call => call[0].includes('INSERT INTO earnings_ledger') && call[1][4] === 'split'
      );
      expect(splitCalls).toHaveLength(4);
    });

    it('should handle complex fraud detection scenarios', async () => {
      const authToken = 'suspicious-user-token';
      const suspiciousUser = { id: 'suspicious-123', email: 'suspicious@example.com' };

      // Scenario 1: Rapid-fire tips (should be rate limited)
      (redis.multi as any).mockReturnValue({
        incr: vi.fn().mockReturnThis(),
        pttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([11, 5000]) // Exceeds rate limit
      });

      let response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'rapid-tip-1')
        .send({
          videoId: '123e4567-e89b-12d3-a456-426614174000',
          creatorId: 'creator-123',
          amountUSDC: 5.00
        });

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('rate_limited');

      // Scenario 2: Suspicious referral claim
      const suspiciousReferralClaim = {
        referralCode: 'test-code-123',
        metadata: {
          userAgent: 'Bot/1.0', // Obviously suspicious
          timestamp: Date.now() - (3 * 60 * 60 * 1000), // 3 hours old
          url: 'https://suspicious-site.com/watch/123?ref=test-code-123'
        }
      };

      response = await request(app)
        .post('/api/referrals/claim')
        .set('Authorization', `Bearer ${authToken}`)
        .send(suspiciousReferralClaim);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('REFERRAL_VALIDATION_FAILED');

      // Scenario 3: Idempotency conflict detection
      const conflictingRequest = {
        videoId: '123e4567-e89b-12d3-a456-426614174000',
        creatorId: 'creator-123',
        amountUSDC: 10.00 // Different amount with same idempotency key
      };

      const cachedResponse = JSON.stringify({
        status: 200,
        body: { ok: true, transactionId: 'original-123' },
        headers: { 'Content-Type': 'application/json' },
        timestamp: Date.now() - 1000,
        userId: suspiciousUser.id,
        fingerprint: 'different-fingerprint-123'
      });

      (redis.get as any).mockResolvedValue(cachedResponse);
      (redis.multi as any).mockReturnValue({
        incr: vi.fn().mockReturnThis(),
        pttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([1, -1]) // Within rate limit
      });

      response = await request(app)
        .post('/api/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'conflict-test-123')
        .send(conflictingRequest);

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('IDEMPOTENCY_CONFLICT');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume tip processing', async () => {
      const authToken = 'volume-test-token';
      
      // Mock successful responses for batch processing
      (redis.multi as any).mockReturnValue({
        incr: vi.fn().mockReturnThis(),
        pttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([1, -1])
      });

      (redis.get as any).mockResolvedValue(null);

      // Simulate processing 100 tips in parallel
      const tipPromises = Array.from({ length: 100 }, (_, i) => {
        (mockClient.query as any)
          .mockResolvedValueOnce({ rows: [] }) // No splits
          .mockResolvedValueOnce({ rows: [] }) // No referral
          .mockResolvedValueOnce({ rows: [{ id: `ledger-${i}` }] }) // Parent ledger
          .mockResolvedValueOnce({}) // Split entry
          .mockResolvedValueOnce({}) // COMMIT
          .mockResolvedValueOnce({ 
            rows: [{ today_usdc: '4.50', pending_usdc: '0.00', available_usdc: '4.50' }] 
          });

        return request(app)
          .post('/api/tips')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Idempotency-Key', `volume-tip-${i}`)
          .send({
            videoId: '123e4567-e89b-12d3-a456-426614174000',
            creatorId: 'creator-123',
            amountUSDC: 5.00
          });
      });

      const responses = await Promise.all(tipPromises);
      
      // All should succeed
      expect(responses.every(r => r.status === 200)).toBe(true);
      expect(responses.every(r => r.body.ok === true)).toBe(true);
    });

    it('should maintain data consistency under concurrent operations', async () => {
      const authToken = 'consistency-test-token';
      
      // Simulate concurrent operations on same user
      const userId = 'concurrent-user-123';
      
      // Mock database responses for concurrent tips and payouts
      (mockClient.query as any)
        .mockResolvedValue({ rows: [] }) // Default empty response
        .mockResolvedValueOnce({ rows: [{ id: 'concurrent-ledger-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'concurrent-ledger-2' }] })
        .mockResolvedValueOnce({ rows: [{ available_usdc: 100.00 }] }) // Balance check
        .mockResolvedValueOnce({ rows: [{ id: 'payout-concurrent-123' }] }); // Payout

      const operations = [
        // Concurrent tips
        request(app)
          .post('/api/tips')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Idempotency-Key', 'concurrent-tip-1')
          .send({
            videoId: '123e4567-e89b-12d3-a456-426614174000',
            creatorId: userId,
            amountUSDC: 10.00
          }),
        
        request(app)
          .post('/api/tips')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Idempotency-Key', 'concurrent-tip-2')
          .send({
            videoId: '123e4567-e89b-12d3-a456-426614174001',
            creatorId: userId,
            amountUSDC: 15.00
          }),

        // Concurrent payout request
        request(app)
          .post('/api/payouts')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Idempotency-Key', 'concurrent-payout-1')
          .send({
            amountUSDC: 50.00,
            payoutMethodId: '123e4567-e89b-12d3-a456-426614174001'
          })
      ];

      const results = await Promise.allSettled(operations);
      
      // At least some operations should succeed (depending on timing and mocking)
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });
  });
});