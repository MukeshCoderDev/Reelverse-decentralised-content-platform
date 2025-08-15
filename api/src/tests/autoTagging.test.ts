import { autoTaggingService } from '../services/ai/autoTaggingService';
import { processAutoTaggingJob } from '../services/ai/processors/autoTaggingProcessor';
import { Job } from 'bull';

// Mock external dependencies
jest.mock('../config/ai', () => ({
  openaiClient: {
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    }
  },
  huggingfaceClient: {
    imageClassification: jest.fn().mockResolvedValue([
      { label: 'blonde', score: 0.85 },
      { label: 'bedroom', score: 0.78 },
      { label: 'lingerie', score: 0.92 }
    ]),
    imageToText: jest.fn().mockResolvedValue({
      generated_text: 'a woman with blonde hair in a bedroom wearing lingerie'
    })
  }
}));

jest.mock('fluent-ffmpeg', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn().mockImplementation((event, callback) => {
      if (event === 'end') {
        // Simulate successful frame extraction
        setTimeout(() => callback(), 100);
      }
      return this;
    }),
    outputOptions: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    run: jest.fn().mockReturnThis()
  }));
});

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('mock-image-data')),
  unlink: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed-image'))
  }));
});

jest.mock('../config/database', () => ({
  pool: {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    })
  }
}));

jest.mock('../config/queues', () => ({
  vectorIndexingQueue: {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' })
  },
  JobPriority: { NORMAL: 5 },
  createJobOptions: jest.fn().mockReturnValue({})
}));

describe('AutoTaggingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTags', () => {
    it('should generate AI tags from video content', async () => {
      const contentId = 'test-content-123';
      const mediaUrl = 'https://example.com/video.mp4';
      const existingTags = ['manual-tag'];

      const result = await autoTaggingService.generateTags(contentId, mediaUrl, existingTags);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      // Check tag structure
      result.forEach(tag => {
        expect(tag).toHaveProperty('tag');
        expect(tag).toHaveProperty('confidence');
        expect(tag).toHaveProperty('category');
        expect(typeof tag.tag).toBe('string');
        expect(typeof tag.confidence).toBe('number');
        expect(tag.confidence).toBeGreaterThanOrEqual(0);
        expect(tag.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should handle empty existing tags', async () => {
      const contentId = 'test-content-456';
      const mediaUrl = 'https://example.com/video2.mp4';

      const result = await autoTaggingService.generateTags(contentId, mediaUrl);

      expect(result).toBeInstanceOf(Array);
    });

    it('should validate input parameters', async () => {
      await expect(
        autoTaggingService.generateTags('', 'https://example.com/video.mp4')
      ).rejects.toThrow();

      await expect(
        autoTaggingService.generateTags('test-content', '')
      ).rejects.toThrow();
    });
  });

  describe('processEmbeddings', () => {
    it('should generate vector embeddings from media', async () => {
      const mediaUrl = 'https://example.com/video.mp4';

      const result = await autoTaggingService.processEmbeddings(mediaUrl);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(1536); // OpenAI embedding dimension
      expect(result.every(val => typeof val === 'number')).toBe(true);
    });

    it('should validate media URL', async () => {
      await expect(
        autoTaggingService.processEmbeddings('')
      ).rejects.toThrow();
    });
  });
});

describe('AutoTaggingProcessor', () => {
  it('should process auto-tagging job successfully', async () => {
    const mockJob = {
      id: 'test-job-123',
      data: {
        contentId: 'test-content-789',
        mediaUrl: 'https://example.com/video.mp4',
        existingTags: ['existing-tag'],
        jobId: 'test-job-123',
        operation: 'auto-tagging',
        priority: 'normal'
      },
      progress: jest.fn().mockResolvedValue(undefined)
    } as unknown as Job<any>;

    const result = await processAutoTaggingJob(mockJob);

    expect(result).toHaveProperty('contentId', 'test-content-789');
    expect(result).toHaveProperty('aiTags');
    expect(result).toHaveProperty('embedding');
    expect(result.aiTags).toBeInstanceOf(Array);
    expect(mockJob.progress).toHaveBeenCalledWith(100);
  });

  it('should handle job processing errors', async () => {
    const mockJob = {
      id: 'test-job-error',
      data: {
        contentId: '',
        mediaUrl: '',
        existingTags: [],
        jobId: 'test-job-error',
        operation: 'auto-tagging',
        priority: 'normal'
      },
      progress: jest.fn().mockResolvedValue(undefined)
    } as unknown as Job<any>;

    await expect(processAutoTaggingJob(mockJob)).rejects.toThrow();
  });
});