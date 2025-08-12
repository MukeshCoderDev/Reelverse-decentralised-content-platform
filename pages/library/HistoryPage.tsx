
import React, { useState, useEffect } from 'react';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import { EmptyState } from '../../components/shared/EmptyState';

interface WatchHistoryItem {
    id: string;
    content: {
        id: string;
        title: string;
        creator: string;
        creatorAvatar: string;
        thumbnail: string;
        duration: string;
        views: string;
        category: string;
        tags: string[];
    };
    watchedAt: Date;
    watchDuration: number;
    completionPercentage: number;
    device: string;
    location?: string;
    context: 'search' | 'recommended' | 'subscriptions' | 'trending' | 'direct';
    engagementScore: number; // TikTok-style engagement tracking
    viewingPattern: 'binge' | 'casual' | 'focused' | 'discovery';
}

interface ViewingAnalytics {
    totalWatchTime: number;
    averageSessionLength: number;
    mostWatchedCategory: string;
    preferredViewingTime: string;
    deviceUsage: Record<string, number>;
    engagementTrend: number;
    discoveryRate: number;
}

interface PrivacySettings {
    trackingEnabled: boolean;
    incognitoMode: boolean;
    autoDelete: 'never' | '3months' | '18months' | '36months';
    pauseHistory: boolean;
}

const HistoryPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [deviceFilter, setDeviceFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'list' | 'grid' | 'timeline'>('list');
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [showPrivacySettings, setShowPrivacySettings] = useState(false);
    const [sortBy, setSortBy] = useState<'date' | 'duration' | 'completion' | 'relevance'>('date');
    const [groupBy, setGroupBy] = useState<'none' | 'date' | 'creator' | 'category'>('none');

    // Enhanced mock watch history data with TikTok-style engagement tracking
    const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([
        {
            id: '1',
            content: {
                id: 'vid_1',
                title: 'Web3 Development Complete Guide - Building Your First DApp',
                creator: 'TechGuru',
                creatorAvatar: 'https://picsum.photos/seed/creator1/40/40',
                thumbnail: 'https://picsum.photos/seed/history1/320/180',
                duration: '45:32',
                views: '234K views',
                category: 'Technology',
                tags: ['web3', 'development', 'dapp', 'blockchain']
            },
            watchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            watchDuration: 2732,
            completionPercentage: 100,
            device: 'Desktop',
            location: 'Home',
            context: 'recommended',
            engagementScore: 95,
            viewingPattern: 'focused'
        },
        {
            id: '2',
            content: {
                id: 'vid_2',
                title: 'DeFi Explained: Liquidity Pools and Yield Farming',
                creator: 'CryptoCadet',
                creatorAvatar: 'https://picsum.photos/seed/creator2/40/40',
                thumbnail: 'https://picsum.photos/seed/history2/320/180',
                duration: '28:15',
                views: '156K views',
                category: 'Finance',
                tags: ['defi', 'liquidity', 'yield', 'farming']
            },
            watchedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
            watchDuration: 1200,
            completionPercentage: 71,
            device: 'Mobile',
            location: 'Commute',
            context: 'search',
            engagementScore: 78,
            viewingPattern: 'casual'
        },
        {
            id: '3',
            content: {
                id: 'vid_3',
                title: 'NFT Creation Tutorial: From Concept to Marketplace',
                creator: 'PixelPlays',
                creatorAvatar: 'https://picsum.photos/seed/creator3/40/40',
                thumbnail: 'https://picsum.photos/seed/history3/320/180',
                duration: '52:08',
                views: '89K views',
                category: 'Art & Design',
                tags: ['nft', 'creation', 'marketplace', 'art']
            },
            watchedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            watchDuration: 3128,
            completionPercentage: 100,
            device: 'Desktop',
            location: 'Home',
            context: 'subscriptions',
            engagementScore: 92,
            viewingPattern: 'focused'
        },
        {
            id: '4',
            content: {
                id: 'vid_4',
                title: 'Smart Contract Security: Common Vulnerabilities',
                creator: 'BlockchainExpert',
                creatorAvatar: 'https://picsum.photos/seed/creator4/40/40',
                thumbnail: 'https://picsum.photos/seed/history4/320/180',
                duration: '38:42',
                views: '67K views',
                category: 'Technology',
                tags: ['security', 'smart-contracts', 'vulnerabilities']
            },
            watchedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            watchDuration: 900,
            completionPercentage: 39,
            device: 'Tablet',
            location: 'Office',
            context: 'trending',
            engagementScore: 45,
            viewingPattern: 'discovery'
        },
        {
            id: '5',
            content: {
                id: 'vid_5',
                title: 'Decentralized Storage Solutions: IPFS vs Arweave',
                creator: 'DIYDebi',
                creatorAvatar: 'https://picsum.photos/seed/creator5/40/40',
                thumbnail: 'https://picsum.photos/seed/history5/320/180',
                duration: '33:21',
                views: '123K views',
                category: 'Technology',
                tags: ['storage', 'ipfs', 'arweave', 'decentralized']
            },
            watchedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            watchDuration: 2001,
            completionPercentage: 100,
            device: 'Desktop',
            location: 'Home',
            context: 'recommended',
            engagementScore: 88,
            viewingPattern: 'binge'
        },
        {
            id: '6',
            content: {
                id: 'vid_6',
                title: 'Crypto Trading Psychology: Managing FOMO and Fear',
                creator: 'TradingMindset',
                creatorAvatar: 'https://picsum.photos/seed/creator6/40/40',
                thumbnail: 'https://picsum.photos/seed/history6/320/180',
                duration: '24:18',
                views: '78K views',
                category: 'Finance',
                tags: ['trading', 'psychology', 'fomo', 'mindset']
            },
            watchedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            watchDuration: 1458,
            completionPercentage: 100,
            device: 'Mobile',
            location: 'Home',
            context: 'direct',
            engagementScore: 85,
            viewingPattern: 'focused'
        }
    ]);

    // Privacy settings state
    const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
        trackingEnabled: true,
        incognitoMode: false,
        autoDelete: 'never',
        pauseHistory: false
    });

    // Viewing analytics calculation
    const viewingAnalytics: ViewingAnalytics = React.useMemo(() => {
        const totalWatchTime = watchHistory.reduce((total, item) => total + item.watchDuration, 0);
        const averageSessionLength = totalWatchTime / watchHistory.length || 0;
        
        const categoryCount = watchHistory.reduce((acc, item) => {
            acc[item.content.category] = (acc[item.content.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const mostWatchedCategory = Object.entries(categoryCount)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';
        
        const deviceUsage = watchHistory.reduce((acc, item) => {
            acc[item.device] = (acc[item.device] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const avgEngagement = watchHistory.reduce((sum, item) => sum + item.engagementScore, 0) / watchHistory.length || 0;
        const discoveryRate = watchHistory.filter(item => item.context === 'recommended' || item.context === 'trending').length / watchHistory.length * 100;
        
        return {
            totalWatchTime,
            averageSessionLength,
            mostWatchedCategory,
            preferredViewingTime: 'Evening', // Mock data
            deviceUsage,
            engagementTrend: avgEngagement,
            discoveryRate
        };
    }, [watchHistory]);

    useEffect(() => {
        // Simulate loading
        setTimeout(() => setLoading(false), 500);
    }, []);

    const filteredHistory = React.useMemo(() => {
        let filtered = watchHistory.filter(item => {
            // Search filter - enhanced with tags and category search
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesTitle = item.content.title.toLowerCase().includes(query);
                const matchesCreator = item.content.creator.toLowerCase().includes(query);
                const matchesCategory = item.content.category.toLowerCase().includes(query);
                const matchesTags = item.content.tags.some(tag => tag.toLowerCase().includes(query));
                
                if (!matchesTitle && !matchesCreator && !matchesCategory && !matchesTags) {
                    return false;
                }
            }

            // Category filter
            if (categoryFilter !== 'all' && item.content.category !== categoryFilter) {
                return false;
            }

            // Device filter
            if (deviceFilter !== 'all' && item.device !== deviceFilter) {
                return false;
            }

            // Time filter
            const now = new Date();
            const itemDate = item.watchedAt;
            
            switch (filter) {
                case 'today':
                    return itemDate.toDateString() === now.toDateString();
                case 'week':
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return itemDate >= weekAgo;
                case 'month':
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    return itemDate >= monthAgo;
                default:
                    return true;
            }
        });

        // Sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'date':
                    return b.watchedAt.getTime() - a.watchedAt.getTime();
                case 'duration':
                    return b.watchDuration - a.watchDuration;
                case 'completion':
                    return b.completionPercentage - a.completionPercentage;
                case 'relevance':
                    return b.engagementScore - a.engagementScore;
                default:
                    return 0;
            }
        });

        return filtered;
    }, [watchHistory, searchQuery, filter, categoryFilter, deviceFilter, sortBy]);

    // Group filtered history
    const groupedHistory = React.useMemo(() => {
        if (groupBy === 'none') return { 'All Videos': filteredHistory };

        return filteredHistory.reduce((groups, item) => {
            let key: string;
            switch (groupBy) {
                case 'date':
                    key = item.watchedAt.toDateString();
                    break;
                case 'creator':
                    key = item.content.creator;
                    break;
                case 'category':
                    key = item.content.category;
                    break;
                default:
                    key = 'All Videos';
            }
            
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
            return groups;
        }, {} as Record<string, WatchHistoryItem[]>);
    }, [filteredHistory, groupBy]);

    // Get unique categories and devices for filters
    const categories = React.useMemo(() => 
        [...new Set(watchHistory.map(item => item.content.category))], [watchHistory]);
    
    const devices = React.useMemo(() => 
        [...new Set(watchHistory.map(item => item.device))], [watchHistory]);

    const formatWatchTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
        
        if (diffInHours < 1) return 'Just now';
        if (diffInHours < 24) return `${diffInHours}h ago`;
        
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}d ago`;
        
        const diffInWeeks = Math.floor(diffInDays / 7);
        if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
        
        const diffInMonths = Math.floor(diffInDays / 30);
        return `${diffInMonths}mo ago`;
    };

    const handleSelectItem = (itemId: string) => {
        setSelectedItems(prev => 
            prev.includes(itemId) 
                ? prev.filter(id => id !== itemId)
                : [...prev, itemId]
        );
    };

    const handleSelectAll = () => {
        if (selectedItems.length === filteredHistory.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(filteredHistory.map(item => item.id));
        }
    };

    const handleRemoveSelected = () => {
        setWatchHistory(prev => prev.filter(item => !selectedItems.includes(item.id)));
        setSelectedItems([]);
    };

    const handleClearAll = () => {
        setWatchHistory([]);
        setSelectedItems([]);
    };

    const handlePauseHistory = () => {
        setPrivacySettings(prev => ({ ...prev, pauseHistory: !prev.pauseHistory }));
    };

    const handleToggleIncognito = () => {
        setPrivacySettings(prev => ({ ...prev, incognitoMode: !prev.incognitoMode }));
    };

    const handleAutoDeleteChange = (period: PrivacySettings['autoDelete']) => {
        setPrivacySettings(prev => ({ ...prev, autoDelete: period }));
    };

    const handleExportHistory = () => {
        const dataStr = JSON.stringify(watchHistory, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'watch-history.json';
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const getEngagementColor = (score: number) => {
        if (score >= 80) return 'text-green-500';
        if (score >= 60) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getViewingPatternIcon = (pattern: string) => {
        switch (pattern) {
            case 'binge': return 'flame';
            case 'focused': return 'eye';
            case 'casual': return 'clock';
            case 'discovery': return 'search';
            default: return 'play';
        }
    };

    const totalWatchTime = watchHistory.reduce((total, item) => total + item.watchDuration, 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-6">
                <div className="max-w-6xl mx-auto">
                    <div className="h-8 w-32 animate-pulse rounded bg-muted mb-6" />
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
                        <div className="h-10 w-32 animate-pulse rounded-lg bg-muted" />
                    </div>
                    <div className="space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Watch History</h1>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                <span>{watchHistory.length} videos watched</span>
                                <span>Total watch time: {formatWatchTime(totalWatchTime)}</span>
                                <span>Avg engagement: {viewingAnalytics.engagementTrend.toFixed(0)}%</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowAnalytics(!showAnalytics)}
                            >
                                <Icon name="chart" size={16} className="mr-2" />
                                Analytics
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowPrivacySettings(!showPrivacySettings)}
                            >
                                <Icon name="shield-check" size={16} className="mr-2" />
                                Privacy
                            </Button>
                            <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                                <Button
                                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('list')}
                                >
                                    <Icon name="list" size={16} />
                                </Button>
                                <Button
                                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('grid')}
                                >
                                    <Icon name="grid" size={16} />
                                </Button>
                                <Button
                                    variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('timeline')}
                                >
                                    <Icon name="clock" size={16} />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Privacy Status */}
                    {(privacySettings.incognitoMode || privacySettings.pauseHistory) && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                                <Icon name="shield-check" size={16} />
                                <span className="text-sm font-medium">
                                    {privacySettings.incognitoMode && 'Incognito mode active'}
                                    {privacySettings.incognitoMode && privacySettings.pauseHistory && ' • '}
                                    {privacySettings.pauseHistory && 'History tracking paused'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Analytics Panel */}
                {showAnalytics && (
                    <div className="bg-secondary rounded-xl p-6 mb-6">
                        <h3 className="text-lg font-semibold mb-4">Viewing Analytics</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="bg-background rounded-lg p-4">
                                <div className="text-2xl font-bold">{formatWatchTime(viewingAnalytics.totalWatchTime)}</div>
                                <div className="text-sm text-muted-foreground">Total Watch Time</div>
                            </div>
                            <div className="bg-background rounded-lg p-4">
                                <div className="text-2xl font-bold">{formatWatchTime(viewingAnalytics.averageSessionLength)}</div>
                                <div className="text-sm text-muted-foreground">Avg Session Length</div>
                            </div>
                            <div className="bg-background rounded-lg p-4">
                                <div className="text-2xl font-bold">{viewingAnalytics.mostWatchedCategory}</div>
                                <div className="text-sm text-muted-foreground">Top Category</div>
                            </div>
                            <div className="bg-background rounded-lg p-4">
                                <div className="text-2xl font-bold">{viewingAnalytics.discoveryRate.toFixed(0)}%</div>
                                <div className="text-sm text-muted-foreground">Discovery Rate</div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-medium mb-3">Device Usage</h4>
                                <div className="space-y-2">
                                    {Object.entries(viewingAnalytics.deviceUsage).map(([device, count]) => (
                                        <div key={device} className="flex items-center justify-between">
                                            <span className="text-sm">{device}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-primary rounded-full"
                                                        style={{ width: `${(count / watchHistory.length) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm text-muted-foreground">{count}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div>
                                <h4 className="font-medium mb-3">Viewing Patterns</h4>
                                <div className="space-y-2">
                                    {['focused', 'binge', 'casual', 'discovery'].map(pattern => {
                                        const count = watchHistory.filter(item => item.viewingPattern === pattern).length;
                                        return (
                                            <div key={pattern} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Icon name={getViewingPatternIcon(pattern) as any} size={14} />
                                                    <span className="text-sm capitalize">{pattern}</span>
                                                </div>
                                                <span className="text-sm text-muted-foreground">{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Privacy Settings Panel */}
                {showPrivacySettings && (
                    <div className="bg-secondary rounded-xl p-6 mb-6">
                        <h3 className="text-lg font-semibold mb-4">Privacy & Data Controls</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium">Pause watch history</div>
                                    <div className="text-sm text-muted-foreground">Stop saving new videos to your history</div>
                                </div>
                                <Button
                                    variant={privacySettings.pauseHistory ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={handlePauseHistory}
                                >
                                    {privacySettings.pauseHistory ? 'Resume' : 'Pause'}
                                </Button>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium">Incognito mode</div>
                                    <div className="text-sm text-muted-foreground">Watch videos without saving to history</div>
                                </div>
                                <Button
                                    variant={privacySettings.incognitoMode ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={handleToggleIncognito}
                                >
                                    {privacySettings.incognitoMode ? 'Disable' : 'Enable'}
                                </Button>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium">Auto-delete history</div>
                                    <div className="text-sm text-muted-foreground">Automatically remove old watch history</div>
                                </div>
                                <select 
                                    value={privacySettings.autoDelete}
                                    onChange={(e) => handleAutoDeleteChange(e.target.value as PrivacySettings['autoDelete'])}
                                    className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm"
                                >
                                    <option value="never">Never</option>
                                    <option value="3months">After 3 months</option>
                                    <option value="18months">After 18 months</option>
                                    <option value="36months">After 36 months</option>
                                </select>
                            </div>
                            
                            <div className="flex items-center gap-2 pt-2">
                                <Button variant="outline" size="sm" onClick={handleExportHistory}>
                                    <Icon name="download" size={14} className="mr-2" />
                                    Export Data
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleClearAll}>
                                    <Icon name="trash" size={14} className="mr-2" />
                                    Delete All History
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search titles, creators, categories, tags..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <Icon name="x" size={16} />
                            </button>
                        )}
                    </div>

                    {/* Advanced Filters */}
                    <div className="flex items-center gap-2">
                        {/* Time Filter */}
                        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                            {(['all', 'today', 'week', 'month'] as const).map((filterOption) => (
                                <button
                                    key={filterOption}
                                    onClick={() => setFilter(filterOption)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                                        filter === filterOption
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {filterOption}
                                </button>
                            ))}
                        </div>

                        {/* Category Filter */}
                        <select 
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(category => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>

                        {/* Device Filter */}
                        <select 
                            value={deviceFilter}
                            onChange={(e) => setDeviceFilter(e.target.value)}
                            className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
                        >
                            <option value="all">All Devices</option>
                            {devices.map(device => (
                                <option key={device} value={device}>{device}</option>
                            ))}
                        </select>
                    </div>

                    {/* Bulk Actions */}
                    {selectedItems.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                                {selectedItems.length} selected
                            </span>
                            <Button variant="outline" size="sm" onClick={handleRemoveSelected}>
                                <Icon name="trash" className="mr-2" size={14} />
                                Remove
                            </Button>
                        </div>
                    )}

                    {/* Clear All */}
                    {watchHistory.length > 0 && (
                        <Button variant="outline" size="sm" onClick={handleClearAll}>
                            <Icon name="trash" className="mr-2" size={14} />
                            Clear All
                        </Button>
                    )}
                </div>

                {/* Sort and Group Controls */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Sort by:</span>
                            <select 
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                                className="px-3 py-1.5 bg-secondary border border-border rounded-lg text-sm"
                            >
                                <option value="date">Date watched</option>
                                <option value="duration">Watch duration</option>
                                <option value="completion">Completion %</option>
                                <option value="relevance">Engagement score</option>
                            </select>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Group by:</span>
                            <select 
                                value={groupBy}
                                onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
                                className="px-3 py-1.5 bg-secondary border border-border rounded-lg text-sm"
                            >
                                <option value="none">None</option>
                                <option value="date">Date</option>
                                <option value="creator">Creator</option>
                                <option value="category">Category</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                        {filteredHistory.length} of {watchHistory.length} videos
                    </div>
                </div>

                {/* Select All */}
                {filteredHistory.length > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                        <button
                            onClick={handleSelectAll}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <div className={`w-4 h-4 border border-border rounded flex items-center justify-center ${
                                selectedItems.length === filteredHistory.length ? 'bg-primary border-primary' : ''
                            }`}>
                                {selectedItems.length === filteredHistory.length && (
                                    <Icon name="check" size={12} className="text-primary-foreground" />
                                )}
                            </div>
                            {selectedItems.length === filteredHistory.length ? 'Deselect all' : 'Select all'}
                        </button>
                    </div>
                )}

                {/* History List */}
                {filteredHistory.length > 0 ? (
                    <div className="space-y-6">
                        {Object.entries(groupedHistory).map(([groupName, items]) => (
                            <div key={groupName}>
                                {groupBy !== 'none' && (
                                    <div className="flex items-center gap-3 mb-4">
                                        <h3 className="text-lg font-semibold">{groupName}</h3>
                                        <div className="h-px bg-border flex-1" />
                                        <span className="text-sm text-muted-foreground">{items.length} videos</span>
                                    </div>
                                )}
                                
                                <div className={
                                    viewMode === 'grid' 
                                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                                        : viewMode === 'timeline'
                                        ? 'space-y-2'
                                        : 'space-y-4'
                                }>
                                    {items.map((item) => (
                                        <div 
                                            key={item.id} 
                                            className={`group cursor-pointer ${
                                                viewMode === 'grid' 
                                                    ? 'bg-secondary rounded-xl overflow-hidden hover:bg-secondary/80 transition-colors'
                                                    : viewMode === 'timeline'
                                                    ? 'flex items-center gap-3 p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors'
                                                    : 'flex items-start gap-4 p-4 bg-secondary rounded-xl hover:bg-secondary/80 transition-colors'
                                            }`}
                                        >
                                            {(viewMode === 'list' || viewMode === 'timeline') && (
                                                <button
                                                    onClick={() => handleSelectItem(item.id)}
                                                    className="mt-2"
                                                >
                                                    <div className={`w-4 h-4 border border-border rounded flex items-center justify-center ${
                                                        selectedItems.includes(item.id) ? 'bg-primary border-primary' : ''
                                                    }`}>
                                                        {selectedItems.includes(item.id) && (
                                                            <Icon name="check" size={12} className="text-primary-foreground" />
                                                        )}
                                                    </div>
                                                </button>
                                            )}

                                            <div className={`relative ${
                                                viewMode === 'grid' 
                                                    ? 'aspect-video' 
                                                    : viewMode === 'timeline'
                                                    ? 'w-20 h-12 flex-shrink-0'
                                                    : 'w-40 h-24 flex-shrink-0'
                                            }`}>
                                                <img 
                                                    src={item.content.thumbnail}
                                                    alt={item.content.title}
                                                    className="w-full h-full object-cover rounded-lg"
                                                />
                                                <div className="absolute bottom-1 right-1 bg-black/80 text-white px-1.5 py-0.5 rounded text-xs">
                                                    {item.content.duration}
                                                </div>
                                                {item.completionPercentage < 100 && (
                                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                                                        <div 
                                                            className="h-full bg-red-500"
                                                            style={{ width: `${item.completionPercentage}%` }}
                                                        />
                                                    </div>
                                                )}
                                                
                                                {/* TikTok-style engagement indicator */}
                                                <div className={`absolute top-1 left-1 w-2 h-2 rounded-full ${getEngagementColor(item.engagementScore).replace('text-', 'bg-')}`} />
                                            </div>

                                            <div className={`flex-1 ${viewMode === 'grid' ? 'p-4' : viewMode === 'timeline' ? 'min-w-0' : ''}`}>
                                                {viewMode === 'grid' && (
                                                    <button
                                                        onClick={() => handleSelectItem(item.id)}
                                                        className="absolute top-2 left-2 z-10"
                                                    >
                                                        <div className={`w-4 h-4 border border-white rounded flex items-center justify-center ${
                                                            selectedItems.includes(item.id) ? 'bg-primary border-primary' : 'bg-black/50'
                                                        }`}>
                                                            {selectedItems.includes(item.id) && (
                                                                <Icon name="check" size={12} className="text-white" />
                                                            )}
                                                        </div>
                                                    </button>
                                                )}

                                                <h3 className={`font-medium group-hover:text-primary transition-colors ${
                                                    viewMode === 'grid' 
                                                        ? 'line-clamp-2 text-sm mb-2' 
                                                        : viewMode === 'timeline'
                                                        ? 'line-clamp-1 text-sm mb-1'
                                                        : 'line-clamp-2 mb-2'
                                                }`}>
                                                    {item.content.title}
                                                </h3>
                                                
                                                <div className={`flex items-center gap-2 text-sm text-muted-foreground ${viewMode === 'timeline' ? 'mb-1' : 'mb-2'}`}>
                                                    {viewMode !== 'timeline' && (
                                                        <img 
                                                            src={item.content.creatorAvatar}
                                                            alt={item.content.creator}
                                                            className="w-4 h-4 rounded-full"
                                                        />
                                                    )}
                                                    <span>{item.content.creator}</span>
                                                    <span>•</span>
                                                    <span>{item.content.views}</span>
                                                    {viewMode !== 'timeline' && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="px-1.5 py-0.5 bg-muted rounded text-xs">{item.content.category}</span>
                                                        </>
                                                    )}
                                                </div>
                                                
                                                <div className={`flex items-center gap-2 text-xs text-muted-foreground ${viewMode === 'timeline' ? 'flex-wrap' : 'gap-4'}`}>
                                                    <span>Watched {formatTimeAgo(item.watchedAt)}</span>
                                                    <span>•</span>
                                                    <span>{item.device}</span>
                                                    {item.completionPercentage < 100 && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{item.completionPercentage}% watched</span>
                                                        </>
                                                    )}
                                                    {viewMode !== 'timeline' && (
                                                        <>
                                                            <span>•</span>
                                                            <div className="flex items-center gap-1">
                                                                <Icon name={getViewingPatternIcon(item.viewingPattern) as any} size={12} />
                                                                <span className="capitalize">{item.viewingPattern}</span>
                                                            </div>
                                                            <span>•</span>
                                                            <span className={getEngagementColor(item.engagementScore)}>
                                                                {item.engagementScore}% engagement
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                
                                                {viewMode === 'list' && item.content.tags.length > 0 && (
                                                    <div className="flex items-center gap-1 mt-2">
                                                        {item.content.tags.slice(0, 3).map(tag => (
                                                            <span key={tag} className="px-2 py-1 bg-muted rounded-full text-xs text-muted-foreground">
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                        {item.content.tags.length > 3 && (
                                                            <span className="text-xs text-muted-foreground">+{item.content.tags.length - 3} more</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className={`${viewMode === 'grid' ? 'absolute top-2 right-2' : viewMode === 'timeline' ? 'flex-shrink-0' : 'flex-shrink-0'}`}>
                                                <Button variant="ghost" size="sm">
                                                    <Icon name="more-horizontal" size={16} />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState 
                        icon="clock" 
                        title={searchQuery ? "No matching videos" : "No watch history"} 
                        subtitle={searchQuery 
                            ? "Try adjusting your search terms or time filter"
                            : "Videos you watch will appear here. Start exploring content to build your history!"
                        } 
                    />
                )}
            </div>
        </div>
    );
};

export default HistoryPage;
