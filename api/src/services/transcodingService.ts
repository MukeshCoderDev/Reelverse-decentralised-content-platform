import axios, { AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { metrics } from '../../core/metrics';
import { observability } from '../../core/observability';
import { featureFlags } from '../../core/featureFlags';
import { db } from '../../core/database';
import { eventBus } from '../../core/eventBus';
import { env } from '../config/env';

// Minimal type definitions for external data structures
export interface TranscodingProfile {
  name: string;
  width: number;
  height: number;
  bitrate: number;
}

export interface Rendition {
  url: string;
  resolution: string;
  bitrate: number;
  duration: number;
}

export interface TranscodingJob {
  jobId: string;
  contentId: string;
  inputUrl: string;
  inputSize: number;
  organizationId: string;
  creatorId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  livepeerAssetId?: string;
  webhookSecret: string;
  callbackUrl: string;
  profiles: TranscodingProfile[];
  lastError?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  manifestUrl?: string;
  thumbnailUrl?: string;
  inputDuration?: number;
  renditions?: Rendition[];
}

export interface LivepeerWebhook {
  id: string;
  type: 'asset.ready' | 'asset.failed' | 'asset.updated';
  timestamp: number;
  payload: {
    asset: {
      id: string;
      playbackUrl: string;
      staticMp4Url?: string;
      status: {
        phase: string;
        errorMessage?: string;
      };
      videoSpec?: {
        duration: number;
        width: number;
        height: number;
      };
    };
  };
}

export interface JobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  lastError?: string;
  livepeerAssetId?: string;
  manifestUrl?: string;
  thumbnailUrl?: string;
  renditions?: Rendition[];
}

export class TranscodingService {
  private jobs: Map<string, TranscodingJob> = new Map();
  private livepeerApiKey: string;
  private livepeerBaseUrl: string;
  private webhookSecret: string;
  private callbackBaseUrl: string;
  private jobCleanupInterval: NodeJS.Timeout;

  constructor() {
    this.livepeerApiKey = env.LIVEPEER_API_KEY;
    this.livepeerBaseUrl = env.LIVEPEER_BASE_URL;
    this.webhookSecret = env.LIVEPEER_WEBHOOK_SECRET;
    this.callbackBaseUrl = env.API_BASE_URL;

    if (!this.livepeerApiKey) {
      throw new Error('LIVEPEER_API_KEY environment variable is required');
    }

    this.jobCleanupInterval = setInterval(() => {}, 0); // Initialize with a dummy interval
    this.startJobCleanup();
  }

