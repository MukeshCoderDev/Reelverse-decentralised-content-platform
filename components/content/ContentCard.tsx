
import React from 'react';
import { Content } from '../../types';
import Icon from '../Icon';

export const ContentCard: React.FC<Content> = ({ 
    title, 
    creator, 
    views, 
    ago, 
    thumbnail, 
    likes, 
    comments, 
    trending, 
    algorithmHint 
}) => {
    const formatNumber = (num?: number) => {
        if (!num) return '';
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    return (
        <div className="group cursor-pointer">
            <div className="relative mb-2 overflow-hidden rounded-lg bg-muted aspect-video">
                <img 
                    src={thumbnail || "/placeholder.svg"} 
                    alt={title} 
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]" 
                />
                
                {/* TikTok-style trending badge */}
                {trending && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                        <Icon name="flame" size={12} />
                        Trending
                    </div>
                )}
                
                {/* YouTube-style duration overlay */}
                <div className="absolute bottom-2 right-2 bg-black/80 text-white px-1.5 py-0.5 rounded text-xs">
                    {Math.floor(Math.random() * 10 + 2)}:{String(Math.floor(Math.random() * 60)).padStart(2, '0')}
                </div>
                
                {/* Hover overlay with TikTok-style engagement */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <div className="flex items-center gap-4 text-white">
                        {likes && (
                            <div className="flex items-center gap-1">
                                <Icon name="heart" size={16} />
                                <span className="text-sm">{formatNumber(likes)}</span>
                            </div>
                        )}
                        {comments && (
                            <div className="flex items-center gap-1">
                                <Icon name="message-circle" size={16} />
                                <span className="text-sm">{formatNumber(comments)}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1">
                            <Icon name="play" size={20} />
                        </div>
                    </div>
                </div>
            </div>
            
            <div>
                <h4 className="line-clamp-2 text-sm font-medium group-hover:text-primary transition-colors">
                    {title}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                    {creator} • {views} • {ago}
                </p>
                
                {/* YouTube-style algorithm hint */}
                {algorithmHint && (
                    <p className="mt-1 text-xs text-blue-500 flex items-center gap-1">
                        <Icon name="trending-up" size={12} />
                        {algorithmHint}
                    </p>
                )}
            </div>
        </div>
    );
};
