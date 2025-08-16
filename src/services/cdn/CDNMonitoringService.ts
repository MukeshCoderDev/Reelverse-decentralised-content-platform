import { EventEmitter } from 'events';
import { multiCDNService, CDNProvider } from './MultiCDNService';
import { webhookService } from '../webhooks/WebhookService';
import { logger } from '../logging/Logger';
import { redis } from '../redis/RedisClient';

// Monitoring alert types
export enum AlertType {
  CDN_UNHEALTHY = 'cdn_unhealthy',
  CDN_RECOVERED = 'cdn_recovered',
  FAILOVER_EXECUTED = 'failover_executed',
  HIGH_ERROR_RATE = 'high_error_rate',
  SLOW_RESPONSE_TIME = 'slow_response_time',
  KEY_ROTATION_FAILED = 'key_rotation_failed',
  REGIONAL_COMPLIANCE_VIOLATION = 'regional_compliance_violation'
}

// Alert configuration
export interface AlertConfig {
  type: AlertType;
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  isEnabled: boolean;
  webhookUrl?: string;
  emailRecipients?: string[];
}

// Performance metrics
export interface CDNPerformanceMetrics {
  provider: CDNProvider;
  timestamp: Date;
  responseTime: number;
  errorRate: number;
  throughput: number;
  cacheHitRatio: number;
  bandwidthUsage: number;
}

// Alert event
export interface AlertEvent {
  id: string;
  type: AlertType;
  provider?: CDNProvider;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  timestamp: Date;
  acknowledged: boolean;
}

export class CDNMonitoringService extends EventEmitter {
  private alertConfigs: Map<AlertType, AlertConfig> = new Map();
  private activeAlerts: Map<string, AlertEvent> = new Map();
  private metricsBuffer: CDNPerformanceMetrics[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeAlertConfigs();
    this.setupEventListeners();
    this.startMonitoring();
  }

  private initializeAlertConfigs() {
    // CDN health alerts
    this.alertConfigs.set(AlertType.CDN_UNHEALTHY, {
      type: AlertType.CDN_UNHEALTHY,
      threshold: 1, // Immediate alert
      windowMinutes: 1,
      cooldownMinutes: 5,
      isEnabled: true
    });

    this.alertConfigs.set(AlertType.CDN_RECOVERED, {
      type: AlertType.CDN_RECOVERED,
      threshold: 1,
      windowMinutes: 1,
      cooldownMinutes: 0,
      isEnabled: true
    });

    // Performance alerts
    this.alertConfigs.set(AlertType.HIGH_ERROR_RATE, {
      type: AlertType.HIGH_ERROR_RATE,
      threshold: 5, // 5% error rate
      windowMinutes: 5,
      cooldownMinutes: 15,
      isEnabled: true
    });

    this.alertConfigs.set(AlertType.SLOW_RESPONSE_TIME, {
      type: AlertType.SLOW_RESPONSE_TIME,
      threshold: 2000, // 2 seconds
      windowMinutes: 5,
      cooldownMinutes: 10,
      isEnabled: true
    });

    // Operational alerts
    this.alertConfigs.set(AlertType.FAILOVER_EXECUTED, {
      type: AlertType.FAILOVER_EXECUTED,
      threshold: 1,
      windowMinutes: 1,
      cooldownMinutes: 30,
      isEnabled: true
    });

    this.alertConfigs.set(AlertType.KEY_ROTATION_FAILED, {
      type: AlertType.KEY_ROTATION_FAILED,
      threshold: 1,
      windowMinutes: 1,
      cooldownMinutes: 60,
      isEnabled: true
    });

    logger.info('CDN monitoring alert configs initialized', { 
      alertCount: this.alertConfigs.size 
    });
  }

  private setupEventListeners() {
    // Listen to CDN service events
    multiCDNService.on('cdn:unhealthy', (data) => {
      this.handleCDNUnhealthy(data.provider, data.health);
    });

    multiCDNService.on('cdn:recovered', (data) => {
      this.handleCDNRecovered(data.provider, data.health);
    });

    multiCDNService.on('cdn:failover', (data) => {
      this.handleFailover(data.from, data.to, data.reason);
    });

    multiCDNService.on('keys:rotated', (data) => {
      this.handleKeyRotation(data.timestamp);
    });
  }

  // Handle CDN unhealthy event
  private async handleCDNUnhealthy(provider: CDNProvider, health: any): Promise<void> {
    const alert = await this.createAlert({
      type: AlertType.CDN_UNHEALTHY,
      provider,
      severity: 'high',
      message: `CDN ${provider} is unhealthy`,
      details: {
        consecutiveFailures: health.consecutiveFailures,
        errorCount: health.errorCount,
        lastCheck: health.lastCheck
      }
    });

    await this.sendAlert(alert);
  }

