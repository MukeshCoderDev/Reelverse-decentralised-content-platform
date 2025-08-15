/**
 * React Hook for Playback Metrics Collection
 * Provides easy integration with video players for metrics tracking
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { MetricsCollectionService, PlaybackMetrics } from '../../services/metricsCollectionService';

interface UsePlaybackMetricsOptions {
  contentId: string;
  userId?: string;
  autoStart?: boolean;
  enableRealTimeTracking?: boolean;
}

interface PlaybackMetricsHook {
  sessionId: string | null;
  startSession: () => string;
  endSession: () => void;
  trackEvent: (event: Omit<PlaybackMetrics, 'sessionId' | 'timestamp' | 'contentId' | 'userId'>) => void;
  trackJoinTime: (joinTime: number) => void;
  trackRebuffer: (duration: number) => void;
  trackError: (errorCode: string, errorMessage: string) => void;
  trackQualityChange: (quality: string) => void;
  trackSeek: (fromTime: number, toTime: number) => void;
  trackVideoInfo: (duration: number, currentTime: number, buffered: number, playbackRate: number) => void;
}

export const usePlaybackMetrics = (options: UsePlaybackMetricsOptions): PlaybackMetricsHook => {
  const metricsService = MetricsCollectionService.getInstance();
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastHeartbeatRef = useRef<number>(Date.now());

  const startSession = useCallback((): string => {
    if (sessionIdRef.current) {
      // End existing session first
      endSession();
    }

    const sessionId = metricsService.startSession(options.contentId, options.userId);
    sessionIdRef.current = sessionId;
    startTimeRef.current = Date.now();
    lastHeartbeatRef.current = Date.now();

    console.log(`Started playback session: ${sessionId} for content: ${options.contentId}`);
    return sessionId;
  }, [options.contentId, options.userId]);

  const endSession = useCallback((): void => {
    if (sessionIdRef.current) {
      metricsService.endSession(sessionIdRef.current);
      console.log(`Ended playback session: ${sessionIdRef.current}`);
      sessionIdRef.current = null;
      startTimeRef.current = null;
    }
  }, []);

  const trackEvent = useCallback((event: Omit<PlaybackMetrics, 'sessionId' | 'timestamp' | 'contentId' | 'userId'>): void => {
    if (!sessionIdRef.current) {
      console.warn('Cannot track event: No active session');
      return;
    }

    metricsService.collectPlaybackMetrics(sessionIdRef.current, {
      ...event,
      sessionId: sessionIdRef.current,
      contentId: options.contentId,
      userId: options.userId,
      timestamp: new Date()
    });

    lastHeartbeatRef.current = Date.now();
  }, [options.contentId, options.userId]);

  const trackJoinTime = useCallback((joinTime: number): void => {
    trackEvent({
      event: 'start',
      joinTime,
      playerVersion: '1.0.0',
      browserInfo: {
        userAgent: navigator.userAgent,
        connection: (navigator as any).connection?.effectiveType || 'unknown'
      }
    });
  }, [trackEvent]);

  const trackRebuffer = useCallback((duration: number): void => {
    trackEvent({
      event: 'rebuffer',
      rebufferDuration: duration
    });
  }, [trackEvent]);

  const trackError = useCallback((errorCode: string, errorMessage: string): void => {
    trackEvent({
      event: 'error',
      errorCode,
      errorMessage
    });
  }, [trackEvent]);

  const trackQualityChange = useCallback((quality: string): void => {
    trackEvent({
      event: 'quality_change',
      quality
    });
  }, [trackEvent]);

  const trackSeek = useCallback((fromTime: number, toTime: number): void => {
    trackEvent({
      event: 'seek',
      videoInfo: {
        duration: 0, // Will be updated by trackVideoInfo
        currentTime: toTime,
        buffered: 0,
        playbackRate: 1
      }
    });
  }, [trackEvent]);

  const trackVideoInfo = useCallback((duration: number, currentTime: number, buffered: number, playbackRate: number): void => {
    // Only send heartbeat every 10 seconds to avoid spam
    const now = Date.now();
    if (now - lastHeartbeatRef.current < 10000) {
      return;
    }

    trackEvent({
      event: 'start', // Use start event for heartbeat
      videoInfo: {
        duration,
        currentTime,
        buffered,
        playbackRate
      }
    });
  }, [trackEvent]);

  // Auto-start session if enabled
  useEffect(() => {
    if (options.autoStart) {
      startSession();
    }

    // Cleanup on unmount
    return () => {
      endSession();
    };
  }, [options.autoStart, startSession, endSession]);

  // Real-time tracking heartbeat
  useEffect(() => {
    if (!options.enableRealTimeTracking) {
      return;
    }

    const interval = setInterval(() => {
      if (sessionIdRef.current) {
        // Send periodic heartbeat to keep session alive
        const now = Date.now();
        if (now - lastHeartbeatRef.current > 30000) { // 30 seconds without activity
          console.log('Sending heartbeat for session:', sessionIdRef.current);
          trackEvent({
            event: 'start' // Use start event as heartbeat
          });
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [options.enableRealTimeTracking, trackEvent]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (sessionIdRef.current) {
        if (document.hidden) {
          trackEvent({ event: 'pause' });
        } else {
          trackEvent({ event: 'resume' });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [trackEvent]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      endSession();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [endSession]);

  return {
    sessionId: sessionIdRef.current,
    startSession,
    endSession,
    trackEvent,
    trackJoinTime,
    trackRebuffer,
    trackError,
    trackQualityChange,
    trackSeek,
    trackVideoInfo
  };
};

/**
 * Higher-order component for automatic metrics tracking
 */
