import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import USDCPaymentService from '../services/usdcPaymentService';

// Mock dependencies
jest.mock('viem', () => ({
  createPublicClient: jest.fn(() => ({
    readContract: jest.fn(),
    waitForTransactionReceipt: jest.fn()
  })),
  createWalletClient: jest.fn(() => ({
    writeContract: jest.fn()
  })),
  http: jest.fn(),
  parseUnits: jest.fn(),
  formatUnits: jest.fn(),
  polygon: {}
}));

jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn(() => ({ address: '0x123' }))
}));

jest.mock('../config/redis', () => ({
  RedisService: jest.fn(() => ({
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn()
  }))
}));

describe('USDCPaymentService', () => {
  let paymentService: USDCPaymentService;

  beforeEach(() => {
    // Reset environment variables
    process.env.USDC_CONTRACT_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
    process.env.REVENUE_SPLITTER_ADDRESS = '0x1234567890123456789012345678901234567890';
    process.env.NFT_ACCESS_ADDRESS = '0x2345678901234567890123456789012345678901';
    process.env.CONTENT_REGISTRY_ADDRESS = '0x3456789012345678901234567890123456789012';
    process.env.PLATFORM_WALLET_ADDRESS = '0x4567890123456789012345678901234567890123';
    process.env.PLATFORM_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
    process.env.POLYGON_RPC_URL = 'https://polygon-rpc.com';

    paymentService = new USDCPaymentService();
  });

  describe('prepareUSDCCheckout', () => {
    it('should prepare checkout data for valid content', async () => {
      // Mock content registry response
      const mockContent = [
        '0x1234567890123456789012345678901234567890', // creator
        '0x2345678901234567890123456789012345678901', // splitter
        'ipfs://metadata', // metaURI
        '0x1234567890123456789012345678901234567890123456789012345678901234', // perceptualHash
        0xFFFFFFFF, // geoMask
        BigInt('1000000'), // priceUSDC (1 USDC)
        0, // storageClass
        1, // moderationStatus (approved)
        BigInt(Date.now()), // createdAt
        BigInt(0), // totalSales
        BigInt(0) // viewCount
      ];

      // Mock allowance check
      const mockAllowance = BigInt('0');

      const mockPublicClient = {
        readContract: jest.fn()
          .mockResolvedValueOnce(mockContent) // getContent call
          .mockResolvedValueOnce(mockAllowance) // allowance call
      };

      // Replace the public client
      (paymentService as any).publicClient = mockPublicClient;

      const result = await paymentService.prepareUSDCCheckout('123', '0x1234567890123456789012345678901234567890');

      expect(result).toEqual({
        requiresPermit: true,
        spenderAddress: process.env.PLATFORM_WALLET_ADDRESS,
        amount: '1000000',
        calldata: expect.any(String)
      });

      expect(mockPublicClient.readContract).toHaveBeenCalledTimes(2);
    });

    it('should throw error for non-existent content', async () => {
      const mockPublicClient = {
        readContract: jest.fn().mockRejectedValue(new Error('Content not found'))
      };

      (paymentService as any).publicClient = mockPublicClient;

      await expect(
        paymentService.prepareUSDCCheckout('999', '0x1234567890123456789012345678901234567890')
      ).rejects.toThrow('Content not found');
    });

    it('should throw error for unapproved content', async () => {
      const mockContent = [
        '0x1234567890123456789012345678901234567890',
        '0x2345678901234567890123456789012345678901',
        'ipfs://metadata',
        '0x1234567890123456789012345678901234567890123456789012345678901234',
        0xFFFFFFFF,
        BigInt('1000000'),
        0,
        0, // moderationStatus (pending, not approved)
        BigInt(Date.now()),
        BigInt(0),
        BigInt(0)
      ];

      const mockPublicClient = {
        readContract: jest.fn().mockResolvedValue(mockContent)
      };

      (paymentService as any).publicClient = mockPublicClient;

      await expect(
        paymentService.prepareUSDCCheckout('123', '0x1234567890123456789012345678901234567890')
      ).rejects.toThrow('Content not available for purchase');
    });
  });

  describe('getPaymentStatus', () => {
    it('should return correct status for user with access', async () => {
      const mockPublicClient = {
        readContract: jest.fn().mockResolvedValue(true) // hasAccess returns true
      };

      (paymentService as any).publicClient = mockPublicClient;

      const result = await paymentService.getPaymentStatus('123', '0x1234567890123456789012345678901234567890');

      expect(result).toEqual({
        hasPaid: true,
        hasAccess: true,
        entitlementId: '123_0x1234567890123456789012345678901234567890'
      });
    });

    it('should return correct status for user without access', async () => {
      const mockPublicClient = {
        readContract: jest.fn().mockResolvedValue(false) // hasAccess returns false
      };

      (paymentService as any).publicClient = mockPublicClient;

      const result = await paymentService.getPaymentStatus('123', '0x1234567890123456789012345678901234567890');

      expect(result).toEqual({
        hasPaid: false,
        hasAccess: false
      });
    });
  });

  describe('confirmPayment', () => {
    it('should confirm payment for user with access', async () => {
      const mockPublicClient = {
        readContract: jest.fn().mockResolvedValue(true) // hasAccess returns true
      };

      (paymentService as any).publicClient = mockPublicClient;

      const result = await paymentService.confirmPayment('123', '0x1234567890123456789012345678901234567890', 'provider-ref');

      expect(result).toBe('123_0x1234567890123456789012345678901234567890_confirmed');
    });

    it('should throw error for user without access', async () => {
      const mockPublicClient = {
        readContract: jest.fn().mockResolvedValue(false) // hasAccess returns false
      };

      (paymentService as any).publicClient = mockPublicClient;

      await expect(
        paymentService.confirmPayment('123', '0x1234567890123456789012345678901234567890', 'provider-ref')
      ).rejects.toThrow('Payment not confirmed on blockchain');
    });
  });
});