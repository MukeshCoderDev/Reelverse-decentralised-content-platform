import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../Icon';
import Button from '../Button';

interface AISearchSuggestion {
  text: string;
  type: 'query' | 'creator' | 'hashtag' | 'ai-tag';
  trending: boolean;
  count?: number;
  confidence?: number;
  aiGenerated?: boolean;
}

interface SearchFilters {
  duration: 'any' | 'short' | 'medium' | 'long';
  uploadDate: 'any' | 'hour' | 'today' | 'week' | 'month' | 'year';
  sortBy: 'relevance' | 'semantic' | 'upload_date' | 'view_count' | 'rating';
  category: string[];
  creator: string[];
  searchType: 'hybrid' | 'semantic' | 'keyword';
  minConfidence: number;
}

interface SearchResult {
  contentId: string;
  relevanceScore: number;
  matchedTags: string[];
  snippet?: string;
  metadata?: {
    title: string;
    description: string;
    category: string;
    creatorId: string;
    creatorName?: string;
    createdAt: Date | string;
    duration: number;
    viewCount: number;
    ageRestricted?: boolean;
  };
  aiTags?: Array<{
    tag: string;
    confidence: number;
    category: string;
  }>;
}

interface EnhancedSearchEngineProps {
  onSearch: (query: string, filters: SearchFilters, results?: SearchResult[]) => void;
  onSuggestionSelect: (suggestion: AISearchSuggestion) => void;
  placeholder?: string;
  className?: string;
  enableAI?: boolean;
  showConfidenceScores?: boolean;
  showAITags?: boolean;
}

