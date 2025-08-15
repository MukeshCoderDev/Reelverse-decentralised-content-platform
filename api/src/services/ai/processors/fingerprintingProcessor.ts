import { Job } from 'bull';
import { logger } from '../../../utils/logger';
import { FingerprintJobData, VideoFingerprint } from '../baseAIService';
import { videoFingerprintService } from '../videoFingerprintService';
import { pool } from '../../../config/database';

export const processFingerprintingJob = async (job: Job<FingerprintJobData>) => {
  const { contentId, videoUrl } = job.data;
  
  logger.info('Processing fingerprinting job', {
    jobId: job.id,
    contentId,
    videoUrl,
  });

  try {
    // Update job progress
    await job.progress(10);

    // Generate video fingerprint
    const fingerprint = await videoFingerprintService.generateFingerprint(videoUrl);
    
    await job.progress(60);

    // Store fingerprint in vector database
    await videoFingerprintService.storeFingerprint(contentId, fingerprint);
    
    await job.progress(80);

    // Store fingerprint metadata in PostgreSQL
    await storeFingerprintMetadata(contentId, fingerprint);
    
    await job.progress(100);
    
    const result = {
      contentId,
      fingerprint: {
        frameCount: fingerprint.frameHashes.length,
        audioFeatures: fingerprint.audioChroma.length,
        duration: fingerprint.duration,
        resolution: fingerprint.resolution,
      },
      processingTime: Date.now(),
    };

    logger.info('Fingerprinting job completed', {
      jobId: job.id,
      contentId,
      frameCount: fingerprint.frameHashes.length,
      duration: fingerprint.duration,
    });

    return result;
  } catch (error) {
    logger.error('Fingerprinting job failed', {
      jobId: job.id,
      contentId,
      error: (error as Error).message,
    });
    throw error;
  }
};

async function storeFingerprintMetadata(contentId: string, fingerprint: VideoFingerprint): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create fingerprints table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS video_fingerprints (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        content_id VARCHAR(255) UNIQUE NOT NULL,
        frame_count INTEGER NOT NULL,
        audio_features_count INTEGER NOT NULL,
        duration DECIMAL(10,2) NOT NULL,
        resolution VARCHAR(20) NOT NULL,
        fps DECIMAL(8,2),
        bitrate INTEGER,
        codec VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_video_fingerprints_content_id ON video_fingerprints(content_id);
      CREATE INDEX IF NOT EXISTS idx_video_fingerprints_duration ON video_fingerprints(duration);
      CREATE INDEX IF NOT EXISTS idx_video_fingerprints_resolution ON video_fingerprints(resolution);
    `);

    // Insert or update fingerprint metadata
    await client.query(`
      INSERT INTO video_fingerprints (
        content_id, frame_count, audio_features_count, duration, resolution, fps, bitrate, codec
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (content_id) DO UPDATE SET
        frame_count = EXCLUDED.frame_count,
        audio_features_count = EXCLUDED.audio_features_count,
        duration = EXCLUDED.duration,
        resolution = EXCLUDED.resolution,
        fps = EXCLUDED.fps,
        bitrate = EXCLUDED.bitrate,
        codec = EXCLUDED.codec,
        updated_at = CURRENT_TIMESTAMP
    `, [
      contentId,
      fingerprint.frameHashes.length,
      fingerprint.audioChroma.length,
      fingerprint.duration,
      fingerprint.resolution,
      fingerprint.metadata?.fps || null,
      fingerprint.metadata?.bitrate || null,
      fingerprint.metadata?.codec || null,
    ]);

    await client.query('COMMIT');
    
    logger.info('Fingerprint metadata stored successfully', {
      contentId,
      frameCount: fingerprint.frameHashes.length,
      duration: fingerprint.duration,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to store fingerprint metadata', {
      contentId,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    client.release();
  }
}