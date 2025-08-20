
import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { EmptyState } from '../shared/EmptyState';
import { Content } from '../../types';
import Icon from '../Icon';
import Button from '../Button';
import { YouTubeStyleVideoPlayer } from '../content/YouTubeStyleVideoPlayer';

interface VerticalFeedProps {
    fetcher: () => Promise<Content[]>;
    compact?: boolean; // when true, render full-bleed, h-screen cards (TikTok-like)
}

const TikTokStyleCard: React.FC<{ content: Content; isActive?: boolean; compact?: boolean }> = ({ content, isActive = false, compact = false }) => {
    const location = useLocation();

    const formatNumber = (num?: number) => {
        if (!num) return '0';
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    return (
        <Link
            to={`/watch/${content.id}`}
            state={{ from: location.pathname, scrollY: window.scrollY }}
            className={`relative w-full ${compact ? 'h-screen max-h-none rounded-none' : 'h-screen max-h-[80vh] rounded-2xl'} bg-black overflow-hidden group block`}
        >
            {/* Video/Image Content */}
            <div className="relative w-full h-full">
                {content.thumbnail ? (
                    <div className="relative w-full h-full">
                        <img
                            src={content.thumbnail}
                            alt={content.title}
                            className="w-full h-full object-cover"
                        />
                        {/* Play button overlay */}
                        <div
                            className="absolute inset-0 flex items-center justify-center cursor-pointer"
                        >
                            <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                                <Icon name="play" size={24} className="text-white ml-1" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Icon name="video" size={48} className="text-white" />
                    </div>
                )}

                {/* TikTok-style gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>

            {/* Content Info - Bottom Left */}
            <div className={`absolute bottom-0 left-0 ${compact ? 'right-0' : 'right-16'} p-4 text-white`}>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <img
                            src={`https://picsum.photos/seed/${content.creator}/32/32`}
                            alt={content.creator}
                            className="w-8 h-8 rounded-full"
                        />
                        <span className="font-semibold">{content.creator}</span>
                        <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 text-xs">
                            Follow
                        </Button>
                    </div>
                    
                    <p className="text-sm line-clamp-2 font-medium">
                        {content.title}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-white/80">
                        <span>{content.views}</span>
                        <span>{content.ago}</span>
                        {content.trending && (
                            <div className="flex items-center gap-1 text-red-400">
                                <Icon name="flame" size={12} />
                                <span>Trending</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* TikTok-style Action Buttons - Right Side */}
                <div className={`absolute ${compact ? 'right-3 bottom-28' : 'right-4 bottom-20'} flex flex-col items-center gap-6`}>
                <button className="flex flex-col items-center gap-1 text-white" onClick={(e) => e.stopPropagation()}>
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
                        <Icon name="heart" size={20} />
                    </div>
                    <span className="text-xs">{formatNumber(content.likes)}</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-white" onClick={(e) => e.stopPropagation()}>
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
                        <Icon name="message-circle" size={20} />
                    </div>
                    <span className="text-xs">{formatNumber(content.comments)}</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-white" onClick={(e) => e.stopPropagation()}>
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
                        <Icon name="share" size={20} />
                    </div>
                    <span className="text-xs">{formatNumber(content.shares)}</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-white" onClick={(e) => e.stopPropagation()}>
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
                        <Icon name="star" size={20} />
                    </div>
                    <span className="text-xs">Save</span>
                </button>
            </div>

            {/* Algorithm hint */}
            {content.algorithmHint && (
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
                    <p className="text-xs text-white flex items-center gap-1">
                        <Icon name="trending-up" size={12} />
                        {content.algorithmHint}
                    </p>
                </div>
            )}
        </Link>
    );
};

export function VerticalFeed({ fetcher, compact = false }: VerticalFeedProps) {
    const [items, setItems] = useState<Content[] | null>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => { 
        fetcher()
            .then(setItems)
            .finally(() => setLoading(false));
    }, [fetcher]);
    
    if (loading) {
        return (
            <div className="space-y-4 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="w-full h-96 animate-pulse rounded-2xl bg-muted" />
                ))}
            </div>
        );
    }
    
    if (!items || items.length === 0) {
        return (
            <div className="flex items-center justify-center h-96">
                <EmptyState 
                    icon="users" 
                    title="No Content Yet" 
                    subtitle="Follow creators to see their latest content here."
                />
            </div>
        );
    }
        
    return (
        <div className={`${compact ? '' : 'space-y-4 p-4'}`}>
            {items.map((item, i) => (
                <TikTokStyleCard
                    key={`${item.id}-${i}`}
                    content={item}
                    isActive={i === 0}
                    compact={compact}
                />
            ))}
            
            {/* Load more indicator */}
            <div className="flex justify-center py-8">
                <Button variant="outline" className="rounded-full">
                    <Icon name="trending-up" className="mr-2" size={16} />
                    Load More Content
                </Button>
            </div>
        </div>
    );
}
