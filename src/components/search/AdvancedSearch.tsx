import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';

interface SearchFilter {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'range' | 'boolean';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail?: string;
  metadata?: Record<string, any>;
  relevanceScore: number;
}

interface AdvancedSearchProps {
  placeholder?: string;
  filters?: SearchFilter[];
  categories?: string[];
  onSearch: (query: string, filters: Record<string, any>) => Promise<SearchResult[]>;
  onResultSelect: (result: SearchResult) => void;
  showSuggestions?: boolean;
  showFilters?: boolean;
  className?: string;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  placeholder = "Search...",
  filters = [],
  categories = [],
  onSearch,
  onResultSelect,
  showSuggestions = true,
  showFilters = true,
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim()) {
      performSearch(debouncedQuery);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [debouncedQuery, activeFilters, selectedCategory]);

  // Generate suggestions based on query
  const searchSuggestions = useMemo(() => {
    if (!query.trim() || !showSuggestions) return [];
    
    const commonSuggestions = [
      'live streaming',
      'video tutorials',
      'creator tools',
      'monetization',
      'analytics',
      'mobile app',
      'user interface',
      'performance'
    ];

    return commonSuggestions
      .filter(suggestion => 
        suggestion.toLowerCase().includes(query.toLowerCase()) &&
        suggestion.toLowerCase() !== query.toLowerCase()
      )
      .slice(0, 5);
  }, [query, showSuggestions]);

  const performSearch = async (searchQuery: string) => {
    setIsLoading(true);
    
    try {
      const searchResults = await onSearch(searchQuery, {
        ...activeFilters,
        category: selectedCategory !== 'all' ? selectedCategory : undefined
      });
      
      setResults(searchResults);
      setShowResults(true);
      
      // Add to recent searches
      if (searchQuery.trim()) {
        const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 10);
        setRecentSearches(updated);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    if (value.trim()) {
      setSuggestions(searchSuggestions);
    } else {
      setSuggestions([]);
      setShowResults(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleResultClick = (result: SearchResult) => {
    onResultSelect(result);
    setShowResults(false);
    setQuery('');
  };

  const handleFilterChange = (filterKey: string, value: any) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterKey]: value
    }));
  };

  const clearFilters = () => {
    setActiveFilters({});
    setSelectedCategory('all');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      performSearch(query);
    } else if (e.key === 'Escape') {
      setShowResults(false);
      setSuggestions([]);
    }
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setSuggestions([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeFilterCount = Object.keys(activeFilters).filter(key => 
    activeFilters[key] !== undefined && activeFilters[key] !== ''
  ).length + (selectedCategory !== 'all' ? 1 : 0);

  return (
    <div ref={searchRef} className={`advanced-search ${className}`}>
      {/* Search Input */}
      <div className="search-input-container">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="search-input"
          />
          
          {isLoading && (
            <div className="search-loading">
              <div className="loading-spinner"></div>
            </div>
          )}
          
          {query && (
            <button
              className="clear-search"
              onClick={() => {
                setQuery('');
                setResults([]);
                setShowResults(false);
                inputRef.current?.focus();
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        {showFilters && (filters.length > 0 || categories.length > 0) && (
          <button
            className={`filter-toggle ${showFilterPanel ? 'active' : ''}`}
            onClick={() => setShowFilterPanel(!showFilterPanel)}
          >
            <span className="filter-icon">⚙️</span>
            {activeFilterCount > 0 && (
              <span className="filter-count">{activeFilterCount}</span>
            )}
          </button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilterPanel && showFilters && (
        <div className="filter-panel">
          <div className="filter-header">
            <h4>Filters</h4>
            {activeFilterCount > 0 && (
              <button className="clear-filters" onClick={clearFilters}>
                Clear All
              </button>
            )}
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className="filter-group">
              <label className="filter-label">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dynamic Filters */}
          {filters.map(filter => (
            <div key={filter.key} className="filter-group">
              <label className="filter-label">{filter.label}</label>
              
              {filter.type === 'text' && (
                <input
                  type="text"
                  value={activeFilters[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  placeholder={filter.placeholder}
                  className="filter-input"
                />
              )}
              
              {filter.type === 'select' && filter.options && (
                <select
                  value={activeFilters[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  className="filter-select"
                >
                  <option value="">All</option>
                  {filter.options.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
              
              {filter.type === 'date' && (
                <input
                  type="date"
                  value={activeFilters[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  className="filter-input"
                />
              )}
              
              {filter.type === 'boolean' && (
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={activeFilters[filter.key] || false}
                    onChange={(e) => handleFilterChange(filter.key, e.target.checked)}
                  />
                  <span className="checkbox-label">{filter.label}</span>
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && !showResults && (
        <div className="search-suggestions">
          <div className="suggestions-header">
            <span className="suggestions-title">Suggestions</span>
          </div>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              className="suggestion-item"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <span className="suggestion-icon">🔍</span>
              <span className="suggestion-text">{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      {/* Recent Searches */}
      {!query && recentSearches.length > 0 && (
        <div className="recent-searches">
          <div className="recent-header">
            <span className="recent-title">Recent Searches</span>
            <button
              className="clear-recent"
              onClick={() => {
                setRecentSearches([]);
                localStorage.removeItem('recentSearches');
              }}
            >
              Clear
            </button>
          </div>
          {recentSearches.slice(0, 5).map((search, index) => (
            <button
              key={index}
              className="recent-item"
              onClick={() => setQuery(search)}
            >
              <span className="recent-icon">🕒</span>
              <span className="recent-text">{search}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search Results */}
      {showResults && (
        <div className="search-results">
          <div className="results-header">
            <span className="results-count">
              {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
            </span>
          </div>
          
          {results.length === 0 ? (
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              <div className="no-results-title">No results found</div>
              <div className="no-results-text">
                Try adjusting your search terms or filters
              </div>
            </div>
          ) : (
            <div className="results-list">
              {results.map(result => (
                <button
                  key={result.id}
                  className="result-item"
                  onClick={() => handleResultClick(result)}
                >
                  {result.thumbnail && (
                    <div className="result-thumbnail">
                      <img src={result.thumbnail} alt={result.title} />
                    </div>
                  )}
                  
                  <div className="result-content">
                    <div className="result-header">
                      <h4 className="result-title">{result.title}</h4>
                      <span className="result-category">{result.category}</span>
                    </div>
                    <p className="result-description">{result.description}</p>
                    
                    {result.metadata && (
                      <div className="result-metadata">
                        {Object.entries(result.metadata).map(([key, value]) => (
                          <span key={key} className="metadata-item">
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="result-score">
                    {Math.round(result.relevanceScore * 100)}%
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};