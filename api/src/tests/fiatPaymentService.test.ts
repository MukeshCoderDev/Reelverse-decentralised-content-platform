import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import FiatPaymentService from '../services/fiatPaymentService';
import crypto from 'crypto';

// Mock dependencies
jest.mock('axios');
jest.mock('../config/redis', () => ({
  RedisService: jest.fn(() => ({
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn()
  }))
}));

jest.mock('../services/usdcPaymentService', () => ({
  default: jest.fn(() => ({
    confirmPayment: jest.fn().mockResolvedValue('test-entitlement-id')
  }))
}));

describe('FiatPaymentService', () => {
  let fiatPaymentService: FiatPaymentService;
  let mockRedisService: any;

  beforeEach(() => {
    // Reset environment variables
    process.env.CCBILL_CLIENT_ACCOUNT = '123456';
    process.env.CCBILL_CLIENT_SUBACCOUNT = '0000';
    process.env.CCBILL_FORM_NAME = 'cc_form';
    process.env.CCBILL_SALT = 'test-salt';
    process.env.CCBILL_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.SEGPAY_PACKAGE_ID = 'test-package';
    process.env.SEGPAY_MERCHANT_ID = 'test-merchant';
    process.env.SEGPAY_API_KEY = 'test-api-key';
    process.env.SEGPAY_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.FRONTEND_URL = 'https://test.reelverse.com';

    fiatPaymentService = new FiatPaymentService();
    mockRedisService = (fiatPaymentService as any).redisService;
  });

  describe('createFiatCheckout', () => {
    it('should create checkout session successfully', async () => {
      // Mock Redis set operation
      mockRedisService.set.mockResolvedValue(true);

      const request = {
        contentId: '123',
        userAddress: '0x1234567890123456789012345678901234567890',
        userEmail: 'test@example.com'
      };

      const result = await fiatPaymentService.createFiatCheckout(request);

      expect(result.success).toBe(true);
      expect(result.hostedUrl).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(mockRedisService.set).toHaveBeenCalledTimes(2); // Once for initial session, once for updated session
    });

    it('should handle content not found error', async () => {
      // Mock getContentInfo to return null
      (fiatPaymentService as any).getContentInfo = jest.fn().mockResolvedValue(null);

      const request = {
        contentId: '999',
        userAddress: '0x1234567890123456789012345678901234567890'
      };

      const result = await fiatPaymentService.createFiatCheckout(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Content not found');
    });

    it('should handle unapproved content', async () => {
      // Mock getContentInfo to return unapproved content
      (fiatPaymentService as any).getContentInfo = jest.fn().mockResolvedValue({
        priceUSDC: BigInt('5000000'),
        moderationStatus: 0 // Pending, not approved
      });

      const request = {
        contentId: '123',
        userAddress: '0x1234567890123456789012345678901234567890'
      };

      const result = await fiatPaymentService.createFiatCheckout(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Content not available for purchase');
    });
  });

  describe('handleWebhook', () => {
    it('should process CCBill webhook successfully', async () => {
      const sessionId = 'test-session-123';
      const mockSession = {
        contentId: '123',
        userAddress: '0x1234567890123456789012345678901234567890',
        status: 'pending'
      };

      // Mock Redis operations
      mockRedisService.get.mockResolvedValue(mockSession);
      mockRedisService.set.mockResolvedValue(true);

      // Mock webhook payload
      const webhookPayload = {
        eventType: 'NewSaleSuccess',
        subscription_id: 'ccbill-123',
        zc_orderNumber: sessionId,
        billedInitialPrice: '5.00',
        billedCurrencyCode: 'USD',
        account_number: '123456',
        subaccount_number: '0000',
        responseDigest: this.generateCCBillHash('ccbill-123', '123456', '0000')
      };

      const result = await fiatPaymentService.handleWebhook('ccbill', webhookPayload);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Webhook processed');
      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('should reject webhook with invalid signature', async () => {
      const webhookPayload = {
        eventType: 'NewSaleSuccess',
        subscription_id: 'ccbill-123',
        zc_orderNumber: 'test-session-123',
        responseDigest: 'invalid-hash'
      };

      const result = await fiatPaymentService.handleWebhook('ccbill', webhookPayload);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid signature');
    });

    it('should handle session not found', async () => {
      // Mock Redis to return null (session not found)
      mockRedisService.get.mockResolvedValue(null);

      const webhookPayload = {
        eventType: 'NewSaleSuccess',
        subscription_id: 'ccbill-123',
        zc_orderNumber: 'non-existent-session',
        account_number: '123456',
        subaccount_number: '0000',
        responseDigest: this.generateCCBillHash('ccbill-123', '123456', '0000')
      };

      const result = await fiatPaymentService.handleWebhook('ccbill', webhookPayload);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Session not found');
    });
  });

  describe('getPaymentSession', () => {
    it('should return payment session successfully', async () => {
      const sessionId = 'test-session-123';
      const mockSession = {
        contentId: '123',
        userAddress: '0x1234567890123456789012345678901234567890',
        status: 'pending',
        priceUSD: 5.00
      };

      mockRedisService.get.mockResolvedValue(mockSession);

      const result = await fiatPaymentService.getPaymentSession(sessionId);

      expect(result).toEqual(mockSession);
      expect(mockRedisService.get).toHaveBeenCalledWith(`fiat_session:${sessionId}`);
    });

    it('should return null for non-existent session', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await fiatPaymentService.getPaymentSession('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('cancelPaymentSession', () => {
    it('should cancel payment session successfully', async () => {
      const sessionId = 'test-session-123';
      const mockSession = {
        contentId: '123',
        userAddress: '0x1234567890123456789012345678901234567890',
        status: 'pending'
      };

      mockRedisService.get.mockResolvedValue(mockSession);
      mockRedisService.set.mockResolvedValue(true);

      const result = await fiatPaymentService.cancelPaymentSession(sessionId);

      expect(result).toBe(true);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `fiat_session:${sessionId}`,
        { ...mockSession, status: 'cancelled' },
        86400
      );
    });

    it('should return false for non-existent session', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await fiatPaymentService.cancelPaymentSession('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getAvailablePaymentMethods', () => {
    it('should return available payment methods for valid content', async () => {
      const result = await fiatPaymentService.getAvailablePaymentMethods(
        '0x1234567890123456789012345678901234567890',
        '123'
      );

      expect(result).toEqual({
        usdc: true,
        fiat: true,
        providers: ['ccbill', 'segpay']
      });
    });
  });

  // Helper method to generate CCBill hash for testing
  generateCCBillHash(subscriptionId: string, accountNumber: string, subaccountNumber: string): string {
    const dataString = `${subscriptionId}${accountNumber}${subaccountNumber}test-webhook-secret`;
    return crypto.createHash('md5').update(dataString).digest('hex');
  }
});