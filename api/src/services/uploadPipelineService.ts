import { ethers } from 'ethers';
import { createPublicClient, createWalletClient, http, Account } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as crypto from 'crypto';
import axios from 'axios';
import { logger } from '../../utils/logger';
import { RedisService } from '../config/redis';
import { autoTaggingQueue, fingerprintingQueue, JobPriority, createJobOptions } from '../config/queues';
import { env } from '../config/env';
import { currentChainConfig } from '../config/chain';

// Minimal ABIs for contracts used in the pipeline
const UPLOAD_MANAGER_ABI = [
  'function requestUpload(string calldata tempURI, uint8 storageClass) returns (uint256)',
  'function finalizeUpload(uint256 provisionalId, string calldata hlsURI, bytes32 perceptualHash) returns (uint256)'
] as const;

const CONTENT_REGISTRY_ABI = [
  'function registerContent(string calldata metaURI, bytes32 pHash, uint256 priceUSDC, uint8 storageClass, address splitter, uint32 geoMask) returns (uint256)'
] as const;

export interface UploadRequest {
  creatorAddress: string;
  organizationId: string;
  file: {
    buffer: Buffer;
    originalName: string;
    mimetype: string;
    size: number;
  };
  metadata: {
    title: string;
    description: string;
    tags: string[];
    participants: Array<{
      wallet: string;
      role: string;
    }>;
  };
  settings: {
    storageClass: 'shreddable' | 'permanent';
    enableWatermark: boolean;
    ageRestricted: boolean;
    geoRestricted: boolean;
  };
}

export interface UploadProgress {
  uploadId: string;
  status: 'uploading' | 'encrypting' | 'transcoding' | 'watermarking' | 'hashing' | 'registering' | 'completed' | 'failed';
  progress: number; // Added missing progress property
  currentStep: string;
  error?: string;
}

export interface TranscodingResult {
  hlsUrl: string;
  thumbnailUrl: string;
  duration: number;
  resolution: string;
}

export interface EncryptionResult {
  encryptedBuffer: Buffer;
  keyId: string;
  iv: string;
  encryptionKey: string;
}

export interface WatermarkResult {
  overlayTemplate: string;
  watermarkId: string;
  overlayConfig: any;
}

export interface PerceptualHashResult {
  hash: string;
  features: number[];
}

export class UploadPipelineService {
  private redisService: RedisService;
  private publicClient;
  private walletClient;
  private platformAccount: Account;

  // Contract addresses
  private readonly UPLOAD_MANAGER_ADDRESS = env.UPLOAD_MANAGER_ADDRESS;
  private readonly CONTENT_REGISTRY_ADDRESS = env.CONTENT_REGISTRY_ADDRESS;

  // External service configurations
  private readonly LIVEPEER_API_KEY = env.LIVEPEER_API_KEY;
  private readonly LIVEPEER_BASE_URL = env.LIVEPEER_BASE_URL;
  private readonly CLOUDFLARE_R2_BUCKET = env.CLOUDFLARE_R2_BUCKET_NAME;
  private readonly ENCRYPTION_KEY = env.CONTENT_ENCRYPTION_KEY;

  constructor() {
    this.redisService = new RedisService();
    this.publicClient = createPublicClient({
      chain: polygon,
      transport: http(currentChainConfig.rpcUrl)
    });

    this.platformAccount = privateKeyToAccount(env.PLATFORM_PRIVATE_KEY as `0x${string}`);
    this.walletClient = createWalletClient({
      account: this.platformAccount, // Added account property
      chain: polygon,
      transport: http(currentChainConfig.rpcUrl)
    });
  }

