/**
 * Tests for Age Verification Service and Integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgeVerificationService } from '../../services/ageVerificationService';

// Mock fetch for testing
global.fetch = vi.fn();

describe('Age Verification Service Tests', () => {
  let ageVerificationService: AgeVerificationService;

  beforeEach(() => {
    ageVerificationService = AgeVerificationService.getInstance();
    vi.clearAllMocks();
  });

  describe('getVerificationStatus', () => {
    it('should get verification status for address', async () => {
      const mockStatus = {
        address: '0x1234567890123456789012345678901234567890',
        status: 'verified',
        provider: 'persona',
        verifiedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2025-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockStatus }),
      });

      const status = await ageVerificationService.getVerificationStatus('0x1234567890123456789012345678901234567890');
      
      expect(status).toEqual(mockStatus);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/age-verification/status/0x1234567890123456789012345678901234567890'),
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(
        ageVerificationService.getVerificationStatus('0x1234567890123456789012345678901234567890')
      ).rejects.toThrow('Failed to get age verification status');
    });
  });

  describe('startVerification', () => {
    it('should start verification process', async () => {
      const mockResponse = {
        inquiryId: 'inq_123',
        verificationUrl: 'https://withpersona.com/verify?inquiry-id=inq_123',
        provider: 'persona'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse }),
      });

      const result = await ageVerificationService.startVerification('0x1234567890123456789012345678901234567890');
      
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/age-verification/start'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: '0x1234567890123456789012345678901234567890' }),
          credentials: 'include',
        })
      );
    });

    it('should include reference ID when provided', async () => {
      const mockResponse = {
        inquiryId: 'inq_123',
        verificationUrl: 'https://withpersona.com/verify?inquiry-id=inq_123',
        provider: 'persona'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse }),
      });

      await ageVerificationService.startVerification('0x1234567890123456789012345678901234567890', 'ref_123');
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/age-verification/start'),
        expect.objectContaining({
          body: JSON.stringify({ 
            address: '0x1234567890123456789012345678901234567890',
            referenceId: 'ref_123'
          }),
        })
      );
    });
  });

  describe('checkSBTEligibility', () => {
    it('should check SBT eligibility', async () => {
      const mockResponse = {
        eligible: true,
        address: '0x1234567890123456789012345678901234567890'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse }),
      });

      const result = await ageVerificationService.checkSBTEligibility('0x1234567890123456789012345678901234567890');
      
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Utility Methods', () => {
    it('should return correct status messages', () => {
      const testCases = [
        { status: 'none', expected: 'Age verification required' },
        { status: 'pending', expected: 'Age verification in progress' },
        { status: 'verified', expected: 'Age verified' },
        { status: 'failed', expected: 'Age verification failed: Test reason' },
        { status: 'expired', expected: 'Age verification expired - please verify again' },
      ];

      testCases.forEach(({ status, expected }) => {
        const mockStatus = {
          address: '0x123',
          status: status as any,
          provider: 'persona' as const,
          failureReason: status === 'failed' ? 'Test reason' : undefined
        };

        const message = ageVerificationService.getStatusMessage(mockStatus);
        expect(message).toBe(expected);
      });
    });

    it('should return correct status colors', () => {
      const testCases = [
        { status: 'verified', expected: '#28a745' },
        { status: 'pending', expected: '#ffc107' },
        { status: 'failed', expected: '#dc3545' },
        { status: 'expired', expected: '#dc3545' },
        { status: 'none', expected: '#6c757d' },
      ];

      testCases.forEach(({ status, expected }) => {
        const mockStatus = {
          address: '0x123',
          status: status as any,
          provider: 'persona' as const
        };

        const color = ageVerificationService.getStatusColor(mockStatus);
        expect(color).toBe(expected);
      });
    });

    it('should determine verification need correctly', async () => {
      // Mock verified status
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          data: { status: 'verified', address: '0x123', provider: 'persona' }
        }),
      });

      const needsVerification1 = await ageVerificationService.needsVerification('0x123');
      expect(needsVerification1).toBe(false);

      // Mock unverified status
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          data: { status: 'none', address: '0x123', provider: 'persona' }
        }),
      });

      const needsVerification2 = await ageVerificationService.needsVerification('0x123');
      expect(needsVerification2).toBe(true);
    });
  });

  describe('Popup Management', () => {
    it('should handle popup opening', async () => {
      // Mock window.open
      const mockPopup = {
        closed: false,
        close: vi.fn()
      };
      
      global.window.open = vi.fn().mockReturnValue(mockPopup);

      const verificationUrl = 'https://withpersona.com/verify?inquiry-id=test';
      
      // Simulate popup closing after 2 seconds
      setTimeout(() => {
        mockPopup.closed = true;
      }, 100);

      const result = await ageVerificationService.openVerificationPopup(verificationUrl);
      
      expect(result).toBe(true);
      expect(window.open).toHaveBeenCalledWith(
        verificationUrl,
        'persona-verification',
        'width=500,height=700,scrollbars=yes,resizable=yes'
      );
    });

    it('should handle popup blocked', async () => {
      global.window.open = vi.fn().mockReturnValue(null);

      const verificationUrl = 'https://withpersona.com/verify?inquiry-id=test';
      
      await expect(
        ageVerificationService.openVerificationPopup(verificationUrl)
      ).rejects.toThrow('Failed to open verification popup');
    });
  });

  describe('Status Polling', () => {
    it('should poll until verification completes', async () => {
      let callCount = 0;
      
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        const status = callCount < 3 ? 'pending' : 'verified';
        
        return Promise.resolve({
          ok: true,
          json: async () => ({ 
            success: true, 
            data: { status, address: '0x123', provider: 'persona' }
          }),
        });
      });

      const onStatusChange = vi.fn();
      
      const result = await ageVerificationService.pollVerificationStatus(
        '0x123',
        onStatusChange,
        5, // maxAttempts
        100 // intervalMs
      );

      expect(result.status).toBe('verified');
      expect(onStatusChange).toHaveBeenCalledTimes(3);
      expect(callCount).toBe(3);
    });

    it('should timeout after max attempts', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ 
          success: true, 
          data: { status: 'pending', address: '0x123', provider: 'persona' }
        }),
      });

      await expect(
        ageVerificationService.pollVerificationStatus(
          '0x123',
          undefined,
          2, // maxAttempts
          50 // intervalMs
        )
      ).rejects.toThrow('Verification polling timeout');
    });
  });
});