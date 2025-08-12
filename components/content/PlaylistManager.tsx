import React, { useState } from 'react';
import { Playlist } from '../../pages/library/LikedPage';
import Icon from '../Icon';
import Button from '../Button';

interface PlaylistManagerProps {
    playlists: Playlist[];
    selectedVideos: string[];
    onClose: () => void;
    onPlaylistCreate: (playlist: Playlist) => void;
    onPlaylistUpdate: (playlist: Playlist) => void;
}

export const PlaylistManager: React.FC<PlaylistManagerProps> = ({
    playlists,
    selectedVideos,
    onClose,
    onPlaylistCreate,
    onPlaylistUpdate
}) => {
    const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [newPlaylistDescription, setNewPlaylistDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [isCollaborative, setIsCollaborative] = useState(false);
    const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);

    const handleCreatePlaylist = () => {
        if (!newPlaylistName.trim()) return;

        const newPlaylist: Playlist = {
            id: Date.now().toString(),
            name: newPlaylistName.trim(),
            description: newPlaylistDescription.trim() || undefined,
            videoCount: selectedVideos.length,
            createdAt: new Date(),
            isPublic,
            isCollaborative
        };

        onPlaylistCreate(newPlaylist);
        
        // Reset form
        setNewPlaylistName('');
        setNewPlaylistDescription('');
        setIsPublic(false);
        setIsCollaborative(false);
    };

    const handleUpdatePlaylist = (playlist: Playlist) => {
        onPlaylistUpdate(playlist);
        setEditingPlaylist(null);
    };

    const handleDeletePlaylist = (playlistId: string) => {
        if (confirm('Are you sure you want to delete this playlist?')) {
            // Handle deletion
            console.log('Deleting playlist:', playlistId);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background border border-border rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-xl font-semibold">Playlist Manager</h2>
                        {selectedVideos.length > 0 && (
                            <p className="text-sm text-muted-foreground mt-1">
                                {selectedVideos.length} video{selectedVideos.length !== 1 ? 's' : ''} selected
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                    >
                        <Icon name="x" size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border">
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                            activeTab === 'create'
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Icon name="plus" size={16} className="inline mr-2" />
                        Create Playlist
                    </button>
                    <button
                        onClick={() => setActiveTab('manage')}
                        className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                            activeTab === 'manage'
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Icon name="folder" size={16} className="inline mr-2" />
                        Manage Playlists ({playlists.length})
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-96">
                    {activeTab === 'create' ? (
                        <div className="space-y-4">
                            {/* Create new playlist form */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Playlist Name *
                                </label>
                                <input
                                    type="text"
                                    value={newPlaylistName}
                                    onChange={(e) => setNewPlaylistName(e.target.value)}
                                    placeholder="Enter playlist name..."
                                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                    maxLength={100}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={newPlaylistDescription}
                                    onChange={(e) => setNewPlaylistDescription(e.target.value)}
                                    placeholder="Describe your playlist..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                    maxLength={500}
                                />
                            </div>

                            {/* Privacy settings */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-medium">Public Playlist</label>
                                        <p className="text-xs text-muted-foreground">
                                            Anyone can view and search for this playlist
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={isPublic}
                                        onChange={(e) => setIsPublic(e.target.checked)}
                                        className="rounded border-border"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-medium">Collaborative</label>
                                        <p className="text-xs text-muted-foreground">
                                            Allow others to add videos to this playlist
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={isCollaborative}
                                        onChange={(e) => setIsCollaborative(e.target.checked)}
                                        className="rounded border-border"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button
                                    onClick={handleCreatePlaylist}
                                    disabled={!newPlaylistName.trim()}
                                    className="flex-1"
                                >
                                    <Icon name="plus" size={16} className="mr-2" />
                                    Create Playlist
                                </Button>
                                <Button variant="outline" onClick={onClose}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Existing playlists */}
                            {playlists.length === 0 ? (
                                <div className="text-center py-8">
                                    <Icon name="folder" size={48} className="mx-auto mb-4 text-muted-foreground" />
                                    <h3 className="text-lg font-medium mb-2">No playlists yet</h3>
                                    <p className="text-muted-foreground mb-4">
                                        Create your first playlist to organize your liked videos
                                    </p>
                                    <Button onClick={() => setActiveTab('create')}>
                                        <Icon name="plus" size={16} className="mr-2" />
                                        Create Playlist
                                    </Button>
                                </div>
                            ) : (
                                playlists.map((playlist) => (
                                    <div
                                        key={playlist.id}
                                        className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        {/* Playlist thumbnail */}
                                        <div className="w-16 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
                                            <Icon name="folder" size={20} className="text-muted-foreground" />
                                        </div>

                                        {/* Playlist info */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium line-clamp-1">{playlist.name}</h4>
                                            {playlist.description && (
                                                <p className="text-sm text-muted-foreground line-clamp-1">
                                                    {playlist.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                                <span>{playlist.videoCount} videos</span>
                                                <span>{playlist.isPublic ? 'Public' : 'Private'}</span>
                                                {playlist.isCollaborative && <span>Collaborative</span>}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            {selectedVideos.length > 0 && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => console.log('Add to playlist:', playlist.id)}
                                                >
                                                    Add {selectedVideos.length}
                                                </Button>
                                            )}
                                            <button
                                                onClick={() => setEditingPlaylist(playlist)}
                                                className="p-2 hover:bg-muted rounded-full transition-colors"
                                                title="Edit playlist"
                                            >
                                                <Icon name="settings" size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeletePlaylist(playlist.id)}
                                                className="p-2 hover:bg-muted rounded-full transition-colors text-destructive"
                                                title="Delete playlist"
                                            >
                                                <Icon name="trash" size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};