export const withPlaybackMetrics = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  metricsOptions: UsePlaybackMetricsOptions
) => {
  return (props: P & { playbackMetrics?: PlaybackMetricsHook }) => {
    const metrics = usePlaybackMetrics(metricsOptions);
    
    return React.createElement(WrappedComponent, {
      ...props,
      playbackMetrics: metrics
    });
  };
};

/**
 * Hook for business metrics tracking
 */
export const useBusinessMetrics = () => {
  const metricsService = MetricsCollectionService.getInstance();

  const trackPayoutInitiated = useCallback((userId: string, amount: number, currency: string) => {
    metricsService.collectBusinessMetrics({
      eventType: 'payout_initiated',
      timestamp: new Date(),
      userId,
      amount,
      currency,
      metadata: { initiatedAt: new Date().toISOString() }
    });
  }, []);

  const trackPayoutCompleted = useCallback((userId: string, amount: number, currency: string, processingTime: number) => {
    metricsService.collectBusinessMetrics({
      eventType: 'payout_completed',
      timestamp: new Date(),
      userId,
      amount,
      currency,
      processingTime,
      metadata: { completedAt: new Date().toISOString() }
    });
  }, []);

  const trackCheckoutStarted = useCallback((userId: string, amount: number, currency: string) => {
    metricsService.collectBusinessMetrics({
      eventType: 'checkout_started',
      timestamp: new Date(),
      userId,
      amount,
      currency,
      metadata: { startedAt: new Date().toISOString() }
    });
  }, []);

  const trackCheckoutCompleted = useCallback((userId: string, amount: number, currency: string, processingTime: number) => {
    metricsService.collectBusinessMetrics({
      eventType: 'checkout_completed',
      timestamp: new Date(),
      userId,
      amount,
      currency,
      processingTime,
      metadata: { completedAt: new Date().toISOString() }
    });
  }, []);

  const trackCheckoutFailed = useCallback((userId: string, amount: number, currency: string, errorReason: string) => {
    metricsService.collectBusinessMetrics({
      eventType: 'checkout_failed',
      timestamp: new Date(),
      userId,
      amount,
      currency,
      metadata: { 
        failedAt: new Date().toISOString(),
        errorReason 
      }
    });
  }, []);

  return {
    trackPayoutInitiated,
    trackPayoutCompleted,
    trackCheckoutStarted,
    trackCheckoutCompleted,
    trackCheckoutFailed
  };
};