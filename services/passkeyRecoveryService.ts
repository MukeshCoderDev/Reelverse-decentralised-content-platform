import { EventEmitter } from 'events';

export interface PasskeyDevice {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  deviceName: string;
  deviceType: 'phone' | 'tablet' | 'laptop' | 'desktop' | 'security_key' | 'unknown';
  platform: string; // iOS, Android, Windows, macOS, Linux
  browser?: string;
  createdAt: Date;
  lastUsed: Date;
  isActive: boolean;
  trustLevel: 'high' | 'medium' | 'low';
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    location?: string;
    aaguid?: string; // Authenticator Attestation GUID
  };
}

export interface RecoveryMethod {
  id: string;
  userId: string;
  type: 'email' | 'sms' | 'backup_codes' | 'social_recovery' | 'hardware_key';
  identifier: string; // email address, phone number, etc.
  isVerified: boolean;
  isPrimary: boolean;
  createdAt: Date;
  lastUsed?: Date;
  metadata: Record<string, any>;
}

export interface RecoverySession {
  id: string;
  userId: string;
  method: RecoveryMethod;
  status: 'initiated' | 'verified' | 'completed' | 'expired' | 'failed';
  verificationCode?: string;
  expiresAt: Date;
  createdAt: Date;
  completedAt?: Date;
  attempts: number;
  maxAttempts: number;
  ipAddress: string;
  userAgent: string;
}

export interface SocialRecoveryContact {
  id: string;
  userId: string;
  contactUserId: string;
  contactEmail: string;
  contactName: string;
  status: 'pending' | 'accepted' | 'declined';
  trustScore: number; // 0-100
  addedAt: Date;
  lastInteraction?: Date;
}

