import React, { useState } from 'react';
import Icon from '../Icon';
import Button from '../Button';
import Card from '../Card';

interface AITag {
  tag: string;
  confidence: number;
  category: string;
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
  aiTags?: AITag[];
}

interface AISearchResultsProps {
  results: SearchResult[];
  query: string;
  searchType: 'hybrid' | 'semantic' | 'keyword';
  totalResults: number;
  searchTime: number;
  onResultClick: (result: SearchResult) => void;
  onRelatedContentClick: (contentId: string) => void;
  showConfidenceScores?: boolean;
  showAITags?: boolean;
  showAnalytics?: boolean;
}

const AISearchResults: React.FC<AISearchResultsProps> = ({
  results,
  query,
  searchType,
  totalResults,
  searchTime,
  onResultClick,
  onRelatedContentClick,
  showConfidenceScores = true,
  showAITags = true,
  showAnalytics = true,
}) => {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const toggleExpanded = (contentId: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(contentId)) {
      newExpanded.delete(contentId);
    } else {
      newExpanded.add(contentId);
    }
    setExpandedResults(newExpanded);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-500 bg-green-50 border-green-200';
    if (confidence >= 0.8) return 'text-blue-500 bg-blue-50 border-blue-200';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-500 bg-red-50 border-red-200';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'Excellent';
    if (confidence >= 0.8) return 'Good';
    if (confidence >= 0.7) return 'Fair';
    return 'Low';
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatViewCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M views`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K views`;
    return `${count} views`;
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const highlightQuery = (text: string, query: string) => {
    if (!query) return text;
    
    const queryWords = query.toLowerCase().split(' ');
    let highlightedText = text;
    
    queryWords.forEach(word => {
      const regex = new RegExp(`(${word})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
    });
    
    return highlightedText;
  };

  const getSearchTypeIcon = () => {
    switch (searchType) {
      case 'semantic': return 'brain';
      case 'hybrid': return 'zap';
      default: return 'search';
    }
  };

  const getSearchTypeLabel = () => {
    switch (searchType) {
      case 'semantic': return 'AI Semantic Search';
      case 'hybrid': return 'Hybrid AI + Keyword Search';
      default: return 'Keyword Search';
    }
  };

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <Icon name="search" size={48} className="text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No results found</h3>
        <p className="text-muted-foreground mb-4">
          Try adjusting your search terms or filters
        </p>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>• Use different keywords or phrases</p>
          <p>• Check your spelling</p>
          <p>• Try broader search terms</p>
          {searchType !== 'semantic' && (
            <p>• Switch to AI semantic search for better results</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Analytics */}
      {showAnalytics && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon name={getSearchTypeIcon()} size={20} className="text-primary" />
              <div>
                <h3 className="font-semibold">{getSearchTypeLabel()}</h3>
                <p className="text-sm text-muted-foreground">
                  {totalResults.toLocaleString()} results for "{query}" in {searchTime}ms
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Icon name="clock" size={14} />
                <span>{searchTime}ms</span>
              </div>
              <div className="flex items-center gap-1">
                <Icon name="list" size={14} />
                <span>{results.length} shown</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Search Results */}
      <div className="space-y-4">
        {results.map((result, index) => {
          const isExpanded = expandedResults.has(result.contentId);
          
          return (
            <Card key={result.contentId} className="p-6 hover:shadow-md transition-shadow">
              <div className="space-y-4">
                {/* Result Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-muted-foreground">#{index + 1}</span>
                      {showConfidenceScores && (
                        <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(result.relevanceScore)}`}>
                          {getConfidenceLabel(result.relevanceScore)} ({(result.relevanceScore * 100).toFixed(0)}%)
                        </div>
                      )}
                      {result.metadata?.ageRestricted && (
                        <div className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          18+
                        </div>
                      )}
                    </div>
                    
                    <h3 
                      className="text-lg font-semibold mb-2 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => onResultClick(result)}
                      dangerouslySetInnerHTML={{ 
                        __html: highlightQuery(result.metadata?.title || `Content ${result.contentId}`, query) 
                      }}
                    />
                    
                    {result.snippet && (
                      <p 
                        className="text-muted-foreground mb-3"
                        dangerouslySetInnerHTML={{ 
                          __html: highlightQuery(result.snippet, query) 
                        }}
                      />
                    )}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(result.contentId)}
                    className="ml-4"
                  >
                    <Icon 
                      name={isExpanded ? "chevron-up" : "chevron-down"} 
                      size={16} 
                    />
                  </Button>
                </div>

                {/* Result Metadata */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {result.metadata?.creatorName && (
                    <div className="flex items-center gap-1">
                      <Icon name="user" size={14} />
                      <span>{result.metadata.creatorName}</span>
                    </div>
                  )}
                  
                  {result.metadata?.duration && (
                    <div className="flex items-center gap-1">
                      <Icon name="clock" size={14} />
                      <span>{formatDuration(result.metadata.duration)}</span>
                    </div>
                  )}
                  
                  {result.metadata?.viewCount && (
                    <div className="flex items-center gap-1">
                      <Icon name="eye" size={14} />
                      <span>{formatViewCount(result.metadata.viewCount)}</span>
                    </div>
                  )}
                  
                  {result.metadata?.createdAt && (
                    <div className="flex items-center gap-1">
                      <Icon name="calendar" size={14} />
                      <span>{formatDate(result.metadata.createdAt)}</span>
                    </div>
                  )}
                  
                  {result.metadata?.category && (
                    <div className="flex items-center gap-1">
                      <Icon name="tag" size={14} />
                      <span className="capitalize">{result.metadata.category}</span>
                    </div>
                  )}
                </div>

                {/* Matched Tags */}
                {result.matchedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm text-muted-foreground">Matched tags:</span>
                    {result.matchedTags.slice(0, 5).map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="px-2 py-1 bg-secondary text-secondary-foreground rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {result.matchedTags.length > 5 && (
                      <span className="text-xs text-muted-foreground">
                        +{result.matchedTags.length - 5} more
                      </span>
                    )}
                  </div>
                )}

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="pt-4 border-t border-border space-y-4">
                    {/* AI Tags */}
                    {showAITags && result.aiTags && result.aiTags.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <Icon name="brain" size={14} className="text-primary" />
                          AI-Generated Tags
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {result.aiTags.map((aiTag, tagIndex) => (
                            <div
                              key={tagIndex}
                              className="flex items-center justify-between p-2 bg-secondary rounded-lg"
                            >
                              <div>
                                <span className="text-sm font-medium">{aiTag.tag}</span>
                                <div className="text-xs text-muted-foreground capitalize">
                                  {aiTag.category}
                                </div>
                              </div>
                              <div className={`text-xs font-medium ${getConfidenceColor(aiTag.confidence).split(' ')[0]}`}>
                                {(aiTag.confidence * 100).toFixed(0)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Full Description */}
                    {result.metadata?.description && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Description</h4>
                        <p 
                          className="text-sm text-muted-foreground"
                          dangerouslySetInnerHTML={{ 
                            __html: highlightQuery(result.metadata.description, query) 
                          }}
                        />
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        onClick={() => onResultClick(result)}
                        className="flex-1"
                      >
                        <Icon name="play" size={16} className="mr-2" />
                        Watch Now
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => onRelatedContentClick(result.contentId)}
                      >
                        <Icon name="search" size={16} className="mr-2" />
                        Similar
                      </Button>
                      
                      <Button variant="ghost" size="sm">
                        <Icon name="bookmark" size={16} />
                      </Button>
                      
                      <Button variant="ghost" size="sm">
                        <Icon name="share" size={16} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Load More */}
      {results.length < totalResults && (
        <div className="text-center py-6">
          <Button variant="outline" size="lg">
            <Icon name="chevron-down" size={16} className="mr-2" />
            Load More Results
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            Showing {results.length} of {totalResults.toLocaleString()} results
          </p>
        </div>
      )}
    </div>
  );
};

export default AISearchResults;