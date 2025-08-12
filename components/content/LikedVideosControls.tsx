import React from 'react';
import Icon from '../Icon';
import Button from '../Button';
import { SortOption, ViewMode, Playlist } from '../../pages/library/LikedPage';

interface LikedVideosControlsProps {
    totalVideos: number;
    selectedCount: number;
    sortBy: SortOption;
    viewMode: ViewMode;
    searchQuery: string;
    selectedCategory: string;
    onSortChange: (sort: SortOption) => void;
    onViewModeChange: (mode: ViewMode) => void;
    onSearchChange: (query: string) => void;
    onCategoryChange: (category: string) => void;
    onSelectAll: () => void;
    onBulkAction: (action: 'addToPlaylist' | 'removeFromLiked' | 'createPlaylist') => void;
    playlists: Playlist[];
}

export const LikedVideosControls: React.FC<LikedVideosControlsProps> = ({
    totalVideos,
    selectedCount,
    sortBy,
    viewMode,
    searchQuery,
    selectedCategory,
    onSortChange,
    onViewModeChange,
    onSearchChange,
    onCategoryChange,
    onSelectAll,
    onBulkAction,
    playlists
}) => {
    const categories = ['all', 'music', 'gaming', 'education', 'entertainment', 'tech', 'sports'];
    
    const sortOptions: { value: SortOption; label: string }[] = [
        { value: 'recent', label: 'Recently liked' },
        { value: 'oldest', label: 'Oldest first' },
        { value: 'title', label: 'Title A-Z' },
        { value: 'creator', label: 'Creator A-Z' },
        { value: 'views', label: 'Most viewed' }
    ];

    return (
        <div className="space-y-4 mt-4">
            {/* Search and filters row */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                {/* Search input - YouTube style */}
                <div className="relative flex-1 max-w-md">
                    <Icon name="search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search liked videos..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-border rounded-full bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <Icon name="x" size={16} />
                        </button>
                    )}
                </div>

                {/* Category filter */}
                <select
                    value={selectedCategory}
                    onChange={(e) => onCategoryChange(e.target.value)}
                    className="px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    {categories.map(category => (
                        <option key={category} value={category}>
                            {category === 'all' ? 'All categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                        </option>
                    ))}
                </select>
            </div>

            {/* Controls row */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                {/* Left side - Selection and bulk actions */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={selectedCount === totalVideos && totalVideos > 0}
                            onChange={onSelectAll}
                            className="rounded border-border"
                        />
                        <span className="text-sm text-muted-foreground">
                            {selectedCount > 0 ? `${selectedCount} selected` : `${totalVideos} videos`}
                        </span>
                    </div>

                    {/* Bulk actions - TikTok style quick actions */}
                    {selectedCount > 0 && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onBulkAction('addToPlaylist')}
                                className="flex items-center gap-2"
                            >
                                <Icon name="folder" size={14} />
                                Add to playlist
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onBulkAction('createPlaylist')}
                                className="flex items-center gap-2"
                            >
                                <Icon name="plus" size={14} />
                                New playlist
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onBulkAction('removeFromLiked')}
                                className="flex items-center gap-2 text-destructive hover:text-destructive"
                            >
                                <Icon name="heart" size={14} />
                                Unlike
                            </Button>
                        </div>
                    )}
                </div>

                {/* Right side - Sort and view controls */}
                <div className="flex items-center gap-4">
                    {/* Sort dropdown - YouTube style */}
                    <div className="flex items-center gap-2">
                        <Icon name="filter" size={16} className="text-muted-foreground" />
                        <select
                            value={sortBy}
                            onChange={(e) => onSortChange(e.target.value as SortOption)}
                            className="px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            {sortOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* View mode toggle - YouTube style */}
                    <div className="flex items-center border border-border rounded-md overflow-hidden">
                        <button
                            onClick={() => onViewModeChange('grid')}
                            className={`p-2 transition-colors ${
                                viewMode === 'grid' 
                                    ? 'bg-primary text-primary-foreground' 
                                    : 'bg-background hover:bg-muted'
                            }`}
                            title="Grid view"
                        >
                            <Icon name="grid" size={16} />
                        </button>
                        <button
                            onClick={() => onViewModeChange('list')}
                            className={`p-2 transition-colors ${
                                viewMode === 'list' 
                                    ? 'bg-primary text-primary-foreground' 
                                    : 'bg-background hover:bg-muted'
                            }`}
                            title="List view"
                        >
                            <Icon name="list" size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Active filters display */}
            {(searchQuery || selectedCategory !== 'all') && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Active filters:</span>
                    {searchQuery && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-sm">
                            <span>Search: "{searchQuery}"</span>
                            <button
                                onClick={() => onSearchChange('')}
                                className="hover:bg-primary/20 rounded-full p-0.5"
                            >
                                <Icon name="x" size={12} />
                            </button>
                        </div>
                    )}
                    {selectedCategory !== 'all' && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-sm">
                            <span>Category: {selectedCategory}</span>
                            <button
                                onClick={() => onCategoryChange('all')}
                                className="hover:bg-primary/20 rounded-full p-0.5"
                            >
                                <Icon name="x" size={12} />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};