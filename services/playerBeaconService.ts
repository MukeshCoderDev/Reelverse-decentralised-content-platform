/**
 * Player Beacon Service
 * Handles video player event tracking and real-time metrics aggregation
 */

import { MetricsCollectionService, PlaybackMetrics, BusinessEvent } from './metricsCollectionService';

export interface PlayerEvent {
  type: 'loadstart' | 'loadeddata' | 'canplay' | 'play' | 'pause' | 'seeking' | 'seeked' | 
        'waiting' | 'playing' | 'timeupdate' | 'ended' | 'error' | 'stalled' | 'progress' |
        'qualitychange' | 'bitratechange' | 'fullscreenchange';
  timestamp: number;
  sessionId: string;
  contentId: string;
  userId?: string;
  data?: any;
}

export interface VideoPlayerState {
  currentTime: number;
  duration: number;
  buffered: TimeRanges;
  playbackRate: number;
  volume: number;
  muted: boolean;
  paused: boolean;
  ended: boolean;
  seeking: boolean;
  readyState: number;
  networkState: number;
  videoWidth: number;
  videoHeight: number;
  quality?: string;
  bitrate?: number;
}

export interface BeaconConfig {
  batchSize: number;
  flushInterval: number;
  enableRealTimeAlerts: boolean;
  sampleRate: number;
  debugMode: boolean;
}

export class PlayerBeaconService {
  private static instance: PlayerBeaconService;
  private metricsService: MetricsCollectionService;
  private activeSessions: Map<string, {
    startTime: number;
    lastHeartbeat: number;
    joinTime?: number;
    rebufferCount: number;
    rebufferDuration: number;
    qualityChanges: number;
    errorCount: number;
    seekCount: number;
    pauseCount: number;
    totalPauseDuration: number;
    lastPauseTime?: number;
    contentId: string;
    userId?: string;
  }> = new Map();
  
  private eventQueue: PlayerEvent[] = [];
  private config: BeaconConfig;
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.metricsService = MetricsCollectionService.getInstance();
    this.config = {
      batchSize: 50,
      flushInterval: 5000, // 5 seconds
      enableRealTimeAlerts: true,
      sampleRate: 1.0, // 100% sampling
      debugMode: false
    };
    
