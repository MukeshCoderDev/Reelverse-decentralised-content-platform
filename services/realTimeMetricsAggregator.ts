/**
 * Real-Time Metrics Aggregation Pipeline
 * Processes player beacon data and calculates SLO metrics in real-time
 */

import { EventEmitter } from 'events';
import { MetricsCollectionService, SLOMetrics } from './metricsCollectionService';
import { MetricsCache } from './metricsCache';
import { WebhookAlertService, SLOBreachAlert } from './webhookAlertService';

export interface MetricsWindow {
  windowStart: Date;
  windowEnd: Date;
  sampleCount: number;
  joinTimes: number[];
  rebufferEvents: Array<{ duration: number; timestamp: Date }>;
  errorEvents: Array<{ code?: string; message?: string; timestamp: Date }>;
  qualityChanges: Array<{ from?: string; to: string; timestamp: Date }>;
  activeSessions: Set<string>;
  completedSessions: number;
  totalPlaybackTime: number;
  totalRebufferTime: number;
}

export interface BusinessMetricsWindow {
  windowStart: Date;
  windowEnd: Date;
  checkoutEvents: Array<{
    type: 'started' | 'completed' | 'failed';
    amount: number;
    currency: string;
    processingTime?: number;
    timestamp: Date;
  }>;
  payoutEvents: Array<{
    type: 'initiated' | 'completed';
    amount: number;
    currency: string;
    processingTime?: number;
    timestamp: Date;
  }>;
}

export interface AggregatedSLOs extends SLOMetrics {
  timestamp: Date;
  windowDuration: number;
  sampleSize: number;
  confidence: number;
}

export interface AlertThreshold {
  metric: keyof SLOMetrics;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  value: number;
  severity: 'warning' | 'critical';
  description: string;
}

export class RealTimeMetricsAggregator extends EventEmitter {
  private static instance: RealTimeMetricsAggregator;
  private metricsService: MetricsCollectionService;
  private cache: MetricsCache;
  private webhookService: WebhookAlertService;
  
  // Sliding windows for different time periods
  private currentWindow: MetricsWindow;
  private businessWindow: BusinessMetricsWindow;
  private historicalWindows: MetricsWindow[] = [];
  private businessHistoricalWindows: BusinessMetricsWindow[] = [];
  
  // Configuration
  private windowDuration = 60000; // 1 minute windows
  private maxHistoricalWindows = 60; // Keep 1 hour of history
  private aggregationInterval = 5000; // Aggregate every 5 seconds
  private alertThresholds: AlertThreshold[] = [];
  
  // Timers
  private aggregationTimer?: NodeJS.Timeout;
  private windowRotationTimer?: NodeJS.Timeout;
  
  // Cache for computed metrics
  private lastSLOs?: AggregatedSLOs;
  private sloHistory: AggregatedSLOs[] = [];

  private constructor() {
    super();
    this.metricsService = MetricsCollectionService.getInstance();
    this.cache = MetricsCache.getInstance();
    this.webhookService = WebhookAlertService.getInstance();
    this.initializeWindows();
    this.setupDefaultThresholds();
    this.startAggregation();
  }

  public static getInstance(): RealTimeMetricsAggregator {
    if (!RealTimeMetricsAggregator.instance) {
      RealTimeMetricsAggregator.instance = new RealTimeMetricsAggregator();
    }
    return RealTimeMetricsAggregator.instance;
  }

  /**
   * Initialize sliding windows
   */
  private initializeWindows(): void {
    const now = new Date();
    
    this.currentWindow = {
      windowStart: now,
      windowEnd: new Date(now.getTime() + this.windowDuration),
      sampleCount: 0,
      joinTimes: [],
      rebufferEvents: [],
      errorEvents: [],
      qualityChanges: [],
      activeSessions: new Set(),
      completedSessions: 0,
      totalPlaybackTime: 0,
      totalRebufferTime: 0
    };

    this.businessWindow = {
      windowStart: now,
      windowEnd: new Date(now.getTime() + this.windowDuration),
      checkoutEvents: [],
      payoutEvents: []
    };
  }