export interface DeviceBindingRequest {
  id: string;
  userId: string;
  newDeviceInfo: {
    name: string;
    type: string;
    platform: string;
    browser?: string;
    userAgent: string;
  };
  verificationMethod: 'existing_device' | 'recovery_email' | 'social_recovery';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export class PasskeyRecoveryService extends EventEmitter {
  private devices: Map<string, PasskeyDevice> = new Map();
  private recoveryMethods: Map<string, RecoveryMethod[]> = new Map();
  private recoverySessions: Map<string, RecoverySession> = new Map();
  private socialContacts: Map<string, SocialRecoveryContact[]> = new Map();
  private bindingRequests: Map<string, DeviceBindingRequest> = new Map();

  constructor() {
    super();
    this.startCleanupScheduler();
  }

  // Device Management
  public async registerDevice(userId: string, deviceInfo: Partial<PasskeyDevice>): Promise<PasskeyDevice> {
    const device: PasskeyDevice = {
      id: `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      credentialId: deviceInfo.credentialId || '',
      publicKey: deviceInfo.publicKey || '',
      deviceName: deviceInfo.deviceName || 'Unknown Device',
      deviceType: this.detectDeviceType(deviceInfo.metadata?.userAgent || ''),
      platform: this.detectPlatform(deviceInfo.metadata?.userAgent || ''),
      browser: this.detectBrowser(deviceInfo.metadata?.userAgent || ''),
      createdAt: new Date(),
      lastUsed: new Date(),
      isActive: true,
      trustLevel: this.calculateTrustLevel(deviceInfo),
      metadata: deviceInfo.metadata || {}
    };

    this.devices.set(device.id, device);
    
    this.emit('deviceRegistered', { userId, device });
    
    console.log(`Registered new device for user ${userId}: ${device.deviceName} (${device.id})`);
    
    return device;
  }

  public async getUserDevices(userId: string): Promise<PasskeyDevice[]> {
    return Array.from(this.devices.values()).filter(device => 
      device.userId === userId && device.isActive
    );
  }

  public async revokeDevice(userId: string, deviceId: string, reason: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    
    if (!device || device.userId !== userId) {
      throw new Error('Device not found or access denied');
    }

    device.isActive = false;
    this.devices.set(deviceId, device);

    this.emit('deviceRevoked', { userId, deviceId, reason });
    
    console.log(`Revoked device ${deviceId} for user ${userId}: ${reason}`);
    
    return true;
  }

  public async updateDeviceLastUsed(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (device) {
      device.lastUsed = new Date();
      this.devices.set(deviceId, device);
    }
  }

  // Recovery Methods Management
  public async addRecoveryMethod(userId: string, method: Omit<RecoveryMethod, 'id' | 'userId' | 'createdAt'>): Promise<RecoveryMethod> {
    const recoveryMethod: RecoveryMethod = {
      id: `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      createdAt: new Date(),
      ...method
    };

    const userMethods = this.recoveryMethods.get(userId) || [];
    
    // If this is set as primary, make others non-primary
    if (recoveryMethod.isPrimary) {
      userMethods.forEach(m => m.isPrimary = false);
    }
    
    userMethods.push(recoveryMethod);
    this.recoveryMethods.set(userId, userMethods);

    this.emit('recoveryMethodAdded', { userId, method: recoveryMethod });
    
    return recoveryMethod;
  }

  public async getUserRecoveryMethods(userId: string): Promise<RecoveryMethod[]> {
    return this.recoveryMethods.get(userId) || [];
  }

  public async removeRecoveryMethod(userId: string, methodId: string): Promise<boolean> {
    const userMethods = this.recoveryMethods.get(userId) || [];
    const methodIndex = userMethods.findIndex(m => m.id === methodId);
    
    if (methodIndex === -1) {
      return false;
    }

    userMethods.splice(methodIndex, 1);
    this.recoveryMethods.set(userId, userMethods);

    this.emit('recoveryMethodRemoved', { userId, methodId });
    
    return true;
  }

  // Account Recovery Process
  public async initiateRecovery(identifier: string, recoveryType: RecoveryMethod['type']): Promise<RecoverySession> {
    // Find user by recovery method identifier
    const userId = await this.findUserByRecoveryIdentifier(identifier, recoveryType);
    if (!userId) {
      throw new Error('Recovery method not found');
    }

    const userMethods = this.recoveryMethods.get(userId) || [];
    const method = userMethods.find(m => m.identifier === identifier && m.type === recoveryType);
    
    if (!method || !method.isVerified) {
      throw new Error('Invalid or unverified recovery method');
    }

    const session: RecoverySession = {
      id: `recovery_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      method,
      status: 'initiated',
      verificationCode: this.generateVerificationCode(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
      ipAddress: '0.0.0.0', // Would be populated from request
      userAgent: 'Unknown' // Would be populated from request
    };

    this.recoverySessions.set(session.id, session);

    // Send verification code based on method type
    await this.sendVerificationCode(session);

    this.emit('recoveryInitiated', { userId, sessionId: session.id, method: recoveryType });
    
    return session;
  }

  public async verifyRecoveryCode(sessionId: string, code: string): Promise<boolean> {
    const session = this.recoverySessions.get(sessionId);
    
    if (!session) {
      throw new Error('Recovery session not found');
    }

    if (session.status !== 'initiated' || new Date() > session.expiresAt) {
      session.status = 'expired';
      this.recoverySessions.set(sessionId, session);
      throw new Error('Recovery session expired');
    }

    session.attempts++;

    if (session.attempts > session.maxAttempts) {
      session.status = 'failed';
      this.recoverySessions.set(sessionId, session);
      throw new Error('Maximum verification attempts exceeded');
    }

    if (session.verificationCode !== code) {
      this.recoverySessions.set(sessionId, session);
      throw new Error('Invalid verification code');
    }

    session.status = 'verified';
    this.recoverySessions.set(sessionId, session);

    this.emit('recoveryVerified', { userId: session.userId, sessionId });
    
    return true;
  }

  public async completeRecovery(sessionId: string, newDeviceInfo: DeviceBindingRequest['newDeviceInfo']): Promise<PasskeyDevice> {
    const session = this.recoverySessions.get(sessionId);
    
    if (!session || session.status !== 'verified') {
      throw new Error('Invalid recovery session');
    }

    // Create new device binding request
    const bindingRequest: DeviceBindingRequest = {
      id: `binding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: session.userId,
      newDeviceInfo,
      verificationMethod: 'recovery_email',
      status: 'approved', // Auto-approve for verified recovery
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      approvedAt: new Date()
    };

    this.bindingRequests.set(bindingRequest.id, bindingRequest);

    // Register the new device
    const newDevice = await this.registerDevice(session.userId, {
      deviceName: newDeviceInfo.name,
      deviceType: newDeviceInfo.type as PasskeyDevice['deviceType'],
      platform: newDeviceInfo.platform,
      browser: newDeviceInfo.browser,
      metadata: {
        userAgent: newDeviceInfo.userAgent,
        recoverySessionId: sessionId
      }
    });

    session.status = 'completed';
    session.completedAt = new Date();
    this.recoverySessions.set(sessionId, session);

    this.emit('recoveryCompleted', { userId: session.userId, sessionId, deviceId: newDevice.id });
    
    return newDevice;
  }

  // Device Re-binding
  public async requestDeviceBinding(userId: string, newDeviceInfo: DeviceBindingRequest['newDeviceInfo']): Promise<DeviceBindingRequest> {
    const bindingRequest: DeviceBindingRequest = {
      id: `binding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      newDeviceInfo,
      verificationMethod: 'existing_device',
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    this.bindingRequests.set(bindingRequest.id, bindingRequest);

    // Notify existing devices for approval
    await this.notifyExistingDevicesForApproval(userId, bindingRequest);

    this.emit('deviceBindingRequested', { userId, requestId: bindingRequest.id });
    
    return bindingRequest;
  }

  public async approveDeviceBinding(requestId: string, approverDeviceId: string): Promise<PasskeyDevice> {
    const request = this.bindingRequests.get(requestId);
    
    if (!request || request.status !== 'pending') {
      throw new Error('Invalid binding request');
    }

    const approverDevice = this.devices.get(approverDeviceId);
    if (!approverDevice || approverDevice.userId !== request.userId || !approverDevice.isActive) {
      throw new Error('Invalid approver device');
    }

    request.status = 'approved';
    request.approvedBy = approverDeviceId;
    request.approvedAt = new Date();
    this.bindingRequests.set(requestId, request);

    // Register the new device
    const newDevice = await this.registerDevice(request.userId, {
      deviceName: request.newDeviceInfo.name,
      deviceType: request.newDeviceInfo.type as PasskeyDevice['deviceType'],
      platform: request.newDeviceInfo.platform,
      browser: request.newDeviceInfo.browser,
      metadata: {
        userAgent: request.newDeviceInfo.userAgent,
        bindingRequestId: requestId,
        approvedBy: approverDeviceId
      }
    });

    this.emit('deviceBindingApproved', { userId: request.userId, requestId, deviceId: newDevice.id });
    
    return newDevice;
  }

  // Social Recovery
  public async addSocialRecoveryContact(userId: string, contactEmail: string, contactName: string): Promise<SocialRecoveryContact> {
    const contact: SocialRecoveryContact = {
      id: `social_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      contactUserId: '', // Would be populated when contact accepts
      contactEmail,
      contactName,
      status: 'pending',
      trustScore: 50, // Default trust score
      addedAt: new Date()
    };

    const userContacts = this.socialContacts.get(userId) || [];
    userContacts.push(contact);
    this.socialContacts.set(userId, userContacts);

    // Send invitation to contact
    await this.sendSocialRecoveryInvitation(contact);

    this.emit('socialContactAdded', { userId, contactId: contact.id });
    
    return contact;
  }

  public async initiateSocialRecovery(userId: string): Promise<string> {
    const contacts = this.socialContacts.get(userId) || [];
    const acceptedContacts = contacts.filter(c => c.status === 'accepted');

    if (acceptedContacts.length < 2) {
      throw new Error('Insufficient social recovery contacts (minimum 2 required)');
    }

    const recoveryId = `social_recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Send recovery requests to contacts
    for (const contact of acceptedContacts) {
      await this.sendSocialRecoveryRequest(recoveryId, contact);
    }

    this.emit('socialRecoveryInitiated', { userId, recoveryId, contactCount: acceptedContacts.length });
    
    return recoveryId;
  }

  // Security and Analytics
  public async getSecurityAnalytics(userId: string): Promise<any> {
    const devices = await this.getUserDevices(userId);
    const recoveryMethods = await this.getUserRecoveryMethods(userId);
    const recentSessions = Array.from(this.recoverySessions.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return {
      deviceCount: devices.length,
      recoveryMethodCount: recoveryMethods.length,
      recentRecoveryAttempts: recentSessions.length,
      lastDeviceActivity: devices.reduce((latest, device) => 
        device.lastUsed > latest ? device.lastUsed : latest, new Date(0)
      ),
      securityScore: this.calculateSecurityScore(userId, devices, recoveryMethods)
    };
  }

  // Private helper methods
  private detectDeviceType(userAgent: string): PasskeyDevice['deviceType'] {
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return /iPad/.test(userAgent) ? 'tablet' : 'phone';
    }
    if (/Tablet/.test(userAgent)) return 'tablet';
    if (/Windows|Mac|Linux/.test(userAgent)) {
      return /Laptop/.test(userAgent) ? 'laptop' : 'desktop';
    }
    return 'unknown';
  }

  private detectPlatform(userAgent: string): string {
    if (/iPhone|iPad/.test(userAgent)) return 'iOS';
    if (/Android/.test(userAgent)) return 'Android';
    if (/Windows/.test(userAgent)) return 'Windows';
    if (/Mac/.test(userAgent)) return 'macOS';
    if (/Linux/.test(userAgent)) return 'Linux';
    return 'Unknown';
  }

  private detectBrowser(userAgent: string): string {
    if (/Chrome/.test(userAgent)) return 'Chrome';
    if (/Firefox/.test(userAgent)) return 'Firefox';
    if (/Safari/.test(userAgent)) return 'Safari';
    if (/Edge/.test(userAgent)) return 'Edge';
    return 'Unknown';
  }

  private calculateTrustLevel(deviceInfo: Partial<PasskeyDevice>): PasskeyDevice['trustLevel'] {
    // Simple trust calculation based on device characteristics
    let score = 50;
    
    if (deviceInfo.metadata?.aaguid) score += 20; // Hardware authenticator
    if (deviceInfo.platform === 'iOS' || deviceInfo.platform === 'Android') score += 10;
    if (deviceInfo.deviceType === 'security_key') score += 30;
    
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  }

  private async findUserByRecoveryIdentifier(identifier: string, type: RecoveryMethod['type']): Promise<string | null> {
    for (const [userId, methods] of this.recoveryMethods) {
      const method = methods.find(m => m.identifier === identifier && m.type === type);
      if (method) return userId;
    }
    return null;
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendVerificationCode(session: RecoverySession): Promise<void> {
    // Simulate sending verification code
    console.log(`Sending ${session.method.type} verification code ${session.verificationCode} to ${session.method.identifier}`);
  }

  private async notifyExistingDevicesForApproval(userId: string, request: DeviceBindingRequest): Promise<void> {
    const devices = await this.getUserDevices(userId);
    console.log(`Notifying ${devices.length} existing devices for binding approval: ${request.id}`);
  }

  private async sendSocialRecoveryInvitation(contact: SocialRecoveryContact): Promise<void> {
    console.log(`Sending social recovery invitation to ${contact.contactEmail}`);
  }

  private async sendSocialRecoveryRequest(recoveryId: string, contact: SocialRecoveryContact): Promise<void> {
    console.log(`Sending social recovery request ${recoveryId} to ${contact.contactEmail}`);
  }

  private calculateSecurityScore(userId: string, devices: PasskeyDevice[], methods: RecoveryMethod[]): number {
    let score = 0;
    
    // Device diversity bonus
    const deviceTypes = new Set(devices.map(d => d.deviceType));
    score += Math.min(deviceTypes.size * 10, 30);
    
    // Recovery method diversity
    const methodTypes = new Set(methods.map(m => m.type));
    score += Math.min(methodTypes.size * 15, 45);
    
    // High trust devices bonus
    const highTrustDevices = devices.filter(d => d.trustLevel === 'high').length;
    score += Math.min(highTrustDevices * 5, 25);
    
    return Math.min(score, 100);
  }

  private startCleanupScheduler(): void {
    // Clean up expired sessions every hour
    setInterval(() => {
      const now = new Date();
      
      for (const [sessionId, session] of this.recoverySessions) {
        if (session.expiresAt < now && session.status !== 'completed') {
          session.status = 'expired';
          this.recoverySessions.set(sessionId, session);
        }
      }
      
      for (const [requestId, request] of this.bindingRequests) {
        if (request.expiresAt < now && request.status === 'pending') {
          request.status = 'expired';
          this.bindingRequests.set(requestId, request);
        }
      }
    }, 60 * 60 * 1000); // 1 hour
  }
}

export const passkeyRecoveryService = new PasskeyRecoveryService();