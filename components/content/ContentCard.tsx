
import React, { useState, useEffect } from 'react';
import { Content } from '../../types';
import { YouTubeStyleVideoPlayer } from './YouTubeStyleVideoPlayer';
import Icon from '../Icon';
import { useWallet } from '../../contexts/WalletContext';
import { AgeVerificationService, AgeVerificationStatus } from '../../services/ageVerificationService';
import { AgeVerificationModal } from '../AgeVerificationModal';

interface ContentCardProps extends Content {
    isAdultContent?: boolean;
    ageRating?: '18+' | '21+';
}

export const ContentCard: React.FC<ContentCardProps> = ({ 
    title, 
    creator, 
    views, 
    ago, 
    thumbnail, 
    likes, 
    comments, 
    trending, 
    algorithmHint,
    isAdultContent = false,
    ageRating = '18+'
}) => {
    const { account, isConnected } = useWallet();
    const [showVideoPlayer, setShowVideoPlayer] = useState(false);
    const [showAgeGate, setShowAgeGate] = useState(false);
    const [ageVerificationStatus, setAgeVerificationStatus] = useState<AgeVerificationStatus | null>(null);
    const [isLoadingVerification, setIsLoadingVerification] = useState(false);
    const ageVerificationService = AgeVerificationService.getInstance();
    
    // Load age verification status when component mounts or account changes
    useEffect(() => {
        if (isAdultContent && account && isConnected) {
            loadAgeVerificationStatus();
        }
    }, [isAdultContent, account, isConnected]);

    const loadAgeVerificationStatus = async () => {
        if (!account) return;

        try {
            setIsLoadingVerification(true);
            const status = await ageVerificationService.getVerificationStatus(account);
            setAgeVerificationStatus(status);
        } catch (error) {
            console.error('Failed to load age verification status:', error);
            // Set default status if loading fails
            setAgeVerificationStatus({
                address: account,
                status: 'none',
                provider: 'persona'
            });
        } finally {
            setIsLoadingVerification(false);
        }
    };

    const formatNumber = (num?: number) => {
        if (!num) return '';
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const isAgeVerified = ageVerificationStatus?.status === 'verified';
    const shouldBlurContent = isAdultContent && (!isConnected || !isAgeVerified);
    const canAccessContent = !isAdultContent || (isConnected && isAgeVerified);

    const handlePlayVideo = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log('Play video clicked for:', title);

        // Check if age verification is required
        if (isAdultContent && !canAccessContent) {
            if (!isConnected) {
                // Show wallet connection prompt
                alert('Please connect your wallet to access adult content');
                return;
            }
            
            if (!isAgeVerified) {
                // Show age verification modal
                setShowAgeGate(true);
                return;
            }
        }

        setShowVideoPlayer(true);
    };

    const handleAgeVerificationComplete = (status: AgeVerificationStatus) => {
        setAgeVerificationStatus(status);
        setShowAgeGate(false);
        
        // If verification successful, automatically play the video
        if (status.status === 'verified') {
            setShowVideoPlayer(true);
        }
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
                    className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.05] ${
                        shouldBlurContent ? 'blur-lg' : ''
                    }`}
                />

                {/* Age restriction overlay */}
                {shouldBlurContent && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="text-center text-white p-4">
                            <div className="w-16 h-16 mx-auto mb-3 bg-red-500 rounded-full flex items-center justify-center">
                                <Icon name="shield-alert" size={32} />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">{ageRating} Content</h3>
                            <p className="text-sm mb-3">
                                {!isConnected 
                                    ? 'Connect your wallet and verify your age to view this content'
                                    : 'Age verification required to view this content'
                                }
                            </p>
                            <div className="flex flex-col gap-2">
                                {!isConnected ? (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // This would trigger wallet connection
                                            alert('Please use the wallet button in the header to connect');
                                        }}
                                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors"
                                    >
                                        Connect Wallet
                                    </button>
                                ) : (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowAgeGate(true);
                                        }}
                                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors"
                                        disabled={isLoadingVerification}
                                    >
                                        {isLoadingVerification ? 'Loading...' : 'Verify Age'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                
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
                
                {/* Play button - only show if content is accessible */}
                {canAccessContent && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <button 
                            onClick={handlePlayVideo}
                            className="p-4 bg-black/50 rounded-full hover:bg-black/70 transition-all duration-200 hover:scale-110"
                            title="Play video"
                        >
                            <Icon name="play" size={32} className="text-white ml-1" />
                        </button>
                    </div>
                )}

                {/* Hover overlay with TikTok-style engagement - only show if content is accessible */}
                {canAccessContent && (
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
                )}
            </div>
            
            <div>
                <div className="flex items-start justify-between gap-2">
                    <h4 className="line-clamp-2 text-sm font-medium group-hover:text-primary transition-colors flex-1">
                        {title}
                    </h4>
                    {/* Age rating badge */}
                    {isAdultContent && (
                        <div className="flex-shrink-0 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                            {ageRating}
                        </div>
                    )}
                </div>
                
                <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                        {creator} • {views} • {ago}
                    </p>
                    
                    {/* Age verification status indicator */}
                    {isAdultContent && isConnected && (
                        <div className="flex items-center gap-1">
                            {isLoadingVerification ? (
                                <Icon name="loader" size={12} className="animate-spin text-muted-foreground" />
                            ) : isAgeVerified ? (
                                <div className="flex items-center gap-1 text-green-600" title="Age verified">
                                    <Icon name="shield-check" size={12} />
                                    <span className="text-xs">Verified</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-red-600" title="Age verification required">
                                    <Icon name="shield-alert" size={12} />
                                    <span className="text-xs">Verify</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* YouTube-style algorithm hint */}
                {algorithmHint && (
                    <p className="mt-1 text-xs text-blue-500 flex items-center gap-1">
                        <Icon name="trending-up" size={12} />
                        {algorithmHint}
                    </p>
                )}
            </div>

            {/* Age Verification Modal */}
            {showAgeGate && (
                <AgeVerificationModal
                    isOpen={showAgeGate}
                    onClose={() => setShowAgeGate(false)}
                    onVerified={handleAgeVerificationComplete}
                    required={false}
                />
            )}

            {/* YouTube-Style Video Player Modal */}
            {showVideoPlayer && (
                <YouTubeStyleVideoPlayer
                    videoSrc="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
                    videoData={{
                        id: `content_${title.replace(/\s+/g, '_').toLowerCase()}`,
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
                    // Pass access control props to video player
                    isAdultContent={isAdultContent}
                    ageRating={ageRating}
                    requiresEntitlement={true} // Assume all content requires some form of entitlement check
                    priceUSDC={isAdultContent ? 5000000 : 1000000} // $5 for adult content, $1 for regular
                    priceFiat={isAdultContent ? 5.99 : 1.99}
                    contentTitle={title}
                    creatorName={creator}
                    entitlementType="ppv"
                    onClose={() => setShowVideoPlayer(false)}
                />
            )}
        </div>
    );
};