const EnhancedSearchEngine: React.FC<EnhancedSearchEngineProps> = ({
  onSearch,
  onSuggestionSelect,
  placeholder = "Search with AI-powered semantic understanding...",
  className = "",
  enableAI = true,
  showConfidenceScores = true,
  showAITags = true
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AISearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchAnalytics, setSearchAnalytics] = useState({
    totalResults: 0,
    searchTime: 0,
    aiConfidence: 0,
  });
  
  const [filters, setFilters] = useState<SearchFilters>({
    duration: 'any',
    uploadDate: 'any',
    sortBy: 'relevance',
    category: [],
    creator: [],
    searchType: 'hybrid',
    minConfidence: 0.7,
  });

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Enhanced AI-powered suggestions
  const fetchAISuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    
    try {
      // Mock AI suggestions - in real implementation, this would call the AI API
      const mockAISuggestions: AISearchSuggestion[] = [
        { text: 'blonde woman bedroom', type: 'ai-tag', trending: true, count: 1200, confidence: 0.92, aiGenerated: true },
        { text: 'romantic couple intimate', type: 'ai-tag', trending: false, count: 850, confidence: 0.87, aiGenerated: true },
        { text: 'sensual dance performance', type: 'ai-tag', trending: true, count: 980, confidence: 0.89, aiGenerated: true },
        { text: 'lingerie fashion show', type: 'ai-tag', trending: false, count: 720, confidence: 0.84, aiGenerated: true },
      ];

      // Filter AI suggestions based on query
      const aiFiltered = mockAISuggestions.filter(suggestion =>
        suggestion.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        searchQuery.toLowerCase().split(' ').some(word => 
          suggestion.text.toLowerCase().includes(word)
        )
      );

      // Add search history matches
      const historyMatches = searchHistory
        .filter(item => item.toLowerCase().includes(searchQuery.toLowerCase()))
        .map(item => ({ 
          text: item, 
          type: 'query' as const, 
          trending: false,
          aiGenerated: false 
        }));

      // Combine and sort by relevance/confidence
      const combinedSuggestions = [...historyMatches, ...aiFiltered]
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, 8);

      setSuggestions(combinedSuggestions);
    } catch (error) {
      console.error('Failed to fetch AI suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchHistory]);

  // Enhanced search with AI integration
  const performAISearch = async (searchQuery: string, searchFilters: SearchFilters) => {
    if (!enableAI) {
      // Fallback to regular search
      onSearch(searchQuery, searchFilters);
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const endpoint = searchFilters.searchType === 'semantic' 
        ? '/api/v1/ai/search/semantic'
        : '/api/v1/ai/search/hybrid';

      const params = new URLSearchParams({
        q: searchQuery,
        limit: '20',
      });

      // Add filters to params
      if (searchFilters.category.length > 0) {
        params.append('category', searchFilters.category[0]);
      }
      if (searchFilters.creator.length > 0) {
        params.append('creatorId', searchFilters.creator[0]);
      }

      const response = await fetch(`${apiUrl}${endpoint}?${params}`);
      const data = await response.json();

      if (data.status === 'success') {
        const results: SearchResult[] = data.data.results;
        const searchTime = Date.now() - startTime;
        
        // Calculate average AI confidence
        const avgConfidence = results.length > 0 
          ? results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length
          : 0;

        setSearchResults(results);
        setSearchAnalytics({
          totalResults: data.data.total,
          searchTime,
          aiConfidence: avgConfidence,
        });

        onSearch(searchQuery, searchFilters, results);
      } else {
        throw new Error(data.message || 'Search failed');
      }
    } catch (error) {
      console.error('AI search failed:', error);
      // Fallback to regular search
      onSearch(searchQuery, searchFilters);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input change with AI-powered debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(true);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounce for AI suggestions
    debounceRef.current = setTimeout(() => {
      if (enableAI) {
        fetchAISuggestions(value);
      }
    }, 300);
  };

  // Enhanced search submission
  const handleSearch = async (searchQuery?: string) => {
    const finalQuery = searchQuery || query;
    if (!finalQuery.trim()) return;

    // Add to search history
    setSearchHistory(prev => {
      const updated = [finalQuery, ...prev.filter(item => item !== finalQuery)];
      return updated.slice(0, 10);
    });

    setShowSuggestions(false);
    await performAISearch(finalQuery, filters);
  };

  // Handle AI suggestion selection
  const handleSuggestionClick = (suggestion: AISearchSuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
    onSuggestionSelect(suggestion);
    handleSearch(suggestion.text);
  };

  // Enhanced filter updates
  const updateFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    if (query.trim()) {
      performAISearch(query, newFilters);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const getSuggestionIcon = (type: AISearchSuggestion['type']) => {
    switch (type) {
      case 'creator': return 'user';
      case 'hashtag': return 'trending-up';
      case 'ai-tag': return 'brain';
      default: return 'search';
    }
  };

  const formatCount = (count?: number) => {
    if (!count) return '';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-muted-foreground';
    if (confidence >= 0.9) return 'text-green-500';
    if (confidence >= 0.8) return 'text-blue-500';
    if (confidence >= 0.7) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Enhanced Search Bar */}
      <div className="relative">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            className="w-full h-12 pl-12 pr-32 bg-secondary border border-border rounded-full focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 text-foreground placeholder-muted-foreground"
          />
          
          {/* AI Search Icon */}
          <div className="absolute left-4 flex items-center justify-center">
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : enableAI ? (
              <div className="flex items-center gap-1">
                <Icon name="brain" size={18} className="text-primary" />
                <Icon name="search" size={16} className="text-muted-foreground" />
              </div>
            ) : (
              <Icon name="search" size={20} className="text-muted-foreground" />
            )}
          </div>

          {/* Action Buttons */}
          <div className="absolute right-2 flex items-center gap-1">
            {enableAI && (
              <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full">
                <Icon name="brain" size={12} className="text-primary" />
                <span className="text-xs text-primary font-medium">AI</span>
              </div>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`rounded-full ${showFilters ? 'bg-primary/10 text-primary' : ''}`}
            >
              <Icon name="filter" size={16} />
            </Button>
            
            {query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSearch()}
                className="rounded-full"
              >
                <Icon name="search" size={16} />
              </Button>
            )}
          </div>
        </div>

        {/* AI-Enhanced Suggestions Dropdown */}
        {showSuggestions && (suggestions.length > 0 || searchHistory.length > 0) && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
            {/* Search Analytics */}
            {searchAnalytics.totalResults > 0 && (
              <div className="p-3 border-b border-border bg-secondary/50">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{searchAnalytics.totalResults} results</span>
                  <span>{searchAnalytics.searchTime}ms</span>
                  {enableAI && (
                    <span className={getConfidenceColor(searchAnalytics.aiConfidence)}>
                      AI: {(searchAnalytics.aiConfidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Recent Searches */}
            {query.length === 0 && searchHistory.length > 0 && (
              <div className="p-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="clock" size={14} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Recent searches</span>
                </div>
                {searchHistory.slice(0, 5).map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick({ text: item, type: 'query', trending: false, aiGenerated: false })}
                    className="flex items-center gap-3 w-full p-2 hover:bg-secondary rounded-lg transition-colors text-left"
                  >
                    <Icon name="clock" size={16} className="text-muted-foreground" />
                    <span className="text-sm">{item}</span>
                  </button>
                ))}
              </div>
            )}

            {/* AI-Enhanced Suggestions */}
            {suggestions.length > 0 && (
              <div className="p-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="flex items-center justify-between w-full p-3 hover:bg-secondary rounded-lg transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <Icon 
                        name={getSuggestionIcon(suggestion.type)} 
                        size={16} 
                        className={suggestion.aiGenerated ? "text-primary" : "text-muted-foreground"} 
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{suggestion.text}</span>
                          {suggestion.aiGenerated && (
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">AI</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {suggestion.trending && (
                            <div className="flex items-center gap-1">
                              <Icon name="flame" size={12} className="text-red-500" />
                              <span className="text-xs text-red-500">Trending</span>
                            </div>
                          )}
                          {showConfidenceScores && suggestion.confidence && (
                            <span className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}>
                              {(suggestion.confidence * 100).toFixed(0)}% match
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {suggestion.count && (
                        <span className="text-xs text-muted-foreground">
                          {formatCount(suggestion.count)}
                        </span>
                      )}
                      <Icon 
                        name="chevron-right" 
                        size={14} 
                        className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" 
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enhanced Filters Panel */}
      {showFilters && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-lg z-40 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search Type Filter */}
            {enableAI && (
              <div>
                <label className="block text-sm font-medium mb-2">Search Type</label>
                <select
                  value={filters.searchType}
                  onChange={(e) => updateFilter('searchType', e.target.value as any)}
                  className="w-full p-2 bg-secondary border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                >
                  <option value="hybrid">Hybrid (AI + Keywords)</option>
                  <option value="semantic">Semantic (AI Only)</option>
                  <option value="keyword">Keywords Only</option>
                </select>
              </div>
            )}

            {/* Duration Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Duration</label>
              <select
                value={filters.duration}
                onChange={(e) => updateFilter('duration', e.target.value as any)}
                className="w-full p-2 bg-secondary border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
              >
                <option value="any">Any duration</option>
                <option value="short">Under 4 minutes</option>
                <option value="medium">4-20 minutes</option>
                <option value="long">Over 20 minutes</option>
              </select>
            </div>

            {/* Upload Date Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Upload date</label>
              <select
                value={filters.uploadDate}
                onChange={(e) => updateFilter('uploadDate', e.target.value as any)}
                className="w-full p-2 bg-secondary border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
              >
                <option value="any">Any time</option>
                <option value="hour">Last hour</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="year">This year</option>
              </select>
            </div>

            {/* Sort By Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Sort by</label>
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value as any)}
                className="w-full p-2 bg-secondary border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
              >
                <option value="relevance">Relevance</option>
                {enableAI && <option value="semantic">AI Similarity</option>}
                <option value="upload_date">Upload date</option>
                <option value="view_count">View count</option>
                <option value="rating">Rating</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({
                    duration: 'any',
                    uploadDate: 'any',
                    sortBy: 'relevance',
                    category: [],
                    creator: [],
                    searchType: 'hybrid',
                    minConfidence: 0.7,
                  });
                }}
                className="w-full"
              >
                Clear filters
              </Button>
            </div>
          </div>

          {/* AI Confidence Threshold */}
          {enableAI && (
            <div className="mt-4 pt-4 border-t border-border">
              <label className="block text-sm font-medium mb-2">
                AI Confidence Threshold: {(filters.minConfidence * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                value={filters.minConfidence}
                onChange={(e) => updateFilter('minConfidence', parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedSearchEngine;