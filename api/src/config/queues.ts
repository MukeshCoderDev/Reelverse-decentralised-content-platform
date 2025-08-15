import Queue from 'bull';
import { redisClient } from './redis';
import { logger } from '../utils/logger';

// Queue configurations
const queueConfig = {
  redis: {
    port: parseInt(process.env.REDIS_PORT || '6379'),
    host: process.env.REDIS_HOST || 'localhost',
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

// AI Processing Queues
export const autoTaggingQueue = new Queue('auto-tagging', queueConfig);
export const fingerprintingQueue = new Queue('fingerprinting', queueConfig);
export const leakDetectionQueue = new Queue('leak-detection', queueConfig);
export const complianceAnalysisQueue = new Queue('compliance-analysis', queueConfig);
export const vectorIndexingQueue = new Queue('vector-indexing', queueConfig);

// Queue monitoring and error handling
const setupQueueMonitoring = (queue: Queue, queueName: string) => {
  queue.on('completed', (job, result) => {
    logger.info(`${queueName} job completed`, {
      jobId: job.id,
      data: job.data,
      result: typeof result === 'object' ? JSON.stringify(result) : result,
    });
  });

  queue.on('failed', (job, err) => {
    logger.error(`${queueName} job failed`, {
      jobId: job.id,
      data: job.data,
      error: err.message,
      stack: err.stack,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn(`${queueName} job stalled`, {
      jobId: job.id,
      data: job.data,
    });
  });

  queue.on('progress', (job, progress) => {
    logger.debug(`${queueName} job progress`, {
      jobId: job.id,
      progress,
    });
  });
};

// Setup monitoring for all queues
setupQueueMonitoring(autoTaggingQueue, 'auto-tagging');
setupQueueMonitoring(fingerprintingQueue, 'fingerprinting');
setupQueueMonitoring(leakDetectionQueue, 'leak-detection');
setupQueueMonitoring(complianceAnalysisQueue, 'compliance-analysis');
setupQueueMonitoring(vectorIndexingQueue, 'vector-indexing');

// Queue health check
export const getQueueHealth = async () => {
  const queues = [
    { name: 'auto-tagging', queue: autoTaggingQueue },
    { name: 'fingerprinting', queue: fingerprintingQueue },
    { name: 'leak-detection', queue: leakDetectionQueue },
    { name: 'compliance-analysis', queue: complianceAnalysisQueue },
    { name: 'vector-indexing', queue: vectorIndexingQueue },
  ];

  const health = await Promise.all(
    queues.map(async ({ name, queue }) => {
      try {
        const [waiting, active, completed, failed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
        ]);

        return {
          name,
          status: 'healthy',
          counts: {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
          },
        };
      } catch (error) {
        return {
          name,
          status: 'unhealthy',
          error: (error as Error).message,
        };
      }
    })
  );

  return health;
};

// Graceful shutdown
export const closeQueues = async () => {
  logger.info('Closing AI processing queues...');
  
  await Promise.all([
    autoTaggingQueue.close(),
    fingerprintingQueue.close(),
    leakDetectionQueue.close(),
    complianceAnalysisQueue.close(),
    vectorIndexingQueue.close(),
  ]);
  
  logger.info('All AI processing queues closed');
};

// Queue job priorities
export const JobPriority = {
  LOW: 1,
  NORMAL: 5,
  HIGH: 10,
  CRITICAL: 15,
} as const;

// Queue job options factory
export const createJobOptions = (priority: number = JobPriority.NORMAL, delay?: number) => ({
  ...queueConfig.defaultJobOptions,
  priority,
  delay,
});

// Bulk job operations
export const addBulkJobs = async (
  queue: Queue,
  jobs: Array<{ data: any; opts?: any }>
) => {
  try {
    const result = await queue.addBulk(jobs);
    logger.info(`Added ${jobs.length} jobs to ${queue.name} queue`);
    return result;
  } catch (error) {
    logger.error(`Failed to add bulk jobs to ${queue.name} queue`, {
      error: (error as Error).message,
      jobCount: jobs.length,
    });
    throw error;
  }
};

// Queue statistics
export const getQueueStats = async (queue: Queue) => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getCompleted(),
    queue.getFailed(),
    queue.getDelayed(),
  ]);

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
    total: waiting.length + active.length + completed.length + failed.length + delayed.length,
  };
};