import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface EnvelopeKey {
  id: string;
  purpose: KeyPurpose;
  dataKey: Buffer;
  encryptedDataKey: string;
  kmsKeyId: string;
  createdAt: Date;
  expiresAt?: Date;
  rotationSchedule?: string;
}

export interface EncryptedData {
  id: string;
  encryptedContent: Buffer;
  keyId: string;
  algorithm: string;
  iv: Buffer;
  authTag: Buffer;
  metadata: EncryptionMetadata;
}

export interface EncryptionMetadata {
  originalSize: number;
  contentType?: string;
  purpose: KeyPurpose;
  encryptedAt: Date;
  encryptedBy: string;
}

export type KeyPurpose = 
  | 'evidence_pack' 
  | 'consent_document' 
  | 'pii_data' 
  | 'csam_evidence' 
  | 'financial_record'
  | 'hls_content';

export interface HLSKeyRotationResult {
  id: string;
  oldKeyId?: string;
  newKeyId: string;
  rotatedAt: Date;
  affectedStreams: string[];
  rotationDuration: number;
  success: boolean;
  errors?: string[];
}

export interface KeyRotationSchedule {
  keyId: string;
  purpose: KeyPurpose;
  rotationInterval: number; // hours
  lastRotation: Date;
  nextRotation: Date;
  autoRotate: boolean;
}

export class KMSEnvelopeEncryptionService {
  private readonly dataKeys = new Map<string, EnvelopeKey>();
  private readonly encryptedData = new Map<string, EncryptedData>();
  private readonly rotationSchedules = new Map<string, KeyRotationSchedule>();
  private readonly kmsProvider: 'aws' | 'gcp' | 'azure';
  private readonly masterKeyId: string;

  constructor(kmsProvider: 'aws' | 'gcp' | 'azure' = 'aws') {
    this.kmsProvider = kmsProvider;
    this.masterKeyId = process.env.KMS_MASTER_KEY_ID || 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012';
    
    // Initialize rotation schedules for different key purposes
    this.initializeRotationSchedules();
  }

  /**
   * Create envelope key for specific purpose
   */
  async createEnvelopeKey(purpose: KeyPurpose): Promise<EnvelopeKey> {
    const keyId = uuidv4();
    
    // Generate data encryption key
    const dataKey = randomBytes(32); // 256-bit key
    
    // Encrypt data key with KMS master key
    const encryptedDataKey = await this.encryptWithKMS(dataKey);
    
    // Set expiration based on purpose
    const expiresAt = this.getKeyExpiration(purpose);
    const rotationSchedule = this.getRotationSchedule(purpose);
    
    const envelopeKey: EnvelopeKey = {
      id: keyId,
      purpose,
      dataKey,
      encryptedDataKey,
      kmsKeyId: this.masterKeyId,
      createdAt: new Date(),
      expiresAt,
      rotationSchedule
    };
    
    this.dataKeys.set(keyId, envelopeKey);
    
    // Schedule automatic rotation if applicable
    if (rotationSchedule) {
      await this.scheduleKeyRotation(keyId, purpose, rotationSchedule);
    }
    
    console.log(`Created envelope key ${keyId} for purpose: ${purpose}`);
    return envelopeKey;
  }

  /**
   * Encrypt data using envelope encryption
   */
  async encryptData(
    data: Buffer,
    purpose: KeyPurpose,
    metadata?: Partial<EncryptionMetadata>
  ): Promise<EncryptedData> {
    // Get or create envelope key for purpose
    let envelopeKey = await this.getActiveKeyForPurpose(purpose);
    if (!envelopeKey) {
      envelopeKey = await this.createEnvelopeKey(purpose);
    }
    
    // Generate IV for this encryption
    const iv = randomBytes(16);
    
    // Encrypt data with envelope key
    const cipher = createCipheriv('aes-256-gcm', envelopeKey.dataKey, iv);
    const encryptedContent = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    const encryptedDataId = uuidv4();
    const encryptedData: EncryptedData = {
      id: encryptedDataId,
      encryptedContent,
      keyId: envelopeKey.id,
      algorithm: 'aes-256-gcm',
      iv,
      authTag,
      metadata: {
        originalSize: data.length,
        contentType: metadata?.contentType,
        purpose,
        encryptedAt: new Date(),
        encryptedBy: metadata?.encryptedBy || 'system'
      }
    };
    
    this.encryptedData.set(encryptedDataId, encryptedData);
    
    // Create audit log
    await this.createEncryptionAuditLog('ENCRYPT', encryptedDataId, purpose);
    
    console.log(`Encrypted data ${encryptedDataId} using key ${envelopeKey.id}`);
    return encryptedData;
  }

