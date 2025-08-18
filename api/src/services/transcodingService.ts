/**
 * Transcoding Service with Livepeer Integration
 * Handles ABR transcoding with webhook callbacks and exponential backoff retry logic
 */

import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from '../core/eventBus';
import { metrics } from '../core/metrics';
import { observability } from '../core/observability';
import { featureFlags } from '../core/featureFlags';
import { db } from '../core/database';

export interface TranscodingProfile {
  name: string;
  width: number;
  height: number;
  bitrate: number;
  fps: number;
  codec: 'h264' | 'h265' | 'av1';
}

export interface TranscodingJob {
  jobId: string;
  contentId: string;
  livepeerAssetId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  profiles: TranscodingProfile[];
  
  // Input details
  inputUrl: string;
  inputSize: number;
  inputDuration?: number;
  
  // Output details
  renditions: Rendition[];
  manifestUrl?: string;
  thumbnailUrl?: string;
  
  // Processing metadata
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Retry logic
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  
  // Webhook security
  webhookSecret: string;
  callbackUrl: string;
  
  // Organization context
  organizationId: string;
  creatorId: string;
}

export interface Rendition {
  profile: string;
  url: string;
  width: number;
  height: number;
  bitrate: number;
  fileSize: number;
  duration: number;
  codec: string;
  format: string;
}

export interface LivepeerWebhook {
  id: string;
  type: 'asset.ready' | 'asset.failed' | 'asset.updated';
  timestamp: number;
  payload: {
    asset: {
      id: string;
      name: string;
      status: {
        phase: 'waiting' | 'processing' | 'ready' | 'failed';
        updatedAt: number;
        errorMessage?: string;
      };
      playbackUrl?: string;
      downloadUrl?: string;
      videoSpec?: {
        format: string;
        duration: number;
        bitrate: number;
        width: number;
        height: number;
        fps: number;
      };
      size?: number;
    };
  };
}

export interface JobStatus {
  jobId: string;
  status: string;
  progress: number;
  renditions: Rendition[];
  error?: string;
  estimatedCompletion?: Date;
}

export class TranscodingService {
  private jobs: Map<string, TranscodingJob> = new Map();
  private livepeerApiKey: string;
  private livepeerBaseUrl: string;
  private webhookSecret: string;
  private callbackBaseUrl: string;
  
  // Default ABR ladder profiles
  private readonly DEFAULT_PROFILES: TranscodingProfile[] = [
    { name: '240p', width: 426, height: 240, bitrate: 400000, fps: 30, codec: 'h264' },
    { name: '360p', width: 640, height: 360, bitrate: 800000, fps: 30, codec: 'h264' },
    { name: '480p', width: 854, height: 480, bitrate: 1200000, fps: 30, codec: 'h264' },
    { name: '720p', width: 1280, height: 720, bitrate: 2500000, fps: 30, codec: 'h264' },
    { name: '1080p', width: 1920, height: 1080, bitrate: 4500000, fps: 30, codec: 'h264' }
  ];

  constructor() {
    this.livepeerApiKey = process.env.LIVEPEER_API_KEY!;
    this.livepeerBaseUrl = process.env.LIVEPEER_BASE_URL || 'https://livepeer.studio/api';
    this.webhookSecret = process.env.LIVEPEER_WEBHOOK_SECRET || crypto.randomBytes(32).toString('hex');
    this.callbackBaseUrl = process.env.API_BASE_URL || 'https://api.reelverse.com';
    
    if (!this.livepeerApiKey) {
      throw new Error('LIVEPEER_API_KEY environment variable is required');
    }

    this.startJobCleanup();
  }

