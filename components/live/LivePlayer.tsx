import { useEffect, useRef, useState, useCallback } from 'react';
import { LiveBadge } from './LiveBadge';
import { useLivePresence } from '../../hooks/useLivePresence';
import { useNumberFormat } from '../../hooks/useNumberFormat';

// Note: HLS.js will need to be added to package.json
// For now, we'll create the component structure and handle the case where HLS is not available

/**
 * Player quality options
 */
export type PlayerQuality = 'auto' | '1080p' | '720p' | '480p' | '360p';

/**
 * Player state interface
 */
export interface PlayerState {
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  quality: PlayerQuality;
  captionsEnabled: boolean;
  isFullscreen: boolean;
  currentTime: number;
  liveHeadTime: number;
  isLive: boolean;
  buffering: boolean;
}

/**
 * Live player component properties
 */
export interface LivePlayerProps {
  /** Stream ID for presence tracking */
  streamId: string;
  /** HLS stream source URL */
  src: string;
  /** Poster image URL */
  poster?: string;
  /** Whether to autoplay */
  autoplay?: boolean;
  /** Whether to show controls */
  showControls?: boolean;
  /** Whether to allow fullscreen */
  allowFullscreen?: boolean;
  /** Whether DVR (rewind) is enabled */
  dvrEnabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when player state changes */
  onStateChange?: (state: Partial<PlayerState>) => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

/**
 * LivePlayer component for HLS live stream playback
 * Supports low-latency HLS with DVR capabilities
 */
export function LivePlayer({
  streamId,
  src,
  poster,
  autoplay = false,
  showControls = true,
  allowFullscreen = true,
  dvrEnabled = true,
  className = '',
  onStateChange,
  onError
}: LivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const { viewers, isLive: streamIsLive, latencyMs, quality: streamQuality } = useLivePresence(streamId);
  const { formatViewers } = useNumberFormat();

  // Player state
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    volume: 1,
    muted: false,
    quality: 'auto',
    captionsEnabled: false,
    isFullscreen: false,
    currentTime: 0,
    liveHeadTime: 0,
    isLive: true,
    buffering: false
  });

  const [hlsLoaded, setHlsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update player state and notify parent
  const updatePlayerState = useCallback((updates: Partial<PlayerState>) => {
    setPlayerState(prev => {
      const newState = { ...prev, ...updates };
      onStateChange?.(updates);
      return newState;
    });
  }, [onStateChange]);

  // Initialize HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Try to load HLS.js dynamically
    const initializeHLS = async () => {
      try {
        // Dynamically import HLS.js (will need to be installed)
        const Hls = (await import('hls.js')).default;
        
        if (Hls.isSupported()) {
          const hls = new Hls({
            lowLatencyMode: true,
            enableWorker: true,
            maxBufferLength: 4,
            maxMaxBufferLength: 8,
            liveSyncDurationCount: 1,
            liveMaxLatencyDurationCount: 3
          });

          hlsRef.current = hls;

          hls.loadSource(src);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setHlsLoaded(true);
            setError(null);
            if (autoplay) {
              video.play().catch(console.warn);
            }
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS error:', data);
            if (data.fatal) {
              setError('Stream unavailable');
              onError?.(new Error(data.details || 'HLS fatal error'));
            }
          });

          return () => {
            hls.destroy();
          };
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS support (Safari)
          video.src = src;
          setHlsLoaded(true);
          if (autoplay) {
            video.play().catch(console.warn);
          }
        } else {
          setError('HLS not supported');
          onError?.(new Error('HLS not supported in this browser'));
        }
      } catch (err) {
        console.warn('HLS.js not available, falling back to native video');
        // Fallback to native video element
        video.src = src;
        setHlsLoaded(true);
        if (autoplay) {
          video.play().catch(console.warn);
        }
      }
    };

    initializeHLS();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [src, autoplay, onError]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => updatePlayerState({ isPlaying: true, buffering: false });
    const handlePause = () => updatePlayerState({ isPlaying: false });
    const handleVolumeChange = () => updatePlayerState({ 
      volume: video.volume, 
      muted: video.muted 
    });
    const handleTimeUpdate = () => updatePlayerState({ 
      currentTime: video.currentTime,
      liveHeadTime: video.duration || 0
    });
    const handleWaiting = () => updatePlayerState({ buffering: true });
    const handleCanPlay = () => updatePlayerState({ buffering: false });
    const handleError = () => {
      setError('Playback error');
      onError?.(new Error('Video playback error'));
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [updatePlayerState, onError]);

  // Player control functions
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (playerState.isPlaying) {
      video.pause();
    } else {
      video.play().catch(console.warn);
    }
  };

  const seekToLive = () => {
    const video = videoRef.current;
    if (!video || !dvrEnabled) return;

    if (hlsRef.current) {
      // Seek to live edge for HLS
      video.currentTime = video.duration - 1;
    } else {
      // For non-HLS streams, reload to get live edge
      video.load();
      if (playerState.isPlaying) {
        video.play().catch(console.warn);
      }
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const setVolume = (volume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, volume));
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video || !allowFullscreen) return;

    if (!document.fullscreenElement) {
      video.requestFullscreen().catch(console.warn);
      updatePlayerState({ isFullscreen: true });
    } else {
      document.exitFullscreen().catch(console.warn);
      updatePlayerState({ isFullscreen: false });
    }
  };

  // Stream health indicator
  const getStreamHealthColor = () => {
    if (!streamIsLive) return 'text-red-500';
    if (latencyMs < 2500) return 'text-green-500';
    if (latencyMs < 4000) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Error state
  if (error) {
    return (
      <div className={`relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center ${className}`}>
        <div className="text-center p-6">
          <div className="h-16 w-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-slate-300 text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full aspect-video bg-black rounded-xl overflow-hidden group ${className}`}>
      {/* Video element */}
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        className="h-full w-full object-contain"
        controls={false} // Custom controls
      />

      {/* Loading state */}
      {!hlsLoaded && (
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
            <span className="text-slate-300">Loading stream...</span>
          </div>
        </div>
      )}

      {/* Buffering indicator */}
      {playerState.buffering && hlsLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        </div>
      )}

      {/* Top overlays */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none">
        {/* Live badge */}
        <div className="flex items-center gap-2">
          <LiveBadge 
            variant={streamIsLive ? 'live' : 'ended'}
            text={streamIsLive ? 'LIVE' : 'OFFLINE'}
          />
          {streamIsLive && dvrEnabled && (
            <span className="text-xs text-slate-300 bg-black/40 rounded px-2 py-1 backdrop-blur-sm">
              DVR
            </span>
          )}
        </div>

        {/* Viewer count and stream health */}
        <div className="flex items-center gap-2">
          <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-white text-sm font-semibold">
            {formatViewers(viewers)}
          </div>
          <div className={`text-xs ${getStreamHealthColor()}`} title={`Latency: ${latencyMs}ms`}>
            ● {latencyMs}ms
          </div>
        </div>
      </div>

      {/* Custom controls overlay */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between">
            {/* Play controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="text-white hover:text-violet-400 transition-colors p-1"
                aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
              >
                {playerState.isPlaying ? (
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Volume controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-violet-400 transition-colors p-1"
                  aria-label={playerState.muted ? 'Unmute' : 'Mute'}
                >
                  {playerState.muted || playerState.volume === 0 ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={playerState.muted ? 0 : playerState.volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-16 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-3">
              {/* Live/DVR controls */}
              {dvrEnabled && streamIsLive && (
                <button
                  onClick={seekToLive}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  Go Live
                </button>
              )}

              {/* Fullscreen */}
              {allowFullscreen && (
                <button
                  onClick={toggleFullscreen}
                  className="text-white hover:text-violet-400 transition-colors p-1"
                  aria-label="Fullscreen"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}