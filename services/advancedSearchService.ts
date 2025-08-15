import { VectorSearchService } from './vectorSearchService';
import { MeiliSearch } from 'meilisearch';

interface SearchQuery {
  query: string;
  userId?: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
  personalizeResults?: boolean;
}

interface SearchFilters {
  category?: string[];
  tags?: string[];
  performers?: string[];
  duration?: { min?: number; max?: number };
  priceRange?: { min?: number; max?: number };
  uploadDate?: { from?: Date; to?: Date };
  verified?: boolean;
  premium?: boolean;
}

interface SearchResult {
  contentId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  category: string;
  tags: string[];
  performers: string[];
  duration: number;
  price: number;
  uploadDate: Date;
  verified: boolean;
  premium: boolean;
  
  // Ranking signals
  relevanceScore: number;
  popularityScore: number;
  qualityScore: number;
  personalizedScore?: number;
  
  // Engagement metrics
  viewCount: number;
  likeCount: number;
  purchaseCount: number;
  averageRating: number;
  
  // Ranking explanation
  rankingFactors: RankingFactor[];
}

interface RankingFactor {
  factor: string;
  weight: number;
  score: number;
  explanation: string;
}

interface UserInteraction {
  userId: string;
  contentId: string;
  interactionType: 'view' | 'click' | 'purchase' | 'like' | 'share' | 'dwell';
  timestamp: Date;
  dwellTime?: number;
  sessionId: string;
  metadata?: Record<string, any>;
}

interface PersonalizationProfile {
  userId: string;
  preferences: {
    categories: Record<string, number>;
    tags: Record<string, number>;
    performers: Record<string, number>;
    priceRange: { min: number; max: number };
    contentLength: 'short' | 'medium' | 'long' | 'any';
  };
  behaviorSignals: {
    averageDwellTime: number;
    purchaseRate: number;
    engagementRate: number;
    sessionDuration: number;
  };
  lastUpdated: Date;
}

interface BanditArm {
  armId: string;
  algorithm: 'bm25' | 'vector' | 'popularity' | 'personalized' | 'hybrid';
  weight: number;
  pulls: number;
  rewards: number;
  averageReward: number;
  confidence: number;
}

export class AdvancedSearchService {
  private vectorSearch: VectorSearchService;
  private meilisearch: MeiliSearch;
  private banditArms: Map<string, BanditArm> = new Map();
  private readonly EXPLORATION_RATE = 0.1;
  private readonly CONFIDENCE_THRESHOLD = 0.95;

  constructor() {
    this.vectorSearch = new VectorSearchService();
    this.meilisearch = new MeiliSearch({
      host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
      apiKey: process.env.MEILISEARCH_API_KEY
    });
    
    this.initializeBanditArms();
  }

  /**
   * Advanced hybrid search with personalization and bandit optimization
   */
  async search(searchQuery: SearchQuery): Promise<{
    results: SearchResult[];
    totalCount: number;
    facets: Record<string, Record<string, number>>;
    algorithmUsed: string;
    personalizedResults: boolean;
    rankingTransparency: RankingTransparency;
  }> {
    const { query, userId, filters, limit = 20, offset = 0, personalizeResults = true } = searchQuery;

    try {
      // Get user personalization profile if available
      const userProfile = userId && personalizeResults 
        ? await this.getUserProfile(userId) 
        : null;

      // Select algorithm using multi-armed bandit
      const selectedArm = await this.selectBanditArm(userId, query);
      
      // Execute search based on selected algorithm
      let results: SearchResult[];
      let totalCount: number;
      
      switch (selectedArm.algorithm) {
        case 'hybrid':
          ({ results, totalCount } = await this.hybridSearch(query, filters, userProfile, limit, offset));
          break;
        case 'vector':
          ({ results, totalCount } = await this.vectorOnlySearch(query, filters, limit, offset));
          break;
        case 'bm25':
          ({ results, totalCount } = await this.keywordOnlySearch(query, filters, limit, offset));
          break;
        case 'popularity':
          ({ results, totalCount } = await this.popularityBasedSearch(query, filters, limit, offset));
          break;
        case 'personalized':
          ({ results, totalCount } = await this.personalizedSearch(query, filters, userProfile, limit, offset));
          break;
        default:
          ({ results, totalCount } = await this.hybridSearch(query, filters, userProfile, limit, offset));
      }

      // Apply final ranking and personalization
      if (userProfile && personalizeResults) {
        results = await this.applyPersonalization(results, userProfile);
      }

      // Generate facets for filtering
      const facets = await this.generateFacets(query, filters);

      // Create ranking transparency information
      const rankingTransparency = this.generateRankingTransparency(
        selectedArm.algorithm,
        results,
        userProfile
      );

      return {
        results,
        totalCount,
        facets,
        algorithmUsed: selectedArm.algorithm,
        personalizedResults: !!userProfile,
        rankingTransparency
      };
    } catch (error) {
      console.error('Error in advanced search:', error);
      throw new Error('Search failed');
    }
  }

