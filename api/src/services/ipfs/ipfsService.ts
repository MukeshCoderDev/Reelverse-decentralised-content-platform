import { NFTStorage, Car } from 'nft.storage';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../../utils/logger';
import { getStorageService } from '../storage/resumableStorageService';

const pipelineAsync = promisify(pipeline);

export interface IPFSPinResult {
  cid: string;
  size: number;
  pinStatus: 'pinned' | 'failed';
  pinnedAt: Date;
  verificationHash?: string;
  gatewayUrl?: string;
}

export interface IPFSPinOptions {
  verifyHash?: boolean;
  generateCAR?: boolean;
  timeout?: number; // milliseconds
  retryAttempts?: number;
}

export interface IPFSMetadata {
  name: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties?: {
    files?: Array<{
      uri: string;
      type: string;
      cdn?: boolean;
    }>;
    category?: string;
    creators?: Array<{
      address: string;
      verified: boolean;
      share: number;
    }>;
  };
}

/**
 * IPFS Service for nft.storage Integration
 * 
 * Handles IPFS pinning, metadata creation, and verification
 * for uploaded content files.
 */
export class IPFSService {
  private client: NFTStorage | null = null;
  private storageService = getStorageService();

  constructor() {
    if (process.env.NFT_STORAGE_TOKEN) {
      this.client = new NFTStorage({
        token: process.env.NFT_STORAGE_TOKEN,
      });
      logger.info('NFT.Storage client initialized');
    } else {
      logger.warn('NFT_STORAGE_TOKEN not configured - IPFS functionality disabled');
    }
  }

  /**
   * Pin a file to IPFS from storage
   */
  async pinFileFromStorage(
    storageKey: string,
    filename: string,
    options: IPFSPinOptions = {}
  ): Promise<IPFSPinResult> {
    if (!this.client) {
      throw new Error('NFT.Storage client not configured');
    }

    const {
      verifyHash = false,
      generateCAR = false,
      timeout = 5 * 60 * 1000, // 5 minutes
      retryAttempts = 3,
    } = options;

    let attempt = 1;
    let lastError: Error;

    while (attempt <= retryAttempts) {
      try {
        logger.info('Starting IPFS pin attempt', {
          storageKey,
          filename,
          attempt,
          retryAttempts,
        });

        // Download file to temporary location
        const tempFilePath = await this.downloadToTemp(storageKey, filename);
        
        try {
          // Calculate file hash for verification if requested
          let verificationHash: string | undefined;
          if (verifyHash) {
            verificationHash = await this.calculateFileHash(tempFilePath);
          }

          // Pin to IPFS
          const startTime = Date.now();
          const cid = await this.pinFileWithTimeout(tempFilePath, timeout);
          const pinDuration = Date.now() - startTime;

          // Get file size
          const stats = fs.statSync(tempFilePath);
          const size = stats.size;

          // Generate gateway URL
          const gatewayUrl = `https://${cid}.ipfs.nftstorage.link`;

          const result: IPFSPinResult = {
            cid: cid.toString(),
            size,
            pinStatus: 'pinned',
            pinnedAt: new Date(),
            verificationHash,
            gatewayUrl,
          };

          logger.info('Successfully pinned file to IPFS', {
            storageKey,
            filename,
            cid: result.cid,
            size,
            pinDuration,
            attempt,
            gatewayUrl,
          });

          // Cleanup temp file
          await this.cleanupTempFile(tempFilePath);

          return result;

        } finally {
          // Ensure temp file is cleaned up even on error
          await this.cleanupTempFile(tempFilePath);
        }

      } catch (error) {
        lastError = error as Error;
        
        logger.warn('IPFS pin attempt failed', {
          storageKey,
          filename,
          attempt,
          retryAttempts,
          error: error.message,
        });

        if (attempt < retryAttempts) {
          // Exponential backoff delay
          const delay = Math.pow(2, attempt - 1) * 1000;
          logger.info('Retrying IPFS pin after delay', {
            storageKey,
            delay,
            nextAttempt: attempt + 1,
          });
          await this.sleep(delay);
        }

        attempt++;
      }
    }

    // All attempts failed
    logger.error('All IPFS pin attempts failed', {
      storageKey,
      filename,
      retryAttempts,
      error: lastError!.message,
    });

    return {
      cid: '',
      size: 0,
      pinStatus: 'failed',
      pinnedAt: new Date(),
    };
  }

  /**
   * Pin a local file to IPFS
   */
  async pinLocalFile(
    filePath: string,
    options: IPFSPinOptions = {}
  ): Promise<IPFSPinResult> {
    if (!this.client) {
      throw new Error('NFT.Storage client not configured');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const {
      verifyHash = false,
      timeout = 5 * 60 * 1000,
    } = options;

    try {
      // Calculate file hash for verification if requested
      let verificationHash: string | undefined;
      if (verifyHash) {
        verificationHash = await this.calculateFileHash(filePath);
      }

      // Pin to IPFS
      const startTime = Date.now();
      const cid = await this.pinFileWithTimeout(filePath, timeout);
      const pinDuration = Date.now() - startTime;

      // Get file size
      const stats = fs.statSync(filePath);
      const size = stats.size;

      // Generate gateway URL
      const gatewayUrl = `https://${cid}.ipfs.nftstorage.link`;

      const result: IPFSPinResult = {
        cid: cid.toString(),
        size,
        pinStatus: 'pinned',
        pinnedAt: new Date(),
        verificationHash,
        gatewayUrl,
      };

      logger.info('Successfully pinned local file to IPFS', {
        filePath,
        cid: result.cid,
        size,
        pinDuration,
        gatewayUrl,
      });

      return result;

    } catch (error) {
      logger.error('Failed to pin local file to IPFS', {
        filePath,
        error: error.message,
      });

      return {
        cid: '',
        size: 0,
        pinStatus: 'failed',
        pinnedAt: new Date(),
      };
    }
  }

  /**
   * Create and pin NFT metadata to IPFS
   */
  async pinMetadata(metadata: IPFSMetadata): Promise<IPFSPinResult> {
    if (!this.client) {
      throw new Error('NFT.Storage client not configured');
    }

    try {
      const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {
        type: 'application/json',
      });

      const cid = await this.client.storeBlob(metadataBlob);
      const gatewayUrl = `https://${cid}.ipfs.nftstorage.link`;

      const result: IPFSPinResult = {
        cid: cid.toString(),
        size: metadataBlob.size,
        pinStatus: 'pinned',
        pinnedAt: new Date(),
        gatewayUrl,
      };

      logger.info('Successfully pinned metadata to IPFS', {
        cid: result.cid,
        size: result.size,
        gatewayUrl,
      });

      return result;

    } catch (error) {
      logger.error('Failed to pin metadata to IPFS', {
        error: error.message,
        metadata,
      });

      return {
        cid: '',
        size: 0,
        pinStatus: 'failed',
        pinnedAt: new Date(),
      };
    }
  }

