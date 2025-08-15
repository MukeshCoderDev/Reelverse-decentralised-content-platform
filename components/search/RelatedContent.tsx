import React, { useState, useEffect } from 'react';
import Icon from '../Icon';
import Button from '../Button';
import Card from '../Card';

interface RelatedContentItem {
  contentId: string;
  relevanceScore: number;
  matchedTags: string[];
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
}

interface RelatedContentProps {
  contentId: string;
  onContentClick: (content: RelatedContentItem) => void;
  onSearchSimilar: (query: string) => void;
  className?: string;
  maxItems?: number;
  showAnalytics?: boolean;
}

const RelatedContent: React.FC<RelatedContentProps> = ({
  contentId,
  onContentClick,
  onSearchSimilar,
  className = "",
  maxItems = 6,
  showAnalytics = true,
}) => {
  const [relatedContent, setRelatedContent] = useState<RelatedContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState({
    totalFound: 0,
    avgSimilarity: 0,
    searchTime: 0,
  });

  useEffect(() => {
    if (contentId) {
      fetchRelatedContent();
    }
  }, [contentId]);

  const fetchRelatedContent = async () => {
    setIsLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(
        `${apiUrl}/api/v1/ai/similar/${contentId}?limit=${maxItems}`
      );
      
      const data = await response.json();
      
      if (data.status === 'success') {
        const content = data.data.similarContent || [];
        setRelatedContent(content);
        
        // Calculate analytics
        const searchTime = Date.now() - startTime;
        const avgSimilarity = content.length > 0 
          ? content.reduce((sum: number, item: RelatedContentItem) => sum + item.relevanceScore, 0) / content.length
          : 0;
        
        setAnalytics({
          totalFound: data.data.total || content.length,
          avgSimilarity,
          searchTime,
        });
      } else {
        throw new Error(data.message || 'Failed to fetch related content');
      }
    } catch (err) {
      console.error('Failed to fetch related content:', err);
      setError(err instanceof Error ? err.message : 'Failed to load related content');
      
      // Mock data for development
      const mockContent: RelatedContentItem[] = [
        {
          contentId: 'mock-1',
          relevanceScore: 0.92,
          matchedTags: ['blonde', 'bedroom', 'romantic'],
          metadata: {
            title: 'Similar Content 1',
            description: 'A similar video with matching themes',
            category: 'adult',
            creatorId: 'creator-1',
            creatorName: 'Creator One',
            createdAt: new Date(),
            duration: 480,
            viewCount: 15420,
            ageRestricted: true,
          },
        },
        {
          contentId: 'mock-2',
          relevanceScore: 0.87,
          matchedTags: ['sensual', 'intimate'],
          metadata: {
            title: 'Similar Content 2',
            description: 'Another related video',
            category: 'adult',
            creatorId: 'creator-2',
            creatorName: 'Creator Two',
            createdAt: new Date(),
            duration: 360,
            viewCount: 8930,
            ageRestricted: true,
          },
        },
      ];
      
      setRelatedContent(mockContent);
      setAnalytics({
        totalFound: mockContent.length,
        avgSimilarity: 0.89,
        searchTime: Date.now() - startTime,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatViewCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-500';
    if (confidence >= 0.8) return 'text-blue-500';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-500';
  };

  const handleSearchByTags = (tags: string[]) => {
    const query = tags.slice(0, 3).join(' ');
    onSearchSimilar(query);
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <h3 className="text-lg font-semibold">Finding related content...</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="p-4 animate-pulse">
              <div className="aspect-video bg-secondary rounded-lg mb-3" />
              <div className="h-4 bg-secondary rounded mb-2" />
              <div className="h-3 bg-secondary rounded w-2/3" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && relatedContent.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Icon name="alert-circle" size={48} className="text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Unable to load related content</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchRelatedContent} variant="outline">
          <Icon name="refresh-cw" size={16} className="mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (relatedContent.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Icon name="search" size={48} className="text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No related content found</h3>
        <p className="text-muted-foreground mb-4">
          We couldn't find similar content for this item
        </p>
        <Button onClick={() => onSearchSimilar('')} variant="outline">
          <Icon name="search" size={16} className="mr-2" />
          Browse All Content
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Analytics */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Icon name="brain" size={20} className="text-primary" />
            Related Content
          </h3>
          <p className="text-sm text-muted-foreground">
            AI-powered content recommendations
          </p>
        </div>
        
        {showAnalytics && (
          <div className="text-right text-sm text-muted-foreground">
            <div>{analytics.totalFound} similar items found</div>
            <div className={getConfidenceColor(analytics.avgSimilarity)}>
              {(analytics.avgSimilarity * 100).toFixed(0)}% avg similarity
            </div>
          </div>
        )}
      </div>

      {/* Related Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {relatedContent.map((item) => (
          <Card 
            key={item.contentId} 
            className="p-4 hover:shadow-md transition-all duration-200 cursor-pointer group"
            onClick={() => onContentClick(item)}
          >
            {/* Thumbnail Placeholder */}
            <div className="aspect-video bg-secondary rounded-lg mb-3 flex items-center justify-center group-hover:bg-secondary/80 transition-colors">
              <Icon name="play" size={32} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            
            {/* Content Info */}
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                  {item.metadata?.title || `Content ${item.contentId}`}
                </h4>
                <div className={`text-xs font-medium ml-2 ${getConfidenceColor(item.relevanceScore)}`}>
                  {(item.relevanceScore * 100).toFixed(0)}%
                </div>
              </div>
              
              {/* Metadata */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {item.metadata?.creatorName && (
                  <div className="flex items-center gap-1">
                    <Icon name="user" size={12} />
                    <span className="truncate">{item.metadata.creatorName}</span>
                  </div>
                )}
                
                {item.metadata?.duration && (
                  <div className="flex items-center gap-1">
                    <Icon name="clock" size={12} />
                    <span>{formatDuration(item.metadata.duration)}</span>
                  </div>
                )}
                
                {item.metadata?.viewCount && (
                  <div className="flex items-center gap-1">
                    <Icon name="eye" size={12} />
                    <span>{formatViewCount(item.metadata.viewCount)}</span>
                  </div>
                )}
              </div>
              
              {/* Matched Tags */}
              {item.matchedTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.matchedTags.slice(0, 3).map((tag, tagIndex) => (
                    <span
                      key={tagIndex}
                      className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full cursor-pointer hover:bg-primary/20 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSearchSimilar(tag);
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                  {item.matchedTags.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{item.matchedTags.length - 3}
                    </span>
                  )}
                </div>
              )}
              
              {/* Age Restriction Badge */}
              {item.metadata?.ageRestricted && (
                <div className="flex justify-end">
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                    18+
                  </span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          onClick={() => handleSearchByTags(
            relatedContent.flatMap(item => item.matchedTags).slice(0, 5)
          )}
        >
          <Icon name="search" size={16} className="mr-2" />
          Search Similar Tags
        </Button>
        
        <Button
          variant="outline"
          onClick={fetchRelatedContent}
        >
          <Icon name="refresh-cw" size={16} className="mr-2" />
          Refresh Recommendations
        </Button>
      </div>
    </div>
  );
};

export default RelatedContent;