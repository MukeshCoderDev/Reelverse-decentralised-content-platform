/**
 * DRM License and Key Delivery Service
 * Phase 1: AES-HLS + Widevine with device-bound licenses and concurrency enforcement
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { eventBus } from '../core/eventBus';
import { metrics } from '../core/metrics';
import { observability } from '../core/observability';
import { featureFlags } from '../core/featureFlags';

export interface LicenseRequest {
  contentId: string;
  userId: string;
  deviceId: string;
  playbackTicket: string;
  drmSystem: 'widevine' | 'fairplay' | 'playready' | 'aes-hls';
  clientInfo?: ClientInfo;
}

export interface ClientInfo {
  ipAddress: string;
  userAgent: string;
  geolocation?: GeoLocation;
  deviceFingerprint?: string;
}

export interface GeoLocation {
  country: string;
  region: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

export interface License {
  licenseId: string;
  contentId: string;
  userId: string;
  deviceId: string;
  drmSystem: string;
  
  // License data
  licenseData: string; // Base64 encoded license
  keyIds: string[];
  
  // Validity
  issuedAt: Date;
  expiresAt: Date;
  maxPlaybackDuration?: number; // seconds
  
  // Device binding
  deviceFingerprint: string;
  deviceTrust: 'trusted' | 'untrusted' | 'unknown';
  
  // Session management
  sessionId: string;
  concurrencyGroup: string;
  
  // Security
  signature: string;
  nonce: string;
}

export interface DeviceInfo {
  deviceId: string;
  userId: string;
  deviceName?: string;
  deviceType: 'mobile' | 'desktop' | 'tv' | 'tablet' | 'unknown';
  platform: string;
  userAgent: string;
  fingerprint: string;
  
  // Trust and security
  trustLevel: 'trusted' | 'untrusted' | 'unknown';
  isJailbroken?: boolean;
  isRooted?: boolean;
  
  // Registration
  registeredAt: Date;
  lastSeenAt: Date;
  
  // Status
  isActive: boolean;
  isRevoked: boolean;
  revokedAt?: Date;
  revokedReason?: string;
}

export interface PlaybackSession {
  sessionId: string;
  licenseId: string;
  contentId: string;
  userId: string;
  deviceId: string;
  
  // Session state
  status: 'active' | 'paused' | 'ended' | 'expired';
  startedAt: Date;
  lastHeartbeat: Date;
  endedAt?: Date;
  
  // Playback tracking
  currentPosition: number; // seconds
  totalDuration: number; // seconds
  playbackRate: number;
  
  // Network info
  ipAddress: string;
  geolocation?: GeoLocation;
  
  // Quality metrics
  averageBitrate?: number;
  bufferHealth?: number;
  errorCount: number;
}

export interface ContentKeys {
  contentId: string;
  keyId: string;
  key: string; // AES-128 key
  iv: string; // Initialization vector
  
  // Key metadata
  algorithm: 'AES-128' | 'AES-256';
  keyRotationVersion: number;
  createdAt: Date;
  expiresAt?: Date;
  
  // Usage tracking
  licenseCount: number;
  lastUsedAt?: Date;
}

export interface KeyRotationResult {
  contentId: string;
  oldKeyId: string;
  newKeyId: string;
  rotationType: 'scheduled' | 'emergency';
  rotationCompletedAt: Date;
  affectedLicenses: number;
}

export class DRMService {
  private licenses: Map<string, License> = new Map();
  private devices: Map<string, DeviceInfo> = new Map();
  private sessions: Map<string, PlaybackSession> = new Map();
  private contentKeys: Map<string, ContentKeys> = new Map();
  
  // Configuration
  private readonly LICENSE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CONCURRENT_SESSIONS = 3; // Per user
  private readonly MAX_DEVICES_PER_USER = 5;
  private readonly SESSION_HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly JWT_SECRET = process.env.DRM_JWT_SECRET || 'default-secret';

  constructor() {
    this.startSessionCleanup();
    this.startHeartbeatMonitoring();
  }

  /**
   * Issue DRM license with device binding and concurrency enforcement
   */
  async issueLicense(request: LicenseRequest): Promise<License> {
    const timerId = metrics.startTimer('license_issuance', {
      drmSystem: request.drmSystem,
      contentId: request.contentId.substr(0, 8),
      userId: request.userId.substr(0, 8)
    });

    try {
      // Validate playback ticket
      await this.validatePlaybackTicket(request.playbackTicket, request.contentId, request.userId);

      // Check device registration and trust
      const device = await this.validateDevice(request.deviceId, request.userId, request.clientInfo);

      // Enforce concurrency limits
      await this.enforceConcurrencyLimits(request.userId, request.deviceId);

      // Get or generate content keys
      const contentKeys = await this.getContentKeys(request.contentId);

      // Generate license based on DRM system
      const license = await this.generateLicense(request, device, contentKeys);

      // Store license
      this.licenses.set(license.licenseId, license);

      // Create playback session
      const session = await this.createPlaybackSession(license, request.clientInfo);
      this.sessions.set(session.sessionId, session);

      // Emit license issued event
      await eventBus.publish({
        type: 'license.issued',
        version: '1.0',
        correlationId: `license-${license.licenseId}`,
        payload: {
          licenseId: license.licenseId,
          contentId: license.contentId,
          userId: license.userId,
          deviceId: license.deviceId,
          drmSystem: license.drmSystem,
          expiresAt: license.expiresAt.toISOString(),
          sessionId: session.sessionId
        },
        metadata: {
          source: 'drm-service',
          userId: license.userId,
          contentId: license.contentId,
          deviceId: license.deviceId
        }
      });

      metrics.endTimer(timerId, true);
      metrics.counter('licenses_issued_total', 1, {
        drmSystem: request.drmSystem,
        deviceTrust: device.trustLevel
      });

      await observability.logEvent('info', 'DRM license issued', {
        licenseId: license.licenseId,
        contentId: license.contentId,
        userId: license.userId,
        deviceId: license.deviceId,
        drmSystem: license.drmSystem,
        expiresAt: license.expiresAt,
        deviceTrust: device.trustLevel
      });

      return license;

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      metrics.counter('license_issuance_failures_total', 1, {
        drmSystem: request.drmSystem,
        error: error instanceof Error ? error.constructor.name : 'UnknownError'
      });

      await observability.logEvent('error', 'License issuance failed', {
        contentId: request.contentId,
        userId: request.userId,
        deviceId: request.deviceId,
        drmSystem: request.drmSystem,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Revoke license and terminate sessions
   */
  async revokeLicense(licenseId: string, reason: string = 'Manual revocation'): Promise<void> {
    const timerId = metrics.startTimer('license_revocation', {
      licenseId: licenseId.substr(0, 8)
    });

    try {
      const license = this.licenses.get(licenseId);
      if (!license) {
        throw new Error(`License ${licenseId} not found`);
      }

      // Mark license as expired
      license.expiresAt = new Date(); // Immediate expiration

      // Terminate associated sessions
      const sessionsToTerminate = Array.from(this.sessions.values())
        .filter(session => session.licenseId === licenseId);

      for (const session of sessionsToTerminate) {
        session.status = 'ended';
        session.endedAt = new Date();
      }

      // Emit license revoked event
      await eventBus.publish({
        type: 'license.revoked',
        version: '1.0',
        correlationId: `license-revoke-${licenseId}`,
        payload: {
          licenseId,
          contentId: license.contentId,
          userId: license.userId,
          deviceId: license.deviceId,
          reason,
          revokedAt: new Date().toISOString(),
          sessionsTerminated: sessionsToTerminate.length
        },
        metadata: {
          source: 'drm-service',
          userId: license.userId,
          contentId: license.contentId,
          deviceId: license.deviceId
        }
      });

      metrics.endTimer(timerId, true);
      metrics.counter('licenses_revoked_total', 1, {
        reason: reason.toLowerCase().replace(/\s+/g, '_')
      });

      await observability.logEvent('info', 'License revoked', {
        licenseId,
        contentId: license.contentId,
        userId: license.userId,
        deviceId: license.deviceId,
        reason,
        sessionsTerminated: sessionsToTerminate.length
      });

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Register device with fingerprinting and binding
   */
  async registerDevice(userId: string, deviceInfo: Partial<DeviceInfo>): Promise<string> {
    const deviceId = deviceInfo.deviceId || `device_${Date.now()}_${uuidv4()}`;
    
    // Check device limits per user
    const userDevices = Array.from(this.devices.values())
      .filter(device => device.userId === userId && device.isActive);

    if (userDevices.length >= this.MAX_DEVICES_PER_USER) {
      throw new Error(`User ${userId} has reached maximum device limit (${this.MAX_DEVICES_PER_USER})`);
    }

    // Generate device fingerprint
    const fingerprint = this.generateDeviceFingerprint(deviceInfo);

    // Check for duplicate fingerprints (potential device spoofing)
    const existingDevice = Array.from(this.devices.values())
      .find(device => device.fingerprint === fingerprint && device.userId !== userId);

    let trustLevel: 'trusted' | 'untrusted' | 'unknown' = 'unknown';
    if (existingDevice) {
      trustLevel = 'untrusted'; // Suspicious duplicate fingerprint
    } else if (deviceInfo.isJailbroken || deviceInfo.isRooted) {
      trustLevel = 'untrusted'; // Compromised device
    } else {
      trustLevel = 'trusted'; // Clean device
    }

    const device: DeviceInfo = {
      deviceId,
      userId,
      deviceName: deviceInfo.deviceName || 'Unknown Device',
      deviceType: deviceInfo.deviceType || 'unknown',
      platform: deviceInfo.platform || 'unknown',
      userAgent: deviceInfo.userAgent || '',
      fingerprint,
      trustLevel,
      isJailbroken: deviceInfo.isJailbroken || false,
      isRooted: deviceInfo.isRooted || false,
      registeredAt: new Date(),
      lastSeenAt: new Date(),
      isActive: true,
      isRevoked: false
    };

    this.devices.set(deviceId, device);

    await observability.logEvent('info', 'Device registered', {
      deviceId,
      userId,
      deviceType: device.deviceType,
      platform: device.platform,
      trustLevel: device.trustLevel,
      fingerprint: fingerprint.substr(0, 16)
    });

    return deviceId;
  }

  /**
   * Revoke device access
   */
  async revokeDevice(deviceId: string, reason: string = 'Manual revocation'): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    device.isRevoked = true;
    device.isActive = false;
    device.revokedAt = new Date();
    device.revokedReason = reason;

    // Revoke all active licenses for this device
    const deviceLicenses = Array.from(this.licenses.values())
      .filter(license => license.deviceId === deviceId && license.expiresAt > new Date());

    for (const license of deviceLicenses) {
      await this.revokeLicense(license.licenseId, `Device revoked: ${reason}`);
    }

    await observability.logEvent('info', 'Device revoked', {
      deviceId,
      userId: device.userId,
      reason,
      licensesRevoked: deviceLicenses.length
    });
  }

  /**
   * Generate content keys for encryption
   */
  async generateContentKeys(contentId: string): Promise<ContentKeys> {
    const keyId = `key_${contentId}_${Date.now()}_${uuidv4()}`;
    const key = crypto.randomBytes(16).toString('hex'); // AES-128 key
    const iv = crypto.randomBytes(16).toString('hex');

    const contentKeys: ContentKeys = {
      contentId,
      keyId,
      key,
      iv,
      algorithm: 'AES-128',
      keyRotationVersion: 1,
      createdAt: new Date(),
      licenseCount: 0
    };

    this.contentKeys.set(contentId, contentKeys);

    await observability.logEvent('info', 'Content keys generated', {
      contentId,
      keyId,
      algorithm: contentKeys.algorithm,
      keyRotationVersion: contentKeys.keyRotationVersion
    });

    return contentKeys;
  }

  /**
   * Rotate content keys
   */
  async rotateKeys(contentId: string, rotationType: 'scheduled' | 'emergency' = 'scheduled'): Promise<KeyRotationResult> {
    const timerId = metrics.startTimer('key_rotation', {
      contentId: contentId.substr(0, 8),
      rotationType
    });

    try {
      const oldKeys = this.contentKeys.get(contentId);
      if (!oldKeys) {
        throw new Error(`No keys found for content ${contentId}`);
      }

      const oldKeyId = oldKeys.keyId;

      // Generate new keys
      const newKeys = await this.generateContentKeys(contentId);
      newKeys.keyRotationVersion = oldKeys.keyRotationVersion + 1;

      // Count affected licenses
      const affectedLicenses = Array.from(this.licenses.values())
        .filter(license => license.contentId === contentId && license.expiresAt > new Date())
        .length;

      // In emergency rotation, immediately revoke all existing licenses
      if (rotationType === 'emergency') {
        const licensesToRevoke = Array.from(this.licenses.values())
          .filter(license => license.contentId === contentId && license.expiresAt > new Date());

        for (const license of licensesToRevoke) {
          await this.revokeLicense(license.licenseId, 'Emergency key rotation');
        }
      }

      const result: KeyRotationResult = {
        contentId,
        oldKeyId,
        newKeyId: newKeys.keyId,
        rotationType,
        rotationCompletedAt: new Date(),
        affectedLicenses
      };

      metrics.endTimer(timerId, true);
      metrics.counter('key_rotations_completed_total', 1, {
        contentId: contentId.substr(0, 8),
        rotationType
      });

      await observability.logEvent('info', 'Key rotation completed', {
        contentId,
        oldKeyId,
        newKeyId: newKeys.keyId,
        rotationType,
        affectedLicenses,
        keyRotationVersion: newKeys.keyRotationVersion
      });

      return result;

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get license status
   */
  getLicenseStatus(licenseId: string): License | null {
    const license = this.licenses.get(licenseId);
    if (!license) {
      return null;
    }

    // Check if license is expired
    if (license.expiresAt <= new Date()) {
      return null;
    }

    return license;
  }

  /**
   * Update session heartbeat
   */
  async updateSessionHeartbeat(sessionId: string, position: number, metrics?: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.lastHeartbeat = new Date();
    session.currentPosition = position;

    if (metrics) {
      session.averageBitrate = metrics.averageBitrate;
      session.bufferHealth = metrics.bufferHealth;
      session.errorCount = metrics.errorCount || session.errorCount;
    }

    // Check if session should be considered stale
    const heartbeatAge = Date.now() - session.lastHeartbeat.getTime();
    if (heartbeatAge > this.SESSION_HEARTBEAT_INTERVAL * 3) { // 90 seconds
      session.status = 'ended';
      session.endedAt = new Date();
    }
  }

  /**
   * Validate playback ticket
   */
  private async validatePlaybackTicket(ticket: string, contentId: string, userId: string): Promise<void> {
    try {
      const decoded = jwt.verify(ticket, this.JWT_SECRET) as any;
      
      if (decoded.contentId !== contentId) {
        throw new Error('Ticket content ID mismatch');
      }
      
      if (decoded.userId !== userId) {
        throw new Error('Ticket user ID mismatch');
      }
      
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        throw new Error('Ticket expired');
      }

    } catch (error) {
      throw new Error(`Invalid playback ticket: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate device registration and trust
   */
  private async validateDevice(deviceId: string, userId: string, clientInfo?: ClientInfo): Promise<DeviceInfo> {
    let device = this.devices.get(deviceId);
    
    if (!device) {
      // Auto-register device if not found
      device = await this.registerDevice(userId, {
        deviceId,
        userId,
        userAgent: clientInfo?.userAgent || '',
        platform: this.extractPlatformFromUserAgent(clientInfo?.userAgent || ''),
        deviceType: this.extractDeviceTypeFromUserAgent(clientInfo?.userAgent || '')
      }) as any;
      device = this.devices.get(deviceId)!;
    }

    if (device.userId !== userId) {
      throw new Error(`Device ${deviceId} is not registered to user ${userId}`);
    }

    if (device.isRevoked) {
      throw new Error(`Device ${deviceId} has been revoked: ${device.revokedReason}`);
    }

    if (!device.isActive) {
      throw new Error(`Device ${deviceId} is not active`);
    }

    // Update last seen
    device.lastSeenAt = new Date();

    return device;
  }

  /**
   * Enforce concurrency limits
   */
  private async enforceConcurrencyLimits(userId: string, deviceId: string): Promise<void> {
    const activeSessions = Array.from(this.sessions.values())
      .filter(session => 
        session.userId === userId && 
        session.status === 'active' &&
        session.lastHeartbeat > new Date(Date.now() - this.SESSION_HEARTBEAT_INTERVAL * 3)
      );

    if (activeSessions.length >= this.MAX_CONCURRENT_SESSIONS) {
      // Find oldest session to terminate
      const oldestSession = activeSessions
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())[0];

      if (oldestSession) {
        oldestSession.status = 'ended';
        oldestSession.endedAt = new Date();

        await observability.logEvent('info', 'Session terminated due to concurrency limit', {
          terminatedSessionId: oldestSession.sessionId,
          userId,
          deviceId,
          activeSessions: activeSessions.length
        });
      }
    }
  }

  /**
   * Get or generate content keys
   */
  private async getContentKeys(contentId: string): Promise<ContentKeys> {
    let keys = this.contentKeys.get(contentId);
    
    if (!keys) {
      keys = await this.generateContentKeys(contentId);
    }

    keys.licenseCount++;
    keys.lastUsedAt = new Date();

    return keys;
  }

  /**
   * Generate license based on DRM system
   */
  private async generateLicense(
    request: LicenseRequest,
    device: DeviceInfo,
    contentKeys: ContentKeys
  ): Promise<License> {
    const licenseId = `license_${Date.now()}_${uuidv4()}`;
    const sessionId = `session_${Date.now()}_${uuidv4()}`;
    const nonce = crypto.randomBytes(16).toString('hex');
    
    let licenseData: string;
    
    switch (request.drmSystem) {
      case 'aes-hls':
        licenseData = this.generateAESHLSLicense(contentKeys);
        break;
      case 'widevine':
        licenseData = await this.generateWidevineLicense(contentKeys, device);
        break;
      case 'fairplay':
        licenseData = await this.generateFairPlayLicense(contentKeys, device);
        break;
      case 'playready':
        licenseData = await this.generatePlayReadyLicense(contentKeys, device);
        break;
      default:
        throw new Error(`Unsupported DRM system: ${request.drmSystem}`);
    }

    const license: License = {
      licenseId,
      contentId: request.contentId,
      userId: request.userId,
      deviceId: request.deviceId,
      drmSystem: request.drmSystem,
      licenseData,
      keyIds: [contentKeys.keyId],
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + this.LICENSE_TTL),
      deviceFingerprint: device.fingerprint,
      deviceTrust: device.trustLevel,
      sessionId,
      concurrencyGroup: request.userId, // Group by user for concurrency
      signature: '',
      nonce
    };

    // Sign the license
    license.signature = this.signLicense(license);

    return license;
  }

  /**
   * Generate AES-HLS license (key delivery)
   */
  private generateAESHLSLicense(contentKeys: ContentKeys): string {
    // For AES-HLS, the license is just the key
    return Buffer.from(contentKeys.key, 'hex').toString('base64');
  }

  /**
   * Generate Widevine license
   */
  private async generateWidevineLicense(contentKeys: ContentKeys, device: DeviceInfo): Promise<string> {
    // In production, this would integrate with Widevine license server
    // For now, return a mock license
    const licenseData = {
      keyId: contentKeys.keyId,
      key: contentKeys.key,
      deviceId: device.deviceId,
      trustLevel: device.trustLevel,
      timestamp: Date.now()
    };

    return Buffer.from(JSON.stringify(licenseData)).toString('base64');
  }

  /**
   * Generate FairPlay license
   */
  private async generateFairPlayLicense(contentKeys: ContentKeys, device: DeviceInfo): Promise<string> {
    // FairPlay license generation would go here
    return Buffer.from(contentKeys.key, 'hex').toString('base64');
  }

  /**
   * Generate PlayReady license
   */
  private async generatePlayReadyLicense(contentKeys: ContentKeys, device: DeviceInfo): Promise<string> {
    // PlayReady license generation would go here
    return Buffer.from(contentKeys.key, 'hex').toString('base64');
  }

  /**
   * Create playback session
   */
  private async createPlaybackSession(license: License, clientInfo?: ClientInfo): Promise<PlaybackSession> {
    const session: PlaybackSession = {
      sessionId: license.sessionId,
      licenseId: license.licenseId,
      contentId: license.contentId,
      userId: license.userId,
      deviceId: license.deviceId,
      status: 'active',
      startedAt: new Date(),
      lastHeartbeat: new Date(),
      currentPosition: 0,
      totalDuration: 0,
      playbackRate: 1.0,
      ipAddress: clientInfo?.ipAddress || 'unknown',
      geolocation: clientInfo?.geolocation,
      errorCount: 0
    };

    return session;
  }

  /**
   * Generate device fingerprint
   */
  private generateDeviceFingerprint(deviceInfo: Partial<DeviceInfo>): string {
    const fingerprintData = [
      deviceInfo.userAgent || '',
      deviceInfo.platform || '',
      deviceInfo.deviceType || '',
      // In production, include more device characteristics
    ].join('|');

    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
  }

  /**
   * Sign license for integrity
   */
  private signLicense(license: License): string {
    const signatureData = [
      license.licenseId,
      license.contentId,
      license.userId,
      license.deviceId,
      license.expiresAt.toISOString(),
      license.nonce
    ].join('|');

    return crypto.createHmac('sha256', this.JWT_SECRET)
      .update(signatureData)
      .digest('hex');
  }

  /**
   * Extract platform from user agent
   */
  private extractPlatformFromUserAgent(userAgent: string): string {
    if (/Windows/i.test(userAgent)) return 'Windows';
    if (/Mac OS/i.test(userAgent)) return 'macOS';
    if (/Linux/i.test(userAgent)) return 'Linux';
    if (/Android/i.test(userAgent)) return 'Android';
    if (/iOS/i.test(userAgent)) return 'iOS';
    return 'Unknown';
  }

  /**
   * Extract device type from user agent
   */
  private extractDeviceTypeFromUserAgent(userAgent: string): DeviceInfo['deviceType'] {
    if (/Mobile/i.test(userAgent)) return 'mobile';
    if (/Tablet/i.test(userAgent)) return 'tablet';
    if (/TV/i.test(userAgent)) return 'tv';
    return 'desktop';
  }

  /**
   * Start session cleanup timer
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - this.SESSION_HEARTBEAT_INTERVAL * 5);
      
      let cleanedSessions = 0;
      let cleanedLicenses = 0;

      // Clean up stale sessions
      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.lastHeartbeat < staleThreshold || session.status === 'ended') {
          this.sessions.delete(sessionId);
          cleanedSessions++;
        }
      }

      // Clean up expired licenses
      for (const [licenseId, license] of this.licenses.entries()) {
        if (license.expiresAt <= now) {
          this.licenses.delete(licenseId);
          cleanedLicenses++;
        }
      }

      if (cleanedSessions > 0 || cleanedLicenses > 0) {
        observability.logEvent('info', 'Cleaned up expired sessions and licenses', {
          cleanedSessions,
          cleanedLicenses
        });
      }
    }, 60000); // Every minute
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeatMonitoring(): void {
    setInterval(() => {
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - this.SESSION_HEARTBEAT_INTERVAL * 3);
      
      for (const session of this.sessions.values()) {
        if (session.status === 'active' && session.lastHeartbeat < staleThreshold) {
          session.status = 'ended';
          session.endedAt = new Date();
          
          observability.logEvent('info', 'Session marked as ended due to missing heartbeat', {
            sessionId: session.sessionId,
            userId: session.userId,
            contentId: session.contentId,
            lastHeartbeat: session.lastHeartbeat
          });
        }
      }
    }, this.SESSION_HEARTBEAT_INTERVAL);
  }
}

// Global DRM service instance
export const drmService = new DRMService();