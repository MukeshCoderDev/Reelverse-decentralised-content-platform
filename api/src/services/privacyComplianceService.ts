import { Pool } from 'pg';
import Redis from 'ioredis';
import { createUnifiedError } from '../middleware/unifiedErrorHandler';
import { logger, logAudit } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';

export interface DataExportRequest {
  id: string;
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  exportType: 'gdpr' | 'ccpa' | 'custom';
  dataTypes: DataType[];
  downloadUrl?: string;
  expiresAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface DataDeletionRequest {
  id: string;
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  deletionType: 'full' | 'partial' | 'anonymization';
  dataTypes: DataType[];
  retentionPeriod?: number; // days
  completedAt?: Date;
  errorMessage?: string;
  verificationRequired: boolean;
  verificationToken?: string;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
  ipAddress: string;
  userAgent: string;
  version: string;
  metadata?: Record<string, any>;
}

export interface DataRetentionPolicy {
  id: string;
  dataType: DataType;
  retentionPeriod: number; // days
  autoDelete: boolean;
  legalBasis: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PIIAccessLog {
  id: string;
  userId: string;
  accessedBy: string;
  accessType: 'view' | 'export' | 'modify' | 'delete';
  dataTypes: DataType[];
  purpose: string;
  ipAddress: string;
  timestamp: Date;
  correlationId?: string;
}

export type DataType = 
  | 'profile' 
  | 'content' 
  | 'financial' 
  | 'analytics' 
  | 'communications' 
  | 'verification' 
  | 'consent' 
  | 'logs';

export type ConsentType = 
  | 'essential' 
  | 'analytics' 
  | 'marketing' 
  | 'personalization' 
  | 'third_party' 
  | 'data_processing';

export class PrivacyComplianceService {
  private db: Pool;
  private redis: Redis;
  private exportPath: string;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
    this.exportPath = process.env.DATA_EXPORT_PATH || './data-exports';
    this.initializeRetentionPolicies();
    this.startRetentionCleanup();
  }