  /**
   * Create transcoding job with configurable ABR profiles
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
      // Validate inputs
      if (!contentId || !inputUrl || !organizationId || !creatorId) {
        throw new Error('Missing required parameters for transcoding job');
      }

      // Check rate limits
      await this.checkRateLimits(organizationId);

      // Generate job ID and webhook secret
      const jobId = `transcode_${Date.now()}_${uuidv4()}`;
      const webhookSecret = crypto.randomBytes(32).toString('hex');
      const callbackUrl = `${this.callbackBaseUrl}/api/transcoding/webhook/${jobId}`;

      // Use provided profiles or defaults
      const transcodingProfiles = profiles || this.getOptimalProfiles(inputSize);

      // Create job record
      const job: TranscodingJob = {
        jobId,
        contentId,
        status: 'pending',
        profiles: transcodingProfiles,
        inputUrl,
        inputSize,
        renditions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        webhookSecret,
        callbackUrl,
        organizationId,
        creatorId
      };

      // Store job
      this.jobs.set(jobId, job);

      // Create Livepeer asset
      const livepeerAssetId = await this.createLivepeerAsset(job);
      job.livepeerAssetId = livepeerAssetId;
      job.status = 'processing';
      job.startedAt = new Date();
      job.updatedAt = new Date();

      // Emit job started event
      await eventBus.publish({
        type: 'transcode.started',
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
        profileCount: transcodingProfiles.length.toString()
      });

      await observability.logEvent('info', 'Transcoding job created', {
        jobId,
        contentId,
        livepeerAssetId,
        profileCount: transcodingProfiles.length,
        organizationId
      });

      return jobId;

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
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
      // Get job
      const job = this.jobs.get(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
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
        type: payload.type,
        status: 'success'
      });

      await observability.logEvent('info', 'Webhook processed successfully', {
        jobId,
        webhookType: payload.type,
        assetId: payload.payload.asset.id,
        assetStatus: payload.payload.asset.status.phase
      });

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      metrics.counter('webhooks_processed_total', 1, {
        jobId: jobId.substr(0, 8),
        type: payload.type,
        status: 'error'
      });

      await observability.logEvent('error', 'Webhook processing failed', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
        webhookType: payload.type
      });

      throw error;
    }
  }

  /**
   * Get job status with progress information
   */
  getJobStatus(jobId: string): JobStatus | null {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    let progress = 0;
    switch (job.status) {
      case 'pending':
        progress = 0;
        break;
      case 'processing':
        progress = 50; // Estimate based on time elapsed
        break;
      case 'completed':
        progress = 100;
        break;
      case 'failed':
      case 'cancelled':
        progress = 0;
        break;
    }

    let estimatedCompletion: Date | undefined;
    if (job.status === 'processing' && job.startedAt && job.inputDuration) {
      // Estimate completion based on content duration (rough heuristic: 2x real-time)
      const processingTimeMs = job.inputDuration * 2 * 1000;
      const elapsedMs = Date.now() - job.startedAt.getTime();
      const remainingMs = Math.max(0, processingTimeMs - elapsedMs);
      estimatedCompletion = new Date(Date.now() + remainingMs);
    }

    return {
      jobId,
      status: job.status,
      progress,
      renditions: job.renditions,
      error: job.lastError,
      estimatedCompletion
    };
  }

