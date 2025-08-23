import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnhancedHlsPlayer } from '../../hooks/useHlsPlayer';
import { usePlayerShortcuts } from '../../hooks/usePlayerShortcuts';
import { analytics } from '../../utils/analytics';
import { watchPath } from '../../utils/routes';

interface PlayerShellProps {
  id: string;
  meta: any;
  startAt?: number;
  getNextVideo?: () => { id: string; [key: string]: any } | null;
}

/**
 * YouTube-style video player component with HLS support
 */
export default function PlayerShell({ id, meta, startAt = 0, getNextVideo }: PlayerShellProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const [progressMilestone, setMilestone] = useState(0);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const [docked, setDocked] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  
  const src = meta?.hlsUrl || meta?.src || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
  
  // Enhanced HLS player with all features
  useEnhancedHlsPlayer(ref, src, {
    videoId: id,
    startTime: startAt,
    onProgress: (time, duration) => {
      const pct = time / (duration || 1);
      const m = pct >= 0.75 ? 75 : pct >= 0.5 ? 50 : pct >= 0.25 ? 25 : 0;
      if (m > progressMilestone) {
        setMilestone(m);
        analytics.trackWatchProgress({ videoId: id, milestone: m } as any);
      }
    },
    onEnded: () => {
      analytics.trackWatchComplete({ videoId: id } as any);
      
      // Handle autoplay next
      const autoplay = JSON.parse(localStorage.getItem('rv.autoplay') || 'true');
      if (autoplay) {
        const next = getNextVideo?.();
        if (next) {
          setShowCountdown(true);
          setCountdown(8);
          
          // Start countdown
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = setInterval(() => {
            setCountdown(prev => {
              if (prev <= 1) {
                if (countdownRef.current) clearInterval(countdownRef.current);
                navigate(watchPath(next.id));
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      }
    },
    onError: (error) => {
      console.error('Player error:', error);
    }
  });
  
  // Player shortcuts
  const { showShortcuts, setShowShortcuts } = usePlayerShortcuts(ref, id);
  
  // Analytics tracking
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    
    const onPlay = () => analytics.trackWatchStart({ videoId: id } as any);
    video.addEventListener('play', onPlay);
    
    return () => {
      video.removeEventListener('play', onPlay);
    };
  }, [id]);
  
  // Mini-player on scroll
  useEffect(() => {
    const videoContainer = ref.current?.parentElement;
    if (!videoContainer) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setDocked(entry.intersectionRatio < 0.3);
      },
      { threshold: [0, 0.3, 1] }
    );
    
    observer.observe(videoContainer);
    return () => observer.disconnect();
  }, []);
  
  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);
  
  // Cancel autoplay
  const cancelAutoplay = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    setShowCountdown(false);
  };
  
  return (
    <>
      {/* Main player */}
      <div className="relative aspect-video bg-black rounded-card overflow-hidden">
        <video 
          ref={ref} 
          controls 
          playsInline 
          className="h-full w-full object-contain bg-black" 
        />
        
        {/* Autoplay countdown overlay */}
        {showCountdown && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="text-white text-center">
              <p className="text-lg mb-2">Playing next in {countdown} seconds</p>
              <button 
                onClick={cancelAutoplay}
                className="bg-white text-black px-4 py-2 rounded-full hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Mini-player when docked */}
      {docked && (
        <div className="fixed bottom-4 right-4 w-[360px] h-[202px] rounded-card overflow-hidden shadow-md bg-black z-50">
          <video 
            src={src} 
            controls 
            playsInline 
            autoPlay 
            muted 
            className="w-full h-full object-contain"
          />
        </div>
      )}
      
      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setShowShortcuts(false)}
        >
          <div 
            className="bg-surface rounded-card p-6 max-w-md w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-title font-bold mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-text">Play/Pause</span>
                <span className="text-text-2">k or Space</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text">Skip forward 10s</span>
                <span className="text-text-2">l</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text">Skip back 10s</span>
                <span className="text-text-2">j</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text">Skip forward 5s</span>
                <span className="text-text-2">→</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text">Skip back 5s</span>
                <span className="text-text-2">←</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text">Mute/Unmute</span>
                <span className="text-text-2">m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text">Fullscreen</span>
                <span className="text-text-2">f</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text">Captions</span>
                <span className="text-text-2">c</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text">Share current time</span>
                <span className="text-text-2">s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text">Show shortcuts</span>
                <span className="text-text-2">?</span>
              </div>
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              className="mt-4 w-full py-2 bg-brand hover:bg-brand/80 text-white rounded-card transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}