    this.startPeriodicFlush();
  }

  public static getInstance(): PlayerBeaconService {
    if (!PlayerBeaconService.instance) {
      PlayerBeaconService.instance = new PlayerBeaconService();
    }
    return PlayerBeaconService.instance;
  }

  /**
   * Initialize a new playback session
   */
  initializeSession(contentId: string, userId?: string): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    this.activeSessions.set(sessionId, {
      startTime: now,
      lastHeartbeat: now,
      rebufferCount: 0,
      rebufferDuration: 0,
      qualityChanges: 0,
      errorCount: 0,
      seekCount: 0,
      pauseCount: 0,
      totalPauseDuration: 0,
      contentId,
      userId
    });

    if (this.config.debugMode) {
      console.log(`[PlayerBeacon] Session initialized: ${sessionId}`);
    }

    return sessionId;
  }

  /**
   * Track video player events
   */
  trackEvent(sessionId: string, event: PlayerEvent, playerState?: VideoPlayerState): void {
    if (!this.shouldSample()) {
      return;
    }

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`[PlayerBeacon] Session not found: ${sessionId}`);
      return;
    }

    const now = Date.now();
    session.lastHeartbeat = now;

    // Process specific events
    this.processEvent(sessionId, event, playerState);

    // Add to event queue
    this.eventQueue.push({
      ...event,
      timestamp: now,
      sessionId
    });

    // Flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flushEvents();
    }

    if (this.config.debugMode) {
      console.log(`[PlayerBeacon] Event tracked: ${event.type} for session ${sessionId}`);
    }
  }

  /**
   * Process specific player events and update session metrics
   */
  private processEvent(sessionId: string, event: PlayerEvent, playerState?: VideoPlayerState): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const now = Date.now();

    switch (event.type) {
      case 'loadstart':
        // Reset session metrics for new content load
        session.joinTime = undefined;
        session.rebufferCount = 0;
        session.rebufferDuration = 0;
        session.qualityChanges = 0;
        session.errorCount = 0;
        break;

      case 'canplay':
        // Calculate join time (time to first frame)
        if (!session.joinTime) {
          session.joinTime = now - session.startTime;
          
          // Send join time metric
          this.metricsService.collectPlaybackMetrics(sessionId, {
            sessionId,
            contentId: session.contentId,
            userId: session.userId,
            timestamp: new Date(),
            event: 'start',
            joinTime: session.joinTime,
            playerVersion: this.getPlayerVersion(),
            browserInfo: this.getBrowserInfo(),
            videoInfo: playerState ? {
              duration: playerState.duration,
              currentTime: playerState.currentTime,
              buffered: playerState.buffered.length,
              playbackRate: playerState.playbackRate
            } : undefined
          });

          // Real-time alert for high join time
          if (this.config.enableRealTimeAlerts && session.joinTime > 3000) {
            this.sendRealTimeAlert('high_join_time', sessionId, {
              joinTime: session.joinTime,
              contentId: session.contentId
            });
          }
        }
        break;

      case 'waiting':
        // Start of rebuffer event
        session.rebufferCount++;
        (session as any).rebufferStartTime = now;
        break;

      case 'playing':
        // End of rebuffer event
        if ((session as any).rebufferStartTime) {
          const rebufferDuration = now - (session as any).rebufferStartTime;
          session.rebufferDuration += rebufferDuration;
          delete (session as any).rebufferStartTime;

          // Send rebuffer metric
          this.metricsService.collectPlaybackMetrics(sessionId, {
            sessionId,
            contentId: session.contentId,
            userId: session.userId,
            timestamp: new Date(),
            event: 'rebuffer',
            rebufferDuration,
            videoInfo: playerState ? {
              duration: playerState.duration,
              currentTime: playerState.currentTime,
              buffered: playerState.buffered.length,
              playbackRate: playerState.playbackRate
            } : undefined
          });
        }
        break;

      case 'pause':
        session.pauseCount++;
        session.lastPauseTime = now;
        
        this.metricsService.collectPlaybackMetrics(sessionId, {
          sessionId,
          contentId: session.contentId,
          userId: session.userId,
          timestamp: new Date(),
          event: 'pause',
          videoInfo: playerState ? {
            duration: playerState.duration,
            currentTime: playerState.currentTime,
            buffered: playerState.buffered.length,
            playbackRate: playerState.playbackRate
          } : undefined
        });
        break;

      case 'play':
        if (session.lastPauseTime) {
          session.totalPauseDuration += now - session.lastPauseTime;
          session.lastPauseTime = undefined;
        }

        this.metricsService.collectPlaybackMetrics(sessionId, {
          sessionId,
          contentId: session.contentId,
          userId: session.userId,
          timestamp: new Date(),
          event: 'resume',
          videoInfo: playerState ? {
            duration: playerState.duration,
            currentTime: playerState.currentTime,
            buffered: playerState.buffered.length,
            playbackRate: playerState.playbackRate
          } : undefined
        });
        break;

      case 'seeking':
        session.seekCount++;
        break;

      case 'qualitychange':
        session.qualityChanges++;
        
        this.metricsService.collectPlaybackMetrics(sessionId, {
          sessionId,
          contentId: session.contentId,
          userId: session.userId,
          timestamp: new Date(),
          event: 'quality_change',
          quality: event.data?.quality || playerState?.quality,
          videoInfo: playerState ? {
            duration: playerState.duration,
            currentTime: playerState.currentTime,
            buffered: playerState.buffered.length,
            playbackRate: playerState.playbackRate
          } : undefined
        });
        break;

      case 'error':
        session.errorCount++;
        
        this.metricsService.collectPlaybackMetrics(sessionId, {
          sessionId,
          contentId: session.contentId,
          userId: session.userId,
          timestamp: new Date(),
          event: 'error',
          errorCode: event.data?.code?.toString(),
          errorMessage: event.data?.message,
          videoInfo: playerState ? {
            duration: playerState.duration,
            currentTime: playerState.currentTime,
            buffered: playerState.buffered.length,
            playbackRate: playerState.playbackRate
          } : undefined
        });

        // Real-time alert for errors
        if (this.config.enableRealTimeAlerts) {
          this.sendRealTimeAlert('playback_error', sessionId, {
            errorCode: event.data?.code,
            errorMessage: event.data?.message,
            contentId: session.contentId
          });
        }
        break;

      case 'ended':
        this.finalizeSession(sessionId, playerState);
        break;
    }
  }

  /**
   * Finalize a playback session
   */
  finalizeSession(sessionId: string, playerState?: VideoPlayerState): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const now = Date.now();
    const sessionDuration = now - session.startTime;

    // Send final session metrics
    this.metricsService.collectPlaybackMetrics(sessionId, {
      sessionId,
      contentId: session.contentId,
      userId: session.userId,
      timestamp: new Date(),
      event: 'end',
      videoInfo: playerState ? {
        duration: playerState.duration,
        currentTime: playerState.currentTime,
        buffered: playerState.buffered.length,
        playbackRate: playerState.playbackRate
      } : {
        duration: sessionDuration / 1000,
        currentTime: 0,
        buffered: 0,
        playbackRate: 1
      }
    });

    // Calculate session quality metrics
    const qualityScore = this.calculateSessionQuality(session, sessionDuration);
    
    if (this.config.debugMode) {
      console.log(`[PlayerBeacon] Session finalized: ${sessionId}`, {
        duration: sessionDuration,
        joinTime: session.joinTime,
        rebufferCount: session.rebufferCount,
        rebufferDuration: session.rebufferDuration,
        qualityScore
      });
    }

    // Clean up session
    this.activeSessions.delete(sessionId);
  }

  /**
   * Track business events (payments, checkouts, etc.)
   */
  trackBusinessEvent(event: Omit<BusinessEvent, 'timestamp'>): void {
    this.metricsService.collectBusinessMetrics({
      ...event,
      timestamp: new Date()
    });

    if (this.config.debugMode) {
      console.log(`[PlayerBeacon] Business event tracked: ${event.eventType}`);
    }
  }

  /**
   * Get current session metrics
   */
  getSessionMetrics(sessionId: string): any {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const now = Date.now();
    const sessionDuration = now - session.startTime;

    return {
      sessionId,
      contentId: session.contentId,
      userId: session.userId,
      duration: sessionDuration,
      joinTime: session.joinTime,
      rebufferCount: session.rebufferCount,
      rebufferDuration: session.rebufferDuration,
      rebufferRatio: sessionDuration > 0 ? (session.rebufferDuration / sessionDuration) * 100 : 0,
      qualityChanges: session.qualityChanges,
      errorCount: session.errorCount,
      seekCount: session.seekCount,
      pauseCount: session.pauseCount,
      totalPauseDuration: session.totalPauseDuration,
      qualityScore: this.calculateSessionQuality(session, sessionDuration)
    };
  }

  /**
   * Get aggregated metrics for all active sessions
   */
  getAggregatedMetrics(): any {
    const sessions = Array.from(this.activeSessions.values());
    const now = Date.now();

    if (sessions.length === 0) {
      return {
        activeSessions: 0,
        averageJoinTime: 0,
        averageRebufferRatio: 0,
        totalErrors: 0,
        averageQualityScore: 100
      };
    }

    const joinTimes = sessions.filter(s => s.joinTime).map(s => s.joinTime!);
    const rebufferRatios = sessions.map(s => {
      const duration = now - s.startTime;
      return duration > 0 ? (s.rebufferDuration / duration) * 100 : 0;
    });

    return {
      activeSessions: sessions.length,
      averageJoinTime: joinTimes.length > 0 ? joinTimes.reduce((a, b) => a + b, 0) / joinTimes.length : 0,
      averageRebufferRatio: rebufferRatios.reduce((a, b) => a + b, 0) / rebufferRatios.length,
      totalErrors: sessions.reduce((sum, s) => sum + s.errorCount, 0),
      averageQualityScore: sessions.map(s => this.calculateSessionQuality(s, now - s.startTime))
        .reduce((a, b) => a + b, 0) / sessions.length
    };
  }

  /**
   * Configure beacon settings
   */
  configure(config: Partial<BeaconConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.flushInterval) {
      this.restartPeriodicFlush();
    }
  }

  /**
   * Private helper methods
   */
  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private calculateSessionQuality(session: any, duration: number): number {
    let score = 100;

    // Penalize for high join time
    if (session.joinTime) {
      if (session.joinTime > 5000) score -= 30;
      else if (session.joinTime > 3000) score -= 20;
      else if (session.joinTime > 2000) score -= 10;
    }

    // Penalize for rebuffering
    const rebufferRatio = duration > 0 ? (session.rebufferDuration / duration) * 100 : 0;
    if (rebufferRatio > 5) score -= 40;
    else if (rebufferRatio > 2) score -= 25;
    else if (rebufferRatio > 1) score -= 15;

    // Penalize for errors
    score -= session.errorCount * 10;

    // Penalize for excessive quality changes
    if (session.qualityChanges > 10) score -= 20;
    else if (session.qualityChanges > 5) score -= 10;

    return Math.max(0, score);
  }

  private getPlayerVersion(): string {
    return '1.0.0'; // Would be injected from build process
  }

  private getBrowserInfo(): { userAgent: string; connection?: string } {
    return {
      userAgent: navigator.userAgent,
      connection: (navigator as any).connection?.effectiveType || 'unknown'
    };
  }

  private sendRealTimeAlert(type: string, sessionId: string, data: any): void {
    console.warn(`[PlayerBeacon] Real-time alert: ${type}`, {
      sessionId,
      ...data,
      timestamp: new Date().toISOString()
    });

    // In production, this would send to monitoring system
    // e.g., DataDog, New Relic, custom webhook, etc.
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushEvents();
      this.cleanupInactiveSessions();
    }, this.config.flushInterval);
  }

  private restartPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.startPeriodicFlush();
  }

  private flushEvents(): void {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    if (this.config.debugMode) {
      console.log(`[PlayerBeacon] Flushing ${events.length} events`);
    }

    // In production, send events to analytics backend
    // For now, just log them
    events.forEach(event => {
      if (this.config.debugMode) {
        console.log(`[PlayerBeacon] Event: ${event.type}`, event);
      }
    });
  }

  private cleanupInactiveSessions(): void {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [sessionId, session] of this.activeSessions) {
      if (now - session.lastHeartbeat > inactiveThreshold) {
        if (this.config.debugMode) {
          console.log(`[PlayerBeacon] Cleaning up inactive session: ${sessionId}`);
        }
        this.finalizeSession(sessionId);
      }
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // Finalize all active sessions
    for (const sessionId of this.activeSessions.keys()) {
      this.finalizeSession(sessionId);
    }
    
    // Final flush
    this.flushEvents();
  }
}