  /**
   * Request data export (GDPR/CCPA compliance)
   */
  async requestDataExport(
    userId: string, 
    exportType: 'gdpr' | 'ccpa' | 'custom',
    dataTypes: DataType[],
    requestedBy: string,
    correlationId?: string
  ): Promise<DataExportRequest> {
    try {
      const requestId = uuidv4();
      const request: DataExportRequest = {
        id: requestId,
        userId,
        requestedAt: new Date(),
        status: 'pending',
        exportType,
        dataTypes,
      };

      // Store request in database
      await this.db.query(`
        INSERT INTO data_export_requests 
        (id, user_id, requested_at, status, export_type, data_types, requested_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        request.id,
        request.userId,
        request.requestedAt,
        request.status,
        request.exportType,
        JSON.stringify(request.dataTypes),
        requestedBy
      ]);

      // Log the request
      logAudit('Data export requested', userId, {
        requestId,
        exportType,
        dataTypes,
        requestedBy,
        correlationId
      });

      // Queue for processing
      await this.redis.lpush('data_export_queue', JSON.stringify(request));

      return request;
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to create data export request',
        { error: error.message, userId, exportType },
        false,
        correlationId
      );
    }
  }

  /**
   * Process data export request
   */
  async processDataExport(requestId: string): Promise<void> {
    try {
      // Update status to processing
      await this.updateExportStatus(requestId, 'processing');

      // Get request details
      const result = await this.db.query(
        'SELECT * FROM data_export_requests WHERE id = $1',
        [requestId]
      );

      if (result.rows.length === 0) {
        throw new Error('Export request not found');
      }

      const request = result.rows[0];
      const dataTypes = JSON.parse(request.data_types);

      // Create export directory
      const exportDir = path.join(this.exportPath, requestId);
      await fs.mkdir(exportDir, { recursive: true });

      // Export each data type
      const exportedFiles: string[] = [];
      
      for (const dataType of dataTypes) {
        const filePath = await this.exportDataType(request.user_id, dataType, exportDir);
        if (filePath) {
          exportedFiles.push(filePath);
        }
      }

      // Create ZIP archive
      const zipPath = path.join(this.exportPath, `${requestId}.zip`);
      await this.createZipArchive(exportedFiles, zipPath);

      // Generate download URL (signed URL with expiration)
      const downloadUrl = await this.generateDownloadUrl(requestId);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Update request with completion details
      await this.db.query(`
        UPDATE data_export_requests 
        SET status = $1, download_url = $2, expires_at = $3, completed_at = $4
        WHERE id = $5
      `, ['completed', downloadUrl, expiresAt, new Date(), requestId]);

      // Clean up temporary files
      await fs.rm(exportDir, { recursive: true, force: true });

      // Log completion
      logAudit('Data export completed', request.user_id, {
        requestId,
        exportedDataTypes: dataTypes,
        downloadUrl: downloadUrl ? 'generated' : 'failed'
      });

    } catch (error) {
      await this.updateExportStatus(requestId, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Request data deletion (Right to be forgotten)
   */
  async requestDataDeletion(
    userId: string,
    deletionType: 'full' | 'partial' | 'anonymization',
    dataTypes: DataType[],
    requestedBy: string,
    correlationId?: string
  ): Promise<DataDeletionRequest> {
    try {
      const requestId = uuidv4();
      const verificationToken = uuidv4();
      
      const request: DataDeletionRequest = {
        id: requestId,
        userId,
        requestedAt: new Date(),
        status: 'pending',
        deletionType,
        dataTypes,
        verificationRequired: true,
        verificationToken,
      };

      // Store request in database
      await this.db.query(`
        INSERT INTO data_deletion_requests 
        (id, user_id, requested_at, status, deletion_type, data_types, verification_required, verification_token, requested_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        request.id,
        request.userId,
        request.requestedAt,
        request.status,
        request.deletionType,
        JSON.stringify(request.dataTypes),
        request.verificationRequired,
        request.verificationToken,
        requestedBy
      ]);

      // Send verification email (implement based on your email service)
      await this.sendDeletionVerificationEmail(userId, verificationToken);

      // Log the request
      logAudit('Data deletion requested', userId, {
        requestId,
        deletionType,
        dataTypes,
        requestedBy,
        correlationId
      });

      return request;
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to create data deletion request',
        { error: error.message, userId, deletionType },
        false,
        correlationId
      );
    }
  }

  /**
   * Verify and process data deletion
   */
  async verifyAndProcessDeletion(verificationToken: string): Promise<void> {
    try {
      // Get deletion request by verification token
      const result = await this.db.query(
        'SELECT * FROM data_deletion_requests WHERE verification_token = $1 AND status = $2',
        [verificationToken, 'pending']
      );

      if (result.rows.length === 0) {
        throw createUnifiedError.notFound('Invalid or expired verification token');
      }

      const request = result.rows[0];
      const dataTypes = JSON.parse(request.data_types);

      // Update status to processing
      await this.updateDeletionStatus(request.id, 'processing');

      // Process deletion based on type
      if (request.deletion_type === 'full') {
        await this.performFullDeletion(request.user_id);
      } else if (request.deletion_type === 'partial') {
        await this.performPartialDeletion(request.user_id, dataTypes);
      } else if (request.deletion_type === 'anonymization') {
        await this.performAnonymization(request.user_id, dataTypes);
      }

      // Update request status
      await this.updateDeletionStatus(request.id, 'completed');

      // Log completion
      logAudit('Data deletion completed', request.user_id, {
        requestId: request.id,
        deletionType: request.deletion_type,
        dataTypes
      });

    } catch (error) {
      throw error;
    }
  }