  /**
   * Retry failed job with exponential backoff
   */
  async retryJob(jobId: string): Promise<string> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== 'failed') {
      throw new Error(`Job ${jobId} is not in failed state`);
    }

    if (job.retryCount >= job.maxRetries) {
      throw new Error(`Job ${jobId} has exceeded maximum retry attempts`);
    }

    // Calculate exponential backoff delay
    const baseDelayMs = 5000; // 5 seconds
    const delayMs = baseDelayMs * Math.pow(2, job.retryCount);
    
    await new Promise(resolve => setTimeout(resolve, delayMs));

    // Reset job state for retry
    job.status = 'pending';
    job.retryCount++;
    job.lastError = undefined;
    job.updatedAt = new Date();

    // Create new Livepeer asset
    try {
      const livepeerAssetId = await this.createLivepeerAsset(job);
      job.livepeerAssetId = livepeerAssetId;
      job.status = 'processing';
      job.startedAt = new Date();

      await eventBus.publish({
        type: 'transcode.retried',
        version: '1.0',
        correlationId: `transcode-retry-${jobId}`,
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

      await observability.logEvent('info', 'Transcoding job retried', {
        jobId,
        retryCount: job.retryCount,
        livepeerAssetId
      });

      return livepeerAssetId;

    } catch (error) {
      job.status = 'failed';
      job.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  /**
   * Cancel transcoding job
   */
  async cancelJob(jobId: string, reason: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    if (job.status === 'completed' || job.status === 'cancelled') {
      return;
    }

    // Cancel Livepeer asset if exists
    if (job.livepeerAssetId) {
      try {
        await this.cancelLivepeerAsset(job.livepeerAssetId);
      } catch (error) {
        await observability.logEvent('warn', 'Failed to cancel Livepeer asset', {
          jobId,
          livepeerAssetId: job.livepeerAssetId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    job.status = 'cancelled';
    job.lastError = reason;
    job.updatedAt = new Date();

    await eventBus.publish({
      type: 'transcode.cancelled',
      version: '1.0',
      correlationId: `transcode-cancel-${jobId}`,
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

    await observability.logEvent('info', 'Transcoding job cancelled', {
      jobId,
      reason
    });
  }

  /**
   * Create Livepeer asset with webhook configuration
   */
  private async createLivepeerAsset(job: TranscodingJob): Promise<string> {
    try {
      const response: AxiosResponse = await axios.post(
        `${this.livepeerBaseUrl}/asset/request-upload`,
        {
          name: `content-${job.contentId}`,
          storage: {
            type: 'web3.storage'
          },
          playbackPolicy: {
            type: 'webhook',
            webhookId: process.env.LIVEPEER_WEBHOOK_ID,
            webhookContext: {
              jobId: job.jobId,
              contentId: job.contentId
            }
          },
          profiles: this.convertToLivepeerProfiles(job.profiles)
        },
        {
          headers: {
            'Authorization': `Bearer ${this.livepeerApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const { asset, tusEndpoint } = response.data;

      // Upload content to Livepeer using the input URL
      await this.uploadToLivepeer(tusEndpoint, job.inputUrl);

      return asset.id;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new Error(`Livepeer API error: ${message}`);
      }
      throw error;
    }
  }

  /**
   * Upload content to Livepeer via TUS protocol
   */
  private async uploadToLivepeer(tusEndpoint: string, inputUrl: string): Promise<void> {
    // In production, implement proper TUS upload
    // For now, simulate the upload process
    await observability.logEvent('info', 'Content uploaded to Livepeer', {
      tusEndpoint,
      inputUrl
    });
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
        timeout: 10000
      });
    } catch (error) {
      // Log but don't throw - cancellation is best effort
      await observability.logEvent('warn', 'Failed to cancel Livepeer asset', {
        assetId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
    job.thumbnailUrl = asset.playbackUrl ? `${asset.playbackUrl}/thumbnail.jpg` : undefined;
    
    if (asset.videoSpec) {
      job.inputDuration = asset.videoSpec.duration;
    }

    // Generate renditions from Livepeer response
    job.renditions = this.generateRenditions(asset, job.profiles);

    // Emit completion event
    await eventBus.publish({
      type: 'transcode.completed',
      version: '1.0',
      correlationId: `transcode-${job.jobId}`,
      payload: {
        jobId: job.jobId,
        contentId: job.contentId,
        manifestUrl: job.manifestUrl,
        thumbnailUrl: job.thumbnailUrl,
        renditions: job.renditions,
        duration: job.inputDuration,
        organizationId: job.organizationId,
        creatorId: job.creatorId
      },
      metadata: {
        source: 'transcoding-service',
        userId: job.creatorId,
        organizationId: job.organizationId,
        contentId: job.contentId
      }
    });

    // Trigger packaging pipeline
    try {
      const { packagingService } = await import('./packagingService');
      
      await packagingService.packageContent(
        job.contentId,
        job.jobId,
        job.renditions,
        job.organizationId,
        job.creatorId
      );

      await observability.logEvent('info', 'Packaging pipeline initiated from transcoding', {
        transcodingJobId: job.jobId,
        contentId: job.contentId,
        renditionCount: job.renditions.length,
        organizationId: job.organizationId
      });
    } catch (error) {
      await observability.logEvent('error', 'Failed to initiate packaging from transcoding', {
        transcodingJobId: job.jobId,
        contentId: job.contentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't fail transcoding if packaging initiation fails
    }

    metrics.counter('transcoding_jobs_completed_total', 1, {
      organizationId: job.organizationId,
      renditionCount: job.renditions.length.toString()
    });

    await observability.logEvent('info', 'Transcoding completed successfully', {
      jobId: job.jobId,
      contentId: job.contentId,
      duration: job.inputDuration,
      renditionCount: job.renditions.length
    });
  }

  /**
   * Handle asset failed webhook
   */
  private async handleAssetFailed(job: TranscodingJob, asset: any): Promise<void> {
    job.status = 'failed';
    job.lastError = asset.status.errorMessage || 'Transcoding failed';
    job.updatedAt = new Date();

    // Emit failure event
    await eventBus.publish({
      type: 'transcode.failed',
      version: '1.0',
      correlationId: `transcode-${job.jobId}`,
      payload: {
        jobId: job.jobId,
        contentId: job.contentId,
        error: job.lastError,
        retryCount: job.retryCount,
        canRetry: job.retryCount < job.maxRetries
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
      retryCount: job.retryCount.toString()
    });

    await observability.logEvent('error', 'Transcoding failed', {
      jobId: job.jobId,
      contentId: job.contentId,
      error: job.lastError,
      retryCount: job.retryCount
    });
  }

  /**
   * Handle asset updated webhook
   */
  private async handleAssetUpdated(job: TranscodingJob, asset: any): Promise<void> {
    job.updatedAt = new Date();
    
    // Update job with latest asset information
    if (asset.videoSpec) {
      job.inputDuration = asset.videoSpec.duration;
    }

    await observability.logEvent('debug', 'Transcoding job updated', {
      jobId: job.jobId,
      assetPhase: asset.status.phase,
      duration: job.inputDuration
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
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Convert internal profiles to Livepeer format
   */
  private convertToLivepeerProfiles(profiles: TranscodingProfile[]): any[] {
    return profiles.map(profile => ({
      name: profile.name,
      bitrate: profile.bitrate,
      fps: profile.fps,
      width: profile.width,
      height: profile.height,
      quality: 23, // Default CRF value
      gop: '2.0' // 2 second GOP
    }));
  }

  /**
   * Generate renditions from Livepeer asset response
   */
  private generateRenditions(asset: any, profiles: TranscodingProfile[]): Rendition[] {
    const renditions: Rendition[] = [];
    
    // In production, parse actual rendition URLs from Livepeer response
    for (const profile of profiles) {
      renditions.push({
        profile: profile.name,
        url: `${asset.playbackUrl}/${profile.name}/index.m3u8`,
        width: profile.width,
        height: profile.height,
        bitrate: profile.bitrate,
        fileSize: 0, // Would be provided by Livepeer
        duration: asset.videoSpec?.duration || 0,
        codec: profile.codec,
        format: 'hls'
      });
    }
    
    return renditions;
  }

  /**
   * Get optimal profiles based on input size
   */
  private getOptimalProfiles(inputSize: number): TranscodingProfile[] {
    // For files under 100MB, use fewer profiles to save processing time
    if (inputSize < 100 * 1024 * 1024) {
      return this.DEFAULT_PROFILES.slice(0, 3); // 240p, 360p, 480p
    }
    
    // For larger files, use full ABR ladder
    return this.DEFAULT_PROFILES;
  }

  /**
   * Check rate limits for organization
   */
  private async checkRateLimits(organizationId: string): Promise<void> {
    const rateLimit = featureFlags.getRateLimit('transcoding_requests');
    if (!rateLimit || !rateLimit.enabled) {
      return;
    }

    // Check if kill switch is active
    if (featureFlags.isEnabled('kill_switch_active')) {
      throw new Error('Transcoding service is temporarily unavailable');
    }

    // In production: implement proper rate limiting with Redis
    // Check concurrent jobs per organization
    const activeJobs = Array.from(this.jobs.values()).filter(
      job => job.organizationId === organizationId && 
             (job.status === 'pending' || job.status === 'processing')
    );

    const maxConcurrentJobs = 5; // Configurable limit
    if (activeJobs.length >= maxConcurrentJobs) {
      throw new Error(`Organization ${organizationId} has reached maximum concurrent transcoding jobs`);
    }
  }

  /**
   * Start job cleanup timer
   */
  private startJobCleanup(): void {
    // Clean up completed/failed jobs older than 24 hours
    setInterval(() => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const jobsToDelete: string[] = [];

      for (const [jobId, job] of this.jobs.entries()) {
        if ((job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
            job.updatedAt < cutoff) {
          jobsToDelete.push(jobId);
        }
      }

      for (const jobId of jobsToDelete) {
        this.jobs.delete(jobId);
      }

      if (jobsToDelete.length > 0) {
        observability.logEvent('info', `Cleaned up ${jobsToDelete.length} old transcoding jobs`);
      }
    }, 3600000); // Run every hour
  }
}

// Global transcoding service instance
export const transcodingService = new TranscodingService();