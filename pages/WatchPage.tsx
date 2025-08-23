import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import PlayerShell from '../components/watch/PlayerShell';
import TitleRow from '../components/watch/TitleRow';
import ActionsBar from '../components/watch/ActionsBar';
import DescriptionBox from '../components/watch/DescriptionBox';
import UpNextRail from '../components/watch/UpNextRail';
import Comments from '../components/watch/Comments';
import SkeletonVideo from '../components/watch/SkeletonVideo';
import { parseTimecode } from '../utils/time';
import { track } from '../utils/analytics';

interface VideoMetadata {
  id: string;
  title: string;
  description?: string;
  hlsUrl?: string;
  src?: string;
  author?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  counts?: {
    views?: number;
    likes?: number;
  };
  createdAt?: string;
  duration?: number;
}

interface ApiResponse {
  success: boolean;
  data?: VideoMetadata;
  error?: string;
}

/**
 * YouTube-style WatchPage component for video playback
 */
export default function WatchPage() {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Cast location state with proper typing
  const locationState = location.state as { from?: string; scrollY?: number } | null;
  
  // Component state
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [upNextItems, setUpNextItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [upNextLoading, setUpNextLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResume, setShowResume] = useState<{ at: number } | null>(null);
  
  // Handle timecode deep linking
  const tMatch = new URLSearchParams(location.search).get('t') || '';
  const startSeconds = parseTimecode(tMatch);
  
  // Fetch video metadata
  useEffect(() => {
    let isMounted = true;
    
    const fetchVideoData = async () => {
      if (!id) {
        setError('No video ID provided');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        // Attempt to fetch video metadata from API
        const response = await fetch(`/api/videos/${encodeURIComponent(id)}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
        
        if (!isMounted) return;
        
        if (response.ok) {
          const apiResponse: ApiResponse = await response.json();
          
          if (apiResponse.success && apiResponse.data) {
            const meta = apiResponse.data;
            setMetadata(meta);
            
            // Update document title and meta tags
            document.title = `${meta.title} - Reelverse`;
            updateMetaTags(meta);
          } else {
            console.warn('API returned unsuccessful response:', apiResponse);
            setMetadata({
              id,
              title: 'Test Video',
              description: 'Fallback test stream',
            });
          }
        } else {
          console.warn('Failed to fetch video metadata:', response.status);
          // Use fallback stream when API fails
          setMetadata({
            id,
            title: 'Video',
            description: 'Unable to load video metadata',
          });
        }
      } catch (err) {
        console.error('Error fetching video data:', err);
        
        if (isMounted) {
          // Fallback to test stream on any error
          setMetadata({
            id,
            title: 'Video',
            description: 'Failed to load video metadata',
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchVideoData();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [id]);
  
  // Fetch up next videos
  useEffect(() => {
    let isMounted = true;
    
    const fetchUpNext = async () => {
      if (!id) return;
      
      try {
        setUpNextLoading(true);
        
        // In a real app, this would fetch from an API
        // For now, we'll use mock data
        const mockUpNext = [
          {
            id: 'next1',
            title: 'Next Video 1',
            channel: { name: 'Channel 1' },
            views: 15000,
            durationSec: 320,
            posterUrl: '',
            publishedAt: '2 days ago'
          },
          {
            id: 'next2',
            title: 'Next Video 2',
            channel: { name: 'Channel 2' },
            views: 42000,
            durationSec: 180,
            posterUrl: '',
            publishedAt: '1 week ago'
          },
          {
            id: 'next3',
            title: 'Next Video 3',
            channel: { name: 'Channel 3' },
            views: 8900,
            durationSec: 450,
            posterUrl: '',
            publishedAt: '3 days ago'
          }
        ];
        
        if (isMounted) {
          setUpNextItems(mockUpNext);
          setUpNextLoading(false);
        }
      } catch (err) {
        console.error('Error fetching up next videos:', err);
        if (isMounted) {
          setUpNextItems([]);
          setUpNextLoading(false);
        }
      }
    };
    
    fetchUpNext();
    
    return () => {
      isMounted = false;
    };
  }, [id]);
  
  // Check for saved watch progress
  useEffect(() => {
    if (!id || startSeconds > 0) return;
    
    const saved = Number(localStorage.getItem(`rv.pos.${id}`) || 0);
    if (saved > 0) {
      setShowResume({ at: saved });
    }
  }, [id, startSeconds]);
  
  // Handle back navigation with scroll restoration
  const handleBack = () => {
    if (locationState?.from) {
      navigate(-1);
      
      // Restore scroll position after navigation
      setTimeout(() => {
        window.scrollTo(0, locationState.scrollY ?? 0);
      }, 50);
    } else {
      // Fallback to home page
      navigate('/');
    }
  };
  
  // Update meta tags for SEO
  const updateMetaTags = (meta: VideoMetadata) => {
    // Update og:title
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', meta.title);
    
    // Update og:description
    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (!ogDescription) {
      ogDescription = document.createElement('meta');
      ogDescription.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescription);
    }
    ogDescription.setAttribute('content', meta.description || meta.title);
    
    // Update og:image
    let ogImage = document.querySelector('meta[property="og:image"]');
    if (!ogImage) {
      ogImage = document.createElement('meta');
      ogImage.setAttribute('property', 'og:image');
      document.head.appendChild(ogImage);
    }
    ogImage.setAttribute('content', meta.id ? `/api/videos/${meta.id}/thumbnail` : '');
  };
  
  // Get next video for autoplay
  const getNextVideo = () => {
    return upNextItems.length > 0 ? upNextItems[0] : null;
  };
  
  // Handle resume confirmation
  const handleResume = () => {
    if (showResume) {
      // The PlayerShell will handle the actual resume
      setShowResume(null);
    }
  };
  
  // Handle skip resume
  const handleSkipResume = () => {
    setShowResume(null);
  };
  
  if (error) {
    return (
      <div className="mx-auto max-w-container px-4 md:px-6 py-8">
        <button 
          onClick={handleBack}
          className="text-text-2 hover:text-text text-sm mb-4 transition-colors"
        >
          ← Back
        </button>
        
        <div className="text-center py-12">
          <h1 className="text-title font-bold text-live mb-4">Video Not Found</h1>
          <p className="text-text-2 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-brand hover:bg-purple-700 text-white px-6 py-2 rounded-full transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
      {/* Main video area */}
      <div className="space-y-4">
        {/* Resume prompt */}
        {showResume && (
          <div className="bg-surface border border-border rounded-card p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">Resume watching?</p>
              <p className="text-sm text-text-2">Continue from {Math.floor(showResume.at / 60)}:{String(showResume.at % 60).padStart(2, '0')}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSkipResume}
                className="px-3 py-1.5 text-sm border border-border rounded-full hover:bg-hover"
              >
                Skip
              </button>
              <button
                onClick={handleResume}
                className="px-3 py-1.5 text-sm bg-brand text-white rounded-full hover:bg-brand/90"
              >
                Resume
              </button>
            </div>
          </div>
        )}
        
        {/* Video player */}
        {loading ? (
          <SkeletonVideo />
        ) : (
          metadata && (
            <PlayerShell 
              id={id} 
              meta={metadata} 
              startAt={startSeconds || (showResume?.at || 0)}
              getNextVideo={getNextVideo}
            />
          )
        )}
        
        {/* Video metadata */}
        {metadata && (
          <>
            <TitleRow meta={metadata} />
            <ActionsBar videoId={id} meta={metadata} />
            <DescriptionBox meta={metadata} />
            <Comments videoId={id} />
          </>
        )}
      </div>
      
      {/* Sidebar with Up Next */}
      <aside>
        <UpNextRail 
          currentId={id} 
          channelId={metadata?.author?.id} 
          items={upNextItems}
          loading={upNextLoading}
        />
      </aside>
    </div>
  );
}