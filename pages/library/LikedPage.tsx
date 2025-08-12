
import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { LikedVideosGrid } from '../../components/content/LikedVideosGrid';
import { LikedVideosControls } from '../../components/content/LikedVideosControls';
import { PlaylistManager } from '../../components/content/PlaylistManager';
import { Content } from '../../types';
import { fetchLikedVideos } from '../../lib/fetchers';

export interface LikedVideo extends Content {
    likedAt: Date;
    tags: string[];
    personalNotes?: string;
    playlistIds: string[];
}

export interface Playlist {
    id: string;
    name: string;
    description?: string;
    videoCount: number;
    thumbnail?: string;
    createdAt: Date;
    isPublic: boolean;
    isCollaborative: boolean;
}

export type SortOption = 'recent' | 'oldest' | 'title' | 'creator' | 'views';
export type ViewMode = 'grid' | 'list';

const LikedPage: React.FC = () => {
    const [likedVideos, setLikedVideos] = useState<LikedVideo[]>([]);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<SortOption>('recent');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [showPlaylistManager, setShowPlaylistManager] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                // Simulate loading liked videos and playlists
                const videos = await fetchLikedVideos();
                setLikedVideos(videos);
                
                // Mock playlists data
                setPlaylists([
                    {
                        id: '1',
                        name: 'Favorites',
                        description: 'My absolute favorite videos',
                        videoCount: 12,
                        createdAt: new Date('2024-01-15'),
                        isPublic: false,
                        isCollaborative: false
                    },
                    {
                        id: '2',
                        name: 'Watch Later',
                        description: 'Videos to watch when I have time',
                        videoCount: 8,
                        createdAt: new Date('2024-02-01'),
                        isPublic: false,
                        isCollaborative: false
                    }
                ]);
            } catch (error) {
                console.error('Failed to load liked videos:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    const handleVideoSelect = (videoId: string, selected: boolean) => {
        const newSelection = new Set(selectedVideos);
        if (selected) {
            newSelection.add(videoId);
        } else {
            newSelection.delete(videoId);
        }
        setSelectedVideos(newSelection);
    };

    const handleSelectAll = () => {
        if (selectedVideos.size === likedVideos.length) {
            setSelectedVideos(new Set());
        } else {
            setSelectedVideos(new Set(likedVideos.map(v => v.id)));
        }
    };

    const handleBulkAction = (action: 'addToPlaylist' | 'removeFromLiked' | 'createPlaylist') => {
        if (action === 'createPlaylist') {
            setShowPlaylistManager(true);
        }
        // Handle other bulk actions
        console.log(`Bulk action: ${action} for ${selectedVideos.size} videos`);
    };

    const filteredAndSortedVideos = React.useMemo(() => {
        let filtered = likedVideos;

        // Apply search filter
        if (searchQuery) {
            filtered = filtered.filter(video => 
                video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                video.creator.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Apply category filter
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(video => 
                video.tags.includes(selectedCategory)
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'recent':
                    return new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime();
                case 'oldest':
                    return new Date(a.likedAt).getTime() - new Date(b.likedAt).getTime();
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'creator':
                    return a.creator.localeCompare(b.creator);
                case 'views':
                    return parseInt(b.views.replace(/[^\d]/g, '')) - parseInt(a.views.replace(/[^\d]/g, ''));
                default:
                    return 0;
            }
        });

        return filtered;
    }, [likedVideos, searchQuery, selectedCategory, sortBy]);

    if (isLoading) {
        return (
            <div className="p-6">
                <PageHeader id="liked" title="Liked Videos" />
                <div className="animate-pulse space-y-4">
                    <div className="h-12 bg-muted rounded"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <div className="aspect-video bg-muted rounded-lg"></div>
                                <div className="h-4 bg-muted rounded w-3/4"></div>
                                <div className="h-3 bg-muted rounded w-1/2"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (likedVideos.length === 0) {
        return (
            <div className="p-6">
                <PageHeader id="liked" title="Liked Videos" />
                <EmptyState 
                    icon="heart" 
                    title="No Liked Videos" 
                    subtitle="Videos you like will appear here. Start exploring and like videos you enjoy!" 
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* YouTube-style header with controls */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
                <div className="p-6">
                    <PageHeader id="liked" title="Liked Videos" />
                    <LikedVideosControls
                        totalVideos={likedVideos.length}
                        selectedCount={selectedVideos.size}
                        sortBy={sortBy}
                        viewMode={viewMode}
                        searchQuery={searchQuery}
                        selectedCategory={selectedCategory}
                        onSortChange={setSortBy}
                        onViewModeChange={setViewMode}
                        onSearchChange={setSearchQuery}
                        onCategoryChange={setSelectedCategory}
                        onSelectAll={handleSelectAll}
                        onBulkAction={handleBulkAction}
                        playlists={playlists}
                    />
                </div>
            </div>

            {/* Content area */}
            <div className="p-6">
                <LikedVideosGrid
                    videos={filteredAndSortedVideos}
                    viewMode={viewMode}
                    selectedVideos={selectedVideos}
                    onVideoSelect={handleVideoSelect}
                    playlists={playlists}
                />
            </div>

            {/* Playlist Manager Modal */}
            {showPlaylistManager && (
                <PlaylistManager
                    playlists={playlists}
                    selectedVideos={Array.from(selectedVideos)}
                    onClose={() => setShowPlaylistManager(false)}
                    onPlaylistCreate={(playlist) => {
                        setPlaylists([...playlists, playlist]);
                        setShowPlaylistManager(false);
                    }}
                    onPlaylistUpdate={(updatedPlaylist) => {
                        setPlaylists(playlists.map(p => 
                            p.id === updatedPlaylist.id ? updatedPlaylist : p
                        ));
                    }}
                />
            )}
        </div>
    );
};

export default LikedPage;
