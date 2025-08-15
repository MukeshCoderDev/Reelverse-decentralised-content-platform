import { aiServiceManager } from '../services/ai/aiServiceManager';
import { weaviateClient, meilisearchClient } from '../config/ai';

// Mock the AI clients
jest.mock('../config/ai', () => ({
  weaviateClient: {
    misc: {
      liveChecker: jest.fn().mockReturnValue({
        do: jest.fn().mockResolvedValue(true),
      }),
    },
    schema: {
      classGetter: jest.fn().mockReturnValue({
        withClassName: jest.fn().mockReturnValue({
          do: jest.fn().mockRejectedValue(new Error('Class not found')),
        }),
      }),
      classCreator: jest.fn().mockReturnValue({
        withClass: jest.fn().mockReturnValue({
          do: jest.fn().mockResolvedValue(true),
        }),
      }),
    },
  },
  meilisearchClient: {
    health: jest.fn().mockResolvedValue({ status: 'available' }),
    index: jest.fn().mockReturnValue({
      updateSearchableAttributes: jest.fn().mockResolvedValue({}),
      updateFilterableAttributes: jest.fn().mockResolvedValue({}),
      updateSortableAttributes: jest.fn().mockResolvedValue({}),
      updateRankingRules: jest.fn().mockResolvedValue({}),
    }),
  },
  initializeWeaviateSchema: jest.fn().mockResolvedValue(undefined),
  initializeMeilisearchIndexes: jest.fn().mockResolvedValue(undefined),
}));

// Mock the queues
jest.mock('../config/queues', () => ({
  autoTaggingQueue: {
    process: jest.fn(),
  },
  fingerprintingQueue: {
    process: jest.fn(),
  },
  leakDetectionQueue: {
    process: jest.fn(),
  },
  complianceAnalysisQueue: {
    process: jest.fn(),
  },
  vectorIndexingQueue: {
    process: jest.fn(),
  },
  closeQueues: jest.fn().mockResolvedValue(undefined),
  getQueueHealth: jest.fn().mockResolvedValue([
    { name: 'auto-tagging', status: 'healthy', counts: { waiting: 0, active: 0, completed: 0, failed: 0 } },
    { name: 'fingerprinting', status: 'healthy', counts: { waiting: 0, active: 0, completed: 0, failed: 0 } },
  ]),
}));

// Mock the processors
jest.mock('../services/ai/processors/autoTaggingProcessor', () => ({
  processAutoTaggingJob: jest.fn(),
}));

jest.mock('../services/ai/processors/fingerprintingProcessor', () => ({
  processFingerprintingJob: jest.fn(),
}));

jest.mock('../services/ai/processors/leakDetectionProcessor', () => ({
  processLeakDetectionJob: jest.fn(),
}));

jest.mock('../services/ai/processors/complianceAnalysisProcessor', () => ({
  processComplianceAnalysisJob: jest.fn(),
}));

jest.mock('../services/ai/processors/vectorIndexingProcessor', () => ({
  processVectorIndexingJob: jest.fn(),
}));

describe('AIServiceManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize AI services successfully', async () => {
      await aiServiceManager.initialize();
      expect(aiServiceManager.isInitialized()).toBe(true);
    });

    it('should not initialize twice', async () => {
      await aiServiceManager.initialize();
      await aiServiceManager.initialize(); // Second call should be ignored
      expect(aiServiceManager.isInitialized()).toBe(true);
    });
  });

  describe('health check', () => {
    beforeEach(async () => {
      await aiServiceManager.initialize();
    });

    it('should return healthy status when all services are working', async () => {
      const health = await aiServiceManager.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.services).toHaveProperty('weaviate');
      expect(health.services).toHaveProperty('meilisearch');
      expect(health.services).toHaveProperty('queues');
    });

    it('should return unhealthy status when Weaviate is down', async () => {
      // Mock Weaviate failure
      (weaviateClient.misc.liveChecker as jest.Mock).mockReturnValue({
        do: jest.fn().mockRejectedValue(new Error('Connection failed')),
      });

      const health = await aiServiceManager.healthCheck();
      
      expect(health.status).toBe('unhealthy');
      expect(health.services.weaviate.status).toBe('unhealthy');
    });

    it('should return unhealthy status when Meilisearch is down', async () => {
      // Mock Meilisearch failure
      (meilisearchClient.health as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const health = await aiServiceManager.healthCheck();
      
      expect(health.status).toBe('unhealthy');
      expect(health.services.meilisearch.status).toBe('unhealthy');
    });
  });

  describe('shutdown', () => {
    it('should shutdown AI services gracefully', async () => {
      await aiServiceManager.initialize();
      await aiServiceManager.shutdown();
      
      expect(aiServiceManager.isInitialized()).toBe(false);
    });

    it('should handle shutdown when not initialized', async () => {
      await expect(aiServiceManager.shutdown()).resolves.not.toThrow();
    });
  });
});

describe('AI Service Integration', () => {
  it('should handle queue processor registration', async () => {
    const { autoTaggingQueue } = require('../config/queues');
    
    await aiServiceManager.initialize();
    
    expect(autoTaggingQueue.process).toHaveBeenCalledWith(
      'auto-tagging',
      2,
      expect.any(Function)
    );
  });

  it('should handle database schema initialization', async () => {
    const { initializeWeaviateSchema, initializeMeilisearchIndexes } = require('../config/ai');
    
    await aiServiceManager.initialize();
    
    expect(initializeWeaviateSchema).toHaveBeenCalled();
    expect(initializeMeilisearchIndexes).toHaveBeenCalled();
  });
});