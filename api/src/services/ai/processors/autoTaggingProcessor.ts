import { Job } from 'bull';
import { logger } from '../../../utils/logger';
import { AutoTaggingJobData, TagResult } from '../baseAIService';
import { autoTaggingService } from '../autoTaggingService';
import { vectorIndexingQueue } from '../../../config/queues';
import { JobPriority, createJobOptions } from '../../../config/queues';
import { pool } from '../../../config/database';

export const processAutoTaggingJob = async (job: Job<AutoTaggingJobData>) => {
  const { contentId, mediaUrl, existingTags } = job.data;
  
  logger.info('Processing auto-tagging job', {
    jobId: job.id,
    contentId,
    mediaUrl,
  });

  try {
    // Update job progress
    await job.progress(10);

    // Generate AI tags using CLIP/BLIP2
    const aiTags = await autoTaggingService.generateTags(contentId, mediaUrl, existingTags);
    
    await job.progress(40);

    // Generate vector embeddings
    const embedding = await autoTaggingService.processEmbeddings(mediaUrl);
    
    await job.progress(70);

    // Store AI tags in database
    await storeAITags(contentId, aiTags);
    
    await job.progress(85);

    // Queue vector indexing job for semantic search
    await vectorIndexingQueue.add(
      'vector-indexing',
      {
        jobId: `vector-${contentId}-${Date.now()}`,
        contentId,
        operation: 'vector-indexing',
        priority: 'normal',
        embedding,
        metadata: {
          aiTags: aiTags.map(tag => tag.tag),
          tagCount: aiTags.length,
        },
      },
      createJobOptions(JobPriority.NORMAL)
    );

    const result = {
      contentId,
      tags: existingTags || [],
      aiTags: aiTags.map(tag => ({
        tag: tag.tag,
        confidence: tag.confidence,
        category: tag.category,
      })),
      embedding: embedding.slice(0, 10), // Only return first 10 dimensions for logging
      processingTime: Date.now(),
    };

    await job.progress(100);
    
    logger.info('Auto-tagging job completed', {
      jobId: job.id,
      contentId,
      tagCount: result.aiTags.length,
      embeddingDimensions: embedding.length,
    });

    return result;
  } catch (error) {
    logger.error('Auto-tagging job failed', {
      jobId: job.id,
      contentId,
      error: (error as Error).message,
    });
    throw error;
  }
};

async function storeAITags(contentId: string, aiTags: TagResult[]): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create ai_tags table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_tags (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        content_id VARCHAR(255) NOT NULL,
        tag VARCHAR(100) NOT NULL,
        confidence DECIMAL(4,3) NOT NULL,
        category VARCHAR(50) NOT NULL,
        model VARCHAR(50) DEFAULT 'clip-blip2',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(content_id, tag)
      )
    `);

    // Create index for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_tags_content_id ON ai_tags(content_id);
      CREATE INDEX IF NOT EXISTS idx_ai_tags_category ON ai_tags(category);
      CREATE INDEX IF NOT EXISTS idx_ai_tags_confidence ON ai_tags(confidence DESC);
    `);

    // Delete existing AI tags for this content
    await client.query(
      'DELETE FROM ai_tags WHERE content_id = $1',
      [contentId]
    );

    // Insert new AI tags
    if (aiTags.length > 0) {
      const values = aiTags.map((tag, index) => 
        `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
      ).join(', ');

      const params = aiTags.flatMap(tag => [
        contentId,
        tag.tag,
        tag.confidence,
        tag.category,
      ]);

      await client.query(
        `INSERT INTO ai_tags (content_id, tag, confidence, category) VALUES ${values}`,
        params
      );
    }

    await client.query('COMMIT');
    
    logger.info('AI tags stored successfully', {
      contentId,
      tagCount: aiTags.length,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to store AI tags', {
      contentId,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    client.release();
  }
}