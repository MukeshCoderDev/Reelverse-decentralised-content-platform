import { useState, useEffect } from 'react';
import { LiveGrid, LiveGridVariants } from '../components/live/LiveGrid';
import { LiveCardProps } from '../components/live/LiveCard';
import { useLiveStats } from '../hooks/useLivePresence';

/**
 * Filter options for live streams
 */
type LiveFilter = 'all' | 'following' | 'gaming' | 'irl' | 'music' | 'tech' | 'art' | 'education';

/**
 * Sort options for live streams
 */
type LiveSort = 'viewers' | 'recent' | 'trending' | 'alphabetical';

/**
 * Generate mock live stream data
 */
const generateMockStreams = (count: number, filter?: LiveFilter): LiveCardProps[] => {
  const categories = ['Gaming', 'Music', 'IRL', 'Tech', 'Art', 'Education', 'Cooking', 'Fitness'];
  const gameCategories = ['Valorant', 'League of Legends', 'Minecraft', 'GTA V', 'Fortnite', 'CS:GO'];
  const languages = ['en', 'es', 'fr', 'de', 'ja', 'ko'];
  
  const streamTitles = [
    'Epic Gaming Session - Come Join!',
    'Building the Future with AI',
    'Chill Music & Chat',
    'Learning React - Ask Questions!',
    'Morning Workout Routine',
    'Digital Art Creation Process',
    'Cooking Italian Tonight 🍝',
    'Late Night Coding Stream',
    'Q&A with the Community',
    'First Playthrough - No Spoilers!'
  ];

  const creators = [
    { name: 'TechGuru', username: 'techguru123', verified: true },
    { name: 'PixelPainter', username: 'pixelpainter', verified: false },
    { name: 'MusicMaster', username: 'musicmaster', verified: true },
    { name: 'GameWizard', username: 'gamewizard', verified: true },
    { name: 'CodeNinja', username: 'codeninja', verified: false },
    { name: 'ArtistPro', username: 'artistpro', verified: true },
    { name: 'ChefCooking', username: 'chefcooking', verified: false },
    { name: 'FitnessGuru', username: 'fitnessguru', verified: true }
  ];

  return Array.from({ length: count }, (_, i) => {
    const creator = creators[i % creators.length];
    const category = filter === 'gaming' 
      ? gameCategories[i % gameCategories.length]
      : categories[i % categories.length];
    
    const isLive = Math.random() > 0.1; // 90% chance of being live
    const viewers = Math.floor(100 + Math.random() * 15000);
    const title = streamTitles[i % streamTitles.length];
    const language = languages[Math.floor(Math.random() * languages.length)];
    
    return {
      id: `live_${i + 1}`,
      title: `${title} ${filter === 'gaming' ? `- ${category}` : ''}`,
      creator: {
        id: creator.username,
        name: creator.name,
        username: creator.username,
        avatarUrl: `https://i.pravatar.cc/64?img=${i + 10}`,
        verified: creator.verified,
        followerCount: Math.floor(1000 + Math.random() * 100000)
      },
      posterUrl: `https://picsum.photos/seed/live${i}/800/450`,
      viewers,
      category,
      tags: [category.toLowerCase(), 'live', language],
      isLive,
      language: language !== 'en' ? language : undefined,
      isFollowing: Math.random() > 0.7, // 30% chance of following
      scheduledAt: !isLive ? new Date(Date.now() + Math.random() * 3600000).toISOString() : undefined
    };
  });
};

/**
 * LiveFeedPage component for the /live route
 */