  /**
   * Create a new transcoding job
   */
  async createJob(
    contentId: string,
    inputUrl: string,
    inputSize: number,
    organizationId: string,
    creatorId: string,
    profiles?: TranscodingProfile[]
  ): Promise<string> {
    const timerId = metrics.startTimer('transcoding_job_creation', {
      organizationId,
      contentId: contentId.substr(0, 8)
    });

    try {
      if (!contentId || !inputUrl || !organizationId || !creatorId) {
        throw new Error('Missing required job parameters');
      }

      await this.checkRateLimits(organizationId);

      const jobId = `transcode_${Date.now()}_${uuidv4()}`;
      const webhookSecret = crypto.randomBytes(32).toString('hex');
      const callbackUrl = `${this.callbackBaseUrl}/api/transcoding/webhook/${jobId}`;

      const transcodingProfiles = profiles || this.getOptimalProfiles(inputSize);

      const job: TranscodingJob = {
        jobId,
        contentId,
        inputUrl,
        inputSize,
        organizationId,
        creatorId,
        status: 'pending',
        webhookSecret,
        callbackUrl,
        profiles: transcodingProfiles,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.jobs.set(jobId, job);

      // Start Livepeer transcoding asynchronously
      const livepeerAssetId = await this.createLivepeerAsset(job);
      job.livepeerAssetId = livepeerAssetId;
      job.status = 'processing';
      job.updatedAt = new Date();

      await eventBus.publish({
        type: 'transcoding.job.started',
        version: '1.0',
        correlationId: `transcode-${jobId}`,
        payload: {
          jobId,
          contentId,
          livepeerAssetId,
          profiles: transcodingProfiles,
          organizationId,
          creatorId
        },
        metadata: {
          source: 'transcoding-service',
          userId: creatorId,
          organizationId,
          contentId
        }
      });

      metrics.endTimer(timerId, true);
      metrics.counter('transcoding_jobs_created_total', 1, {
        organizationId,
        status: 'success'
      });
      observability.logEvent('info', 'Transcoding job created', {
        jobId,
        contentId,
        organizationId
      });

      return jobId;

    } catch (error: any) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      metrics.counter('transcoding_jobs_created_total', 1, {
        organizationId: organizationId || 'unknown',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      logger.error('Error creating transcoding job:', error);
      throw error;
    }
  }

  /**
   * Handle Livepeer webhook callbacks with signature verification
   */
  async handleWebhook(payload: LivepeerWebhook, signature: string, jobId: string): Promise<void> {
    const timerId = metrics.startTimer('webhook_processing', {
      jobId: jobId.substr(0, 8),
      webhookType: payload.type
    });

    try {
      const job = this.jobs.get(jobId);
      if (!job) {
        logger.warn(`Webhook received for non-existent job: ${jobId}`);
        throw new Error('Job not found');
      }

      // Verify webhook signature
      if (!this.verifyWebhookSignature(payload, signature, job.webhookSecret)) {
        throw new Error('Invalid webhook signature');
      }

      // Check for replay attacks (timestamp should be within 5 minutes)
      const webhookAge = Date.now() - (payload.timestamp * 1000);
      if (webhookAge > 300000) { // 5 minutes
        throw new Error('Webhook timestamp too old, possible replay attack');
      }

      // Process webhook based on type
      await this.processWebhookPayload(job, payload);

      metrics.endTimer(timerId, true);
      metrics.counter('webhooks_processed_total', 1, {
        jobId: jobId.substr(0, 8),
        webhookType: payload.type,
        assetId: payload.payload.asset.id,
        assetStatus: payload.payload.asset.status.phase
      });
      observability.logEvent('info', 'Livepeer webhook processed', {
        jobId,
        webhookType: payload.type,
        assetId: payload.payload.asset.id,
        assetStatus: payload.payload.asset.status.phase
      });

    } catch (error: any) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      metrics.counter('webhooks_processed_total', 1, {
        jobId: jobId.substr(0, 8),
        webhookType: payload.type,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        assetId: payload.payload?.asset?.id || 'unknown'
      });
      logger.error('Error processing Livepeer webhook:', error);
      throw error;
    }
  }

  /**
   * Get transcoding job status
   */
  getJobStatus(jobId: string): JobStatus | null {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }
    return {
      status: job.status,
      progress: job.status === 'processing' ? 50 : (job.status === 'completed' ? 100 : 0), // Placeholder progress
      lastError: job.lastError,
      livepeerAssetId: job.livepeerAssetId,
      manifestUrl: job.manifestUrl,
      thumbnailUrl: job.thumbnailUrl,
      renditions: job.renditions
    };
  }

