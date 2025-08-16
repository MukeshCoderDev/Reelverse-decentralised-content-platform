import { keyManagementService, KeyPurpose } from './keyManagementService';
import { auditLoggingService } from './auditLoggingService';

export interface EnvelopeEncryptionConfig {
  purpose: KeyPurpose;
  masterKeyAlias?: string;
  compressionEnabled?: boolean;
  integrityCheckEnabled?: boolean;
  metadata?: Record<string, any>;
}

export interface EncryptedEnvelope {
  id: string;
  dataKeyId: string;
  encryptedContent: string; // Base64 encoded
  iv: string; // Base64 encoded
  authTag: string; // Base64 encoded
  algorithm: string;
  compressionUsed: boolean;
  integrityHash?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  encryptedBy: string;
}

export interface DecryptionResult {
  data: Buffer;
  metadata: Record<string, any>;
  decryptedAt: Date;
  integrityVerified: boolean;
}

export class EnvelopeEncryptionService {
  private encryptedEnvelopes: Map<string, EncryptedEnvelope> = new Map();

  async encryptEvidence(
    data: Buffer,
    evidenceId: string,
    encryptedBy: string,
    config: EnvelopeEncryptionConfig = { purpose: 'evidence_encryption' }
  ): Promise<EncryptedEnvelope> {
    try {
      // Compress data if enabled
      let processedData = data;
      if (config.compressionEnabled) {
        processedData = await this.compressData(data);
      }

      // Calculate integrity hash if enabled
      let integrityHash: string | undefined;
      if (config.integrityCheckEnabled) {
        integrityHash = await this.calculateIntegrityHash(processedData);
      }

      // Encrypt using envelope encryption
      const encryptedData = await keyManagementService.encryptData(
        processedData,
        config.purpose,
        config.masterKeyAlias ? 
          keyManagementService.getMasterKeyByAlias(config.masterKeyAlias)?.id : 
          undefined,
        {
          evidenceId,
          encryptedBy,
          originalSize: data.length,
          compressionUsed: config.compressionEnabled || false,
          ...config.metadata
        }
      );

      const envelope: EncryptedEnvelope = {
        id: evidenceId,
        dataKeyId: encryptedData.dataKeyId,
        encryptedContent: encryptedData.encryptedContent.toString('base64'),
        iv: encryptedData.iv.toString('base64'),
        authTag: encryptedData.authTag.toString('base64'),
        algorithm: encryptedData.algorithm,
        compressionUsed: config.compressionEnabled || false,
        integrityHash,
        metadata: {
          ...encryptedData.metadata,
          purpose: config.purpose,
          originalSize: data.length,
          encryptedSize: encryptedData.encryptedContent.length
        },
        createdAt: new Date(),
        encryptedBy
      };

      this.encryptedEnvelopes.set(evidenceId, envelope);

      // Log encryption operation
      await auditLoggingService.logAction(
        encryptedBy,
        'system',
        'encrypt',
        'evidence_data',
        evidenceId,
        `Evidence encrypted using envelope encryption (${config.purpose})`,
        {
          ipAddress: '127.0.0.1',
          userAgent: 'envelope-encryption-service',
          sessionId: 'encryption-session'
        },
        true,
        undefined,
        {
          dataKeyId: encryptedData.dataKeyId,
          originalSize: data.length,
          encryptedSize: encryptedData.encryptedContent.length,
          compressionUsed: config.compressionEnabled || false,
          integrityCheckEnabled: config.integrityCheckEnabled || false
        }
      );

      return envelope;
    } catch (error) {
      // Log encryption failure
      await auditLoggingService.logAction(
        encryptedBy,
        'system',
        'encrypt',
        'evidence_data',
        evidenceId,
        `Evidence encryption failed: ${error.message}`,
        {
          ipAddress: '127.0.0.1',
          userAgent: 'envelope-encryption-service',
          sessionId: 'encryption-session'
        },
        false,
        error.message
      );

      throw error;
    }
  }

