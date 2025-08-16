import { publicApiService } from './publicApiService';

export interface ContentSearchQuery {
  query: string;
  filters?: {
    tags?: string[];
    categories?: string[];
    performers?: string[];
    duration?: {
      min?: number;
      max?: number;
    };
    rating?: {
      min?: number;
    };
    priceRange?: {
      min?: number;
      max?: number;
    };
  };
  sort?: 'relevance' | 'date' | 'popularity' | 'rating' | 'price';
  page?: number;
  limit?: number;
}

export interface ContentSearchResult {
  contentId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  previewUrl?: string;
  duration: number;
  rating: number;
  price: number;
  currency: string;
  tags: string[];
  categories: string[];
  performers: string[];
  createdAt: string;
  relevanceScore: number;
  isAvailable: boolean;
}

export interface SearchResponse {
  results: ContentSearchResult[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
  searchTime: number;
  suggestions?: string[];
}

export class ContentSearchApiService {
  /**
   * Search content with semantic and keyword matching
   */
  async searchContent(
    searchQuery: ContentSearchQuery, 
    organizationId?: string
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    
    // Validate search parameters
    this.validateSearchQuery(searchQuery);

    // Apply default pagination
    const page = searchQuery.page || 1;
    const limit = Math.min(searchQuery.limit || 20, 100); // Max 100 results per page
    
    // Mock search results - in real implementation, this would use vector search + Meilisearch
    const mockResults: ContentSearchResult[] = [
      {
        contentId: 'content_001',
        title: 'Sample Video Title 1',
        description: 'High-quality content with professional production',
        thumbnailUrl: 'https://cdn.example.com/thumbs/content_001.jpg',
        previewUrl: 'https://cdn.example.com/previews/content_001.mp4',
        duration: 1800, // 30 minutes
        rating: 4.8,
        price: 29.99,
        currency: 'USD',
        tags: ['premium', 'hd', 'professional'],
        categories: ['category1', 'category2'],
        performers: ['performer1', 'performer2'],
        createdAt: '2024-01-15T10:00:00Z',
        relevanceScore: 0.95,
        isAvailable: true
      },
      {
        contentId: 'content_002',
        title: 'Sample Video Title 2',
        description: 'Exclusive content from top creators',
        thumbnailUrl: 'https://cdn.example.com/thumbs/content_002.jpg',
        duration: 2400, // 40 minutes
        rating: 4.6,
        price: 39.99,
        currency: 'USD',
        tags: ['exclusive', '4k', 'trending'],
        categories: ['category2', 'category3'],
        performers: ['performer3'],
        createdAt: '2024-01-14T15:30:00Z',
        relevanceScore: 0.87,
        isAvailable: true
      }
    ];

    // Apply filters
    let filteredResults = this.applyFilters(mockResults, searchQuery.filters);
    
    // Apply sorting
    filteredResults = this.applySorting(filteredResults, searchQuery.sort || 'relevance');

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedResults = filteredResults.slice(startIndex, startIndex + limit);

    const searchTime = Date.now() - startTime;

    return {
      results: paginatedResults,
      totalCount: filteredResults.length,
      page,
      limit,
      hasMore: startIndex + limit < filteredResults.length,
      searchTime,
      suggestions: this.generateSearchSuggestions(searchQuery.query)
    };
  }

  /**
   * Get content details by ID
   */
  async getContentById(contentId: string, organizationId?: string): Promise<ContentSearchResult | null> {
    // Mock content lookup - in real implementation, query database
    if (contentId === 'content_001') {
      return {
        contentId: 'content_001',
        title: 'Sample Video Title 1',
        description: 'High-quality content with professional production. Extended description with more details about the content, performers, and production quality.',
        thumbnailUrl: 'https://cdn.example.com/thumbs/content_001.jpg',
        previewUrl: 'https://cdn.example.com/previews/content_001.mp4',
        duration: 1800,
        rating: 4.8,
        price: 29.99,
        currency: 'USD',
        tags: ['premium', 'hd', 'professional', 'verified'],
        categories: ['category1', 'category2'],
        performers: ['performer1', 'performer2'],
        createdAt: '2024-01-15T10:00:00Z',
        relevanceScore: 1.0,
        isAvailable: true
      };
    }
    
    return null;
  }

