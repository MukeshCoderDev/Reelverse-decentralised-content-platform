
import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Content } from '../../types';
import Icon from '../Icon';
import VideoCard from '../video/VideoCard';

interface TrendingGridProps {
    items: Content[];
    category?: string;
}

// Enhanced VideoCard for trending with rank badge and special styling
const TrendingVideoCard: React.FC<{ content: Content; index: number }> = ({ content, index }) => {
    const location = useLocation();
    
    // Convert Content to VideoCard props
    const videoCardProps = {
        id: content.id,
        title: content.title,
        posterUrl: content.thumbnail || '/placeholder.svg',
        durationSec: Math.floor(Math.random() * 600 + 60), // Mock duration
        authorName: content.creator,
        views: parseViewCount(content.views),
    };
    
    return (
        <div className="relative">
            {/* Trending rank badge for top 3 */}
            {index < 3 && (
                <div className="absolute top-2 left-2 z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        'bg-orange-600'
                    }`}>
                        {index + 1}
                    </div>
                </div>
            )}
            
            {/* Hot badge for trending content */}
            {content.trending && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                    <Icon name="flame" size={12} />
                    <span>HOT</span>
                </div>
            )}
            
            <VideoCard 
                {...videoCardProps}
                className="aspect-[3/4] transition-transform hover:scale-[1.02]"
            />
        </div>
    );
};

// Parse view count string to number
function parseViewCount(viewsStr: string): number {
    if (!viewsStr) return 0;
    
    const cleaned = viewsStr.toLowerCase().replace(/[^0-9.kmb]/g, '');
    const num = parseFloat(cleaned);
    
    if (cleaned.includes('k')) return Math.floor(num * 1000);
    if (cleaned.includes('m')) return Math.floor(num * 1000000);
    if (cleaned.includes('b')) return Math.floor(num * 1000000000);
    
    return Math.floor(num) || 0;
}
export function TrendingGrid({ items, category }: TrendingGridProps) {
    // Sort items by engagement for trending
    const sortedItems = [...items].sort((a, b) => {
        const aEngagement = (a.likes || 0) + (a.comments || 0) + (a.shares || 0);
        const bEngagement = (b.likes || 0) + (b.comments || 0) + (b.shares || 0);
        return bEngagement - aEngagement;
    });

    return (
        <div className="space-y-6">
            {/* Category header */}
            {category && category !== 'all' && (
                <div className="flex items-center gap-2 mb-6">
                    <Icon name="flame" size={20} className="text-red-500" />
                    <h2 className="text-lg font-semibold capitalize">Trending in {category}</h2>
                </div>
            )}

            {/* TikTok-style masonry grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedItems.map((item, index) => (
                    <TrendingVideoCard 
                        key={`${item.id}-${index}`} 
                        content={item} 
                        index={index}
                    />
                ))}
            </div>

            {/* Load more */}
            <div className="flex justify-center pt-8">
                <button className="flex items-center gap-2 px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-full transition-colors">
                    <Icon name="trending-up" size={16} />
                    <span>Load More Trending</span>
                </button>
            </div>
        </div>
    );
}