  /**
   * Setup default SLO alert thresholds
   */
  private setupDefaultThresholds(): void {
    this.alertThresholds = [
      {
        metric: 'playbackP95JoinTime',
        operator: 'gt',
        value: 3000, // 3 seconds
        severity: 'warning',
        description: 'P95 join time exceeds 3 seconds'
      },
      {
        metric: 'playbackP95JoinTime',
        operator: 'gt',
        value: 5000, // 5 seconds
        severity: 'critical',
        description: 'P95 join time exceeds 5 seconds'
      },
      {
        metric: 'rebufferRatio',
        operator: 'gt',
        value: 2.0, // 2%
        severity: 'warning',
        description: 'Rebuffer ratio exceeds 2%'
      },
      {
        metric: 'rebufferRatio',
        operator: 'gt',
        value: 5.0, // 5%
        severity: 'critical',
        description: 'Rebuffer ratio exceeds 5%'
      },
      {
        metric: 'checkoutSuccessRate',
        operator: 'lt',
        value: 95.0, // 95%
        severity: 'warning',
        description: 'Checkout success rate below 95%'
      },
      {
        metric: 'checkoutSuccessRate',
        operator: 'lt',
        value: 90.0, // 90%
        severity: 'critical',
        description: 'Checkout success rate below 90%'
      },
      {
        metric: 'payoutP95Latency',
        operator: 'gt',
        value: 48, // 48 hours
        severity: 'warning',
        description: 'P95 payout latency exceeds 48 hours'
      },
      {
        metric: 'payoutP95Latency',
        operator: 'gt',
        value: 72, // 72 hours
        severity: 'critical',
        description: 'P95 payout latency exceeds 72 hours'
      },
      {
        metric: 'errorRate',
        operator: 'gt',
        value: 1.0, // 1%
        severity: 'warning',
        description: 'Error rate exceeds 1%'
      },
      {
        metric: 'errorRate',
        operator: 'gt',
        value: 5.0, // 5%
        severity: 'critical',
        description: 'Error rate exceeds 5%'
      }
    ];
  }

  /**
   * Start the aggregation process
   */
  private startAggregation(): void {
    // Aggregate metrics every 5 seconds
    this.aggregationTimer = setInterval(() => {
      this.aggregateCurrentWindow();
    }, this.aggregationInterval);

    // Rotate windows every minute
    this.windowRotationTimer = setInterval(() => {
      this.rotateWindows();
    }, this.windowDuration);
  }

  /**
   * Process incoming playback metrics
   */
  processPlaybackMetrics(sessionId: string, event: string, data: any): void {
    const now = new Date();
    
    // Ensure we're in the current window
    if (now > this.currentWindow.windowEnd) {
      this.rotateWindows();
    }

    this.currentWindow.activeSessions.add(sessionId);
    this.currentWindow.sampleCount++;

    switch (event) {
      case 'start':
        if (data.joinTime) {
          this.currentWindow.joinTimes.push(data.joinTime);
        }
        break;

      case 'rebuffer':
        if (data.rebufferDuration) {
          this.currentWindow.rebufferEvents.push({
            duration: data.rebufferDuration,
            timestamp: now
          });
          this.currentWindow.totalRebufferTime += data.rebufferDuration;
        }
        break;

      case 'error':
        this.currentWindow.errorEvents.push({
          code: data.errorCode,
          message: data.errorMessage,
          timestamp: now
        });
        break;

      case 'quality_change':
        this.currentWindow.qualityChanges.push({
          from: data.fromQuality,
          to: data.quality,
          timestamp: now
        });
        break;

      case 'end':
        this.currentWindow.completedSessions++;
        if (data.sessionDuration) {
          this.currentWindow.totalPlaybackTime += data.sessionDuration;
        }
        break;
    }
  }

  /**
   * Process incoming business metrics
   */
  processBusinessMetrics(eventType: string, data: any): void {
    const now = new Date();
    
    // Ensure we're in the current window
    if (now > this.businessWindow.windowEnd) {
      this.rotateWindows();
    }

    if (eventType.startsWith('checkout_')) {
      this.businessWindow.checkoutEvents.push({
        type: eventType.replace('checkout_', '') as 'started' | 'completed' | 'failed',
        amount: data.amount || 0,
        currency: data.currency || 'USD',
        processingTime: data.processingTime,
        timestamp: now
      });
    } else if (eventType.startsWith('payout_')) {
      this.businessWindow.payoutEvents.push({
        type: eventType.replace('payout_', '') as 'initiated' | 'completed',
        amount: data.amount || 0,
        currency: data.currency || 'USD',
        processingTime: data.processingTime,
        timestamp: now
      });
    }
  }

  /**
   * Aggregate metrics for the current window
   */
  private async aggregateCurrentWindow(): Promise<void> {
    const slos = this.calculateSLOs();
    
    // Check alert thresholds
    this.checkAlertThresholds(slos);
    
    // Cache the results
    this.lastSLOs = slos;
    this.sloHistory.push(slos);
    
    // Keep only recent history
    if (this.sloHistory.length > this.maxHistoricalWindows) {
      this.sloHistory = this.sloHistory.slice(-this.maxHistoricalWindows);
    }
    
    // Cache in Redis for fast access
    await this.cache.cacheSLOMetrics(slos, 300); // 5 minute TTL
    await this.cache.cacheSLOHistory(this.sloHistory, 3600); // 1 hour TTL
    
    // Cache individual time series points
    await this.cache.addTimeSeriesPoint('playback_p95_join_time', slos.timestamp, slos.playbackP95JoinTime);
    await this.cache.addTimeSeriesPoint('rebuffer_ratio', slos.timestamp, slos.rebufferRatio);
    await this.cache.addTimeSeriesPoint('checkout_success_rate', slos.timestamp, slos.checkoutSuccessRate);
    await this.cache.addTimeSeriesPoint('payout_p95_latency', slos.timestamp, slos.payoutP95Latency);
    await this.cache.addTimeSeriesPoint('error_rate', slos.timestamp, slos.errorRate);
    
    // Emit real-time update
    this.emit('sloUpdate', slos);
  }

