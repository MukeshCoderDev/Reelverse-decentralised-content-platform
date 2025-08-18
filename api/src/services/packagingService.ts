/**
 * Content Packaging and Encryption Pipeline
 * Handles CMAF HLS packaging with CENC format and envelope encryption
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from '../core/eventBus';
import { metrics } from '../core/metrics';
import { observability } from '../core/observability';
import { featureFlags } from '../core/featureFlags';

export interface PackagingJob {
  jobId: string;
  contentId: string;
  transcodingJobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  // Input renditions from transcoding
  inputRenditions: TranscodingRendition[];
  
  // Output packages
  packages: ContentPackage[];
  
  // Encryption details
  encryptionKeys: EncryptionKeySet;
  keyRotationSchedule?: KeyRotationSchedule;
  
  // Manifest details
  manifestUrls: Record<string, string>;
  keyServerUrls: Record<string, string>;
  
  // Processing metadata
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  
  // Error handling
  lastError?: string;
  retryCount: number;
  maxRetries: number;
  
  // Organization context
  organizationId: string;
  creatorId: string;
}

export interface TranscodingRendition {
  profile: string;
  url: string;
  width: number;
  height: number;
  bitrate: number;
  codec: string;
  format: string;
}

export interface ContentPackage {
  format: 'hls' | 'dash' | 'cmaf';
  manifestUrl: string;
  segmentUrls: string[];
  encryptionKeyId: string;
  keyUri: string;
  initializationVector: string;
}

export interface EncryptionKeySet {
  contentKeyId: string;
  contentKey: string; // AES-128 key
  keyEncryptionKey: string; // KEK for envelope encryption
  initializationVector: string;
  keyRotationVersion: number;
}

export interface KeyRotationSchedule {
  intervalMs: number;
  nextRotationAt: Date;
  autoRotate: boolean;
}

export interface PackageResult {
  jobId: string;
  manifestUrls: Record<string, string>;
  keyIds: string[];
  segmentCount: number;
  totalDuration: number;
  encryptionKeyId: string;
}

export interface KeyRotationResult {
  oldKeyId: string;
  newKeyId: string;
  manifestsUpdated: string[];
  rotationCompletedAt: Date;
}

export class PackagingService {
  private jobs: Map<string, PackagingJob> = new Map();
  private keyStorage: Map<string, EncryptionKeySet> = new Map();
  private kmsEndpoint: string;
  private keyServerBaseUrl: string;
  
  // Packaging configuration
  private readonly SEGMENT_DURATION = 6; // seconds
  private readonly KEY_ROTATION_INTERVAL = 90 * 24 * 60 * 60 * 1000; // 90 days
  private readonly MANIFEST_VERSION_TTL = 300; // 5 minutes

  constructor() {
    this.kmsEndpoint = process.env.KMS_ENDPOINT || 'https://kms.reelverse.com';
    this.keyServerBaseUrl = process.env.KEY_SERVER_BASE_URL || 'https://keys.reelverse.com';
    
    this.startKeyRotationScheduler();
    this.startJobCleanup();
  }

  /**
   * Package transcoded content with encryption
   */
  async packageContent(
    contentId: string,
    transcodingJobId: string,
    renditions: TranscodingRendition[],
    organizationId: string,
    creatorId: string
  ): Promise<string> {
    const timerId = metrics.startTimer('content_packaging', {
      organizationId,
      contentId: contentId.substr(0, 8),
      renditionCount: renditions.length.toString()
    });

    try {
      // Validate inputs
      if (!contentId || !renditions.length) {
        throw new Error('Content ID and renditions are required');
      }

      // Generate job ID
      const jobId = `package_${Date.now()}_${uuidv4()}`;

      // Generate encryption keys using envelope encryption
      const encryptionKeys = await this.generateEncryptionKeys(contentId);

      // Create packaging job
      const job: PackagingJob = {
        jobId,
        contentId,
        transcodingJobId,
        status: 'pending',
        inputRenditions: renditions,
        packages: [],
        encryptionKeys,
        manifestUrls: {},
        keyServerUrls: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        organizationId,
        creatorId
      };

      // Store job
      this.jobs.set(jobId, job);

      // Start packaging process
      await this.processPackagingJob(job);

      metrics.endTimer(timerId, true);
      metrics.counter('packaging_jobs_created_total', 1, {
        organizationId,
        renditionCount: renditions.length.toString()
      });

      await observability.logEvent('info', 'Content packaging initiated', {
        jobId,
        contentId,
        transcodingJobId,
        renditionCount: renditions.length,
        organizationId
      });

      return jobId;

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Generate manifests for packaged content
   */
  async generateManifests(
    contentId: string,
    format: 'hls' | 'dash' | 'cmaf'
  ): Promise<string[]> {
    const job = this.findJobByContentId(contentId);
    if (!job) {
      throw new Error(`No packaging job found for content ${contentId}`);
    }

    if (job.status !== 'completed') {
      throw new Error(`Packaging job ${job.jobId} is not completed`);
    }

    const manifestUrls: string[] = [];

    switch (format) {
      case 'hls':
        manifestUrls.push(...await this.generateHLSManifests(job));
        break;
      case 'dash':
        manifestUrls.push(...await this.generateDASHManifests(job));
        break;
      case 'cmaf':
        manifestUrls.push(...await this.generateCMAFManifests(job));
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    return manifestUrls;
  }

  /**
   * Rotate encryption keys atomically
   */
  async rotateKeys(contentId: string): Promise<KeyRotationResult> {
    const timerId = metrics.startTimer('key_rotation', {
      contentId: contentId.substr(0, 8)
    });

    try {
      const job = this.findJobByContentId(contentId);
      if (!job) {
        throw new Error(`No packaging job found for content ${contentId}`);
      }

      const oldKeyId = job.encryptionKeys.contentKeyId;
      
      // Generate new encryption keys
      const newKeys = await this.generateEncryptionKeys(contentId);
      
      // Update job with new keys
      job.encryptionKeys = newKeys;
      job.encryptionKeys.keyRotationVersion++;
      job.updatedAt = new Date();

      // Regenerate manifests with new keys
      const manifestsUpdated = await this.regenerateManifestsWithNewKeys(job);

      // Purge CDN cache for old manifests
      await this.purgeCDNCache(manifestsUpdated);

      const result: KeyRotationResult = {
        oldKeyId,
        newKeyId: newKeys.contentKeyId,
        manifestsUpdated,
        rotationCompletedAt: new Date()
      };

      // Emit key rotation event
      await eventBus.publish({
        type: 'key.rotated',
        version: '1.0',
        correlationId: `key-rotation-${contentId}`,
        payload: {
          contentId,
          oldKeyId,
          newKeyId: newKeys.contentKeyId,
          rotationType: 'scheduled'
        },
        metadata: {
          source: 'packaging-service',
          contentId,
          organizationId: job.organizationId
        }
      });

      metrics.endTimer(timerId, true);
      metrics.counter('key_rotations_completed_total', 1, {
        contentId: contentId.substr(0, 8),
        rotationType: 'scheduled'
      });

      await observability.logEvent('info', 'Key rotation completed', {
        contentId,
        oldKeyId,
        newKeyId: newKeys.contentKeyId,
        manifestsUpdated: manifestsUpdated.length
      });

      return result;

    } catch (error) {
      metrics.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get packaging job status
   */
  getJobStatus(jobId: string): PackagingJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Process packaging job
   */
  private async processPackagingJob(job: PackagingJob): Promise<void> {
    try {
      job.status = 'processing';
      job.updatedAt = new Date();

      // Package content for each format
      const formats: Array<'hls' | 'dash' | 'cmaf'> = ['hls', 'cmaf']; // Start with HLS and CMAF
      
      for (const format of formats) {
        const packageResult = await this.packageForFormat(job, format);
        job.packages.push(packageResult);
      }

      // Generate key server URLs
      job.keyServerUrls = this.generateKeyServerUrls(job);

      // Generate manifest URLs
      job.manifestUrls = await this.generateManifestUrls(job);

      job.status = 'completed';
      job.completedAt = new Date();
      job.updatedAt = new Date();

      // Emit packaging completed event
      await eventBus.publish({
        type: 'package.completed',
        version: '1.0',
        correlationId: `package-${job.jobId}`,
        payload: {
          jobId: job.jobId,
          contentId: job.contentId,
          transcodingJobId: job.transcodingJobId,
          manifestUrls: job.manifestUrls,
          keyIds: [job.encryptionKeys.contentKeyId],
          segmentCount: this.calculateTotalSegments(job),
          organizationId: job.organizationId,
          creatorId: job.creatorId
        },
        metadata: {
          source: 'packaging-service',
          userId: job.creatorId,
          organizationId: job.organizationId,
          contentId: job.contentId
        }
      });

      await observability.logEvent('info', 'Content packaging completed', {
        jobId: job.jobId,
        contentId: job.contentId,
        packageCount: job.packages.length,
        manifestCount: Object.keys(job.manifestUrls).length
      });

    } catch (error) {
      job.status = 'failed';
      job.lastError = error instanceof Error ? error.message : 'Unknown error';
      job.updatedAt = new Date();

      await observability.logEvent('error', 'Content packaging failed', {
        jobId: job.jobId,
        contentId: job.contentId,
        error: job.lastError
      });

      throw error;
    }
  }

  /**
   * Generate encryption keys using envelope encryption
   */
  private async generateEncryptionKeys(contentId: string): Promise<EncryptionKeySet> {
    try {
      // Generate content encryption key (CEK) - AES-128
      const contentKey = crypto.randomBytes(16); // 128-bit key
      const contentKeyId = `cek_${contentId}_${Date.now()}_${uuidv4()}`;
      
      // Generate initialization vector
      const iv = crypto.randomBytes(16);
      
      // Generate key encryption key (KEK) or retrieve from KMS
      const kek = await this.getOrCreateKEK(contentId);
      
      // Encrypt the content key with KEK (envelope encryption)
      const cipher = crypto.createCipher('aes-256-gcm', kek);
      const encryptedContentKey = Buffer.concat([
        cipher.update(contentKey),
        cipher.final()
      ]);

      const keySet: EncryptionKeySet = {
        contentKeyId,
        contentKey: contentKey.toString('hex'),
        keyEncryptionKey: encryptedContentKey.toString('hex'),
        initializationVector: iv.toString('hex'),
        keyRotationVersion: 1
      };

      // Store keys securely
      this.keyStorage.set(contentKeyId, keySet);

      await observability.logEvent('info', 'Encryption keys generated', {
        contentId,
        contentKeyId,
        keyRotationVersion: keySet.keyRotationVersion
      });

      return keySet;

    } catch (error) {
      await observability.logEvent('error', 'Failed to generate encryption keys', {
        contentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get or create Key Encryption Key from KMS
   */
  private async getOrCreateKEK(contentId: string): Promise<string> {
    // In production, this would integrate with AWS KMS, Azure Key Vault, etc.
    // For now, generate a deterministic KEK based on content ID
    const kekSeed = `${process.env.KEK_SEED || 'default-seed'}-${contentId}`;
    return crypto.createHash('sha256').update(kekSeed).digest('hex');
  }

  /**
   * Package content for specific format
   */
  private async packageForFormat(job: PackagingJob, format: 'hls' | 'dash' | 'cmaf'): Promise<ContentPackage> {
    const keyUri = `${this.keyServerBaseUrl}/keys/${job.encryptionKeys.contentKeyId}`;
    
    // Generate segments for each rendition
    const segmentUrls: string[] = [];
    
    for (const rendition of job.inputRenditions) {
      const renditionSegments = await this.generateEncryptedSegments(
        rendition,
        job.encryptionKeys,
        format
      );
      segmentUrls.push(...renditionSegments);
    }

    const manifestUrl = `${process.env.CDN_BASE_URL}/manifests/${job.contentId}/${format}/master.m3u8`;

    return {
      format,
      manifestUrl,
      segmentUrls,
      encryptionKeyId: job.encryptionKeys.contentKeyId,
      keyUri,
      initializationVector: job.encryptionKeys.initializationVector
    };
  }

  /**
   * Generate encrypted segments for rendition
   */
  private async generateEncryptedSegments(
    rendition: TranscodingRendition,
    keys: EncryptionKeySet,
    format: string
  ): Promise<string[]> {
    // In production, this would:
    // 1. Download the rendition from Livepeer
    // 2. Segment the video using ffmpeg
    // 3. Encrypt each segment with AES-128-CBC
    // 4. Upload encrypted segments to CDN
    // 5. Return segment URLs

    // For now, generate mock segment URLs
    const segmentCount = Math.ceil(120 / this.SEGMENT_DURATION); // Assume 2-minute video
    const segments: string[] = [];

    for (let i = 0; i < segmentCount; i++) {
      const segmentUrl = `${process.env.CDN_BASE_URL}/segments/${rendition.profile}/${keys.contentKeyId}/segment_${i}.ts`;
      segments.push(segmentUrl);
    }

    return segments;
  }

  /**
   * Generate HLS manifests
   */
  private async generateHLSManifests(job: PackagingJob): Promise<string[]> {
    const manifests: string[] = [];
    
    // Master playlist
    const masterPlaylist = this.generateHLSMasterPlaylist(job);
    const masterUrl = await this.uploadManifest(job.contentId, 'hls', 'master.m3u8', masterPlaylist);
    manifests.push(masterUrl);

    // Media playlists for each rendition
    for (const rendition of job.inputRenditions) {
      const mediaPlaylist = this.generateHLSMediaPlaylist(job, rendition);
      const mediaUrl = await this.uploadManifest(
        job.contentId,
        'hls',
        `${rendition.profile}.m3u8`,
        mediaPlaylist
      );
      manifests.push(mediaUrl);
    }

    return manifests;
  }

  /**
   * Generate HLS master playlist
   */
  private generateHLSMasterPlaylist(job: PackagingJob): string {
    let playlist = '#EXTM3U\n#EXT-X-VERSION:6\n\n';

    for (const rendition of job.inputRenditions) {
      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bitrate},RESOLUTION=${rendition.width}x${rendition.height},CODECS="avc1.42e01e"\n`;
      playlist += `${rendition.profile}.m3u8\n\n`;
    }

    return playlist;
  }

  /**
   * Generate HLS media playlist with encryption
   */
  private generateHLSMediaPlaylist(job: PackagingJob, rendition: TranscodingRendition): string {
    const keyUri = `${this.keyServerBaseUrl}/keys/${job.encryptionKeys.contentKeyId}`;
    const segmentCount = Math.ceil(120 / this.SEGMENT_DURATION);
    
    let playlist = '#EXTM3U\n';
    playlist += '#EXT-X-VERSION:6\n';
    playlist += '#EXT-X-TARGETDURATION:6\n';
    playlist += '#EXT-X-PLAYLIST-TYPE:VOD\n';
    playlist += `#EXT-X-KEY:METHOD=AES-128,URI="${keyUri}",IV=0x${job.encryptionKeys.initializationVector}\n\n`;

    for (let i = 0; i < segmentCount; i++) {
      playlist += `#EXTINF:${this.SEGMENT_DURATION}.0,\n`;
      playlist += `segment_${i}.ts\n`;
    }

    playlist += '#EXT-X-ENDLIST\n';
    return playlist;
  }

  /**
   * Generate DASH manifests
   */
  private async generateDASHManifests(job: PackagingJob): Promise<string[]> {
    // DASH MPD generation would go here
    // For now, return empty array
    return [];
  }

  /**
   * Generate CMAF manifests
   */
  private async generateCMAFManifests(job: PackagingJob): Promise<string[]> {
    // CMAF manifest generation would go here
    // Similar to HLS but with fMP4 segments
    return [];
  }

  /**
   * Upload manifest to CDN
   */
  private async uploadManifest(contentId: string, format: string, filename: string, content: string): Promise<string> {
    // In production, upload to CDN storage
    const manifestUrl = `${process.env.CDN_BASE_URL}/manifests/${contentId}/${format}/${filename}`;
    
    await observability.logEvent('debug', 'Manifest uploaded', {
      contentId,
      format,
      filename,
      manifestUrl,
      size: content.length
    });

    return manifestUrl;
  }

  /**
   * Generate key server URLs
   */
  private generateKeyServerUrls(job: PackagingJob): Record<string, string> {
    return {
      primary: `${this.keyServerBaseUrl}/keys/${job.encryptionKeys.contentKeyId}`,
      backup: `${this.keyServerBaseUrl}/keys/${job.encryptionKeys.contentKeyId}?backup=true`
    };
  }

  /**
   * Generate manifest URLs
   */
  private async generateManifestUrls(job: PackagingJob): Promise<Record<string, string>> {
    const urls: Record<string, string> = {};
    
    for (const pkg of job.packages) {
      urls[pkg.format] = pkg.manifestUrl;
    }

    return urls;
  }

  /**
   * Regenerate manifests with new keys
   */
  private async regenerateManifestsWithNewKeys(job: PackagingJob): Promise<string[]> {
    const updatedManifests: string[] = [];

    // Regenerate all manifests with new key references
    for (const pkg of job.packages) {
      const newManifests = await this.generateManifests(job.contentId, pkg.format);
      updatedManifests.push(...newManifests);
    }

    return updatedManifests;
  }

  /**
   * Purge CDN cache
   */
  private async purgeCDNCache(manifestUrls: string[]): Promise<void> {
    // In production, integrate with CDN purge API
    await observability.logEvent('info', 'CDN cache purged', {
      manifestCount: manifestUrls.length,
      manifestUrls
    });
  }

  /**
   * Calculate total segments across all packages
   */
  private calculateTotalSegments(job: PackagingJob): number {
    return job.packages.reduce((total, pkg) => total + pkg.segmentUrls.length, 0);
  }

  /**
   * Find job by content ID
   */
  private findJobByContentId(contentId: string): PackagingJob | null {
    for (const job of this.jobs.values()) {
      if (job.contentId === contentId) {
        return job;
      }
    }
    return null;
  }

  /**
   * Start key rotation scheduler
   */
  private startKeyRotationScheduler(): void {
    // Check for keys that need rotation every hour
    setInterval(async () => {
      if (!featureFlags.isEnabled('auto_key_rotation')) {
        return;
      }

      const now = new Date();
      
      for (const job of this.jobs.values()) {
        if (job.status === 'completed' && job.keyRotationSchedule?.autoRotate) {
          if (job.keyRotationSchedule.nextRotationAt <= now) {
            try {
              await this.rotateKeys(job.contentId);
              
              // Schedule next rotation
              job.keyRotationSchedule.nextRotationAt = new Date(
                now.getTime() + job.keyRotationSchedule.intervalMs
              );
            } catch (error) {
              await observability.logEvent('error', 'Scheduled key rotation failed', {
                contentId: job.contentId,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
        }
      }
    }, 3600000); // Every hour
  }

  /**
   * Start job cleanup
   */
  private startJobCleanup(): void {
    // Clean up completed jobs older than 7 days
    setInterval(() => {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const jobsToDelete: string[] = [];

      for (const [jobId, job] of this.jobs.entries()) {
        if (job.status === 'completed' && job.completedAt && job.completedAt < cutoff) {
          jobsToDelete.push(jobId);
        }
      }

      for (const jobId of jobsToDelete) {
        this.jobs.delete(jobId);
      }

      if (jobsToDelete.length > 0) {
        observability.logEvent('info', `Cleaned up ${jobsToDelete.length} old packaging jobs`);
      }
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }
}

// Global packaging service instance
export const packagingService = new PackagingService();