  /**
   * Retry a failed transcoding job
   */
  async retryJob(jobId: string): Promise<string> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== 'failed' && job.status !== 'cancelled') {
      throw new Error(`Job ${jobId} is not in a retryable state (${job.status})`);
    }

    if (job.retryCount >= 3) { // Max 3 retries
      throw new Error(`Job ${jobId} has exceeded maximum retry attempts`);
    }

    job.status = 'pending';
    job.retryCount++;
    job.lastError = undefined;
    job.updatedAt = new Date();

    try {
      const livepeerAssetId = await this.createLivepeerAsset(job);
      job.livepeerAssetId = livepeerAssetId;
      job.status = 'processing';
      job.updatedAt = new Date();

      await eventBus.publish({
        type: 'transcoding.job.retried',
        version: '1.0',
        correlationId: `transcode-${jobId}`,
        payload: {
          jobId,
          contentId: job.contentId,
          retryCount: job.retryCount,
          livepeerAssetId
        },
        metadata: {
          source: 'transcoding-service',
          userId: job.creatorId,
          organizationId: job.organizationId,
          contentId: job.contentId
        }
      });

      logger.info(`Job ${jobId} retried successfully. New Livepeer Asset ID: ${livepeerAssetId}`);
      return livepeerAssetId;
    } catch (error: any) {
      job.status = 'failed';
      job.lastError = error instanceof Error ? error.message : 'Unknown error';
      job.updatedAt = new Date();
      logger.error(`Failed to retry job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a transcoding job
   */
  async cancelJob(jobId: string, reason: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new Error(`Job ${jobId} is already ${job.status}`);
    }

    job.status = 'cancelled';
    job.lastError = reason;
    job.updatedAt = new Date();

    // Cancel Livepeer asset if exists
    if (job.livepeerAssetId) {
      try {
        await this.cancelLivepeerAsset(job.livepeerAssetId);
      } catch (error: any) {
        logger.warn(`Failed to cancel Livepeer asset ${job.livepeerAssetId} for job ${jobId}:`, error);
        observability.logEvent('warn', 'Failed to cancel Livepeer asset', {
          jobId,
          livepeerAssetId: job.livepeerAssetId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    await eventBus.publish({
      type: 'transcoding.job.cancelled',
      version: '1.0',
      correlationId: `transcode-${jobId}`,
      payload: {
        jobId,
        contentId: job.contentId,
        reason
      },
      metadata: {
        source: 'transcoding-service',
        userId: job.creatorId,
        organizationId: job.organizationId,
        contentId: job.contentId
      }
    });

    logger.info(`Job ${jobId} cancelled: ${reason}`);
  }

  /**
   * Create Livepeer asset with webhook configuration
   */
  private async createLivepeerAsset(job: TranscodingJob): Promise<string> {
    try {
      const response: AxiosResponse = await axios.post(
        `${this.livepeerBaseUrl}/asset/request-upload`,
        {
          name: `Reelverse Content - ${job.contentId}`,
          staticMp4: true,
          playbackPolicy: {
            type: 'webhook',
            webhookId: env.LIVEPEER_WEBHOOK_ID,
            webhookContext: {
              jobId: job.jobId,
              contentId: job.contentId,
              organizationId: job.organizationId,
              creatorId: job.creatorId
            }
          },
          profiles: this.convertToLivepeerProfiles(job.profiles)
        },
        {
          headers: {
            'Authorization': `Bearer ${this.livepeerApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const { asset, tusEndpoint } = response.data;

      // In a real implementation, you would use the tusEndpoint to upload the file
      // For now, we'll simulate the upload process
      await this.uploadToLivepeer(tusEndpoint, job.inputUrl);

      return asset.id;

    } catch (error: any) {
      logger.error('Error creating Livepeer asset:', error);
      throw new Error(`Failed to create Livepeer asset: ${error.message}`);
    }
  }

  /**
   * Simulate upload to Livepeer (in production, use TUS client)
   */
  private async uploadToLivepeer(tusEndpoint: string, inputUrl: string): Promise<void> {
    // In production, implement proper TUS upload using a library like tus-js-client
    // For now, simulate the upload process
    await observability.logEvent('info', 'Content uploaded to Livepeer', {
      tusEndpoint,
      inputUrl
    });
    // Simulate a delay for upload
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  /**
   * Cancel Livepeer asset
   */
  private async cancelLivepeerAsset(assetId: string): Promise<void> {
    try {
      await axios.delete(`${this.livepeerBaseUrl}/asset/${assetId}`, {
        headers: {
          'Authorization': `Bearer ${this.livepeerApiKey}`
        },
      });
      logger.info(`Livepeer asset ${assetId} cancelled.`);
    } catch (error: any) {
      logger.error(`Failed to cancel Livepeer asset ${assetId}:`, error);
      throw error;
    }
  }

  /**
   * Process webhook payload based on type
   */
  private async processWebhookPayload(job: TranscodingJob, payload: LivepeerWebhook): Promise<void> {
    const asset = payload.payload.asset;
    switch (payload.type) {
      case 'asset.ready':
        await this.handleAssetReady(job, asset);
        break;
      case 'asset.failed':
        await this.handleAssetFailed(job, asset);
        break;
      case 'asset.updated':
        await this.handleAssetUpdated(job, asset);
        break;
      default:
        await observability.logEvent('warn', 'Unknown webhook type', {
          jobId: job.jobId,
          webhookType: payload.type
        });
    }
  }

  /**
   * Handle asset ready webhook
   */
  private async handleAssetReady(job: TranscodingJob, asset: any): Promise<void> {
    job.status = 'completed';
    job.completedAt = new Date();
    job.updatedAt = new Date();
    job.manifestUrl = asset.playbackUrl;
    job.thumbnailUrl = asset.staticMp4Url || (asset.playbackUrl ? `${asset.playbackUrl}/thumbnail.jpg` : undefined);

    if (asset.videoSpec) {
      job.inputDuration = asset.videoSpec.duration;
      job.renditions = this.generateRenditions(asset, job.profiles);
    }

    // Assuming db.updateTranscodingJob exists and is correctly implemented
    // await db.updateTranscodingJob(job.jobId, {
    //   status: job.status,
    //   completedAt: job.completedAt,
    //   manifestUrl: job.manifestUrl,
    //   thumbnailUrl: job.thumbnailUrl,
    //   inputDuration: job.inputDuration,
    //   renditions: job.renditions
    // });

    await eventBus.publish({
      type: 'transcoding.job.completed',
      version: '1.0',
      correlationId: `transcode-${job.jobId}`,
      payload: {
        jobId: job.jobId,
        contentId: job.contentId,
        manifestUrl: job.manifestUrl,
        thumbnailUrl: job.thumbnailUrl,
        duration: job.inputDuration,
        renditions: job.renditions
      },
      metadata: {
        source: 'transcoding-service',
        userId: job.creatorId,
        organizationId: job.organizationId,
        contentId: job.contentId
      }
    });

    metrics.counter('transcoding_jobs_completed_total', 1, {
      organizationId: job.organizationId,
      status: 'success'
    });
    observability.logEvent('info', 'Transcoding job completed', {
      jobId: job.jobId,
      contentId: job.contentId,
      manifestUrl: job.manifestUrl
    });
  }

  /**
   * Handle asset failed webhook
   */
  private async handleAssetFailed(job: TranscodingJob, asset: any): Promise<void> {
    job.status = 'failed';
    job.lastError = asset.status.errorMessage || 'Transcoding failed';
    job.updatedAt = new Date();

    // Assuming db.updateTranscodingJob exists and is correctly implemented
    // await db.updateTranscodingJob(job.jobId, {
    //   status: job.status,
    //   lastError: job.lastError
    // });

    await eventBus.publish({
      type: 'transcoding.job.failed',
      version: '1.0',
      correlationId: `transcode-${job.jobId}`,
      payload: {
        jobId: job.jobId,
        contentId: job.contentId,
        error: job.lastError
      },
      metadata: {
        source: 'transcoding-service',
        userId: job.creatorId,
        organizationId: job.organizationId,
        contentId: job.contentId
      }
    });

    metrics.counter('transcoding_jobs_failed_total', 1, {
      organizationId: job.organizationId,
      status: 'failed'
    });
    observability.logEvent('error', 'Transcoding failed', {
      jobId: job.jobId,
      contentId: job.contentId,
      error: job.lastError,
      webhookType: 'asset.failed'
    });
  }

  /**
   * Handle asset updated webhook
   */
  private async handleAssetUpdated(job: TranscodingJob, asset: any): Promise<void> {
    job.updatedAt = new Date();
    // Update job progress or other metadata based on asset updates
    if (asset.videoSpec) {
      job.inputDuration = asset.videoSpec.duration;
      job.renditions = this.generateRenditions(asset, job.profiles);
    }
    logger.info(`Transcoding job ${job.jobId} updated. Asset phase: ${asset.status.phase}`);
    observability.logEvent('info', 'Transcoding job updated', {
      jobId: job.jobId,
      contentId: job.contentId,
      assetPhase: asset.status.phase
    });
  }

  /**
   * Verify webhook signature for security
   */
  private verifyWebhookSignature(payload: LivepeerWebhook, signature: string, secret: string): boolean {
    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  }

  /**
   * Convert internal transcoding profiles to Livepeer format
   */
  private convertToLivepeerProfiles(profiles: TranscodingProfile[]): any[] {
    return profiles.map(profile => ({
      name: profile.name,
      width: profile.width,
      height: profile.height,
      bitrate: profile.bitrate,
      fps: 30 // Default FPS
    }));
  }

  /**
   * Generate rendition URLs and metadata
   */
  private generateRenditions(asset: any, profiles: TranscodingProfile[]): Rendition[] {
    const renditions: Rendition[] = [];
    for (const profile of profiles) {
      renditions.push({
        url: `${asset.playbackUrl}/${profile.name}/index.m3u8`,
        resolution: `${profile.width}x${profile.height}`,
        bitrate: profile.bitrate,
        duration: asset.videoSpec?.duration || 0,
      });
    }
    return renditions;
  }

  /**
   * Get optimal transcoding profiles based on input size
   */
  private getOptimalProfiles(inputSize: number): TranscodingProfile[] {
    // This is a simplified example. In a real scenario, this would be more sophisticated.
    if (inputSize < 100 * 1024 * 1024) { // < 100MB
      return [
        { name: '720p', width: 1280, height: 720, bitrate: 2000000 },
        { name: '480p', width: 854, height: 480, bitrate: 1000000 }
      ];
    } else if (inputSize < 500 * 1024 * 1024) { // < 500MB
      return [
        { name: '1080p', width: 1920, height: 1080, bitrate: 4000000 },
        { name: '720p', width: 1280, height: 720, bitrate: 2000000 },
        { name: '480p', width: 854, height: 480, bitrate: 1000000 }
      ];
    } else {
      return [
        { name: '1080p', width: 1920, height: 1080, bitrate: 4000000 },
        { name: '720p', width: 1280, height: 720, bitrate: 2000000 },
        { name: '480p', width: 854, height: 480, bitrate: 1000000 },
        { name: '360p', width: 640, height: 360, bitrate: 500000 }
      ];
    }
  }

  /**
   * Check rate limits for transcoding requests
   */
  private async checkRateLimits(organizationId: string): Promise<void> {
    const rateLimit = featureFlags.getRateLimit('transcoding_requests');
    if (!rateLimit || !rateLimit.enabled) {
      return;
    }

    // In production: implement proper rate limiting with Redis or a dedicated service
    // For now, check concurrent jobs
    const activeJobs = Array.from(this.jobs.values()).filter(
      job => job.organizationId === organizationId &&
             (job.status === 'pending' || job.status === 'processing')
    );

    if (activeJobs.length >= rateLimit.limit) {
      throw new Error(`Organization ${organizationId} has reached maximum concurrent transcoding jobs (${rateLimit.limit})`);
    }
  }

  /**
   * Start a periodic cleanup of old/completed jobs from memory
   */
  private startJobCleanup(): void {
    this.jobCleanupInterval = setInterval(() => {
      const now = new Date();
      for (const [jobId, job] of this.jobs.entries()) {
        // Remove jobs completed or failed more than 24 hours ago
        if ((job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
            job.updatedAt && (now.getTime() - job.updatedAt.getTime()) > 24 * 3600 * 1000) {
          this.jobs.delete(jobId);
          logger.info(`Cleaned up old transcoding job: ${jobId}`);
        }
      }
    }, 3600000); // Run every hour
  }
}

export default TranscodingService;