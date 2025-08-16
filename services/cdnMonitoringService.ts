import { multiCdnFailoverService, CDNHealthStatus, FailoverEvent } from './multiCdnFailoverService';
import { statusPageService } from './statusPageService';

export interface CDNMetrics {
  providerId: string;
  providerName: string;
  isActive: boolean;
  healthStatus: CDNHealthStatus;
  responseTime: number;
  uptime: number;
  errorRate: number;
  lastFailover?: Date;
  keyRotationStatus: 'current' | 'rotating' | 'expired';
}

export interface CDNAlert {
  id: string;
  type: 'failover' | 'health_degraded' | 'key_rotation_failed' | 'regional_blocking_failed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  providerId: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export class CDNMonitoringService {
  private alerts: Map<string, CDNAlert> = new Map();
  private metricsHistory: Map<string, CDNMetrics[]> = new Map();
  private alertThresholds = {
    responseTimeWarning: 1000, // 1 second
    responseTimeCritical: 3000, // 3 seconds
    errorRateWarning: 0.05, // 5%
    errorRateCritical: 0.15, // 15%
    uptimeWarning: 0.99, // 99%
    uptimeCritical: 0.95 // 95%
  };

  constructor() {
    this.initializeMonitoring();
  }

  private initializeMonitoring(): void {
    // Listen for failover events
    multiCdnFailoverService.on('failover', (event: FailoverEvent) => {
      this.handleFailoverEvent(event);
    });

    // Listen for key rotation events
    multiCdnFailoverService.on('keyRotated', (event: any) => {
      this.handleKeyRotationEvent(event);
    });

    // Start periodic metrics collection
    setInterval(() => {
      this.collectMetrics();
    }, 30000); // Every 30 seconds

    // Start alert processing
    setInterval(() => {
      this.processAlerts();
    }, 60000); // Every minute
  }

  private async handleFailoverEvent(event: FailoverEvent): Promise<void> {
    const alertId = `failover-${Date.now()}`;
    const alert: CDNAlert = {
      id: alertId,
      type: 'failover',
      severity: 'high',
      message: `CDN failover from ${event.fromProvider} to ${event.toProvider}: ${event.reason}`,
      providerId: event.fromProvider,
      timestamp: event.timestamp,
      resolved: false
    };

    this.alerts.set(alertId, alert);

    // Update status page
    await statusPageService.createIncident({
      title: `CDN Failover: ${event.fromProvider} → ${event.toProvider}`,
      description: `Automatic failover triggered due to: ${event.reason}`,
      severity: 'major',
      affectedServices: ['video-delivery', 'content-streaming'],
      status: 'monitoring'
    });

    // Send webhook alert
    await this.sendWebhookAlert(alert);

    console.log(`CDN Failover Alert: ${alert.message}`);
  }

  private handleKeyRotationEvent(event: any): void {
    console.log(`CDN Key Rotation: Provider ${event.providerId} rotated key ${event.keyId}`);
    
    // Create low-severity alert for key rotation
    const alertId = `key-rotation-${Date.now()}`;
    const alert: CDNAlert = {
      id: alertId,
      type: 'key_rotation_failed',
      severity: 'low',
      message: `Signed URL key rotated for ${event.providerId}`,
      providerId: event.providerId,
      timestamp: event.timestamp,
      resolved: true,
      resolvedAt: event.timestamp
    };

    this.alerts.set(alertId, alert);
  }

  private async collectMetrics(): Promise<void> {
    const healthStatuses = multiCdnFailoverService.getAllHealthStatus();
    const activeProvider = multiCdnFailoverService.getActiveProvider();

    for (const [providerId, healthStatus] of healthStatuses) {
      const metrics: CDNMetrics = {
        providerId,
        providerName: this.getProviderName(providerId),
        isActive: providerId === activeProvider.id,
        healthStatus,
        responseTime: healthStatus.responseTime,
        uptime: this.calculateUptime(providerId, healthStatus),
        errorRate: this.calculateErrorRate(providerId, healthStatus),
        keyRotationStatus: this.getKeyRotationStatus(providerId)
      };

      // Store metrics history
      if (!this.metricsHistory.has(providerId)) {
        this.metricsHistory.set(providerId, []);
      }
      
      const history = this.metricsHistory.get(providerId)!;
      history.push(metrics);
      
      // Keep only last 24 hours of metrics (assuming 30s intervals = 2880 data points)
      if (history.length > 2880) {
        history.shift();
      }

      // Check for alert conditions
      await this.checkAlertConditions(metrics);
    }

    // Update status page with current metrics
    await this.updateStatusPageMetrics();
  }

  private getProviderName(providerId: string): string {
    const providerNames: Record<string, string> = {
      'cloudflare': 'Cloudflare',
      'aws-cloudfront': 'AWS CloudFront',
      'fastly': 'Fastly'
    };
    return providerNames[providerId] || providerId;
  }

