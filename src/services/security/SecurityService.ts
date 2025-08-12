import { EventEmitter } from 'events';

export interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'failed_login' | 'password_change' | 'mfa_enabled' | 'suspicious_activity' | 'data_export' | 'data_deletion';
  timestamp: Date;
  userId: string;
  ipAddress: string;
  userAgent: string;
  location?: {
    country: string;
    city: string;
    coordinates?: [number, number];
  };
  metadata?: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'followers' | 'private';
  showOnlineStatus: boolean;
  allowDirectMessages: 'everyone' | 'followers' | 'none';
  showWatchHistory: boolean;
  showLikedVideos: boolean;
  allowAnalytics: boolean;
  allowPersonalization: boolean;
  allowThirdPartyIntegrations: boolean;
  dataRetentionPeriod: number; // days
  autoDeleteInactiveData: boolean;
}

export interface DataExportRequest {
  id: string;
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: Date;
  dataTypes: string[];
  format: 'json' | 'csv' | 'xml';
}

export interface DataDeletionRequest {
  id: string;
  userId: string;
  requestedAt: Date;
  scheduledFor: Date;
  status: 'pending' | 'scheduled' | 'processing' | 'completed' | 'cancelled';
  dataTypes: string[];
  confirmationToken: string;
  isReversible: boolean;
}

export interface MFASettings {
  enabled: boolean;
  methods: {
    totp: { enabled: boolean; secret?: string; backupCodes?: string[] };
    sms: { enabled: boolean; phoneNumber?: string };
    email: { enabled: boolean; };
    webauthn: { enabled: boolean; credentials?: any[] };
  };
  requireForSensitiveActions: boolean;
  trustDevices: boolean;
  trustedDevices: Array<{
    id: string;
    name: string;
    addedAt: Date;
    lastUsed: Date;
    fingerprint: string;
  }>;
}

export class SecurityService extends EventEmitter {
  private securityEvents: Map<string, SecurityEvent> = new Map();
  private privacySettings: Map<string, PrivacySettings> = new Map();
  private mfaSettings: Map<string, MFASettings> = new Map();
  private exportRequests: Map<string, DataExportRequest> = new Map();
  private deletionRequests: Map<string, DataDeletionRequest> = new Map();
  private encryptionKey: string;

  constructor() {
    super();
    this.encryptionKey = this.generateEncryptionKey();
    this.initializeDefaults();
  }

  private generateEncryptionKey(): string {
    // In production, this would be properly managed
    return 'secure-encryption-key-' + Math.random().toString(36);
  }

  private initializeDefaults() {
    // Initialize with default privacy settings
    const defaultPrivacy: PrivacySettings = {
      profileVisibility: 'public',
      showOnlineStatus: true,
      allowDirectMessages: 'followers',
      showWatchHistory: false,
      showLikedVideos: false,
      allowAnalytics: true,
      allowPersonalization: true,
      allowThirdPartyIntegrations: false,
      dataRetentionPeriod: 365,
      autoDeleteInactiveData: false
    };

    const defaultMFA: MFASettings = {
      enabled: false,
      methods: {
        totp: { enabled: false },
        sms: { enabled: false },
        email: { enabled: false },
        webauthn: { enabled: false }
      },
      requireForSensitiveActions: false,
      trustDevices: false,
      trustedDevices: []
    };

    // Store defaults for demo user
    this.privacySettings.set('demo_user', defaultPrivacy);
    this.mfaSettings.set('demo_user', defaultMFA);
  }

  // Security Event Logging
  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<string> {
    const id = this.generateId();
    const securityEvent: SecurityEvent = {
      ...event,
      id,
      timestamp: new Date()
    };

    this.securityEvents.set(id, securityEvent);

    // Emit event for real-time monitoring
    this.emit('securityEvent', securityEvent);

    // Check for suspicious patterns
    await this.analyzeSuspiciousActivity(event.userId, securityEvent);

    return id;
  }

