import React, { useState } from 'react';
import { LikedVideo, Playlist } from '../../pages/library/LikedPage';
import { VideoPlayer } from './VideoPlayer';
import Icon from '../Icon';
import Button from '../Button';

interface LikedVideoCardProps {
    video: LikedVideo;
    isSelected: boolean;
    onSelect: (selected: boolean) => void;
    playlists: Playlist[];
}

export const LikedVideoCard: React.FC<LikedVideoCardProps> = ({
    video,
    isSelected,
    onSelect,
    playlists
}) => {
    const [isLiked, setIsLiked] = useState(true);
    const [showQuickActions, setShowQuickActions] = useState(false);
    const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
    const [likeAnimation, setLikeAnimation] = useState(false);
    const [showVideoPlayer, setShowVideoPlayer] = useState(false);

    const formatNumber = (num?: number) => {
        if (!num) return '';
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const formatDate = (date: Date) => {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
        return `${Math.ceil(diffDays / 365)} years ago`;
    };

    // TikTok-style quick like/unlike with animation
    const handleQuickLike = (e: React.MouseEvent) => {
        e.stopPropagation();
        setLikeAnimation(true);
        setIsLiked(!isLiked);
        
        // Reset animation after completion
        setTimeout(() => setLikeAnimation(false), 600);
    };

    const handleAddToPlaylist = (playlistId: string) => {
        console.log(`Adding video ${video.id} to playlist ${playlistId}`);
        setShowPlaylistMenu(false);
    };

    const handlePlayVideo = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowVideoPlayer(true);
    };

    return (
        <div 
            className="group cursor-pointer relative"
            onMouseEnter={() => setShowQuickActions(true)}
            onMouseLeave={() => {
                setShowQuickActions(false);
                setShowPlaylistMenu(false);
            }}
        >
            {/* Selection checkbox - YouTube style */}
            <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                        e.stopPropagation();
                        onSelect(e.target.checked);
                    }}
                    className="w-4 h-4 rounded border-2 border-white bg-black/50 checked:bg-primary checked:border-primary"
                />
            </div>

            {/* Video thumbnail */}
            <div className="relative mb-3 overflow-hidden rounded-lg bg-muted aspect-video">
                <img 
                    src={video.thumbnail || "/placeholder.svg"} 
                    alt={video.title} 
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]" 
                />
                
                {/* Duration overlay */}
                <div className="absolute bottom-2 right-2 bg-black/80 text-white px-1.5 py-0.5 rounded text-xs">
                    {Math.floor(Math.random() * 10 + 2)}:{String(Math.floor(Math.random() * 60)).padStart(2, '0')}
                </div>
                
                {/* TikTok-style quick actions overlay */}
                <div className={`absolute inset-0 bg-black/60 transition-opacity duration-200 flex items-center justify-center ${
                    showQuickActions ? 'opacity-100' : 'opacity-0'
                }`}>
                    <div className="flex items-center gap-4 text-white">
                        {/* Play button */}
                        <button 
                            onClick={handlePlayVideo}
                            className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                        >
                            <Icon name="play" size={24} />
                        </button>
                        
                        {/* Quick like with animation */}
                        <button 
                            onClick={handleQuickLike}
                            className={`p-2 rounded-full transition-all duration-300 ${
                                isLiked ? 'bg-red-500 text-white' : 'bg-white/20 hover:bg-white/30'
                            } ${likeAnimation ? 'scale-125' : 'scale-100'}`}
                        >
                            <Icon name="heart" size={20} className={isLiked ? 'fill-current' : ''} />
                        </button>
                        
                        {/* Add to playlist */}
                        <div className="relative">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowPlaylistMenu(!showPlaylistMenu);
                                }}
                                className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                            >
                                <Icon name="folder" size={20} />
                            </button>
                            
                            {/* Playlist dropdown */}
                            {showPlaylistMenu && (
                                <div className="absolute top-full right-0 mt-2 w-48 bg-background border border-border rounded-lg shadow-lg z-20">
                                    <div className="p-2">
                                        <div className="text-sm font-medium mb-2 text-foreground">Add to playlist</div>
                                        {playlists.map(playlist => (
                                            <button
                                                key={playlist.id}
                                                onClick={() => handleAddToPlaylist(playlist.id)}
                                                className="w-full text-left px-2 py-1 text-sm hover:bg-muted rounded text-foreground"
                                            >
                                                {playlist.name}
                                            </button>
                                        ))}
                                        <hr className="my-2 border-border" />
                                        <button className="w-full text-left px-2 py-1 text-sm hover:bg-muted rounded text-primary">
                                            <Icon name="plus" size={14} className="inline mr-2" />
                                            Create new playlist
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Share button */}
                        <button className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
                            <Icon name="share" size={20} />
                        </button>
                    </div>
                </div>

                {/* Like animation hearts - TikTok style */}
                {likeAnimation && (
                    <div className="absolute inset-0 pointer-events-none">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute animate-ping"
                                style={{
                                    left: `${20 + Math.random() * 60}%`,
                                    top: `${20 + Math.random() * 60}%`,
                                    animationDelay: `${i * 100}ms`,
                                    animationDuration: '600ms'
                                }}
                            >
                                <Icon name="heart" size={16} className="text-red-500 fill-current" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Video info */}
            <div className="space-y-2">
                <h4 className="line-clamp-2 text-sm font-medium group-hover:text-primary transition-colors">
                    {video.title}
                </h4>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div>
                        <p>{video.creator}</p>
                        <p>{video.views} • {video.ago}</p>
                    </div>
                    
                    {/* Engagement metrics - TikTok style */}
                    <div className="flex items-center gap-3">
                        {video.likes && (
                            <div className="flex items-center gap-1">
                                <Icon name="heart" size={12} />
                                <span>{formatNumber(video.likes)}</span>
                            </div>
                        )}
                        {video.comments && (
                            <div className="flex items-center gap-1">
                                <Icon name="message-circle" size={12} />
                                <span>{formatNumber(video.comments)}</span>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Liked date and tags */}
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                        Liked {formatDate(video.likedAt)}
                    </span>
                    
                    {/* Tags */}
                    {video.tags.length > 0 && (
                        <div className="flex gap-1">
                            {video.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-xs">
                                    {tag}
                                </span>
                            ))}
                            {video.tags.length > 2 && (
                                <span className="text-muted-foreground">+{video.tags.length - 2}</span>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Personal notes preview */}
                {video.personalNotes && (
                    <div className="text-xs text-muted-foreground italic line-clamp-1">
                        "{video.personalNotes}"
                    </div>
                )}
            </div>

            {/* Video Player Modal */}
            {showVideoPlayer && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
                    <div className="relative w-full max-w-4xl">
                        {/* Close button */}
                        <button
                            onClick={() => setShowVideoPlayer(false)}
                            className="absolute -top-12 right-0 p-2 text-white hover:bg-white/20 rounded-full transition-colors z-10"
                        >
                            <Icon name="x" size={24} />
                        </button>
                        
                        {/* Video Player */}
                        <VideoPlayer
                            src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
                            title={video.title}
                            poster={video.thumbnail}
                            autoPlay={true}
                            className="aspect-video"
                        />
                        
                        {/* Video Info */}
                        <div className="mt-4 text-white">
                            <h3 className="text-xl font-semibold mb-2">{video.title}</h3>
                            <div className="flex items-center justify-between text-sm text-white/80">
                                <div>
                                    <p>{video.creator} • {video.views} • {video.ago}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    {video.likes && (
                                        <div className="flex items-center gap-1">
                                            <Icon name="heart" size={16} />
                                            <span>{formatNumber(video.likes)}</span>
                                        </div>
                                    )}
                                    {video.comments && (
                                        <div className="flex items-center gap-1">
                                            <Icon name="message-circle" size={16} />
                                            <span>{formatNumber(video.comments)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};