  /**
   * Hybrid search combining BM25, vector similarity, and popularity signals
   */
  private async hybridSearch(
    query: string,
    filters?: SearchFilters,
    userProfile?: PersonalizationProfile,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ results: SearchResult[]; totalCount: number }> {
    // Execute parallel searches
    const [keywordResults, vectorResults, popularityResults] = await Promise.all([
      this.keywordOnlySearch(query, filters, limit * 2, 0),
      this.vectorOnlySearch(query, filters, limit * 2, 0),
      this.popularityBasedSearch(query, filters, limit * 2, 0)
    ]);

    // Combine and rerank results
    const combinedResults = this.combineSearchResults([
      { results: keywordResults.results, weight: 0.4, source: 'bm25' },
      { results: vectorResults.results, weight: 0.4, source: 'vector' },
      { results: popularityResults.results, weight: 0.2, source: 'popularity' }
    ]);

    // Apply machine learning ranking model
    const rankedResults = await this.applyMLRanking(combinedResults, query, userProfile);

    // Apply pagination
    const paginatedResults = rankedResults.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      totalCount: rankedResults.length
    };
  }

  /**
   * Vector-only semantic search
   */
  private async vectorOnlySearch(
    query: string,
    filters?: SearchFilters,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ results: SearchResult[]; totalCount: number }> {
    const vectorResults = await this.vectorSearch.semanticSearch(query, filters);
    
    const results = vectorResults.map(result => ({
      ...result,
      relevanceScore: result.relevanceScore,
      popularityScore: 0.5, // Default popularity
      qualityScore: 0.7, // Default quality
      rankingFactors: [
        {
          factor: 'Semantic Similarity',
          weight: 1.0,
          score: result.relevanceScore,
          explanation: 'Content semantically matches your search query'
        }
      ]
    })) as SearchResult[];

    return {
      results: results.slice(offset, offset + limit),
      totalCount: results.length
    };
  }

  /**
   * Keyword-only BM25 search
   */
  private async keywordOnlySearch(
    query: string,
    filters?: SearchFilters,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ results: SearchResult[]; totalCount: number }> {
    const searchParams: any = {
      q: query,
      limit,
      offset,
      attributesToRetrieve: ['*'],
      attributesToHighlight: ['title', 'description', 'tags'],
      showMatchesPosition: true
    };

    if (filters) {
      searchParams.filter = this.buildMeilisearchFilters(filters);
    }

    const meilisearchResults = await this.meilisearch.index('content').search(query, searchParams);
    
    const results = meilisearchResults.hits.map((hit: any) => ({
      ...hit,
      relevanceScore: hit._rankingScore || 0.5,
      popularityScore: 0.5,
      qualityScore: 0.7,
      rankingFactors: [
        {
          factor: 'Keyword Match',
          weight: 1.0,
          score: hit._rankingScore || 0.5,
          explanation: 'Content matches your search keywords'
        }
      ]
    })) as SearchResult[];

    return {
      results,
      totalCount: meilisearchResults.estimatedTotalHits || results.length
    };
  }

  /**
   * Popularity-based search
   */
  private async popularityBasedSearch(
    query: string,
    filters?: SearchFilters,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ results: SearchResult[]; totalCount: number }> {
    // This would typically query a database ordered by popularity metrics
    // For now, we'll use Meilisearch with popularity sorting
    const searchParams: any = {
      q: query || '',
      limit,
      offset,
      sort: ['viewCount:desc', 'purchaseCount:desc', 'averageRating:desc'],
      attributesToRetrieve: ['*']
    };

    if (filters) {
      searchParams.filter = this.buildMeilisearchFilters(filters);
    }

    const meilisearchResults = await this.meilisearch.index('content').search(query || '', searchParams);
    
    const results = meilisearchResults.hits.map((hit: any) => ({
      ...hit,
      relevanceScore: 0.3,
      popularityScore: this.calculatePopularityScore(hit),
      qualityScore: hit.averageRating / 5.0,
      rankingFactors: [
        {
          factor: 'Popularity',
          weight: 1.0,
          score: this.calculatePopularityScore(hit),
          explanation: 'Content is popular among users'
        }
      ]
    })) as SearchResult[];

    return {
      results,
      totalCount: meilisearchResults.estimatedTotalHits || results.length
    };
  }

  /**
   * Personalized search based on user profile
   */
  private async personalizedSearch(
    query: string,
    filters?: SearchFilters,
    userProfile?: PersonalizationProfile,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ results: SearchResult[]; totalCount: number }> {
    if (!userProfile) {
      return this.hybridSearch(query, filters, undefined, limit, offset);
    }

    // Start with hybrid search
    const { results } = await this.hybridSearch(query, filters, userProfile, limit * 3, 0);

    // Apply strong personalization
    const personalizedResults = results.map(result => ({
      ...result,
      personalizedScore: this.calculatePersonalizationScore(result, userProfile),
      rankingFactors: [
        ...result.rankingFactors,
        {
          factor: 'Personalization',
          weight: 0.6,
          score: this.calculatePersonalizationScore(result, userProfile),
          explanation: 'Content matches your preferences and behavior'
        }
      ]
    }));

    // Sort by personalized score
    personalizedResults.sort((a, b) => (b.personalizedScore || 0) - (a.personalizedScore || 0));

    return {
      results: personalizedResults.slice(offset, offset + limit),
      totalCount: personalizedResults.length
    };
  }

  /**
   * Track user interactions for personalization and bandit optimization
   */
  async trackInteraction(interaction: UserInteraction): Promise<void> {
    try {
      // Store interaction in database
      await this.storeInteraction(interaction);

      // Update user profile
      if (interaction.userId) {
        await this.updateUserProfile(interaction);
      }

      // Update bandit arm rewards
      await this.updateBanditRewards(interaction);

      // Update dwell time analytics
      if (interaction.interactionType === 'dwell' && interaction.dwellTime) {
        await this.updateDwellTimeAnalytics(interaction);
      }
    } catch (error) {
      console.error('Error tracking interaction:', error);
    }
  }

  /**
   * Get personalized content recommendations
   */
  async getPersonalizedRecommendations(
    userId: string,
    limit: number = 10,
    excludeContentIds: string[] = []
  ): Promise<SearchResult[]> {
    try {
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) {
        return this.getPopularContent(limit);
      }

      // Get content based on user preferences
      const preferredCategories = Object.entries(userProfile.preferences.categories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([category]) => category);

      const preferredTags = Object.entries(userProfile.preferences.tags)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([tag]) => tag);

      // Build recommendation query
      const filters: SearchFilters = {
        category: preferredCategories,
        tags: preferredTags
      };

      // Get recommendations using personalized search
      const { results } = await this.personalizedSearch('', filters, userProfile, limit * 2, 0);

      // Filter out excluded content
      const filteredResults = results.filter(result => 
        !excludeContentIds.includes(result.contentId)
      );

      return filteredResults.slice(0, limit);
    } catch (error) {
      console.error('Error getting personalized recommendations:', error);
      return this.getPopularContent(limit);
    }
  }

  /**
   * Get trending content based on recent engagement
   */
  async getTrendingContent(
    timeframe: '1h' | '24h' | '7d' = '24h',
    limit: number = 20
  ): Promise<SearchResult[]> {
    try {
      // Calculate trending score based on recent interactions
      const trendingResults = await this.calculateTrendingScores(timeframe);
      
      // Sort by trending score
      trendingResults.sort((a, b) => b.trendingScore - a.trendingScore);

      return trendingResults.slice(0, limit);
    } catch (error) {
      console.error('Error getting trending content:', error);
      return [];
    }
  }

  // Private helper methods
  private initializeBanditArms(): void {
    const algorithms = ['hybrid', 'vector', 'bm25', 'popularity', 'personalized'];
    
    algorithms.forEach(algorithm => {
      this.banditArms.set(algorithm, {
        armId: algorithm,
        algorithm: algorithm as any,
        weight: 1.0 / algorithms.length,
        pulls: 0,
        rewards: 0,
        averageReward: 0,
        confidence: 0
      });
    });
  }

  private async selectBanditArm(userId?: string, query?: string): Promise<BanditArm> {
    // Use epsilon-greedy strategy for exploration vs exploitation
    if (Math.random() < this.EXPLORATION_RATE) {
      // Exploration: random selection
      const arms = Array.from(this.banditArms.values());
      return arms[Math.floor(Math.random() * arms.length)];
    } else {
      // Exploitation: select best performing arm
      const arms = Array.from(this.banditArms.values());
      return arms.reduce((best, current) => 
        current.averageReward > best.averageReward ? current : best
      );
    }
  }

  private combineSearchResults(sources: Array<{
    results: SearchResult[];
    weight: number;
    source: string;
  }>): SearchResult[] {
    const combinedMap = new Map<string, SearchResult>();

    sources.forEach(({ results, weight, source }) => {
      results.forEach((result, index) => {
        const existing = combinedMap.get(result.contentId);
        const positionScore = 1 / (index + 1); // Higher score for better positions
        const weightedScore = result.relevanceScore * weight * positionScore;

        if (existing) {
          existing.relevanceScore = Math.max(existing.relevanceScore, weightedScore);
          existing.rankingFactors.push({
            factor: `${source} Match`,
            weight,
            score: weightedScore,
            explanation: `Found via ${source} search`
          });
        } else {
          combinedMap.set(result.contentId, {
            ...result,
            relevanceScore: weightedScore,
            rankingFactors: [
              {
                factor: `${source} Match`,
                weight,
                score: weightedScore,
                explanation: `Found via ${source} search`
              }
            ]
          });
        }
      });
    });

    return Array.from(combinedMap.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private async applyMLRanking(
    results: SearchResult[],
    query: string,
    userProfile?: PersonalizationProfile
  ): Promise<SearchResult[]> {
    // Apply machine learning ranking model
    // This would typically use a trained model to rerank results
    return results.map(result => ({
      ...result,
      relevanceScore: this.calculateFinalScore(result, query, userProfile)
    })).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private calculateFinalScore(
    result: SearchResult,
    query: string,
    userProfile?: PersonalizationProfile
  ): number {
    let score = result.relevanceScore * 0.4;
    score += result.popularityScore * 0.3;
    score += result.qualityScore * 0.2;
    
    if (userProfile && result.personalizedScore) {
      score += result.personalizedScore * 0.1;
    }

    return Math.min(score, 1.0);
  }

  private async applyPersonalization(
    results: SearchResult[],
    userProfile: PersonalizationProfile
  ): Promise<SearchResult[]> {
    return results.map(result => ({
      ...result,
      personalizedScore: this.calculatePersonalizationScore(result, userProfile)
    }));
  }

  private calculatePersonalizationScore(
    result: SearchResult,
    userProfile: PersonalizationProfile
  ): number {
    let score = 0;

    // Category preference
    const categoryScore = userProfile.preferences.categories[result.category] || 0;
    score += categoryScore * 0.3;

    // Tag preferences
    const tagScores = result.tags.map(tag => 
      userProfile.preferences.tags[tag] || 0
    );
    const avgTagScore = tagScores.length > 0 
      ? tagScores.reduce((sum, s) => sum + s, 0) / tagScores.length 
      : 0;
    score += avgTagScore * 0.3;

    // Performer preferences
    const performerScores = result.performers.map(performer => 
      userProfile.preferences.performers[performer] || 0
    );
    const avgPerformerScore = performerScores.length > 0 
      ? performerScores.reduce((sum, s) => sum + s, 0) / performerScores.length 
      : 0;
    score += avgPerformerScore * 0.2;

    // Price preference
    const priceInRange = result.price >= userProfile.preferences.priceRange.min &&
                        result.price <= userProfile.preferences.priceRange.max;
    score += priceInRange ? 0.1 : 0;

    // Content length preference
    const lengthMatch = this.matchesLengthPreference(result.duration, userProfile.preferences.contentLength);
    score += lengthMatch ? 0.1 : 0;

    return Math.min(score, 1.0);
  }

  private calculatePopularityScore(content: any): number {
    const viewWeight = 0.3;
    const purchaseWeight = 0.4;
    const ratingWeight = 0.3;

    const normalizedViews = Math.min(content.viewCount / 10000, 1.0);
    const normalizedPurchases = Math.min(content.purchaseCount / 1000, 1.0);
    const normalizedRating = content.averageRating / 5.0;

    return (normalizedViews * viewWeight) + 
           (normalizedPurchases * purchaseWeight) + 
           (normalizedRating * ratingWeight);
  }

  private matchesLengthPreference(duration: number, preference: string): boolean {
    switch (preference) {
      case 'short': return duration <= 5;
      case 'medium': return duration > 5 && duration <= 20;
      case 'long': return duration > 20;
      case 'any': return true;
      default: return true;
    }
  }

  private buildMeilisearchFilters(filters: SearchFilters): string[] {
    const filterArray: string[] = [];

    if (filters.category?.length) {
      filterArray.push(`category IN [${filters.category.map(c => `"${c}"`).join(', ')}]`);
    }

    if (filters.tags?.length) {
      filterArray.push(`tags IN [${filters.tags.map(t => `"${t}"`).join(', ')}]`);
    }

    if (filters.performers?.length) {
      filterArray.push(`performers IN [${filters.performers.map(p => `"${p}"`).join(', ')}]`);
    }

    if (filters.duration) {
      if (filters.duration.min !== undefined) {
        filterArray.push(`duration >= ${filters.duration.min}`);
      }
      if (filters.duration.max !== undefined) {
        filterArray.push(`duration <= ${filters.duration.max}`);
      }
    }

    if (filters.priceRange) {
      if (filters.priceRange.min !== undefined) {
        filterArray.push(`price >= ${filters.priceRange.min}`);
      }
      if (filters.priceRange.max !== undefined) {
        filterArray.push(`price <= ${filters.priceRange.max}`);
      }
    }

    if (filters.verified !== undefined) {
      filterArray.push(`verified = ${filters.verified}`);
    }

    if (filters.premium !== undefined) {
      filterArray.push(`premium = ${filters.premium}`);
    }

    return filterArray;
  }

  private async generateFacets(query: string, filters?: SearchFilters): Promise<Record<string, Record<string, number>>> {
    // Generate facets for filtering UI
    const facetResults = await this.meilisearch.index('content').search(query, {
      facets: ['category', 'tags', 'performers', 'verified', 'premium'],
      limit: 0
    });

    return facetResults.facetDistribution || {};
  }

  private generateRankingTransparency(
    algorithm: string,
    results: SearchResult[],
    userProfile?: PersonalizationProfile
  ): RankingTransparency {
    return {
      algorithm,
      explanation: this.getAlgorithmExplanation(algorithm),
      personalizedFactors: userProfile ? this.getPersonalizationFactors(userProfile) : undefined,
      rankingFactors: this.getGlobalRankingFactors(),
      sampleResults: results.slice(0, 3).map(result => ({
        contentId: result.contentId,
        title: result.title,
        score: result.relevanceScore,
        factors: result.rankingFactors
      }))
    };
  }

  private getAlgorithmExplanation(algorithm: string): string {
    const explanations = {
      hybrid: 'Results combine keyword matching, semantic similarity, and popularity signals',
      vector: 'Results based on semantic similarity to your search query',
      bm25: 'Results ranked by keyword relevance and term frequency',
      popularity: 'Results ordered by user engagement and popularity metrics',
      personalized: 'Results tailored to your viewing history and preferences'
    };
    return explanations[algorithm as keyof typeof explanations] || 'Results ranked using our default algorithm';
  }

  private getPersonalizationFactors(userProfile: PersonalizationProfile): any {
    return {
      topCategories: Object.entries(userProfile.preferences.categories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([category, score]) => ({ category, score })),
      topTags: Object.entries(userProfile.preferences.tags)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([tag, score]) => ({ tag, score })),
      behaviorProfile: userProfile.behaviorSignals
    };
  }

  private getGlobalRankingFactors(): any {
    return [
      { factor: 'Relevance', weight: 0.4, description: 'How well content matches your search' },
      { factor: 'Popularity', weight: 0.3, description: 'User engagement and view counts' },
      { factor: 'Quality', weight: 0.2, description: 'Content rating and production quality' },
      { factor: 'Personalization', weight: 0.1, description: 'Match to your preferences' }
    ];
  }

  // Placeholder methods for database operations
  private async getUserProfile(userId: string): Promise<PersonalizationProfile | null> {
    // Implementation would fetch from database
    return null;
  }

  private async storeInteraction(interaction: UserInteraction): Promise<void> {
    // Implementation would store in database
  }

  private async updateUserProfile(interaction: UserInteraction): Promise<void> {
    // Implementation would update user profile
  }

  private async updateBanditRewards(interaction: UserInteraction): Promise<void> {
    // Implementation would update bandit arm rewards
  }

  private async updateDwellTimeAnalytics(interaction: UserInteraction): Promise<void> {
    // Implementation would update dwell time analytics
  }

  private async getPopularContent(limit: number): Promise<SearchResult[]> {
    // Implementation would return popular content
    return [];
  }

  private async calculateTrendingScores(timeframe: string): Promise<any[]> {
    // Implementation would calculate trending scores
    return [];
  }
}

interface RankingTransparency {
  algorithm: string;
  explanation: string;
  personalizedFactors?: any;
  rankingFactors: any;
  sampleResults: any[];
}