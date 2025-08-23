import Queue from 'bull';
import { logger } from '../../utils/logger';
import { getUploadSessionService, UploadSessionService } from '../uploads/uploadSessionService';
import { getStorageService, ResumableStorageService } from '../storage/resumableStorageService';
import { getIPFSService, IPFSService } from '../ipfs/ipfsService';
import { NFTStorage } from 'nft.storage';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

export interface TranscodeAndPinJobData {
  uploadId: string;
  storageKey: string;
  userId: string;
  metadata: {
    title?: string;
    description?: string;
    filename: string;
    mimeType: string;
    totalBytes: number;
  };
}

export interface TranscodingProfile {
  name: string;
  width: number;
  height: number;
  bitrate: string;
  fps?: number;
}

const TRANSCODING_PROFILES: TranscodingProfile[] = [
  { name: '240p', width: 426, height: 240, bitrate: '400k', fps: 30 },
  { name: '360p', width: 640, height: 360, bitrate: '800k', fps: 30 },
  { name: '720p', width: 1280, height: 720, bitrate: '2M', fps: 30 },
  { name: '1080p', width: 1920, height: 1080, bitrate: '5M', fps: 30 },
  { name: '4K', width: 3840, height: 2160, bitrate: '15M', fps: 30 },
];

/**
 * Background Job Service for Transcode and Pin
 * 
 * Handles video transcoding to HLS format and IPFS pinning
 * after resumable upload completion.
 */
export class TranscodeAndPinJobService {
  private queue: Queue.Queue<TranscodeAndPinJobData>;
  private uploadService: UploadSessionService;
  private storageService: ResumableStorageService;
  private ipfsService: IPFSService;

