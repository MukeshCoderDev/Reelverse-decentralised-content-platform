
import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import Button from '../components/Button';
import VideoCard from '../components/video/VideoCard';
import { Content } from '../types';

// Helper function to convert Content to VideoCard props
function contentToVideoCardProps(content: Content) {
    return {
        id: content.id,
        title: content.title,
        posterUrl: content.thumbnail || '/placeholder.svg',
        durationSec: Math.floor(Math.random() * 600 + 60), // Mock duration
        authorName: content.creator,
        views: parseViewCount(content.views),
    };
}

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

interface ChannelStats {
    subscribers: string;
    totalViews: string;
    videosCount: number;
    joinedDate: string;
}

interface SocialLink {
    platform: string;
    url: string;
    icon: string;
}

const ProfilePage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'home' | 'videos' | 'shorts' | 'live' | 'playlists' | 'about'>('home');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(true);

    // Mock profile data
    const profileData = {
        channelName: "TechGuru",
        handle: "@techguru",
        avatar: "https://picsum.photos/seed/techguru/128/128",
        bannerImage: "https://picsum.photos/seed/banner/1920/480",
        verified: true,
        description: "Welcome to TechGuru! 🚀 Your go-to channel for Web3, blockchain, and decentralized technology tutorials. Making complex concepts simple and accessible for everyone.",
        stats: {
            subscribers: "1.2M",
            totalViews: "45.7M",
            videosCount: 234,
            joinedDate: "Jan 15, 2020"
        } as ChannelStats,
        socialLinks: [
            { platform: "Twitter", url: "https://twitter.com/techguru", icon: "🐦" },
            { platform: "Discord", url: "https://discord.gg/techguru", icon: "💬" },
            { platform: "Website", url: "https://techguru.dev", icon: "🌐" },
        ] as SocialLink[],
        featuredVideo: {
            id: "featured_1",
            title: "Web3 Explained: The Complete Beginner's Guide",
            thumbnail: "https://picsum.photos/seed/featured/640/360",
            duration: "15:42",
            views: "2.1M views"
        }
    };

    // Mock content data
    const mockContent: Content[] = Array.from({ length: 12 }).map((_, i) => ({
        id: `video_${i}`,
        title: `Advanced Web3 Tutorial ${i + 1}: Building DApps with React`,
        creator: "TechGuru",
        views: `${Math.floor(Math.random() * 500 + 50)}K views`,
        ago: `${Math.floor(Math.random() * 30 + 1)} days ago`,
        thumbnail: `https://picsum.photos/seed/video${i}/320/180`,
        likes: Math.floor(Math.random() * 10000 + 1000),
        comments: Math.floor(Math.random() * 1000 + 100),
        trending: Math.random() > 0.7
    }));

    useEffect(() => {
        // Simulate loading
        setTimeout(() => setLoading(false), 1000);
    }, []);

    const tabs = [
        { id: 'home', label: 'Home', icon: 'home' },
        { id: 'videos', label: 'Videos', icon: 'video' },
        { id: 'shorts', label: 'Shorts', icon: 'film' },
        { id: 'live', label: 'Live', icon: 'broadcast' },
        { id: 'playlists', label: 'Playlists', icon: 'folder' },
        { id: 'about', label: 'About', icon: 'info' },
    ] as const;

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                {/* Banner skeleton */}
                <div className="h-48 md:h-64 w-full animate-pulse bg-muted" />
                
                {/* Profile info skeleton */}
                <div className="px-6 py-4">
                    <div className="flex items-start gap-4">
                        <div className="w-20 h-20 md:w-32 md:h-32 rounded-full animate-pulse bg-muted" />
                        <div className="flex-1 space-y-2">
                            <div className="h-6 w-48 animate-pulse bg-muted rounded" />
                            <div className="h-4 w-32 animate-pulse bg-muted rounded" />
                            <div className="h-4 w-64 animate-pulse bg-muted rounded" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* YouTube-style Channel Banner */}
            <div className="relative">
                <div 
                    className="h-48 md:h-64 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${profileData.bannerImage})` }}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    
                    {/* Featured Video Overlay */}
                    <div className="absolute bottom-4 right-4 hidden md:block">
                        <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 max-w-xs">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <img 
                                        src={profileData.featuredVideo.thumbnail}
                                        alt={profileData.featuredVideo.title}
                                        className="w-16 h-9 rounded object-cover"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Icon name="play" size={16} className="text-white" />
                                    </div>
                                </div>
                                <div className="text-white">
                                    <p className="text-xs font-medium line-clamp-2">
                                        {profileData.featuredVideo.title}
                                    </p>
                                    <p className="text-xs opacity-80">
                                        {profileData.featuredVideo.views}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Channel Info Section */}
            <div className="px-6 py-6 border-b border-border">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-start gap-6">
                        {/* Avatar and Basic Info */}
                        <div className="flex items-start gap-4 flex-1">
                            <img 
                                src={profileData.avatar}
                                alt={profileData.channelName}
                                className="w-20 h-20 md:w-32 md:h-32 rounded-full object-cover border-4 border-background shadow-lg"
                            />
                            
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <h1 className="text-2xl md:text-3xl font-bold">{profileData.channelName}</h1>
                                    {profileData.verified && (
                                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                            <Icon name="shield-check" size={16} className="text-white" />
                                        </div>
                                    )}
                                </div>
                                
                                <p className="text-muted-foreground mb-2">{profileData.handle}</p>
                                
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                                    <span>{profileData.stats.subscribers} subscribers</span>
                                    <span>{profileData.stats.videosCount} videos</span>
                                    <span>{profileData.stats.totalViews} views</span>
                                </div>
                                
                                <p className="text-sm text-muted-foreground line-clamp-2 md:line-clamp-3 max-w-2xl">
                                    {profileData.description}
                                </p>
                                
                                {/* Social Links */}
                                <div className="flex items-center gap-3 mt-3">
                                    {profileData.socialLinks.map((link, index) => (
                                        <a
                                            key={index}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-3 py-1 bg-secondary hover:bg-secondary/80 rounded-full text-sm transition-colors"
                                        >
                                            <span>{link.icon}</span>
                                            <span>{link.platform}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={() => setIsSubscribed(!isSubscribed)}
                                className={`px-6 ${isSubscribed ? 'bg-secondary text-foreground hover:bg-secondary/80' : ''}`}
                            >
                                {isSubscribed ? (
                                    <>
                                        <Icon name="bell" className="mr-2" size={16} />
                                        Subscribed
                                    </>
                                ) : (
                                    'Subscribe'
                                )}
                            </Button>
                            
                            <Button variant="outline">
                                <Icon name="bell" className="mr-2" size={16} />
                                Notify
                            </Button>
                            
                            <Button variant="outline" size="sm">
                                <Icon name="share" size={16} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* YouTube-style Tab Navigation */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
                <div className="px-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-center gap-8 overflow-x-auto scrollbar-hide">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 py-4 px-2 text-sm font-medium whitespace-nowrap transition-colors relative ${
                                        activeTab === tab.id
                                            ? 'text-primary'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Icon name={tab.icon as any} size={16} />
                                    {tab.label}
                                    {activeTab === tab.id && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="px-6 py-6">
                <div className="max-w-7xl mx-auto">
                    {activeTab === 'home' && (
                        <div className="space-y-8">
                            {/* Featured Content */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Featured</h3>
                                <div className="bg-secondary rounded-xl p-6">
                                    <div className="flex flex-col md:flex-row items-center gap-6">
                                        <div className="relative">
                                            <img 
                                                src={profileData.featuredVideo.thumbnail}
                                                alt={profileData.featuredVideo.title}
                                                className="w-full md:w-80 h-48 rounded-lg object-cover"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                                                    <Icon name="play" size={24} className="text-white ml-1" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-1 text-center md:text-left">
                                            <h4 className="text-xl font-semibold mb-2">
                                                {profileData.featuredVideo.title}
                                            </h4>
                                            <p className="text-muted-foreground mb-4">
                                                {profileData.featuredVideo.views} • {profileData.featuredVideo.duration}
                                            </p>
                                            <Button>
                                                <Icon name="play" className="mr-2" size={16} />
                                                Watch Now
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Videos */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Recent videos</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {mockContent.slice(0, 8).map((video) => (
                                        <VideoCard 
                                            key={video.id}
                                            {...contentToVideoCardProps(video)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'videos' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {mockContent.map((video) => (
                                <VideoCard 
                                    key={video.id}
                                    {...contentToVideoCardProps(video)}
                                />
                            ))}
                        </div>
                    )}

                    {activeTab === 'about' && (
                        <div className="max-w-4xl space-y-8">
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Description</h3>
                                <div className="bg-secondary rounded-xl p-6">
                                    <p className="text-sm leading-relaxed whitespace-pre-line">
                                        {profileData.description}
                                        
                                        {"\n\n"}📚 What you'll find here:
                                        {"\n"}• Web3 and blockchain tutorials
                                        {"\n"}• DeFi protocols explained
                                        {"\n"}• Smart contract development
                                        {"\n"}• NFT creation guides
                                        {"\n"}• Crypto trading strategies
                                        
                                        {"\n\n"}🎯 New videos every Tuesday and Friday!
                                        
                                        {"\n\n"}💬 Join our community and let's build the decentralized future together!
                                    </p>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold mb-4">Channel details</h3>
                                <div className="bg-secondary rounded-xl p-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Joined</span>
                                        <span>{profileData.stats.joinedDate}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Total views</span>
                                        <span>{profileData.stats.totalViews}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Subscribers</span>
                                        <span>{profileData.stats.subscribers}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Videos</span>
                                        <span>{profileData.stats.videosCount}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold mb-4">Links</h3>
                                <div className="space-y-3">
                                    {profileData.socialLinks.map((link, index) => (
                                        <a
                                            key={index}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-4 bg-secondary hover:bg-secondary/80 rounded-xl transition-colors"
                                        >
                                            <span className="text-xl">{link.icon}</span>
                                            <div>
                                                <p className="font-medium">{link.platform}</p>
                                                <p className="text-sm text-muted-foreground">{link.url}</p>
                                            </div>
                                            <Icon name="chevron-right" size={16} className="ml-auto text-muted-foreground" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Other tabs content */}
                    {(activeTab === 'shorts' || activeTab === 'live' || activeTab === 'playlists') && (
                        <div className="text-center py-12">
                            <Icon name={tabs.find(t => t.id === activeTab)?.icon as any} size={48} className="mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-medium mb-2">Coming Soon</h3>
                            <p className="text-muted-foreground">This section is under development</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
