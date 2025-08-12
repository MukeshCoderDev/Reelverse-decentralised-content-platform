import React, { useState } from 'react';
import { AdvancedSearch } from './AdvancedSearch';
import { searchService } from './SearchService';

interface SearchIntegrationProps {
  context: 'help' | 'content' | 'creators' | 'global';
  onNavigate?: (path: string) => void;
  className?: string;
}

export const SearchIntegration: React.FC<SearchIntegrationProps> = ({
  context,
  onNavigate,
  className = ''
}) => {
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Context-specific configurations
  const getSearchConfig = () => {
    switch (context) {
      case 'help':
        return {
          placeholder: "Search help articles, guides, and FAQs...",
          categories: ['Help', 'Tutorials', 'FAQ', 'Troubleshooting'],
          filters: [
            {
              key: 'difficulty',
              label: 'Difficulty Level',
              type: 'select' as const,
              options: [
                { value: 'beginner', label: 'Beginner' },
                { value: 'intermediate', label: 'Intermediate' },
                { value: 'advanced', label: 'Advanced' }
              ]
            },
            {
              key: 'topic',
              label: 'Topic',
              type: 'select' as const,
              options: [
                { value: 'streaming', label: 'Live Streaming' },
                { value: 'monetization', label: 'Monetization' },
                { value: 'analytics', label: 'Analytics' },
                { value: 'mobile', label: 'Mobile App' },
                { value: 'moderation', label: 'Moderation' }
              ]
            },
            {
              key: 'hasVideo', label: 'Has Video Tutorial', type: 'boolean' as const
            }
          ]
        };

      case 'content':
        return {
          placeholder: "Search your videos, streams, and content...",
          categories: ['Videos', 'Live Streams', 'Clips', 'Playlists'],
          filters: [
            {
              key: 'status',
              label: 'Status',
              type: 'select' as const,
              options: [
                { value: 'published', label: 'Published' },
                { value: 'draft', label: 'Draft' },
                { value: 'private', label: 'Private' },
                { value: 'unlisted', label: 'Unlisted' }
              ]
            },
            {
              key: 'duration',
              label: 'Duration',
              type: 'select' as const,
              options: [
                { value: 'short', label: 'Under 4 minutes' },
                { value: 'medium', label: '4-20 minutes' },
                { value: 'long', label: 'Over 20 minutes' }
              ]
            },
            {
              key: 'dateCreated', label: 'Created Date', type: 'date' as const },
            {
              key: 'monetized', label: 'Monetized', type: 'boolean' as const }
            ]
          ]
        };

      case 'creators':
        return {
          placeholder: "Discover creators and channels...",
          categories: ['Creators', 'Channels', 'Communities'],
          filters: [
            {
              key: 'followerCount',
              label: 'Followers',
              type: 'select' as const,
              options: [
                { value: 'small', label: '< 1K followers' },
                { value: 'medium', label: '1K - 100K followers' },
                { value: 'large', label: '> 100K followers' }
              ]
            },
            {
              key: 'category',
              label: 'Content Category',
              type: 'select' as const,
              options: [
                { value: 'gaming', label: 'Gaming' },
                { value: 'music', label: 'Music' },
                { value: 'art', label: 'Art & Design' },
                { value: 'education', label: 'Education' },
                { value: 'entertainment', label: 'Entertainment' }
              ]
            },
            {
              key: 'verified', label: 'Verified Only', type: 'boolean' as const },
            {
              key: 'liveNow', label: 'Live Now', type: 'boolean' as const }
            ]
          ]
        };

      default:
        return {
          placeholder: "Search everything...",
          categories: ['All', 'Help', 'Content', 'Creators', 'Features'],
          filters: [
            {
              key: 'type',
              label: 'Content Type',
              type: 'select' as const,
              options: [
                { value: 'article', label: 'Articles' },
                { value: 'video', label: 'Videos' },
                { value: 'creator', label: 'Creators' },
                { value: 'feature', label: 'Features' }
              ]
            },
            {
              key: 'recent', label: 'Recent Only', type: 'boolean' as const }
            ]
          ]
        };
    }
  };

  const config = getSearchConfig();

  const handleSearch = async (query: string, filters: Record<string, any>) => {
    try {
      // Apply context-specific filtering
      const searchOptions = {
        ...filters,
        category: context !== 'global' ? context : filters.category
      };

      const results = await searchService.search(query, searchOptions);
      setSearchResults(results);
      return results;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  };

  const handleResultSelect = (result: any) => {
    // Handle result selection based on context
    switch (context) {
      case 'help':
        onNavigate?.(`/help/${result.id}`);
        break;
      case 'content':
        onNavigate?.(`/content/${result.id}`);
        break;
      case 'creators':
        onNavigate?.(`/creator/${result.id}`);
        break;
      default:
        // Determine navigation based on result type
        if (result.category === 'Help') {
          onNavigate?.(`/help/${result.id}`);
        } else if (result.category === 'Videos') {
          onNavigate?.(`/watch/${result.id}`);
        } else if (result.category === 'Creators') {
          onNavigate?.(`/creator/${result.id}`);
        }
        break;
    }
  };

  return (
    <div className={`search-integration ${context} ${className}`}>
      <AdvancedSearch
        placeholder={config.placeholder}
        categories={config.categories}
        filters={config.filters}
        onSearch={handleSearch}
        onResultSelect={handleResultSelect}
        showSuggestions={true}
        showFilters={true}
      />

      {/* Context-specific quick actions */}
      {context === 'help' && (
        <div className="quick-help-links">
          <h4>Popular Help Topics</h4>
          <div className="quick-links">
            <button onClick={() => onNavigate?.('/help/getting-started')}>
              Getting Started
            </button>
            <button onClick={() => onNavigate?.('/help/live-streaming')}>
              Live Streaming Guide
            </button>
            <button onClick={() => onNavigate?.('/help/monetization')}>
              Monetization Help
            </button>
            <button onClick={() => onNavigate?.('/help/troubleshooting')}>
              Troubleshooting
            </button>
          </div>
        </div>
      )}

      {context === 'creators' && (
        <div className="creator-discovery">
          <h4>Trending Creators</h4>
          <div className="trending-creators">
            {/* Mock trending creators */}
            <div className="creator-card">
              <div className="creator-avatar">👤</div>
              <div className="creator-info">
                <div className="creator-name">TechStreamer</div>
                <div className="creator-stats">125K followers • Live</div>
              </div>
            </div>
            <div className="creator-card">
              <div className="creator-avatar">🎮</div>
              <div className="creator-info">
                <div className="creator-name">GameMaster</div>
                <div className="creator-stats">89K followers • Gaming</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {context === 'content' && (
        <div className="content-shortcuts">
          <h4>Quick Actions</h4>
          <div className="action-buttons">
            <button onClick={() => onNavigate?.('/upload')}>
              📤 Upload Video
            </button>
            <button onClick={() => onNavigate?.('/live')}>
              🔴 Go Live
            </button>
            <button onClick={() => onNavigate?.('/analytics')}>
              📊 View Analytics
            </button>
          </div>
        </div>
      )}
    </div>
  );
};