  private calculateUptime(providerId: string, healthStatus: CDNHealthStatus): number {
    const history = this.metricsHistory.get(providerId) || [];
    if (history.length === 0) return healthStatus.isHealthy ? 1.0 : 0.0;

    const healthyCount = history.filter(m => m.healthStatus.isHealthy).length;
    return healthyCount / history.length;
  }

  private calculateErrorRate(providerId: string, healthStatus: CDNHealthStatus): number {
    const history = this.metricsHistory.get(providerId) || [];
    if (history.length === 0) return healthStatus.isHealthy ? 0.0 : 1.0;

    const totalChecks = history.length;
    const errorCount = healthStatus.errorCount;
    return errorCount / Math.max(totalChecks, 1);
  }

  private getKeyRotationStatus(providerId: string): 'current' | 'rotating' | 'expired' {
    // This would check the actual key rotation status
    // For now, return 'current' as default
    return 'current';
  }

  private async checkAlertConditions(metrics: CDNMetrics): Promise<void> {
    const alerts: CDNAlert[] = [];

    // Check response time
    if (metrics.responseTime > this.alertThresholds.responseTimeCritical) {
      alerts.push({
        id: `response-time-critical-${metrics.providerId}-${Date.now()}`,
        type: 'health_degraded',
        severity: 'critical',
        message: `CDN ${metrics.providerName} response time critical: ${metrics.responseTime}ms`,
        providerId: metrics.providerId,
        timestamp: new Date(),
        resolved: false
      });
    } else if (metrics.responseTime > this.alertThresholds.responseTimeWarning) {
      alerts.push({
        id: `response-time-warning-${metrics.providerId}-${Date.now()}`,
        type: 'health_degraded',
        severity: 'medium',
        message: `CDN ${metrics.providerName} response time elevated: ${metrics.responseTime}ms`,
        providerId: metrics.providerId,
        timestamp: new Date(),
        resolved: false
      });
    }

    // Check error rate
    if (metrics.errorRate > this.alertThresholds.errorRateCritical) {
      alerts.push({
        id: `error-rate-critical-${metrics.providerId}-${Date.now()}`,
        type: 'health_degraded',
        severity: 'critical',
        message: `CDN ${metrics.providerName} error rate critical: ${(metrics.errorRate * 100).toFixed(1)}%`,
        providerId: metrics.providerId,
        timestamp: new Date(),
        resolved: false
      });
    } else if (metrics.errorRate > this.alertThresholds.errorRateWarning) {
      alerts.push({
        id: `error-rate-warning-${metrics.providerId}-${Date.now()}`,
        type: 'health_degraded',
        severity: 'medium',
        message: `CDN ${metrics.providerName} error rate elevated: ${(metrics.errorRate * 100).toFixed(1)}%`,
        providerId: metrics.providerId,
        timestamp: new Date(),
        resolved: false
      });
    }

    // Check uptime
    if (metrics.uptime < this.alertThresholds.uptimeCritical) {
      alerts.push({
        id: `uptime-critical-${metrics.providerId}-${Date.now()}`,
        type: 'health_degraded',
        severity: 'critical',
        message: `CDN ${metrics.providerName} uptime critical: ${(metrics.uptime * 100).toFixed(1)}%`,
        providerId: metrics.providerId,
        timestamp: new Date(),
        resolved: false
      });
    } else if (metrics.uptime < this.alertThresholds.uptimeWarning) {
      alerts.push({
        id: `uptime-warning-${metrics.providerId}-${Date.now()}`,
        type: 'health_degraded',
        severity: 'medium',
        message: `CDN ${metrics.providerName} uptime degraded: ${(metrics.uptime * 100).toFixed(1)}%`,
        providerId: metrics.providerId,
        timestamp: new Date(),
        resolved: false
      });
    }

    // Store and process alerts
    for (const alert of alerts) {
      this.alerts.set(alert.id, alert);
      await this.sendWebhookAlert(alert);
    }
  }

  private async updateStatusPageMetrics(): Promise<void> {
    const activeProvider = multiCdnFailoverService.getActiveProvider();
    const healthStatuses = multiCdnFailoverService.getAllHealthStatus();
    const activeStatus = healthStatuses.get(activeProvider.id);

    if (activeStatus) {
      const uptime = this.calculateUptime(activeProvider.id, activeStatus);
      const errorRate = this.calculateErrorRate(activeProvider.id, activeStatus);

      await statusPageService.updateMetrics({
        'cdn-response-time': {
          value: activeStatus.responseTime,
          unit: 'ms',
          status: activeStatus.responseTime < 2000 ? 'operational' : 'degraded'
        },
        'cdn-uptime': {
          value: uptime * 100,
          unit: '%',
          status: uptime > 0.99 ? 'operational' : 'degraded'
        },
        'cdn-error-rate': {
          value: errorRate * 100,
          unit: '%',
          status: errorRate < 0.01 ? 'operational' : 'degraded'
        }
      });
    }
  }

  private async processAlerts(): Promise<void> {
    const unresolvedAlerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved);
    
