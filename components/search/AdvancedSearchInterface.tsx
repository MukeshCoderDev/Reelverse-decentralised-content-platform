import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Spinner } from '../Spinner';
import { Icon } from '../Icon';

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
  relevanceScore: number;
  popularityScore: number;
  qualityScore: number;
  personalizedScore?: number;
  viewCount: number;
  likeCount: number;
  purchaseCount: number;
  averageRating: number;
  rankingFactors: RankingFactor[];
}

interface RankingFactor {
  factor: string;
  weight: number;
  score: number;
  explanation: string;
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

interface AdvancedSearchInterfaceProps {
  onResultClick: (result: SearchResult) => void;
  onInteractionTrack: (contentId: string, interactionType: string, dwellTime?: number) => void;
}

export const AdvancedSearchInterface: React.FC<AdvancedSearchInterfaceProps> = ({
  onResultClick,
  onInteractionTrack
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showTransparency, setShowTransparency] = useState(false);
  const [algorithmUsed, setAlgorithmUsed] = useState<string>('');
  const [personalizedResults, setPersonalizedResults] = useState(true);
  const [facets, setFacets] = useState<Record<string, Record<string, number>>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [dwellStartTime, setDwellStartTime] = useState<Record<string, number>>({});

  const RESULTS_PER_PAGE = 20;

  const performSearch = useCallback(async (searchQuery: string, searchFilters: SearchFilters, page: number = 1) => {
    if (!searchQuery.trim() && Object.keys(searchFilters).length === 0) return;

    setLoading(true);
    try {
      const response = await fetch('/api/v1/advanced-search/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          query: searchQuery,
          filters: searchFilters,
          limit: RESULTS_PER_PAGE,
          offset: (page - 1) * RESULTS_PER_PAGE,
          personalizeResults
        })
      });

      const data = await response.json();
      if (data.success) {
        setResults(data.data.results);
        setTotalCount(data.data.totalCount);
        setFacets(data.data.facets);
        setAlgorithmUsed(data.data.algorithmUsed);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [personalizedResults]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query, filters, 1);
  };

  const handleResultClick = (result: SearchResult) => {
    onInteractionTrack(result.contentId, 'click');
    onResultClick(result);
  };

  const handleResultHover = (contentId: string, isEntering: boolean) => {
    if (isEntering) {
      setDwellStartTime(prev => ({ ...prev, [contentId]: Date.now() }));
    } else {
      const startTime = dwellStartTime[contentId];
      if (startTime) {
        const dwellTime = Date.now() - startTime;
        if (dwellTime > 1000) { // Only track if dwelled for more than 1 second
          onInteractionTrack(contentId, 'dwell', dwellTime);
        }
        setDwellStartTime(prev => {
          const newState = { ...prev };
          delete newState[contentId];
          return newState;
        });
      }
    }
  };

