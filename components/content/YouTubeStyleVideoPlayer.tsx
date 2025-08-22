import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { VideoPlayer } from './VideoPlayer';
import { PlayerGuard } from './PlayerGuard';
import Icon from '../Icon';
import { useAuth } from '../../src/auth/AuthProvider'; // Import useAuth

interface Comment {
    id: string;
    author: string;
    avatar: string;
    content: string;
    timestamp: Date;
    likes: number;
    replies: Comment[];
    isLiked: boolean;
    isCreator?: boolean;
}

interface VideoData {
    id: string;
    title: string;
    creator: string;
    creatorAvatar?: string;
    subscribers: number;
    views: number;
    likes: number;
    dislikes: number;
    uploadDate: Date;
    description?: string;
    tags?: string[];
    isSubscribed: boolean;
    isLiked: boolean;
    isDisliked: boolean;
    isSaved: boolean;
}

interface YouTubeStyleVideoPlayerProps {
    videoSrc: string;
    videoData: VideoData;
    onClose: () => void;
    contentId?: string;
    isAdultContent?: boolean;
    ageRating?: '18+' | '21+';
    requiresEntitlement?: boolean;
    priceUSDC?: number;
    priceFiat?: number;
    className?: string;
}

export const YouTubeStyleVideoPlayer: React.FC<YouTubeStyleVideoPlayerProps> = ({
    videoSrc,
    videoData,
    onClose,
    contentId,
    isAdultContent = false,
    ageRating = '18+',
    requiresEntitlement = false,
    priceUSDC,
    priceFiat,
    className
}) => {
    const { requireAuth } = useAuth(); // Get requireAuth from AuthProvider
    const [showDescription, setShowDescription] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [sortBy, setSortBy] = useState<'top' | 'newest'>('top');
    const [isSubscribed, setIsSubscribed] = useState(videoData.isSubscribed);
    const [isLiked, setIsLiked] = useState(videoData.isLiked);
    const [isDisliked, setIsDisliked] = useState(videoData.isDisliked);
    const [isSaved, setIsSaved] = useState(videoData.isSaved);
    const [likes, setLikes] = useState(videoData.likes);
    const [subscribers, setSubscribers] = useState(videoData.subscribers || 0);
    const [isFullscreen, setIsFullscreen] = useState(false); // New state for fullscreen

    useEffect(() => {
        const mockComments: Comment[] = [
            { id: '1', author: 'TechReviewer', avatar: '/placeholder.svg', content: 'Amazing video!', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), likes: 234, replies: [], isLiked: false },
            { id: '2', author: 'AnimationFan2024', avatar: '/placeholder.svg', content: 'Great storytelling.', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), likes: 156, replies: [], isLiked: true },
            { id: '3', author: 'CreativeStudio', avatar: '/placeholder.svg', content: 'Stunning work!', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), likes: 89, replies: [], isLiked: false }
        ];
        setComments(mockComments);
    }, [videoData.id]);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    // Original handlers
    const _handleLike = () => {
        if (isLiked) {
            setIsLiked(false);
            setLikes(likes - 1);
        } else {
            setIsLiked(true);
            setIsDisliked(false);
            setLikes(likes + 1);
        }
    };

    const _handleSubscribe = () => {
        setIsSubscribed(!isSubscribed);
        setSubscribers(isSubscribed ? Math.max(0, subscribers - 1) : subscribers + 1);
    };

    const _handleAddComment = () => {
        if (!newComment.trim()) return;
        const comment: Comment = { id: Date.now().toString(), author: 'You', avatar: '/placeholder.svg', content: newComment, timestamp: new Date(), likes: 0, replies: [], isLiked: false };
        setComments([comment, ...comments]);
        setNewComment('');
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({ title: videoData.title, text: videoData.title, url: window.location.href });
        } else {
            navigator.clipboard.writeText(window.location.href);
            // eslint-disable-next-line no-alert
            alert('Link copied to clipboard!');
        }
    };

    // Wrapped handlers using requireAuth
    const handleLike = requireAuth(_handleLike);
    const handleSubscribe = requireAuth(_handleSubscribe);
    const handleAddComment = requireAuth(_handleAddComment);

    if (typeof document === 'undefined') return null;

        return ReactDOM.createPortal(
            <div className="fixed inset-0 bg-black z-50 overflow-y-auto youtube-style-player-portal">
            <div className="flex h-full">
                <div className="flex-1 flex flex-col">
                    <button onClick={onClose} className={`absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors ${isFullscreen ? 'hidden' : ''}`}>
                        <Icon name="x" size={24} className="text-white" />
                    </button>

                    <div className={`flex-1 flex items-center justify-center p-4 ${isFullscreen ? 'p-0' : ''}`}>
                        <div className={`w-full relative ${isFullscreen ? '' : 'max-w-6xl'}`}>
                            <PlayerGuard contentId={contentId || videoData.id} isAdultContent={isAdultContent} ageRating={ageRating} requiresEntitlement={requiresEntitlement} priceUSDC={priceUSDC} priceFiat={priceFiat}>
                                <VideoPlayer
                                    src={videoSrc}
                                    title={videoData.title}
                                    autoPlay
                                    className={`w-full aspect-video ${className || ''}`}
                                    contentId={contentId || videoData.id}
                                    enableMetrics
                                    onFullscreenChange={setIsFullscreen} // Pass the callback
                                />
                            </PlayerGuard>
                        </div>
                    </div>

                    <div className="bg-background border-t border-border p-4">
                        <div className="max-w-6xl mx-auto">
                            <h1 className="text-xl font-semibold mb-2 text-foreground">{videoData.title}</h1>
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-3">
                                    <img src={videoData.creatorAvatar || '/placeholder.svg'} alt={videoData.creator} className="w-10 h-10 rounded-full" />
                                    <div>
                                        <h3 className="font-medium text-foreground">{videoData.creator}</h3>
                                        <p className="text-sm text-muted-foreground">{formatNumber(subscribers)} subscribers</p>
                                    </div>
                                    <button onClick={handleSubscribe} className={`px-4 py-2 rounded-full font-medium transition-colors ${isSubscribed ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'}`}>
                                        {isSubscribed ? 'Subscribed' : 'Subscribe'}
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button onClick={handleLike} className="px-3 py-2 bg-muted rounded">{formatNumber(likes)} ❤</button>
                                    <button onClick={handleShare} className="px-3 py-2 bg-muted rounded">Share</button>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span>{formatNumber(videoData.views)} views</span>
                                <span>•</span>
                                <span>{formatTimeAgo(videoData.uploadDate)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`w-96 bg-background border-l border-border flex flex-col ${isFullscreen ? 'hidden' : ''}`}>
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-foreground">{comments.length} Comments</h3>
                            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'top' | 'newest')} className="text-sm bg-background border border-border rounded px-2 py-1">
                                <option value="top">Top comments</option>
                                <option value="newest">Newest first</option>
                            </select>
                        </div>

                        <div className="flex gap-3">
                            <img src="/placeholder.svg" alt="Your avatar" className="w-8 h-8 rounded-full flex-shrink-0" />
                            <div className="flex-1">
                                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." className="w-full bg-transparent border-b border-border focus:border-primary outline-none resize-none text-sm py-2" rows={1} />
                                {newComment && (
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button onClick={() => setNewComment('')} className="px-3 py-1 text-sm hover:bg-muted rounded">Cancel</button>
                                        <button onClick={handleAddComment} className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded">Comment</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {comments.map((c) => (
                            <div key={c.id} className="p-4 hover:bg-muted/30 transition-colors">
                                <div className="flex gap-3">
                                    <img src={c.avatar} alt={c.author} className="w-8 h-8 rounded-full" />
                                    <div>
                                        <div className="flex items-center gap-2 mb-1"><span className="font-medium">{c.author}</span><span className="text-xs text-muted-foreground">{formatTimeAgo(c.timestamp)}</span></div>
                                        <p className="text-sm text-foreground">{c.content}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
