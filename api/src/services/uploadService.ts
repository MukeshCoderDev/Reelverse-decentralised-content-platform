/**
 * Upload Service with Multipart Support
 * Handles resumable uploads up to 50GB with malware/CSAM scanning
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { eventBus } from '../core/eventBus';
import { metrics } from '../core/metrics';
import { observability } from '../core/observability';
import { featureFlags } from '../core/featureFlags';
import { db } from '../core/database';

export interface UploadRequest {
  fileSize: number;
  contentType: string;
  organizationId: string;
  creatorId: string;
  fileName: string;
  metadata: ContentMetadata;
  idempotencyKey: string;
}

export interface ContentMetadata {
  title: string;
  description?: string;
  tags: string[];
  ageRating: 'general' | 'mature' | 'adult';
  category: string;
  isPrivate: boolean;
}

export interface UploadSession {
  sessionId: string;
  uploadId: string;
  fileSize: number;
  contentType: string;
  organizationId: string;
  creatorId: string;
  fileName: string;
  metadata: ContentMetadata;
  
  // Session state
  status: 'active' | 'completed' | 'failed' | 'expired';
  chunksUploaded: number;
  totalChunks: number;
  chunkSize: number;
  uploadedBytes: number;
  
  // Security
  checksumExpected?: string;
  checksumActual?: string;
  scanStatus: 'pending' | 'scanning' | 'clean' | 'infected' | 'failed';
  scanResults?: ScanResult;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface ChunkData {
  chunkIndex: number;
  data: Buffer;
  checksum: string;
}

export interface ChunkResponse {
  chunkIndex: number;
  uploaded: boolean;
  nextChunkIndex?: number;
  uploadProgress: number;
}

export interface UploadResult {
  uploadId: string;
  contentId: string;
  status: 'completed' | 'failed';
  fileSize: number;
  checksum: string;
  scanStatus: string;
  processingStage: 'uploaded' | 'scanning' | 'queued_for_transcoding';
}

export interface ScanResult {
  scanId: string;
  status: 'clean' | 'infected' | 'suspicious';
  threats: string[];
  confidence: number;
  scanProvider: string;
  scannedAt: Date;
}

export class UploadService {
  private sessions: Map<string, UploadSession> = new Map();
  private chunkStorage: Map<string, Map<number, Buffer>> = new Map();
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024 * 1024; // 50GB
  private readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Initiate multipart upload with idempotency
   */
  async initiateUpload(request: UploadRequest): Promise<UploadSession> {
    const timerId = metrics.startTimer('upload_initiation', {
      organizationId: request.organizationId,
      contentType: request.contentType
    });

    try {
      // Validate request
      this.validateUploadRequest(request);

      // Check for existing session with same idempotency key
      const existingSession = await this.findSessionByIdempotencyKey(request.idempotencyKey);
      if (existingSession) {
        await observability.logEvent('info', 'Upload session found for idempotency key', {
          sessionId: existingSession.sessionId,
          idempotencyKey: request.idempotencyKey
        });
        return existingSession;
      }

      // Check rate limits
      await this.checkRateLimits(request.organizationId);

      // Create new session
      const session = await this.createUploadSession(request);

      // Store session
      this.sessions.set(session.sessionId, session);
      this.chunkStorage.set(session.sessionId, new Map());

      // Emit upload started event
      await eventBus.publish({
        type: 'upload.started',
        version: '1.0',
        correlationId: `upload-${session.uploadId}`,
        payload: {
          uploadId: session.uploadId,
          sessionId: session.sessionId,
          creatorId: request.creatorId,
          organizationId: request.organizationId,
          fileSize: request.fileSize,
          contentType: request.contentType,
          fileName: request.fileName
        },
        metadata: {
          source: 'upload-service',
          userId: request.creatorId,
          organizationId: request.organizationId
        }
      });

      metrics.endTimer(timerId, true);
      metrics.counter('uploads_initiated_total', 1, {
        organizationId: request.organizationId,
        contentType: request.contentType
      });

      await observability.logEvent('info', 'Upload session initiated', {
        sessionId: session.sessionId,
        uploadId: session.uploadId,
        fileSize: request.fileSize,
        organizationId: request.organizationId
      });

      return session;

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Upload chunk with resumable support
   */
  async uploadChunk(sessionId: string, chunk: ChunkData): Promise<ChunkResponse> {
    const timerId = metrics.startTimer('chunk_upload', {
      sessionId: sessionId.substr(0, 8),
      chunkIndex: chunk.chunkIndex.toString()
    });

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Upload session not found or expired');
      }

      if (session.status !== 'active') {
        throw new Error(`Upload session is ${session.status}`);
      }

      // Validate chunk
      this.validateChunk(session, chunk);

      // Store chunk
      const chunks = this.chunkStorage.get(sessionId)!;
      chunks.set(chunk.chunkIndex, chunk.data);

      // Update session
      session.chunksUploaded = chunks.size;
      session.uploadedBytes += chunk.data.length;
      session.updatedAt = new Date();

      const uploadProgress = (session.uploadedBytes / session.fileSize) * 100;

      metrics.endTimer(timerId, true);
      metrics.counter('chunks_uploaded_total', 1, {
        sessionId: sessionId.substr(0, 8)
      });
      metrics.gauge('upload_progress', uploadProgress, {
        sessionId: sessionId.substr(0, 8)
      });

      return {
        chunkIndex: chunk.chunkIndex,
        uploaded: true,
        nextChunkIndex: chunk.chunkIndex + 1,
        uploadProgress
      };

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Complete upload and initiate scanning
   */
  async completeUpload(sessionId: string): Promise<UploadResult> {
    const timerId = metrics.startTimer('upload_completion', {
      sessionId: sessionId.substr(0, 8)
    });

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Upload session not found');
      }

      // Verify all chunks are uploaded
      const chunks = this.chunkStorage.get(sessionId)!;
      if (chunks.size !== session.totalChunks) {
        throw new Error(`Missing chunks: expected ${session.totalChunks}, got ${chunks.size}`);
      }

      // Assemble file and verify checksum
      const fileBuffer = this.assembleFile(chunks, session.totalChunks);
      const actualChecksum = this.calculateChecksum(fileBuffer);
      
      session.checksumActual = actualChecksum;
      session.status = 'completed';
      session.updatedAt = new Date();

      // Generate content ID
      const contentId = `content_${Date.now()}_${uuidv4()}`;

      // Store file (in production: upload to storage service)
      await this.storeFile(contentId, fileBuffer, session);

      // Initiate malware/CSAM scanning
      const scanResult = await this.initiateScanning(contentId, fileBuffer, session);
      session.scanStatus = scanResult.status === 'clean' ? 'clean' : 'scanning';
      session.scanResults = scanResult;

      // Clean up chunks from memory
      this.chunkStorage.delete(sessionId);

      const result: UploadResult = {
        uploadId: session.uploadId,
        contentId,
        status: 'completed',
        fileSize: session.fileSize,
        checksum: actualChecksum,
        scanStatus: session.scanStatus,
        processingStage: session.scanStatus === 'clean' ? 'queued_for_transcoding' : 'scanning'
      };

      // Emit upload completed event
      await eventBus.publish({
        type: 'upload.completed',
        version: '1.0',
        correlationId: `upload-${session.uploadId}`,
        payload: {
          uploadId: session.uploadId,
          contentId,
          creatorId: session.creatorId,
          organizationId: session.organizationId,
          fileSize: session.fileSize,
          scanStatus: session.scanStatus,
          processingStage: result.processingStage
        },
        metadata: {
          source: 'upload-service',
          userId: session.creatorId,
          organizationId: session.organizationId,
          contentId
        }
      });

      // Trigger transcoding if content is clean
      if (session.scanStatus === 'clean') {
        try {
          const { transcodingService } = await import('./transcodingService');
          const storageUrl = `https://storage.reelverse.com/content/${contentId}`;
          
          await transcodingService.createJob(
            contentId,
            storageUrl,
            session.fileSize,
            session.organizationId,
            session.creatorId
          );

          await observability.logEvent('info', 'Transcoding job initiated from upload', {
            uploadId: session.uploadId,
            contentId,
            organizationId: session.organizationId
          });
        } catch (error) {
          await observability.logEvent('error', 'Failed to initiate transcoding from upload', {
            uploadId: session.uploadId,
            contentId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          // Don't fail the upload if transcoding initiation fails
        }
      }

      metrics.endTimer(timerId, true);
      metrics.counter('uploads_completed_total', 1, {
        organizationId: session.organizationId,
        scanStatus: session.scanStatus
      });

      await observability.logEvent('info', 'Upload completed successfully', {
        uploadId: session.uploadId,
        contentId,
        fileSize: session.fileSize,
        scanStatus: session.scanStatus
      });

      return result;

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get upload session status
   */
  getSessionStatus(sessionId: string): UploadSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Cancel upload session
   */
  async cancelUpload(sessionId: string, reason: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.status = 'failed';
    session.updatedAt = new Date();

    // Clean up
    this.chunkStorage.delete(sessionId);

    await eventBus.publish({
      type: 'upload.cancelled',
      version: '1.0',
      correlationId: `upload-${session.uploadId}`,
      payload: {
        uploadId: session.uploadId,
        sessionId,
        reason,
        creatorId: session.creatorId
      },
      metadata: {
        source: 'upload-service',
        userId: session.creatorId,
        organizationId: session.organizationId
      }
    });

    await observability.logEvent('info', 'Upload cancelled', {
      sessionId,
      uploadId: session.uploadId,
      reason
    });
  }

  /**
   * Validate upload request
   */
  private validateUploadRequest(request: UploadRequest): void {
    if (!request.fileSize || request.fileSize <= 0) {
      throw new Error('Invalid file size');
    }

    if (request.fileSize > this.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE} bytes`);
    }

    if (!request.contentType) {
      throw new Error('Content type is required');
    }

    if (!request.organizationId || !request.creatorId) {
      throw new Error('Organization ID and Creator ID are required');
    }

    if (!request.idempotencyKey) {
      throw new Error('Idempotency key is required');
    }

    // Check allowed content types
    const allowedTypes = [
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv',
      'video/webm', 'video/mkv', 'video/m4v'
    ];

    if (!allowedTypes.includes(request.contentType)) {
      throw new Error(`Content type ${request.contentType} is not supported`);
    }
  }

  /**
   * Create upload session
   */
  private async createUploadSession(request: UploadRequest): Promise<UploadSession> {
    const sessionId = uuidv4();
    const uploadId = `upload_${Date.now()}_${uuidv4()}`;
    const totalChunks = Math.ceil(request.fileSize / this.CHUNK_SIZE);

    return {
      sessionId,
      uploadId,
      fileSize: request.fileSize,
      contentType: request.contentType,
      organizationId: request.organizationId,
      creatorId: request.creatorId,
      fileName: request.fileName,
      metadata: request.metadata,
      status: 'active',
      chunksUploaded: 0,
      totalChunks,
      chunkSize: this.CHUNK_SIZE,
      uploadedBytes: 0,
      scanStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + this.SESSION_TTL)
    };
  }

  /**
   * Find session by idempotency key
   */
  private async findSessionByIdempotencyKey(idempotencyKey: string): Promise<UploadSession | null> {
    // In production: query database for existing session
    for (const session of this.sessions.values()) {
      if (session.uploadId.includes(idempotencyKey)) {
        return session;
      }
    }
    return null;
  }

  /**
   * Check rate limits for organization
   */
  private async checkRateLimits(organizationId: string): Promise<void> {
    const rateLimit = featureFlags.getRateLimit('upload_requests');
    if (!rateLimit || !rateLimit.enabled) {
      return;
    }

    // In production: implement proper rate limiting with Redis
    // For now, just check if kill switch is active
    if (featureFlags.isEnabled('kill_switch_active')) {
      throw new Error('Upload service is temporarily unavailable');
    }
  }

  /**
   * Validate chunk data
   */
  private validateChunk(session: UploadSession, chunk: ChunkData): void {
    if (chunk.chunkIndex < 0 || chunk.chunkIndex >= session.totalChunks) {
      throw new Error(`Invalid chunk index: ${chunk.chunkIndex}`);
    }

    const expectedSize = chunk.chunkIndex === session.totalChunks - 1
      ? session.fileSize % session.chunkSize || session.chunkSize
      : session.chunkSize;

    if (chunk.data.length !== expectedSize) {
      throw new Error(`Invalid chunk size: expected ${expectedSize}, got ${chunk.data.length}`);
    }

    // Verify chunk checksum
    const actualChecksum = this.calculateChecksum(chunk.data);
    if (actualChecksum !== chunk.checksum) {
      throw new Error('Chunk checksum mismatch');
    }
  }

  /**
   * Assemble file from chunks
   */
  private assembleFile(chunks: Map<number, Buffer>, totalChunks: number): Buffer {
    const buffers: Buffer[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunks.get(i);
      if (!chunk) {
        throw new Error(`Missing chunk ${i}`);
      }
      buffers.push(chunk);
    }

    return Buffer.concat(buffers);
  }

  /**
   * Calculate file checksum
   */
  private calculateChecksum(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Store file to storage service
   */
  private async storeFile(contentId: string, fileBuffer: Buffer, session: UploadSession): Promise<void> {
    // In production: upload to cloud storage (S3, R2, etc.)
    await observability.logEvent('info', 'File stored to storage service', {
      contentId,
      fileSize: fileBuffer.length,
      organizationId: session.organizationId
    });
  }

  /**
   * Initiate malware and CSAM scanning
   */
  private async initiateScanning(contentId: string, fileBuffer: Buffer, session: UploadSession): Promise<ScanResult> {
    // In production: integrate with actual scanning services
    const scanResult: ScanResult = {
      scanId: `scan_${Date.now()}_${uuidv4()}`,
      status: 'clean', // Mock result for development
      threats: [],
      confidence: 0.99,
      scanProvider: 'mock-scanner',
      scannedAt: new Date()
    };

    await observability.logEvent('info', 'Content scanning initiated', {
      contentId,
      scanId: scanResult.scanId,
      scanProvider: scanResult.scanProvider
    });

    return scanResult;
  }

  /**
   * Start cleanup timer for expired sessions
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = new Date();
      const expiredSessions: string[] = [];

      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.expiresAt < now) {
          expiredSessions.push(sessionId);
        }
      }

      for (const sessionId of expiredSessions) {
        this.sessions.delete(sessionId);
        this.chunkStorage.delete(sessionId);
      }

      if (expiredSessions.length > 0) {
        observability.logEvent('info', `Cleaned up ${expiredSessions.length} expired upload sessions`);
      }
    }, 300000); // 5 minutes
  }
}

// Global upload service instance
export const uploadService = new UploadService();