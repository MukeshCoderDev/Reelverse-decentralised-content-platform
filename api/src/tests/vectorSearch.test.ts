import { vectorSearchService } from '../services/ai/vectorSearchService';
import { processVectorIndexingJob } from '../services/ai/processors/vectorIndexingProcessor';
import { Job } from 'bull';

// Mock external dependencies
jest.mock('../config/ai', () => ({
  weaviateClient: {
    graphql: {
      get: jest.fn().mockReturnValue({
        withClassName: jest.fn().mockReturnThis(),
        withFields: jest.fn().mockReturnThis(),
        withNearVector: jest.fn().mockReturnThis(),
        withLimit: jest.fn().mockReturnThis(),
        withWhere: jest.fn().mockReturnThis(),
        do: jest.fn().mockResolvedValue({
          data: {
            Get: {
              Content: [
                {
                  contentId: 'test-content-1',
                  title: 'Test Content 1',
                  description: 'A test video',
                  tags: ['test', 'video'],
                  aiTags: ['blonde', 'bedroom'],
                  category: 'adult',
                  creatorId: 'creator-1',
                  createdAt: '2024-01-01T00:00:00Z',
                  duration: 300,
                  viewCount: 100,
                  _additional: { certainty: 0.85 }
                }
              ]
            }
          }
        })
      })
    },
    data: {
      creator: jest.fn().mockReturnValue({
        withClassName: jest.fn().mockReturnThis(),
        withId: jest.fn().mockReturnThis(),
        withVector: jest.fn().mockReturnThis(),
        withProperties: jest.fn().mockReturnThis(),
        do: jest.fn().mockResolvedValue({ id: 'test-id' })
      }),
      updater: jest.fn().mockReturnValue({
        withClassName: jest.fn().mockReturnThis(),
        withId: jest.fn().mockReturnThis(),
        withProperties: jest.fn().mockReturnThis(),
        do: jest.fn().mockResolvedValue({})
      }),
      deleter: jest.fn().mockReturnValue({
        withClassName: jest.fn().mockReturnThis(),
        withId: jest.fn().mockReturnThis(),
        do: jest.fn().mockResolvedValue({})
      }),
      getterById: jest.fn().mockReturnValue({
        withClassName: jest.fn().mockReturnThis(),
        withId: jest.fn().mockReturnThis(),
        withVector: jest.fn().mockReturnThis(),
        do: jest.fn().mockResolvedValue({
          vector: new Array(1536).fill(0.1)
        })
      })
    }
  },
  meilisearchClient: {
    index: jest.fn().mockReturnValue({
      search: jest.fn().mockResolvedValue({
        hits: [
          {
            id: 'test-content-1',
            contentId: 'test-content-1',
            title: 'Test Content 1',
            description: 'A test video',
            tags: ['test', 'video'],
            aiTags: ['blonde', 'bedroom'],
            category: 'adult',
            creatorId: 'creator-1',
            creatorName: 'Test Creator',
            createdAt: Date.now(),
            duration: 300,
            viewCount: 100,
            ageRestricted: true,
            _rankingScore: 0.15,
            _formatted: {
              title: 'Test <em>Content</em> 1',
              description: 'A test <em>video</em>'
            }
          }
        ]
      }),
      addDocuments: jest.fn().mockResolvedValue({ taskUid: 123 }),
      updateDocuments: jest.fn().mockResolvedValue({ taskUid: 124 }),
      deleteDocument: jest.fn().mockResolvedValue({ taskUid: 125 })
    })
  },
  openaiClient: {
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    }
  }
}));

jest.mock('../config/database', () => ({
  pool: {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockImplementation((sql, params) => {
        if (sql.includes('SELECT * FROM content')) {
          return {
            rows: [{
              id: 'test-content-1',
              title: 'Test Content 1',
              description: 'A test video',
              tags: ['test', 'video'],
              category: 'adult',
              creator_id: 'creator-1',
              creator_name: 'Test Creator',
              created_at: new Date(),
              duration: 300,
              view_count: 100,
              age_restricted: true
            }]
          };
        }
        if (sql.includes('SELECT tag FROM ai_tags')) {
          return {
            rows: [
              { tag: 'blonde' },
              { tag: 'bedroom' }
            ]
          };
        }
        return { rows: [] };
      }),
      release: jest.fn()
    })
  }
}));