  private async analyzeSuspiciousActivity(userId: string, event: SecurityEvent) {
    const recentEvents = this.getSecurityEvents(userId, { 
      hours: 24,
      types: ['login', 'failed_login']
    });

    // Check for multiple failed logins
    const failedLogins = recentEvents.filter(e => e.type === 'failed_login');
    if (failedLogins.length >= 5) {
      await this.handleSuspiciousActivity(userId, 'multiple_failed_logins', {
        count: failedLogins.length,
        timeframe: '24h'
      });
    }

    // Check for logins from new locations
    const loginEvents = recentEvents.filter(e => e.type === 'login');
    const locations = new Set(loginEvents.map(e => e.location?.country).filter(Boolean));
    if (locations.size > 3) {
      await this.handleSuspiciousActivity(userId, 'multiple_locations', {
        locations: Array.from(locations),
        count: locations.size
      });
    }

    // Check for unusual IP addresses
    const ipAddresses = new Set(loginEvents.map(e => e.ipAddress));
    if (ipAddresses.size > 5) {
      await this.handleSuspiciousActivity(userId, 'multiple_ip_addresses', {
        count: ipAddresses.size
      });
    }
  }

  private async handleSuspiciousActivity(userId: string, type: string, metadata: any) {
    await this.logSecurityEvent({
      type: 'suspicious_activity',
      userId,
      ipAddress: 'system',
      userAgent: 'security-monitor',
      riskLevel: 'high',
      metadata: { suspiciousType: type, ...metadata }
    });

    // Emit alert for immediate action
    this.emit('suspiciousActivity', {
      userId,
      type,
      metadata,
      timestamp: new Date()
    });
  }

