
import React, { useState } from 'react';
import { Content } from '../../types';
import { YouTubeStyleVideoPlayer } from './YouTubeStyleVideoPlayer';
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
    const [showVideoPlayer, setShowVideoPlayer] = useState(false);
    
    const formatNumber = (num?: number) => {
        if (!num) return '';
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const handlePlayVideo = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log('Play video clicked for:', title);
        setShowVideoPlayer(true);
    };

    return (
        <div className="group cursor-pointer">
            <div 
                className="relative mb-2 overflow-hidden rounded-lg bg-muted aspect-video hover:ring-2 hover:ring-primary transition-all duration-200"
                onClick={handlePlayVideo}
            >
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
                
                {/* Always visible play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <button 
                        onClick={handlePlayVideo}
                        className="p-4 bg-black/50 rounded-full hover:bg-black/70 transition-all duration-200 hover:scale-110"
                        title="Play video"
                    >
                        <Icon name="play" size={32} className="text-white ml-1" />
                    </button>
                </div>

                {/* Hover overlay with TikTok-style engagement */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-4">
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

            {/* YouTube-Style Video Player Modal */}
            {showVideoPlayer && (
                <YouTubeStyleVideoPlayer
                    videoSrc="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
                    videoData={{
                        id: '1',
                        title: title,
                        creator: creator,
                        creatorAvatar: '/placeholder.svg',
                        subscribers: Math.floor(Math.random() * 1000000) + 100000,
                        views: parseInt(views.replace(/[^\d]/g, '')) || Math.floor(Math.random() * 10000000),
                        likes: likes || Math.floor(Math.random() * 50000) + 1000,
                        dislikes: Math.floor(Math.random() * 1000) + 50,
                        uploadDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                        description: `Amazing ${title.toLowerCase()} content! This video showcases incredible storytelling and animation quality.\n\nIn this video, we explore the fascinating world of digital content creation and the future of entertainment platforms.\n\n🎬 What you'll see:\n• Professional animation techniques\n• Cutting-edge visual effects\n• Compelling narrative structure\n• Industry-leading production values\n\n👍 Like this video if you enjoyed it!\n💬 Let us know your thoughts in the comments\n🔔 Subscribe for more amazing content\n\n#Animation #DigitalContent #Entertainment #Reelverse`,
                        tags: ['animation', 'entertainment', 'digital', 'content'],
                        isSubscribed: false,
                        isLiked: false,
                        isDisliked: false,
                        isSaved: false
                    }}
                    onClose={() => setShowVideoPlayer(false)}
                />
            )}
        </div>
    );
};
