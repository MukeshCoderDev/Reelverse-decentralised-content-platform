import { getDatabase } from '../../config/database';
import { logger } from '../../utils/logger';
import { getStorageService, ResumableStorageService, UploadPart } from '../storage/resumableStorageService';
import { 
  calculateOptimalChunkSize, 
  validateFileSize, 
  validateMimeType, 
  sanitizeFilename 
} from '../../utils/contentRange';
import { v4 as uuidv4 } from 'uuid';

export type UploadStatus = 
  | 'uploading' 
  | 'uploaded' 
  | 'processing' 
  | 'playable' 
  | 'hd_ready' 
  | 'failed' 
  | 'aborted';

export interface UploadSession {
  id: string;
  userId: string;
  filename: string;
  mimeType: string;
  totalBytes: number;
  chunkSize: number;
  storageKey: string;
  storageUploadId?: string;
  bytesReceived: number;
  parts: UploadPart[];
  status: UploadStatus;
  idempotencyKey?: string;
  errorCode?: string;
  cid?: string;
  pinStatus?: string;
  playbackUrl?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionParams {
  userId: string;
  filename: string;
  size: number;
  mimeType: string;
  idempotencyKey?: string;
}

export interface ContentDraft {
  id: string;
  uploadId: string;
  userId: string;
  title?: string;
  description?: string;
  tags?: string[];
  visibility?: string;
  category?: string;
  thumbnailUrl?: string;
}

export interface CreateDraftParams {
  uploadId: string;
  userId: string;
  title?: string;
  description?: string;
  tags?: string[];
  visibility?: string;
  category?: string;
}

export interface UpdateDraftParams {
  title?: string;
  description?: string;
  tags?: string[];
  visibility?: string;
  category?: string;
  thumbnailUrl?: string;
}

export interface UploadMetric {
  uploadId: string;
  userId: string;
  eventType: string;
  chunkNumber?: number;
  chunkSizeBytes?: number;
  processingTimeMs?: number;
  errorCode?: string;
  clientIp?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Upload Session Management Service
 * 
 * Handles YouTube/Google-style resumable upload sessions with
 * PostgreSQL persistence and S3/R2/GCS storage backend.
 */
export class UploadSessionService {
  private db = getDatabase();
  private storage: ResumableStorageService;

  constructor() {
    this.storage = getStorageService();
  }

