import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export interface MasterKey {
  id: string;
  alias: string;
  purpose: KeyPurpose;
  algorithm: 'AES-256' | 'RSA-2048' | 'RSA-4096';
  status: 'active' | 'inactive' | 'pending_deletion' | 'deleted';
  createdAt: Date;
  lastRotated: Date;
  nextRotation: Date;
  rotationInterval: number; // days
  metadata: Record<string, any>;
  accessPolicy: KeyAccessPolicy;
}

export interface DataEncryptionKey {
  id: string;
  masterKeyId: string;
  encryptedKey: Buffer;
  plainKey?: Buffer; // Only available during active use
  purpose: string;
  createdAt: Date;
  expiresAt?: Date;
  metadata: Record<string, any>;
}

export interface EncryptedData {
  dataKeyId: string;
  encryptedContent: Buffer;
  iv: Buffer;
  authTag: Buffer;
  algorithm: string;
  metadata: Record<string, any>;
}

export interface KeyAccessPolicy {
  allowedUsers: string[];
  allowedRoles: string[];
  allowedServices: string[];
  restrictions: {
    ipWhitelist?: string[];
    timeRestrictions?: string;
    requireMFA?: boolean;
  };
}

export type KeyPurpose = 
  | 'evidence_encryption'
  | 'document_encryption' 
  | 'pii_encryption'
  | 'hls_encryption'
  | 'database_encryption'
  | 'backup_encryption';

export interface KeyRotationResult {
  oldKeyId: string;
  newKeyId: string;
  rotatedAt: Date;
  affectedDataKeys: number;
  migrationRequired: boolean;
}

export class KeyManagementService {
  private masterKeys: Map<string, MasterKey> = new Map();
  private dataKeys: Map<string, DataEncryptionKey> = new Map();
  private keyUsageLog: Array<{
    keyId: string;
    operation: 'encrypt' | 'decrypt' | 'create' | 'rotate' | 'delete';
    userId: string;
    timestamp: Date;
    success: boolean;
  }> = [];

  // Mock AWS KMS/GCP KMS configuration
  private kmsConfig = {
    provider: process.env.KMS_PROVIDER || 'AWS',
    region: process.env.KMS_REGION || 'us-east-1',
    keyRing: process.env.KMS_KEY_RING || 'evidence-keys',
    endpoint: process.env.KMS_ENDPOINT || 'https://kms.us-east-1.amazonaws.com'
  };

  async createMasterKey(
    alias: string,
    purpose: KeyPurpose,
    algorithm: MasterKey['algorithm'] = 'AES-256',
    rotationInterval: number = 365, // days
    accessPolicy: KeyAccessPolicy
  ): Promise<MasterKey> {
    const keyId = uuidv4();
    const now = new Date();
    
    const masterKey: MasterKey = {
      id: keyId,
      alias,
      purpose,
      algorithm,
      status: 'active',
      createdAt: now,
      lastRotated: now,
      nextRotation: new Date(now.getTime() + rotationInterval * 24 * 60 * 60 * 1000),
      rotationInterval,
      metadata: {
        kmsProvider: this.kmsConfig.provider,
        region: this.kmsConfig.region,
        keyRing: this.kmsConfig.keyRing
      },
      accessPolicy
    };

    // Mock KMS key creation
    await this.createKMSKey(keyId, alias, purpose);
    
    this.masterKeys.set(keyId, masterKey);
    
    await this.logKeyOperation(keyId, 'create', 'system', true);
    
    console.log(`Master key created: ${alias} (${keyId}) for ${purpose}`);
    return masterKey;
  }

  async createDataEncryptionKey(
    masterKeyId: string,
    purpose: string,
    expiresAt?: Date,
    metadata: Record<string, any> = {}
  ): Promise<DataEncryptionKey> {
    const masterKey = this.masterKeys.get(masterKeyId);
    if (!masterKey || masterKey.status !== 'active') {
      throw new Error('Master key not found or inactive');
    }

    const dekId = uuidv4();
    
    // Generate 256-bit data encryption key
    const plainKey = crypto.randomBytes(32);
    
    // Encrypt the DEK with the master key (mock KMS operation)
    const encryptedKey = await this.encryptWithKMS(masterKeyId, plainKey);
    
    const dataKey: DataEncryptionKey = {
      id: dekId,
      masterKeyId,
      encryptedKey,
      plainKey, // Will be cleared after use
      purpose,
      createdAt: new Date(),
      expiresAt,
      metadata
    };

    this.dataKeys.set(dekId, dataKey);
    
    await this.logKeyOperation(dekId, 'create', 'system', true);
    
    return dataKey;
  }

