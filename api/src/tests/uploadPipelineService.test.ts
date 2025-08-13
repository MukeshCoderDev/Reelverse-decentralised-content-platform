import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import UploadPipelineService from '../services/uploadPipelineService';
import crypto from 'crypto';

// Mock dependencies
jest.mock('viem', () => ({
  createPublicClient: jest.fn(() => ({
    waitForTransactionReceipt: jest.fn().mockResolvedValue({ blockNumber: 123 })
  })),
  createWalletClient: jest.fn(() => ({
    writeContract: jest.fn().mockResolvedValue('0x123456789')
  })),
  http: jest.fn(),
  polygon: {}
}));

jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn(() => ({ address: '0x123' }))
}));

jest.mock('axios');
jest.mock('../config/redis', () => ({
  RedisService: jest.fn(() => ({
    set: jest.fn(),
    get: jest.fn(),
    publish: jest.fn()
  }))
}));

describe('UploadPipelineService', () => {
  let uploadPipelineService: UploadPipelineService;
  let mockRedisService: any;

  beforeEach(() => {
    // Reset environment variables
    process.env.UPLOAD_MANAGER_ADDRESS = '0x1234567890123456789012345678901234567890';
    process.env.CONTENT_REGISTRY_ADDRESS = '0x2345678901234567890123456789012345678901';
    process.env.LIVEPEER_API_KEY = 'test-livepeer-key';
    process.env.LIVEPEER_BASE_URL = 'https://livepeer.studio/api';
    process.env.CLOUDFLARE_R2_BUCKET_NAME = 'test-bucket';
    process.env.CONTENT_ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long';
    process.env.PLATFORM_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
    process.env.POLYGON_RPC_URL = 'https://polygon-rpc.com';

    uploadPipelineService = new UploadPipelineService();
    mockRedisService = (uploadPipelineService as any).redisService;
  });

  describe('startUpload', () => {
    it('should start upload pipeline successfully', async () => {
      mockRedisService.set.mockResolvedValue(true);

      const uploadRequest = {
        creatorAddress: '0x1234567890123456789012345678901234567890',
        file: {
          buffer: Buffer.from('test video content'),
          originalName: 'test-video.mp4',
          mimeType: 'video/mp4',
          size: 1024000
        },
        metadata: {
          title: 'Test Video',
          description: 'A test video for upload',
          tags: ['test', 'video'],
          ageRating: '18+' as const,
          categories: ['entertainment'],
          participants: [
            { wallet: '0x1234567890123456789012345678901234567890', role: 'performer' }
          ]
        },
        pricing: {
          priceUSDC: '5000000', // 5 USDC
          splitterAddress: '0x2345678901234567890123456789012345678901'
        },
        settings: {
          storageClass: 'shreddable' as const,
          geoMask: 0xFFFFFFFF,
          enableWatermark: true
        }
      };

      const result = await uploadPipelineService.startUpload(uploadRequest);

      expect(result.success).toBe(true);
      expect(result.uploadId).toBeDefined();
      expect(result.uploadId).toMatch(/^upload_\d+_[a-f0-9]{16}$/);
      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('should handle upload start errors gracefully', async () => {
      mockRedisService.set.mockRejectedValue(new Error('Redis error'));

      const uploadRequest = {
        creatorAddress: '0x1234567890123456789012345678901234567890',
        file: {
          buffer: Buffer.from('test video content'),
          originalName: 'test-video.mp4',
          mimeType: 'video/mp4',
          size: 1024000
        },
        metadata: {
          title: 'Test Video',
          description: 'A test video for upload',
          tags: ['test'],
          ageRating: '18+' as const,
          categories: ['entertainment'],
          participants: []
        },
        pricing: {
          priceUSDC: '5000000',
          splitterAddress: '0x2345678901234567890123456789012345678901'
        },
        settings: {
          storageClass: 'permanent' as const,
          geoMask: 0xFFFFFFFF,
          enableWatermark: false
        }
      };

      const result = await uploadPipelineService.startUpload(uploadRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getUploadProgress', () => {
    it('should return upload progress successfully', async () => {
      const uploadId = 'upload_123456789_abcdef1234567890';
      const mockProgress = {
        uploadId,
        status: 'transcoding',
        progress: 50,
        currentStep: 'Transcoding video with Livepeer'
      };

      mockRedisService.get.mockResolvedValue(mockProgress);

      const result = await uploadPipelineService.getUploadProgress(uploadId);

      expect(result).toEqual(mockProgress);
      expect(mockRedisService.get).toHaveBeenCalledWith(`upload_progress:${uploadId}`);
    });

    it('should return null for non-existent upload', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await uploadPipelineService.getUploadProgress('non-existent');

      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisService.get.mockRejectedValue(new Error('Redis error'));

      const result = await uploadPipelineService.getUploadProgress('test-upload');

      expect(result).toBeNull();
    });
  });

  describe('cancelUpload', () => {
    it('should cancel upload successfully', async () => {
      const uploadId = 'upload_123456789_abcdef1234567890';
      const mockProgress = {
        uploadId,
        status: 'transcoding',
        progress: 50,
        currentStep: 'Transcoding video with Livepeer'
      };

      mockRedisService.get.mockResolvedValue(mockProgress);
      mockRedisService.set.mockResolvedValue(true);

      const result = await uploadPipelineService.cancelUpload(uploadId);

      expect(result).toBe(true);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `upload_progress:${uploadId}`,
        expect.objectContaining({
          status: 'failed',
          error: 'Upload cancelled by user'
        }),
        86400
      );
    });

    it('should not cancel completed upload', async () => {
      const uploadId = 'upload_123456789_abcdef1234567890';
      const mockProgress = {
        uploadId,
        status: 'completed',
        progress: 100,
        currentStep: 'Upload completed successfully'
      };

      mockRedisService.get.mockResolvedValue(mockProgress);

      const result = await uploadPipelineService.cancelUpload(uploadId);

      expect(result).toBe(false);
    });

    it('should return false for non-existent upload', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await uploadPipelineService.cancelUpload('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('encryptContent', () => {
    it('should encrypt content successfully', async () => {
      const file = {
        buffer: Buffer.from('test video content'),
        originalName: 'test-video.mp4'
      };

      // Access private method for testing
      const encryptContent = (uploadPipelineService as any).encryptContent.bind(uploadPipelineService);
      const result = await encryptContent(file);

      expect(result).toHaveProperty('encryptedBuffer');
      expect(result).toHaveProperty('keyId');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('encryptionKey');
      expect(result.encryptedBuffer).toBeInstanceOf(Buffer);
      expect(result.keyId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('applyWatermarking', () => {
    it('should apply watermarking successfully', async () => {
      const transcodingResult = {
        hlsManifest: 'https://example.com/manifest.m3u8',
        hlsUrl: 'https://example.com/manifest.m3u8',
        thumbnailUrl: 'https://example.com/thumbnail.jpg',
        duration: 120,
        resolution: '1920x1080',
        bitrate: 5000000
      };

      // Access private method for testing
      const applyWatermarking = (uploadPipelineService as any).applyWatermarking.bind(uploadPipelineService);
      const result = await applyWatermarking(transcodingResult);

      expect(result).toHaveProperty('overlayTemplate');
      expect(result).toHaveProperty('watermarkId');
      expect(result).toHaveProperty('overlayConfig');
      expect(result.watermarkId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(result.overlayTemplate).toContain('{{userAddress}}');
      expect(result.overlayTemplate).toContain('{{sessionId}}');
    });
  });

  describe('computePerceptualHash', () => {
    it('should compute perceptual hash successfully', async () => {
      const hlsUrl = 'https://example.com/manifest.m3u8';

      // Access private method for testing
      const computePerceptualHash = (uploadPipelineService as any).computePerceptualHash.bind(uploadPipelineService);
      const result = await computePerceptualHash(hlsUrl);

      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('features');
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.features).toHaveLength(64);
    });
  });

  describe('generateUploadId', () => {
    it('should generate unique upload IDs', () => {
      // Access private method for testing
      const generateUploadId = (uploadPipelineService as any).generateUploadId.bind(uploadPipelineService);
      
      const id1 = generateUploadId();
      const id2 = generateUploadId();

      expect(id1).toMatch(/^upload_\d+_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^upload_\d+_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });
  });
});