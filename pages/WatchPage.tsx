import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useHlsPlayer } from '../hooks/useHlsPlayer';
import { WatchPageState } from '../components/video/VideoCard';
import ActionRail from '../components/video/ActionRail';

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
 * WatchPage component for video playback with HLS support
 * Handles navigation state and provides fallback streaming
 */
export default function WatchPage() {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Cast location state with proper typing
  const locationState = location.state as WatchPageState | null;
  
  // Component state
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Video element ref for HLS player
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Initialize HLS player
  useHlsPlayer(videoRef, videoSrc);
  
  // Fetch video metadata and determine source
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
            
            // Prefer HLS URL, fallback to src, then test stream
            const source = meta.hlsUrl || 
                          meta.src || 
                          'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
            setVideoSrc(source);
          } else {
            console.warn('API returned unsuccessful response:', apiResponse);
            setVideoSrc('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
            setMetadata({
              id,
              title: 'Test Video',
              description: 'Fallback test stream',
            });
          }
        } else {
          console.warn('Failed to fetch video metadata:', response.status);
          // Use fallback stream when API fails
          setVideoSrc('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
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
          setVideoSrc('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
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
  
  // Handle timecode deep linking
  useEffect(() => {
    if (!videoRef.current || !videoSrc) return;
    
    const urlParams = new URLSearchParams(location.search);
    const startTime = parseInt(urlParams.get('t') || '0');
    
    if (startTime > 0) {
      const video = videoRef.current;
      
      const seekToTime = () => {
        video.currentTime = startTime;
        video.removeEventListener('loadeddata', seekToTime);
      };
      
      if (video.readyState >= 2) {
        // Video is already loaded
        video.currentTime = startTime;
      } else {
        // Wait for video to load
        video.addEventListener('loadeddata', seekToTime);
      }
    }
  }, [videoSrc, location.search]);
  
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
  
  // Format view count
  const formatViews = (count?: number) => {
    if (!count) return '0 views';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M views`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K views`;
    return `${count} views`;
  };
  
  // Format upload date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return '';
    }
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
    <div className="mx-auto max-w-container px-4 md:px-6 py-4">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
        {/* Main video area */}
        <div className="space-y-4">
          {/* Back button */}
          <button 
            onClick={handleBack}
            className="text-text-2 hover:text-text text-sm transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          
          {/* Video player */}
          <div className="relative aspect-video bg-black rounded-card overflow-hidden">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-surface">
                <div className="text-text text-center">
                  <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p>Loading video...</p>
                </div>
              </div>
            ) : (
              <video 
                ref={videoRef}
                controls
                playsInline
                muted
                autoPlay
                className="h-full w-full object-contain bg-black"
                poster={metadata?.id ? `/api/videos/${metadata.id}/thumbnail` : undefined}
              />
            )}
          </div>
          
          {/* Video metadata */}
          <div className="space-y-4">
            <h1 className="text-title font-bold text-text">
              {metadata?.title ?? 'Loading...'}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-video-meta text-text-2">
              {metadata?.counts?.views != null && (
                <span>{formatViews(metadata.counts.views)}</span>
              )}
              
              {metadata?.createdAt && (
                <span>{formatDate(metadata.createdAt)}</span>
              )}
              
              {metadata?.author && (
                <span>by {metadata.author.name}</span>
              )}
            </div>

            {/* Action Rail - Monetization Controls */}
            {metadata && metadata.author && (
              <ActionRail
                videoId={metadata.id}
                creatorId={metadata.author.id}
                creatorName={metadata.author.name}
                videoTitle={metadata.title}
                onTipSuccess={(amount) => {
                  // Track tip success
                  console.log(`Tip of $${amount} sent successfully`);
                }}
                onSubscriptionChange={(subscribed) => {
                  // Track subscription change
                  console.log(`Subscription ${subscribed ? 'activated' : 'deactivated'}`);
                }}
              />
            )}
            
            {metadata?.description && (
              <div className="bg-surface rounded-card border border-border p-4">
                <p className="text-text text-sm whitespace-pre-wrap">
                  {metadata.description}
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Sidebar with Up Next */}
        <aside className="space-y-4">
          <div className="bg-surface rounded-card border border-border p-4">
            <h2 className="text-heading font-semibold text-text mb-3">Up Next</h2>
            <div className="space-y-3">
              {/* Mock up next videos - in a real app, these would be fetched */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 group cursor-pointer">
                  <div className="relative w-32 h-18 flex-shrink-0 rounded overflow-hidden bg-border">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                    <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white px-1 rounded">5:{10 + i}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-text line-clamp-2 group-hover:text-brand transition-colors">
                      Video Title {i} - Related to current video
                    </h3>
                    <p className="text-xs text-text-2 mt-1">Channel Name</p>
                    <p className="text-xs text-text-3 mt-1">10K views • 2 days ago</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Additional metadata panel */}
          {metadata && (
            <div className="bg-surface rounded-card border border-border p-4">
              <h3 className="text-heading font-semibold text-text mb-3">Video Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-2">Video ID:</span>
                  <span className="text-text font-mono text-xs">{metadata.id}</span>
                </div>
                
                {metadata.duration && (
                  <div className="flex justify-between">
                    <span className="text-text-2">Duration:</span>
                    <span className="text-text">
                      {Math.floor(metadata.duration / 60)}:{String(metadata.duration % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}