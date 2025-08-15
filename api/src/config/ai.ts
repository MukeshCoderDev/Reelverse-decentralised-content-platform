import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { MeiliSearch } from 'meilisearch';
import OpenAI from 'openai';
import { HfInference } from '@huggingface/inference';

export interface AIConfig {
  weaviate: {
    url: string;
  };
  meilisearch: {
    url: string;
    masterKey: string;
  };
  openai: {
    apiKey: string;
  };
  huggingface: {
    apiKey: string;
  };
}

export const aiConfig: AIConfig = {
  weaviate: {
    url: process.env.WEAVIATE_URL || 'http://localhost:8080',
  },
  meilisearch: {
    url: process.env.MEILISEARCH_URL || 'http://localhost:7700',
    masterKey: process.env.MEILISEARCH_MASTER_KEY || 'development-master-key-change-in-production',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  huggingface: {
    apiKey: process.env.HUGGINGFACE_API_KEY || '',
  },
};

// Initialize AI clients
export const weaviateClient: WeaviateClient = weaviate.client({
  scheme: aiConfig.weaviate.url.startsWith('https') ? 'https' : 'http',
  host: aiConfig.weaviate.url.replace(/^https?:\/\//, ''),
});

export const meilisearchClient = new MeiliSearch({
  host: aiConfig.meilisearch.url,
  apiKey: aiConfig.meilisearch.masterKey,
});

export const openaiClient = new OpenAI({
  apiKey: aiConfig.openai.apiKey,
});

export const huggingfaceClient = new HfInference(aiConfig.huggingface.apiKey);

// Weaviate schema initialization
export const initializeWeaviateSchema = async (): Promise<void> => {
  try {
    // Check if Content class exists
    const contentClassExists = await weaviateClient.schema
      .classGetter()
      .withClassName('Content')
      .do()
      .then(() => true)
      .catch(() => false);

    if (!contentClassExists) {
      // Create Content class for vector embeddings
      await weaviateClient.schema
        .classCreator()
        .withClass({
          class: 'Content',
          description: 'Content items with vector embeddings for semantic search',
          vectorizer: 'none', // We'll provide our own vectors
          properties: [
            {
              name: 'contentId',
              dataType: ['string'],
              description: 'Unique content identifier',
            },
            {
              name: 'title',
              dataType: ['string'],
              description: 'Content title',
            },
            {
              name: 'description',
              dataType: ['text'],
              description: 'Content description',
            },
            {
              name: 'tags',
              dataType: ['string[]'],
              description: 'Content tags',
            },
            {
              name: 'aiTags',
              dataType: ['string[]'],
              description: 'AI-generated tags',
            },
            {
              name: 'category',
              dataType: ['string'],
              description: 'Content category',
            },
            {
              name: 'creatorId',
              dataType: ['string'],
              description: 'Creator identifier',
            },
            {
              name: 'createdAt',
              dataType: ['date'],
              description: 'Creation timestamp',
            },
            {
              name: 'duration',
              dataType: ['number'],
              description: 'Content duration in seconds',
            },
            {
              name: 'viewCount',
              dataType: ['number'],
              description: 'View count for ranking',
            },
          ],
        })
        .do();

      console.log('✅ Weaviate Content class created successfully');
    }

    // Check if LeakFingerprint class exists
    const fingerprintClassExists = await weaviateClient.schema
      .classGetter()
      .withClassName('LeakFingerprint')
      .do()
      .then(() => true)
      .catch(() => false);

    if (!fingerprintClassExists) {
      // Create LeakFingerprint class for leak detection
      await weaviateClient.schema
        .classCreator()
        .withClass({
          class: 'LeakFingerprint',
          description: 'Video fingerprints for leak detection',
          vectorizer: 'none',
          properties: [
            {
              name: 'contentId',
              dataType: ['string'],
              description: 'Original content identifier',
            },
            {
              name: 'frameHashes',
              dataType: ['string[]'],
              description: 'Perceptual hashes of video frames',
            },
            {
              name: 'audioChroma',
              dataType: ['number[]'],
              description: 'Audio chromaprint features',
            },
            {
              name: 'duration',
              dataType: ['number'],
              description: 'Video duration in seconds',
            },
            {
              name: 'resolution',
              dataType: ['string'],
              description: 'Video resolution',
            },
            {
              name: 'createdAt',
              dataType: ['date'],
              description: 'Fingerprint creation timestamp',
            },
          ],
        })
        .do();

      console.log('✅ Weaviate LeakFingerprint class created successfully');
    }
  } catch (error) {
    console.error('❌ Error initializing Weaviate schema:', error);
    throw error;
  }
};

// Meilisearch index initialization
export const initializeMeilisearchIndexes = async (): Promise<void> => {
  try {
    // Create content index for hybrid search
    const contentIndex = meilisearchClient.index('content');
    
    // Configure searchable attributes
    await contentIndex.updateSearchableAttributes([
      'title',
      'description',
      'tags',
      'aiTags',
      'category',
      'creatorName',
    ]);

    // Configure filterable attributes
    await contentIndex.updateFilterableAttributes([
      'category',
      'creatorId',
      'createdAt',
      'duration',
      'viewCount',
      'ageRestricted',
    ]);

    // Configure sortable attributes
    await contentIndex.updateSortableAttributes([
      'createdAt',
      'viewCount',
      'duration',
    ]);

    // Configure ranking rules
    await contentIndex.updateRankingRules([
      'words',
      'typo',
      'proximity',
      'attribute',
      'sort',
      'exactness',
      'viewCount:desc',
    ]);

    console.log('✅ Meilisearch content index configured successfully');
  } catch (error) {
    console.error('❌ Error initializing Meilisearch indexes:', error);
    throw error;
  }
};