  constructor() {
    // Initialize Bull queue
    this.queue = new Queue<TranscodeAndPinJobData>('transcode-and-pin', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
      },
      defaultJobOptions: {
        removeOnComplete: 10, // Keep 10 completed jobs
        removeOnFail: 20, // Keep 20 failed jobs for debugging
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay
        },
      },
    });

    this.uploadService = getUploadSessionService();
    this.storageService = getStorageService();
    this.ipfsService = getIPFSService();

    this.setupJobProcessors();
    this.setupEventHandlers();
  }

  /**
   * Add a new transcode and pin job to the queue
   */
  async enqueueJob(data: TranscodeAndPinJobData): Promise<void> {
    try {
      const job = await this.queue.add('transcode-and-pin', data, {
        priority: 1, // Normal priority
        delay: 1000, // 1 second delay to ensure upload completion
      });

      logger.info('Enqueued transcode and pin job', {
        jobId: job.id,
        uploadId: data.uploadId,
        userId: data.userId,
      });

      // Update session status to processing
      await this.uploadService.updateSessionStatus(data.uploadId, 'processing');

    } catch (error) {
      logger.error('Failed to enqueue transcode and pin job', {
        uploadId: data.uploadId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Setup job processors
   */
  private setupJobProcessors(): void {
    this.queue.process('transcode-and-pin', 2, async (job) => {
      const { uploadId, storageKey, userId, metadata } = job.data;

      logger.info('Starting transcode and pin job', {
        jobId: job.id,
        uploadId,
        userId,
        storageKey,
      });

      try {
        // Step 1: Download file from storage to temp location
        const tempFilePath = await this.downloadFileToTemp(storageKey, metadata.filename);
        
        // Step 2: Probe video metadata
        const videoInfo = await this.probeVideoFile(tempFilePath);
        
        // Step 3: Start transcoding process
        await this.uploadService.updateSessionStatus(uploadId, 'processing');
        
        // Step 4: Transcode to HLS formats
        const transcodingResults = await this.transcodeToHLS(tempFilePath, uploadId, videoInfo);
        
        // Step 5: Generate thumbnails
        const thumbnails = await this.generateThumbnails(tempFilePath, uploadId);
        
        // Step 6: First rendition ready - update to playable
        await this.uploadService.updateSessionStatus(uploadId, 'playable');
        
        // Step 7: Pin original file to IPFS
        let pinResult: any = null;
        try {
          pinResult = await this.ipfsService.pinFileFromStorage(storageKey, metadata.filename, {
            verifyHash: process.env.NFT_STORAGE_VERIFY_HASH === 'true',
            timeout: 10 * 60 * 1000, // 10 minutes timeout
            retryAttempts: 3,
          });
          
          if (pinResult.pinStatus === 'pinned') {
            // Update session with IPFS data
            await this.uploadService.updateSessionIPFS(uploadId, {
              cid: pinResult.cid,
              pinStatus: 'pinned',
              playbackUrl: transcodingResults.playlistUrl,
            });
            
            logger.info('Successfully pinned to IPFS', {
              uploadId,
              cid: pinResult.cid,
              size: pinResult.size,
            });
          } else {
            logger.warn('IPFS pinning failed', {
              uploadId,
              pinStatus: pinResult.pinStatus,
            });
          }
        } catch (ipfsError) {
          logger.error('IPFS pinning error', {
            uploadId,
            error: ipfsError.message,
          });
        }
        
        // Step 8: All processing complete
        await this.uploadService.updateSessionStatus(uploadId, 'hd_ready');
        
        // Step 9: Cleanup temp files
        await this.cleanupTempFiles([tempFilePath]);
        
        logger.info('Completed transcode and pin job', {
          jobId: job.id,
          uploadId,
          cid: pinResult?.cid,
          playlistUrl: transcodingResults.playlistUrl,
          renditions: transcodingResults.renditions.length,
        });

        return {
          success: true,
          cid: pinResult?.cid,
          playlistUrl: transcodingResults.playlistUrl,
          renditions: transcodingResults.renditions,
          thumbnails,
          ipfsResult: pinResult,
        };

      } catch (error) {
        logger.error('Transcode and pin job failed', {
          jobId: job.id,
          uploadId,
          error: error.message,
          stack: error.stack,
        });

        // Update session status to failed
        await this.uploadService.updateSessionStatus(uploadId, 'failed', error.message);
        
        throw error;
      }
    });
  }

  /**
   * Setup event handlers for job monitoring
   */
  private setupEventHandlers(): void {
    this.queue.on('completed', (job, result) => {
      logger.info('Job completed successfully', {
        jobId: job.id,
        uploadId: job.data.uploadId,
        result,
      });
    });

    this.queue.on('failed', (job, error) => {
      logger.error('Job failed', {
        jobId: job.id,
        uploadId: job.data?.uploadId,
        error: error.message,
        attempts: job.attemptsMade,
      });
    });

    this.queue.on('stalled', (job) => {
      logger.warn('Job stalled', {
        jobId: job.id,
        uploadId: job.data?.uploadId,
      });
    });
  }

  /**
   * Download file from storage to temporary location
   */
  private async downloadFileToTemp(storageKey: string, filename: string): Promise<string> {
    const tempDir = process.env.TEMP_DIR || '/tmp';
    const tempFilePath = path.join(tempDir, `upload-${Date.now()}-${filename}`);

    try {
      const stream = await this.storageService.getObjectStream(
        process.env.STORAGE_BUCKET_UPLOADS!,
        storageKey
      );

      const writeStream = fs.createWriteStream(tempFilePath);
      await pipelineAsync(stream, writeStream);

      logger.debug('Downloaded file to temp location', {
        storageKey,
        tempFilePath,
        size: fs.statSync(tempFilePath).size,
      });

      return tempFilePath;
    } catch (error) {
      logger.error('Failed to download file to temp', {
        storageKey,
        tempFilePath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Probe video file metadata using FFprobe
   */
  private async probeVideoFile(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (error, metadata) => {
        if (error) {
          reject(error);
        } else {
          resolve(metadata);
        }
      });
    });
  }

  /**
   * Transcode video to HLS format with multiple renditions
   */
  private async transcodeToHLS(inputPath: string, uploadId: string, videoInfo: any): Promise<{
    playlistUrl: string;
    renditions: Array<{ profile: string; url: string; }>;
  }> {
    const outputDir = path.join(process.env.TEMP_DIR || '/tmp', `hls-${uploadId}`);
    fs.mkdirSync(outputDir, { recursive: true });

    const renditions: Array<{ profile: string; url: string; }> = [];

    try {
      // Determine which profiles to use based on input resolution
      const inputWidth = videoInfo.streams[0]?.width || 1920;
      const inputHeight = videoInfo.streams[0]?.height || 1080;
      
      const applicableProfiles = TRANSCODING_PROFILES.filter(profile => 
        profile.width <= inputWidth && profile.height <= inputHeight
      );

      // Transcode each profile
      for (const profile of applicableProfiles) {
        const outputPath = path.join(outputDir, `${profile.name}.m3u8`);
        
        await this.transcodeProfile(inputPath, outputPath, profile);
        
        // Upload to CDN/storage
        const cdnUrl = await this.uploadToCDN(outputPath, `videos/${uploadId}/${profile.name}.m3u8`);
        
        renditions.push({
          profile: profile.name,
          url: cdnUrl,
        });

        logger.debug('Completed transcoding profile', {
          uploadId,
          profile: profile.name,
          outputPath,
          cdnUrl,
        });
      }

      // Create master playlist
      const masterPlaylistPath = path.join(outputDir, 'playlist.m3u8');
      await this.createMasterPlaylist(masterPlaylistPath, renditions);
      
      // Upload master playlist
      const playlistUrl = await this.uploadToCDN(masterPlaylistPath, `videos/${uploadId}/playlist.m3u8`);

      return {
        playlistUrl,
        renditions,
      };

    } catch (error) {
      logger.error('Failed to transcode to HLS', {
        uploadId,
        inputPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Transcode to specific profile
   */
  private async transcodeProfile(inputPath: string, outputPath: string, profile: TranscodingProfile): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(`${profile.width}x${profile.height}`)
        .videoBitrate(profile.bitrate)
        .fps(profile.fps || 30)
        .outputOptions([
          '-hls_time 6',
          '-hls_list_size 0',
          '-hls_segment_filename', outputPath.replace('.m3u8', '_%03d.ts'),
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  /**
   * Create HLS master playlist
   */
  private async createMasterPlaylist(outputPath: string, renditions: Array<{ profile: string; url: string; }>): Promise<void> {
    const content = '#EXTM3U\n#EXT-X-VERSION:3\n\n' +
      renditions.map(rendition => {
        const profile = TRANSCODING_PROFILES.find(p => p.name === rendition.profile);
        return `#EXT-X-STREAM-INF:BANDWIDTH=${this.getBandwidth(profile!.bitrate)},RESOLUTION=${profile!.width}x${profile!.height}\n${rendition.profile}.m3u8`;
      }).join('\n\n');

    fs.writeFileSync(outputPath, content);
  }

  /**
   * Generate video thumbnails
   */
  private async generateThumbnails(inputPath: string, uploadId: string): Promise<string[]> {
    const outputDir = path.join(process.env.TEMP_DIR || '/tmp', `thumbs-${uploadId}`);
    fs.mkdirSync(outputDir, { recursive: true });

    const thumbnails: string[] = [];

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          count: 5,
          folder: outputDir,
          filename: 'thumb_%i.jpg',
          size: '320x240',
        })
        .on('end', async () => {
          try {
            // Upload thumbnails to CDN
            const files = fs.readdirSync(outputDir);
            for (const file of files) {
              const filePath = path.join(outputDir, file);
              const cdnUrl = await this.uploadToCDN(filePath, `videos/${uploadId}/thumbnails/${file}`);
              thumbnails.push(cdnUrl);
            }
            resolve(thumbnails);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  /**
   * Upload file to CDN (placeholder implementation)
   */
  private async uploadToCDN(filePath: string, cdnKey: string): Promise<string> {
    // This is a placeholder - in production, you would upload to your CDN
    // For now, we'll just return a mock URL
    const cdnBaseUrl = process.env.CDN_BASE_URL || 'https://cdn.reelverse.com';
    return `${cdnBaseUrl}/${cdnKey}`;
  }

  /**
   * Cleanup temporary files
   */
  private async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          if (fs.statSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true });
          } else {
            fs.unlinkSync(filePath);
          }
        }
      } catch (error) {
        logger.warn('Failed to cleanup temp file', {
          filePath,
          error: error.message,
        });
      }
    }
  }

  /**
   * Convert bitrate string to bandwidth number
   */
  private getBandwidth(bitrate: string): number {
    const value = parseInt(bitrate.replace(/[kKmM]/, ''), 10);
    if (bitrate.toLowerCase().includes('k')) {
      return value * 1000;
    } else if (bitrate.toLowerCase().includes('m')) {
      return value * 1000000;
    }
    return value;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  /**
   * Clean up failed jobs
   */
  async cleanFailedJobs(): Promise<void> {
    await this.queue.clean(24 * 60 * 60 * 1000, 'failed'); // Remove failed jobs older than 24 hours
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    await this.queue.close();
    logger.info('Transcode and pin job service shutdown complete');
  }
}

// Default service instance
let transcodeAndPinJobService: TranscodeAndPinJobService | null = null;

/**
 * Get or create the default job service instance
 */
export function getTranscodeAndPinJobService(): TranscodeAndPinJobService {
  if (!transcodeAndPinJobService) {
    transcodeAndPinJobService = new TranscodeAndPinJobService();
  }
  return transcodeAndPinJobService;
}