  /**
   * Get trending content
   */
  async getTrendingContent(limit: number = 20, organizationId?: string): Promise<ContentSearchResult[]> {
    // Mock trending content - in real implementation, use analytics data
    const trendingContent: ContentSearchResult[] = [
      {
        contentId: 'trending_001',
        title: 'Trending Video 1',
        description: 'Currently trending content',
        thumbnailUrl: 'https://cdn.example.com/thumbs/trending_001.jpg',
        duration: 1500,
        rating: 4.9,
        price: 24.99,
        currency: 'USD',
        tags: ['trending', 'popular', 'new'],
        categories: ['trending'],
        performers: ['top_performer'],
        createdAt: '2024-01-16T08:00:00Z',
        relevanceScore: 1.0,
        isAvailable: true
      }
    ];

    return trendingContent.slice(0, limit);
  }

  /**
   * Get content recommendations based on content ID
   */
  async getRecommendations(
    contentId: string, 
    limit: number = 10, 
    organizationId?: string
  ): Promise<ContentSearchResult[]> {
    // Mock recommendations - in real implementation, use vector similarity
    return [
      {
        contentId: 'rec_001',
        title: 'Recommended Content 1',
        description: 'Similar content you might enjoy',
        thumbnailUrl: 'https://cdn.example.com/thumbs/rec_001.jpg',
        duration: 1600,
        rating: 4.7,
        price: 27.99,
        currency: 'USD',
        tags: ['similar', 'recommended'],
        categories: ['category1'],
        performers: ['performer1'],
        createdAt: '2024-01-10T12:00:00Z',
        relevanceScore: 0.85,
        isAvailable: true
      }
    ].slice(0, limit);
  }

  /**
   * Validate search query parameters
   */
  private validateSearchQuery(query: ContentSearchQuery): void {
    if (!query.query || query.query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }

    if (query.query.length > 500) {
      throw new Error('Search query too long (max 500 characters)');
    }

    if (query.page && query.page < 1) {
      throw new Error('Page number must be positive');
    }

    if (query.limit && (query.limit < 1 || query.limit > 100)) {
      throw new Error('Limit must be between 1 and 100');
    }
  }

  /**
   * Apply filters to search results
   */
  private applyFilters(
    results: ContentSearchResult[], 
    filters?: ContentSearchQuery['filters']
  ): ContentSearchResult[] {
    if (!filters) return results;

    return results.filter(result => {
      // Tag filters
      if (filters.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(tag => 
          result.tags.includes(tag.toLowerCase())
        );
        if (!hasMatchingTag) return false;
      }

      // Category filters
      if (filters.categories && filters.categories.length > 0) {
        const hasMatchingCategory = filters.categories.some(category => 
          result.categories.includes(category.toLowerCase())
        );
        if (!hasMatchingCategory) return false;
      }

      // Duration filters
      if (filters.duration) {
        if (filters.duration.min && result.duration < filters.duration.min) return false;
        if (filters.duration.max && result.duration > filters.duration.max) return false;
      }

      // Rating filters
      if (filters.rating?.min && result.rating < filters.rating.min) return false;

      // Price filters
      if (filters.priceRange) {
        if (filters.priceRange.min && result.price < filters.priceRange.min) return false;
        if (filters.priceRange.max && result.price > filters.priceRange.max) return false;
      }

      return true;
    });
  }

  /**
   * Apply sorting to search results
   */
  private applySorting(
    results: ContentSearchResult[], 
    sort: string
  ): ContentSearchResult[] {
    switch (sort) {
      case 'date':
        return results.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case 'popularity':
        return results.sort((a, b) => b.rating - a.rating);
      case 'rating':
        return results.sort((a, b) => b.rating - a.rating);
      case 'price':
        return results.sort((a, b) => a.price - b.price);
      case 'relevance':
      default:
        return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
  }

  /**
   * Generate search suggestions
   */
  private generateSearchSuggestions(query: string): string[] {
    // Mock suggestions - in real implementation, use search analytics
    const suggestions = [
      `${query} hd`,
      `${query} premium`,
      `${query} new`,
      `${query} trending`
    ];

    return suggestions.slice(0, 3);
  }
}

export const contentSearchApiService = new ContentSearchApiService();