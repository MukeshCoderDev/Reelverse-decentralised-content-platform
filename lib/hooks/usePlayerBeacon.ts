/**
 * React Hook for Video Player Beacon Integration
 * Automatically tracks video player events and sends metrics
 */

import { useEffect, useRef, useCallback } from 'react';
import { PlayerBeaconService, PlayerEvent, VideoPlayerState } from '../../services/playerBeaconService';

export interface UsePlayerBeaconOptions {
  contentId: string;
  userId?: string;
  autoTrack?: boolean;
  sampleRate?: number;
  debugMode?: boolean;
}

export interface PlayerBeaconHook {
  sessionId: string | null;
  trackEvent: (eventType: string, data?: any) => void;
  trackBusinessEvent: (eventType: string, data?: any) => void;
  getSessionMetrics: () => any;
  finalizeSession: () => void;
}

export function usePlayerBeacon(
  videoRef: React.RefObject<HTMLVideoElement>,
  options: UsePlayerBeaconOptions
): PlayerBeaconHook {
  const beaconService = PlayerBeaconService.getInstance();
  const sessionIdRef = useRef<string | null>(null);
  const isTrackingRef = useRef(false);
  const lastTimeUpdateRef = useRef(0);

  // Initialize session
  useEffect(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = beaconService.initializeSession(options.contentId, options.userId);
      
      if (options.debugMode) {
        console.log('[usePlayerBeacon] Session initialized:', sessionIdRef.current);
      }
    }

    return () => {
      if (sessionIdRef.current) {
        beaconService.finalizeSession(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
  }, [options.contentId, options.userId]);

  // Get current player state
  const getPlayerState = useCallback((): VideoPlayerState | undefined => {
    const video = videoRef.current;
    if (!video) return undefined;

    return {
      currentTime: video.currentTime,
      duration: video.duration || 0,
      buffered: video.buffered,
      playbackRate: video.playbackRate,
      volume: video.volume,
      muted: video.muted,
      paused: video.paused,
      ended: video.ended,
      seeking: video.seeking,
      readyState: video.readyState,
      networkState: video.networkState,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight
    };
  }, [videoRef]);

  // Track a custom event
  const trackEvent = useCallback((eventType: string, data?: any) => {
    if (!sessionIdRef.current) return;

    const event: PlayerEvent = {
      type: eventType as any,
      timestamp: Date.now(),
      sessionId: sessionIdRef.current,
      contentId: options.contentId,
      userId: options.userId,
      data
    };

    beaconService.trackEvent(sessionIdRef.current, event, getPlayerState());
  }, [options.contentId, options.userId, getPlayerState]);

  // Track business events
  const trackBusinessEvent = useCallback((eventType: string, data?: any) => {
    beaconService.trackBusinessEvent({
      eventType: eventType as any,
      userId: options.userId,
      ...data
    });
  }, [options.userId]);

  // Get session metrics
  const getSessionMetrics = useCallback(() => {
    if (!sessionIdRef.current) return null;
    return beaconService.getSessionMetrics(sessionIdRef.current);
  }, []);

  // Finalize session manually
  const finalizeSession = useCallback(() => {
    if (sessionIdRef.current) {
      beaconService.finalizeSession(sessionIdRef.current, getPlayerState());
      sessionIdRef.current = null;
    }
  }, [getPlayerState]);

  // Auto-track video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !options.autoTrack || isTrackingRef.current) return;

    isTrackingRef.current = true;

    // Event handlers
    const handleLoadStart = () => trackEvent('loadstart');
    const handleLoadedData = () => trackEvent('loadeddata');
    const handleCanPlay = () => trackEvent('canplay');
    const handlePlay = () => trackEvent('play');
    const handlePause = () => trackEvent('pause');
    const handleSeeking = () => trackEvent('seeking');
    const handleSeeked = () => trackEvent('seeked');
    const handleWaiting = () => trackEvent('waiting');
    const handlePlaying = () => trackEvent('playing');
    const handleEnded = () => trackEvent('ended');
    const handleError = (e: Event) => {
      const error = (e.target as HTMLVideoElement).error;
      trackEvent('error', {
        code: error?.code,
        message: error?.message
      });
    };
    const handleStalled = () => trackEvent('stalled');
    const handleProgress = () => trackEvent('progress');

    // Time update handler (throttled)
    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastTimeUpdateRef.current > 1000) { // Throttle to 1 second
        trackEvent('timeupdate');
        lastTimeUpdateRef.current = now;
      }
    };

    // Quality change handler (for adaptive streaming)
    const handleQualityChange = (e: Event) => {
      const video = e.target as HTMLVideoElement;
      const quality = getVideoQuality(video);
      trackEvent('qualitychange', { quality });
    };

    // Fullscreen change handler
    const handleFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement === video;
      trackEvent('fullscreenchange', { isFullscreen });
    };

    // Add event listeners
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('progress', handleProgress);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // HLS.js quality change events (if using HLS.js)
    if ((window as any).Hls && (video as any).hls) {
      const hls = (video as any).hls;
      hls.on((window as any).Hls.Events.LEVEL_SWITCHED, (event: any, data: any) => {
        const quality = getHLSQuality(data.level, hls.levels);
        trackEvent('qualitychange', { quality, bitrate: hls.levels[data.level]?.bitrate });
      });
    }

    // Dash.js quality change events (if using Dash.js)
    if ((video as any).dashPlayer) {
      const dashPlayer = (video as any).dashPlayer;
      dashPlayer.on('qualityChangeRendered', (e: any) => {
        trackEvent('qualitychange', { 
          quality: `${e.newQuality.height}p`,
          bitrate: e.newQuality.bitrate 
        });
      });
    }

    // Cleanup function
    return () => {
      isTrackingRef.current = false;
      
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('progress', handleProgress);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [videoRef, options.autoTrack, trackEvent]);

  return {
    sessionId: sessionIdRef.current,
    trackEvent,
    trackBusinessEvent,
    getSessionMetrics,
    finalizeSession
  };
}

