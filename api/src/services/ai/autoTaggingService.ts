import { BaseAIService, TagResult, AIServiceError } from './baseAIService';
import { openaiClient, huggingfaceClient } from '../../config/ai';
import { logger } from '../../utils/logger';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface AutoTaggingConfig {
  maxFrames: number;
  frameInterval: number; // seconds
  confidenceThreshold: number;
  maxTags: number;
  categories: {
    visual: string[];
    scene: string[];
    performer: string[];
    action: string[];
    setting: string[];
  };
}

export class AutoTaggingService extends BaseAIService {
  private config: AutoTaggingConfig;
  private tempDir: string;

  constructor() {
    super('AutoTaggingService');
    this.config = {
      maxFrames: 10,
      frameInterval: 30, // Extract frame every 30 seconds
      confidenceThreshold: 0.7,
      maxTags: 20,
      categories: {
        visual: [
          'blonde', 'brunette', 'redhead', 'tattoo', 'piercing', 'lingerie',
          'stockings', 'heels', 'glasses', 'jewelry', 'makeup'
        ],
        scene: [
          'bedroom', 'bathroom', 'kitchen', 'office', 'outdoor', 'pool',
          'car', 'hotel', 'studio', 'couch', 'bed', 'shower'
        ],
        performer: [
          'solo', 'couple', 'threesome', 'group', 'male', 'female',
          'trans', 'mature', 'young', 'petite', 'curvy', 'athletic'
        ],
        action: [
          'dancing', 'stripping', 'posing', 'massage', 'kissing',
          'touching', 'undressing', 'showering', 'exercising'
        ],
        setting: [
          'romantic', 'playful', 'sensual', 'intimate', 'artistic',
          'professional', 'amateur', 'pov', 'closeup', 'wide'
        ]
      }
    };
    this.tempDir = process.env.TEMP_DIR || '/tmp/ai-processing';
  }

  public async generateTags(contentId: string, mediaUrl: string, existingTags: string[] = []): Promise<TagResult[]> {
    this.validateInput(contentId, 'contentId');
    this.validateInput(mediaUrl, 'mediaUrl');

    this.logOperation('generateTags', { contentId, mediaUrl });

    try {
      // Ensure temp directory exists
      await this.ensureTempDir();

      // Extract frames from video
      const frames = await this.extractFrames(mediaUrl, contentId);
      
      // Generate tags from frames using multiple AI models
      const allTags: TagResult[] = [];

      // Process frames with CLIP for visual understanding
      const clipTags = await this.processFramesWithCLIP(frames);
      allTags.push(...clipTags);

      // Process frames with BLIP2 for scene description
      const blip2Tags = await this.processFramesWithBLIP2(frames);
      allTags.push(...blip2Tags);

      // Deduplicate and filter tags
      const filteredTags = this.filterAndDeduplicateTags(allTags, existingTags);

      // Clean up temporary files
      await this.cleanupFrames(frames);

      this.logOperation('generateTags completed', {
        contentId,
        tagCount: filteredTags.length,
        categories: this.groupTagsByCategory(filteredTags)
      });

      return filteredTags;
    } catch (error) {
      this.logError('generateTags', error as Error, { contentId, mediaUrl });
      throw error;
    }
  }

  public async processEmbeddings(mediaUrl: string): Promise<number[]> {
    this.validateInput(mediaUrl, 'mediaUrl');

    return await this.withRetry(async () => {
      // Extract a representative frame for embedding
      const tempId = uuidv4();
      const frames = await this.extractFrames(mediaUrl, tempId, 1);
      
      if (frames.length === 0) {
        throw new AIServiceError('No frames extracted for embedding', 'FRAME_EXTRACTION_FAILED');
      }

      try {
        // Use OpenAI's CLIP model for embeddings
        const imageBuffer = await fs.readFile(frames[0]);
        const base64Image = imageBuffer.toString('base64');

        const response = await openaiClient.embeddings.create({
          model: 'text-embedding-3-small',
          input: `Image content: ${base64Image}`,
        });

        await this.cleanupFrames(frames);
        return response.data[0].embedding;
      } catch (error) {
        await this.cleanupFrames(frames);
        throw error;
      }
    });
  }

  private async extractFrames(videoUrl: string, contentId: string, maxFrames?: number): Promise<string[]> {
    const frameCount = maxFrames || this.config.maxFrames;
    const frames: string[] = [];

    return new Promise((resolve, reject) => {
      const outputPattern = path.join(this.tempDir, `${contentId}_frame_%03d.jpg`);

      ffmpeg(videoUrl)
        .on('end', () => {
          // Collect generated frame files
          this.collectFrameFiles(contentId, frameCount)
            .then(resolve)
            .catch(reject);
        })
        .on('error', (err) => {
          logger.error('FFmpeg frame extraction failed', {
            error: err.message,
            contentId,
            videoUrl
          });
          reject(new AIServiceError(
            `Frame extraction failed: ${err.message}`,
            'FRAME_EXTRACTION_FAILED',
            true
          ));
        })
        .outputOptions([
          '-vf', `fps=1/${this.config.frameInterval}`,
          '-vframes', frameCount.toString(),
          '-q:v', '2'
        ])
        .output(outputPattern)
        .run();
    });
  }

