/**
 * Tests for Content Access Control Service and Integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentAccessService } from '../../services/contentAccessService';

// Mock fetch for testing
global.fetch = vi.fn();

describe('Content Access Service Tests', () => {
  let contentAccessService: ContentAccessService;

  beforeEach(() => {
    contentAccessService = ContentAccessService.getInstance();
    vi.clearAllMocks();
  });

  describe('checkAccess', () => {
    it('should check access for content successfully', async () => {
      const mockAccessResult = {
        allowed: true,
        reasons: [],
        accessToken: 'token123',
        expiresAt: '2024-12-31T23:59:59Z',
        watermarkId: 'watermark123'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAccessResult }),
      });

      const result = await contentAccessService.checkAccess({
        contentId: 'content123',
        userAddress: '0x1234567890123456789012345678901234567890',
        sessionId: 'session123'
      });

      expect(result).toEqual(mockAccessResult);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/content/content123/access'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: '0x1234567890123456789012345678901234567890',
            sessionId: 'session123'
          }),
          credentials: 'include',
        })
      );
    });

    it('should handle access denied with reasons', async () => {
      const mockAccessResult = {
        allowed: false,
        reasons: [
          {
            type: 'age_verification',
            message: 'Age verification required',
            details: { currentStatus: 'none' }
          },
          {
            type: 'entitlement_required',
            message: 'Purchase required',
            details: { entitlementType: 'ppv', price: '10.00' }
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAccessResult }),
      });

      const result = await contentAccessService.checkAccess({
        contentId: 'content123',
        userAddress: '0x1234567890123456789012345678901234567890'
      });

      expect(result.allowed).toBe(false);
      expect(result.reasons).toHaveLength(2);
      expect(result.reasons[0].type).toBe('age_verification');
      expect(result.reasons[1].type).toBe('entitlement_required');
    });

    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid request' })
      });

      await expect(
        contentAccessService.checkAccess({
          contentId: 'content123',
          userAddress: '0x1234567890123456789012345678901234567890'
        })
      ).rejects.toThrow('Invalid request');
    });
  });

  describe('getPlaybackToken', () => {
    it('should get playback token successfully', async () => {
      const mockTokenResult = {
        hlsUrl: 'https://stream.example.com/content123/playlist.m3u8',
        token: 'playback_token_123',
        watermarkId: '0x1234...7890',
        expiresAt: '2024-12-31T23:59:59Z',
        sessionId: 'session123'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTokenResult }),
      });

      const result = await contentAccessService.getPlaybackToken({
        contentId: 'content123',
        userAddress: '0x1234567890123456789012345678901234567890',
        accessToken: 'access_token_123',
        sessionId: 'session123'
      });

      expect(result).toEqual(mockTokenResult);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/content/playback-token'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            contentId: 'content123',
            userAddress: '0x1234567890123456789012345678901234567890',
            accessToken: 'access_token_123',
            sessionId: 'session123'
          })
        })
      );
    });

    it('should handle invalid access token', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Invalid or expired access token' })
      });

      await expect(
        contentAccessService.getPlaybackToken({
          contentId: 'content123',
          userAddress: '0x1234567890123456789012345678901234567890',
          accessToken: 'invalid_token'
        })
      ).rejects.toThrow('Invalid or expired access token');
    });
  });

  describe('getContentRequirements', () => {
    it('should get content requirements', async () => {
      const mockRequirements = {
        ageVerificationRequired: true,
        geographicRestrictions: ['US', 'UK'],
        entitlementRequired: true,
        entitlementType: 'ppv',
        price: '10.00',
        currency: 'USDC'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockRequirements }),
      });

      const result = await contentAccessService.getContentRequirements('content123');

      expect(result).toEqual(mockRequirements);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/content/content123/requirements'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('getAuthorizedPlayback', () => {
    it('should complete full authorization flow', async () => {
      const mockAccessResult = {
        allowed: true,
        reasons: [],
        accessToken: 'access_token_123',
        expiresAt: '2024-12-31T23:59:59Z',
        watermarkId: 'watermark123'
      };

      const mockPlaybackResult = {
        hlsUrl: 'https://stream.example.com/content123/playlist.m3u8',
        token: 'playback_token_123',
        watermarkId: '0x1234...7890',
        expiresAt: '2024-12-31T23:59:59Z',
        sessionId: 'session123'
      };

      // Mock access check
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAccessResult }),
      });

      // Mock playback token
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockPlaybackResult }),
      });

      const result = await contentAccessService.getAuthorizedPlayback(
        'content123',
        '0x1234567890123456789012345678901234567890',
        'session123'
      );

      expect(result.success).toBe(true);
      expect(result.playbackData).toEqual(mockPlaybackResult);
      expect(result.accessResult).toEqual(mockAccessResult);
    });

    it('should handle access denied', async () => {
      const mockAccessResult = {
        allowed: false,
        reasons: [
          {
            type: 'age_verification',
            message: 'Age verification required'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAccessResult }),
      });

      const result = await contentAccessService.getAuthorizedPlayback(
        'content123',
        '0x1234567890123456789012345678901234567890'
      );

      expect(result.success).toBe(false);
      expect(result.accessResult).toEqual(mockAccessResult);
      expect(result.playbackData).toBeUndefined();
    });
  });

  describe('Utility Methods', () => {
    it('should generate access denial messages correctly', () => {
      const testCases = [
        {
          reasons: [{ type: 'age_verification', message: 'Age verification required' }],
          expected: 'Age verification required. You must be 18+ to view this content.'
        },
        {
          reasons: [{ type: 'geographic_restriction', message: 'Not available in region' }],
          expected: 'This content is not available in your region.'
        },
        {
          reasons: [{ 
            type: 'entitlement_required', 
            message: 'Purchase required',
            details: { entitlementType: 'ppv', price: '10.00' }
          }],
          expected: 'Purchase required ($10.00) to view this content.'
        },
        {
          reasons: [{ 
            type: 'entitlement_required', 
            message: 'Subscription required',
            details: { entitlementType: 'subscription' }
          }],
          expected: 'Subscription required to view this content.'
        },
        {
          reasons: [{ type: 'content_unavailable', message: 'Content not found' }],
          expected: 'This content is currently unavailable.'
        }
      ];

      testCases.forEach(({ reasons, expected }) => {
        const message = contentAccessService.getAccessDenialMessage(reasons as any);
        expect(message).toBe(expected);
      });
    });

    it('should generate suggested actions correctly', () => {
      const reasons = [
        { type: 'age_verification', message: 'Age verification required' },
        { type: 'entitlement_required', message: 'Purchase required', details: { entitlementType: 'ppv' } }
      ];

      const actions = contentAccessService.getSuggestedActions(reasons as any);

      expect(actions).toHaveLength(2);
      expect(actions[0]).toEqual({
        action: 'verify_age',
        label: 'Verify Age',
        type: 'primary'
      });
      expect(actions[1]).toEqual({
        action: 'purchase_content',
        label: 'Purchase Content',
        type: 'primary'
      });
    });

    it('should check action needs correctly', async () => {
      // Mock access check (denied)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            allowed: false,
            reasons: [
              { type: 'age_verification', message: 'Age verification required' },
              { type: 'entitlement_required', message: 'Purchase required', details: { entitlementType: 'ppv' } }
            ]
          }
        }),
      });

      // Mock requirements
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ageVerificationRequired: true,
            entitlementRequired: true,
            entitlementType: 'ppv'
          }
        }),
      });

      const result = await contentAccessService.needsAction(
        'content123',
        '0x1234567890123456789012345678901234567890'
      );

      expect(result.needsAction).toBe(true);
      expect(result.actions).toEqual(['verify_age', 'purchase']);
      expect(result.requirements.ageVerificationRequired).toBe(true);
    });

    it('should generate and parse session IDs', () => {
      const sessionId = contentAccessService.generateSessionId();
      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
    });

    it('should validate token expiry', () => {
      const futureDate = new Date(Date.now() + 60000).toISOString(); // 1 minute from now
      const pastDate = new Date(Date.now() - 60000).toISOString(); // 1 minute ago

      expect(contentAccessService.isTokenValid(futureDate)).toBe(true);
      expect(contentAccessService.isTokenValid(pastDate)).toBe(false);
    });

    it('should format time remaining correctly', () => {
      expect(contentAccessService.formatTimeRemaining(3661000)).toBe('1h 1m'); // 1h 1m 1s
      expect(contentAccessService.formatTimeRemaining(61000)).toBe('1m 1s'); // 1m 1s
      expect(contentAccessService.formatTimeRemaining(30000)).toBe('30s'); // 30s
    });

    it('should parse watermark IDs', () => {
      const mockWatermarkData = {
        address: '0x1234...7890',
        session: 'sess123',
        timestamp: 1640995200000
      };

      const watermarkId = btoa(JSON.stringify(mockWatermarkData));
      const parsed = contentAccessService.parseWatermarkId(watermarkId);

      expect(parsed).toEqual(mockWatermarkData);
    });

    it('should handle invalid watermark IDs', () => {
      const invalidWatermarkId = 'invalid_base64';
      const parsed = contentAccessService.parseWatermarkId(invalidWatermarkId);

      expect(parsed).toBeNull();
    });
  });
});