  /**
   * Record consent
   */
  async recordConsent(
    userId: string,
    consentType: ConsentType,
    granted: boolean,
    ipAddress: string,
    userAgent: string,
    version: string = '1.0',
    metadata?: Record<string, any>
  ): Promise<ConsentRecord> {
    try {
      const consentId = uuidv4();
      const timestamp = new Date();

      const consent: ConsentRecord = {
        id: consentId,
        userId,
        consentType,
        granted,
        grantedAt: granted ? timestamp : undefined,
        revokedAt: !granted ? timestamp : undefined,
        ipAddress,
        userAgent,
        version,
        metadata,
      };

      // Store consent record
      await this.db.query(`
        INSERT INTO consent_records 
        (id, user_id, consent_type, granted, granted_at, revoked_at, ip_address, user_agent, version, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        consent.id,
        consent.userId,
        consent.consentType,
        consent.granted,
        consent.grantedAt,
        consent.revokedAt,
        consent.ipAddress,
        consent.userAgent,
        consent.version,
        JSON.stringify(consent.metadata)
      ]);

      // Update user's current consent status
      await this.updateUserConsentStatus(userId, consentType, granted);

      // Log consent change
      logAudit(`Consent ${granted ? 'granted' : 'revoked'}`, userId, {
        consentType,
        consentId,
        ipAddress,
        userAgent
      });

      return consent;
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to record consent',
        { error: error.message, userId, consentType },
        false
      );
    }
  }

  /**
   * Log PII access
   */
  async logPIIAccess(
    userId: string,
    accessedBy: string,
    accessType: 'view' | 'export' | 'modify' | 'delete',
    dataTypes: DataType[],
    purpose: string,
    ipAddress: string,
    correlationId?: string
  ): Promise<void> {
    try {
      const logId = uuidv4();
      
      const accessLog: PIIAccessLog = {
        id: logId,
        userId,
        accessedBy,
        accessType,
        dataTypes,
        purpose,
        ipAddress,
        timestamp: new Date(),
        correlationId,
      };

      // Store access log
      await this.db.query(`
        INSERT INTO pii_access_logs 
        (id, user_id, accessed_by, access_type, data_types, purpose, ip_address, timestamp, correlation_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        accessLog.id,
        accessLog.userId,
        accessLog.accessedBy,
        accessLog.accessType,
        JSON.stringify(accessLog.dataTypes),
        accessLog.purpose,
        accessLog.ipAddress,
        accessLog.timestamp,
        accessLog.correlationId
      ]);

      // Log audit trail
      logAudit('PII accessed', userId, {
        accessedBy,
        accessType,
        dataTypes,
        purpose,
        correlationId
      });

    } catch (error) {
      logger.error('Failed to log PII access', error, {
        userId,
        accessedBy,
        accessType,
        correlationId
      });
    }
  }

