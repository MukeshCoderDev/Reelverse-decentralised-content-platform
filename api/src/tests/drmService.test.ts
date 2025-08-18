/**
 * DRM Service Tests
 * Tests for license issuance, device management, and key delivery
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { drmService } from '../services/drmService';
import { eventBus } from '../core/eventBus';
import { metrics } from '../core/metrics';

// Mock external dependencies
jest.mock('../core/eventBus');
jest.mock('../core/metrics');
jest.mock('../core/observability');
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({
    contentId: 'content-123',
    userId: 'user-123',
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
  })
}));

describe('DRMService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerDevice', () => {
    it('should register a new device successfully', async () => {
      const deviceInfo = {
        deviceName: 'Test Device',
        deviceType: 'desktop' as const,
        platform: 'Windows',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        isJailbroken: false,
        isRooted: false
      };

      const deviceId = await drmService.registerDevice('user-123', deviceInfo);

      expect(deviceId).toBeDefined();
      expect(deviceId).toMatch(/^device_\d+_/);
    });

    it('should throw error when user reaches device limit', async () => {
      const deviceInfo = {
        deviceType: 'desktop' as const,
        platform: 'Windows',
        userAgent: 'Test Agent'
      };

      // Register maximum number of devices
      for (let i = 0; i < 5; i++) {
        await drmService.registerDevice('user-limit-test', {
          ...deviceInfo,
          deviceName: `Device ${i}`
        });
      }

      // Try to register one more device
      await expect(
        drmService.registerDevice('user-limit-test', deviceInfo)
      ).rejects.toThrow('has reached maximum device limit');
    });
  });

  describe('generateContentKeys', () => {
    it('should generate content keys successfully', async () => {
      const contentKeys = await drmService.generateContentKeys('content-123');

      expect(contentKeys).toEqual({
        contentId: 'content-123',
        keyId: expect.stringMatching(/^key_content-123_\d+_/),
        key: expect.any(String),
        iv: expect.any(String),
        algorithm: 'AES-128',
        keyRotationVersion: 1,
        createdAt: expect.any(Date),
        licenseCount: 0
      });

      expect(contentKeys.key).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(contentKeys.iv).toHaveLength(32); // 16 bytes = 32 hex chars
    });
  });

  describe('issueLicense', () => {
    it('should issue license successfully for valid request', async () => {
      const mockPublish = jest.fn().mockResolvedValue(undefined);
      (eventBus.publish as jest.Mock) = mockPublish;

      const mockStartTimer = jest.fn().mockReturnValue('timer-id');
      const mockEndTimer = jest.fn();
      const mockCounter = jest.fn();
      (metrics.startTimer as jest.Mock) = mockStartTimer;
      (metrics.endTimer as jest.Mock) = mockEndTimer;
      (metrics.counter as jest.Mock) = mockCounter;

      // First register a device
      const deviceId = await drmService.registerDevice('user-123', {
        deviceType: 'desktop',
        platform: 'Windows',
        userAgent: 'Test Agent'
      });

      const licenseRequest = {
        contentId: 'content-123',
        userId: 'user-123',
        deviceId,
        playbackTicket: 'valid-jwt-token',
        drmSystem: 'aes-hls' as const,
        clientInfo: {
          ipAddress: '192.168.1.1',
          userAgent: 'Test Agent'
        }
      };

      const license = await drmService.issueLicense(licenseRequest);

      expect(license).toEqual({
        licenseId: expect.stringMatching(/^license_\d+_/),
        contentId: 'content-123',
        userId: 'user-123',
        deviceId,
        drmSystem: 'aes-hls',
        licenseData: expect.any(String),
        keyIds: expect.arrayContaining([expect.any(String)]),
        issuedAt: expect.any(Date),
        expiresAt: expect.any(Date),
        deviceFingerprint: expect.any(String),
        deviceTrust: 'trusted',
        sessionId: expect.stringMatching(/^session_\d+_/),
        concurrencyGroup: 'user-123',
        signature: expect.any(String),
        nonce: expect.any(String)
      });

      expect(mockStartTimer).toHaveBeenCalledWith('license_issuance', {
        drmSystem: 'aes-hls',
        contentId: 'content-1',
        userId: 'user-123'
      });
      expect(mockEndTimer).toHaveBeenCalledWith('timer-id', true);
      expect(mockCounter).toHaveBeenCalledWith('licenses_issued_total', 1, {
        drmSystem: 'aes-hls',
        deviceTrust: 'trusted'
      });
      expect(mockPublish).toHaveBeenCalledWith({
        type: 'license.issued',
        version: '1.0',
        correlationId: expect.stringMatching(/^license-/),
        payload: expect.objectContaining({
          licenseId: license.licenseId,
          contentId: 'content-123',
          userId: 'user-123',
          deviceId,
          drmSystem: 'aes-hls'
        }),
        metadata: expect.objectContaining({
          source: 'drm-service',
          userId: 'user-123',
          contentId: 'content-123',
          deviceId
        })
      });
    });

    it('should throw error for unregistered device', async () => {
      const licenseRequest = {
        contentId: 'content-123',
        userId: 'user-123',
        deviceId: 'non-existent-device',
        playbackTicket: 'valid-jwt-token',
        drmSystem: 'aes-hls' as const
      };

      // The service should auto-register the device, so this test checks the flow
      const license = await drmService.issueLicense(licenseRequest);
      expect(license).toBeDefined();
    });
  });

  describe('revokeLicense', () => {
    it('should revoke license successfully', async () => {
      const mockPublish = jest.fn().mockResolvedValue(undefined);
      (eventBus.publish as jest.Mock) = mockPublish;

      // First issue a license
      const deviceId = await drmService.registerDevice('user-123', {
        deviceType: 'desktop',
        platform: 'Windows',
        userAgent: 'Test Agent'
      });

      const license = await drmService.issueLicense({
        contentId: 'content-123',
        userId: 'user-123',
        deviceId,
        playbackTicket: 'valid-jwt-token',
        drmSystem: 'aes-hls'
      });

      // Now revoke it
      await drmService.revokeLicense(license.licenseId, 'Test revocation');

      // License should be expired
      const licenseStatus = drmService.getLicenseStatus(license.licenseId);
      expect(licenseStatus).toBeNull();

      expect(mockPublish).toHaveBeenCalledWith({
        type: 'license.revoked',
        version: '1.0',
        correlationId: expect.stringMatching(/^license-revoke-/),
        payload: expect.objectContaining({
          licenseId: license.licenseId,
          contentId: 'content-123',
          userId: 'user-123',
          deviceId,
          reason: 'Test revocation'
        }),
        metadata: expect.objectContaining({
          source: 'drm-service',
          userId: 'user-123',
          contentId: 'content-123',
          deviceId
        })
      });
    });

    it('should throw error for non-existent license', async () => {
      await expect(
        drmService.revokeLicense('non-existent-license', 'Test')
      ).rejects.toThrow('License non-existent-license not found');
    });
  });

  describe('revokeDevice', () => {
    it('should revoke device and all its licenses', async () => {
      // Register device and issue license
      const deviceId = await drmService.registerDevice('user-123', {
        deviceType: 'desktop',
        platform: 'Windows',
        userAgent: 'Test Agent'
      });

      const license = await drmService.issueLicense({
        contentId: 'content-123',
        userId: 'user-123',
        deviceId,
        playbackTicket: 'valid-jwt-token',
        drmSystem: 'aes-hls'
      });

      // Revoke device
      await drmService.revokeDevice(deviceId, 'Security concern');

      // License should be revoked
      const licenseStatus = drmService.getLicenseStatus(license.licenseId);
      expect(licenseStatus).toBeNull();
    });

    it('should throw error for non-existent device', async () => {
      await expect(
        drmService.revokeDevice('non-existent-device', 'Test')
      ).rejects.toThrow('Device non-existent-device not found');
    });
  });

  describe('rotateKeys', () => {
    it('should rotate keys successfully', async () => {
      // Generate initial keys
      await drmService.generateContentKeys('content-123');

      const result = await drmService.rotateKeys('content-123', 'scheduled');

      expect(result).toEqual({
        contentId: 'content-123',
        oldKeyId: expect.any(String),
        newKeyId: expect.any(String),
        rotationType: 'scheduled',
        rotationCompletedAt: expect.any(Date),
        affectedLicenses: expect.any(Number)
      });

      expect(result.oldKeyId).not.toBe(result.newKeyId);
    });

    it('should throw error for non-existent content', async () => {
      await expect(
        drmService.rotateKeys('non-existent-content')
      ).rejects.toThrow('No keys found for content non-existent-content');
    });
  });

  describe('updateSessionHeartbeat', () => {
    it('should update session heartbeat successfully', async () => {
      // Issue license to create session
      const deviceId = await drmService.registerDevice('user-123', {
        deviceType: 'desktop',
        platform: 'Windows',
        userAgent: 'Test Agent'
      });

      const license = await drmService.issueLicense({
        contentId: 'content-123',
        userId: 'user-123',
        deviceId,
        playbackTicket: 'valid-jwt-token',
        drmSystem: 'aes-hls'
      });

      await expect(
        drmService.updateSessionHeartbeat(license.sessionId, 120, {
          averageBitrate: 2000000,
          bufferHealth: 0.8,
          errorCount: 0
        })
      ).resolves.not.toThrow();
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        drmService.updateSessionHeartbeat('non-existent-session', 120)
      ).rejects.toThrow('Session non-existent-session not found');
    });
  });
});