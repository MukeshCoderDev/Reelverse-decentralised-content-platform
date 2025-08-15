import { BaseAIService, VideoFingerprint, MatchResult, AIServiceError } from './baseAIService';
import { logger } from '../../utils/logger';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Import pHash library for perceptual hashing
const pHash = require('node-phash');

export interface FingerprintConfig {
  frameInterval: number; // seconds between frames
  maxFrames: number;
  hashSize: number; // pHash size (8x8 = 64 bits)
  audioSampleRate: number;
  audioChunkSize: number; // seconds
  similarityThreshold: number;
}

export interface AudioFingerprint {
  chromaFeatures: number[];
  mfccFeatures: number[];
  spectralCentroid: number[];
  duration: number;
}

export interface FrameHash {
  timestamp: number;
  hash: string;
  confidence: number;
}

export class VideoFingerprintService extends BaseAIService {
  private config: FingerprintConfig;
  private tempDir: string;

  constructor() {
    super('VideoFingerprintService');
    this.config = {
      frameInterval: 10, // Extract frame every 10 seconds
      maxFrames: 50,
      hashSize: 8, // 8x8 pHash
      audioSampleRate: 22050,
      audioChunkSize: 5, // 5-second audio chunks
      similarityThreshold: 0.85,
    };
    this.tempDir = process.env.TEMP_DIR || '/tmp/fingerprinting';
  }

  /**
   * Generate comprehensive video fingerprint
   */
  public async generateFingerprint(videoUrl: string): Promise<VideoFingerprint> {
    this.validateInput(videoUrl, 'videoUrl');
    this.logOperation('generateFingerprint', { videoUrl });

    try {
      await this.ensureTempDir();
      const sessionId = uuidv4();

      // Extract video metadata
      const metadata = await this.extractVideoMetadata(videoUrl);
      
      // Generate frame hashes
      const frameHashes = await this.generateFrameHashes(videoUrl, sessionId);
      
      // Generate audio fingerprint
      const audioFingerprint = await this.generateAudioFingerprint(videoUrl, sessionId);
      
      // Clean up temporary files
      await this.cleanupSession(sessionId);

      const fingerprint: VideoFingerprint = {
        frameHashes: frameHashes.map(f => f.hash),
        audioChroma: audioFingerprint.chromaFeatures,
        duration: metadata.duration,
        resolution: metadata.resolution,
        metadata: {
          fps: metadata.fps,
          bitrate: metadata.bitrate,
          codec: metadata.codec,
        },
      };

      this.logOperation('generateFingerprint completed', {
        videoUrl,
        frameCount: frameHashes.length,
        audioFeatures: audioFingerprint.chromaFeatures.length,
        duration: metadata.duration,
      });

      return fingerprint;
    } catch (error) {
      this.logError('generateFingerprint', error as Error, { videoUrl });
      throw error;
    }
  }

  /**
   * Compare two video fingerprints for similarity
   */
  public async compareFingerprints(fp1: VideoFingerprint, fp2: VideoFingerprint): Promise<MatchResult> {
    this.validateInput(fp1, 'fingerprint1');
    this.validateInput(fp2, 'fingerprint2');

    try {
      // Compare frame hashes
      const frameMatches = this.compareFrameHashes(fp1.frameHashes, fp2.frameHashes);
      
      // Compare audio features
      const audioSimilarity = this.compareAudioFeatures(fp1.audioChroma, fp2.audioChroma);
      
      // Calculate overall similarity
      const frameSimilarity = frameMatches.matchedFrames / Math.max(fp1.frameHashes.length, fp2.frameHashes.length);
      const overallSimilarity = (frameSimilarity * 0.7) + (audioSimilarity * 0.3);
      
      // Calculate confidence based on multiple factors
      const confidence = this.calculateMatchConfidence(fp1, fp2, frameSimilarity, audioSimilarity);

      const result: MatchResult = {
        similarity: overallSimilarity,
        matchedFrames: frameMatches.matchedFrames,
        totalFrames: Math.max(fp1.frameHashes.length, fp2.frameHashes.length),
        confidence: confidence,
      };

      this.logOperation('compareFingerprints completed', {
        similarity: overallSimilarity,
        confidence: confidence,
        frameMatches: frameMatches.matchedFrames,
      });

      return result;
    } catch (error) {
      this.logError('compareFingerprints', error as Error);
      throw error;
    }
  }

