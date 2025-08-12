interface SearchableItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  content?: string;
  metadata?: Record<string, any>;
  thumbnail?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SearchIndex {
  [key: string]: {
    items: SearchableItem[];
    keywords: Map<string, Set<string>>; // keyword -> item IDs
  };
}

interface SearchOptions {
  category?: string;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  sortBy?: 'relevance' | 'date' | 'title';
  limit?: number;
  fuzzyMatch?: boolean;
}

export class SearchService {
  private index: SearchIndex = {};
  private stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were'
  ]);

  constructor() {
    this.initializeIndex();
  }

  private initializeIndex() {
    // Initialize with sample data
    const sampleItems: SearchableItem[] = [
      {
        id: '1',
        title: 'Live Streaming Setup Guide',
        description: 'Complete guide to setting up professional live streaming',
        category: 'Help',
        tags: ['streaming', 'setup', 'guide', 'tutorial'],
        content: 'Learn how to set up your live streaming environment with professional quality...',
        thumbnail: '/images/streaming-guide.jpg',
        createdAt: new Date('2024-01-15')
      },
      {
        id: '2',
        title: 'Monetization Best Practices',
        description: 'How to maximize your earnings through various monetization strategies',
        category: 'Help',
        tags: ['monetization', 'earnings', 'revenue', 'tips'],
        content: 'Discover the best practices for monetizing your content and maximizing revenue...',
        thumbnail: '/images/monetization.jpg',
        createdAt: new Date('2024-01-20')
      },
      {
        id: '3',
        title: 'Mobile App Features',
        description: 'Explore all the features available in our mobile application',
        category: 'Features',
        tags: ['mobile', 'app', 'features', 'ios', 'android'],
        content: 'Our mobile app provides full functionality including live streaming, chat, and analytics...',
        thumbnail: '/images/mobile-app.jpg',
        createdAt: new Date('2024-02-01')
      },
      {
        id: '4',
        title: 'Analytics Dashboard Overview',
        description: 'Understanding your analytics and performance metrics',
        category: 'Analytics',
        tags: ['analytics', 'metrics', 'dashboard', 'performance'],
        content: 'Get insights into your performance with our comprehensive analytics dashboard...',
        thumbnail: '/images/analytics.jpg',
        createdAt: new Date('2024-02-05')
      },
      {
        id: '5',
        title: 'Chat Moderation Tools',
        description: 'Keep your chat safe with our moderation features',
        category: 'Moderation',
        tags: ['chat', 'moderation', 'safety', 'tools'],
        content: 'Learn about our chat moderation tools including auto-mod, timeouts, and bans...',
        thumbnail: '/images/moderation.jpg',
        createdAt: new Date('2024-02-10')
      }
    ];

    this.addItems(sampleItems);
  }

  addItems(items: SearchableItem[]) {
    items.forEach(item => this.addItem(item));
  }

  addItem(item: SearchableItem) {
    const category = item.category.toLowerCase();
    
    if (!this.index[category]) {
      this.index[category] = {
        items: [],
        keywords: new Map()
      };
    }

    // Add item to category
    this.index[category].items.push(item);

    // Index keywords
    const keywords = this.extractKeywords(item);
    keywords.forEach(keyword => {
      if (!this.index[category].keywords.has(keyword)) {
        this.index[category].keywords.set(keyword, new Set());
      }
      this.index[category].keywords.get(keyword)!.add(item.id);
    });
  }

  private extractKeywords(item: SearchableItem): string[] {
    const text = [
      item.title,
      item.description,
      item.content || '',
      ...item.tags,
      ...Object.values(item.metadata || {}).map(v => String(v))
    ].join(' ').toLowerCase();

    return text
      .split(/\W+/)
      .filter(word => word.length > 2 && !this.stopWords.has(word))
      .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates
  }

  async search(query: string, options: SearchOptions = {}): Promise<Array<SearchableItem & { relevanceScore: number }>> {
    const {
      category,
      tags = [],
      dateRange,
      sortBy = 'relevance',
      limit = 50,
      fuzzyMatch = true
    } = options;

    if (!query.trim()) {
      return [];
    }

    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    const results = new Map<string, { item: SearchableItem; score: number }>();

    // Search in specified category or all categories
    const categoriesToSearch = category ? [category.toLowerCase()] : Object.keys(this.index);

    for (const cat of categoriesToSearch) {
      if (!this.index[cat]) continue;

      const categoryIndex = this.index[cat];
      
      // Find matching items
      const matchingItemIds = new Set<string>();

      for (const term of searchTerms) {
        // Exact matches
        if (categoryIndex.keywords.has(term)) {
          categoryIndex.keywords.get(term)!.forEach(id => matchingItemIds.add(id));
        }

        // Fuzzy matches
        if (fuzzyMatch) {
          for (const [keyword, itemIds] of categoryIndex.keywords.entries()) {
            if (this.fuzzyMatch(term, keyword)) {
              itemIds.forEach(id => matchingItemIds.add(id));
            }
          }
        }
      }

      // Score and filter items
      for (const itemId of matchingItemIds) {
        const item = categoryIndex.items.find(i => i.id === itemId);
        if (!item) continue;

        // Apply filters
        if (tags.length > 0 && !tags.some(tag => item.tags.includes(tag))) {
          continue;
        }

        if (dateRange) {
          const itemDate = item.createdAt || item.updatedAt;
          if (!itemDate || itemDate < dateRange.start || itemDate > dateRange.end) {
            continue;
          }
        }

        const score = this.calculateRelevanceScore(item, searchTerms, query);
        
        if (!results.has(itemId) || results.get(itemId)!.score < score) {
          results.set(itemId, { item, score });
        }
      }
    }

    // Convert to array and sort
    let sortedResults = Array.from(results.values());

    switch (sortBy) {
      case 'relevance':
        sortedResults.sort((a, b) => b.score - a.score);
        break;
      case 'date':
        sortedResults.sort((a, b) => {
          const dateA = a.item.createdAt || a.item.updatedAt || new Date(0);
          const dateB = b.item.createdAt || b.item.updatedAt || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        break;
      case 'title':
        sortedResults.sort((a, b) => a.item.title.localeCompare(b.item.title));
        break;
    }

    return sortedResults
      .slice(0, limit)
      .map(result => ({
        ...result.item,
        relevanceScore: result.score
      }));
  }

  private fuzzyMatch(term: string, keyword: string, threshold: number = 0.7): boolean {
    if (keyword.includes(term) || term.includes(keyword)) {
      return true;
    }

    // Simple Levenshtein distance-based fuzzy matching
    const distance = this.levenshteinDistance(term, keyword);
    const maxLength = Math.max(term.length, keyword.length);
    const similarity = 1 - (distance / maxLength);
    
    return similarity >= threshold;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculateRelevanceScore(item: SearchableItem, searchTerms: string[], originalQuery: string): number {
    let score = 0;
    const queryLower = originalQuery.toLowerCase();
    
    // Title matches (highest weight)
    const titleLower = item.title.toLowerCase();
    if (titleLower.includes(queryLower)) {
      score += 100;
    } else {
      searchTerms.forEach(term => {
        if (titleLower.includes(term)) {
          score += 50;
        }
      });
    }

    // Description matches
    const descLower = item.description.toLowerCase();
    if (descLower.includes(queryLower)) {
      score += 75;
    } else {
      searchTerms.forEach(term => {
        if (descLower.includes(term)) {
          score += 25;
        }
      });
    }

    // Tag matches
    item.tags.forEach(tag => {
      const tagLower = tag.toLowerCase();
      if (tagLower.includes(queryLower)) {
        score += 60;
      } else {
        searchTerms.forEach(term => {
          if (tagLower.includes(term)) {
            score += 20;
          }
        });
      }
    });

    // Content matches (if available)
    if (item.content) {
      const contentLower = item.content.toLowerCase();
      if (contentLower.includes(queryLower)) {
        score += 40;
      } else {
        searchTerms.forEach(term => {
          if (contentLower.includes(term)) {
            score += 10;
          }
        });
      }
    }

    // Boost score for exact matches
    if (titleLower === queryLower) {
      score += 200;
    }

    // Normalize score to 0-1 range
    return Math.min(score / 500, 1);
  }

  getCategories(): string[] {
    return Object.keys(this.index);
  }

  getTrendingSearches(): string[] {
    // Mock trending searches - in production, this would be based on actual search analytics
    return [
      'live streaming',
      'monetization',
      'mobile app',
      'analytics',
      'chat moderation',
      'video quality',
      'subscriber management',
      'earnings dashboard'
    ];
  }

  getSearchSuggestions(query: string, limit: number = 5): string[] {
    if (!query.trim()) return [];

    const suggestions = new Set<string>();
    const queryLower = query.toLowerCase();

    // Add trending searches that match
    this.getTrendingSearches().forEach(trending => {
      if (trending.toLowerCase().includes(queryLower)) {
        suggestions.add(trending);
      }
    });

    // Add category names that match
    this.getCategories().forEach(category => {
      if (category.toLowerCase().includes(queryLower)) {
        suggestions.add(category);
      }
    });

    // Add item titles that match
    Object.values(this.index).forEach(categoryIndex => {
      categoryIndex.items.forEach(item => {
        if (item.title.toLowerCase().includes(queryLower)) {
          suggestions.add(item.title);
        }
      });
    });

    return Array.from(suggestions).slice(0, limit);
  }
}

// Singleton instance
export const searchService = new SearchService();