  /**
   * Create a new upload session with idempotency support
   */
  async createSession(params: CreateSessionParams): Promise<UploadSession> {
    const { userId, filename, size, mimeType, idempotencyKey } = params;

    // Validate inputs
    const fileSizeValidation = validateFileSize(size);
    if (!fileSizeValidation.valid) {
      throw new Error(fileSizeValidation.error);
    }

    const mimeTypeValidation = validateMimeType(mimeType);
    if (!mimeTypeValidation.valid) {
      throw new Error(mimeTypeValidation.error);
    }

    // Check for existing session with same idempotency key
    if (idempotencyKey) {
      const existing = await this.findSessionByIdempotencyKey(userId, idempotencyKey);
      if (existing) {
        logger.info('Returning existing session for idempotency key', {
          userId,
          idempotencyKey,
          sessionId: existing.id,
        });
        return existing;
      }
    }

    const sessionId = uuidv4();
    const sanitizedFilename = sanitizeFilename(filename);
    const chunkSize = calculateOptimalChunkSize(size);
    const storageKey = ResumableStorageService.generateStorageKey(userId, sessionId, sanitizedFilename);
    const expiresAt = new Date(Date.now() + (parseInt(process.env.UPLOAD_SESSION_TTL_HOURS || '24', 10) * 60 * 60 * 1000));

    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Create multipart upload in storage
      const multipartUpload = await this.storage.createMultipartUpload(
        process.env.STORAGE_BUCKET_UPLOADS!,
        storageKey,
        mimeType
      );

      // Insert session into database
      const sessionQuery = `
        INSERT INTO upload_sessions (
          id, user_id, filename, mime_type, total_bytes, chunk_size, 
          storage_key, storage_upload_id, idempotency_key, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const sessionResult = await client.query(sessionQuery, [
        sessionId,
        userId,
        sanitizedFilename,
        mimeType,
        size,
        chunkSize,
        storageKey,
        multipartUpload.uploadId,
        idempotencyKey,
        expiresAt,
      ]);

      await client.query('COMMIT');

      const session = this.mapRowToSession(sessionResult.rows[0]);

      // Log metrics
      await this.recordMetric({
        uploadId: sessionId,
        userId,
        eventType: 'session_created',
        metadata: {
          filename: sanitizedFilename,
          size,
          mimeType,
          chunkSize,
        },
      });

      logger.info('Created upload session', {
        sessionId,
        userId,
        filename: sanitizedFilename,
        size,
        chunkSize,
        storageKey,
      });

      return session;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create upload session', {
        userId,
        filename,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get upload session by ID
   */
  async getSession(sessionId: string): Promise<UploadSession | null> {
    const query = 'SELECT * FROM upload_sessions WHERE id = $1';
    const result = await this.db.query(query, [sessionId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSession(result.rows[0]);
  }

  /**
   * Update session with new part data
   */
  async updateSessionWithPart(sessionId: string, part: UploadPart): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Get current session
      const sessionQuery = 'SELECT parts, bytes_received FROM upload_sessions WHERE id = $1 FOR UPDATE';
      const sessionResult = await client.query(sessionQuery, [sessionId]);
      
      if (sessionResult.rows.length === 0) {
        throw new Error('Session not found');
      }

      const currentParts = sessionResult.rows[0].parts || [];
      const currentBytesReceived = sessionResult.rows[0].bytes_received || 0;

      // Check if part already exists (idempotent)
      const existingPartIndex = currentParts.findIndex((p: UploadPart) => p.partNumber === part.partNumber);
      
      let updatedParts;
      let newBytesReceived;

      if (existingPartIndex >= 0) {
        // Part already exists - this is idempotent, no change needed
        updatedParts = currentParts;
        newBytesReceived = currentBytesReceived;
        logger.debug('Part already exists, skipping update', {
          sessionId,
          partNumber: part.partNumber,
        });
      } else {
        // Add new part
        updatedParts = [...currentParts, part];
        newBytesReceived = currentBytesReceived + part.size;
      }

      // Update session
      const updateQuery = `
        UPDATE upload_sessions 
        SET parts = $1, bytes_received = $2, updated_at = NOW()
        WHERE id = $3
      `;

      await client.query(updateQuery, [
        JSON.stringify(updatedParts),
        newBytesReceived,
        sessionId,
      ]);

      await client.query('COMMIT');

      // Log metrics
      await this.recordMetric({
        uploadId: sessionId,
        userId: '', // Will be filled by calling code
        eventType: 'chunk_uploaded',
        chunkNumber: part.partNumber,
        chunkSizeBytes: part.size,
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update session with part', {
        sessionId,
        partNumber: part.partNumber,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId: string, status: UploadStatus, errorCode?: string): Promise<void> {
    const query = `
      UPDATE upload_sessions 
      SET status = $1, error_code = $2, updated_at = NOW()
      WHERE id = $3
    `;

    await this.db.query(query, [status, errorCode, sessionId]);

    logger.info('Updated session status', {
      sessionId,
      status,
      errorCode,
    });
  }

  /**
   * Complete multipart upload and update session
   */
  async completeUpload(sessionId: string): Promise<{ location: string; etag: string }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'uploading') {
      throw new Error(`Cannot complete upload - session status is ${session.status}`);
    }

    if (!session.storageUploadId) {
      throw new Error('No storage upload ID found');
    }

    try {
      // Complete multipart upload in storage
      const result = await this.storage.completeMultipartUpload({
        bucket: process.env.STORAGE_BUCKET_UPLOADS!,
        key: session.storageKey,
        uploadId: session.storageUploadId,
        parts: session.parts,
      });

      // Update session status
      await this.updateSessionStatus(sessionId, 'uploaded');

      // Log metrics
      await this.recordMetric({
        uploadId: sessionId,
        userId: session.userId,
        eventType: 'upload_completed',
        metadata: {
          totalBytes: session.totalBytes,
          totalParts: session.parts.length,
        },
      });

      logger.info('Completed upload', {
        sessionId,
        location: result.location,
        totalBytes: session.totalBytes,
        totalParts: session.parts.length,
      });

      return result;
    } catch (error) {
      await this.updateSessionStatus(sessionId, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Abort upload session and cleanup
   */
  async abortSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      // Abort multipart upload in storage
      if (session.storageUploadId) {
        await this.storage.abortMultipartUpload(
          process.env.STORAGE_BUCKET_UPLOADS!,
          session.storageKey,
          session.storageUploadId
        );
      }

      // Update session status
      await this.updateSessionStatus(sessionId, 'aborted');

      logger.info('Aborted upload session', {
        sessionId,
        userId: session.userId,
      });
    } catch (error) {
      logger.error('Failed to abort session', {
        sessionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find session by idempotency key
   */
  async findSessionByIdempotencyKey(userId: string, idempotencyKey: string): Promise<UploadSession | null> {
    const query = `
      SELECT * FROM upload_sessions 
      WHERE user_id = $1 AND idempotency_key = $2
    `;
    
    const result = await this.db.query(query, [userId, idempotencyKey]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSession(result.rows[0]);
  }

  /**
   * Create content draft for metadata editing
   */
  async createDraft(params: CreateDraftParams): Promise<ContentDraft> {
    const { uploadId, userId, title, description, tags, visibility, category } = params;

    const query = `
      INSERT INTO content_drafts (upload_id, user_id, title, description, tags, visibility, category)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      uploadId,
      userId,
      title,
      description,
      tags,
      visibility || 'public',
      category,
    ]);