  /**
   * Store fingerprint in vector database for similarity search
   */
  public async storeFingerprint(contentId: string, fingerprint: VideoFingerprint): Promise<void> {
    this.validateInput(contentId, 'contentId');
    this.validateInput(fingerprint, 'fingerprint');

    try {
      const { weaviateClient } = await import('../../config/ai');
      
      // Convert fingerprint to vector for storage
      const fingerprintVector = this.fingerprintToVector(fingerprint);
      
      await weaviateClient.data
        .creator()
        .withClassName('LeakFingerprint')
        .withId(contentId)
        .withVector(fingerprintVector)
        .withProperties({
          contentId: contentId,
          frameHashes: fingerprint.frameHashes,
          audioChroma: fingerprint.audioChroma,
          duration: fingerprint.duration,
          resolution: fingerprint.resolution,
          createdAt: new Date().toISOString(),
        })
        .do();

      this.logOperation('storeFingerprint completed', { contentId });
    } catch (error) {
      this.logError('storeFingerprint', error as Error, { contentId });
      throw error;
    }
  }

  /**
   * Search for similar fingerprints in the database
   */
  public async findSimilarFingerprints(fingerprint: VideoFingerprint, limit: number = 10): Promise<Array<{
    contentId: string;
    similarity: number;
    matchResult: MatchResult;
  }>> {
    this.validateInput(fingerprint, 'fingerprint');

    try {
      const { weaviateClient } = await import('../../config/ai');
      
      // Convert fingerprint to vector for search
      const queryVector = this.fingerprintToVector(fingerprint);
      
      const results = await weaviateClient.graphql
        .get()
        .withClassName('LeakFingerprint')
        .withFields('contentId frameHashes audioChroma duration resolution')
        .withNearVector({
          vector: queryVector,
          certainty: this.config.similarityThreshold,
        })
        .withLimit(limit)
        .do();

      const similarFingerprints = [];
      
      if (results?.data?.Get?.LeakFingerprint) {
        for (const item of results.data.Get.LeakFingerprint) {
          const storedFingerprint: VideoFingerprint = {
            frameHashes: item.frameHashes,
            audioChroma: item.audioChroma,
            duration: item.duration,
            resolution: item.resolution,
          };
          
          const matchResult = await this.compareFingerprints(fingerprint, storedFingerprint);
          
          if (matchResult.similarity >= this.config.similarityThreshold) {
            similarFingerprints.push({
              contentId: item.contentId,
              similarity: matchResult.similarity,
              matchResult: matchResult,
            });
          }
        }
      }

      // Sort by similarity
      similarFingerprints.sort((a, b) => b.similarity - a.similarity);

      this.logOperation('findSimilarFingerprints completed', {
        queryDuration: fingerprint.duration,
        resultsFound: similarFingerprints.length,
      });

      return similarFingerprints;
    } catch (error) {
      this.logError('findSimilarFingerprints', error as Error);
      throw error;
    }
  }