  /**
   * Get user's consent status
   */
  async getUserConsentStatus(userId: string): Promise<Record<ConsentType, boolean>> {
    try {
      const result = await this.db.query(
        'SELECT consent_type, granted FROM user_consent_status WHERE user_id = $1',
        [userId]
      );

      const consentStatus: Record<string, boolean> = {};
      result.rows.forEach(row => {
        consentStatus[row.consent_type] = row.granted;
      });

      // Set defaults for missing consent types
      const defaultConsents: Record<ConsentType, boolean> = {
        essential: true, // Essential cookies are always required
        analytics: false,
        marketing: false,
        personalization: false,
        third_party: false,
        data_processing: false,
      };

      return { ...defaultConsents, ...consentStatus } as Record<ConsentType, boolean>;
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to get consent status',
        { error: error.message, userId },
        false
      );
    }
  }

  /**
   * Export specific data type
   */
  private async exportDataType(userId: string, dataType: DataType, exportDir: string): Promise<string | null> {
    try {
      let data: any = null;
      let filename = '';

      switch (dataType) {
        case 'profile':
          data = await this.exportProfileData(userId);
          filename = 'profile.json';
          break;
        case 'content':
          data = await this.exportContentData(userId);
          filename = 'content.json';
          break;
        case 'financial':
          data = await this.exportFinancialData(userId);
          filename = 'financial.json';
          break;
        case 'analytics':
          data = await this.exportAnalyticsData(userId);
          filename = 'analytics.json';
          break;
        case 'communications':
          data = await this.exportCommunicationsData(userId);
          filename = 'communications.json';
          break;
        case 'verification':
          data = await this.exportVerificationData(userId);
          filename = 'verification.json';
          break;
        case 'consent':
          data = await this.exportConsentData(userId);
          filename = 'consent.json';
          break;
        case 'logs':
          data = await this.exportLogsData(userId);
          filename = 'logs.json';
          break;
        default:
          return null;
      }

      if (data) {
        const filePath = path.join(exportDir, filename);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        return filePath;
      }

      return null;
    } catch (error) {
      logger.error(`Failed to export ${dataType} data for user ${userId}`, error);
      return null;
    }
  }

  /**
   * Export profile data
   */
  private async exportProfileData(userId: string): Promise<any> {
    const result = await this.db.query(`
      SELECT id, email, username, display_name, bio, avatar_url, 
             created_at, updated_at, last_login_at, email_verified_at
      FROM users WHERE id = $1
    `, [userId]);

    return result.rows[0] || null;
  }

  /**
   * Export content data
   */
  private async exportContentData(userId: string): Promise<any> {
    const result = await this.db.query(`
      SELECT id, title, description, content_url, thumbnail_url, 
             duration, file_size, upload_status, created_at, updated_at
      FROM content WHERE creator_id = $1
    `, [userId]);

    return result.rows;
  }

  /**
   * Export financial data
   */
  private async exportFinancialData(userId: string): Promise<any> {
    const transactions = await this.db.query(`
      SELECT id, amount, currency, transaction_type, status, 
             created_at, updated_at
      FROM transactions WHERE user_id = $1
    `, [userId]);

    const payouts = await this.db.query(`
      SELECT id, amount, currency, payout_method, status, 
             created_at, processed_at
      FROM payouts WHERE user_id = $1
    `, [userId]);

    return {
      transactions: transactions.rows,
      payouts: payouts.rows,
    };
  }

  /**
   * Export analytics data
   */
  private async exportAnalyticsData(userId: string): Promise<any> {
    const views = await this.db.query(`
      SELECT content_id, view_count, unique_viewers, total_watch_time,
             date_recorded
      FROM content_analytics WHERE creator_id = $1
    `, [userId]);

    const engagement = await this.db.query(`
      SELECT event_type, content_id, timestamp, metadata
      FROM user_engagement WHERE user_id = $1
    `, [userId]);

    return {
      contentViews: views.rows,
      userEngagement: engagement.rows,
    };
  }

  /**
   * Export communications data
   */
  private async exportCommunicationsData(userId: string): Promise<any> {
    const messages = await this.db.query(`
      SELECT id, conversation_id, message_content, sent_at, read_at
      FROM messages WHERE sender_id = $1 OR recipient_id = $1
    `, [userId]);

    const notifications = await this.db.query(`
      SELECT id, notification_type, title, message, sent_at, read_at
      FROM notifications WHERE user_id = $1
    `, [userId]);

    return {
      messages: messages.rows,
      notifications: notifications.rows,
    };
  }

  /**
   * Export verification data
   */
  private async exportVerificationData(userId: string): Promise<any> {
    const verifications = await this.db.query(`
      SELECT id, verification_type, status, verified_at, expires_at,
             verification_data
      FROM user_verifications WHERE user_id = $1
    `, [userId]);

    return verifications.rows;
  }

  /**
   * Export consent data
   */
  private async exportConsentData(userId: string): Promise<any> {
    const consents = await this.db.query(`
      SELECT id, consent_type, granted, granted_at, revoked_at,
             ip_address, user_agent, version, metadata
      FROM consent_records WHERE user_id = $1
    `, [userId]);

    return consents.rows;
  }

  /**
   * Export logs data
   */
  private async exportLogsData(userId: string): Promise<any> {
    const accessLogs = await this.db.query(`
      SELECT id, accessed_by, access_type, data_types, purpose,
             ip_address, timestamp
      FROM pii_access_logs WHERE user_id = $1
    `, [userId]);

    const loginLogs = await this.db.query(`
      SELECT id, ip_address, user_agent, login_at, logout_at,
             login_method
      FROM login_logs WHERE user_id = $1
    `, [userId]);

    return {
      piiAccess: accessLogs.rows,
      loginHistory: loginLogs.rows,
    };
  }

  /**
   * Create ZIP archive
   */
  private async createZipArchive(files: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);

      files.forEach(file => {
        archive.file(file, { name: path.basename(file) });
      });

      archive.finalize();
    });
  }

  /**
   * Generate signed download URL
   */
  private async generateDownloadUrl(requestId: string): Promise<string> {
    // This would typically generate a signed URL for cloud storage
    // For now, return a simple URL with token
    const token = uuidv4();
    await this.redis.setex(`download_token:${token}`, 30 * 24 * 60 * 60, requestId); // 30 days
    return `/api/v1/privacy/download/${token}`;
  }

  /**
   * Update export status
   */
  private async updateExportStatus(requestId: string, status: string, errorMessage?: string): Promise<void> {
    await this.db.query(`
      UPDATE data_export_requests 
      SET status = $1, error_message = $2, updated_at = $3
      WHERE id = $4
    `, [status, errorMessage, new Date(), requestId]);
  }

  /**
   * Update deletion status
   */
  private async updateDeletionStatus(requestId: string, status: string, errorMessage?: string): Promise<void> {
    await this.db.query(`
      UPDATE data_deletion_requests 
      SET status = $1, error_message = $2, updated_at = $3
      WHERE id = $4
    `, [status, errorMessage, new Date(), requestId]);
  }

  /**
   * Update user consent status
   */
  private async updateUserConsentStatus(userId: string, consentType: ConsentType, granted: boolean): Promise<void> {
    await this.db.query(`
      INSERT INTO user_consent_status (user_id, consent_type, granted, updated_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, consent_type) 
      DO UPDATE SET granted = $3, updated_at = $4
    `, [userId, consentType, granted, new Date()]);
  }

  /**
   * Send deletion verification email
   */
  private async sendDeletionVerificationEmail(userId: string, verificationToken: string): Promise<void> {
    // Implement email sending logic based on your email service
    // This is a placeholder
    logger.info(`Deletion verification email sent to user ${userId} with token ${verificationToken}`);
  }

  /**
   * Perform full deletion
   */
  private async performFullDeletion(userId: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Delete from all user-related tables
      const tables = [
        'user_consent_status',
        'consent_records',
        'pii_access_logs',
        'login_logs',
        'user_verifications',
        'notifications',
        'messages',
        'user_engagement',
        'content_analytics',
        'payouts',
        'transactions',
        'content',
        'users'
      ];

      for (const table of tables) {
        await client.query(`DELETE FROM ${table} WHERE user_id = $1 OR creator_id = $1 OR sender_id = $1 OR recipient_id = $1`, [userId]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Perform partial deletion
   */
  private async performPartialDeletion(userId: string, dataTypes: DataType[]): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      for (const dataType of dataTypes) {
        switch (dataType) {
          case 'profile':
            await client.query('UPDATE users SET email = NULL, username = NULL, display_name = NULL, bio = NULL, avatar_url = NULL WHERE id = $1', [userId]);
            break;
          case 'content':
            await client.query('DELETE FROM content WHERE creator_id = $1', [userId]);
            break;
          case 'financial':
            await client.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM payouts WHERE user_id = $1', [userId]);
            break;
          case 'analytics':
            await client.query('DELETE FROM content_analytics WHERE creator_id = $1', [userId]);
            await client.query('DELETE FROM user_engagement WHERE user_id = $1', [userId]);
            break;
          case 'communications':
            await client.query('DELETE FROM messages WHERE sender_id = $1 OR recipient_id = $1', [userId]);
            await client.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
            break;
          case 'verification':
            await client.query('DELETE FROM user_verifications WHERE user_id = $1', [userId]);
            break;
          case 'consent':
            await client.query('DELETE FROM consent_records WHERE user_id = $1', [userId]);
            break;
          case 'logs':
            await client.query('DELETE FROM pii_access_logs WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM login_logs WHERE user_id = $1', [userId]);
            break;
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Perform anonymization
   */
  private async performAnonymization(userId: string, dataTypes: DataType[]): Promise<void> {
    const client = await this.db.connect();
    const anonymousId = `anon_${uuidv4()}`;
    
    try {
      await client.query('BEGIN');

      for (const dataType of dataTypes) {
        switch (dataType) {
          case 'profile':
            await client.query(`
              UPDATE users SET 
                email = $1, 
                username = $1, 
                display_name = 'Anonymous User',
                bio = NULL,
                avatar_url = NULL
              WHERE id = $2
            `, [anonymousId, userId]);
            break;
          case 'analytics':
            await client.query('UPDATE user_engagement SET user_id = $1 WHERE user_id = $2', [anonymousId, userId]);
            break;
          case 'communications':
            await client.query('UPDATE messages SET sender_id = $1 WHERE sender_id = $2', [anonymousId, userId]);
            await client.query('UPDATE messages SET recipient_id = $1 WHERE recipient_id = $2', [anonymousId, userId]);
            break;
          case 'logs':
            await client.query('UPDATE pii_access_logs SET user_id = $1 WHERE user_id = $2', [anonymousId, userId]);
            await client.query('UPDATE login_logs SET user_id = $1 WHERE user_id = $2', [anonymousId, userId]);
            break;
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Initialize default retention policies
   */
  private async initializeRetentionPolicies(): Promise<void> {
    const defaultPolicies: Omit<DataRetentionPolicy, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        dataType: 'logs',
        retentionPeriod: 365, // 1 year
        autoDelete: true,
        legalBasis: 'Legitimate interest for security and fraud prevention'
      },
      {
        dataType: 'analytics',
        retentionPeriod: 1095, // 3 years
        autoDelete: true,
        legalBasis: 'Legitimate interest for business analytics'
      },
      {
        dataType: 'financial',
        retentionPeriod: 2555, // 7 years (tax requirements)
        autoDelete: false,
        legalBasis: 'Legal obligation for tax compliance'
      },
      {
        dataType: 'communications',
        retentionPeriod: 1095, // 3 years
        autoDelete: true,
        legalBasis: 'Legitimate interest for customer support'
      }
    ];

    for (const policy of defaultPolicies) {
      try {
        await this.db.query(`
          INSERT INTO data_retention_policies 
          (id, data_type, retention_period, auto_delete, legal_basis, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (data_type) DO NOTHING
        `, [
          uuidv4(),
          policy.dataType,
          policy.retentionPeriod,
          policy.autoDelete,
          policy.legalBasis,
          new Date(),
          new Date()
        ]);
      } catch (error) {
        logger.error(`Failed to initialize retention policy for ${policy.dataType}`, error);
      }
    }
  }

  /**
   * Start automatic retention cleanup
   */
  private startRetentionCleanup(): void {
    // Run cleanup daily at 2 AM
    setInterval(async () => {
      try {
        await this.performRetentionCleanup();
      } catch (error) {
        logger.error('Retention cleanup failed', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Perform retention cleanup
   */
  private async performRetentionCleanup(): Promise<void> {
    try {
      const policies = await this.db.query(
        'SELECT * FROM data_retention_policies WHERE auto_delete = true'
      );

      for (const policy of policies.rows) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retention_period);

        let deletedCount = 0;

        switch (policy.data_type) {
          case 'logs':
            const logResult = await this.db.query(
              'DELETE FROM pii_access_logs WHERE timestamp < $1',
              [cutoffDate]
            );
            deletedCount += logResult.rowCount || 0;

            const loginResult = await this.db.query(
              'DELETE FROM login_logs WHERE login_at < $1',
              [cutoffDate]
            );
            deletedCount += loginResult.rowCount || 0;
            break;

          case 'analytics':
            const analyticsResult = await this.db.query(
              'DELETE FROM user_engagement WHERE timestamp < $1',
              [cutoffDate]
            );
            deletedCount += analyticsResult.rowCount || 0;
            break;

          case 'communications':
            const messagesResult = await this.db.query(
              'DELETE FROM messages WHERE sent_at < $1',
              [cutoffDate]
            );
            deletedCount += messagesResult.rowCount || 0;

            const notificationsResult = await this.db.query(
              'DELETE FROM notifications WHERE sent_at < $1',
              [cutoffDate]
            );
            deletedCount += notificationsResult.rowCount || 0;
            break;
        }

        if (deletedCount > 0) {
          logger.info(`Retention cleanup: Deleted ${deletedCount} records for ${policy.data_type}`);
        }
      }
    } catch (error) {
      logger.error('Error during retention cleanup', error);
    }
  }
}