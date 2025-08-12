import React, { useState } from 'react';
import { LikedVideo, ViewMode, Playlist } from '../../pages/library/LikedPage';
import { LikedVideoCard } from './LikedVideoCard';
import { LikedVideoListItem } from './LikedVideoListItem';
import { ContentDiscovery } from './ContentDiscovery';

interface LikedVideosGridProps {
    videos: LikedVideo[];
    viewMode: ViewMode;
    selectedVideos: Set<string>;
    onVideoSelect: (videoId: string, selected: boolean) => void;
    playlists: Playlist[];
}

export const LikedVideosGrid: React.FC<LikedVideosGridProps> = ({
    videos,
    viewMode,
    selectedVideos,
    onVideoSelect,
    playlists
}) => {
    const [showDiscovery, setShowDiscovery] = useState(true);

    if (videos.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                    <div className="text-6xl mb-4">💔</div>
                    <h3 className="text-lg font-medium mb-2">No videos match your filters</h3>
                    <p className="text-sm">Try adjusting your search or category filters</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Content Discovery Section - TikTok style suggestions */}
            {showDiscovery && videos.length > 0 && (
                <ContentDiscovery
                    likedVideos={videos}
                    onClose={() => setShowDiscovery(false)}
                />
            )}

            {/* Main content grid/list */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {videos.map((video) => (
                        <LikedVideoCard
                            key={video.id}
                            video={video}
                            isSelected={selectedVideos.has(video.id)}
                            onSelect={(selected) => onVideoSelect(video.id, selected)}
                            playlists={playlists}
                        />
                    ))}
                </div>
            ) : (
                <div className="space-y-2">
                    {videos.map((video, index) => (
                        <LikedVideoListItem
                            key={video.id}
                            video={video}
                            index={index + 1}
                            isSelected={selectedVideos.has(video.id)}
                            onSelect={(selected) => onVideoSelect(video.id, selected)}
                            playlists={playlists}
                        />
                    ))}
                </div>
            )}

            {/* Load more section - YouTube style infinite scroll placeholder */}
            {videos.length >= 20 && (
                <div className="text-center py-8">
                    <button className="px-6 py-2 border border-border rounded-full hover:bg-muted transition-colors">
                        Load more videos
                    </button>
                </div>
            )}
        </div>
    );
};