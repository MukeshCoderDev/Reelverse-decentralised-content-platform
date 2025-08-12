import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../Icon';
import Button from '../Button';

interface SearchSuggestion {
  text: string;
  type: 'query' | 'creator' | 'hashtag';
  trending: boolean;
  count?: number;
}

interface SearchFilters {
  duration: 'any' | 'short' | 'medium' | 'long';
  uploadDate: 'any' | 'hour' | 'today' | 'week' | 'month' | 'year';
  sortBy: 'relevance' | 'upload_date' | 'view_count' | 'rating';
  category: string[];
  creator: string[];
}

interface SearchEngineProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  onSuggestionSelect: (suggestion: SearchSuggestion) => void;
  placeholder?: string;
  className?: string;
}

const SearchEngine: React.FC<SearchEngineProps> = ({
  onSearch,
  onSuggestionSelect,
  placeholder = "Search videos, creators, and more...",
  className = ""
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  const [filters, setFilters] = useState<SearchFilters>({
    duration: 'any',
    uploadDate: 'any',
    sortBy: 'relevance',
    category: [],
    creator: []
  });

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Mock suggestions data
  const mockSuggestions: SearchSuggestion[] = [
    { text: 'web3 explained', type: 'query', trending: true, count: 1200 },
    { text: 'defi tutorial', type: 'query', trending: false, count: 850 },
    { text: '#blockchain', type: 'hashtag', trending: true, count: 2400 },
    { text: 'TechGuru', type: 'creator', trending: false, count: 450 },
    { text: 'nft creation guide', type: 'query', trending: true, count: 980 },
    { text: 'CryptoCadet', type: 'creator', trending: true, count: 720 },
  ];

  // Debounced search suggestions
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    
    // Simulate API call with debouncing
    const filtered = mockSuggestions.filter(suggestion =>
      suggestion.text.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // Add search history matches
    const historyMatches = searchHistory
      .filter(item => item.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(item => ({ text: item, type: 'query' as const, trending: false }));
    
    setTimeout(() => {
      setSuggestions([...historyMatches, ...filtered].slice(0, 8));
      setIsLoading(false);
    }, 150);
  }, [searchHistory]);

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(true);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounce
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  // Handle search submission
  const handleSearch = (searchQuery?: string) => {
    const finalQuery = searchQuery || query;
    if (!finalQuery.trim()) return;

    // Add to search history
    setSearchHistory(prev => {
      const updated = [finalQuery, ...prev.filter(item => item !== finalQuery)];
      return updated.slice(0, 10); // Keep last 10 searches
    });

    setShowSuggestions(false);
    onSearch(finalQuery, filters);
  };

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
    onSuggestionSelect(suggestion);
    handleSearch(suggestion.text);
  };

  // Handle filter changes
  const updateFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    if (query.trim()) {
      onSearch(query, newFilters);
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

  const getSuggestionIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'creator': return 'user';
      case 'hashtag': return 'trending-up';
      default: return 'search';
    }
  };

  const formatCount = (count?: number) => {
    if (!count) return '';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Main Search Bar */}
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
            className="w-full h-12 pl-12 pr-20 bg-secondary border border-border rounded-full focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 text-foreground placeholder-muted-foreground"
          />
          
          {/* Search Icon */}
          <div className="absolute left-4 flex items-center justify-center">
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="search" size={20} className="text-muted-foreground" />
            )}
          </div>

          {/* Action Buttons */}
          <div className="absolute right-2 flex items-center gap-1">
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

        {/* Search Suggestions Dropdown */}
        {showSuggestions && (suggestions.length > 0 || searchHistory.length > 0) && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
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
                    onClick={() => handleSuggestionClick({ text: item, type: 'query', trending: false })}
                    className="flex items-center gap-3 w-full p-2 hover:bg-secondary rounded-lg transition-colors text-left"
                  >
                    <Icon name="clock" size={16} className="text-muted-foreground" />
                    <span className="text-sm">{item}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Suggestions */}
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
                        className="text-muted-foreground" 
                      />
                      <div>
                        <span className="text-sm font-medium">{suggestion.text}</span>
                        {suggestion.trending && (
                          <div className="flex items-center gap-1 mt-1">
                            <Icon name="flame" size={12} className="text-red-500" />
                            <span className="text-xs text-red-500">Trending</span>
                          </div>
                        )}
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

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-lg z-40 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    creator: []
                  });
                }}
                className="w-full"
              >
                Clear filters
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchEngine;