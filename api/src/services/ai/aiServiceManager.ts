import { logger } from '../../utils/logger';
import { initializeWeaviateSchema, initializeMeilisearchIndexes } from '../../config/ai';
import { 
  autoTaggingQueue, 
  fingerprintingQueue, 
  leakDetectionQueue, 
  complianceAnalysisQueue,
  vectorIndexingQueue,
  closeQueues 
} from '../../config/queues';

export class AIServiceManager {
  private static instance: AIServiceManager;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): AIServiceManager {
    if (!AIServiceManager.instance) {
      AIServiceManager.instance = new AIServiceManager();
    }
    return AIServiceManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info('AI services already initialized');
      return;
    }

    try {
      logger.info('Initializing AI services...');

      // Initialize vector database schema
      await this.initializeVectorDatabase();

      // Initialize search indexes
      await this.initializeSearchIndexes();

      // Start queue processors
      await this.startQueueProcessors();

      this.initialized = true;
      logger.info('✅ AI services initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize AI services', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  private async initializeVectorDatabase(): Promise<void> {
    try {
      logger.info('Initializing Weaviate vector database...');
      await initializeWeaviateSchema();
      logger.info('✅ Weaviate vector database initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize Weaviate', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async initializeSearchIndexes(): Promise<void> {
    try {
      logger.info('Initializing Meilisearch indexes...');
      await initializeMeilisearchIndexes();
      logger.info('✅ Meilisearch indexes initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize Meilisearch', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async startQueueProcessors(): Promise<void> {
    try {
      logger.info('Starting AI queue processors...');

      // Import and register queue processors
      const { processAutoTaggingJob } = await import('./processors/autoTaggingProcessor');
      const { processFingerprintingJob } = await import('./processors/fingerprintingProcessor');
      const { processLeakDetectionJob } = await import('./processors/leakDetectionProcessor');
      const { processComplianceAnalysisJob } = await import('./processors/complianceAnalysisProcessor');
      const { processVectorIndexingJob } = await import('./processors/vectorIndexingProcessor');

      // Register processors with concurrency limits
      autoTaggingQueue.process('auto-tagging', 2, processAutoTaggingJob);
      fingerprintingQueue.process('fingerprinting', 1, processFingerprintingJob);
      leakDetectionQueue.process('leak-detection', 3, processLeakDetectionJob);
      complianceAnalysisQueue.process('compliance-analysis', 2, processComplianceAnalysisJob);
      vectorIndexingQueue.process('vector-indexing', 5, processVectorIndexingJob);

      logger.info('✅ AI queue processors started');
    } catch (error) {
      logger.error('❌ Failed to start queue processors', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('Shutting down AI services...');
      
      // Close all queues gracefully
      await closeQueues();
      
      this.initialized = false;
      logger.info('✅ AI services shut down successfully');
    } catch (error) {
      logger.error('❌ Error during AI services shutdown', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: Record<string, any>;
  }> {
    const services: Record<string, any> = {};

    try {
      // Check Weaviate connection
      const { weaviateClient } = await import('../../config/ai');
      await weaviateClient.misc.liveChecker().do();
      services.weaviate = { status: 'healthy' };
    } catch (error) {
      services.weaviate = { 
        status: 'unhealthy', 
        error: (error as Error).message 
      };
    }

    try {
      // Check Meilisearch connection
      const { meilisearchClient } = await import('../../config/ai');
      await meilisearchClient.health();
      services.meilisearch = { status: 'healthy' };
    } catch (error) {
      services.meilisearch = { 
        status: 'unhealthy', 
        error: (error as Error).message 
      };
    }

    try {
      // Check queue health
      const { getQueueHealth } = await import('../../config/queues');
      const queueHealth = await getQueueHealth();
      services.queues = queueHealth;
    } catch (error) {
      services.queues = { 
        status: 'unhealthy', 
        error: (error as Error).message 
      };
    }

    const allHealthy = Object.values(services).every(service => 
      service.status === 'healthy' || 
      (Array.isArray(service) && service.every((q: any) => q.status === 'healthy'))
    );

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      services,
    };
  }
}

// Export singleton instance
export const aiServiceManager = AIServiceManager.getInstance();