describe('VectorSearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('semanticSearch', () => {
    it('should perform semantic search successfully', async () => {
      const query = 'blonde woman bedroom';
      const results = await vectorSearchService.semanticSearch(query);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      const firstResult = results[0];
      expect(firstResult).toHaveProperty('contentId');
      expect(firstResult).toHaveProperty('relevanceScore');
      expect(firstResult).toHaveProperty('matchedTags');
      expect(firstResult.relevanceScore).toBeGreaterThan(0);
    });

    it('should apply filters correctly', async () => {
      const query = 'test content';
      const filters = {
        category: 'adult',
        minDuration: 100,
        maxDuration: 500,
      };

      const results = await vectorSearchService.semanticSearch(query, filters);
      expect(results).toBeInstanceOf(Array);
    });

    it('should validate input parameters', async () => {
      await expect(
        vectorSearchService.semanticSearch('')
      ).rejects.toThrow();
    });
  });

  describe('hybridSearch', () => {
    it('should combine vector and keyword search results', async () => {
      const query = 'romantic bedroom';
      const results = await vectorSearchService.hybridSearch(query);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      // Results should have combined relevance scores
      const firstResult = results[0];
      expect(firstResult.relevanceScore).toBeGreaterThan(0);
      expect(firstResult.matchedTags).toBeInstanceOf(Array);
    });

    it('should handle empty results gracefully', async () => {
      // Mock empty results
      const mockWeaviate = require('../config/ai').weaviateClient;
      mockWeaviate.graphql.get().do.mockResolvedValueOnce({
        data: { Get: { Content: [] } }
      });

      const mockMeilisearch = require('../config/ai').meilisearchClient;
      mockMeilisearch.index().search.mockResolvedValueOnce({ hits: [] });

      const results = await vectorSearchService.hybridSearch('nonexistent query');
      expect(results).toEqual([]);
    });
  });

  describe('indexContent', () => {
    it('should index content in both Weaviate and Meilisearch', async () => {
      const contentId = 'test-content-123';
      const embedding = new Array(1536).fill(0.1);
      const metadata = {
        contentId,
        title: 'Test Content',
        description: 'A test video',
        tags: ['test'],
        aiTags: ['blonde'],
        category: 'adult',
        creatorId: 'creator-1',
        creatorName: 'Test Creator',
        createdAt: new Date(),
        duration: 300,
        viewCount: 100,
        ageRestricted: true,
      };

      await vectorSearchService.indexContent(contentId, embedding, metadata);

      // Verify Weaviate indexing was called
      const mockWeaviate = require('../config/ai').weaviateClient;
      expect(mockWeaviate.data.creator().withClassName).toHaveBeenCalledWith('Content');

      // Verify Meilisearch indexing was called
      const mockMeilisearch = require('../config/ai').meilisearchClient;
      expect(mockMeilisearch.index().addDocuments).toHaveBeenCalled();
    });

    it('should validate input parameters', async () => {
      await expect(
        vectorSearchService.indexContent('', [], {} as any)
      ).rejects.toThrow();
    });
  });

  describe('getSimilarContent', () => {
    it('should find similar content based on content ID', async () => {
      const contentId = 'test-content-1';
      const results = await vectorSearchService.getSimilarContent(contentId, 5);

      expect(results).toBeInstanceOf(Array);
      // Should not include the original content
      expect(results.every(r => r.contentId !== contentId)).toBe(true);
    });

    it('should handle content not found', async () => {
      const mockWeaviate = require('../config/ai').weaviateClient;
      mockWeaviate.data.getterById().do.mockResolvedValueOnce(null);

      await expect(
        vectorSearchService.getSimilarContent('nonexistent-content')
      ).rejects.toThrow('Content not found');
    });
  });

  describe('updateContentMetadata', () => {
    it('should update metadata in both indexes', async () => {
      const contentId = 'test-content-1';
      const metadata = { title: 'Updated Title', viewCount: 200 };

      await vectorSearchService.updateContentMetadata(contentId, metadata);

      const mockWeaviate = require('../config/ai').weaviateClient;
      expect(mockWeaviate.data.updater().withId).toHaveBeenCalledWith(contentId);

      const mockMeilisearch = require('../config/ai').meilisearchClient;
      expect(mockMeilisearch.index().updateDocuments).toHaveBeenCalled();
    });
  });

  describe('deleteContent', () => {
    it('should delete content from both indexes', async () => {
      const contentId = 'test-content-1';

      await vectorSearchService.deleteContent(contentId);

      const mockWeaviate = require('../config/ai').weaviateClient;
      expect(mockWeaviate.data.deleter().withId).toHaveBeenCalledWith(contentId);

      const mockMeilisearch = require('../config/ai').meilisearchClient;
      expect(mockMeilisearch.index().deleteDocument).toHaveBeenCalledWith(contentId);
    });
  });
});

describe('VectorIndexingProcessor', () => {
  it('should process vector indexing job successfully', async () => {
    const mockJob = {
      id: 'test-job-123',
      data: {
        contentId: 'test-content-789',
        embedding: new Array(1536).fill(0.1),
        metadata: { aiTags: ['test'] },
        jobId: 'test-job-123',
        operation: 'vector-indexing',
        priority: 'normal'
      },
      progress: jest.fn().mockResolvedValue(undefined)
    } as unknown as Job<any>;

    const result = await processVectorIndexingJob(mockJob);

    expect(result).toHaveProperty('contentId', 'test-content-789');
    expect(result).toHaveProperty('indexed', true);
    expect(result).toHaveProperty('vectorId');
    expect(mockJob.progress).toHaveBeenCalledWith(100);
  });

  it('should handle indexing errors', async () => {
    // Mock database error
    const mockPool = require('../config/database').pool;
    mockPool.connect.mockRejectedValueOnce(new Error('Database connection failed'));

    const mockJob = {
      id: 'test-job-error',
      data: {
        contentId: 'test-content-error',
        embedding: new Array(1536).fill(0.1),
        metadata: {},
        jobId: 'test-job-error',
        operation: 'vector-indexing',
        priority: 'normal'
      },
      progress: jest.fn().mockResolvedValue(undefined)
    } as unknown as Job<any>;

    await expect(processVectorIndexingJob(mockJob)).rejects.toThrow();
  });
});