import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { getDatabase } from '../config/database';
import { Pool, PoolClient } from 'pg';

// Import the worker function to test directly
import { processPayouts } from '../workers/payoutWorker';

vi.mock('../config/database', () => ({
  getDatabase: vi.fn(),
}));

describe('Payout Workflows', () => {
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

  describe('POST /api/payouts', () => {
    const validPayoutRequest = {
      amountUSDC: 50.00,
      payoutMethodId: '123e4567-e89b-12d3-a456-426614174001'
    };

    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174002',
      email: 'creator@example.com',
      isKYCVerified: true
    };

    const mockPayoutMethod = {
      id: '123e4567-e89b-12d3-a456-426614174001',
      user_id: mockUser.id,
      type: 'crypto',
      name: 'Primary Wallet',
      address: '0x742d35Cc7E58a5C7b5c1b65b4a8f61b0F5c9a8b7',
      is_verified: true,
      is_default: true
    };

    const mockBalance = {
      available_usdc: 75.50,
      pending_usdc: 25.00,
      today_usdc: 15.75
    };

    it('should successfully create a payout request', async () => {
      const authToken = 'valid-token';
      
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [mockBalance] }) // Get user balance
        .mockResolvedValueOnce({ rows: [mockPayoutMethod] }) // Get payout method
        .mockResolvedValueOnce({ rows: [{ id: 'payout-123' }] }) // Create payout request
        .mockResolvedValueOnce({}); // COMMIT

      const response = await request(app)
        .post('/api/payouts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'payout-request-123')
        .send(validPayoutRequest);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        payoutId: 'payout-123',
        status: 'pending',
        amountUSDC: 50.00,
        estimatedCompletion: expect.any(String)
      });

      // Verify payout record was created
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payouts'),
        expect.arrayContaining([
          mockUser.id,
          mockPayoutMethod.id,
          50.00,
          'pending',
          expect.any(String), // requested_at
          expect.any(Object) // metadata
        ])
      );
    });

    it('should enforce minimum payout threshold', async () => {
      const authToken = 'valid-token';
      
      const belowMinimumRequest = {
        ...validPayoutRequest,
        amountUSDC: 5.00 // Below $10 minimum
      };

      const response = await request(app)
        .post('/api/payouts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'payout-below-min-123')
        .send(belowMinimumRequest);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'amountUSDC',
            message: 'Minimum payout amount is $10'
          })
        ])
      );
    });

    it('should enforce maximum payout limits', async () => {
      const authToken = 'valid-token';
      
      const aboveMaximumRequest = {
        ...validPayoutRequest,
        amountUSDC: 75000.00 // Above $50,000 maximum
      };

      const response = await request(app)
        .post('/api/payouts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'payout-above-max-123')
        .send(aboveMaximumRequest);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'amountUSDC',
            message: 'Maximum payout amount is $50,000'
          })
        ])
      );
    });

    it('should check insufficient balance', async () => {
      const authToken = 'valid-token';
      
      const insufficientBalance = {
        available_usdc: 25.00, // Less than requested $50
        pending_usdc: 10.00,
        today_usdc: 5.00
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [insufficientBalance] }); // Get user balance

      const response = await request(app)
        .post('/api/payouts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'payout-insufficient-123')
        .send(validPayoutRequest);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Insufficient available balance',
        code: 'INSUFFICIENT_BALANCE',
        available: 25.00,
        requested: 50.00
      });
    });

    it('should require KYC verification for large payouts', async () => {
      const authToken = 'valid-token';
      
      const unverifiedUser = {
        ...mockUser,
        isKYCVerified: false
      };

      const largePayoutRequest = {
        ...validPayoutRequest,
        amountUSDC: 500.00 // Large amount requiring KYC
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [{ available_usdc: 600.00 }] }) // Sufficient balance
        .mockResolvedValueOnce({ rows: [mockPayoutMethod] }) // Valid payout method
        // Mock user KYC check returning false
        .mockResolvedValueOnce({ rows: [{ is_kyc_verified: false }] });

      const response = await request(app)
        .post('/api/payouts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'payout-kyc-required-123')
        .send(largePayoutRequest);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'KYC verification required for payouts over $100',
        code: 'KYC_REQUIRED'
      });
    });

    it('should validate payout method ownership', async () => {
      const authToken = 'valid-token';
      
      const otherUserPayoutMethod = {
        ...mockPayoutMethod,
        user_id: '123e4567-e89b-12d3-a456-426614174999' // Different user
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [mockBalance] }) // Get balance
        .mockResolvedValueOnce({ rows: [otherUserPayoutMethod] }); // Wrong user's method

      const response = await request(app)
        .post('/api/payouts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'payout-wrong-method-123')
        .send(validPayoutRequest);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: 'Payout method not found or not owned by user',
        code: 'UNAUTHORIZED_PAYOUT_METHOD'
      });
    });

    it('should require verified payout methods', async () => {
      const authToken = 'valid-token';
      
      const unverifiedPayoutMethod = {
        ...mockPayoutMethod,
        is_verified: false
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [mockBalance] }) // Get balance
        .mockResolvedValueOnce({ rows: [unverifiedPayoutMethod] }); // Unverified method

      const response = await request(app)
        .post('/api/payouts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'payout-unverified-method-123')
        .send(validPayoutRequest);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Payout method must be verified',
        code: 'UNVERIFIED_PAYOUT_METHOD'
      });
    });

    it('should enforce daily payout limits', async () => {
      const authToken = 'valid-token';
      
      // Mock existing payouts today totaling $400
      const todaysPayouts = {
        total_amount_today: 400.00
      };

      const largeRequest = {
        ...validPayoutRequest,
        amountUSDC: 700.00 // Would exceed daily limit of $1000
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [{ available_usdc: 800.00 }] }) // Sufficient balance
        .mockResolvedValueOnce({ rows: [mockPayoutMethod] }) // Valid method
        .mockResolvedValueOnce({ rows: [{ is_kyc_verified: true }] }) // KYC verified
        .mockResolvedValueOnce({ rows: [todaysPayouts] }); // Daily limit check

      const response = await request(app)
        .post('/api/payouts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'payout-daily-limit-123')
        .send(largeRequest);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Daily payout limit exceeded',
        code: 'DAILY_LIMIT_EXCEEDED',
        dailyLimit: 1000.00,
        todayTotal: 400.00,
        requested: 700.00
      });
    });
  });

  describe('Payout Processing Worker', () => {
    it('should process pending crypto payouts successfully', async () => {
      const pendingPayout = {
        id: 'payout-123',
        user_id: 'user-123',
        amount_usdc: 50.00,
        status: 'pending',
        payout_method: {
          type: 'crypto',
          address: '0x742d35Cc7E58a5C7b5c1b65b4a8f61b0F5c9a8b7'
        },
        requested_at: new Date(),
        metadata: {}
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [pendingPayout] }) // Get pending payouts
        .mockResolvedValueOnce({ rows: [{ hash: '0xabc123...' }] }) // Blockchain transaction
        .mockResolvedValueOnce({}) // Update payout status
        .mockResolvedValueOnce({}); // COMMIT

      const result = await processPayouts();

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);

      // Verify payout was marked as completed
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payouts SET status'),
        expect.arrayContaining([
          'completed',
          expect.any(String), // processed_at
          expect.objectContaining({ // metadata with transaction hash
            transaction_hash: '0xabc123...'
          }),
          'payout-123'
        ])
      );
    });

    it('should handle blockchain transaction failures', async () => {
      const pendingPayout = {
        id: 'payout-456',
        user_id: 'user-456',
        amount_usdc: 75.00,
        status: 'pending',
        payout_method: {
          type: 'crypto',
          address: '0x742d35Cc7E58a5C7b5c1b65b4a8f61b0F5c9a8b7'
        },
        requested_at: new Date(),
        failure_count: 0,
        metadata: {}
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [pendingPayout] }) // Get pending payouts
        .mockRejectedValueOnce(new Error('Insufficient gas')) // Blockchain failure
        .mockResolvedValueOnce({}) // Update failure count
        .mockResolvedValueOnce({}); // COMMIT

      const result = await processPayouts();

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);

      // Verify failure was recorded
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payouts SET failure_count'),
        expect.arrayContaining([
          1, // incremented failure count
          expect.any(String), // failure_reason
          'payout-456'
        ])
      );
    });

    it('should cancel payouts after max failures', async () => {
      const failedPayout = {
        id: 'payout-789',
        user_id: 'user-789',
        amount_usdc: 100.00,
        status: 'pending',
        payout_method: {
          type: 'crypto',
          address: '0x742d35Cc7E58a5C7b5c1b65b4a8f61b0F5c9a8b7'
        },
        requested_at: new Date(),
        failure_count: 2, // At max failures (3rd attempt)
        metadata: {}
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [failedPayout] }) // Get pending payouts
        .mockRejectedValueOnce(new Error('Network error')) // Another failure
        .mockResolvedValueOnce({}) // Cancel payout
        .mockResolvedValueOnce({}) // Restore user balance
        .mockResolvedValueOnce({}); // COMMIT

      const result = await processPayouts();

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);

      // Verify payout was canceled and balance restored
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payouts SET status = $1'),
        expect.arrayContaining([
          'failed',
          expect.any(String), // failed_at
          'Max retry attempts exceeded',
          'payout-789'
        ])
      );

      // Verify balance was restored
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE earnings_ledger'),
        expect.arrayContaining([
          100.00, // restored amount
          'user-789'
        ])
      );
    });

    it('should process bank transfer payouts', async () => {
      const bankPayout = {
        id: 'payout-bank-123',
        user_id: 'user-bank-123',
        amount_usdc: 250.00,
        status: 'pending',
        payout_method: {
          type: 'bank',
          account_number: '****1234',
          routing_number: '021000021'
        },
        requested_at: new Date(),
        metadata: {}
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [bankPayout] }) // Get pending payouts
        .mockResolvedValueOnce({ rows: [{ transfer_id: 'bank-transfer-456' }] }) // Bank transfer
        .mockResolvedValueOnce({}) // Update payout status
        .mockResolvedValueOnce({}); // COMMIT

      const result = await processPayouts();

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);

      // Verify bank transfer was initiated
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payouts SET status'),
        expect.arrayContaining([
          'processing', // Bank transfers go to processing first
          expect.any(String), // processed_at
          expect.objectContaining({
            transfer_id: 'bank-transfer-456'
          }),
          'payout-bank-123'
        ])
      );
    });

    it('should handle multiple payouts in batch', async () => {
      const payouts = [
        {
          id: 'payout-1',
          user_id: 'user-1',
          amount_usdc: 50.00,
          status: 'pending',
          payout_method: { type: 'crypto', address: '0xabc...' },
          requested_at: new Date(),
          metadata: {}
        },
        {
          id: 'payout-2',
          user_id: 'user-2',
          amount_usdc: 100.00,
          status: 'pending',
          payout_method: { type: 'crypto', address: '0xdef...' },
          requested_at: new Date(),
          metadata: {}
        }
      ];

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: payouts }) // Get pending payouts
        // First payout success
        .mockResolvedValueOnce({ rows: [{ hash: '0x111...' }] })
        .mockResolvedValueOnce({}) // Update status
        .mockResolvedValueOnce({}) // COMMIT
        // Second payout success
        .mockResolvedValueOnce({ rows: [{ hash: '0x222...' }] })
        .mockResolvedValueOnce({}) // Update status
        .mockResolvedValueOnce({}); // COMMIT

      const result = await processPayouts();

      expect(result.processed).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should skip payouts in processing status', async () => {
      const processingPayout = {
        id: 'payout-processing',
        user_id: 'user-123',
        amount_usdc: 50.00,
        status: 'processing', // Already being processed
        payout_method: { type: 'bank' },
        requested_at: new Date(),
        metadata: {}
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [processingPayout] }); // Get payouts

      const result = await processPayouts();

      expect(result.processed).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('GET /api/payouts/history', () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174002',
      email: 'creator@example.com'
    };

    it('should return user payout history', async () => {
      const authToken = 'valid-token';
      
      const mockPayouts = [
        {
          id: 'payout-1',
          amount_usdc: 50.00,
          status: 'completed',
          payout_method_name: 'Primary Wallet',
          requested_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          transaction_hash: '0xabc123...'
        },
        {
          id: 'payout-2',
          amount_usdc: 100.00,
          status: 'pending',
          payout_method_name: 'Bank Account',
          requested_at: new Date().toISOString(),
          processed_at: null,
          transaction_hash: null
        }
      ];

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: mockPayouts });

      const response = await request(app)
        .get('/api/payouts/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        payouts: expect.arrayContaining([
          expect.objectContaining({
            id: 'payout-1',
            amountUSDC: 50.00,
            status: 'completed',
            payoutMethodName: 'Primary Wallet',
            transactionHash: '0xabc123...'
          }),
          expect.objectContaining({
            id: 'payout-2',
            amountUSDC: 100.00,
            status: 'pending',
            payoutMethodName: 'Bank Account',
            transactionHash: null
          })
        ]),
        total: 2
      });
    });

    it('should return empty history for new users', async () => {
      const authToken = 'valid-token';
      
      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/payouts/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        payouts: [],
        total: 0
      });
    });
  });

  describe('GET /api/payouts/summary', () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174002',
      email: 'creator@example.com'
    };

    it('should return payout summary with balance info', async () => {
      const authToken = 'valid-token';
      
      const mockSummary = {
        available_usdc: 125.75,
        processing_usdc: 50.00,
        minimum_payout: 10.00,
        last_payout_at: new Date().toISOString()
      };

      (mockClient.query as any)
        .mockResolvedValueOnce({ rows: [mockSummary] });

      const response = await request(app)
        .get('/api/payouts/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        availableUSDC: 125.75,
        processingUSDC: 50.00,
        minimumPayout: 10.00,
        lastPayoutAt: expect.any(String)
      });
    });
  });
});