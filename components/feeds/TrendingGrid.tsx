
import React, { useState } from 'react';
import { Content } from '../../types';
import Icon from '../Icon';

interface TrendingGridProps {
    items: Content[];
    category?: string;
}

const TrendingCard: React.FC<{ content: Content; index: number }> = ({ content, index }) => {
    const [isHovered, setIsHovered] = useState(false);

    const formatNumber = (num?: number) => {
        if (!num) return '0';
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    return (
        <div 
            className="group cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted">
                <img 
                    src={content.thumbnail || "/placeholder.svg"} 
                    alt={content.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                
                {/* TikTok-style gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                {/* Trending rank badge */}
                {index < 3 && (
                    <div className="absolute top-3 left-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                            index === 0 ? 'bg-yellow-500' : 
                            index === 1 ? 'bg-gray-400' : 
                            'bg-orange-600'
                        }`}>
                            {index + 1}
                        </div>
                    </div>
                )}

                {/* Trending indicator */}
                {content.trending && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                        <Icon name="flame" size={12} />
                        <span>HOT</span>
                    </div>
                )}

                {/* Play button overlay */}
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                    isHovered ? 'opacity-100' : 'opacity-0'
                }`}>
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <Icon name="play" size={24} className="text-white ml-1" />
                    </div>
                </div>

                {/* Content info */}
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm line-clamp-2 leading-tight">
                            {content.title}
                        </h3>
                        
                        <div className="flex items-center gap-2 text-xs">
                            <img 
                                src={`https://picsum.photos/seed/${content.creator}/24/24`}
                                alt={content.creator}
                                className="w-5 h-5 rounded-full"
                            />
                            <span className="font-medium">{content.creator}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-white/80">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                    <Icon name="eye" size={12} />
                                    <span>{content.views}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Icon name="heart" size={12} />
                                    <span>{formatNumber(content.likes)}</span>
                                </div>
                            </div>
                            <span>{content.ago}</span>
                        </div>
                    </div>
                </div>

                {/* Hover actions */}
                <div className={`absolute top-1/2 right-4 -translate-y-1/2 flex flex-col gap-3 transition-all duration-200 ${
                    isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                }`}>
                    <button className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
                        <Icon name="heart" size={16} className="text-white" />
                    </button>
                    <button className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
                        <Icon name="share" size={16} className="text-white" />
                    </button>
                    <button className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
                        <Icon name="star" size={16} className="text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
};

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
                    <TrendingCard 
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
