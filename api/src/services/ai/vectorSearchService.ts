import { BaseAIService, SearchResult, SearchFilters, AIServiceError } from './baseAIService';
import { weaviateClient, meilisearchClient } from '../../config/ai';
import { logger } from '../../utils/logger';
import { openaiClient } from '../../config/ai';

export interface VectorSearchConfig {
  maxResults: number;
  similarityThreshold: number;
  hybridWeight: {
    vector: number;
    keyword: number;
  };
  boostFactors: {
    viewCount: number;
    recency: number;
    creatorPopularity: number;
  };
}

export interface ContentMetadata {
  contentId: string;
  title: string;
  description: string;
  tags: string[];
  aiTags: string[];
  category: string;
  creatorId: string;
  creatorName: string;
  createdAt: Date;
  duration: number;
  viewCount: number;
  ageRestricted: boolean;
}

export class VectorSearchService extends BaseAIService {
  private config: VectorSearchConfig;

  constructor() {
    super('VectorSearchService');
    this.config = {
      maxResults: 50,
      similarityThreshold: 0.7,
      hybridWeight: {
        vector: 0.6,
        keyword: 0.4,
      },
      boostFactors: {
        viewCount: 0.2,
        recency: 0.1,
        creatorPopularity: 0.1,
      },
    };
  }