  private async collectFrameFiles(contentId: string, maxFrames: number): Promise<string[]> {
    const frames: string[] = [];
    
    for (let i = 1; i <= maxFrames; i++) {
      const framePath = path.join(this.tempDir, `${contentId}_frame_${i.toString().padStart(3, '0')}.jpg`);
      
      try {
        await fs.access(framePath);
        frames.push(framePath);
      } catch {
        // Frame doesn't exist, stop collecting
        break;
      }
    }

    return frames;
  }

  private async processFramesWithCLIP(frames: string[]): Promise<TagResult[]> {
    const tags: TagResult[] = [];

    for (const framePath of frames) {
      try {
        const imageBuffer = await fs.readFile(framePath);
        
        // Resize image for processing
        const processedImage = await sharp(imageBuffer)
          .resize(224, 224)
          .jpeg({ quality: 90 })
          .toBuffer();

        // Use Hugging Face CLIP model for visual classification
        const result = await huggingfaceClient.imageClassification({
          data: processedImage,
          model: 'openai/clip-vit-base-patch32'
        });

        // Convert results to our tag format
        if (Array.isArray(result)) {
          for (const item of result) {
            if (item.score >= this.config.confidenceThreshold) {
              const category = this.categorizeTag(item.label);
              tags.push({
                tag: this.normalizeTag(item.label),
                confidence: item.score,
                category: category
              });
            }
          }
        }
      } catch (error) {
        logger.warn('CLIP processing failed for frame', {
          framePath,
          error: (error as Error).message
        });
      }
    }

    return tags;
  }

  private async processFramesWithBLIP2(frames: string[]): Promise<TagResult[]> {
    const tags: TagResult[] = [];

    for (const framePath of frames) {
      try {
        const imageBuffer = await fs.readFile(framePath);
        
        // Use Hugging Face BLIP2 for image captioning
        const result = await huggingfaceClient.imageToText({
          data: imageBuffer,
          model: 'Salesforce/blip-image-captioning-base'
        });

        // Extract tags from generated caption
        if (result && typeof result === 'object' && 'generated_text' in result) {
          const caption = result.generated_text as string;
          const extractedTags = this.extractTagsFromCaption(caption);
          tags.push(...extractedTags);
        }
      } catch (error) {
        logger.warn('BLIP2 processing failed for frame', {
          framePath,
          error: (error as Error).message
        });
      }
    }

    return tags;
  }

  private extractTagsFromCaption(caption: string): TagResult[] {
    const tags: TagResult[] = [];
    const words = caption.toLowerCase().split(/\s+/);
    
    // Look for relevant keywords in the caption
    for (const category in this.config.categories) {
      const categoryTags = this.config.categories[category as keyof typeof this.config.categories];
      
      for (const tag of categoryTags) {
        if (words.some(word => word.includes(tag) || tag.includes(word))) {
          tags.push({
            tag: tag,
            confidence: 0.8, // Default confidence for caption-extracted tags
            category: category as TagResult['category']
          });
        }
      }
    }

    return tags;
  }

  private categorizeTag(tag: string): TagResult['category'] {
    const normalizedTag = tag.toLowerCase();
    
    for (const [category, tags] of Object.entries(this.config.categories)) {
      if (tags.some(t => normalizedTag.includes(t) || t.includes(normalizedTag))) {
        return category as TagResult['category'];
      }
    }

    return 'visual'; // Default category
  }

  private normalizeTag(tag: string): string {
    return tag
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  private filterAndDeduplicateTags(tags: TagResult[], existingTags: string[]): TagResult[] {
    // Remove duplicates and existing tags
    const tagMap = new Map<string, TagResult>();
    const existingTagsSet = new Set(existingTags.map(t => t.toLowerCase()));

    for (const tag of tags) {
      const normalizedTag = tag.tag.toLowerCase();
      
      // Skip if tag already exists
      if (existingTagsSet.has(normalizedTag)) {
        continue;
      }

      // Keep tag with highest confidence
      if (!tagMap.has(normalizedTag) || tagMap.get(normalizedTag)!.confidence < tag.confidence) {
        tagMap.set(normalizedTag, tag);
      }
    }

    // Sort by confidence and limit count
    return Array.from(tagMap.values())
      .filter(tag => tag.confidence >= this.config.confidenceThreshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxTags);
  }

  private groupTagsByCategory(tags: TagResult[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    for (const tag of tags) {
      groups[tag.category] = (groups[tag.category] || 0) + 1;
    }

    return groups;
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

  private async cleanupFrames(frames: string[]): Promise<void> {
    await Promise.all(
      frames.map(async (framePath) => {
        try {
          await fs.unlink(framePath);
        } catch (error) {
          logger.warn('Failed to cleanup frame file', {
            framePath,
            error: (error as Error).message
          });
        }
      })
    );
  }
}

// Export singleton instance
export const autoTaggingService = new AutoTaggingService();