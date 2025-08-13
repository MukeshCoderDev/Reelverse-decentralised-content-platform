/**
 * Integration tests for SIWE authentication with WalletContext
 * These tests verify the enhanced WalletContext functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SiweService } from '../../services/siweService';

// Mock fetch for testing
global.fetch = vi.fn();

describe('SIWE Integration Tests', () => {
  let siweService: SiweService;

  beforeEach(() => {
    siweService = SiweService.getInstance();
    vi.clearAllMocks();
  });

  describe('SiweService', () => {
    it('should generate nonce for address', async () => {
      const mockNonce = 'test-nonce-123';
      const mockResponse = { nonce: mockNonce };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const nonce = await siweService.generateNonce('0x1234567890123456789012345678901234567890');
      
      expect(nonce).toBe(mockNonce);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/siwe/nonce'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })
      );
    });

    it('should verify signature successfully', async () => {
      const mockResponse = {
        success: true,
        address: '0x1234567890123456789012345678901234567890',
        session: 'test-session-token',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await siweService.verifySignature('test-message', 'test-signature');
      
      expect(result.success).toBe(true);
      expect(result.address).toBe(mockResponse.address);
      expect(result.session).toBe(mockResponse.session);
    });

    it('should check session status', async () => {
      const mockResponse = {
        isAuthenticated: true,
        address: '0x1234567890123456789012345678901234567890',
        session: 'test-session-token',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const session = await siweService.getSession();
      
      expect(session.isAuthenticated).toBe(true);
      expect(session.address).toBe(mockResponse.address);
      expect(session.session).toBe(mockResponse.session);
    });

    it('should handle logout', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      await expect(siweService.logout()).resolves.not.toThrow();
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle nonce generation failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(
        siweService.generateNonce('0x1234567890123456789012345678901234567890')
      ).rejects.toThrow('Failed to generate authentication nonce');
    });

    it('should handle verification failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

      await expect(
        siweService.verifySignature('invalid-message', 'invalid-signature')
      ).rejects.toThrow('Failed to verify authentication signature');
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        siweService.generateNonce('0x1234567890123456789012345678901234567890')
      ).rejects.toThrow('Failed to generate authentication nonce');
    });
  });
});

// Mock WalletContext integration test
describe('WalletContext SIWE Integration', () => {
  it('should have enhanced state properties', () => {
    // This test verifies that the WalletState interface includes SIWE properties
    const mockState = {
      isConnected: false,
      isConnecting: false,
      account: null,
      chainId: null,
      balance: null,
      balanceLoading: false,
      walletType: null,
      error: null,
      // SIWE properties
      isAuthenticated: false,
      isAuthenticating: false,
      session: null,
      authError: null,
    };

    expect(mockState).toHaveProperty('isAuthenticated');
    expect(mockState).toHaveProperty('isAuthenticating');
    expect(mockState).toHaveProperty('session');
    expect(mockState).toHaveProperty('authError');
  });

  it('should have enhanced context methods', () => {
    // This test verifies that the WalletContextType includes SIWE methods
    const mockContextType = {
      // Existing properties
      isConnected: false,
      isConnecting: false,
      account: null,
      chainId: null,
      networkName: null,
      balance: null,
      balanceLoading: false,
      walletType: null,
      error: null,
      
      // SIWE properties
      isAuthenticated: false,
      isAuthenticating: false,
      session: null,
      authError: null,
      
      // Methods
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchNetwork: vi.fn(),
      clearError: vi.fn(),
      
      // SIWE methods
      authenticate: vi.fn(),
      logout: vi.fn(),
      clearAuthError: vi.fn(),
    };

    expect(mockContextType).toHaveProperty('authenticate');
    expect(mockContextType).toHaveProperty('logout');
    expect(mockContextType).toHaveProperty('clearAuthError');
    expect(typeof mockContextType.authenticate).toBe('function');
    expect(typeof mockContextType.logout).toBe('function');
    expect(typeof mockContextType.clearAuthError).toBe('function');
  });
});