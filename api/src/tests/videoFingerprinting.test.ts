import { videoFingerprintService } from '../services/ai/videoFingerprintService';
import { processFingerprintingJob } from '../services/ai/processors/fingerprintingProcessor';
import { Job } from 'bull';

// Mock external dependencies
jest.mock('fluent-ffmpeg', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn().mockImplementation((event, callback) => {
      if (event === 'end') {
        setTimeout(() => callback(), 100);
      }
      return this;
    }),
    outputOptions: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    run: jest.fn().mockReturnThis()
  }));
});

jest.mock('fluent-ffmpeg', () => ({
  ffprobe: jest.fn().mockImplementation((url, callback) => {
    callback(null, {
      format: {
        duration: 120,
        bit_rate: '1000000'
      },
      streams: [{
        codec_type: 'video',
        width: 1920,
        height: 1080,
        r_frame_rate: '30/1',
        codec_name: 'h264'
      }]
    });
  })
}));

jest.mock('node-phash', () => ({
  imageHash: jest.fn().mockImplementation((path, callback) => {
    callback(null, 'abcd1234efgh5678');
  })
}));

jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    grayscale: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue(undefined)
  }));
});

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue(['frame_0001.jpg', 'frame_0002.jpg', 'frame_0003.jpg']),
  readFile: jest.fn().mockResolvedValue(Buffer.from('mock-audio-data')),
  unlink: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../config/ai', () => ({
  weaviateClient: {
    data: {
      creator: jest.fn().mockReturnValue({
        withClassName: jest.fn().mockReturnThis(),
        withId: jest.fn().mockReturnThis(),
        withVector: jest.fn().mockReturnThis(),
        withProperties: jest.fn().mockReturnThis(),
        do: jest.fn().mockResolvedValue({ id: 'test-id' })
      })
    },
    graphql: {
      get: jest.fn().mockReturnValue({
        withClassName: jest.fn().mockReturnThis(),
        withFields: jest.fn().mockReturnThis(),
        withNearVector: jest.fn().mockReturnThis(),
        withLimit: jest.fn().mockReturnThis(),
        do: jest.fn().mockResolvedValue({
          data: {
            Get: {
              LeakFingerprint: [
                {
                  contentId: 'similar-content-1',
                  frameHashes: ['hash1', 'hash2', 'hash3'],
                  audioChroma: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
                  duration: 115,
                  resolution: '1920x1080'
                }
              ]
            }
          }
        })
      })
    }
  }
}));

jest.mock('../config/database', () => ({
  pool: {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    })
  }
}));