    for (const alert of unresolvedAlerts) {
      // Auto-resolve alerts that are no longer relevant
      if (await this.shouldAutoResolveAlert(alert)) {
        alert.resolved = true;
        alert.resolvedAt = new Date();
        
        await statusPageService.updateIncident(alert.id, {
          status: 'resolved',
          message: 'Alert condition resolved automatically'
        });
      }
    }
  }

  private async shouldAutoResolveAlert(alert: CDNAlert): Promise<boolean> {
    const healthStatuses = multiCdnFailoverService.getAllHealthStatus();
    const providerStatus = healthStatuses.get(alert.providerId);
    
    if (!providerStatus) return false;

    switch (alert.type) {
      case 'health_degraded':
        return providerStatus.isHealthy && 
               providerStatus.responseTime < this.alertThresholds.responseTimeWarning;
      
      case 'failover':
        // Resolve failover alerts after 1 hour if provider is healthy again
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return alert.timestamp < hourAgo && providerStatus.isHealthy;
      
      default:
        return false;
    }
  }

  private async sendWebhookAlert(alert: CDNAlert): Promise<void> {
    try {
      const webhookUrl = process.env.CDN_ALERT_WEBHOOK_URL;
      if (!webhookUrl) {
        console.log('No webhook URL configured for CDN alerts');
        return;
      }

      const payload = {
        alert_type: 'cdn_monitoring',
        severity: alert.severity,
        message: alert.message,
        provider_id: alert.providerId,
        timestamp: alert.timestamp.toISOString(),
        alert_id: alert.id
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CDN-Monitor/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(`Failed to send CDN alert webhook: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error sending CDN alert webhook:', error);
    }
  }

  public async runFailoverValidation(): Promise<boolean> {
    try {
      console.log('Running CDN failover validation...');
      
      // Test automatic failover capability
      const validationResult = await multiCdnFailoverService.validateFailoverCapability();
      
      if (validationResult) {
        console.log('✅ CDN failover validation passed');
        
        // Create success alert
        const alertId = `validation-success-${Date.now()}`;
        const alert: CDNAlert = {
          id: alertId,
          type: 'failover',
          severity: 'low',
          message: 'CDN failover validation completed successfully',
          providerId: 'system',
          timestamp: new Date(),
          resolved: true,
          resolvedAt: new Date()
        };
        
        this.alerts.set(alertId, alert);
        return true;
      } else {
        console.log('❌ CDN failover validation failed');
        
        // Create failure alert
        const alertId = `validation-failure-${Date.now()}`;
        const alert: CDNAlert = {
          id: alertId,
          type: 'failover',
          severity: 'critical',
          message: 'CDN failover validation failed - manual intervention required',
          providerId: 'system',
          timestamp: new Date(),
          resolved: false
        };
        
        this.alerts.set(alertId, alert);
        await this.sendWebhookAlert(alert);
        return false;
      }
    } catch (error) {
      console.error('CDN failover validation error:', error);
      return false;
    }
  }

  public getCurrentMetrics(): Map<string, CDNMetrics> {
    const currentMetrics = new Map<string, CDNMetrics>();
    
    for (const [providerId, history] of this.metricsHistory) {
      if (history.length > 0) {
        currentMetrics.set(providerId, history[history.length - 1]);
      }
    }
    
    return currentMetrics;
  }

  public getActiveAlerts(): CDNAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  public getAlertHistory(hours: number = 24): CDNAlert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Array.from(this.alerts.values()).filter(alert => alert.timestamp >= cutoff);
  }

  public generateMonitoringReport(): string {
    const currentMetrics = this.getCurrentMetrics();
    const activeAlerts = this.getActiveAlerts();
    const recentAlerts = this.getAlertHistory(24);

    const report = [
      '# CDN Monitoring Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Current Status',
      ''
    ];

    // Add current metrics
    for (const [providerId, metrics] of currentMetrics) {
      const status = metrics.isActive ? '🟢 ACTIVE' : metrics.healthStatus.isHealthy ? '🟡 STANDBY' : '🔴 UNHEALTHY';
      report.push(`### ${metrics.providerName} ${status}`);
      report.push(`- Response Time: ${metrics.responseTime}ms`);
      report.push(`- Uptime: ${(metrics.uptime * 100).toFixed(2)}%`);
      report.push(`- Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
      report.push(`- Key Rotation: ${metrics.keyRotationStatus}`);
      report.push('');
    }

    // Add active alerts
    report.push('## Active Alerts');
    if (activeAlerts.length === 0) {
      report.push('No active alerts');
    } else {
      activeAlerts.forEach(alert => {
        const severity = alert.severity.toUpperCase();
        report.push(`- **${severity}**: ${alert.message} (${alert.timestamp.toISOString()})`);
      });
    }
    report.push('');

    // Add recent alert summary
    report.push('## 24-Hour Alert Summary');
    const alertCounts = recentAlerts.reduce((counts, alert) => {
      counts[alert.severity] = (counts[alert.severity] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    Object.entries(alertCounts).forEach(([severity, count]) => {
      report.push(`- ${severity}: ${count} alerts`);
    });

    return report.join('\n');
  }
}

export const cdnMonitoringService = new CDNMonitoringService();