  async encryptData(
    data: Buffer,
    purpose: string,
    masterKeyId?: string,
    metadata: Record<string, any> = {}
  ): Promise<EncryptedData> {
    // Find or create appropriate master key
    let targetMasterKey: MasterKey;
    if (masterKeyId) {
      const key = this.masterKeys.get(masterKeyId);
      if (!key) throw new Error('Master key not found');
      targetMasterKey = key;
    } else {
      // Find master key by purpose
      targetMasterKey = Array.from(this.masterKeys.values())
        .find(k => k.purpose === purpose && k.status === 'active')!;
      
      if (!targetMasterKey) {
        throw new Error(`No active master key found for purpose: ${purpose}`);
      }
    }

    // Create data encryption key
    const dataKey = await this.createDataEncryptionKey(
      targetMasterKey.id,
      purpose,
      undefined,
      metadata
    );

    // Encrypt data with DEK using AES-256-GCM
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, dataKey.plainKey!);
    cipher.setAAD(Buffer.from(JSON.stringify(metadata)));

    let encryptedContent = cipher.update(data);
    encryptedContent = Buffer.concat([encryptedContent, cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Clear the plain key from memory
    if (dataKey.plainKey) {
      dataKey.plainKey.fill(0);
      delete dataKey.plainKey;
    }

    const encryptedData: EncryptedData = {
      dataKeyId: dataKey.id,
      encryptedContent,
      iv,
      authTag,
      algorithm,
      metadata
    };

    await this.logKeyOperation(dataKey.id, 'encrypt', 'system', true);
    
    return encryptedData;
  }

  async decryptData(
    encryptedData: EncryptedData,
    userId: string = 'system'
  ): Promise<Buffer> {
    const dataKey = this.dataKeys.get(encryptedData.dataKeyId);
    if (!dataKey) {
      throw new Error('Data encryption key not found');
    }

    // Check if key is expired
    if (dataKey.expiresAt && dataKey.expiresAt < new Date()) {
      throw new Error('Data encryption key has expired');
    }

    try {
      // Decrypt the DEK with master key
      const plainKey = await this.decryptWithKMS(dataKey.masterKeyId, dataKey.encryptedKey);
      
      // Decrypt data with DEK
      const decipher = crypto.createDecipher(encryptedData.algorithm, plainKey);
      decipher.setAAD(Buffer.from(JSON.stringify(encryptedData.metadata)));
      decipher.setAuthTag(encryptedData.authTag);

      let decryptedData = decipher.update(encryptedData.encryptedContent);
      decryptedData = Buffer.concat([decryptedData, decipher.final()]);

      // Clear the plain key from memory
      plainKey.fill(0);

      await this.logKeyOperation(dataKey.id, 'decrypt', userId, true);
      
      return decryptedData;
    } catch (error) {
      await this.logKeyOperation(dataKey.id, 'decrypt', userId, false);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  async rotateMasterKey(keyId: string): Promise<KeyRotationResult> {
    const masterKey = this.masterKeys.get(keyId);
    if (!masterKey) {
      throw new Error('Master key not found');
    }

    const now = new Date();
    const newKeyId = uuidv4();
    
    // Create new master key with same properties
    const newMasterKey: MasterKey = {
      ...masterKey,
      id: newKeyId,
      createdAt: now,
      lastRotated: now,
      nextRotation: new Date(now.getTime() + masterKey.rotationInterval * 24 * 60 * 60 * 1000)
    };

    // Create new KMS key
    await this.createKMSKey(newKeyId, masterKey.alias, masterKey.purpose);
    
    // Mark old key as inactive
    masterKey.status = 'inactive';
    
    // Add new key
    this.masterKeys.set(newKeyId, newMasterKey);
    
    // Count affected data keys
    const affectedDataKeys = Array.from(this.dataKeys.values())
      .filter(dk => dk.masterKeyId === keyId).length;

    const rotationResult: KeyRotationResult = {
      oldKeyId: keyId,
      newKeyId,
      rotatedAt: now,
      affectedDataKeys,
      migrationRequired: affectedDataKeys > 0
    };

    await this.logKeyOperation(keyId, 'rotate', 'system', true);
    
    console.log(`Master key rotated: ${keyId} -> ${newKeyId}, ${affectedDataKeys} data keys affected`);
    
    return rotationResult;
  }

  async scheduleKeyRotation(): Promise<void> {
    const now = new Date();
    const keysToRotate = Array.from(this.masterKeys.values())
      .filter(key => key.status === 'active' && key.nextRotation <= now);

    for (const key of keysToRotate) {
      try {
        await this.rotateMasterKey(key.id);
        console.log(`Scheduled rotation completed for key: ${key.alias}`);
      } catch (error) {
        console.error(`Failed to rotate key ${key.alias}:`, error);
      }
    }
  }

  async deleteKey(keyId: string, gracePeriod: number = 30): Promise<void> {
    const masterKey = this.masterKeys.get(keyId);
    if (!masterKey) {
      throw new Error('Master key not found');
    }

    // Check if key is in use
    const dataKeysInUse = Array.from(this.dataKeys.values())
      .filter(dk => dk.masterKeyId === keyId).length;

    if (dataKeysInUse > 0) {
      throw new Error(`Cannot delete key: ${dataKeysInUse} data keys still in use`);
    }

    // Schedule for deletion
    masterKey.status = 'pending_deletion';
    masterKey.metadata.deletionDate = new Date(Date.now() + gracePeriod * 24 * 60 * 60 * 1000);
    
    await this.logKeyOperation(keyId, 'delete', 'system', true);
    
    console.log(`Key ${keyId} scheduled for deletion in ${gracePeriod} days`);
  }

  async getKeyUsageMetrics(keyId?: string, startDate?: Date, endDate?: Date): Promise<any> {
    let filteredLogs = this.keyUsageLog;

    if (keyId) {
      filteredLogs = filteredLogs.filter(log => log.keyId === keyId);
    }

    if (startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= startDate);
    }

    if (endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= endDate);
    }

    const operationCounts = filteredLogs.reduce((acc, log) => {
      acc[log.operation] = (acc[log.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const successRate = filteredLogs.length > 0 
      ? filteredLogs.filter(log => log.success).length / filteredLogs.length 
      : 0;

    return {
      totalOperations: filteredLogs.length,
      operationCounts,
      successRate,
      failedOperations: filteredLogs.filter(log => !log.success).length,
      uniqueUsers: new Set(filteredLogs.map(log => log.userId)).size
    };
  }

  async auditKeyAccess(startDate: Date, endDate: Date): Promise<any> {
    const logs = this.keyUsageLog.filter(log => 
      log.timestamp >= startDate && log.timestamp <= endDate
    );

    const keyAccess = logs.reduce((acc, log) => {
      if (!acc[log.keyId]) {
        acc[log.keyId] = {
          keyId: log.keyId,
          operations: [],
          users: new Set(),
          totalAccess: 0,
          failedAccess: 0
        };
      }
      
      acc[log.keyId].operations.push({
        operation: log.operation,
        userId: log.userId,
        timestamp: log.timestamp,
        success: log.success
      });
      
      acc[log.keyId].users.add(log.userId);
      acc[log.keyId].totalAccess++;
      
      if (!log.success) {
        acc[log.keyId].failedAccess++;
      }
      
      return acc;
    }, {} as Record<string, any>);

    // Convert Sets to arrays for JSON serialization
    Object.values(keyAccess).forEach((access: any) => {
      access.users = Array.from(access.users);
      access.uniqueUsers = access.users.length;
    });

    return {
      period: { startDate, endDate },
      totalKeys: Object.keys(keyAccess).length,
      keyAccess: Object.values(keyAccess)
    };
  }

  private async createKMSKey(keyId: string, alias: string, purpose: KeyPurpose): Promise<void> {
    // Mock KMS key creation - would make actual API call
    console.log(`Creating KMS key: ${keyId} with alias ${alias} for ${purpose}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In real implementation, would call:
    // - AWS KMS: CreateKey, CreateAlias
    // - GCP KMS: projects.locations.keyRings.cryptoKeys.create
    // - Azure Key Vault: CreateKey
  }

  private async encryptWithKMS(masterKeyId: string, plaintext: Buffer): Promise<Buffer> {
    // Mock KMS encryption - would make actual API call
    const mockEncrypted = Buffer.concat([
      Buffer.from('KMS_ENCRYPTED_'), 
      Buffer.from(masterKeyId.slice(0, 8)),
      plaintext
    ]);
    
    return mockEncrypted;
  }

  private async decryptWithKMS(masterKeyId: string, ciphertext: Buffer): Promise<Buffer> {
    // Mock KMS decryption - would make actual API call
    const prefix = Buffer.from('KMS_ENCRYPTED_');
    const keyPrefix = Buffer.from(masterKeyId.slice(0, 8));
    
    if (!ciphertext.subarray(0, prefix.length).equals(prefix)) {
      throw new Error('Invalid KMS ciphertext format');
    }
    
    if (!ciphertext.subarray(prefix.length, prefix.length + keyPrefix.length).equals(keyPrefix)) {
      throw new Error('KMS key mismatch');
    }
    
    return ciphertext.subarray(prefix.length + keyPrefix.length);
  }

  private async logKeyOperation(
    keyId: string,
    operation: 'encrypt' | 'decrypt' | 'create' | 'rotate' | 'delete',
    userId: string,
    success: boolean
  ): Promise<void> {
    this.keyUsageLog.push({
      keyId,
      operation,
      userId,
      timestamp: new Date(),
      success
    });
  }

  // Query methods
  getMasterKey(keyId: string): MasterKey | undefined {
    return this.masterKeys.get(keyId);
  }

  getMasterKeyByAlias(alias: string): MasterKey | undefined {
    return Array.from(this.masterKeys.values()).find(key => key.alias === alias);
  }

  getDataKey(keyId: string): DataEncryptionKey | undefined {
    return this.dataKeys.get(keyId);
  }

  listMasterKeys(purpose?: KeyPurpose, status?: MasterKey['status']): MasterKey[] {
    let keys = Array.from(this.masterKeys.values());
    
    if (purpose) {
      keys = keys.filter(key => key.purpose === purpose);
    }
    
    if (status) {
      keys = keys.filter(key => key.status === status);
    }
    
    return keys.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getKeysRequiringRotation(): MasterKey[] {
    const now = new Date();
    return Array.from(this.masterKeys.values())
      .filter(key => key.status === 'active' && key.nextRotation <= now);
  }
}

export const keyManagementService = new KeyManagementService();