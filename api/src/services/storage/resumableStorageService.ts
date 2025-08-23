import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { logger } from '../../utils/logger';

export interface StorageConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface MultipartUpload {
  uploadId: string;
  bucket: string;
  key: string;
}

export interface UploadPart {
  partNumber: number;
  etag: string;
  size: number;
  uploadedAt?: Date;
}

export interface UploadPartParams {
  bucket: string;
  key: string;
  uploadId: string;
  partNumber: number;
  body: Readable | Buffer;
  contentLength: number;
}

export interface CompleteUploadParams {
  bucket: string;
  key: string;
  uploadId: string;
  parts: UploadPart[];
}

/**
 * Resumable Storage Service
 * 
 * Provides S3/R2/GCS-compatible multipart upload functionality
 * for YouTube/Google-style resumable uploads.
 */
export class ResumableStorageService {
  private client: S3Client;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    
    // Initialize S3 client (works with S3, R2, MinIO, etc.)
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint, // For R2/MinIO
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Force path-style addressing for compatibility
      forcePathStyle: !!config.endpoint,
    });
  }

  /**
   * Initialize a multipart upload session
   */
  async createMultipartUpload(bucket: string, key: string, contentType: string): Promise<MultipartUpload> {
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        Metadata: {
          'upload-type': 'resumable',
          'created-at': new Date().toISOString(),
        },
      });

      const response = await this.client.send(command);
      
      if (!response.UploadId) {
        throw new Error('Failed to create multipart upload - no UploadId returned');
      }

      logger.info('Created multipart upload', {
        bucket,
        key,
        uploadId: response.UploadId,
        contentType,
      });

      return {
        uploadId: response.UploadId,
        bucket,
        key,
      };
    } catch (error) {
      logger.error('Failed to create multipart upload', {
        bucket,
        key,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Upload a single part (chunk) of the file
   * Stream the body directly without buffering in memory
   */
  async uploadPart(params: UploadPartParams): Promise<UploadPart> {
    try {
      const command = new UploadPartCommand({
        Bucket: params.bucket,
        Key: params.key,
        UploadId: params.uploadId,
        PartNumber: params.partNumber,
        Body: params.body,
        ContentLength: params.contentLength,
      });

      const response = await this.client.send(command);
      
      if (!response.ETag) {
        throw new Error('Failed to upload part - no ETag returned');
      }

      const uploadPart: UploadPart = {
        partNumber: params.partNumber,
        etag: response.ETag,
        size: params.contentLength,
        uploadedAt: new Date(),
      };

      logger.debug('Uploaded part', {
        bucket: params.bucket,
        key: params.key,
        uploadId: params.uploadId,
        partNumber: params.partNumber,
        size: params.contentLength,
        etag: response.ETag,
      });

      return uploadPart;
    } catch (error) {
      logger.error('Failed to upload part', {
        bucket: params.bucket,
        key: params.key,
        uploadId: params.uploadId,
        partNumber: params.partNumber,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Complete the multipart upload
   */
  async completeMultipartUpload(params: CompleteUploadParams): Promise<{ location: string; etag: string }> {
    try {
      // Sort parts by part number
      const sortedParts = params.parts
        .sort((a, b) => a.partNumber - b.partNumber)
        .map(part => ({
          ETag: part.etag,
          PartNumber: part.partNumber,
        }));

      const command = new CompleteMultipartUploadCommand({
        Bucket: params.bucket,
        Key: params.key,
        UploadId: params.uploadId,
        MultipartUpload: {
          Parts: sortedParts,
        },
      });

      const response = await this.client.send(command);
      
      if (!response.Location || !response.ETag) {
        throw new Error('Failed to complete multipart upload - missing Location or ETag');
      }

      logger.info('Completed multipart upload', {
        bucket: params.bucket,
        key: params.key,
        uploadId: params.uploadId,
        location: response.Location,
        etag: response.ETag,
        totalParts: params.parts.length,
      });

      return {
        location: response.Location,
        etag: response.ETag,
      };
    } catch (error) {
      logger.error('Failed to complete multipart upload', {
        bucket: params.bucket,
        key: params.key,
        uploadId: params.uploadId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Abort a multipart upload and cleanup
   */
  async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      });

      await this.client.send(command);

      logger.info('Aborted multipart upload', {
        bucket,
        key,
        uploadId,
      });
    } catch (error) {
      logger.error('Failed to abort multipart upload', {
        bucket,
        key,
        uploadId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if an object exists and get its metadata
   */
  async headObject(bucket: string, key: string): Promise<{ size: number; lastModified: Date; etag: string } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      
      return {
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        etag: response.ETag || '',
      };
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      logger.error('Failed to head object', {
        bucket,
        key,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get a readable stream for downloading an object
   */
  async getObjectStream(bucket: string, key: string): Promise<Readable> {
    try {
      // Use direct S3 GetObject for streaming
      const response = await this.client.send({
        name: 'GetObjectCommand',
        input: {
          Bucket: bucket,
          Key: key,
        },
      } as any);

      if (!response.Body) {
        throw new Error('No body returned from GetObject');
      }

      return response.Body as Readable;
    } catch (error) {
      logger.error('Failed to get object stream', {
        bucket,
        key,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate a storage key for an upload
   */
  static generateStorageKey(userId: string, uploadId: string, filename: string): string {
    // Clean filename and ensure it's safe
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `uploads/${userId}/${uploadId}/${cleanFilename}`;
  }

  /**
   * Calculate dynamic chunk size based on file size
   * Ensures we stay under S3's 10,000 part limit
   */
  static calculateChunkSize(totalBytes: number): number {
    const MIN_CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB
    const MAX_PARTS = 9000; // Under S3's 10k limit
    const FIVE_MIB = 5 * 1024 * 1024;
    
    const calculatedSize = Math.ceil(totalBytes / MAX_PARTS);
    const roundedSize = Math.ceil(calculatedSize / FIVE_MIB) * FIVE_MIB;
    
    return Math.max(MIN_CHUNK_SIZE, roundedSize);
  }

  /**
   * Health check for storage service
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      // Try to list objects in the bucket (with prefix to limit results)
      await this.client.send({
        name: 'ListObjectsV2Command',
        input: {
          Bucket: this.config.bucket,
          MaxKeys: 1,
          Prefix: 'health-check-',
        },
      } as any);

      return { healthy: true };
    } catch (error) {
      logger.error('Storage health check failed', {
        bucket: this.config.bucket,
        error: error.message,
      });
      return { 
        healthy: false, 
        error: error.message 
      };
    }
  }
}

// Default storage service instance
let storageService: ResumableStorageService | null = null;

/**
 * Get or create the default storage service instance
 */
export function getStorageService(): ResumableStorageService {
  if (!storageService) {
    const config: StorageConfig = {
      bucket: process.env.STORAGE_BUCKET_UPLOADS || 'reelverse-uploads',
      region: process.env.STORAGE_REGION || 'us-east-1',
      endpoint: process.env.STORAGE_ENDPOINT, // For R2/MinIO
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
    };

    if (!config.accessKeyId || !config.secretAccessKey) {
      throw new Error('Storage credentials not configured');
    }

    storageService = new ResumableStorageService(config);
  }

  return storageService;
}