import Hls from 'hls.js';
import { useEffect, useRef } from 'react';

/**
 * Hook for managing HLS video playback with fallback support
 * Handles both HLS.js (for most browsers) and native HLS (Safari)
 * 
 * @param ref - React ref to video element
 * @param src - HLS stream URL or fallback video source
 */
export function useHlsPlayer(ref: React.RefObject<HTMLVideoElement>, src: string) {
  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    
    let hls: Hls | null = null;
    
    // Check if HLS.js is supported (Chrome, Firefox, Edge)
    if (Hls.isSupported()) {
      hls = new Hls({
        lowLatencyMode: false,
        debug: false,
        enableWorker: true,
        // Error recovery settings
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000, // 60MB
        maxBufferHole: 0.5,
      });
      
      hls.loadSource(src);
      hls.attachMedia(video);
      
      // Error handling for better user experience
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn('HLS Error:', data);
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Fatal network error, trying to recover...');
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Fatal media error, trying to recover...');
              hls?.recoverMediaError();
              break;
            default:
              console.log('Fatal error, cannot recover');
              hls?.destroy();
              break;
          }
        }
      });
      
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari, iOS)
      video.src = src;
      
    } else {
      // Fallback for unsupported browsers
      console.warn('HLS not supported, using direct video source');
      video.src = src;
    }
    
    // Cleanup function to prevent memory leaks
    return () => {
      if (hls) {
        hls.destroy();
        hls = null;
      }
    };
  }, [ref, src]);
}

/**
 * Extended hook with additional controls and state
 * @param ref - React ref to video element
 * @param src - HLS stream URL
 * @param options - Additional configuration options
 */
export function useHlsPlayerWithControls(
  ref: React.RefObject<HTMLVideoElement>, 
  src: string,
  options?: {
    autoplay?: boolean;
    muted?: boolean;
    startTime?: number;
    onReady?: () => void;
    onError?: (error: any) => void;
  }
) {
  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    
    let hls: Hls | null = null;
    
    const handleLoadedData = () => {
      if (options?.startTime && options.startTime > 0) {
        video.currentTime = options.startTime;
      }
      options?.onReady?.();
    };
    
    if (Hls.isSupported()) {
      hls = new Hls({ 
        lowLatencyMode: false,
        maxBufferLength: 30,
        startLevel: -1,           // auto ABR
        capLevelToPlayerSize: true,
        enableWorker: true
      });
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (options?.autoplay) {
          video.play().catch(console.warn);
        }
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        options?.onError?.(data);
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              hls?.destroy();
              break;
          }
        }
      });
      
      hls.loadSource(src);
      hls.attachMedia(video);
      
    } else {
      video.src = src;
      if (options?.autoplay) {
        video.autoplay = true;
      }
    }
    
    if (options?.muted) {
      video.muted = true;
    }
    
    video.addEventListener('loadeddata', handleLoadedData);
    
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      if (hls) {
        hls.destroy();
      }
    };
  }, [ref, src, options]);
}

/**
 * Enhanced hook with all the advanced features needed for YouTube-style player
 * @param ref - React ref to video element
 * @param src - HLS stream URL
 * @param options - Configuration options
 */
export function useEnhancedHlsPlayer(
  ref: React.RefObject<HTMLVideoElement>,
  src: string,
  options?: {
    videoId?: string;
    startTime?: number;
    onProgress?: (time: number, duration: number) => void;
    onEnded?: () => void;
    onError?: (error: any) => void;
  }
) {
  const lastSaveTimeRef = useRef(0);
  const has75PercentPlayedRef = useRef(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    
    let hls: Hls | null = null;
    let progressThrottle: number | null = null;
    
    // Initialize HLS player
    if (Hls.isSupported()) {
      hls = new Hls({
        maxBufferLength: 30,
        startLevel: -1,
        capLevelToPlayerSize: true,
        enableWorker: true
      });
      
      hls.loadSource(src);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        options?.onError?.(data);
      });
    } else {
      video.src = src;
    }
    
    // Set start time if provided
    const setStartTime = () => {
      if (options?.startTime && options.startTime > 0) {
        video.currentTime = options.startTime;
      }
    };
    
    if (video.readyState >= 2) {
      setStartTime();
    } else {
      video.addEventListener('loadeddata', setStartTime, { once: true });
    }
    
    // Time update handler with throttling
    const onTimeUpdate = () => {
      const now = performance.now();
      if (now - lastSaveTimeRef.current < 1000) return;
      
      lastSaveTimeRef.current = now;
      options?.onProgress?.(video.currentTime, video.duration);
      
      // Save watch progress (≥ 20s and ≥ 10% watched)
      if (video.currentTime > 20 && video.duration && video.currentTime / video.duration > 0.1) {
        localStorage.setItem(`rv.pos.${options?.videoId}`, String(Math.floor(video.currentTime)));
      }
      
      // Preload next video at 75% progress
      if (!has75PercentPlayedRef.current && video.duration && video.currentTime / video.duration >= 0.75) {
        has75PercentPlayedRef.current = true;
        // This would trigger a preload in the parent component
      }
    };
    
    // Progress throttling
    const handleProgress = () => {
      if (progressThrottle) {
        cancelAnimationFrame(progressThrottle);
      }
      progressThrottle = requestAnimationFrame(onTimeUpdate);
    };
    
    video.addEventListener('timeupdate', handleProgress);
    
    // Ended handler
    const onEnded = () => {
      options?.onEnded?.();
    };
    
    video.addEventListener('ended', onEnded);
    
    // Cleanup
    return () => {
      video.removeEventListener('loadeddata', setStartTime);
      video.removeEventListener('timeupdate', handleProgress);
      video.removeEventListener('ended', onEnded);
      
      if (progressThrottle) {
        cancelAnimationFrame(progressThrottle);
      }
      
      if (hls) {
        hls.destroy();
      }
    };
  }, [ref, src, options]);
}