  // Handle CDN recovery event
  private async handleCDNRecovered(provider: CDNProvider, health: any): Promise<void> {
    const alert = await this.createAlert({
      type: AlertType.CDN_RECOVERED,
      provider,
      severity: 'low',
      message: `CDN ${provider} has recovered`,
      details: {
        responseTime: health.responseTime,
        lastCheck: health.lastCheck
      }
    });

    await this.sendAlert(alert);
  }

  // Handle failover event
  private async handleFailover(from: CDNProvider, to: CDNProvider, reason: string): Promise<void> {
    const alert = await this.createAlert({
      type: AlertType.FAILOVER_EXECUTED,
      severity: 'critical',
      message: `CDN failover executed from ${from} to ${to}`,
      details: {
        from,
        to,
        reason,
        timestamp: new Date()
      }
    });

    await this.sendAlert(alert);
  }

  // Handle key rotation
  private async handleKeyRotation(timestamp: Date): Promise<void> {
    logger.info('CDN signing keys rotated successfully', { timestamp });
    
    // Store rotation event for audit
    await redis.lpush('cdn:key_rotations', JSON.stringify({
      timestamp,
      success: true
    }));
  }

  // Create alert event
  private async createAlert(alertData: {
    type: AlertType;
    provider?: CDNProvider;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details: any;
  }): Promise<AlertEvent> {
    const alert: AlertEvent = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: alertData.type,
      provider: alertData.provider,
      severity: alertData.severity,
      message: alertData.message,
      details: alertData.details,
      timestamp: new Date(),
      acknowledged: false
    };

    // Check if we should suppress this alert due to cooldown
    const shouldSuppress = await this.checkAlertCooldown(alert);
    if (shouldSuppress) {
      logger.debug('Alert suppressed due to cooldown', { 
        type: alert.type, 
        provider: alert.provider 
      });
      return alert;
    }

    // Store alert
    this.activeAlerts.set(alert.id, alert);
    await this.storeAlert(alert);

    logger.warn('CDN alert created', {
      id: alert.id,
      type: alert.type,
      provider: alert.provider,
      severity: alert.severity,
      message: alert.message
    });