  /**
   * Calculate current SLO metrics
   */
  private calculateSLOs(): AggregatedSLOs {
    const now = new Date();
    const windowDuration = now.getTime() - this.currentWindow.windowStart.getTime();
    
    // Calculate P95 join time
    const sortedJoinTimes = [...this.currentWindow.joinTimes].sort((a, b) => a - b);
    const playbackP95JoinTime = sortedJoinTimes.length > 0
      ? sortedJoinTimes[Math.floor(sortedJoinTimes.length * 0.95)] || 0
      : 0;

    // Calculate rebuffer ratio
    const rebufferRatio = this.currentWindow.totalPlaybackTime > 0
      ? (this.currentWindow.totalRebufferTime / this.currentWindow.totalPlaybackTime) * 100
      : 0;

    // Calculate error rate
    const errorRate = this.currentWindow.sampleCount > 0
      ? (this.currentWindow.errorEvents.length / this.currentWindow.sampleCount) * 100
      : 0;

    // Calculate checkout success rate
    const checkoutStarted = this.businessWindow.checkoutEvents.filter(e => e.type === 'started').length;
    const checkoutCompleted = this.businessWindow.checkoutEvents.filter(e => e.type === 'completed').length;
    const checkoutSuccessRate = checkoutStarted > 0
      ? (checkoutCompleted / checkoutStarted) * 100
      : 100; // Default to 100% if no checkouts

    // Calculate P95 payout latency
    const completedPayouts = this.businessWindow.payoutEvents.filter(e => e.type === 'completed' && e.processingTime);
    const payoutLatencies = completedPayouts
      .map(e => e.processingTime! / (1000 * 60 * 60)) // Convert to hours
      .sort((a, b) => a - b);
    const payoutP95Latency = payoutLatencies.length > 0
      ? payoutLatencies[Math.floor(payoutLatencies.length * 0.95)] || 0
      : 0;

    // Calculate confidence based on sample size
    const confidence = Math.min(100, (this.currentWindow.sampleCount / 100) * 100);

    return {
      timestamp: now,
      windowDuration,
      sampleSize: this.currentWindow.sampleCount,
      confidence,
      playbackP95JoinTime,
      rebufferRatio,
      payoutP95Latency,
      checkoutSuccessRate,
      uptime: 99.9, // This would come from infrastructure monitoring
      errorRate,
      aiTaggingAccuracy: 96.2, // This would come from AI service
      leakDetectionRate: 88.5 // This would come from leak detection service
    };
  }

  /**
   * Check alert thresholds and emit alerts
   */
  private checkAlertThresholds(slos: AggregatedSLOs): void {
    for (const threshold of this.alertThresholds) {
      const value = slos[threshold.metric];
      let triggered = false;

      switch (threshold.operator) {
        case 'gt':
          triggered = value > threshold.value;
          break;
        case 'lt':
          triggered = value < threshold.value;
          break;
        case 'gte':
          triggered = value >= threshold.value;
          break;
        case 'lte':
          triggered = value <= threshold.value;
          break;
        case 'eq':
          triggered = value === threshold.value;
          break;
      }

      if (triggered) {
        const alert = {
          metric: threshold.metric,
          value,
          threshold: threshold.value,
          severity: threshold.severity,
          description: threshold.description,
          timestamp: slos.timestamp,
          windowDuration: slos.windowDuration,
          sampleSize: slos.sampleSize
        };

        this.emit('alert', alert);

        // Send webhook alert
        const sloAlert: SLOBreachAlert = {
          metric: threshold.metric,
          currentValue: value,
          threshold: threshold.value,
          severity: threshold.severity,
          description: threshold.description,
          timestamp: slos.timestamp,
          windowDuration: slos.windowDuration,
          sampleSize: slos.sampleSize
        };

        this.webhookService.sendSLOBreachAlert(sloAlert).catch(error => {
          console.error('Failed to send SLO breach webhook:', error);
        });
      }
    }
  }

