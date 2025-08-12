import React from 'react';
import { LikedVideo } from '../../pages/library/LikedPage';
import { ContentCard } from './ContentCard';
import { Content } from '../../types';
import Icon from '../Icon';

interface ContentDiscoveryProps {
    likedVideos: LikedVideo[];
    onClose: () => void;
}

export const ContentDiscovery: React.FC<ContentDiscoveryProps> = ({
    likedVideos,
    onClose
}) => {
    // Analyze liked videos to generate suggestions
    const generateSuggestions = (): Content[] => {
        // Get most common tags from liked videos
        const tagCounts = likedVideos.reduce((acc, video) => {
            video.tags.forEach(tag => {
                acc[tag] = (acc[tag] || 0) + 1;
            });
            return acc;
        }, {} as Record<string, number>);

        const topTags = Object.entries(tagCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([tag]) => tag);

        // Get most liked creators
        const creatorCounts = likedVideos.reduce((acc, video) => {
            acc[video.creator] = (acc[video.creator] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const topCreators = Object.entries(creatorCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([creator]) => creator);

        // Generate mock suggestions based on patterns
        const suggestions: Content[] = [
            {
                id: 'suggest-1',
                title: `More ${topTags[0] || 'music'} content you might like`,
                creator: topCreators[0] || 'Popular Creator',
                views: '2.1M views',
                ago: '2 days ago',
                thumbnail: '/placeholder.svg',
                likes: 45000,
                comments: 1200,
                trending: true,
                algorithmHint: `Because you like ${topTags[0] || 'music'}`
            },
            {
                id: 'suggest-2',
                title: `Similar to your recent likes`,
                creator: topCreators[1] || 'Trending Creator',
                views: '890K views',
                ago: '1 day ago',
                thumbnail: '/placeholder.svg',
                likes: 23000,
                comments: 890,
                algorithmHint: 'Based on your viewing patterns'
            },
            {
                id: 'suggest-3',
                title: `New from ${topCreators[0] || 'your favorite creators'}`,
                creator: topCreators[0] || 'Favorite Creator',
                views: '1.5M views',
                ago: '3 hours ago',
                thumbnail: '/placeholder.svg',
                likes: 67000,
                comments: 2100,
                trending: true,
                algorithmHint: 'From creators you love'
            },
            {
                id: 'suggest-4',
                title: `Trending in ${topTags[1] || 'entertainment'}`,
                creator: 'Rising Star',
                views: '3.2M views',
                ago: '1 day ago',
                thumbnail: '/placeholder.svg',
                likes: 120000,
                comments: 4500,
                trending: true,
                algorithmHint: `Popular in ${topTags[1] || 'entertainment'}`
            }
        ];

        return suggestions;
    };

    const suggestions = generateSuggestions();

    return (
        <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg p-6 border border-primary/20">
            {/* Header with TikTok-style discovery branding */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                        <Icon name="trending-up" size={20} className="text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                            Discover More
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Based on your {likedVideos.length} liked videos
                        </p>
                    </div>
                </div>
                
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-muted rounded-full transition-colors"
                    title="Hide suggestions"
                >
                    <Icon name="x" size={16} />
                </button>
            </div>

            {/* Suggestions grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {suggestions.map((suggestion) => (
                    <div key={suggestion.id} className="relative">
                        <ContentCard {...suggestion} />
                        
                        {/* TikTok-style discovery badge */}
                        <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                            <Icon name="trending-up" size={10} />
                            Suggested
                        </div>
                    </div>
                ))}
            </div>

            {/* Discovery insights */}
            <div className="mt-6 pt-4 border-t border-border">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Icon name="heart" size={14} className="text-red-500" />
                        <span>You love {likedVideos.reduce((acc, v) => acc + (v.tags.includes('music') ? 1 : 0), 0)} music videos</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Icon name="user" size={14} className="text-blue-500" />
                        <span>Following {new Set(likedVideos.map(v => v.creator)).size} unique creators</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Icon name="clock" size={14} className="text-green-500" />
                        <span>Most active in the last 30 days</span>
                    </div>
                </div>
            </div>

            {/* Call to action */}
            <div className="mt-4 text-center">
                <button className="px-6 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors text-sm font-medium">
                    Explore More Content
                </button>
            </div>
        </div>
    );
};