    return this.mapRowToDraft(result.rows[0]);
  }

  /**
   * Update content draft
   */
  async updateDraft(draftId: string, params: UpdateDraftParams): Promise<ContentDraft> {
    const { title, description, tags, visibility, category, thumbnailUrl } = params;

    const query = `
      UPDATE content_drafts 
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          tags = COALESCE($3, tags),
          visibility = COALESCE($4, visibility),
          category = COALESCE($5, category),
          thumbnail_url = COALESCE($6, thumbnail_url),
          updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `;

    const result = await this.db.query(query, [
      title,
      description,
      tags,
      visibility,
      category,
      thumbnailUrl,
      draftId,
    ]);

    if (result.rows.length === 0) {
      throw new Error('Draft not found');
    }

    return this.mapRowToDraft(result.rows[0]);
  }

  /**
   * Get content draft by upload ID
   */
  async getDraftByUploadId(uploadId: string): Promise<ContentDraft | null> {
    const query = 'SELECT * FROM content_drafts WHERE upload_id = $1';
    const result = await this.db.query(query, [uploadId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDraft(result.rows[0]);
  }

  /**
   * Record upload metrics
   */
  async recordMetric(metric: UploadMetric): Promise<void> {
    const query = `
      INSERT INTO upload_metrics (
        upload_id, user_id, event_type, chunk_number, chunk_size_bytes,
        processing_time_ms, error_code, client_ip, user_agent, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    try {
      await this.db.query(query, [
        metric.uploadId,
        metric.userId,
        metric.eventType,
        metric.chunkNumber,
        metric.chunkSizeBytes,
        metric.processingTimeMs,
        metric.errorCode,
        metric.clientIp,
        metric.userAgent,
        metric.metadata ? JSON.stringify(metric.metadata) : null,
      ]);
    } catch (error) {
      // Log but don't throw - metrics shouldn't break the upload flow
      logger.error('Failed to record upload metric', {
        uploadId: metric.uploadId,
        eventType: metric.eventType,
        error: error.message,
      });
    }
  }

  /**
   * Get stale sessions for cleanup
   */
  async getStaleUploadingSessions(olderThan: Date): Promise<UploadSession[]> {
    const query = `
      SELECT * FROM upload_sessions 
      WHERE status = 'uploading' AND (expires_at < $1 OR updated_at < $2)
    `;

    const result = await this.db.query(query, [olderThan, olderThan]);
    return result.rows.map(row => this.mapRowToSession(row));
  }

  /**
   * Update session IPFS data
   */
  async updateSessionIPFS(sessionId: string, data: { cid: string; pinStatus: string; playbackUrl?: string }): Promise<void> {
    const query = `
      UPDATE upload_sessions 
      SET cid = $1, pin_status = $2, playback_url = $3, updated_at = NOW()
      WHERE id = $4
    `;

    await this.db.query(query, [data.cid, data.pinStatus, data.playbackUrl, sessionId]);
  }

  /**
   * Map database row to UploadSession object
   */
  private mapRowToSession(row: any): UploadSession {
    return {
      id: row.id,
      userId: row.user_id,
      filename: row.filename,
      mimeType: row.mime_type,
      totalBytes: parseInt(row.total_bytes, 10),
      chunkSize: row.chunk_size,
      storageKey: row.storage_key,
      storageUploadId: row.storage_upload_id,
      bytesReceived: parseInt(row.bytes_received, 10),
      parts: row.parts || [],
      status: row.status,
      idempotencyKey: row.idempotency_key,
      errorCode: row.error_code,
      cid: row.cid,
      pinStatus: row.pin_status,
      playbackUrl: row.playback_url,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map database row to ContentDraft object
   */
  private mapRowToDraft(row: any): ContentDraft {
    return {
      id: row.id,
      uploadId: row.upload_id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      tags: row.tags,
      visibility: row.visibility,
      category: row.category,
      thumbnailUrl: row.thumbnail_url,
    };
  }
}

// Default service instance
let uploadSessionService: UploadSessionService | null = null;

/**
 * Get or create the default upload session service instance
 */
export function getUploadSessionService(): UploadSessionService {
  if (!uploadSessionService) {
    uploadSessionService = new UploadSessionService();
  }
  return uploadSessionService;
}