  /**
   * Decrypt data using envelope encryption
   */
  async decryptData(encryptedDataId: string): Promise<Buffer> {
    const encryptedData = this.encryptedData.get(encryptedDataId);
    if (!encryptedData) {
      throw new Error('Encrypted data not found');
    }
    
    // Get envelope key
    const envelopeKey = this.dataKeys.get(encryptedData.keyId);
    if (!envelopeKey) {
      throw new Error('Envelope key not found');
    }
    
    // Check if key has expired
    if (envelopeKey.expiresAt && new Date() > envelopeKey.expiresAt) {
      throw new Error('Encryption key has expired');
    }
    
    // Decrypt data
    const decipher = createDecipheriv(
      encryptedData.algorithm,
      envelopeKey.dataKey,
      encryptedData.iv
    );
    decipher.setAuthTag(encryptedData.authTag);
    
    const decryptedData = Buffer.concat([
      decipher.update(encryptedData.encryptedContent),
      decipher.final()
    ]);
    
    // Create audit log
    await this.createEncryptionAuditLog('DECRYPT', encryptedDataId, encryptedData.metadata.purpose);
    
    console.log(`Decrypted data ${encryptedDataId}`);
    return decryptedData;
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(keyId: string): Promise<EnvelopeKey> {
    const oldKey = this.dataKeys.get(keyId);
    if (!oldKey) {
      throw new Error('Key not found for rotation');
    }
    
    console.log(`Rotating key ${keyId} for purpose: ${oldKey.purpose}`);
    
    // Create new key with same purpose
    const newKey = await this.createEnvelopeKey(oldKey.purpose);
    
    // Mark old key as expired
    oldKey.expiresAt = new Date();
    
    // Update rotation schedule
    const schedule = this.rotationSchedules.get(keyId);
    if (schedule) {
      schedule.lastRotation = new Date();
      schedule.nextRotation = new Date(Date.now() + schedule.rotationInterval * 60 * 60 * 1000);
    }
    
    // Create audit log
    await this.createEncryptionAuditLog('KEY_ROTATION', keyId, oldKey.purpose, {
      oldKeyId: keyId,
      newKeyId: newKey.id
    });
    
    console.log(`Key rotation completed: ${keyId} -> ${newKey.id}`);
    return newKey;
  }

  /**
   * Rotate HLS encryption keys
   */
  async rotateHLSKeys(): Promise<HLSKeyRotationResult> {
    const rotationId = uuidv4();
    const startTime = Date.now();
    
    try {
      console.log('Starting HLS key rotation...');
      
      // Get all active HLS keys
      const hlsKeys = Array.from(this.dataKeys.values())
        .filter(key => key.purpose === 'hls_content' && (!key.expiresAt || key.expiresAt > new Date()));
      
      const affectedStreams: string[] = [];
      const errors: string[] = [];
      
      for (const oldKey of hlsKeys) {
        try {
          // Create new HLS key
          const newKey = await this.createEnvelopeKey('hls_content');
          
          // Update HLS playlists with new key
          const streams = await this.updateHLSPlaylists(oldKey.id, newKey.id);
          affectedStreams.push(...streams);
          
          // Mark old key as expired
          oldKey.expiresAt = new Date();
          
        } catch (error) {
          errors.push(`Failed to rotate key ${oldKey.id}: ${error.message}`);
        }
      }
      
      const rotationDuration = Date.now() - startTime;
      const success = errors.length === 0;
      
      const result: HLSKeyRotationResult = {
        id: rotationId,
        newKeyId: hlsKeys.length > 0 ? Array.from(this.dataKeys.values())
          .filter(k => k.purpose === 'hls_content')
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.id || '' : '',
        rotatedAt: new Date(),
        affectedStreams,
        rotationDuration,
        success,
        errors: errors.length > 0 ? errors : undefined
      };
      
      // Create audit log
      await this.createEncryptionAuditLog('HLS_KEY_ROTATION', rotationId, 'hls_content', result);
      
      console.log(`HLS key rotation completed in ${rotationDuration}ms, ${affectedStreams.length} streams affected`);
      return result;
      
    } catch (error) {
      const result: HLSKeyRotationResult = {
        id: rotationId,
        newKeyId: '',
        rotatedAt: new Date(),
        affectedStreams: [],
        rotationDuration: Date.now() - startTime,
        success: false,
        errors: [error.message]
      };
      
      console.error('HLS key rotation failed:', error);
      return result;
    }
  }

  /**
   * Schedule automatic key rotation
   */
  async scheduleKeyRotation(
    keyId: string,
    purpose: KeyPurpose,
    intervalHours: string
  ): Promise<void> {
    const interval = this.parseRotationInterval(intervalHours);
    
    const schedule: KeyRotationSchedule = {
      keyId,
      purpose,
      rotationInterval: interval,
      lastRotation: new Date(),
      nextRotation: new Date(Date.now() + interval * 60 * 60 * 1000),
      autoRotate: true
    };
    
    this.rotationSchedules.set(keyId, schedule);
    
    // In production, would set up cron job or scheduled task
    console.log(`Scheduled key rotation for ${keyId} every ${interval} hours`);
  }

  /**
   * Emergency key revocation
   */
  async emergencyKeyRevocation(keyId: string, reason: string): Promise<void> {
    const key = this.dataKeys.get(keyId);
    if (!key) {
      throw new Error('Key not found for revocation');
    }
    
    console.log(`EMERGENCY: Revoking key ${keyId} - ${reason}`);
    
    // Immediately expire the key
    key.expiresAt = new Date();
    
    // If it's an HLS key, immediately rotate
    if (key.purpose === 'hls_content') {
      await this.rotateHLSKeys();
    }
    
    // Create audit log
    await this.createEncryptionAuditLog('EMERGENCY_REVOCATION', keyId, key.purpose, {
      reason,
      revokedAt: new Date()
    });
    
    // Alert security team
    await this.alertSecurityTeam(keyId, reason);
  }

  /**
   * Get encryption statistics
   */
  async getEncryptionStats(): Promise<{
    totalKeys: number;
    keysByPurpose: Record<KeyPurpose, number>;
    totalEncryptedData: number;
    upcomingRotations: KeyRotationSchedule[];
    expiredKeys: number;
  }> {
    const allKeys = Array.from(this.dataKeys.values());
    const now = new Date();
    
    const keysByPurpose = allKeys.reduce((acc, key) => {
      acc[key.purpose] = (acc[key.purpose] || 0) + 1;
      return acc;
    }, {} as Record<KeyPurpose, number>);
    
    const upcomingRotations = Array.from(this.rotationSchedules.values())
      .filter(schedule => schedule.nextRotation <= new Date(Date.now() + 24 * 60 * 60 * 1000))
      .sort((a, b) => a.nextRotation.getTime() - b.nextRotation.getTime());
    
    const expiredKeys = allKeys.filter(key => key.expiresAt && key.expiresAt <= now).length;
    
    return {
      totalKeys: allKeys.length,
      keysByPurpose,
      totalEncryptedData: this.encryptedData.size,
      upcomingRotations,
      expiredKeys
    };
  }

  // Private helper methods
  private async encryptWithKMS(dataKey: Buffer): Promise<string> {
    // Mock KMS encryption - in production would call actual KMS API
    switch (this.kmsProvider) {
      case 'aws':
        return this.mockAWSKMSEncrypt(dataKey);
      case 'gcp':
        return this.mockGCPKMSEncrypt(dataKey);
      case 'azure':
        return this.mockAzureKMSEncrypt(dataKey);
      default:
        throw new Error('Unsupported KMS provider');
    }
  }

  private mockAWSKMSEncrypt(dataKey: Buffer): string {
    // Mock AWS KMS encryption
    return Buffer.concat([
      Buffer.from('aws-kms-encrypted:', 'utf8'),
      dataKey
    ]).toString('base64');
  }

  private mockGCPKMSEncrypt(dataKey: Buffer): string {
    // Mock GCP KMS encryption
    return Buffer.concat([
      Buffer.from('gcp-kms-encrypted:', 'utf8'),
      dataKey
    ]).toString('base64');
  }

  private mockAzureKMSEncrypt(dataKey: Buffer): string {
    // Mock Azure Key Vault encryption
    return Buffer.concat([
      Buffer.from('azure-kv-encrypted:', 'utf8'),
      dataKey
    ]).toString('base64');
  }

  private async getActiveKeyForPurpose(purpose: KeyPurpose): Promise<EnvelopeKey | null> {
    const now = new Date();
    return Array.from(this.dataKeys.values())
      .find(key => 
        key.purpose === purpose && 
        (!key.expiresAt || key.expiresAt > now)
      ) || null;
  }

  private getKeyExpiration(purpose: KeyPurpose): Date | undefined {
    const expirationHours = {
      'evidence_pack': 24 * 365, // 1 year
      'consent_document': 24 * 365 * 7, // 7 years
      'pii_data': 24 * 90, // 90 days
      'csam_evidence': 24 * 365 * 10, // 10 years
      'financial_record': 24 * 365 * 7, // 7 years
      'hls_content': 24 // 1 day
    };
    
    const hours = expirationHours[purpose];
    return hours ? new Date(Date.now() + hours * 60 * 60 * 1000) : undefined;
  }

  private getRotationSchedule(purpose: KeyPurpose): string | undefined {
    const schedules = {
      'evidence_pack': '720h', // 30 days
      'consent_document': '8760h', // 1 year
      'pii_data': '168h', // 1 week
      'csam_evidence': '8760h', // 1 year
      'financial_record': '2160h', // 90 days
      'hls_content': '24h' // 1 day
    };
    
    return schedules[purpose];
  }

  private parseRotationInterval(interval: string): number {
    const match = interval.match(/^(\d+)([hdwmy])$/);
    if (!match) throw new Error('Invalid rotation interval format');
    
    const [, value, unit] = match;
    const multipliers = { h: 1, d: 24, w: 168, m: 720, y: 8760 };
    
    return parseInt(value) * multipliers[unit as keyof typeof multipliers];
  }

  private async updateHLSPlaylists(oldKeyId: string, newKeyId: string): Promise<string[]> {
    // Mock HLS playlist update - in production would update actual playlists
    const affectedStreams = [`stream_${oldKeyId}_1`, `stream_${oldKeyId}_2`];
    console.log(`Updated HLS playlists: ${oldKeyId} -> ${newKeyId}`);
    return affectedStreams;
  }

  private initializeRotationSchedules(): void {
    // Initialize default rotation schedules
    const purposes: KeyPurpose[] = [
      'evidence_pack', 'consent_document', 'pii_data', 
      'csam_evidence', 'financial_record', 'hls_content'
    ];
    
    purposes.forEach(purpose => {
      const schedule = this.getRotationSchedule(purpose);
      if (schedule) {
        // Would set up actual cron jobs in production
        console.log(`Initialized rotation schedule for ${purpose}: ${schedule}`);
      }
    });
  }

  private async createEncryptionAuditLog(
    action: string,
    resourceId: string,
    purpose: KeyPurpose,
    metadata?: any
  ): Promise<void> {
    const auditEntry = {
      id: uuidv4(),
      action,
      resourceId,
      purpose,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      timestamp: new Date(),
      service: 'kms-envelope-encryption'
    };
    
    // In production, would store in secure audit database
    console.log('KMS audit log created:', auditEntry);
  }

  private async alertSecurityTeam(keyId: string, reason: string): Promise<void> {
    // In production, would send urgent security alerts
    console.log(`SECURITY ALERT: Key ${keyId} revoked - ${reason}`);
  }
}

export const kmsEnvelopeEncryptionService = new KMSEnvelopeEncryptionService();