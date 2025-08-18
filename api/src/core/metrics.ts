/**
 * Real-time Metrics Collection with SLA Monitoring
 * Tracks license issuance, edge authorization, upload times, and SLA violations
 */

import { EventEmitter } from 'events';
import { eventBus } from './eventBus';

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface TimerResult {
  duration: number;
  success: boolean;
  error?: string;
}

export interface SLAThreshold {
  name: string;
  p95Threshold: number;
  p99Threshold: number;
  availabilityThreshold: number; // percentage
  enabled: boolean;
}

export interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  windowMs: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, MetricPoint[]> = new Map();
  private timers: Map<string, { start: Date; tags: Record<string, string> }> = new Map();
  private slaThresholds: Map<string, SLAThreshold> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private alertCooldowns: Map<string, Date> = new Map();

  constructor() {
    super();
    this.initializeSLAThresholds();
    this.initializeAlertRules();
    this.startMetricsAggregation();
  }

  /**
   * Initialize SLA thresholds for critical operations
   */
  private initializeSLAThresholds(): void {
    const thresholds: SLAThreshold[] = [
      {
        name: 'license_issuance',
        p95Threshold: 250, // ms
        p99Threshold: 500, // ms
        availabilityThreshold: 99.9, // %
        enabled: true
      },
      {
        name: 'edge_authorization',
        p95Threshold: 50, // ms (cache hit)
        p99Threshold: 80, // ms (cache miss)
        availabilityThreshold: 99.95, // %
        enabled: true
      },
      {
        name: 'upload_processing',
        p95Threshold: 30000, // ms (30 seconds to start transcoding)
        p99Threshold: 60000, // ms
        availabilityThreshold: 99.5, // %
        enabled: true
      },
      {
        name: 'key_rotation',
        p95Threshold: 120000, // ms (2 minutes)
        p99Threshold: 300000, // ms (5 minutes)
        availabilityThreshold: 99.0, // %
        enabled: true
      }
    ];

    for (const threshold of thresholds) {
      this.slaThresholds.set(threshold.name, threshold);
    }
  }

  /**
   * Initialize alert rules
   */
  private initializeAlertRules(): void {
    const rules: AlertRule[] = [
      {
        name: 'high_license_latency',
        condition: 'license_issuance_p95 > 250',
        threshold: 250,
        windowMs: 300000, // 5 minutes
        severity: 'high',
        enabled: true
      },
      {
        name: 'edge_auth_failures',
        condition: 'edge_authorization_error_rate > 1',
        threshold: 1, // 1% error rate
        windowMs: 60000, // 1 minute
        severity: 'critical',
        enabled: true
      },
      {
        name: 'upload_queue_backlog',
        condition: 'upload_queue_size > 100',
        threshold: 100,
        windowMs: 600000, // 10 minutes
        severity: 'medium',
        enabled: true
      },
      {
        name: 'database_connection_pool_exhausted',
        condition: 'db_pool_available < 2',
        threshold: 2,
        windowMs: 60000, // 1 minute
        severity: 'critical',
        enabled: true
      }
    ];

    for (const rule of rules) {
      this.alertRules.set(rule.name, rule);
    }
  }

  /**
   * Record a counter metric
   */
  counter(name: string, value: number = 1, tags: Record<string, string> = {}): void {
    this.recordMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'counter'
    });
  }

  /**
   * Record a gauge metric
   */
  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    this.recordMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'gauge'
    });
  }

  /**
   * Start a timer
   */
  startTimer(name: string, tags: Record<string, string> = {}): string {
    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.timers.set(timerId, {
      start: new Date(),
      tags
    });
    return timerId;
  }

  /**
   * End a timer and record the duration
   */
  endTimer(timerId: string, success: boolean = true, error?: string): TimerResult {
    const timer = this.timers.get(timerId);
    if (!timer) {
      throw new Error(`Timer ${timerId} not found`);
    }

    const duration = Date.now() - timer.start.getTime();
    this.timers.delete(timerId);

    // Extract metric name from timer ID
    const metricName = timerId.split('_')[0];
    
    this.recordMetric({
      name: `${metricName}_duration`,
      value: duration,
      timestamp: new Date(),
      tags: {
        ...timer.tags,
        success: success.toString(),
        ...(error && { error })
      },
      type: 'timer'
    });

    // Check SLA thresholds
    this.checkSLAViolation(metricName, duration, success);

    return { duration, success, error };
  }

  /**
   * Time a function execution
   */
  async timeFunction<T>(
    name: string,
    fn: () => Promise<T>,
    tags: Record<string, string> = {}
  ): Promise<T> {
    const timerId = this.startTimer(name, tags);
    
    try {
      const result = await fn();
      this.endTimer(timerId, true);
      return result;
    } catch (error) {
      this.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get metrics for a specific name and time range
   */
  getMetrics(name: string, since?: Date): MetricPoint[] {
    const metrics = this.metrics.get(name) || [];
    
    if (since) {
      return metrics.filter(m => m.timestamp >= since);
    }
    
    return metrics;
  }

  /**
   * Calculate percentiles for timer metrics
   */
  calculatePercentiles(name: string, windowMs: number = 300000): { p50: number; p95: number; p99: number } {
    const since = new Date(Date.now() - windowMs);
    const metrics = this.getMetrics(`${name}_duration`, since);
    
    if (metrics.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    
    return {
      p50: this.percentile(values, 50),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99)
    };
  }

  /**
   * Calculate error rate for a metric
   */
  calculateErrorRate(name: string, windowMs: number = 300000): number {
    const since = new Date(Date.now() - windowMs);
    const metrics = this.getMetrics(`${name}_duration`, since);
    
    if (metrics.length === 0) {
      return 0;
    }

    const errors = metrics.filter(m => m.tags.success === 'false').length;
    return (errors / metrics.length) * 100;
  }

  /**
   * Get system health metrics
   */
  getHealthMetrics(): Record<string, any> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 300000);

    return {
      license_issuance: {
        ...this.calculatePercentiles('license_issuance'),
        error_rate: this.calculateErrorRate('license_issuance'),
        total_requests: this.getMetrics('license_issuance_duration', fiveMinutesAgo).length
      },
      edge_authorization: {
        ...this.calculatePercentiles('edge_authorization'),
        error_rate: this.calculateErrorRate('edge_authorization'),
        total_requests: this.getMetrics('edge_authorization_duration', fiveMinutesAgo).length
      },
      upload_processing: {
        ...this.calculatePercentiles('upload_processing'),
        error_rate: this.calculateErrorRate('upload_processing'),
        total_uploads: this.getMetrics('upload_processing_duration', fiveMinutesAgo).length
      },
      timestamp: now.toISOString()
    };
  }

  /**
   * Record a metric point
   */
  private recordMetric(metric: MetricPoint): void {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metrics = this.metrics.get(metric.name)!;
    metrics.push(metric);

    // Keep only last 1000 points per metric to prevent memory issues
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }

    // Emit metric for real-time monitoring
    this.emit('metric', metric);
  }

  /**
   * Check for SLA violations
   */
  private async checkSLAViolation(metricName: string, duration: number, success: boolean): Promise<void> {
    const threshold = this.slaThresholds.get(metricName);
    if (!threshold || !threshold.enabled) {
      return;
    }

    const percentiles = this.calculatePercentiles(metricName);
    const errorRate = this.calculateErrorRate(metricName);
    const availability = 100 - errorRate;

    let violation = false;
    let violationType = '';

    if (percentiles.p95 > threshold.p95Threshold) {
      violation = true;
      violationType = 'p95_latency';
    } else if (percentiles.p99 > threshold.p99Threshold) {
      violation = true;
      violationType = 'p99_latency';
    } else if (availability < threshold.availabilityThreshold) {
      violation = true;
      violationType = 'availability';
    }

    if (violation) {
      await this.emitSLAViolation(metricName, violationType, {
        p95: percentiles.p95,
        p99: percentiles.p99,
        availability,
        threshold
      });
    }
  }

  /**
   * Emit SLA violation event
   */
  private async emitSLAViolation(
    metricName: string,
    violationType: string,
    data: any
  ): Promise<void> {
    // Check cooldown to prevent spam
    const cooldownKey = `${metricName}_${violationType}`;
    const lastAlert = this.alertCooldowns.get(cooldownKey);
    const cooldownMs = 300000; // 5 minutes

    if (lastAlert && Date.now() - lastAlert.getTime() < cooldownMs) {
      return;
    }

    this.alertCooldowns.set(cooldownKey, new Date());

    await eventBus.publish({
      type: 'sla.violation',
      version: '1.0',
      correlationId: `sla-violation-${Date.now()}`,
      payload: {
        metricName,
        violationType,
        data,
        severity: 'high'
      },
      metadata: {
        source: 'metrics-collector'
      }
    });

    console.error(`[SLA VIOLATION] ${metricName} ${violationType}:`, data);
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Start metrics aggregation and cleanup
   */
  private startMetricsAggregation(): void {
    // Aggregate and emit metrics every 30 seconds
    setInterval(() => {
      const healthMetrics = this.getHealthMetrics();
      this.emit('health_metrics', healthMetrics);
    }, 30000);

    // Cleanup old metrics every 5 minutes
    setInterval(() => {
      const cutoff = new Date(Date.now() - 3600000); // 1 hour ago
      
      for (const [name, metrics] of this.metrics.entries()) {
        const filtered = metrics.filter(m => m.timestamp > cutoff);
        this.metrics.set(name, filtered);
      }
    }, 300000);
  }
}

// Global metrics collector
export const metrics = new MetricsCollector();