  async decryptEvidence(
    envelopeId: string,
    decryptedBy: string,
    verifyIntegrity: boolean = true
  ): Promise<DecryptionResult> {
    const envelope = this.encryptedEnvelopes.get(envelopeId);
    if (!envelope) {
      throw new Error(`Encrypted envelope not found: ${envelopeId}`);
    }

    try {
      // Reconstruct encrypted data object
      const encryptedData = {
        dataKeyId: envelope.dataKeyId,
        encryptedContent: Buffer.from(envelope.encryptedContent, 'base64'),
        iv: Buffer.from(envelope.iv, 'base64'),
        authTag: Buffer.from(envelope.authTag, 'base64'),
        algorithm: envelope.algorithm,
        metadata: envelope.metadata
      };

      // Decrypt using envelope encryption
      let decryptedData = await keyManagementService.decryptData(encryptedData, decryptedBy);

      // Verify integrity if enabled and requested
      let integrityVerified = true;
      if (verifyIntegrity && envelope.integrityHash) {
        const currentHash = await this.calculateIntegrityHash(decryptedData);
        integrityVerified = currentHash === envelope.integrityHash;
        
        if (!integrityVerified) {
          throw new Error('Integrity verification failed - data may have been tampered with');
        }
      }

      // Decompress if compression was used
      if (envelope.compressionUsed) {
        decryptedData = await this.decompressData(decryptedData);
      }

      const result: DecryptionResult = {
        data: decryptedData,
        metadata: envelope.metadata,
        decryptedAt: new Date(),
        integrityVerified
      };

      // Log successful decryption
      await auditLoggingService.logAction(
        decryptedBy,
        'system',
        'decrypt',
        'evidence_data',
        envelopeId,
        `Evidence decrypted successfully`,
        {
          ipAddress: '127.0.0.1',
          userAgent: 'envelope-encryption-service',
          sessionId: 'decryption-session'
        },
        true,
        undefined,
        {
          dataKeyId: envelope.dataKeyId,
          originalSize: envelope.metadata.originalSize,
          integrityVerified,
          compressionUsed: envelope.compressionUsed
        }
      );

      return result;
    } catch (error) {
      // Log decryption failure
      await auditLoggingService.logAction(
        decryptedBy,
        'system',
        'decrypt',
        'evidence_data',
        envelopeId,
        `Evidence decryption failed: ${error.message}`,
        {
          ipAddress: '127.0.0.1',
          userAgent: 'envelope-encryption-service',
          sessionId: 'decryption-session'
        },
        false,
        error.message
      );

      throw error;
    }
  }

  async encryptPII(
    data: Buffer,
    dataId: string,
    encryptedBy: string,
    retentionPeriod?: number // days
  ): Promise<EncryptedEnvelope> {
    const config: EnvelopeEncryptionConfig = {
      purpose: 'pii_encryption',
      compressionEnabled: true,
      integrityCheckEnabled: true,
      metadata: {
        dataType: 'pii',
        retentionPeriod,
        encryptedAt: new Date().toISOString()
      }
    };

    return await this.encryptEvidence(data, dataId, encryptedBy, config);
  }

  async encryptDocument(
    data: Buffer,
    documentId: string,
    encryptedBy: string,
    classification: 'public' | 'confidential' | 'restricted' | 'top_secret'
  ): Promise<EncryptedEnvelope> {
    const config: EnvelopeEncryptionConfig = {
      purpose: 'document_encryption',
      compressionEnabled: true,
      integrityCheckEnabled: true,
      metadata: {
        dataType: 'document',
        classification,
        encryptedAt: new Date().toISOString()
      }
    };

    return await this.encryptEvidence(data, documentId, encryptedBy, config);
  }

  async encryptBackup(
    data: Buffer,
    backupId: string,
    encryptedBy: string,
    backupType: 'full' | 'incremental' | 'differential'
  ): Promise<EncryptedEnvelope> {
    const config: EnvelopeEncryptionConfig = {
      purpose: 'backup_encryption',
      compressionEnabled: true,
      integrityCheckEnabled: true,
      metadata: {
        dataType: 'backup',
        backupType,
        encryptedAt: new Date().toISOString()
      }
    };

    return await this.encryptEvidence(data, backupId, encryptedBy, config);
  }

  async rotateDataKeys(masterKeyId: string): Promise<{
    rotatedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    const envelopesToRotate = Array.from(this.encryptedEnvelopes.values())
      .filter(envelope => {
        const dataKey = keyManagementService.getDataKey(envelope.dataKeyId);
        return dataKey?.masterKeyId === masterKeyId;
      });

    let rotatedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const envelope of envelopesToRotate) {
      try {
        // Decrypt with old key
        const decryptedData = await this.decryptEvidence(envelope.id, 'system', false);
        
        // Re-encrypt with new key
        const newEnvelope = await this.encryptEvidence(
          decryptedData.data,
          envelope.id,
          'system',
          {
            purpose: envelope.metadata.purpose,
            compressionEnabled: envelope.compressionUsed,
            integrityCheckEnabled: !!envelope.integrityHash,
            metadata: envelope.metadata
          }
        );

        // Replace old envelope
        this.encryptedEnvelopes.set(envelope.id, newEnvelope);
        rotatedCount++;
      } catch (error) {
        failedCount++;
        errors.push(`Failed to rotate ${envelope.id}: ${error.message}`);
      }
    }

