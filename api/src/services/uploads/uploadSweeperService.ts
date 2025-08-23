import { getUploadSessionService, UploadSessionService } from '../uploads/uploadSessionService';
import { getStorageService, ResumableStorageService } from '../storage/resumableStorageService';
import { logger } from '../../utils/logger';
import cron from 'node-cron';

export interface SweeperConfig {
  intervalMinutes: number;
  sessionTTLHours: number;
  batchSize: number;
  dryRun: boolean;
}

export interface SweeperStats {
  sessionsChecked: number;
  sessionsAborted: number;
  storageCleanups: number;
  errors: number;
  duration: number;
  timestamp: Date;
}

/**
 * Upload Session Sweeper Service
 * 
 * Periodically cleans up stale upload sessions that have expired
 * or been abandoned, freeing up storage resources and database space.
 */
export class UploadSweeperService {
  private uploadService: UploadSessionService;
  private storageService: ResumableStorageService;
  private config: SweeperConfig;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private lastRun: Date | null = null;
  private stats: SweeperStats | null = null;

  constructor(config: Partial<SweeperConfig> = {}) {
    this.uploadService = getUploadSessionService();
    this.storageService = getStorageService();
    
    this.config = {
      intervalMinutes: parseInt(process.env.UPLOAD_SWEEPER_INTERVAL_MINUTES || '60', 10),
      sessionTTLHours: parseInt(process.env.UPLOAD_SESSION_TTL_HOURS || '24', 10),
      batchSize: parseInt(process.env.UPLOAD_SWEEPER_BATCH_SIZE || '100', 10),
      dryRun: process.env.UPLOAD_SWEEPER_DRY_RUN === 'true',
      ...config,
    };

    logger.info('Upload sweeper service initialized', {
      config: this.config,
    });
  }