  private async extractVideoMetadata(videoUrl: string): Promise<{
    duration: number;
    resolution: string;
    fps: number;
    bitrate: number;
    codec: string;
  }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoUrl, (err, metadata) => {
        if (err) {
          reject(new AIServiceError(
            `Failed to extract video metadata: ${err.message}`,
            'METADATA_EXTRACTION_FAILED',
            true
          ));
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
          reject(new AIServiceError(
            'No video stream found in file',
            'NO_VIDEO_STREAM',
            false
          ));
          return;
        }

        resolve({
          duration: metadata.format.duration || 0,
          resolution: `${videoStream.width}x${videoStream.height}`,
          fps: eval(videoStream.r_frame_rate || '0') || 0,
          bitrate: parseInt(metadata.format.bit_rate || '0'),
          codec: videoStream.codec_name || 'unknown',
        });
      });
    });
  }

  private async generateFrameHashes(videoUrl: string, sessionId: string): Promise<FrameHash[]> {
    const frameHashes: FrameHash[] = [];
    const outputDir = path.join(this.tempDir, sessionId, 'frames');
    
    await fs.mkdir(outputDir, { recursive: true });

    return new Promise((resolve, reject) => {
      const outputPattern = path.join(outputDir, 'frame_%04d.jpg');
      
      ffmpeg(videoUrl)
        .on('end', async () => {
          try {
            // Process extracted frames
            const frameFiles = await fs.readdir(outputDir);
            frameFiles.sort();

            for (let i = 0; i < Math.min(frameFiles.length, this.config.maxFrames); i++) {
              const framePath = path.join(outputDir, frameFiles[i]);
              const timestamp = i * this.config.frameInterval;
              
              try {
                // Generate perceptual hash for frame
                const hash = await this.generateImageHash(framePath);
                
                frameHashes.push({
                  timestamp,
                  hash,
                  confidence: 1.0, // Full confidence for extracted frames
                });
              } catch (hashError) {
                logger.warn('Failed to hash frame', {
                  framePath,
                  error: (hashError as Error).message,
                });
              }
            }

            resolve(frameHashes);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (err) => {
          reject(new AIServiceError(
            `Frame extraction failed: ${err.message}`,
            'FRAME_EXTRACTION_FAILED',
            true
          ));
        })
        .outputOptions([
          `-vf fps=1/${this.config.frameInterval}`,
          '-q:v 2',
        ])
        .output(outputPattern)
        .run();
    });
  }

  private async generateImageHash(imagePath: string): Promise<string> {
    try {
      // Resize and normalize image for consistent hashing
      const processedImagePath = imagePath.replace('.jpg', '_processed.jpg');
      
      await sharp(imagePath)
        .resize(64, 64, { fit: 'fill' })
        .grayscale()
        .jpeg({ quality: 90 })
        .toFile(processedImagePath);

      // Generate perceptual hash
      const hash = await new Promise<string>((resolve, reject) => {
        pHash.imageHash(processedImagePath, (err: Error, hash: string) => {
          if (err) {
            reject(err);
          } else {
            resolve(hash);
          }
        });
      });

      // Clean up processed image
      await fs.unlink(processedImagePath);

      return hash;
    } catch (error) {
      throw new AIServiceError(
        `Image hashing failed: ${(error as Error).message}`,
        'IMAGE_HASHING_FAILED',
        true
      );
    }
  }

  private async generateAudioFingerprint(videoUrl: string, sessionId: string): Promise<AudioFingerprint> {
    const audioDir = path.join(this.tempDir, sessionId, 'audio');
    await fs.mkdir(audioDir, { recursive: true });
    
    const audioPath = path.join(audioDir, 'audio.wav');

    return new Promise((resolve, reject) => {
      ffmpeg(videoUrl)
        .on('end', async () => {
          try {
            // Extract audio features (simplified implementation)
            const audioFeatures = await this.extractAudioFeatures(audioPath);
            resolve(audioFeatures);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (err) => {
          reject(new AIServiceError(
            `Audio extraction failed: ${err.message}`,
            'AUDIO_EXTRACTION_FAILED',
            true
          ));
        })
        .outputOptions([
          '-vn', // No video
          '-acodec pcm_s16le',
          `-ar ${this.config.audioSampleRate}`,
          '-ac 1', // Mono
        ])
        .output(audioPath)
        .run();
    });
  }

  private async extractAudioFeatures(audioPath: string): Promise<AudioFingerprint> {
    try {
      // Simplified audio feature extraction
      // In a real implementation, you would use libraries like librosa or similar
      const audioBuffer = await fs.readFile(audioPath);
      const duration = audioBuffer.length / (this.config.audioSampleRate * 2); // 16-bit samples
      
      // Generate mock chroma features (12-dimensional)
      const chromaFeatures = Array.from({ length: 12 }, (_, i) => 
        Math.sin(i * Math.PI / 6) * 0.5 + 0.5
      );
      
      // Generate mock MFCC features (13-dimensional)
      const mfccFeatures = Array.from({ length: 13 }, (_, i) => 
        Math.cos(i * Math.PI / 13) * 0.3 + 0.7
      );
      
      // Generate mock spectral centroid
      const spectralCentroid = [1000 + Math.random() * 2000];

      return {
        chromaFeatures,
        mfccFeatures,
        spectralCentroid,
        duration,
      };
    } catch (error) {
      throw new AIServiceError(
        `Audio feature extraction failed: ${(error as Error).message}`,
        'AUDIO_FEATURE_EXTRACTION_FAILED',
        true
      );
    }
  }

  private compareFrameHashes(hashes1: string[], hashes2: string[]): {
    matchedFrames: number;
    matchDetails: Array<{ index1: number; index2: number; similarity: number }>;
  } {
    const matches: Array<{ index1: number; index2: number; similarity: number }> = [];
    let matchedFrames = 0;

    for (let i = 0; i < hashes1.length; i++) {
      for (let j = 0; j < hashes2.length; j++) {
        const similarity = this.calculateHashSimilarity(hashes1[i], hashes2[j]);
        
        if (similarity >= this.config.similarityThreshold) {
          matches.push({ index1: i, index2: j, similarity });
          matchedFrames++;
          break; // Move to next frame in hashes1
        }
      }
    }

    return { matchedFrames, matchDetails: matches };
  }

  private calculateHashSimilarity(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      return 0;
    }

    let differences = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        differences++;
      }
    }

    // Convert Hamming distance to similarity (0-1)
    return 1 - (differences / hash1.length);
  }

  private compareAudioFeatures(chroma1: number[], chroma2: number[]): number {
    if (chroma1.length !== chroma2.length) {
      return 0;
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < chroma1.length; i++) {
      dotProduct += chroma1[i] * chroma2[i];
      norm1 += chroma1[i] * chroma1[i];
      norm2 += chroma2[i] * chroma2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private calculateMatchConfidence(
    fp1: VideoFingerprint,
    fp2: VideoFingerprint,
    frameSimilarity: number,
    audioSimilarity: number
  ): number {
    let confidence = 0;

    // Base confidence from similarity scores
    confidence += frameSimilarity * 0.5;
    confidence += audioSimilarity * 0.3;

    // Duration similarity bonus
    const durationRatio = Math.min(fp1.duration, fp2.duration) / Math.max(fp1.duration, fp2.duration);
    confidence += durationRatio * 0.1;

    // Resolution similarity bonus
    if (fp1.resolution === fp2.resolution) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private fingerprintToVector(fingerprint: VideoFingerprint): number[] {
    // Convert fingerprint to a fixed-size vector for storage
    const vector: number[] = [];
    
    // Add frame hash features (first 32 hashes, converted to numbers)
    const maxHashes = Math.min(32, fingerprint.frameHashes.length);
    for (let i = 0; i < maxHashes; i++) {
      const hash = fingerprint.frameHashes[i];
      // Convert hash string to numeric representation
      const hashValue = parseInt(hash.substring(0, 8), 16) / 0xFFFFFFFF;
      vector.push(hashValue);
    }
    
    // Pad with zeros if needed
    while (vector.length < 32) {
      vector.push(0);
    }
    
    // Add audio chroma features (12 dimensions)
    const maxChroma = Math.min(12, fingerprint.audioChroma.length);
    for (let i = 0; i < maxChroma; i++) {
      vector.push(fingerprint.audioChroma[i]);
    }
    
    // Pad audio features if needed
    while (vector.length < 44) {
      vector.push(0);
    }
    
    // Add metadata features
    vector.push(fingerprint.duration / 3600); // Normalized duration (hours)
    
    // Parse resolution
    const [width, height] = fingerprint.resolution.split('x').map(Number);
    vector.push((width || 0) / 1920); // Normalized width
    vector.push((height || 0) / 1080); // Normalized height
    
    return vector;
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      throw new AIServiceError(
        `Failed to create temp directory: ${(error as Error).message}`,
        'TEMP_DIR_CREATION_FAILED'
      );
    }
  }

  private async cleanupSession(sessionId: string): Promise<void> {
    try {
      const sessionDir = path.join(this.tempDir, sessionId);
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch (error) {
      logger.warn('Failed to cleanup session directory', {
        sessionId,
        error: (error as Error).message,
      });
    }
  }
}

// Export singleton instance
export const videoFingerprintService = new VideoFingerprintService();