  const handleFilterChange = (filterType: keyof SearchFilters, value: any) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    if (query || Object.keys(newFilters).length > 0) {
      performSearch(query, newFilters, 1);
    }
  };

  const clearFilters = () => {
    setFilters({});
    performSearch(query, {}, 1);
  };

  const handlePageChange = (page: number) => {
    performSearch(query, filters, page);
  };

  const renderSearchBar = () => (
    <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for content..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Icon name="search" size={20} className="absolute right-3 top-3.5 text-gray-400" />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Search'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Icon name="filter" size={16} className="mr-2" />
          Filters
        </Button>
      </form>

      {/* Search Options */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={personalizedResults}
              onChange={(e) => setPersonalizedResults(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-600">Personalize results</span>
          </label>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTransparency(!showTransparency)}
        >
          <Icon name="info" size={16} className="mr-1" />
          How ranking works
        </Button>
      </div>
    </div>
  );

  const renderFilters = () => {
    if (!showFilters) return null;

    return (
      <Card className="p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Filters</h3>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Category Filter */}
          {facets.category && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                multiple
                value={filters.category || []}
                onChange={(e) => handleFilterChange('category', Array.from(e.target.selectedOptions, option => option.value))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                {Object.entries(facets.category).map(([category, count]) => (
                  <option key={category} value={category}>
                    {category} ({count})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Duration Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
            <div className="flex space-x-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.duration?.min || ''}
                onChange={(e) => handleFilterChange('duration', {
                  ...filters.duration,
                  min: e.target.value ? parseInt(e.target.value) : undefined
                })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.duration?.max || ''}
                onChange={(e) => handleFilterChange('duration', {
                  ...filters.duration,
                  max: e.target.value ? parseInt(e.target.value) : undefined
                })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Price Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Price Range ($)</label>
            <div className="flex space-x-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.priceRange?.min || ''}
                onChange={(e) => handleFilterChange('priceRange', {
                  ...filters.priceRange,
                  min: e.target.value ? parseFloat(e.target.value) : undefined
                })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.priceRange?.max || ''}
                onChange={(e) => handleFilterChange('priceRange', {
                  ...filters.priceRange,
                  max: e.target.value ? parseFloat(e.target.value) : undefined
                })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Verified Filter */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.verified || false}
                onChange={(e) => handleFilterChange('verified', e.target.checked || undefined)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Verified creators only</span>
            </label>
          </div>

          {/* Premium Filter */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.premium || false}
                onChange={(e) => handleFilterChange('premium', e.target.checked || undefined)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Premium content only</span>
            </label>
          </div>
        </div>
      </Card>
    );
  };

  const renderTransparency = () => {
    if (!showTransparency) return null;

    return (
      <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-blue-900">How We Rank Your Results</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTransparency(false)}
          >
            <Icon name="x" size={16} />
          </Button>
        </div>
        
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>Algorithm Used:</strong> {algorithmUsed || 'Hybrid Search'}</p>
          <p><strong>Personalization:</strong> {personalizedResults ? 'Enabled - Results tailored to your preferences' : 'Disabled - Generic results for all users'}</p>
          
          <div className="mt-3">
            <p className="font-medium mb-2">Ranking Factors:</p>
            <ul className="space-y-1 ml-4">
              <li>• <strong>Relevance (40%):</strong> How well content matches your search</li>
              <li>• <strong>Popularity (30%):</strong> User engagement and view counts</li>
              <li>• <strong>Quality (20%):</strong> Content rating and production quality</li>
              {personalizedResults && (
                <li>• <strong>Personalization (10%):</strong> Match to your viewing history</li>
              )}
            </ul>
          </div>
          
          <div className="mt-3 pt-3 border-t border-blue-300">
            <Button variant="ghost" size="sm" className="text-blue-700">
              Learn more about our ranking system
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  const renderResults = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
          <span className="ml-3 text-gray-600">Searching...</span>
        </div>
      );
    }

    if (results.length === 0 && (query || Object.keys(filters).length > 0)) {
      return (
        <div className="text-center py-12">
          <Icon name="search" size={48} className="text-gray-400 mb-4 mx-auto" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
          <p className="text-gray-600">Try adjusting your search terms or filters</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Results Header */}
        {results.length > 0 && (
          <div className="flex justify-between items-center">
            <p className="text-gray-600">
              Showing {((currentPage - 1) * RESULTS_PER_PAGE) + 1}-{Math.min(currentPage * RESULTS_PER_PAGE, totalCount)} of {totalCount} results
            </p>
            <div className="text-sm text-gray-500">
              Algorithm: <span className="font-medium">{algorithmUsed}</span>
              {personalizedResults && <span className="ml-2 text-blue-600">• Personalized</span>}
            </div>
          </div>
        )}

        {/* Results Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {results.map((result) => (
            <Card
              key={result.contentId}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleResultClick(result)}
              onMouseEnter={() => handleResultHover(result.contentId, true)}
              onMouseLeave={() => handleResultHover(result.contentId, false)}
            >
              <div className="aspect-video bg-gray-200 rounded-t-lg relative">
                <img
                  src={result.thumbnailUrl}
                  alt={result.title}
                  className="w-full h-full object-cover rounded-t-lg"
                />
                <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                  {result.duration}m
                </div>
                {result.premium && (
                  <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">
                    Premium
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                  {result.title}
                </h3>
                
                <div className="flex items-center space-x-2 mb-2">
                  {result.verified && (
                    <Icon name="check-circle" size={16} className="text-blue-500" />
                  )}
                  <span className="text-sm text-gray-600">{result.category}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>{result.viewCount.toLocaleString()} views</span>
                  <span className="flex items-center">
                    <Icon name="star" size={14} className="text-yellow-500 mr-1" />
                    {result.averageRating.toFixed(1)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-lg">${result.price}</span>
                  <div className="text-xs text-gray-500">
                    Relevance: {(result.relevanceScore * 100).toFixed(0)}%
                  </div>
                </div>
                
                {result.personalizedScore && (
                  <div className="mt-2 text-xs text-blue-600">
                    Personalized match: {(result.personalizedScore * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {totalCount > RESULTS_PER_PAGE && (
          <div className="flex justify-center mt-8">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Previous
              </Button>
              
              {Array.from({ length: Math.min(5, Math.ceil(totalCount / RESULTS_PER_PAGE)) }, (_, i) => {
                const page = i + 1;
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </Button>
                );
              })}
              
              <Button
                variant="outline"
                disabled={currentPage >= Math.ceil(totalCount / RESULTS_PER_PAGE)}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {renderSearchBar()}
      {renderFilters()}
      {renderTransparency()}
      {renderResults()}
    </div>
  );
};