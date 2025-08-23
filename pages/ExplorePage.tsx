
import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Categories } from '../components/explore/Categories';
import { ShelfRow } from '../components/content/ShelfRow';
import VideoCard from '../components/video/VideoCard';
import SearchEngine from '../components/search/SearchEngine';
import { fetchExplore } from '../lib/fetchers';
import { Content } from '../types';
import { RowSkeleton } from '../components/shared/Skeletons';
import Icon from '../components/Icon';
import { useReturnTo } from '../src/hooks/useReturnTo';

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

interface ExploreData {
    categories: { id: string; name: string }[];
    items: Content[];
}

interface SearchSuggestion {
    text: string;
    type: 'query' | 'creator' | 'hashtag';
    trending: boolean;
    count?: number;
}

interface SearchFilters {
    duration: 'any' | 'short' | 'medium' | 'long';
    uploadDate: 'any' | 'hour' | 'today' | 'week' | 'month' | 'year';
    sortBy: 'relevance' | 'upload_date' | 'view_count' | 'rating';
    category: string[];
    creator: string[];
}

const ExplorePage: React.FC = () => {
    const [data, setData] = useState<ExploreData | null>(null);
    const [searchResults, setSearchResults] = useState<Content[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    // Trending hashtags for Instagram-style discovery
    const trendingHashtags = [
        { tag: '#Web3Creator', posts: '45.2K', trending: true },
        { tag: '#DecentralizedVideo', posts: '28.7K', trending: true },
        { tag: '#NFTContent', posts: '67.1K', trending: false },
        { tag: '#CryptoStreaming', posts: '19.3K', trending: true },
        { tag: '#BlockchainMedia', posts: '52.8K', trending: false },
        { tag: '#DeFiEducation', posts: '34.1K', trending: true },
    ];

    const location = useLocation();
    const { saveScroll, restoreScroll, goToWatch } = useReturnTo();

    useEffect(() => {
        restoreScroll(location.pathname);
        fetchExplore()
            .then(setData)
            .finally(() => setLoading(false));

        return () => {
            saveScroll(location.pathname, window.scrollY);
        };
    }, [location.pathname, saveScroll, restoreScroll]);
    const handleSearch = async (query: string, filters: SearchFilters) => {
        setIsSearching(true);
        setSearchQuery(query);
        
        // Simulate search API call
        setTimeout(() => {
            if (data) {
                // Filter content based on search query and filters
                let filtered = data.items.filter(item =>
                    item.title.toLowerCase().includes(query.toLowerCase()) ||
                    item.creator.toLowerCase().includes(query.toLowerCase())
                );

                // Apply filters
                if (filters.sortBy === 'view_count') {
                    filtered = filtered.sort((a, b) => 
                        parseInt(b.views.replace(/[^\d]/g, '')) - parseInt(a.views.replace(/[^\d]/g, ''))
                    );
                } else if (filters.sortBy === 'upload_date') {
                    filtered = filtered.sort((a, b) => 
                        parseInt(a.ago.replace(/[^\d]/g, '')) - parseInt(b.ago.replace(/[^\d]/g, ''))
                    );
                }

                setSearchResults(filtered);
            }
            setIsSearching(false);
        }, 500);
    };

    const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
        // Handle different suggestion types
        console.log('Selected suggestion:', suggestion);
    };

    const clearSearch = () => {
        setSearchResults(null);
        setSearchQuery('');
        setIsSearching(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="h-8 w-48 animate-pulse rounded bg-muted" />
                    <div className="h-12 w-full animate-pulse rounded-full bg-muted" />
                    <div className="h-8 w-full animate-pulse rounded bg-muted" />
                    <RowSkeleton />
                    <RowSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* YouTube-style header with search */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
                <div className="p-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-center justify-between mb-4">
                            <PageHeader id="explore" title="Explore" />
                        </div>
                        
                        {/* Advanced Search Engine */}
                        <div className="max-w-2xl mx-auto">
                            <SearchEngine
                                onSearch={handleSearch}
                                onSuggestionSelect={handleSuggestionSelect}
                                placeholder="Search for videos, creators, hashtags..."
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6">
                <div className="max-w-7xl mx-auto">
                    {/* Search Results */}
                    {searchResults !== null ? (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold">
                                    Search results for "{searchQuery}"
                                </h2>
                                <button
                                    onClick={clearSearch}
                                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <Icon name="slash-circle" size={16} />
                                    Clear search
                                </button>
                            </div>
                            
                            {isSearching ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <div key={i} className="aspect-video animate-pulse rounded-lg bg-muted" />
                                    ))}
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {searchResults.map((item) => (
                                        <VideoCard 
                                            key={item.id}
                                            {...contentToVideoCardProps(item)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Icon name="search" size={48} className="mx-auto mb-4 text-muted-foreground" />
                                    <h3 className="text-lg font-medium mb-2">No results found</h3>
                                    <p className="text-muted-foreground">Try different keywords or check your spelling</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Default Explore Content */
                        <div className="space-y-8">
                            {/* Instagram-style trending hashtags */}
                            <div className="bg-secondary rounded-xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Icon name="trending-up" size={20} className="text-primary" />
                                    <h3 className="text-lg font-semibold">Trending Hashtags</h3>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                    {trendingHashtags.map((hashtag, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleSearch(hashtag.tag, {
                                                duration: 'any',
                                                uploadDate: 'any',
                                                sortBy: 'relevance',
                                                category: [],
                                                creator: []
                                            })}
                                            className="p-3 bg-background rounded-lg hover:bg-muted transition-colors text-left group"
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-sm group-hover:text-primary transition-colors">
                                                    {hashtag.tag}
                                                </span>
                                                {hashtag.trending && (
                                                    <Icon name="flame" size={12} className="text-red-500" />
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{hashtag.posts} posts</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* YouTube-style content categories */}
                            {data && (
                                <>
                                    <Categories categories={data.categories} />
                                    <ShelfRow title="Popular in Gaming" items={data.items.slice(0, 8)} />
                                    <ShelfRow title="Popular in Music" items={data.items.slice(4, 12)} />
                                    <ShelfRow title="Trending Now" items={data.items.filter(item => item.trending).slice(0, 8)} />
                                    <ShelfRow title="Recently Uploaded" items={data.items.slice(6, 14)} />
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExplorePage;
