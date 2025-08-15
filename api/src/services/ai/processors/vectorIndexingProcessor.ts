import { Job } from 'bull';
import { logger } from '../../../utils/logger';
import { AIJobData } from '../baseAIService';
import { vectorSearchService } from '../vectorSearchService';
import { pool } from '../../../config/database';

interface VectorIndexingJobData extends AIJobData {
  operation: 'vector-indexing';
  embedding: number[];
  metadata: any;
}

export const processVectorIndexingJob = async (job: Job<VectorIndexingJobData>) => {
  const { contentId, embedding, metadata } = job.data;
  
  logger.info('Processing vector indexing job', {
    jobId: job.id,
    contentId,
    embeddingDimensions: embedding.length,
  });

  try {
    // Update job progress
    await job.progress(10);

    // Get content metadata from database
    const contentMetadata = await getContentMetadata(contentId);
    
    await job.progress(30);

    // Index content in vector database (Weaviate) and search engine (Meilisearch)
    await vectorSearchService.indexContent(contentId, embedding, contentMetadata);
    
    await job.progress(80);

    // Update content record with indexing status
    await updateContentIndexingStatus(contentId, true);
    
    await job.progress(100);
    
    const result = {
      contentId,
      indexed: true,
      vectorId: contentId, // Using contentId as vector ID
      embeddingDimensions: embedding.length,
      processingTime: Date.now(),
    };

    logger.info('Vector indexing job completed', {
      jobId: job.id,
      contentId,
      indexed: result.indexed,
    });

    return result;
  } catch (error) {
    logger.error('Vector indexing job failed', {
      jobId: job.id,
      contentId,
      error: (error as Error).message,
    });
    throw error;
  }
};

async function getContentMetadata(contentId: string): Promise<any> {
  const client = await pool.connect();
  
  try {
    // Create content table if it doesn't exist (for development)
    await client.query(`
      CREATE TABLE IF NOT EXISTS content (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        tags TEXT[],
        category VARCHAR(100),
        creator_id VARCHAR(255),
        creator_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        duration INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        age_restricted BOOLEAN DEFAULT false,
        indexed_at TIMESTAMP
      )
    `);

    // Try to get existing content metadata
    const result = await client.query(
      'SELECT * FROM content WHERE id = $1',
      [contentId]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      
      // Get AI tags
      const aiTagsResult = await client.query(
        'SELECT tag FROM ai_tags WHERE content_id = $1',
        [contentId]
      );
      
      const aiTags = aiTagsResult.rows.map(r => r.tag);

      return {
        contentId: row.id,
        title: row.title,
        description: row.description || '',
        tags: row.tags || [],
        aiTags: aiTags,
        category: row.category || 'general',
        creatorId: row.creator_id || 'unknown',
        creatorName: row.creator_name || 'Unknown Creator',
        createdAt: row.created_at || new Date(),
        duration: row.duration || 0,
        viewCount: row.view_count || 0,
        ageRestricted: row.age_restricted || false,
      };
    } else {
      // Create placeholder content record for testing
      const placeholderMetadata = {
        contentId,
        title: `Content ${contentId}`,
        description: `Auto-generated content for ${contentId}`,
        tags: ['auto-generated'],
        aiTags: [],
        category: 'general',
        creatorId: 'system',
        creatorName: 'System',
        createdAt: new Date(),
        duration: 0,
        viewCount: 0,
        ageRestricted: false,
      };

      // Insert placeholder record
      await client.query(`
        INSERT INTO content (id, title, description, tags, category, creator_id, creator_name, created_at, duration, view_count, age_restricted)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `, [
        contentId,
        placeholderMetadata.title,
        placeholderMetadata.description,
        placeholderMetadata.tags,
        placeholderMetadata.category,
        placeholderMetadata.creatorId,
        placeholderMetadata.creatorName,
        placeholderMetadata.createdAt,
        placeholderMetadata.duration,
        placeholderMetadata.viewCount,
        placeholderMetadata.ageRestricted,
      ]);

      return placeholderMetadata;
    }
  } catch (error) {
    logger.error('Failed to get content metadata', {
      contentId,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    client.release();
  }
}

async function updateContentIndexingStatus(contentId: string, indexed: boolean): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query(
      'UPDATE content SET indexed_at = $1 WHERE id = $2',
      [indexed ? new Date() : null, contentId]
    );
    
    logger.info('Content indexing status updated', {
      contentId,
      indexed,
    });
  } catch (error) {
    logger.error('Failed to update content indexing status', {
      contentId,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    client.release();
  }
}