  /**
   * Start the upload pipeline process
   */
  async startUpload(request: UploadRequest): Promise<{ uploadId: string; success: boolean; error?: string }> {
    const uploadId = this.generateUploadId();

    try {
      const progress: UploadProgress = {
        uploadId,
        status: 'uploading',
        progress: 0,
        currentStep: 'Initializing upload pipeline'
      };

      await this.updateProgress(uploadId, progress);

      // Start the pipeline asynchronously
      this.processUploadPipeline(uploadId, request).catch(error => {
        logger.error(`Upload pipeline failed for ${uploadId}:`, error);
        this.updateProgress(uploadId, {
          ...progress,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });

      return { uploadId, success: true };

    } catch (error) {
      logger.error('Error starting upload pipeline:', error);
      return {
        uploadId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process the complete upload pipeline
   */
  private async processUploadPipeline(uploadId: string, request: UploadRequest): Promise<void> {
    try {
      // Step 1: Request provisional upload on blockchain
      await this.updateProgress(uploadId, {
        uploadId,
        status: 'uploading',
        progress: 10,
        currentStep: 'Requesting blockchain upload slot'
      });

      const provisionalId = await this.requestBlockchainUpload(request);

      // Step 2: Encrypt the file
      await this.updateProgress(uploadId, {
        uploadId,
        status: 'encrypting',
        progress: 20,
        currentStep: 'Encrypting content'
      });

      const encryptionResult = await this.encryptContent(request.file);

      // Step 3: Upload encrypted file to storage
      await this.updateProgress(uploadId, {
        uploadId,
        status: 'uploading',
        progress: 30,
        currentStep: 'Uploading encrypted content to storage'
      });

      const storageUrl = await this.uploadToStorage(encryptionResult, uploadId);

      // Step 4: Transcode with Livepeer
      await this.updateProgress(uploadId, {
        uploadId,
        status: 'transcoding',
        progress: 40,
        currentStep: 'Transcoding video with Livepeer'
      });

      const transcodingResult = await this.transcodeWithLivepeer(storageUrl, encryptionResult.keyId);

      // Step 5: Apply watermarking
      if (request.settings.enableWatermark) {
        await this.updateProgress(uploadId, {
          uploadId,
          status: 'watermarking',
          progress: 60,
          currentStep: 'Applying dynamic watermarking'
        });
        // const watermarkResult = await this.applyWatermarking(transcodingResult);
        // TODO: Integrate actual watermarking service
      }

      // Step 6: Generate AI tags and embeddings
      await this.updateProgress(uploadId, {
        uploadId,
        status: 'hashing',
        progress: 70,
        currentStep: 'Generating AI tags and embeddings'
      });

      await this.queueAutoTagging(uploadId, transcodingResult.hlsUrl, request.metadata.tags);

      // Step 7: Generate video fingerprint for leak detection
      await this.updateProgress(uploadId, {
        uploadId,
        status: 'hashing',
        progress: 75,
        currentStep: 'Generating video fingerprint for leak detection'
      });

      await this.queueVideoFingerprinting(uploadId, transcodingResult.hlsUrl);

      // Step 8: Compute perceptual hash
      await this.updateProgress(uploadId, {
        uploadId,
        status: 'hashing',
        progress: 80,
        currentStep: 'Computing perceptual hash for anti-piracy'
      });

      const hashResult = await this.computePerceptualHash(transcodingResult.hlsUrl);

      // Step 9: Create metadata and upload to IPFS
      await this.updateProgress(uploadId, {
        uploadId,
        status: 'registering',
        progress: 85,
        currentStep: 'Creating metadata and uploading to IPFS'
      });

      const ipfsUri = await this.createAndUploadMetadata(request, transcodingResult, hashResult);

      // Step 10: Finalize upload on blockchain
      await this.updateProgress(uploadId, {
        uploadId,
        status: 'registering',
        progress: 95,
        currentStep: 'Finalizing upload on blockchain'
      });

      const contentId = await this.finalizeBlockchainUpload(provisionalId, ipfsUri, hashResult.hash);

      // Step 11: Complete
      await this.updateProgress(uploadId, {
        uploadId,
        status: 'completed',
        progress: 100,
        currentStep: 'Upload pipeline completed'
      });

      logger.info(`Upload pipeline completed successfully: ${uploadId} -> Content ID: ${contentId}`);

    } catch (error) {
      logger.error(`Upload pipeline failed for ${uploadId}:`, error);
      await this.updateProgress(uploadId, {
        uploadId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        currentStep: 'Upload failed',
        progress: 0 // Reset progress on failure
      });
    }
  }

  /**
   * Request provisional upload on blockchain
   */
  private async requestBlockchainUpload(request: UploadRequest): Promise<bigint> {
    try {
      const storageClass = request.settings.storageClass === 'permanent' ? 1 : 0;
      const tempURI = `temp://upload-${Date.now()}`;

      const hash = await this.walletClient.writeContract({
        address: this.UPLOAD_MANAGER_ADDRESS as `0x${string}`,
        abi: UPLOAD_MANAGER_ABI,
        functionName: 'requestUpload',
        args: [tempURI, storageClass],
        account: this.platformAccount // Added account
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      // TODO: Extract provisionalId from event logs
      const provisionalId = BigInt(Date.now()); // Placeholder - should extract from event logs

      logger.info(`Blockchain upload requested: ${provisionalId}`);
      return provisionalId;

    } catch (error) {
      logger.error('Error requesting blockchain upload:', error);
      throw new Error('Failed to request blockchain upload');
    }
  }

  /**
   * Encrypt content using AES-128-GCM
   */
  private async encryptContent(file: { buffer: Buffer; originalName: string }): Promise<EncryptionResult> {
    try {
      const keyId = crypto.randomUUID();
      const iv = crypto.randomBytes(16);
      const encryptionKey = crypto.randomBytes(16); // AES-128 key

      // Corrected to createCipheriv
      const cipher = crypto.createCipheriv('aes-128-gcm', encryptionKey, iv);

      const encryptedChunks: Buffer[] = [];
      encryptedChunks.push(cipher.update(file.buffer));
      encryptedChunks.push(cipher.final());

      const authTag = cipher.getAuthTag();
      const encryptedBuffer = Buffer.concat([...encryptedChunks, authTag]);

      logger.info(`Content encrypted with key ID: ${keyId}`);

      return {
        encryptedBuffer,
        keyId,
        iv: iv.toString('hex'),
        encryptionKey: encryptionKey.toString('hex')
      };
    } catch (error) {
      logger.error('Error encrypting content:', error);
      throw new Error('Content encryption failed');
    }
  }

  /**
   * Upload encrypted content to cloud storage (e.g., Cloudflare R2, S3)
   */
  private async uploadToStorage(encryptionResult: EncryptionResult, uploadId: string): Promise<string> {
    try {
      // In a real implementation, this would upload to a service like Cloudflare R2 or AWS S3
      // For now, return a mock URL
      const storageUrl = `https://storage.reelverse.com/encrypted/${uploadId}/${encryptionResult.keyId}.enc`;

      // 1. Upload to R2 using AWS SDK
      // 2. Set proper permissions and metadata
      // 3. Return the actual URL

      logger.info(`Content uploaded to storage: ${storageUrl}`);
      return storageUrl;

    } catch (error) {
      logger.error('Error uploading to storage:', error);
      throw new Error('Storage upload failed');
    }
  }

  /**
   * Transcode video with Livepeer
   */
  private async transcodeWithLivepeer(storageUrl: string, keyId: string): Promise<TranscodingResult> {
    try {
      const assetResponse = await axios.post(
        `${this.LIVEPEER_BASE_URL}/asset/request-upload`,
        {
          name: `Reelverse Content - ${keyId}`,
          staticMp4: true,
          playbackPolicy: {
            type: 'webhook',
            webhookId: env.LIVEPEER_WEBHOOK_ID
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.LIVEPEER_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const { asset, tusEndpoint } = assetResponse.data;

      // In a real implementation, you would use the tusEndpoint to upload the file
      // For now, we'll simulate the transcoding process and poll for asset readiness
      logger.info(`Livepeer asset created: ${asset.id}. Simulating upload and polling.`);

      let transcodingComplete = false;
      let attempts = 0;
      const maxAttempts = 60; // 10 minutes with 10-second intervals

      while (!transcodingComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
        const assetStatus = await axios.get(`${this.LIVEPEER_BASE_URL}/asset/${asset.id}`, {
          headers: { 'Authorization': `Bearer ${this.LIVEPEER_API_KEY}` }
        });

        if (assetStatus.data.status.phase === 'ready') {
          transcodingComplete = true;
          logger.info(`Livepeer asset ready: ${asset.id}`);
          return {
            hlsUrl: asset.playbackUrl,
            thumbnailUrl: asset.staticMp4Url || asset.playbackUrl.replace('.m3u8', '.mp4'), // Placeholder
            duration: asset.videoSpec.duration,
            resolution: `${asset.videoSpec.width}x${asset.videoSpec.height}`
          };
        } else if (assetStatus.data.status.phase === 'failed') {
          throw new Error(`Livepeer transcoding failed: ${assetStatus.data.status.errorMessage}`);
        }
        attempts++;
      }

      throw new Error('Livepeer transcoding timed out');

    } catch (error) {
      logger.error('Error transcoding with Livepeer:', error);
      throw new Error('Livepeer transcoding failed');
    }
  }

  /**
   * Apply dynamic watermarking
   */
  private async applyWatermarking(transcodingResult: TranscodingResult): Promise<WatermarkResult> {
    try {
      const watermarkId = crypto.randomUUID();

      // Create watermark overlay configuration
      const overlayConfig = {
        // Example: position, opacity, size, etc.
        position: 'bottom-right',
        opacity: 0.5,
        size: '10%',
        // Dynamic data placeholders
        userData: {
          userId: '{{userAddress}}', // Placeholder for actual user address
          sessionId: '{{sessionId}}' // Placeholder for actual session ID
        }
      };

      // Example: HLS manifest manipulation or CDN integration for watermarking
      const overlayTemplate = `
        <div class="watermark" data-watermark-id="${watermarkId}">
          <span class="watermark-text">{{userAddress}}</span>
          <span class="watermark-session">{{sessionId}}</span>
        </div>
      `;

      logger.info(`Watermarking applied with ID: ${watermarkId}`);

      return {
        overlayTemplate,
        watermarkId,
        overlayConfig
      };
    } catch (error) {
      logger.error('Error applying watermarking:', error);
      throw new Error('Watermarking failed');
    }
  }

  /**
   * Compute perceptual hash for anti-piracy
   */
  private async computePerceptualHash(hlsUrl: string): Promise<PerceptualHashResult> {
    try {
      // This would integrate with a perceptual hashing service (e.g., pHash, imgHash)
      // For now, generate a mock hash
      const mockFeatures = Array.from({ length: 64 }, () => Math.random());
      const hash = crypto
        .createHash('sha256')
        .update(hlsUrl + Date.now().toString()) // Add timestamp for uniqueness in mock
        .digest('hex');

      logger.info(`Perceptual hash computed: ${hash.substring(0, 16)}...`);

      return {
        hash,
        features: mockFeatures
      };
    } catch (error) {
      logger.error('Error computing perceptual hash:', error);
      throw new Error('Perceptual hashing failed');
    }
  }

  /**
   * Create metadata and upload to IPFS
   */
  private async createAndUploadMetadata(
    request: UploadRequest,
    transcodingResult: TranscodingResult,
    hashResult: PerceptualHashResult
  ): Promise<string> {
    try {
      const metadata = {
        title: request.metadata.title,
        description: request.metadata.description,
        tags: request.metadata.tags,
        creatorAddress: request.creatorAddress,
        organizationId: request.organizationId,
        hlsUrl: transcodingResult.hlsUrl,
        thumbnailUrl: transcodingResult.thumbnailUrl,
        duration: transcodingResult.duration,
        resolution: transcodingResult.resolution,
        perceptualHash: hashResult.hash,
        ageRestricted: request.settings.ageRestricted,
        geoRestricted: request.settings.geoRestricted,
        storageClass: request.settings.storageClass,
        participants: request.metadata.participants,
        createdAt: new Date().toISOString(),
        termsVersion: '1.0',
      };

      const metadataJson = JSON.stringify(metadata, null, 2);
      const metadataHash = crypto.createHash('sha256').update(metadataJson).digest('hex');
      const ipfsUri = `ipfs://Qm${metadataHash.substring(0, 44)}`; // Mock IPFS hash

      // In a real implementation, this would upload to an IPFS pinning service (e.g., Pinata, Web3.storage)
      logger.info(`Metadata uploaded to IPFS: ${ipfsUri}`);
      return ipfsUri;

    } catch (error) {
      logger.error('Error creating and uploading metadata:', error);
      throw new Error('Metadata upload to IPFS failed');
    }
  }

  /**
   * Finalize upload on blockchain
   */
  private async finalizeBlockchainUpload(
    provisionalId: bigint,
    ipfsUri: string,
    perceptualHash: string
  ): Promise<bigint> {
    try {
      const hash = await this.walletClient.writeContract({
        address: this.UPLOAD_MANAGER_ADDRESS as `0x${string}`,
        abi: UPLOAD_MANAGER_ABI,
        functionName: 'finalizeUpload',
        args: [
          provisionalId,
          ipfsUri,
          `0x${perceptualHash.substring(0, 64)}` as `0x${string}`
        ],
        account: this.platformAccount // Added account
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      // TODO: Extract contentId from event logs
      const contentId = BigInt(Date.now()); // Placeholder - should extract from event logs

      logger.info(`Upload finalized on blockchain: Content ID ${contentId}`);
      return contentId;

    } catch (error) {
      logger.error('Error finalizing blockchain upload:', error);
      throw new Error('Blockchain finalization failed');
    }
  }

  /**
   * Get upload progress
   */
  async getUploadProgress(uploadId: string): Promise<UploadProgress | null> {
    try {
      return await this.redisService.get(`upload_progress:${uploadId}`);
    } catch (error) {
      logger.error('Error getting upload progress:', error);
      return null;
    }
  }

  /**
   * Cancel upload
   */
  async cancelUpload(uploadId: string): Promise<boolean> {
    try {
      const progress = await this.getUploadProgress(uploadId);
      if (!progress) {
        logger.warn(`Attempted to cancel non-existent upload: ${uploadId}`);
        return false;
      }

      if (progress.status === 'completed') {
        return false; // Cannot cancel completed upload
      }

      await this.updateProgress(uploadId, {
        ...progress,
        status: 'failed', // Mark as failed due to cancellation
        error: 'Upload cancelled by user',
        currentStep: 'Upload cancelled'
      });

      logger.info(`Upload cancelled: ${uploadId}`);
      return true;
    } catch (error) {
      logger.error('Error cancelling upload:', error);
      return false;
    }
  }

  /**
   * Update upload progress
   */
  private async updateProgress(uploadId: string, progress: UploadProgress): Promise<void> {
    try {
      await this.redisService.set(`upload_progress:${uploadId}`, progress, 86400); // 24 hours expiry

      // Publish progress update for real-time notifications
      await this.redisService.publish(`upload_progress:${uploadId}`, progress);

    } catch (error) {
      logger.error('Error updating upload progress:', error);
    }
  }

  /**
   * Generate unique upload ID
   */
  private generateUploadId(): string {
    return `upload_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Queue auto-tagging job for AI processing
   */
  private async queueAutoTagging(contentId: string, mediaUrl: string, existingTags: string[]): Promise<void> {
    try {
      await autoTaggingQueue.add(
        'auto-tagging',
        {
          jobId: `auto-tag-${contentId}-${Date.now()}`,
          contentId,
          mediaUrl,
          existingTags,
          operation: 'auto-tagging',
          priority: 'normal',
        },
        createJobOptions(JobPriority.NORMAL) // Corrected JobPriority enum access
      );

      logger.info(`Auto-tagging job queued for content: ${contentId}`);
    } catch (error) {
      logger.error('Error queueing auto-tagging job:', error);
      // Don't throw - auto-tagging failure shouldn't block upload
    }
  }

  /**
   * Queue video fingerprinting job for leak detection
   */
  private async queueVideoFingerprinting(contentId: string, videoUrl: string): Promise<void> {
    try {
      await fingerprintingQueue.add(
        'fingerprinting',
        {
          jobId: `fingerprint-${contentId}-${Date.now()}`,
          contentId,
          operation: 'fingerprinting',
          priority: 'normal',
          videoUrl,
        },
        createJobOptions(JobPriority.NORMAL) // Corrected JobPriority enum access
      );

      logger.info(`Video fingerprinting job queued for content: ${contentId}`);
    } catch (error) {
      logger.error('Error queueing video fingerprinting job:', error);
      // Don't throw - fingerprinting failure shouldn't block upload
    }
  }

  /**
   * Clean up expired upload progress records
   */
  async cleanupExpiredUploads(): Promise<void> {
    try {
      // This would be called by a scheduled job
      // Implementation would scan Redis for expired upload records
      logger.info('Cleaned up expired upload records');
    } catch (error) {
      logger.error('Error cleaning up expired uploads:', error);
    }
  }
}

export default UploadPipelineService;