
import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { TrendingGrid } from '../components/feeds/TrendingGrid';
import { fetchTrending } from '../lib/fetchers';
import { Content } from '../types';
import Icon from '../components/Icon';
import Button from '../components/Button';
import { useReturnTo } from '../src/hooks/useReturnTo';

type Category = 'all' | 'gaming' | 'music' | 'tech' | 'education' | 'entertainment' | 'sports' | 'news';

interface TrendingTopic {
    id: string;
    topic: string;
    posts: string;
    change: 'up' | 'down' | 'new';
    changePercent?: number;
}

const TrendingPage: React.FC = () => {
    const [items, setItems] = useState<Content[] | null>(null);
    const [activeCategory, setActiveCategory] = useState<Category>('all');
    const [loading, setLoading] = useState(true);

    // X/Twitter-style trending topics
    const trendingTopics: TrendingTopic[] = [
        { id: '1', topic: '#Web3Creator', posts: '45.2K', change: 'up', changePercent: 23 },
        { id: '2', topic: '#DecentralizedVideo', posts: '28.7K', change: 'new' },
        { id: '3', topic: '#NFTContent', posts: '67.1K', change: 'up', changePercent: 15 },
        { id: '4', topic: '#CryptoStreaming', posts: '19.3K', change: 'down', changePercent: 8 },
        { id: '5', topic: '#BlockchainMedia', posts: '52.8K', change: 'up', changePercent: 31 },
    ];

    const categories: { id: Category; label: string; icon: string }[] = [
        { id: 'all', label: 'All', icon: 'flame' },
        { id: 'gaming', label: 'Gaming', icon: 'gamepad-2' },
        { id: 'music', label: 'Music', icon: 'music' },
        { id: 'tech', label: 'Tech', icon: 'cpu' },
        { id: 'education', label: 'Education', icon: 'graduation-cap' },
        { id: 'entertainment', label: 'Entertainment', icon: 'tv' },
        { id: 'sports', label: 'Sports', icon: 'trophy' },
        { id: 'news', label: 'News', icon: 'newspaper' },
    ];

    const location = useLocation();
    const { saveScroll, restoreScroll } = useReturnTo();

    useEffect(() => {
        restoreScroll(location.pathname);
        setLoading(true);
        fetchTrending()
            .then(setItems)
            .finally(() => setLoading(false));

        return () => {
            saveScroll(location.pathname, window.scrollY);
        };
    }, [activeCategory, location.pathname, saveScroll, restoreScroll]);

    return (
        <div className="min-h-screen bg-background">
            {/* TikTok-style header with categories */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Icon name="flame" size={24} className="text-red-500" />
                            <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                                Trending
                            </span>
                        </h1>
                        <Button variant="ghost" size="sm">
                            <Icon name="search" size={18} />
                        </Button>
                    </div>

                    {/* TikTok-style category tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
                        {categories.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => setActiveCategory(category.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                                    activeCategory === category.id
                                        ? 'bg-primary text-primary-foreground shadow-lg'
                                        : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                                }`}
                            >
                                <Icon name={category.icon as any} size={16} />
                                {category.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-4 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* X/Twitter-style trending topics sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-32 space-y-6">
                            <div className="bg-secondary rounded-xl p-4">
                                <h3 className="font-bold mb-4 flex items-center gap-2">
                                    <Icon name="trending-up" size={18} />
                                    Trending Topics
                                </h3>
                                <div className="space-y-3">
                                    {trendingTopics.map((topic, index) => (
                                        <div key={topic.id} className="flex items-center justify-between group cursor-pointer hover:bg-background/50 rounded-lg p-2 -m-2 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-muted-foreground font-mono">
                                                    {index + 1}
                                                </span>
                                                <div>
                                                    <p className="font-medium text-sm group-hover:text-primary transition-colors">
                                                        {topic.topic}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {topic.posts} posts
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {topic.change === 'up' && (
                                                    <div className="flex items-center gap-1 text-green-500 text-xs">
                                                        <Icon name="trending-up" size={12} />
                                                        <span>+{topic.changePercent}%</span>
                                                    </div>
                                                )}
                                                {topic.change === 'down' && (
                                                    <div className="flex items-center gap-1 text-red-500 text-xs">
                                                        <Icon name="trending-down" size={12} />
                                                        <span>-{topic.changePercent}%</span>
                                                    </div>
                                                )}
                                                {topic.change === 'new' && (
                                                    <div className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                                                        NEW
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Real-time updates indicator */}
                            <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-sm font-medium text-green-500">Live Updates</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Trending topics update every 5 minutes
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* TikTok-style content grid */}
                    <div className="lg:col-span-3">
                        {loading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Array.from({ length: 9 }).map((_, i) => (
                                    <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
                                ))}
                            </div>
                        ) : items ? (
                            <TrendingGrid items={items} category={activeCategory} />
                        ) : (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-center">
                                    <Icon name="flame" size={48} className="mx-auto mb-4 text-muted-foreground" />
                                    <h3 className="text-lg font-medium mb-2">No trending content</h3>
                                    <p className="text-muted-foreground">Check back later for trending videos</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrendingPage;
