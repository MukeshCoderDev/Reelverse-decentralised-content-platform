import Hls from 'hls.js';
import { useEffect } from 'react';

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
      hls = new Hls({ lowLatencyMode: false });
      
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