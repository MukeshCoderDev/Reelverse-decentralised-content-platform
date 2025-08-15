import React, { useState, useRef, useEffect } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { PlayerGuard } from './PlayerGuard';
import Icon from '../Icon';

interface Comment {
    id: string;
    author: string;
    avatar: string;
    content: string;
    timestamp: Date;
    likes: number;
    replies: Comment[];
    isLiked: boolean;
    isPinned?: boolean;
    isCreator?: boolean;
}

interface VideoData {
    id: string;
    title: string;
    creator: string;
    creatorAvatar: string;
    subscribers: number;
    views: number;
    likes: number;
    dislikes: number;
    uploadDate: Date;
    description: string;
    tags: string[];
    isSubscribed: boolean;
    isLiked: boolean;
    isDisliked: boolean;
    isSaved: boolean;
}

interface YouTubeStyleVideoPlayerProps {
    videoSrc: string;
    videoData: VideoData;
    onClose: () => void;
    // Access control props
    contentId?: string;
    isAdultContent?: boolean;
    ageRating?: '18+' | '21+';
    requiresEntitlement?: boolean;
    priceUSDC?: number;
    priceFiat?: number;
}

export const YouTubeStyleVideoPlayer: React.FC<YouTubeStyleVideoPlayerProps> = ({
    videoSrc,
    videoData,
    onClose,
    contentId = videoData.id,
    isAdultContent = false,
    ageRating = '18+',
    requiresEntitlement = false,
    priceUSDC,
    priceFiat
}) => {
    const [showDescription, setShowDescription] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [sortBy, setSortBy] = useState<'top' | 'newest'>('top');
    const [isSubscribed, setIsSubscribed] = useState(videoData.isSubscribed);
    const [isLiked, setIsLiked] = useState(videoData.isLiked);
    const [isDisliked, setIsDisliked] = useState(videoData.isDisliked);
    const [isSaved, setIsSaved] = useState(videoData.isSaved);
    const [likes, setLikes] = useState(videoData.likes);
    const [subscribers, setSubscribers] = useState(videoData.subscribers);

    // Mock comments data
    useEffect(() => {
        const mockComments: Comment[] = [
            {
                id: '1',
                author: 'TechReviewer',
                avatar: '/placeholder.svg',
                content: 'Amazing video! The animation quality is incredible. This is exactly what we need more of on the platform.',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
                likes: 234,
                replies: [
                    {
                        id: '1-1',
                        author: videoData.creator,
                        avatar: videoData.creatorAvatar,
                        content: 'Thank you so much! Really appreciate the support 🙏',
                        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
                        likes: 45,
                        replies: [],
                        isLiked: false,
                        isCreator: true
                    }
                ],
                isLiked: false,
                isPinned: true
            },
            {
                id: '2',
                author: 'AnimationFan2024',
                avatar: '/placeholder.svg',
                content: 'The storytelling in this is phenomenal. Every frame is a work of art!',
                timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
                likes: 156,
                replies: [],
                isLiked: true
            },
            {
                id: '3',
                author: 'CreativeStudio',
                avatar: '/placeholder.svg',
                content: 'This is the future of content creation. Absolutely stunning work! 🔥',
                timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
                likes: 89,
                replies: [],
                isLiked: false
            }
        ];
        setComments(mockComments);
    }, [videoData.creator, videoData.creatorAvatar]);

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

    const handleLike = () => {
        if (isLiked) {
            setIsLiked(false);
            setLikes(likes - 1);
        } else {
            setIsLiked(true);
            setIsDisliked(false);
            setLikes(likes + 1);
        }
    };

    const handleDislike = () => {
        if (isDisliked) {
            setIsDisliked(false);
        } else {
            setIsDisliked(true);
            setIsLiked(false);
            if (isLiked) setLikes(likes - 1);
        }
    };

    const handleSubscribe = () => {
        setIsSubscribed(!isSubscribed);
        setSubscribers(isSubscribed ? subscribers - 1 : subscribers + 1);
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: videoData.title,
                text: `Check out this amazing video: ${videoData.title}`,
                url: window.location.href
            });
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
        }
    };

    const handleAddComment = () => {
        if (!newComment.trim()) return;
        
        const comment: Comment = {
            id: Date.now().toString(),
            author: 'You',
            avatar: '/placeholder.svg',
            content: newComment,
            timestamp: new Date(),
            likes: 0,
            replies: [],
            isLiked: false
        };
        
        setComments([comment, ...comments]);
        setNewComment('');
    };

    const handleCommentLike = (commentId: string) => {
        setComments(comments.map(comment => {
            if (comment.id === commentId) {
                return {
                    ...comment,
                    isLiked: !comment.isLiked,
                    likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1
                };
            }
            return comment;
        }));
    };

    return (
        <div className="fixed inset-0 bg-black z-50 overflow-hidden">
            <div className="flex h-full">
                {/* Video Section */}
                <div className="flex-1 flex flex-col">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                    >
                        <Icon name="x" size={24} className="text-white" />
                    </button>

                    {/* Video Player with Access Control */}
                    <div className="flex-1 flex items-center justify-center p-4">
                        <div className="w-full max-w-6xl relative">
                            <PlayerGuard
                                contentId={contentId}
                                isAdultContent={isAdultContent}
                                ageRating={ageRating}
                                requiresEntitlement={requiresEntitlement}
                                priceUSDC={priceUSDC}
                                priceFiat={priceFiat}
                            >
                                <VideoPlayer
                                    src={videoSrc}
                                    title={videoData.title}
                                    autoPlay={true}
                                    className="w-full aspect-video"
                                    enableWatermark={true}
                                    contentId={contentId}
                                    enableMetrics={true}
                                />
                            </PlayerGuard>
                        </div>
                    </div>

                    {/* Video Info Bar - YouTube Style */}
                    <div className="bg-background border-t border-border p-4">
                        <div className="max-w-6xl mx-auto">
                            <h1 className="text-xl font-semibold mb-2 text-foreground">{videoData.title}</h1>
                            
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                {/* Creator Info */}
                                <div className="flex items-center gap-3">
                                    <img 
                                        src={videoData.creatorAvatar || '/placeholder.svg'} 
                                        alt={videoData.creator}
                                        className="w-10 h-10 rounded-full"
                                    />
                                    <div>
                                        <h3 className="font-medium text-foreground">{videoData.creator}</h3>
                                        <p className="text-sm text-muted-foreground">{formatNumber(subscribers)} subscribers</p>
                                    </div>
                                    <button
                                        onClick={handleSubscribe}
                                        className={`px-4 py-2 rounded-full font-medium transition-colors ${
                                            isSubscribed 
                                                ? 'bg-muted text-foreground hover:bg-muted/80' 
                                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                        }`}
                                    >
                                        {isSubscribed ? 'Subscribed' : 'Subscribe'}
                                    </button>
                                </div>

                                {/* Action Buttons - YouTube Style */}
                                <div className="flex items-center gap-2">
                                    {/* Like/Dislike */}
                                    <div className="flex items-center bg-muted rounded-full overflow-hidden">
                                        <button
                                            onClick={handleLike}
                                            className={`flex items-center gap-2 px-4 py-2 hover:bg-muted/80 transition-colors ${
                                                isLiked ? 'text-primary' : 'text-foreground'
                                            }`}
                                        >
                                            <Icon name="heart" size={16} className={isLiked ? 'fill-current' : ''} />
                                            <span className="text-sm font-medium">{formatNumber(likes)}</span>
                                        </button>
                                        <div className="w-px h-6 bg-border"></div>
                                        <button
                                            onClick={handleDislike}
                                            className={`p-2 hover:bg-muted/80 transition-colors ${
                                                isDisliked ? 'text-primary' : 'text-foreground'
                                            }`}
                                        >
                                            <Icon name="trending-down" size={16} />
                                        </button>
                                    </div>

                                    {/* Share */}
                                    <button
                                        onClick={handleShare}
                                        className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-full transition-colors"
                                    >
                                        <Icon name="share" size={16} />
                                        <span className="text-sm font-medium">Share</span>
                                    </button>

                                    {/* Save */}
                                    <button
                                        onClick={() => setIsSaved(!isSaved)}
                                        className={`flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-full transition-colors ${
                                            isSaved ? 'text-primary' : 'text-foreground'
                                        }`}
                                    >
                                        <Icon name="folder" size={16} />
                                        <span className="text-sm font-medium">Save</span>
                                    </button>

                                    {/* More */}
                                    <button className="p-2 bg-muted hover:bg-muted/80 rounded-full transition-colors">
                                        <Icon name="more-horizontal" size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Video Stats */}
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span>{formatNumber(videoData.views)} views</span>
                                <span>•</span>
                                <span>{formatTimeAgo(videoData.uploadDate)}</span>
                            </div>

                            {/* Description */}
                            <div className="mt-4">
                                <button
                                    onClick={() => setShowDescription(!showDescription)}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showDescription ? 'Show less' : 'Show more'}
                                </button>
                                {showDescription && (
                                    <div className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                                        {videoData.description}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Comments Sidebar - YouTube Style */}
                <div className="w-96 bg-background border-l border-border flex flex-col">
                    {/* Comments Header */}
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-foreground">
                                {comments.length} Comments
                            </h3>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'top' | 'newest')}
                                className="text-sm bg-background border border-border rounded px-2 py-1"
                            >
                                <option value="top">Top comments</option>
                                <option value="newest">Newest first</option>
                            </select>
                        </div>

                        {/* Add Comment */}
                        <div className="flex gap-3">
                            <img 
                                src="/placeholder.svg" 
                                alt="Your avatar"
                                className="w-8 h-8 rounded-full flex-shrink-0"
                            />
                            <div className="flex-1">
                                <textarea
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Add a comment..."
                                    className="w-full bg-transparent border-b border-border focus:border-primary outline-none resize-none text-sm py-2"
                                    rows={1}
                                />
                                {newComment && (
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button
                                            onClick={() => setNewComment('')}
                                            className="px-3 py-1 text-sm hover:bg-muted rounded transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleAddComment}
                                            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                                        >
                                            Comment
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Comments List */}
                    <div className="flex-1 overflow-y-auto">
                        {comments.map((comment) => (
                            <div key={comment.id} className="p-4 hover:bg-muted/30 transition-colors">
                                {comment.isPinned && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                                        <Icon name="pin" size={12} />
                                        <span>Pinned by {videoData.creator}</span>
                                    </div>
                                )}
                                
                                <div className="flex gap-3">
                                    <img 
                                        src={comment.avatar} 
                                        alt={comment.author}
                                        className="w-8 h-8 rounded-full flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-sm text-foreground">
                                                {comment.author}
                                            </span>
                                            {comment.isCreator && (
                                                <span className="bg-muted text-xs px-1 rounded">Creator</span>
                                            )}
                                            <span className="text-xs text-muted-foreground">
                                                {formatTimeAgo(comment.timestamp)}
                                            </span>
                                        </div>
                                        
                                        <p className="text-sm text-foreground mb-2">{comment.content}</p>
                                        
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={() => handleCommentLike(comment.id)}
                                                className={`flex items-center gap-1 text-xs hover:bg-muted rounded px-2 py-1 transition-colors ${
                                                    comment.isLiked ? 'text-primary' : 'text-muted-foreground'
                                                }`}
                                            >
                                                <Icon name="heart" size={12} className={comment.isLiked ? 'fill-current' : ''} />
                                                <span>{comment.likes > 0 ? formatNumber(comment.likes) : ''}</span>
                                            </button>
                                            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                                                Reply
                                            </button>
                                        </div>

                                        {/* Replies */}
                                        {comment.replies.length > 0 && (
                                            <div className="mt-3 space-y-3">
                                                {comment.replies.map((reply) => (
                                                    <div key={reply.id} className="flex gap-3">
                                                        <img 
                                                            src={reply.avatar} 
                                                            alt={reply.author}
                                                            className="w-6 h-6 rounded-full flex-shrink-0"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-medium text-sm text-foreground">
                                                                    {reply.author}
                                                                </span>
                                                                {reply.isCreator && (
                                                                    <span className="bg-muted text-xs px-1 rounded">Creator</span>
                                                                )}
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatTimeAgo(reply.timestamp)}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-foreground">{reply.content}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};