import React, { useState, useEffect } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Spinner } from '../Spinner';
import { Icon } from '../Icon';

interface RecommendationResult {
  contentId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  category: string;
  tags: string[];
  performers: string[];
  duration: number;
  price: number;
  verified: boolean;
  premium: boolean;
  relevanceScore: number;
  personalizedScore: number;
  viewCount: number;
  averageRating: number;
  reasonForRecommendation: string;
}

interface PersonalizedRecommendationsProps {
  userId: string;
  excludeContentIds?: string[];
  onContentClick: (content: RecommendationResult) => void;
  onInteractionTrack: (contentId: string, interactionType: string) => void;
}

export const PersonalizedRecommendations: React.FC<PersonalizedRecommendationsProps> = ({
  userId,
  excludeContentIds = [],
  onContentClick,
  onInteractionTrack
}) => {
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [trending, setTrending] = useState<RecommendationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'for-you' | 'trending' | 'similar'>('for-you');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRecommendations();
    loadTrending();
  }, [userId, excludeContentIds]);

  const loadRecommendations = async () => {
    try {
      const excludeParam = excludeContentIds.length > 0 
        ? `&exclude=${excludeContentIds.join(',')}`
        : '';
      
      const response = await fetch(`/api/v1/advanced-search/recommendations?limit=12${excludeParam}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setRecommendations(data.data.recommendations.map((rec: any) => ({
          ...rec,
          reasonForRecommendation: generateRecommendationReason(rec)
        })));
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTrending = async () => {
    try {
      const response = await fetch('/api/v1/advanced-search/trending?timeframe=24h&limit=12', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setTrending(data.data.trending.map((item: any) => ({
          ...item,
          reasonForRecommendation: 'Trending in the last 24 hours'
        })));
      }
    } catch (error) {
      console.error('Error loading trending content:', error);
    }
  };

  const refreshRecommendations = async () => {
    setRefreshing(true);
    await loadRecommendations();
    setRefreshing(false);
  };

  const handleContentClick = (content: RecommendationResult) => {
    onInteractionTrack(content.contentId, 'click');
    onContentClick(content);
  };

  const handleContentLike = (contentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onInteractionTrack(contentId, 'like');
  };

  const generateRecommendationReason = (content: any): string => {
    if (content.personalizedScore > 0.8) {
      return 'Perfect match for your preferences';
    } else if (content.personalizedScore > 0.6) {
      return 'Based on your viewing history';
    } else if (content.category && content.personalizedScore > 0.4) {
      return `You enjoy ${content.category} content`;
    } else {
      return 'Popular with similar users';
    }
  };

  const renderContentCard = (content: RecommendationResult) => (
    <Card
      key={content.contentId}
      className="cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
      onClick={() => handleContentClick(content)}
    >
      <div className="aspect-video bg-gray-200 rounded-t-lg relative overflow-hidden">
        <img
          src={content.thumbnailUrl}
          alt={content.title}
          className="w-full h-full object-cover"
        />
        
        {/* Overlay badges */}
        <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          {content.duration}m
        </div>
        
        {content.premium && (
          <div className="absolute top-2 left-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-xs px-2 py-1 rounded font-medium">
            Premium
          </div>
        )}
        
        {content.personalizedScore > 0.7 && (
          <div className="absolute bottom-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
            <Icon name="target" size={12} className="inline mr-1" />
            {(content.personalizedScore * 100).toFixed(0)}% match
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
          <Button
            size="sm"
            className="opacity-0 hover:opacity-100 transition-opacity duration-200"
            onClick={(e) => {
              e.stopPropagation();
              handleContentClick(content);
            }}
          >
            <Icon name="play" size={16} className="mr-1" />
            Watch
          </Button>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">
            {content.title}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleContentLike(content.contentId, e)}
            className="ml-2 p-1"
          >
            <Icon name="heart" size={16} className="text-gray-400 hover:text-red-500" />
          </Button>
        </div>
        
        <div className="flex items-center space-x-2 mb-2">
          {content.verified && (
            <Icon name="check-circle" size={16} className="text-blue-500" />
          )}
          <span className="text-sm text-gray-600">{content.category}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>{content.viewCount.toLocaleString()} views</span>
          <div className="flex items-center">
            <Icon name="star" size={14} className="text-yellow-500 mr-1" />
            {content.averageRating.toFixed(1)}
          </div>
        </div>
        
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-lg text-gray-900">${content.price}</span>
        </div>
        
        <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
          <Icon name="lightbulb" size={12} className="inline mr-1" />
          {content.reasonForRecommendation}
        </div>
      </div>
    </Card>
  );

  const renderForYouTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Recommended for You</h2>
          <p className="text-gray-600">Personalized content based on your preferences and behavior</p>
        </div>
        <Button
          variant="outline"
          onClick={refreshRecommendations}
          disabled={refreshing}
        >
          {refreshing ? <Spinner size="sm" /> : <Icon name="refresh-cw" size={16} />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
          <span className="ml-3 text-gray-600">Loading recommendations...</span>
        </div>
      ) : recommendations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recommendations.map(renderContentCard)}
        </div>
      ) : (
        <div className="text-center py-12">
          <Icon name="target" size={48} className="text-gray-400 mb-4 mx-auto" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No recommendations yet</h3>
          <p className="text-gray-600 mb-4">
            Browse and interact with content to get personalized recommendations
          </p>
          <Button onClick={() => setActiveTab('trending')}>
            Check out trending content
          </Button>
        </div>
      )}
    </div>
  );

  const renderTrendingTab = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Trending Now</h2>
        <p className="text-gray-600">Popular content in the last 24 hours</p>
      </div>

      {trending.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {trending.map(renderContentCard)}
        </div>
      ) : (
        <div className="text-center py-12">
          <Icon name="trending-up" size={48} className="text-gray-400 mb-4 mx-auto" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No trending content</h3>
          <p className="text-gray-600">Check back later for trending content</p>
        </div>
      )}
    </div>
  );

  const renderSimilarTab = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Similar to Your Favorites</h2>
        <p className="text-gray-600">Content similar to what you've liked and purchased</p>
      </div>

      <div className="text-center py-12">
        <Icon name="heart" size={48} className="text-gray-400 mb-4 mx-auto" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Coming Soon</h3>
        <p className="text-gray-600">
          We're working on finding content similar to your favorites
        </p>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex space-x-8">
          {[
            { id: 'for-you', label: 'For You', icon: 'target' },
            { id: 'trending', label: 'Trending', icon: 'trending-up' },
            { id: 'similar', label: 'Similar', icon: 'heart' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon name={tab.icon as any} size={16} className="mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'for-you' && renderForYouTab()}
      {activeTab === 'trending' && renderTrendingTab()}
      {activeTab === 'similar' && renderSimilarTab()}
    </div>
  );
};