  getSecurityEvents(userId: string, options: {
    hours?: number;
    types?: string[];
    riskLevels?: string[];
    limit?: number;
  } = {}): SecurityEvent[] {
    const { hours = 24, types, riskLevels, limit = 100 } = options;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    let events = Array.from(this.securityEvents.values())
      .filter(event => 
        event.userId === userId && 
        event.timestamp >= cutoff
      );

    if (types) {
      events = events.filter(event => types.includes(event.type));
    }

    if (riskLevels) {
      events = events.filter(event => riskLevels.includes(event.riskLevel));
    }

    return events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Privacy Settings Management
  updatePrivacySettings(userId: string, settings: Partial<PrivacySettings>): void {
    const current = this.privacySettings.get(userId) || this.getDefaultPrivacySettings();
    const updated = { ...current, ...settings };
    
    this.privacySettings.set(userId, updated);
    
    this.logSecurityEvent({
      type: 'login', // Using login as placeholder for settings change
      userId,
      ipAddress: 'system',
      userAgent: 'settings-update',
      riskLevel: 'low',
      metadata: { action: 'privacy_settings_updated', changes: Object.keys(settings) }
    });

    this.emit('privacySettingsUpdated', { userId, settings: updated });
  }

  getPrivacySettings(userId: string): PrivacySettings {
    return this.privacySettings.get(userId) || this.getDefaultPrivacySettings();
  }

  private getDefaultPrivacySettings(): PrivacySettings {
    return {
      profileVisibility: 'public',
      showOnlineStatus: true,
      allowDirectMessages: 'followers',
      showWatchHistory: false,
      showLikedVideos: false,
      allowAnalytics: true,
      allowPersonalization: true,
      allowThirdPartyIntegrations: false,
      dataRetentionPeriod: 365,
      autoDeleteInactiveData: false
    };
  }

  // Multi-Factor Authentication
  async enableMFA(userId: string, method: 'totp' | 'sms' | 'email' | 'webauthn', config: any): Promise<{ secret?: string; qrCode?: string; backupCodes?: string[] }> {
    const mfaSettings = this.mfaSettings.get(userId) || this.getDefaultMFASettings();
    
    let result: any = {};

    switch (method) {
      case 'totp':
        const secret = this.generateTOTPSecret();
        const qrCode = this.generateQRCode(userId, secret);
        const backupCodes = this.generateBackupCodes();
        
        mfaSettings.methods.totp = {
          enabled: true,
          secret,
          backupCodes
        };
        
        result = { secret, qrCode, backupCodes };
        break;

      case 'sms':
        mfaSettings.methods.sms = {
          enabled: true,
          phoneNumber: config.phoneNumber
        };
        break;

      case 'email':
        mfaSettings.methods.email = { enabled: true };
        break;

      case 'webauthn':
        // WebAuthn implementation would go here
        mfaSettings.methods.webauthn = { enabled: true };
        break;
    }

    mfaSettings.enabled = true;
    this.mfaSettings.set(userId, mfaSettings);

    await this.logSecurityEvent({
      type: 'mfa_enabled',
      userId,
      ipAddress: 'system',
      userAgent: 'mfa-setup',
      riskLevel: 'low',
      metadata: { method }
    });

    this.emit('mfaEnabled', { userId, method });
    return result;
  }

  async disableMFA(userId: string, method?: 'totp' | 'sms' | 'email' | 'webauthn'): Promise<void> {
    const mfaSettings = this.mfaSettings.get(userId);
    if (!mfaSettings) return;

    if (method) {
      mfaSettings.methods[method].enabled = false;
      
      // Check if any methods are still enabled
      const hasEnabledMethods = Object.values(mfaSettings.methods).some(m => m.enabled);
      if (!hasEnabledMethods) {
        mfaSettings.enabled = false;
      }
    } else {
      // Disable all MFA
      mfaSettings.enabled = false;
      Object.keys(mfaSettings.methods).forEach(key => {
        mfaSettings.methods[key as keyof typeof mfaSettings.methods].enabled = false;
      });
    }

    this.mfaSettings.set(userId, mfaSettings);

    await this.logSecurityEvent({
      type: 'login', // Placeholder
      userId,
      ipAddress: 'system',
      userAgent: 'mfa-disable',
      riskLevel: 'medium',
      metadata: { action: 'mfa_disabled', method }
    });

    this.emit('mfaDisabled', { userId, method });
  }

  getMFASettings(userId: string): MFASettings {
    return this.mfaSettings.get(userId) || this.getDefaultMFASettings();
  }

  private getDefaultMFASettings(): MFASettings {
    return {
      enabled: false,
      methods: {
        totp: { enabled: false },
        sms: { enabled: false },
        email: { enabled: false },
        webauthn: { enabled: false }
      },
      requireForSensitiveActions: false,
      trustDevices: false,
      trustedDevices: []
    };
  }

  private generateTOTPSecret(): string {
    // Generate a base32 secret for TOTP
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  }

  private generateQRCode(userId: string, secret: string): string {
    // Generate QR code URL for TOTP setup
    const issuer = 'Reelverse';
    const label = `${issuer}:${userId}`;
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;
  }

  private generateBackupCodes(): string[] {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substr(2, 8).toUpperCase());
    }
    return codes;
  }

  // Data Export & Deletion (GDPR Compliance)
  async requestDataExport(userId: string, dataTypes: string[], format: 'json' | 'csv' | 'xml' = 'json'): Promise<string> {
    const requestId = this.generateId();
    const request: DataExportRequest = {
      id: requestId,
      userId,
      requestedAt: new Date(),
      status: 'pending',
      dataTypes,
      format
    };

    this.exportRequests.set(requestId, request);

    // Start processing (in production, this would be async)
    setTimeout(() => {
      this.processDataExport(requestId);
    }, 1000);

    await this.logSecurityEvent({
      type: 'data_export',
      userId,
      ipAddress: 'system',
      userAgent: 'data-export',
      riskLevel: 'medium',
      metadata: { dataTypes, format }
    });

    this.emit('dataExportRequested', request);
    return requestId;
  }

  private async processDataExport(requestId: string) {
    const request = this.exportRequests.get(requestId);
    if (!request) return;

    request.status = 'processing';
    this.emit('dataExportStatusChanged', request);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Generate download URL (in production, this would be a secure signed URL)
    request.downloadUrl = `https://secure-downloads.reelverse.com/exports/${requestId}.${request.format}`;
    request.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    request.status = 'completed';

    this.exportRequests.set(requestId, request);
    this.emit('dataExportCompleted', request);
  }

  async requestDataDeletion(userId: string, dataTypes: string[], scheduledFor?: Date): Promise<string> {
    const requestId = this.generateId();
    const confirmationToken = this.generateId();
    const deletionDate = scheduledFor || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default

    const request: DataDeletionRequest = {
      id: requestId,
      userId,
      requestedAt: new Date(),
      scheduledFor: deletionDate,
      status: 'pending',
      dataTypes,
      confirmationToken,
      isReversible: deletionDate.getTime() > Date.now() + 24 * 60 * 60 * 1000 // Reversible if more than 24h away
    };

    this.deletionRequests.set(requestId, request);

    await this.logSecurityEvent({
      type: 'data_deletion',
      userId,
      ipAddress: 'system',
      userAgent: 'data-deletion',
      riskLevel: 'high',
      metadata: { dataTypes, scheduledFor: deletionDate }
    });

    this.emit('dataDeletionRequested', request);
    return requestId;
  }

  async confirmDataDeletion(requestId: string, confirmationToken: string): Promise<boolean> {
    const request = this.deletionRequests.get(requestId);
    if (!request || request.confirmationToken !== confirmationToken) {
      return false;
    }

    request.status = 'scheduled';
    this.deletionRequests.set(requestId, request);

    this.emit('dataDeletionConfirmed', request);
    return true;
  }

  async cancelDataDeletion(requestId: string, userId: string): Promise<boolean> {
    const request = this.deletionRequests.get(requestId);
    if (!request || request.userId !== userId || !request.isReversible) {
      return false;
    }

    request.status = 'cancelled';
    this.deletionRequests.set(requestId, request);

    await this.logSecurityEvent({
      type: 'login', // Placeholder
      userId,
      ipAddress: 'system',
      userAgent: 'data-deletion-cancel',
      riskLevel: 'low',
      metadata: { action: 'data_deletion_cancelled', requestId }
    });

    this.emit('dataDeletionCancelled', request);
    return true;
  }

  getDataExportRequests(userId: string): DataExportRequest[] {
    return Array.from(this.exportRequests.values())
      .filter(request => request.userId === userId)
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  getDataDeletionRequests(userId: string): DataDeletionRequest[] {
    return Array.from(this.deletionRequests.values())
      .filter(request => request.userId === userId)
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  // Encryption Utilities
  encrypt(data: string): string {
    // Simple encryption for demo - in production use proper encryption
    return btoa(data + '::' + this.encryptionKey);
  }

  decrypt(encryptedData: string): string {
    try {
      const decoded = atob(encryptedData);
      const [data] = decoded.split('::');
      return data;
    } catch {
      throw new Error('Failed to decrypt data');
    }
  }

  // Security Audit
  async performSecurityAudit(userId: string): Promise<{
    score: number;
    recommendations: Array<{
      type: string;
      priority: 'low' | 'medium' | 'high';
      description: string;
      action: string;
    }>;
    risks: Array<{
      type: string;
      level: 'low' | 'medium' | 'high' | 'critical';
      description: string;
    }>;
  }> {
    const mfaSettings = this.getMFASettings(userId);
    const privacySettings = this.getPrivacySettings(userId);
    const recentEvents = this.getSecurityEvents(userId, { hours: 168 }); // 7 days

    let score = 100;
    const recommendations = [];
    const risks = [];

    // Check MFA status
    if (!mfaSettings.enabled) {
      score -= 30;
      recommendations.push({
        type: 'mfa',
        priority: 'high' as const,
        description: 'Multi-factor authentication is not enabled',
        action: 'Enable MFA to secure your account'
      });
      risks.push({
        type: 'authentication',
        level: 'high' as const,
        description: 'Account vulnerable to password-based attacks'
      });
    }

    // Check privacy settings
    if (privacySettings.profileVisibility === 'public') {
      score -= 5;
      recommendations.push({
        type: 'privacy',
        priority: 'low' as const,
        description: 'Profile is publicly visible',
        action: 'Consider limiting profile visibility'
      });
    }

    // Check for suspicious activity
    const suspiciousEvents = recentEvents.filter(e => e.riskLevel === 'high' || e.riskLevel === 'critical');
    if (suspiciousEvents.length > 0) {
      score -= suspiciousEvents.length * 10;
      risks.push({
        type: 'suspicious_activity',
        level: 'medium' as const,
        description: `${suspiciousEvents.length} suspicious activities detected in the last 7 days`
      });
    }

    // Check data retention settings
    if (privacySettings.dataRetentionPeriod > 365) {
      recommendations.push({
        type: 'data_retention',
        priority: 'medium' as const,
        description: 'Data retention period is longer than recommended',
        action: 'Consider reducing data retention period'
      });
    }

    return {
      score: Math.max(0, score),
      recommendations,
      risks
    };
  }

  private generateId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const securityService = new SecurityService();