  /**
   * Perform semantic search using vector embeddings
   */
  public async semanticSearch(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    this.validateInput(query, 'query');
    this.logOperation('semanticSearch', { query, filters });

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateQueryEmbedding(query);

      // Search in Weaviate
      const vectorResults = await this.searchWeaviate(queryEmbedding, filters);

      // Apply post-processing and ranking
      const rankedResults = await this.rankResults(vectorResults, query, filters);

      this.logOperation('semanticSearch completed', {
        query,
        resultCount: rankedResults.length,
        topScore: rankedResults[0]?.relevanceScore || 0,
      });

      return rankedResults;
    } catch (error) {
      this.logError('semanticSearch', error as Error, { query, filters });
      throw error;
    }
  }

  /**
   * Perform hybrid search combining vector similarity and keyword search
   */
  public async hybridSearch(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    this.validateInput(query, 'query');
    this.logOperation('hybridSearch', { query, filters });

    try {
      // Perform both searches in parallel
      const [vectorResults, keywordResults] = await Promise.all([
        this.semanticSearch(query, filters),
        this.keywordSearch(query, filters),
      ]);

      // Combine and re-rank results
      const combinedResults = this.combineSearchResults(vectorResults, keywordResults);

      this.logOperation('hybridSearch completed', {
        query,
        vectorResults: vectorResults.length,
        keywordResults: keywordResults.length,
        combinedResults: combinedResults.length,
      });

      return combinedResults;
    } catch (error) {
      this.logError('hybridSearch', error as Error, { query, filters });
      throw error;
    }
  }

  /**
   * Index content with vector embeddings
   */
  public async indexContent(contentId: string, embedding: number[], metadata: ContentMetadata): Promise<void> {
    this.validateInput(contentId, 'contentId');
    this.validateInput(embedding, 'embedding');
    this.validateInput(metadata, 'metadata');

    this.logOperation('indexContent', { contentId, embeddingDimensions: embedding.length });

    try {
      // Index in Weaviate for vector search
      await this.indexInWeaviate(contentId, embedding, metadata);

      // Index in Meilisearch for keyword search
      await this.indexInMeilisearch(contentId, metadata);

      this.logOperation('indexContent completed', { contentId });
    } catch (error) {
      this.logError('indexContent', error as Error, { contentId });
      throw error;
    }
  }

  /**
   * Get similar content based on content ID
   */
  public async getSimilarContent(contentId: string, limit: number = 10): Promise<SearchResult[]> {
    this.validateInput(contentId, 'contentId');

    try {
      // Get the content's embedding from Weaviate
      const contentData = await weaviateClient.data
        .getterById()
        .withClassName('Content')
        .withId(contentId)
        .withVector()
        .do();

      if (!contentData || !contentData.vector) {
        throw new AIServiceError('Content not found or no embedding available', 'CONTENT_NOT_FOUND');
      }

      // Find similar content using the embedding
      const results = await weaviateClient.graphql
        .get()
        .withClassName('Content')
        .withFields('contentId title description tags aiTags category creatorId createdAt duration viewCount')
        .withNearVector({
          vector: contentData.vector,
          certainty: this.config.similarityThreshold,
        })
        .withLimit(limit + 1) // +1 to exclude the original content
        .do();

      const searchResults = this.formatWeaviateResults(results);
      
      // Remove the original content from results
      return searchResults.filter(result => result.contentId !== contentId);
    } catch (error) {
      this.logError('getSimilarContent', error as Error, { contentId });
      throw error;
    }
  }

  /**
   * Update content metadata in search indexes
   */
  public async updateContentMetadata(contentId: string, metadata: Partial<ContentMetadata>): Promise<void> {
    this.validateInput(contentId, 'contentId');

    try {
      // Update in Weaviate
      await weaviateClient.data
        .updater()
        .withClassName('Content')
        .withId(contentId)
        .withProperties(metadata)
        .do();

      // Update in Meilisearch
      await meilisearchClient.index('content').updateDocuments([{
        id: contentId,
        ...metadata,
      }]);

      this.logOperation('updateContentMetadata completed', { contentId });
    } catch (error) {
      this.logError('updateContentMetadata', error as Error, { contentId });
      throw error;
    }
  }

  /**
   * Delete content from search indexes
   */
  public async deleteContent(contentId: string): Promise<void> {
    this.validateInput(contentId, 'contentId');

    try {
      // Delete from Weaviate
      await weaviateClient.data
        .deleter()
        .withClassName('Content')
        .withId(contentId)
        .do();

      // Delete from Meilisearch
      await meilisearchClient.index('content').deleteDocument(contentId);

      this.logOperation('deleteContent completed', { contentId });
    } catch (error) {
      this.logError('deleteContent', error as Error, { contentId });
      throw error;
    }
  }

  private async generateQueryEmbedding(query: string): Promise<number[]> {
    return await this.withRetry(async () => {
      const response = await openaiClient.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });

      return response.data[0].embedding;
    });
  }

  private async searchWeaviate(embedding: number[], filters?: SearchFilters): Promise<SearchResult[]> {
    let query = weaviateClient.graphql
      .get()
      .withClassName('Content')
      .withFields('contentId title description tags aiTags category creatorId createdAt duration viewCount')
      .withNearVector({
        vector: embedding,
        certainty: this.config.similarityThreshold,
      })
      .withLimit(this.config.maxResults);

    // Apply filters
    if (filters) {
      const whereFilter = this.buildWeaviateFilter(filters);
      if (whereFilter) {
        query = query.withWhere(whereFilter);
      }
    }

    const results = await query.do();
    return this.formatWeaviateResults(results);
  }

  private async keywordSearch(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    const searchParams: any = {
      q: query,
      limit: this.config.maxResults,
      attributesToHighlight: ['title', 'description', 'tags'],
    };

    // Apply filters
    if (filters) {
      const filterString = this.buildMeilisearchFilter(filters);
      if (filterString) {
        searchParams.filter = filterString;
      }
    }

    const results = await meilisearchClient.index('content').search(query, searchParams);
    return this.formatMeilisearchResults(results);
  }

  private combineSearchResults(vectorResults: SearchResult[], keywordResults: SearchResult[]): SearchResult[] {
    const resultMap = new Map<string, SearchResult>();
    
    // Add vector results with weighted scores
    vectorResults.forEach(result => {
      resultMap.set(result.contentId, {
        ...result,
        relevanceScore: result.relevanceScore * this.config.hybridWeight.vector,
      });
    });

    // Combine with keyword results
    keywordResults.forEach(result => {
      const existing = resultMap.get(result.contentId);
      if (existing) {
        // Combine scores
        existing.relevanceScore += result.relevanceScore * this.config.hybridWeight.keyword;
        existing.matchedTags = [...new Set([...existing.matchedTags, ...result.matchedTags])];
        if (result.snippet) {
          existing.snippet = result.snippet;
        }
      } else {
        // Add new result
        resultMap.set(result.contentId, {
          ...result,
          relevanceScore: result.relevanceScore * this.config.hybridWeight.keyword,
        });
      }
    });

    // Sort by combined relevance score
    return Array.from(resultMap.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, this.config.maxResults);
  }

  private async rankResults(results: SearchResult[], query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    // Apply business logic ranking boosts
    const now = Date.now();
    
    return results.map(result => {
      let boostedScore = result.relevanceScore;
      
      // View count boost
      if (result.metadata?.viewCount) {
        const viewBoost = Math.log(result.metadata.viewCount + 1) / 100;
        boostedScore += viewBoost * this.config.boostFactors.viewCount;
      }
      
      // Recency boost
      if (result.metadata?.createdAt) {
        const ageInDays = (now - new Date(result.metadata.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        const recencyBoost = Math.max(0, 1 - ageInDays / 365); // Decay over a year
        boostedScore += recencyBoost * this.config.boostFactors.recency;
      }
      
      return {
        ...result,
        relevanceScore: boostedScore,
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private async indexInWeaviate(contentId: string, embedding: number[], metadata: ContentMetadata): Promise<void> {
    await weaviateClient.data
      .creator()
      .withClassName('Content')
      .withId(contentId)
      .withVector(embedding)
      .withProperties({
        contentId: metadata.contentId,
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        aiTags: metadata.aiTags,
        category: metadata.category,
        creatorId: metadata.creatorId,
        createdAt: metadata.createdAt.toISOString(),
        duration: metadata.duration,
        viewCount: metadata.viewCount,
      })
      .do();
  }

  private async indexInMeilisearch(contentId: string, metadata: ContentMetadata): Promise<void> {
    await meilisearchClient.index('content').addDocuments([{
      id: contentId,
      contentId: metadata.contentId,
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      aiTags: metadata.aiTags,
      category: metadata.category,
      creatorId: metadata.creatorId,
      creatorName: metadata.creatorName,
      createdAt: metadata.createdAt.getTime(),
      duration: metadata.duration,
      viewCount: metadata.viewCount,
      ageRestricted: metadata.ageRestricted,
    }]);
  }

  private buildWeaviateFilter(filters: SearchFilters): any {
    const conditions: any[] = [];

    if (filters.category) {
      conditions.push({
        path: ['category'],
        operator: 'Equal',
        valueText: filters.category,
      });
    }

    if (filters.creatorId) {
      conditions.push({
        path: ['creatorId'],
        operator: 'Equal',
        valueText: filters.creatorId,
      });
    }

    if (filters.minDuration || filters.maxDuration) {
      if (filters.minDuration) {
        conditions.push({
          path: ['duration'],
          operator: 'GreaterThanEqual',
          valueNumber: filters.minDuration,
        });
      }
      if (filters.maxDuration) {
        conditions.push({
          path: ['duration'],
          operator: 'LessThanEqual',
          valueNumber: filters.maxDuration,
        });
      }
    }

    if (filters.dateRange) {
      conditions.push({
        path: ['createdAt'],
        operator: 'GreaterThanEqual',
        valueDate: filters.dateRange.start.toISOString(),
      });
      conditions.push({
        path: ['createdAt'],
        operator: 'LessThanEqual',
        valueDate: filters.dateRange.end.toISOString(),
      });
    }

    return conditions.length > 0 ? { operator: 'And', operands: conditions } : null;
  }

  private buildMeilisearchFilter(filters: SearchFilters): string {
    const conditions: string[] = [];

    if (filters.category) {
      conditions.push(`category = "${filters.category}"`);
    }

    if (filters.creatorId) {
      conditions.push(`creatorId = "${filters.creatorId}"`);
    }

    if (filters.minDuration) {
      conditions.push(`duration >= ${filters.minDuration}`);
    }

    if (filters.maxDuration) {
      conditions.push(`duration <= ${filters.maxDuration}`);
    }

    if (filters.ageRestricted !== undefined) {
      conditions.push(`ageRestricted = ${filters.ageRestricted}`);
    }

    if (filters.dateRange) {
      conditions.push(`createdAt >= ${filters.dateRange.start.getTime()}`);
      conditions.push(`createdAt <= ${filters.dateRange.end.getTime()}`);
    }

    return conditions.join(' AND ');
  }

  private formatWeaviateResults(results: any): SearchResult[] {
    if (!results?.data?.Get?.Content) {
      return [];
    }

    return results.data.Get.Content.map((item: any) => ({
      contentId: item.contentId,
      relevanceScore: item._additional?.certainty || 0,
      matchedTags: [...(item.tags || []), ...(item.aiTags || [])],
      metadata: {
        title: item.title,
        description: item.description,
        category: item.category,
        creatorId: item.creatorId,
        createdAt: item.createdAt,
        duration: item.duration,
        viewCount: item.viewCount,
      },
    }));
  }

  private formatMeilisearchResults(results: any): SearchResult[] {
    if (!results?.hits) {
      return [];
    }

    return results.hits.map((hit: any) => ({
      contentId: hit.contentId,
      relevanceScore: 1 - (hit._rankingScore || 0), // Convert ranking score to relevance
      matchedTags: [...(hit.tags || []), ...(hit.aiTags || [])],
      snippet: this.extractSnippet(hit._formatted),
      metadata: {
        title: hit.title,
        description: hit.description,
        category: hit.category,
        creatorId: hit.creatorId,
        creatorName: hit.creatorName,
        createdAt: new Date(hit.createdAt),
        duration: hit.duration,
        viewCount: hit.viewCount,
        ageRestricted: hit.ageRestricted,
      },
    }));
  }

  private extractSnippet(formatted: any): string {
    if (!formatted) return '';
    
    const snippetParts: string[] = [];
    
    if (formatted.title) {
      snippetParts.push(formatted.title);
    }
    
    if (formatted.description) {
      snippetParts.push(formatted.description.substring(0, 200));
    }
    
    return snippetParts.join(' - ');
  }
}

// Export singleton instance
export const vectorSearchService = new VectorSearchService();