/**
 * Live Data Management System
 * Provides mock live stream data and lookup functions
 * TODO: Replace with actual API integration when backend is ready
 */

export interface LiveStream {
  id: string;
  title: string;
  posterUrl: string;
  src: string;
  creator?: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string;
    verified: boolean;
  };
  viewers?: number;
  category?: string;
  isLive?: boolean;
  description?: string;
}

/**
 * Mock live stream data - consistent IDs for routing
 */
const LIVE_STREAMS: LiveStream[] = Array.from({ length: 12 }, (_, i) => ({
  id: `live_${i + 1}`,
  title: `Live ${i + 1} — Q&A Session`,
  posterUrl: `https://picsum.photos/seed/live${i}/800/450`,
  src: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', // Consistent test stream
  creator: {
    id: `creator_${i + 1}`,
    name: ['TechGuru', 'PixelPainter', 'MusicMaster', 'GameWizard', 'CodeNinja', 'ArtistPro', 'ChefCooking', 'FitnessGuru'][i % 8],
    username: `user${i + 1}`,
    avatarUrl: `https://i.pravatar.cc/64?img=${i + 20}`,
    verified: i % 3 === 0,
  },
  viewers: Math.floor(100 + Math.random() * 5000),
  category: ['Tech', 'Gaming', 'Music', 'Art', 'Cooking', 'Fitness', 'Education', 'IRL'][i % 8],
  isLive: true,
  description: `Join me for an interactive Q&A session! We'll be discussing ${['the latest tech trends', 'game strategies', 'music production', 'digital art techniques', 'cooking tips', 'workout routines', 'learning concepts', 'daily life'][i % 8]} and answering your questions.`,
}));

/**
 * Get all live streams
 */
export const getAllLive = (): LiveStream[] => {
  return LIVE_STREAMS;
};

/**
 * Get live stream by ID
 * Returns undefined if not found (for fallback handling)
 */
export const getLiveById = (id: string): LiveStream | undefined => {
  return LIVE_STREAMS.find(stream => stream.id === id);
};

/**
 * Get live streams by category
 */
export const getLiveByCategory = (category: string): LiveStream[] => {
  return LIVE_STREAMS.filter(stream => 
    stream.category?.toLowerCase() === category.toLowerCase()
  );
};

/**
 * Get trending live streams (mock algorithm)
 */
export const getTrendingLive = (limit = 6): LiveStream[] => {
  return LIVE_STREAMS
    .sort((a, b) => (b.viewers || 0) - (a.viewers || 0))
    .slice(0, limit);
};

/**
 * Search live streams by title or creator
 */
export const searchLiveStreams = (query: string): LiveStream[] => {
  const searchTerm = query.toLowerCase();
  return LIVE_STREAMS.filter(stream =>
    stream.title.toLowerCase().includes(searchTerm) ||
    stream.creator?.name.toLowerCase().includes(searchTerm) ||
    stream.creator?.username.toLowerCase().includes(searchTerm)
  );
};

/**
 * Get live stream count (for header badge)
 */
export const getLiveStreamCount = (): number => {
  return LIVE_STREAMS.filter(stream => stream.isLive).length;
};