  /**
   * Start the sweeper with cron scheduling
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Upload sweeper already started');
      return;
    }

    // Create cron expression for the interval
    const cronExpression = `*/${this.config.intervalMinutes} * * * *`;

    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.sweep();
    }, {
      scheduled: false, // Don't start immediately
    });

    this.cronJob.start();

    logger.info('Upload sweeper started', {
      intervalMinutes: this.config.intervalMinutes,
      cronExpression,
    });
  }

  /**
   * Stop the sweeper
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Upload sweeper stopped');
    }
  }

  /**
   * Perform a manual sweep operation
   */
  async sweep(): Promise<SweeperStats> {
    if (this.isRunning) {
      logger.warn('Sweep already in progress, skipping');
      return this.stats || this.createEmptyStats();
    }

    this.isRunning = true;
    const startTime = Date.now();

    const stats: SweeperStats = {
      sessionsChecked: 0,
      sessionsAborted: 0,
      storageCleanups: 0,
      errors: 0,
      duration: 0,
      timestamp: new Date(),
    };

    try {
      logger.info('Starting upload session sweep', {
        sessionTTLHours: this.config.sessionTTLHours,
        batchSize: this.config.batchSize,
        dryRun: this.config.dryRun,
      });

      // Calculate cutoff time for stale sessions
      const cutoffTime = new Date(Date.now() - (this.config.sessionTTLHours * 60 * 60 * 1000));

      // Get stale sessions in batches
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const staleSessions = await this.uploadService.getStaleUploadingSessions(cutoffTime);
        
        if (staleSessions.length === 0) {
          hasMore = false;
          break;
        }

        stats.sessionsChecked += staleSessions.length;

        // Process each stale session
        for (const session of staleSessions) {
          try {
            await this.cleanupSession(session, stats);
          } catch (error) {
            stats.errors++;
            logger.error('Failed to cleanup session', {
              sessionId: session.id,
              userId: session.userId,
              error: error.message,
            });
          }
        }

        offset += staleSessions.length;

        // Prevent infinite loops
        if (staleSessions.length < this.config.batchSize) {
          hasMore = false;
        }

        // Brief pause between batches to reduce database load
        await this.sleep(100);
      }

      stats.duration = Date.now() - startTime;
      this.stats = stats;
      this.lastRun = new Date();

      logger.info('Upload session sweep completed', {
        ...stats,
        dryRun: this.config.dryRun,
      });

      // Record sweep metrics
      await this.recordSweeperMetrics(stats);

    } catch (error) {
      stats.errors++;
      stats.duration = Date.now() - startTime;
      
      logger.error('Upload session sweep failed', {
        error: error.message,
        stats,
      });
    } finally {
      this.isRunning = false;
    }

    return stats;
  }

  /**
   * Clean up a single stale session
   */
  private async cleanupSession(session: any, stats: SweeperStats): Promise<void> {
    const { id: sessionId, userId, storageKey, storageUploadId } = session;

    logger.debug('Cleaning up stale session', {
      sessionId,
      userId,
      storageKey,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      bytesReceived: session.bytesReceived,
      totalBytes: session.totalBytes,
    });

    if (!this.config.dryRun) {
      try {
        // Abort multipart upload in storage
        if (storageUploadId) {
          await this.storageService.abortMultipartUpload(
            process.env.STORAGE_BUCKET_UPLOADS!,
            storageKey,
            storageUploadId
          );
          stats.storageCleanups++;
        }

        // Update session status to aborted
        await this.uploadService.updateSessionStatus(sessionId, 'aborted', 'Cleaned up by sweeper');

        // Record cleanup metric
        await this.uploadService.recordMetric({
          uploadId: sessionId,
          userId,
          eventType: 'session_swept',
          metadata: {
            reason: 'stale_session',
            sweeperRun: this.lastRun?.toISOString(),
          },
        });

        stats.sessionsAborted++;

        logger.info('Successfully cleaned up stale session', {
          sessionId,
          userId,
          storageKey,
        });

      } catch (error) {
        logger.error('Failed to cleanup stale session', {
          sessionId,
          userId,
          storageKey,
          error: error.message,
        });
        throw error;
      }
    } else {
      // Dry run - just log what would be done
      stats.sessionsAborted++;
      logger.info('DRY RUN: Would clean up stale session', {
        sessionId,
        userId,
        storageKey,
        storageUploadId,
      });
    }
  }

  /**
   * Record sweeper operation metrics
   */
  private async recordSweeperMetrics(stats: SweeperStats): Promise<void> {
    try {
      await this.uploadService.recordMetric({
        uploadId: 'sweeper',
        userId: 'system',
        eventType: 'sweeper_run',
        processingTimeMs: stats.duration,
        metadata: {
          sessionsChecked: stats.sessionsChecked,
          sessionsAborted: stats.sessionsAborted,
          storageCleanups: stats.storageCleanups,
          errors: stats.errors,
          dryRun: this.config.dryRun,
          intervalMinutes: this.config.intervalMinutes,
          sessionTTLHours: this.config.sessionTTLHours,
        },
      });
    } catch (error) {
      logger.warn('Failed to record sweeper metrics', {
        error: error.message,
      });
    }
  }

  /**
   * Get current sweeper status
   */
  getStatus(): {
    isRunning: boolean;
    lastRun: Date | null;
    stats: SweeperStats | null;
    config: SweeperConfig;
    nextRun?: Date;
  } {
    let nextRun: Date | undefined;
    
    if (this.cronJob && this.lastRun) {
      // Estimate next run time
      const nextRunTime = new Date(this.lastRun.getTime() + (this.config.intervalMinutes * 60 * 1000));
      nextRun = nextRunTime;
    }

    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      stats: this.stats,
      config: this.config,
      nextRun,
    };
  }

  /**
   * Update sweeper configuration
   */
  updateConfig(newConfig: Partial<SweeperConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    logger.info('Updated sweeper configuration', {
      oldConfig,
      newConfig: this.config,
    });

    // Restart if interval changed and sweeper is running
    if (oldConfig.intervalMinutes !== this.config.intervalMinutes && this.cronJob) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get sweeper statistics history
   */
  async getStatsHistory(limit: number = 10): Promise<SweeperStats[]> {
    // This would query sweeper metrics from the database
    // For now, return current stats
    return this.stats ? [this.stats] : [];
  }

  /**
   * Force cleanup of specific sessions
   */
  async cleanupSessionsByIds(sessionIds: string[], force: boolean = false): Promise<{
    success: string[];
    failed: { sessionId: string; error: string }[];
  }> {
    const result = {
      success: [] as string[],
      failed: [] as { sessionId: string; error: string }[],
    };

    for (const sessionId of sessionIds) {
      try {
        const session = await this.uploadService.getSession(sessionId);
        
        if (!session) {
          result.failed.push({
            sessionId,
            error: 'Session not found',
          });
          continue;
        }

        // Only cleanup uploading sessions unless forced
        if (session.status !== 'uploading' && !force) {
          result.failed.push({
            sessionId,
            error: `Session status is ${session.status}, use force=true to cleanup anyway`,
          });
          continue;
        }

        const stats = this.createEmptyStats();
        await this.cleanupSession(session, stats);
        result.success.push(sessionId);

      } catch (error) {
        result.failed.push({
          sessionId,
          error: error.message,
        });
      }
    }

    return result;
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    activeSessions: number;
    totalBytesAllocated: number;
    orphanedUploads: number;
  }> {
    // This would query upload sessions and calculate storage usage
    // Implementation depends on your specific database schema
    return {
      activeSessions: 0,
      totalBytesAllocated: 0,
      orphanedUploads: 0,
    };
  }

  /**
   * Health check for sweeper service
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      // Check if sweeper is configured properly
      if (this.config.intervalMinutes <= 0) {
        return {
          healthy: false,
          error: 'Invalid interval configuration',
        };
      }

      // Check database connectivity via upload service
      const cutoffTime = new Date(Date.now() - 1000); // 1 second ago
      await this.uploadService.getStaleUploadingSessions(cutoffTime);

      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * Create empty stats object
   */
  private createEmptyStats(): SweeperStats {
    return {
      sessionsChecked: 0,
      sessionsAborted: 0,
      storageCleanups: 0,
      errors: 0,
      duration: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Default service instance
let uploadSweeperService: UploadSweeperService | null = null;

/**
 * Get or create the default upload sweeper service instance
 */
export function getUploadSweeperService(): UploadSweeperService {
  if (!uploadSweeperService) {
    uploadSweeperService = new UploadSweeperService();
  }
  return uploadSweeperService;
}