export default function LiveFeedPage() {
  const [activeFilter, setActiveFilter] = useState<LiveFilter>('all');
  const [activeSort, setActiveSort] = useState<LiveSort>('viewers');
  const [isLoading, setIsLoading] = useState(true);
  
  // Mock stream data
  const [allStreams, setAllStreams] = useState<LiveCardProps[]>([]);
  const [followingStreams, setFollowingStreams] = useState<LiveCardProps[]>([]);
  const [upcomingStreams, setUpcomingStreams] = useState<LiveCardProps[]>([]);
  
  // Get stats for all streams
  const streamIds = allStreams.map(s => s.id);
  const { totalViewers, liveStreamCount } = useLiveStats(streamIds);

  // Filter options
  const filterOptions: { value: LiveFilter; label: string; icon?: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'following', label: 'Following', icon: '👥' },
    { value: 'gaming', label: 'Gaming', icon: '🎮' },
    { value: 'music', label: 'Music', icon: '🎵' },
    { value: 'irl', label: 'IRL', icon: '📹' },
    { value: 'tech', label: 'Tech', icon: '💻' },
    { value: 'art', label: 'Art', icon: '🎨' },
    { value: 'education', label: 'Education', icon: '📚' }
  ];

  // Sort options
  const sortOptions: { value: LiveSort; label: string }[] = [
    { value: 'viewers', label: 'Most Viewers' },
    { value: 'recent', label: 'Recently Started' },
    { value: 'trending', label: 'Trending' },
    { value: 'alphabetical', label: 'A-Z' }
  ];

  // Load mock data
  useEffect(() => {
    setIsLoading(true);
    
    setTimeout(() => {
      const mockStreams = generateMockStreams(24, activeFilter === 'all' ? undefined : activeFilter);
      const mockFollowing = mockStreams.filter(s => s.isFollowing).slice(0, 8);
      const mockUpcoming = generateMockStreams(6).map(s => ({ ...s, isLive: false }));
      
      setAllStreams(mockStreams);
      setFollowingStreams(mockFollowing);
      setUpcomingStreams(mockUpcoming);
      setIsLoading(false);
    }, 500);
  }, [activeFilter]);

  // Filter and sort streams
  const getFilteredStreams = () => {
    let filtered = [...allStreams];

    // Apply filters
    if (activeFilter === 'following') {
      filtered = filtered.filter(s => s.isFollowing);
    }

    // Apply sorting
    switch (activeSort) {
      case 'viewers':
        filtered.sort((a, b) => b.viewers - a.viewers);
        break;
      case 'recent':
        filtered.sort((a, b) => new Date(b.id).getTime() - new Date(a.id).getTime());
        break;
      case 'trending':
        // Mock trending algorithm (viewers + growth rate)
        filtered.sort((a, b) => (b.viewers * 1.2) - (a.viewers * 1.2));
        break;
      case 'alphabetical':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return filtered;
  };

  const filteredStreams = getFilteredStreams();

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Live header section */}
      <div className="bg-gradient-to-r from-violet-900/20 to-red-900/20 border-b border-slate-800">
        <div className="mx-auto max-w-[1400px] px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            {/* Title and stats */}
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Live Now
              </h1>
              <div className="flex items-center gap-6 text-slate-300">
                <span className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                  {liveStreamCount.toLocaleString()} creators streaming
                </span>
                <span>{totalViewers.toLocaleString()} total viewers</span>
              </div>
              <p className="text-slate-400 mt-2 max-w-2xl">
                Watch creators streaming in real time. Tip in USDC — gas covered by the Reelverse Treasury.
              </p>
            </div>

            {/* Go Live CTA */}
            <div className="flex-shrink-0">
              <a
                href="/studio/go-live"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-red-600 hover:from-violet-700 hover:to-red-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                Go Live
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-10 backdrop-blur-sm">
        <div className="mx-auto max-w-[1400px] px-4 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Category filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setActiveFilter(option.value)}
                  className={`
                    inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors
                    ${activeFilter === option.value
                      ? 'bg-violet-600 text-white shadow-lg'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }
                  `}
                >
                  {option.icon && <span>{option.icon}</span>}
                  {option.label}
                  {option.value === 'following' && followingStreams.length > 0 && (
                    <span className="bg-slate-700 text-xs px-1.5 py-0.5 rounded-full">
                      {followingStreams.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Sort controls */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400 hidden sm:block">Sort by:</span>
              <select
                value={activeSort}
                onChange={(e) => setActiveSort(e.target.value as LiveSort)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1400px] px-4 py-8 space-y-12">
        {/* Following Section (if user follows creators) */}
        {activeFilter === 'all' && followingStreams.length > 0 && (
          <LiveGridVariants.Following 
            streams={followingStreams}
            isLoading={isLoading}
          />
        )}

        {/* Main Live Streams Grid */}
        <LiveGrid
          streams={filteredStreams}
          title={
            activeFilter === 'all' 
              ? 'All Live Streams'
              : activeFilter === 'following'
              ? 'Following Live'
              : `${filterOptions.find(f => f.value === activeFilter)?.label} Streams`
          }
          subtitle={
            activeFilter === 'following' && filteredStreams.length === 0
              ? 'None of the creators you follow are currently live'
              : undefined
          }
          layout="grid"
          showCategories={activeFilter === 'all'}
          isLoading={isLoading}
          emptyMessage={
            activeFilter === 'following'
              ? 'Follow some creators to see their live streams here!'
              : 'No live streams in this category right now'
          }
        />

        {/* Upcoming Section */}
        {activeFilter === 'all' && upcomingStreams.length > 0 && (
          <LiveGridVariants.Upcoming 
            streams={upcomingStreams}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Load More (for infinite scroll or pagination) */}
      {!isLoading && filteredStreams.length >= 24 && (
        <div className="mx-auto max-w-[1400px] px-4 pb-12">
          <div className="text-center">
            <button className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors">
              Load More Streams
            </button>
          </div>
        </div>
      )}
    </div>
  );
}