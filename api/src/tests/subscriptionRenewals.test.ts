import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { getDatabase } from '../config/database';
import { Pool, PoolClient } from 'pg';

// Import the worker function to test directly
import { processSubscriptionRenewal } from '../workers/subscriptionRenewalWorker';

vi.mock('../config/database', () => ({
  getDatabase: vi.fn(),
}));

describe('Subscription Renewals', () => {
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

  describe('POST /api/subscriptions', () => {
    const validSubscriptionRequest = {
      creatorId: '123e4567-e89b-12d3-a456-426614174001',
      planId: '123e4567-e89b-12d3-a456-426614174002'
    };

    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174003',
      email: 'subscriber@example.com'
    };

    const mockPlan = {
      id: '123e4567-e89b-12d3-a456-426614174002',
      creator_id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Premium Plan',
      price_usdc: 9.99,
      cadence: 'monthly',
      is_active: true
    };

    it('should successfully create a new subscription', async () => {
      const authToken = 'valid-token';
      
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [mockPlan] }) // Plan validation
        .mockResolvedValueOnce({ rows: [] }) // No existing subscription
        .mockResolvedValueOnce({ rows: [{ id: 'sub-123' }] }) // Create subscription
        .mockResolvedValueOnce({ rows: [{ id: 'payment-123' }] }) // Create payment
        .mockResolvedValueOnce({ rows: [{ id: 'ledger-123' }] }) // Create earnings ledger
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ 
          rows: [{ 
            today_usdc: '8.99', // Creator gets 90%
            pending_usdc: '0.00', 
            available_usdc: '8.99' 
          }] 
        }); // Balance update

      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'sub-create-123')
        .send(validSubscriptionRequest);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        subscriptionId: 'sub-123',
        nextRenewalDate: expect.any(String),
        todayUSDC: 8.99,
        pendingUSDC: 0.00,
        availableUSDC: 8.99
      });

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should prevent duplicate active subscriptions', async () => {
      const authToken = 'valid-token';
      
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [mockPlan] }) // Plan validation
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'existing-sub-123',
            status: 'active',
            next_billing_at: new Date(Date.now() + 86400000).toISOString()
          }] 
        }); // Existing active subscription

      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'sub-duplicate-123')
        .send(validSubscriptionRequest);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Active subscription already exists for this creator',
        code: 'DUPLICATE_SUBSCRIPTION'
      });
    });

    it('should prevent self-subscription', async () => {
      const authToken = 'valid-token';
      
      const selfSubRequest = {
        ...validSubscriptionRequest,
        creatorId: mockUser.id // Same as authenticated user
      };

      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'self-sub-123')
        .send(selfSubRequest);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Cannot subscribe to yourself',
        code: 'SELF_SUBSCRIPTION_NOT_ALLOWED'
      });
    });

    it('should validate inactive plans', async () => {
      const authToken = 'valid-token';
      
      const inactivePlan = { ...mockPlan, is_active: false };
      
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [inactivePlan] }); // Inactive plan

      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'sub-inactive-plan-123')
        .send(validSubscriptionRequest);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Subscription plan is not active',
        code: 'INACTIVE_PLAN'
      });
    });
  });

  describe('Subscription Renewal Worker', () => {
    it('should process successful renewal', async () => {
      const subscriptionData = {
        id: 'sub-123',
        user_id: 'user-123',
        creator_id: 'creator-123',
        plan_id: 'plan-123',
        price_usdc: 9.99,
        status: 'active',
        next_billing_at: new Date(Date.now() - 1000), // Past due
        failure_count: 0,
        grace_period_ends_at: null
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [subscriptionData] }) // Get renewals due
        .mockResolvedValueOnce({ rows: [{ id: 'payment-456' }] }) // Create payment
        .mockResolvedValueOnce({ rows: [{ id: 'ledger-456' }] }) // Create earnings
        .mockResolvedValueOnce({}) // Update subscription (next billing)
        .mockResolvedValueOnce({}); // COMMIT

      const result = await processSubscriptionRenewal();

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);

      // Verify next billing date was updated (approximately 30 days from now)
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET next_billing_at'),
        expect.arrayContaining([
          expect.any(String), // next_billing_at
          'sub-123'
        ])
      );
    });

    it('should handle payment failures with dunning logic', async () => {
      const subscriptionData = {
        id: 'sub-123',
        user_id: 'user-123',
        creator_id: 'creator-123',
        plan_id: 'plan-123',
        price_usdc: 9.99,
        status: 'active',
        next_billing_at: new Date(Date.now() - 1000), // Past due
        failure_count: 1, // First failure
        grace_period_ends_at: null
      };

      // Mock payment failure
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [subscriptionData] }) // Get renewals due
        .mockRejectedValueOnce(new Error('Insufficient funds')) // Payment fails
        .mockResolvedValueOnce({}) // Update failure count
        .mockResolvedValueOnce({}); // COMMIT

      const result = await processSubscriptionRenewal();

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);

      // Verify failure count was incremented and grace period started
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET failure_count'),
        expect.arrayContaining([
          2, // incremented failure count
          expect.any(String), // grace_period_ends_at
          'sub-123'
        ])
      );
    });

    it('should cancel subscription after max failures', async () => {
      const subscriptionData = {
        id: 'sub-123',
        user_id: 'user-123',
        creator_id: 'creator-123',
        plan_id: 'plan-123',
        price_usdc: 9.99,
        status: 'active',
        next_billing_at: new Date(Date.now() - 1000),
        failure_count: 2, // At max failures (3rd attempt)
        grace_period_ends_at: new Date(Date.now() - 1000) // Grace period expired
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [subscriptionData] }) // Get renewals due
        .mockRejectedValueOnce(new Error('Insufficient funds')) // Payment fails again
        .mockResolvedValueOnce({}) // Cancel subscription
        .mockResolvedValueOnce({}); // COMMIT

      const result = await processSubscriptionRenewal();

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);

      // Verify subscription was canceled
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET status'),
        expect.arrayContaining([
          'canceled',
          expect.any(String), // canceled_at
          'Max renewal failures exceeded',
          'sub-123'
        ])
      );
    });

    it('should respect grace period for payment failures', async () => {
      const subscriptionData = {
        id: 'sub-123',
        user_id: 'user-123',
        creator_id: 'creator-123',
        plan_id: 'plan-123',
        price_usdc: 9.99,
        status: 'active',
        next_billing_at: new Date(Date.now() - 1000),
        failure_count: 1,
        grace_period_ends_at: new Date(Date.now() + 86400000) // Grace period still active
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [subscriptionData] }) // Get renewals due
        .mockRejectedValueOnce(new Error('Payment failed')) // Payment fails
        .mockResolvedValueOnce({}) // Update failure count (but don't cancel yet)
        .mockResolvedValueOnce({}); // COMMIT

      const result = await processSubscriptionRenewal();

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);

      // Subscription should NOT be canceled (grace period still active)
      expect(mockClient.query).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET status = $1'),
        expect.arrayContaining(['canceled'])
      );
    });

    it('should handle annual subscriptions correctly', async () => {
      const annualSubscriptionData = {
        id: 'sub-annual-123',
        user_id: 'user-123',
        creator_id: 'creator-123',
        plan_id: 'annual-plan-123',
        price_usdc: 99.99,
        cadence: 'annual',
        status: 'active',
        next_billing_at: new Date(Date.now() - 1000),
        failure_count: 0,
        grace_period_ends_at: null
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [annualSubscriptionData] }) // Get renewals due
        .mockResolvedValueOnce({ rows: [{ id: 'annual-payment-456' }] }) // Create payment
        .mockResolvedValueOnce({ rows: [{ id: 'annual-ledger-456' }] }) // Create earnings
        .mockResolvedValueOnce({}) // Update subscription
        .mockResolvedValueOnce({}); // COMMIT

      const result = await processSubscriptionRenewal();

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(1);

      // Verify next billing date is set to ~365 days from now for annual plan
      const nextBillingCall = (mockClient.query as any).mock.calls.find(
        call => call[0].includes('UPDATE subscriptions SET next_billing_at')
      );
      expect(nextBillingCall).toBeDefined();
      
      const nextBillingDate = new Date(nextBillingCall[1][0]);
      const expectedDate = new Date();
      expectedDate.setFullYear(expectedDate.getFullYear() + 1);
      
      // Allow 1 day tolerance
      expect(Math.abs(nextBillingDate.getTime() - expectedDate.getTime())).toBeLessThan(86400000);
    });

    it('should handle multiple subscriptions in batch', async () => {
      const subscriptions = [
        {
          id: 'sub-1',
          user_id: 'user-1',
          creator_id: 'creator-1',
          plan_id: 'plan-1',
          price_usdc: 5.99,
          status: 'active',
          next_billing_at: new Date(Date.now() - 1000),
          failure_count: 0
        },
        {
          id: 'sub-2',
          user_id: 'user-2',
          creator_id: 'creator-2',
          plan_id: 'plan-2',
          price_usdc: 9.99,
          status: 'active',
          next_billing_at: new Date(Date.now() - 2000),
          failure_count: 0
        }
      ];

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: subscriptions }) // Get renewals due
        // First subscription
        .mockResolvedValueOnce({ rows: [{ id: 'payment-1' }] }) // Payment 1
        .mockResolvedValueOnce({ rows: [{ id: 'ledger-1' }] }) // Earnings 1
        .mockResolvedValueOnce({}) // Update sub 1
        .mockResolvedValueOnce({}) // COMMIT 1
        // Second subscription
        .mockResolvedValueOnce({ rows: [{ id: 'payment-2' }] }) // Payment 2
        .mockResolvedValueOnce({ rows: [{ id: 'ledger-2' }] }) // Earnings 2
        .mockResolvedValueOnce({}) // Update sub 2
        .mockResolvedValueOnce({}); // COMMIT 2

      const result = await processSubscriptionRenewal();

      expect(result.processed).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should handle mixed success and failure scenarios', async () => {
      const subscriptions = [
        {
          id: 'sub-success',
          user_id: 'user-1',
          creator_id: 'creator-1',
          plan_id: 'plan-1',
          price_usdc: 5.99,
          status: 'active',
          next_billing_at: new Date(Date.now() - 1000),
          failure_count: 0
        },
        {
          id: 'sub-fail',
          user_id: 'user-2',
          creator_id: 'creator-2',
          plan_id: 'plan-2',
          price_usdc: 9.99,
          status: 'active',
          next_billing_at: new Date(Date.now() - 2000),
          failure_count: 1
        }
      ];

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: subscriptions }) // Get renewals due
        // First subscription (success)
        .mockResolvedValueOnce({ rows: [{ id: 'payment-success' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ledger-success' }] })
        .mockResolvedValueOnce({}) // Update successful sub
        .mockResolvedValueOnce({}) // COMMIT success
        // Second subscription (failure)
        .mockRejectedValueOnce(new Error('Payment failed'))
        .mockResolvedValueOnce({}) // Update failed sub
        .mockResolvedValueOnce({}); // COMMIT failure

      const result = await processSubscriptionRenewal();

      expect(result.processed).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should skip subscriptions not due for renewal', async () => {
      const subscriptions = [
        {
          id: 'sub-not-due',
          user_id: 'user-1',
          creator_id: 'creator-1',
          plan_id: 'plan-1',
          price_usdc: 5.99,
          status: 'active',
          next_billing_at: new Date(Date.now() + 86400000), // Tomorrow
          failure_count: 0
        }
      ];

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: subscriptions }); // Get renewals due

      const result = await processSubscriptionRenewal();

      expect(result.processed).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
    });
  });
});