  /**
   * Get pin status from nft.storage
   */
  async getPinStatus(cid: string): Promise<{
    status: string;
    pinned?: Date;
    size?: number;
  }> {
    if (!this.client) {
      throw new Error('NFT.Storage client not configured');
    }

    try {
      const status = await this.client.status(cid);
      
      return {
        status: status.pin.status,
        pinned: status.pin.created ? new Date(status.pin.created) : undefined,
        size: status.dagSize,
      };
    } catch (error) {
      logger.error('Failed to get pin status', {
        cid,
        error: error.message,
      });
      
      return {
        status: 'unknown',
      };
    }
  }

  /**
   * List all pins for the account
   */
  async listPins(options: {
    before?: Date;
    after?: Date;
    limit?: number;
    status?: string;
  } = {}): Promise<Array<{
    cid: string;
    status: string;
    created: Date;
    size?: number;
  }>> {
    if (!this.client) {
      throw new Error('NFT.Storage client not configured');
    }

    try {
      const pins = [];
      const limit = options.limit || 100;
      
      for await (const pin of this.client.list({ limit })) {
        pins.push({
          cid: pin.cid,
          status: pin.pin.status,
          created: new Date(pin.created),
          size: pin.dagSize,
        });
      }

      return pins;
    } catch (error) {
      logger.error('Failed to list pins', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Download file from storage to temporary location
   */
  private async downloadToTemp(storageKey: string, filename: string): Promise<string> {
    const tempDir = process.env.TEMP_DIR || '/tmp';
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const tempFilePath = path.join(tempDir, `ipfs-${Date.now()}-${sanitizedFilename}`);

    try {
      const stream = await this.storageService.getObjectStream(
        process.env.STORAGE_BUCKET_UPLOADS!,
        storageKey
      );

      const writeStream = createWriteStream(tempFilePath);
      await pipelineAsync(stream, writeStream);

      logger.debug('Downloaded file for IPFS pinning', {
        storageKey,
        tempFilePath,
        size: fs.statSync(tempFilePath).size,
      });

      return tempFilePath;
    } catch (error) {
      logger.error('Failed to download file for IPFS', {
        storageKey,
        tempFilePath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Pin file with timeout
   */
  private async pinFileWithTimeout(filePath: string, timeoutMs: number): Promise<string> {
    const fileStream = createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`IPFS pin timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.client!.storeBlob(fileStream)
        .then((cid) => {
          clearTimeout(timeoutId);
          resolve(cid.toString());
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Calculate SHA-256 hash of file
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', reject);
    });
  }

  /**
   * Cleanup temporary file
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.debug('Cleaned up temp file', { filePath });
      }
    } catch (error) {
      logger.warn('Failed to cleanup temp file', {
        filePath,
        error: error.message,
      });
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate NFT metadata for uploaded content
   */
  generateContentMetadata(
    title: string,
    description: string,
    contentCID: string,
    mimeType: string,
    creator: string,
    attributes: Array<{ trait_type: string; value: string | number }> = []
  ): IPFSMetadata {
    return {
      name: title,
      description,
      image: `ipfs://${contentCID}`,
      external_url: `https://${contentCID}.ipfs.nftstorage.link`,
      attributes: [
        { trait_type: 'Content Type', value: mimeType },
        { trait_type: 'Creator', value: creator },
        { trait_type: 'Platform', value: 'Reelverse' },
        ...attributes,
      ],
      properties: {
        files: [
          {
            uri: `ipfs://${contentCID}`,
            type: mimeType,
            cdn: false,
          },
        ],
        category: 'video',
        creators: [
          {
            address: creator,
            verified: true,
            share: 100,
          },
        ],
      },
    };
  }

  /**
   * Health check for IPFS service
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    if (!this.client) {
      return {
        healthy: false,
        error: 'NFT.Storage client not configured',
      };
    }

    try {
      // Test with a small metadata upload
      const testMetadata = {
        name: 'Health Check',
        description: 'Test metadata for health check',
      };

      const testBlob = new Blob([JSON.stringify(testMetadata)], {
        type: 'application/json',
      });

      await this.client.storeBlob(testBlob);

      return { healthy: true };
    } catch (error) {
      logger.error('IPFS health check failed', {
        error: error.message,
      });
      
      return {
        healthy: false,
        error: error.message,
      };
    }
  }
}

// Default service instance
let ipfsService: IPFSService | null = null;

/**
 * Get or create the default IPFS service instance
 */
export function getIPFSService(): IPFSService {
  if (!ipfsService) {
    ipfsService = new IPFSService();
  }
  return ipfsService;
}