    return alert;
  }

  // Send alert through configured channels
  private async sendAlert(alert: AlertEvent): Promise<void> {
    const config = this.alertConfigs.get(alert.type);
    if (!config?.isEnabled) {
      return;
    }

    try {
      // Send webhook notification
      await webhookService.emitWebhook('cdn.alert', {
        organizationId: 'system',
        alert: {
          id: alert.id,
          type: alert.type,
          provider: alert.provider,
          severity: alert.severity,
          message: alert.message,
          details: alert.details,
          timestamp: alert.timestamp
        }
      });

      // Send to status page
      await this.updateStatusPage(alert);

      // Send email notifications (if configured)
      if (config.emailRecipients?.length) {
        await this.sendEmailAlert(alert, config.emailRecipients);
      }

      logger.info('Alert sent successfully', { alertId: alert.id });

    } catch (error) {
      logger.error('Failed to send alert', { 
        alertId: alert.id, 
        error: error.message 
      });
    }
  }

  // Check if alert should be suppressed due to cooldown
  private async checkAlertCooldown(alert: AlertEvent): Promise<boolean> {
    const config = this.alertConfigs.get(alert.type);
    if (!config || config.cooldownMinutes === 0) {
      return false;
    }

    const cooldownKey = `cdn:alert_cooldown:${alert.type}:${alert.provider || 'global'}`;
    const lastAlert = await redis.get(cooldownKey);
    
    if (lastAlert) {
      const lastAlertTime = new Date(lastAlert);
      const cooldownEnd = new Date(lastAlertTime.getTime() + config.cooldownMinutes * 60 * 1000);
      
      if (new Date() < cooldownEnd) {
        return true; // Still in cooldown
      }
    }

    // Set new cooldown
    await redis.setex(cooldownKey, config.cooldownMinutes * 60, alert.timestamp.toISOString());
    return false;
  }

  // Update status page with alert information
  private async updateStatusPage(alert: AlertEvent): Promise<void> {
    const statusUpdate = {
      component: `cdn-${alert.provider || 'system'}`,
      status: this.getStatusFromSeverity(alert.severity),
      message: alert.message,
      timestamp: alert.timestamp
    };

    await redis.lpush('status:updates', JSON.stringify(statusUpdate));
    await redis.ltrim('status:updates', 0, 99); // Keep last 100 updates
  }

  // Convert alert severity to status page status
  private getStatusFromSeverity(severity: string): string {
    switch (severity) {
      case 'critical': return 'major_outage';
      case 'high': return 'partial_outage';
      case 'medium': return 'degraded_performance';
      case 'low': return 'operational';
      default: return 'operational';
    }
  }

  // Send email alert (mock implementation)
  private async sendEmailAlert(alert: AlertEvent, recipients: string[]): Promise<void> {
    // In production, integrate with email service (SendGrid, SES, etc.)
    logger.info('Email alert would be sent', { 
      alertId: alert.id, 
      recipients: recipients.length 
    });
  }

  // Store alert in database
  private async storeAlert(alert: AlertEvent): Promise<void> {
    await redis.lpush('cdn:alerts', JSON.stringify(alert));
    await redis.ltrim('cdn:alerts', 0, 999); // Keep last 1000 alerts
  }

  // Start performance monitoring
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(
      () => this.collectPerformanceMetrics(),
      60000 // Every minute
    );
  }

  // Collect performance metrics from all CDNs
  private async collectPerformanceMetrics(): Promise<void> {
    try {
      const metrics = await multiCDNService.getPerformanceMetrics();
      
      for (const cdnMetric of metrics.cdns) {
        const performanceMetric: CDNPerformanceMetrics = {
          provider: cdnMetric.provider,
          timestamp: new Date(),
          responseTime: cdnMetric.responseTime,
          errorRate: this.calculateErrorRate(cdnMetric),
          throughput: await this.getThroughput(cdnMetric.provider),
          cacheHitRatio: await this.getCacheHitRatio(cdnMetric.provider),
          bandwidthUsage: await this.getBandwidthUsage(cdnMetric.provider)
        };

        this.metricsBuffer.push(performanceMetric);
        await this.checkPerformanceThresholds(performanceMetric);
      }

      // Keep buffer size manageable
      if (this.metricsBuffer.length > 1000) {
        this.metricsBuffer = this.metricsBuffer.slice(-500);
      }

    } catch (error) {
      logger.error('Failed to collect CDN performance metrics', { error: error.message });
    }
  }

  // Check performance metrics against thresholds
  private async checkPerformanceThresholds(metric: CDNPerformanceMetrics): Promise<void> {
    // Check error rate threshold
    const errorRateConfig = this.alertConfigs.get(AlertType.HIGH_ERROR_RATE);
    if (errorRateConfig?.isEnabled && metric.errorRate > errorRateConfig.threshold) {
      await this.createAlert({
        type: AlertType.HIGH_ERROR_RATE,
        provider: metric.provider,
        severity: 'high',
        message: `High error rate detected: ${metric.errorRate.toFixed(2)}%`,
        details: { errorRate: metric.errorRate, threshold: errorRateConfig.threshold }
      });
    }

    // Check response time threshold
    const responseTimeConfig = this.alertConfigs.get(AlertType.SLOW_RESPONSE_TIME);
    if (responseTimeConfig?.isEnabled && metric.responseTime > responseTimeConfig.threshold) {
      await this.createAlert({
        type: AlertType.SLOW_RESPONSE_TIME,
        provider: metric.provider,
        severity: 'medium',
        message: `Slow response time detected: ${metric.responseTime}ms`,
        details: { responseTime: metric.responseTime, threshold: responseTimeConfig.threshold }
      });
    }
  }

  // Calculate error rate from CDN metrics
  private calculateErrorRate(cdnMetric: any): number {
    // Mock calculation - in production, use actual error/success counts
    return cdnMetric.errorCount > 0 ? (cdnMetric.errorCount / 100) * 100 : 0;
  }

  // Get throughput metrics (mock implementation)
  private async getThroughput(provider: CDNProvider): Promise<number> {
    // In production, fetch from CDN provider APIs
    return Math.random() * 1000; // Mock throughput in MB/s
  }

  // Get cache hit ratio (mock implementation)
  private async getCacheHitRatio(provider: CDNProvider): Promise<number> {
    // In production, fetch from CDN provider APIs
    return 0.85 + Math.random() * 0.1; // Mock 85-95% hit ratio
  }

  // Get bandwidth usage (mock implementation)
  private async getBandwidthUsage(provider: CDNProvider): Promise<number> {
    // In production, fetch from CDN provider APIs
    return Math.random() * 10000; // Mock bandwidth in GB
  }

  // Get current alerts
  async getActiveAlerts(): Promise<AlertEvent[]> {
    return Array.from(this.activeAlerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Acknowledge alert
  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      await this.storeAlert(alert);
      logger.info('Alert acknowledged', { alertId });
    }
  }

  // Get performance metrics for dashboard
  async getPerformanceMetrics(timeRange: number = 3600): Promise<CDNPerformanceMetrics[]> {
    const cutoff = new Date(Date.now() - timeRange * 1000);
    return this.metricsBuffer.filter(metric => metric.timestamp > cutoff);
  }

  // Cleanup resources
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}

export const cdnMonitoringService = new CDNMonitoringService();