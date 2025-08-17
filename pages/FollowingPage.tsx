
import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { VerticalFeed } from '../components/feeds/VerticalFeed';
import { fetchFollowing } from '../lib/fetchers';
import Button from '../components/Button';
import Icon from '../components/Icon';

type FilterType = 'all' | 'recent' | 'popular';

const FollowingPage: React.FC = () => {
    const [filter, setFilter] = useState<FilterType>('all');
    // hide stories by default so header stays compact like TikTok
    const [showStories, setShowStories] = useState(false);

    // Mock creator stories (Instagram-style)
    const creatorStories = [
        { id: '1', creator: 'TechGuru', avatar: 'https://picsum.photos/seed/tech/64/64', hasNew: true },
        { id: '2', creator: 'PixelPlays', avatar: 'https://picsum.photos/seed/pixel/64/64', hasNew: true },
        { id: '3', creator: 'DIYDebi', avatar: 'https://picsum.photos/seed/diy/64/64', hasNew: false },
        { id: '4', creator: 'LensExplorer', avatar: 'https://picsum.photos/seed/lens/64/64', hasNew: true },
        { id: '5', creator: 'CryptoCadet', avatar: 'https://picsum.photos/seed/crypto/64/64', hasNew: false },
    ];

    return (
        <div className="min-h-screen bg-background">
            {/* Compact TikTok-style header (overlay) */}
            <div className="sticky top-0 z-20 bg-transparent">
                <div className="flex items-center justify-between py-2 px-3">
                    <h1 className="text-base font-semibold">Following</h1>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                            <Icon name="search" size={18} />
                        </Button>
                        <Button variant="ghost" size="sm">
                            <Icon name="filter" size={18} />
                        </Button>
                    </div>
                </div>

                {/* Instagram-style story highlights */}
                {showStories && (
                    <div className="px-4 pb-4">
                        <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
                            {creatorStories.map((story) => (
                                <div key={story.id} className="flex-shrink-0 text-center">
                                    <div className={`relative w-16 h-16 rounded-full p-0.5 ${
                                        story.hasNew 
                                            ? 'bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-500' 
                                            : 'bg-muted'
                                    }`}>
                                        <img 
                                            src={story.avatar} 
                                            alt={story.creator}
                                            className="w-full h-full rounded-full object-cover bg-background p-0.5"
                                        />
                                        {story.hasNew && (
                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-background flex items-center justify-center">
                                                <Icon name="plus" size={10} className="text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs mt-1 truncate w-16">{story.creator}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Compact filter tabs (small pills) */}
                <div className="flex items-center justify-center">
                    {(['all', 'recent', 'popular'] as FilterType[]).map((filterType) => (
                        <button
                            key={filterType}
                            onClick={() => setFilter(filterType)}
                            className={`mx-1 px-3 py-2 text-sm font-medium capitalize rounded-full transition-colors ${
                                filter === filterType ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50'
                            }`}
                        >
                            {filterType}
                        </button>
                    ))}
                </div>
            </div>

            {/* TikTok-style vertical feed (full-bleed) */}
            <div className="w-full">
                <VerticalFeed fetcher={fetchFollowing} compact />
            </div>
        </div>
    );
};

export default FollowingPage;