  /**
   * Rotate sliding windows
   */
  private rotateWindows(): void {
    // Move current window to history
    this.historicalWindows.push({ ...this.currentWindow });
    this.businessHistoricalWindows.push({ ...this.businessWindow });

    // Keep only recent history
    if (this.historicalWindows.length > this.maxHistoricalWindows) {
      this.historicalWindows = this.historicalWindows.slice(-this.maxHistoricalWindows);
    }
    if (this.businessHistoricalWindows.length > this.maxHistoricalWindows) {
      this.businessHistoricalWindows = this.businessHistoricalWindows.slice(-this.maxHistoricalWindows);
    }

    // Create new current window
    const now = new Date();
    this.currentWindow = {
      windowStart: now,
      windowEnd: new Date(now.getTime() + this.windowDuration),
      sampleCount: 0,
      joinTimes: [],
      rebufferEvents: [],
      errorEvents: [],
      qualityChanges: [],
      activeSessions: new Set(),
      completedSessions: 0,
      totalPlaybackTime: 0,
      totalRebufferTime: 0
    };

    this.businessWindow = {
      windowStart: now,
      windowEnd: new Date(now.getTime() + this.windowDuration),
      checkoutEvents: [],
      payoutEvents: []
    };

    this.emit('windowRotated', {
      timestamp: now,
      historicalWindowCount: this.historicalWindows.length
    });
  }

  /**
   * Get current SLO metrics
   */
  async getCurrentSLOs(): Promise<AggregatedSLOs | null> {
    // Try cache first
    const cached = await this.cache.getCurrentSLOMetrics();
    if (cached) {
      return cached;
    }
    
    // Fallback to in-memory
    return this.lastSLOs || null;
  }

  /**
   * Get SLO history
   */
  async getSLOHistory(minutes?: number): Promise<AggregatedSLOs[]> {
    // Try cache first
    const cached = await this.cache.getSLOHistory();
    let history = cached || this.sloHistory;
    
    if (!minutes) {
      return [...history];
    }

    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return history.filter(slo => slo.timestamp >= cutoff);
  }

  /**
   * Get aggregated metrics for a time period
   */
  getAggregatedMetrics(startTime: Date, endTime: Date): AggregatedSLOs | null {
    const relevantSLOs = this.sloHistory.filter(
      slo => slo.timestamp >= startTime && slo.timestamp <= endTime
    );

    if (relevantSLOs.length === 0) {
      return null;
    }

    // Calculate weighted averages
    const totalSamples = relevantSLOs.reduce((sum, slo) => sum + slo.sampleSize, 0);
    
    if (totalSamples === 0) {
      return null;
    }

    const weightedSum = (metric: keyof SLOMetrics) => {
      return relevantSLOs.reduce((sum, slo) => {
        return sum + (slo[metric] as number) * slo.sampleSize;
      }, 0) / totalSamples;
    };

    return {
      timestamp: endTime,
      windowDuration: endTime.getTime() - startTime.getTime(),
      sampleSize: totalSamples,
      confidence: Math.min(100, (totalSamples / 1000) * 100),
      playbackP95JoinTime: weightedSum('playbackP95JoinTime'),
      rebufferRatio: weightedSum('rebufferRatio'),
      payoutP95Latency: weightedSum('payoutP95Latency'),
      checkoutSuccessRate: weightedSum('checkoutSuccessRate'),
      uptime: weightedSum('uptime'),
      errorRate: weightedSum('errorRate'),
      aiTaggingAccuracy: weightedSum('aiTaggingAccuracy'),
      leakDetectionRate: weightedSum('leakDetectionRate')
    };
  }

  /**
   * Configure aggregation settings
   */
  configure(options: {
    windowDuration?: number;
    maxHistoricalWindows?: number;
    aggregationInterval?: number;
    alertThresholds?: AlertThreshold[];
  }): void {
    if (options.windowDuration) {
      this.windowDuration = options.windowDuration;
    }
    if (options.maxHistoricalWindows) {
      this.maxHistoricalWindows = options.maxHistoricalWindows;
    }
    if (options.aggregationInterval) {
      this.aggregationInterval = options.aggregationInterval;
      
      // Restart aggregation with new interval
      if (this.aggregationTimer) {
        clearInterval(this.aggregationTimer);
        this.aggregationTimer = setInterval(() => {
          this.aggregateCurrentWindow();
        }, this.aggregationInterval);
      }
    }
    if (options.alertThresholds) {
      this.alertThresholds = options.alertThresholds;
    }
  }

  /**
   * Add custom alert threshold
   */
  addAlertThreshold(threshold: AlertThreshold): void {
    this.alertThresholds.push(threshold);
  }

  /**
   * Remove alert threshold
   */
  removeAlertThreshold(metric: keyof SLOMetrics, value: number): void {
    this.alertThresholds = this.alertThresholds.filter(
      t => !(t.metric === metric && t.value === value)
    );
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = undefined;
    }
    
    if (this.windowRotationTimer) {
      clearInterval(this.windowRotationTimer);
      this.windowRotationTimer = undefined;
    }
    
    this.removeAllListeners();
  }
}