    // Log rotation results
    await auditLoggingService.logAction(
      'system',
      'key_rotation_service',
      'rotate',
      'data_keys',
      masterKeyId,
      `Data key rotation completed: ${rotatedCount} success, ${failedCount} failed`,
      {
        ipAddress: '127.0.0.1',
        userAgent: 'key-rotation-service',
        sessionId: 'rotation-session'
      },
      failedCount === 0,
      failedCount > 0 ? `${failedCount} rotations failed` : undefined,
      {
        totalEnvelopes: envelopesToRotate.length,
        rotatedCount,
        failedCount
      }
    );

    return { rotatedCount, failedCount, errors };
  }

  async verifyAllIntegrity(): Promise<{
    totalChecked: number;
    integrityValid: number;
    integrityFailed: string[];
  }> {
    const envelopes = Array.from(this.encryptedEnvelopes.values())
      .filter(envelope => envelope.integrityHash);

    let integrityValid = 0;
    const integrityFailed: string[] = [];

    for (const envelope of envelopes) {
      try {
        const result = await this.decryptEvidence(envelope.id, 'system', true);
        if (result.integrityVerified) {
          integrityValid++;
        } else {
          integrityFailed.push(envelope.id);
        }
      } catch (error) {
        integrityFailed.push(`${envelope.id}: ${error.message}`);
      }
    }

    return {
      totalChecked: envelopes.length,
      integrityValid,
      integrityFailed
    };
  }

  async getEncryptionMetrics(startDate?: Date, endDate?: Date): Promise<any> {
    let envelopes = Array.from(this.encryptedEnvelopes.values());

    if (startDate) {
      envelopes = envelopes.filter(e => e.createdAt >= startDate);
    }

    if (endDate) {
      envelopes = envelopes.filter(e => e.createdAt <= endDate);
    }

    const purposeCounts = envelopes.reduce((acc, envelope) => {
      const purpose = envelope.metadata.purpose || 'unknown';
      acc[purpose] = (acc[purpose] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalOriginalSize = envelopes.reduce((sum, e) => sum + (e.metadata.originalSize || 0), 0);
    const totalEncryptedSize = envelopes.reduce((sum, e) => sum + (e.metadata.encryptedSize || 0), 0);
    const compressionRatio = totalOriginalSize > 0 ? totalEncryptedSize / totalOriginalSize : 1;

    return {
      totalEnvelopes: envelopes.length,
      purposeDistribution: purposeCounts,
      compressionRatio,
      totalOriginalSize,
      totalEncryptedSize,
      averageCompressionSavings: (1 - compressionRatio) * 100,
      integrityProtectedCount: envelopes.filter(e => e.integrityHash).length,
      compressionEnabledCount: envelopes.filter(e => e.compressionUsed).length
    };
  }

  private async compressData(data: Buffer): Promise<Buffer> {
    // Mock compression - would use actual compression library like zlib
    const compressionRatio = 0.7; // 30% compression
    const compressedSize = Math.floor(data.length * compressionRatio);
    const compressed = Buffer.alloc(compressedSize);
    data.copy(compressed, 0, 0, compressedSize);
    return compressed;
  }

  private async decompressData(data: Buffer): Promise<Buffer> {
    // Mock decompression - would use actual decompression
    const expansionRatio = 1.43; // Reverse of 0.7 compression
    const decompressedSize = Math.floor(data.length * expansionRatio);
    const decompressed = Buffer.alloc(decompressedSize);
    data.copy(decompressed, 0, 0, Math.min(data.length, decompressedSize));
    return decompressed;
  }

  private async calculateIntegrityHash(data: Buffer): Promise<string> {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Query methods
  getEncryptedEnvelope(envelopeId: string): EncryptedEnvelope | undefined {
    return this.encryptedEnvelopes.get(envelopeId);
  }

  listEncryptedEnvelopes(purpose?: KeyPurpose): EncryptedEnvelope[] {
    let envelopes = Array.from(this.encryptedEnvelopes.values());
    
    if (purpose) {
      envelopes = envelopes.filter(e => e.metadata.purpose === purpose);
    }
    
    return envelopes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getEnvelopesByEncryptor(encryptedBy: string): EncryptedEnvelope[] {
    return Array.from(this.encryptedEnvelopes.values())
      .filter(e => e.encryptedBy === encryptedBy)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export const envelopeEncryptionService = new EnvelopeEncryptionService();