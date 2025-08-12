import React, { useState } from 'react';
import { LikedVideo, Playlist } from '../../pages/library/LikedPage';
import Icon from '../Icon';

interface LikedVideoListItemProps {
    video: LikedVideo;
    index: number;
    isSelected: boolean;
    onSelect: (selected: boolean) => void;
    playlists: Playlist[];
}

export const LikedVideoListItem: React.FC<LikedVideoListItemProps> = ({
    video,
    index,
    isSelected,
    onSelect,
    playlists
}) => {
    const [isLiked, setIsLiked] = useState(true);
    const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
    const [likeAnimation, setLikeAnimation] = useState(false);

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

    const handleQuickLike = (e: React.MouseEvent) => {
        e.stopPropagation();
        setLikeAnimation(true);
        setIsLiked(!isLiked);
        
        setTimeout(() => setLikeAnimation(false), 600);
    };

    const handleAddToPlaylist = (playlistId: string) => {
        console.log(`Adding video ${video.id} to playlist ${playlistId}`);
        setShowPlaylistMenu(false);
    };

    return (
        <div className="group flex items-center gap-4 p-3 hover:bg-muted/50 rounded-lg transition-colors">
            {/* Index and selection */}
            <div className="flex items-center gap-3 w-12">
                <div className="opacity-100 group-hover:opacity-0 transition-opacity text-sm text-muted-foreground">
                    {index}
                </div>
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelect(e.target.checked)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded border-border"
                />
            </div>

            {/* Thumbnail */}
            <div className="relative w-32 h-18 flex-shrink-0 overflow-hidden rounded bg-muted">
                <img 
                    src={video.thumbnail || "/placeholder.svg"} 
                    alt={video.title} 
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" 
                />
                <div className="absolute bottom-1 right-1 bg-black/80 text-white px-1 py-0.5 rounded text-xs">
                    {Math.floor(Math.random() * 10 + 2)}:{String(Math.floor(Math.random() * 60)).padStart(2, '0')}
                </div>
            </div>

            {/* Video info */}
            <div className="flex-1 min-w-0 space-y-1">
                <h4 className="font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {video.title}
                </h4>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{video.creator}</span>
                    <span>•</span>
                    <span>{video.views}</span>
                    <span>•</span>
                    <span>{video.ago}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Liked {formatDate(video.likedAt)}</span>
                    {video.tags.length > 0 && (
                        <div className="flex gap-1">
                            {video.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 bg-muted rounded">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                {video.personalNotes && (
                    <div className="text-xs text-muted-foreground italic line-clamp-1">
                        "{video.personalNotes}"
                    </div>
                )}
            </div>

            {/* Engagement metrics */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {video.likes && (
                    <div className="flex items-center gap-1">
                        <Icon name="heart" size={14} />
                        <span>{formatNumber(video.likes)}</span>
                    </div>
                )}
                {video.comments && (
                    <div className="flex items-center gap-1">
                        <Icon name="message-circle" size={14} />
                        <span>{formatNumber(video.comments)}</span>
                    </div>
                )}
            </div>

            {/* Quick actions - TikTok style */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Quick like */}
                <button 
                    onClick={handleQuickLike}
                    className={`p-2 rounded-full transition-all duration-300 ${
                        isLiked ? 'bg-red-500 text-white' : 'bg-muted hover:bg-muted/80'
                    } ${likeAnimation ? 'scale-125' : 'scale-100'}`}
                    title={isLiked ? 'Unlike' : 'Like'}
                >
                    <Icon name="heart" size={16} className={isLiked ? 'fill-current' : ''} />
                </button>
                
                {/* Add to playlist */}
                <div className="relative">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowPlaylistMenu(!showPlaylistMenu);
                        }}
                        className="p-2 bg-muted hover:bg-muted/80 rounded-full transition-colors"
                        title="Add to playlist"
                    >
                        <Icon name="folder" size={16} />
                    </button>
                    
                    {showPlaylistMenu && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-background border border-border rounded-lg shadow-lg z-20">
                            <div className="p-2">
                                <div className="text-sm font-medium mb-2">Add to playlist</div>
                                {playlists.map(playlist => (
                                    <button
                                        key={playlist.id}
                                        onClick={() => handleAddToPlaylist(playlist.id)}
                                        className="w-full text-left px-2 py-1 text-sm hover:bg-muted rounded"
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
                
                {/* Share */}
                <button 
                    className="p-2 bg-muted hover:bg-muted/80 rounded-full transition-colors"
                    title="Share"
                >
                    <Icon name="share" size={16} />
                </button>
                
                {/* More options */}
                <button 
                    className="p-2 bg-muted hover:bg-muted/80 rounded-full transition-colors"
                    title="More options"
                >
                    <Icon name="more-horizontal" size={16} />
                </button>
            </div>

            {/* Like animation overlay */}
            {likeAnimation && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <Icon name="heart" size={32} className="text-red-500 fill-current animate-ping" />
                </div>
            )}
        </div>
    );
};