describe('VideoFingerprintService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateFingerprint', () => {
    it('should generate video fingerprint successfully', async () => {
      const videoUrl = 'https://example.com/test-video.mp4';
      
      const fingerprint = await videoFingerprintService.generateFingerprint(videoUrl);

      expect(fingerprint).toHaveProperty('frameHashes');
      expect(fingerprint).toHaveProperty('audioChroma');
      expect(fingerprint).toHaveProperty('duration');
      expect(fingerprint).toHaveProperty('resolution');
      
      expect(fingerprint.frameHashes).toBeInstanceOf(Array);
      expect(fingerprint.audioChroma).toBeInstanceOf(Array);
      expect(typeof fingerprint.duration).toBe('number');
      expect(typeof fingerprint.resolution).toBe('string');
    });

    it('should validate input parameters', async () => {
      await expect(
        videoFingerprintService.generateFingerprint('')
      ).rejects.toThrow();
    });

    it('should include metadata in fingerprint', async () => {
      const videoUrl = 'https://example.com/test-video.mp4';
      
      const fingerprint = await videoFingerprintService.generateFingerprint(videoUrl);

      expect(fingerprint.metadata).toBeDefined();
      expect(fingerprint.metadata?.fps).toBeDefined();
      expect(fingerprint.metadata?.bitrate).toBeDefined();
      expect(fingerprint.metadata?.codec).toBeDefined();
    });
  });

  describe('compareFingerprints', () => {
    it('should compare fingerprints and return match result', async () => {
      const fp1 = {
        frameHashes: ['hash1', 'hash2', 'hash3'],
        audioChroma: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
        duration: 120,
        resolution: '1920x1080'
      };

      const fp2 = {
        frameHashes: ['hash1', 'hash2', 'hash4'], // One different hash
        audioChroma: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
        duration: 118,
        resolution: '1920x1080'
      };

      const result = await videoFingerprintService.compareFingerprints(fp1, fp2);

      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('matchedFrames');
      expect(result).toHaveProperty('totalFrames');
      expect(result).toHaveProperty('confidence');
      
      expect(typeof result.similarity).toBe('number');
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(1);
      expect(result.matchedFrames).toBeGreaterThan(0);
    });

    it('should return high similarity for identical fingerprints', async () => {
      const fp1 = {
        frameHashes: ['hash1', 'hash2', 'hash3'],
        audioChroma: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
        duration: 120,
        resolution: '1920x1080'
      };

      const fp2 = { ...fp1 }; // Identical fingerprint

      const result = await videoFingerprintService.compareFingerprints(fp1, fp2);

      expect(result.similarity).toBeGreaterThan(0.9);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should return low similarity for completely different fingerprints', async () => {
      const fp1 = {
        frameHashes: ['hash1', 'hash2', 'hash3'],
        audioChroma: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
        duration: 120,
        resolution: '1920x1080'
      };

      const fp2 = {
        frameHashes: ['different1', 'different2', 'different3'],
        audioChroma: [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1],
        duration: 60,
        resolution: '1280x720'
      };

      const result = await videoFingerprintService.compareFingerprints(fp1, fp2);

      expect(result.similarity).toBeLessThan(0.5);
    });
  });

  describe('storeFingerprint', () => {
    it('should store fingerprint in vector database', async () => {
      const contentId = 'test-content-123';
      const fingerprint = {
        frameHashes: ['hash1', 'hash2', 'hash3'],
        audioChroma: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
        duration: 120,
        resolution: '1920x1080'
      };

      await videoFingerprintService.storeFingerprint(contentId, fingerprint);

      const mockWeaviate = require('../config/ai').weaviateClient;
      expect(mockWeaviate.data.creator().withClassName).toHaveBeenCalledWith('LeakFingerprint');
      expect(mockWeaviate.data.creator().withId).toHaveBeenCalledWith(contentId);
    });

    it('should validate input parameters', async () => {
      await expect(
        videoFingerprintService.storeFingerprint('', {} as any)
      ).rejects.toThrow();
    });
  });

  describe('findSimilarFingerprints', () => {
    it('should find similar fingerprints in database', async () => {
      const queryFingerprint = {
        frameHashes: ['hash1', 'hash2', 'hash3'],
        audioChroma: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
        duration: 120,
        resolution: '1920x1080'
      };

      const results = await videoFingerprintService.findSimilarFingerprints(queryFingerprint, 10);

      expect(results).toBeInstanceOf(Array);
      
      if (results.length > 0) {
        const firstResult = results[0];
        expect(firstResult).toHaveProperty('contentId');
        expect(firstResult).toHaveProperty('similarity');
        expect(firstResult).toHaveProperty('matchResult');
        expect(typeof firstResult.similarity).toBe('number');
      }
    });

    it('should limit results based on limit parameter', async () => {
      const queryFingerprint = {
        frameHashes: ['hash1', 'hash2', 'hash3'],
        audioChroma: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
        duration: 120,
        resolution: '1920x1080'
      };

      const results = await videoFingerprintService.findSimilarFingerprints(queryFingerprint, 5);

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });
});

describe('FingerprintingProcessor', () => {
  it('should process fingerprinting job successfully', async () => {
    const mockJob = {
      id: 'test-job-123',
      data: {
        contentId: 'test-content-789',
        videoUrl: 'https://example.com/test-video.mp4',
        jobId: 'test-job-123',
        operation: 'fingerprinting',
        priority: 'normal'
      },
      progress: jest.fn().mockResolvedValue(undefined)
    } as unknown as Job<any>;

    const result = await processFingerprintingJob(mockJob);

    expect(result).toHaveProperty('contentId', 'test-content-789');
    expect(result).toHaveProperty('fingerprint');
    expect(result.fingerprint).toHaveProperty('frameCount');
    expect(result.fingerprint).toHaveProperty('audioFeatures');
    expect(result.fingerprint).toHaveProperty('duration');
    expect(result.fingerprint).toHaveProperty('resolution');
    expect(mockJob.progress).toHaveBeenCalledWith(100);
  });

  it('should handle job processing errors', async () => {
    // Mock service to throw error
    const originalMethod = videoFingerprintService.generateFingerprint;
    videoFingerprintService.generateFingerprint = jest.fn().mockRejectedValue(new Error('Processing failed'));

    const mockJob = {
      id: 'test-job-error',
      data: {
        contentId: 'test-content-error',
        videoUrl: 'invalid-url',
        jobId: 'test-job-error',
        operation: 'fingerprinting',
        priority: 'normal'
      },
      progress: jest.fn().mockResolvedValue(undefined)
    } as unknown as Job<any>;

    await expect(processFingerprintingJob(mockJob)).rejects.toThrow('Processing failed');

    // Restore original method
    videoFingerprintService.generateFingerprint = originalMethod;
  });

  it('should store fingerprint metadata in database', async () => {
    const mockJob = {
      id: 'test-job-456',
      data: {
        contentId: 'test-content-456',
        videoUrl: 'https://example.com/test-video.mp4',
        jobId: 'test-job-456',
        operation: 'fingerprinting',
        priority: 'normal'
      },
      progress: jest.fn().mockResolvedValue(undefined)
    } as unknown as Job<any>;

    const result = await processFingerprintingJob(mockJob);

    // Verify database operations were called
    const mockPool = require('../config/database').pool;
    expect(mockPool.connect).toHaveBeenCalled();
    
    expect(result.fingerprint.frameCount).toBeGreaterThan(0);
    expect(result.fingerprint.duration).toBeGreaterThan(0);
  });
});