// Helper functions
function getVideoQuality(video: HTMLVideoElement): string {
  const height = video.videoHeight;
  
  if (height >= 2160) return '4K';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  if (height >= 240) return '240p';
  
  return 'auto';
}

function getHLSQuality(levelIndex: number, levels: any[]): string {
  if (!levels || !levels[levelIndex]) return 'auto';
  
  const level = levels[levelIndex];
  const height = level.height;
  
  if (height >= 2160) return '4K';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  if (height >= 240) return '240p';
  
  return `${height}p`;
}

// Example usage hook for business events
export function useBusinessEventTracking() {
  const beaconService = PlayerBeaconService.getInstance();

  const trackCheckoutStarted = useCallback((amount: number, currency: string, userId?: string) => {
    beaconService.trackBusinessEvent({
      eventType: 'checkout_started',
      userId,
      amount,
      currency,
      metadata: { timestamp: Date.now() }
    });
  }, []);

  const trackCheckoutCompleted = useCallback((
    amount: number, 
    currency: string, 
    processingTime: number,
    userId?: string
  ) => {
    beaconService.trackBusinessEvent({
      eventType: 'checkout_completed',
      userId,
      amount,
      currency,
      processingTime,
      metadata: { timestamp: Date.now() }
    });
  }, []);

  const trackCheckoutFailed = useCallback((
    amount: number, 
    currency: string, 
    errorCode: string,
    userId?: string
  ) => {
    beaconService.trackBusinessEvent({
      eventType: 'checkout_failed',
      userId,
      amount,
      currency,
      metadata: { errorCode, timestamp: Date.now() }
    });
  }, []);

  const trackPayoutInitiated = useCallback((
    amount: number, 
    currency: string,
    userId?: string
  ) => {
    beaconService.trackBusinessEvent({
      eventType: 'payout_initiated',
      userId,
      amount,
      currency,
      metadata: { timestamp: Date.now() }
    });
  }, []);

  const trackPayoutCompleted = useCallback((
    amount: number, 
    currency: string, 
    processingTime: number,
    userId?: string
  ) => {
    beaconService.trackBusinessEvent({
      eventType: 'payout_completed',
      userId,
      amount,
      currency,
      processingTime,
      metadata: { timestamp: Date.now() }
    });
  }, []);

  return {
    trackCheckoutStarted,
    trackCheckoutCompleted,
    trackCheckoutFailed,
    trackPayoutInitiated,
    trackPayoutCompleted
  };
}