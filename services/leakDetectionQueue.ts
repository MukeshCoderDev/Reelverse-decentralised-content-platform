import Bull from 'bull';
import Redis from 'ioredis';
import { LeakDetectionService } from './leakDetectionService';

export interface LeakDetectionJob {
  contentId: string;
  priority?: number;
}

export class LeakDetectionQueue {
  private queue: Bull.Queue<LeakDetectionJob>;
  private leakDetectionService: LeakDetectionService;

  constructor(
    redis: Redis,
    leakDetectionService: LeakDetectionService,
    queueName: string = 'leak-detection'
  ) {
    this.leakDetectionService = leakDetectionService;
    
    this.queue = new Bull(queueName, {
      redis: {
        host: redis.options.host,
        port: redis.options.port,
        password: redis.options.password
      },
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    this.setupProcessors();
    this.setupEventHandlers();
  }

  /**
   * Add content to leak detection monitoring
   */
  async addToMonitoring(contentId: string, priority: number = 0): Promise<void> {
    await this.queue.add('detect-leaks', { contentId }, {
      priority,
      delay: 0 // Start immediately
    });

    // Schedule periodic checks every 6 hours
    await this.queue.add('detect-leaks', { contentId }, {
      priority: priority - 1,
      delay: 6 * 60 * 60 * 1000, // 6 hours
      repeat: { every: 6 * 60 * 60 * 1000 } // Every 6 hours
    });

    console.log(`Added content ${contentId} to leak detection queue`);
  }

  /**
   * Process SLA monitoring (runs every hour)
   */
  async startSLAMonitoring(): Promise<void> {
    await this.queue.add('sla-monitor', {}, {
      repeat: { cron: '0 * * * *' } // Every hour
    });

    console.log('Started SLA monitoring job');
  }

  /**
   * Setup job processors
   */
  private setupProcessors(): void {
    // Process leak detection jobs
    this.queue.process('detect-leaks', 5, async (job) => {
      const { contentId } = job.data;
      
      try {
        console.log(`Processing leak detection for content ${contentId}`);
        
        const leaks = await this.leakDetectionService.detectLeaks(contentId);
        
        return {
          contentId,
          leaksFound: leaks.length,
          leaks: leaks.map(leak => ({
            platform: leak.platform,
            matchScore: leak.matchScore,
            url: leak.detectedUrl
          }))
        };
      } catch (error) {
        console.error(`Leak detection failed for content ${contentId}:`, error);
        throw error;
      }
    });

    // Process SLA monitoring jobs
    this.queue.process('sla-monitor', 1, async (job) => {
      try {
        console.log('Running SLA monitoring check');
        await this.leakDetectionService.monitorSLA();
        
        const stats = await this.leakDetectionService.getDetectionStats();
        console.log('SLA monitoring stats:', stats);
        
        return stats;
      } catch (error) {
        console.error('SLA monitoring failed:', error);
        throw error;
      }
    });
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    this.queue.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed:`, result);
    });

    this.queue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err.message);
    });

    this.queue.on('stalled', (job) => {
      console.warn(`Job ${job.id} stalled`);
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<any> {
    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length
    };
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    console.log('Leak detection queue paused');
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    console.log('Leak detection queue resumed');
  }

  /**
   * Clean up old jobs
   */
  async cleanup(): Promise<void> {
    await this.queue.clean(24 * 60 * 60 * 1000, 'completed'); // Remove completed jobs older than 24h
    await this.queue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // Remove failed jobs older than 7 days
    console.log('Queue cleanup completed');
  }
}