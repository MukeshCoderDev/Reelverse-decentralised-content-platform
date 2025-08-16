/**
 * Public Status Page Service
 * Provides public-facing status page with real-time metrics for agencies and investors
 */

import { RealTimeMetricsAggregator, AggregatedSLOs } from './realTimeMetricsAggregator';
import { MetricsCache } from './metricsCache';
import { WebhookAlertService, IncidentAlert, ServiceAlert } from './webhookAlertService';

export interface RealtimeMetrics {
  timestamp: Date;
  playbackP95JoinTime: number;
  rebufferRatio: number;
  payoutP95Latency: number;
  checkoutSuccessRate: number;
  uptime: number;
  activeUsers: number;
  errorRate: number;
  aiTaggingAccuracy: number;
  leakDetectionRate: number;
}

export interface HistoricalMetrics {
  date: Date;
  metrics: RealtimeMetrics;
}

export interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
  uptime: number;
  responseTime: number;
  lastChecked: Date;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  startedAt: Date;
  resolvedAt?: Date;
  affectedServices: string[];
  updates: IncidentUpdate[];
}

export interface IncidentUpdate {
  timestamp: Date;
  status: Incident['status'];
  message: string;
  author: string;
}

export interface SLOTarget {
  metric: string;
  target: number;
  current: number;
  status: 'meeting' | 'at_risk' | 'breached';
  description: string;
}

export class StatusPageService {
  private static instance: StatusPageService;
  private aggregator: RealTimeMetricsAggregator;
  private cache: MetricsCache;
  private webhookService: WebhookAlertService;
  private metricsRetentionDays: number = 90;
  private incidents: Map<string, Incident> = new Map();
  private serviceStatuses: Map<string, ServiceStatus> = new Map();

  private constructor() {
    this.aggregator = RealTimeMetricsAggregator.getInstance();
    this.cache = MetricsCache.getInstance();
    this.webhookService = WebhookAlertService.getInstance();
    this.initializeServices();
    this.setupEventListeners();
  }

  public static getInstance(): StatusPageService {
    if (!StatusPageService.instance) {
      StatusPageService.instance = new StatusPageService();
    }
    return StatusPageService.instance;
  }

  /**
   * Initialize default service statuses
   */
  private initializeServices(): void {
    const services = [
      'api',
      'video_streaming', 
      'payment_processing',
      'ai_services',
      'blockchain',
      'cdn',
      'database'
    ];

    services.forEach(service => {
      this.serviceStatuses.set(service, {
        name: service,
        status: 'operational',
        uptime: 99.9,
        responseTime: 100,
        lastChecked: new Date()
      });
    });
  }

  /**
   * Setup event listeners for real-time updates
   */
  private setupEventListeners(): void {
    this.aggregator.on('sloUpdate', (slos: AggregatedSLOs) => {
      this.updateRealtimeMetrics({
        timestamp: slos.timestamp,
        playbackP95JoinTime: slos.playbackP95JoinTime,
        rebufferRatio: slos.rebufferRatio,
        payoutP95Latency: slos.payoutP95Latency,
        checkoutSuccessRate: slos.checkoutSuccessRate,
        uptime: slos.uptime,
        activeUsers: 0, // Would be calculated from active sessions
        errorRate: slos.errorRate,
        aiTaggingAccuracy: slos.aiTaggingAccuracy,
        leakDetectionRate: slos.leakDetectionRate
      });
    });

    this.aggregator.on('alert', (alert: any) => {
      this.handleSLOAlert(alert);
    });
  }

  /**
   * Get current real-time metrics
   */
  async getRealtimeMetrics(): Promise<RealtimeMetrics> {
    try {
      // Try to get from cache first
      const cached = await this.cache.getCurrentSLOMetrics();
      if (cached) {
        return {
          timestamp: cached.timestamp,
          playbackP95JoinTime: cached.playbackP95JoinTime,
          rebufferRatio: cached.rebufferRatio,
          payoutP95Latency: cached.payoutP95Latency,
          checkoutSuccessRate: cached.checkoutSuccessRate,
          uptime: cached.uptime,
          activeUsers: 0, // Would be calculated from active sessions
          errorRate: cached.errorRate,
          aiTaggingAccuracy: cached.aiTaggingAccuracy,
          leakDetectionRate: cached.leakDetectionRate
        };
      }

      // Fallback to aggregator
      const current = await this.aggregator.getCurrentSLOs();
      if (current) {
        return {
          timestamp: current.timestamp,
          playbackP95JoinTime: current.playbackP95JoinTime,
          rebufferRatio: current.rebufferRatio,
          payoutP95Latency: current.payoutP95Latency,
          checkoutSuccessRate: current.checkoutSuccessRate,
          uptime: current.uptime,
          activeUsers: 0,
          errorRate: current.errorRate,
          aiTaggingAccuracy: current.aiTaggingAccuracy,
          leakDetectionRate: current.leakDetectionRate
        };
      }

      return this.getDefaultMetrics();
    } catch (error) {
      console.error('Error getting realtime metrics:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Update real-time metrics
   */
  async updateRealtimeMetrics(metrics: Partial<RealtimeMetrics>): Promise<void> {
    try {
      const currentMetrics = await this.getRealtimeMetrics();
      const updatedMetrics = {
        ...currentMetrics,
        ...metrics,
        timestamp: new Date()
      };

      // Store in cache
      await this.cache.cacheDashboardData(updatedMetrics, 60); // 1 minute TTL

      // Store historical data (daily aggregation)
      await this.storeHistoricalMetrics(updatedMetrics);

      // Check SLA breaches
      await this.checkSLABreaches(updatedMetrics);

    } catch (error) {
      console.error('Error updating realtime metrics:', error);
    }
  }

  /**
   * Get historical metrics for trending
   */
  async getHistoricalMetrics(days: number = 30): Promise<HistoricalMetrics[]> {
    try {
      // Try to get from aggregator first
      const sloHistory = await this.aggregator.getSLOHistory(days * 24 * 60); // Convert days to minutes
      
      if (sloHistory.length > 0) {
        return sloHistory.map(slo => ({
          date: slo.timestamp,
          metrics: {
            timestamp: slo.timestamp,
            playbackP95JoinTime: slo.playbackP95JoinTime,
            rebufferRatio: slo.rebufferRatio,
            payoutP95Latency: slo.payoutP95Latency,
            checkoutSuccessRate: slo.checkoutSuccessRate,
            uptime: slo.uptime,
            activeUsers: 0,
            errorRate: slo.errorRate,
            aiTaggingAccuracy: slo.aiTaggingAccuracy,
            leakDetectionRate: slo.leakDetectionRate
          }
        }));
      }

      // Generate mock historical data for demo
      const historicalData: HistoricalMetrics[] = [];
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const baseMetrics = this.getDefaultMetrics();
        
        // Add some realistic variation
        historicalData.push({
          date: new Date(date),
          metrics: {
            ...baseMetrics,
            timestamp: new Date(date),
            playbackP95JoinTime: baseMetrics.playbackP95JoinTime + (Math.random() - 0.5) * 500,
            rebufferRatio: Math.max(0, baseMetrics.rebufferRatio + (Math.random() - 0.5) * 0.5),
            checkoutSuccessRate: Math.min(100, baseMetrics.checkoutSuccessRate + (Math.random() - 0.5) * 2),
            payoutP95Latency: Math.max(0, baseMetrics.payoutP95Latency + (Math.random() - 0.5) * 6),
            uptime: Math.min(100, baseMetrics.uptime + (Math.random() - 0.5) * 0.1)
          }
        });
      }

      return historicalData;
    } catch (error) {
      console.error('Error getting historical metrics:', error);
      return [];
    }
  }

  /**
   * Get current service statuses
   */
  async getServiceStatuses(): Promise<ServiceStatus[]> {
    try {
      return Array.from(this.serviceStatuses.values());
    } catch (error) {
      console.error('Error getting service statuses:', error);
      return [];
    }
  }

  /**
   * Update service status
   */
  async updateServiceStatus(serviceName: string, status: Partial<ServiceStatus>): Promise<void> {
    try {
      const currentStatus = this.serviceStatuses.get(serviceName) || {
        name: serviceName,
        status: 'operational',
        uptime: 99.9,
        responseTime: 100,
        lastChecked: new Date()
      };
      
      const updatedStatus: ServiceStatus = {
        ...currentStatus,
        ...status,
        lastChecked: new Date()
      };

      // Send webhook if status changed
      if (status.status && status.status !== currentStatus.status) {
        const serviceAlert: ServiceAlert = {
          serviceName,
          status: status.status,
          previousStatus: currentStatus.status,
          uptime: updatedStatus.uptime,
          responseTime: updatedStatus.responseTime,
          timestamp: updatedStatus.lastChecked
        };

        this.webhookService.sendServiceAlert(serviceAlert).catch(error => {
          console.error('Failed to send service alert webhook:', error);
        });
      }

      this.serviceStatuses.set(serviceName, updatedStatus);

      // Cache the updated status
      await this.cache.cacheSessionMetrics(`service:${serviceName}`, updatedStatus, 300);

      // If service is degraded or down, check if we need to create an incident
      if (status.status && ['degraded', 'partial_outage', 'major_outage'].includes(status.status)) {
        await this.checkForAutoIncident(serviceName, status.status);
      }

    } catch (error) {
      console.error(`Error updating service status for ${serviceName}:`, error);
    }
  }

  /**
   * Get SLA targets and current performance
   */
  async getSLOTargets(): Promise<SLOTarget[]> {
    const currentMetrics = await this.getRealtimeMetrics();

    return [
      {
        metric: 'Playback P95 Join Time',
        target: 2000, // 2 seconds
        current: currentMetrics.playbackP95JoinTime,
        status: currentMetrics.playbackP95JoinTime <= 2000 ? 'meeting' : 'breached',
        description: '95th percentile time to first frame'
      },
      {
        metric: 'Rebuffer Ratio',
        target: 1.0, // 1%
        current: currentMetrics.rebufferRatio,
        status: currentMetrics.rebufferRatio <= 1.0 ? 'meeting' : 'breached',
        description: 'Percentage of playback time spent rebuffering'
      },
      {
        metric: 'Checkout Success Rate',
        target: 95.0, // 95%
        current: currentMetrics.checkoutSuccessRate,
        status: currentMetrics.checkoutSuccessRate >= 95.0 ? 'meeting' : 'breached',
        description: 'Percentage of successful payment completions'
      },
      {
        metric: 'Payout P95 Latency',
        target: 24, // 24 hours
        current: currentMetrics.payoutP95Latency,
        status: currentMetrics.payoutP95Latency <= 24 ? 'meeting' : 'breached',
        description: '95th percentile payout processing time'
      },
      {
        metric: 'System Uptime',
        target: 99.95, // 99.95%
        current: currentMetrics.uptime,
        status: currentMetrics.uptime >= 99.95 ? 'meeting' : 'breached',
        description: 'Overall system availability'
      },
      {
        metric: 'AI Tagging Accuracy',
        target: 95.0, // 95%
        current: currentMetrics.aiTaggingAccuracy,
        status: currentMetrics.aiTaggingAccuracy >= 95.0 ? 'meeting' : 'breached',
        description: 'Accuracy of AI-generated content tags'
      }
    ];
  }

  /**
   * Create a new incident
   */
  async createIncident(incident: Omit<Incident, 'id' | 'updates'>): Promise<string> {
    try {
      const incidentId = `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const fullIncident: Incident = {
        ...incident,
        id: incidentId,
        updates: []
      };

      this.incidents.set(incidentId, fullIncident);

      // Cache the incident
      await this.cache.cacheAlert(incidentId, fullIncident, 3600); // 1 hour TTL

      // Send webhook notification
      const incidentAlert: IncidentAlert = {
        incident: fullIncident,
        action: 'created'
      };
      
      this.webhookService.sendIncidentAlert(incidentAlert).catch(error => {
        console.error('Failed to send incident creation webhook:', error);
      });

      console.log(`Incident created: ${incidentId}`);
      return incidentId;
    } catch (error) {
      console.error('Error creating incident:', error);
      throw error;
    }
  }

  /**
   * Update an existing incident
   */
  async updateIncident(incidentId: string, update: IncidentUpdate): Promise<void> {
    try {
      const incident = this.incidents.get(incidentId);
      if (!incident) {
        throw new Error(`Incident ${incidentId} not found`);
      }

      incident.updates.push(update);
      incident.status = update.status;

      if (update.status === 'resolved') {
        incident.resolvedAt = new Date();
      }

      this.incidents.set(incidentId, incident);

      // Update cache
      await this.cache.cacheAlert(incidentId, incident, 3600);

      // Send webhook notification
      const incidentAlert: IncidentAlert = {
        incident,
        action: update.status === 'resolved' ? 'resolved' : 'updated'
      };
      
      this.webhookService.sendIncidentAlert(incidentAlert).catch(error => {
        console.error('Failed to send incident update webhook:', error);
      });

      console.log(`Incident updated: ${incidentId}`);
    } catch (error) {
      console.error(`Error updating incident ${incidentId}:`, error);
    }
  }

  /**
   * Get active incidents
   */
  async getActiveIncidents(): Promise<Incident[]> {
    try {
      const activeIncidents = Array.from(this.incidents.values())
        .filter(incident => incident.status !== 'resolved')
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

      return activeIncidents;
    } catch (error) {
      console.error('Error getting active incidents:', error);
      return [];
    }
  }

  /**
   * Get incident history
   */
  async getIncidentHistory(days: number = 30): Promise<Incident[]> {
    try {
      // This would typically query a more comprehensive incident database
      // For now, return recent resolved incidents
      const allIncidentIds = await this.redis.keys('status:incident:*');
      const incidents: Incident[] = [];

      for (const key of allIncidentIds) {
        const incidentData = await this.redis.hget(key, 'data');
        if (incidentData) {
          const incident = JSON.parse(incidentData);
          incident.startedAt = new Date(incident.startedAt);
          if (incident.resolvedAt) {
            incident.resolvedAt = new Date(incident.resolvedAt);
          }
          
          // Filter by date range
          const daysSinceIncident = (Date.now() - incident.startedAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceIncident <= days) {
            incidents.push(incident);
          }
        }
      }

      return incidents.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    } catch (error) {
      console.error('Error getting incident history:', error);
      return [];
    }
  }

  /**
   * Get overall platform status
   */
  async getOverallStatus(): Promise<'operational' | 'degraded' | 'partial_outage' | 'major_outage'> {
    try {
      const services = await this.getServiceStatuses();
      const activeIncidents = await this.getActiveIncidents();

      // Check for critical incidents
      const criticalIncidents = activeIncidents.filter(i => i.severity === 'critical');
      if (criticalIncidents.length > 0) {
        return 'major_outage';
      }

      // Check for major incidents
      const majorIncidents = activeIncidents.filter(i => i.severity === 'major');
      if (majorIncidents.length > 0) {
        return 'partial_outage';
      }

      // Check service statuses
      const degradedServices = services.filter(s => s.status !== 'operational');
      if (degradedServices.length > 0) {
        return 'degraded';
      }

      return 'operational';
    } catch (error) {
      console.error('Error getting overall status:', error);
      return 'degraded';
    }
  }

  /**
   * Store historical metrics for trending
   */
  private async storeHistoricalMetrics(metrics: RealtimeMetrics): Promise<void> {
    try {
      const dateKey = metrics.timestamp.toISOString().split('T')[0];
      
      // Store in cache with daily aggregation
      await this.cache.addTimeSeriesPoint('daily_metrics', metrics.timestamp, 1);
      
      // Store individual metrics
      await this.cache.addTimeSeriesPoint('daily_join_time', metrics.timestamp, metrics.playbackP95JoinTime);
      await this.cache.addTimeSeriesPoint('daily_rebuffer_ratio', metrics.timestamp, metrics.rebufferRatio);
      await this.cache.addTimeSeriesPoint('daily_checkout_success', metrics.timestamp, metrics.checkoutSuccessRate);
      await this.cache.addTimeSeriesPoint('daily_payout_latency', metrics.timestamp, metrics.payoutP95Latency);
      await this.cache.addTimeSeriesPoint('daily_uptime', metrics.timestamp, metrics.uptime);
      
    } catch (error) {
      console.error('Error storing historical metrics:', error);
    }
  }

  /**
   * Check for SLA breaches and trigger alerts
   */
  private async checkSLABreaches(metrics: RealtimeMetrics): Promise<void> {
    const sloTargets = await this.getSLOTargets();
    
    for (const slo of sloTargets) {
      if (slo.status === 'breached') {
        // This would trigger webhook alerts
        console.warn(`SLA breach detected: ${slo.metric} - Target: ${slo.target}, Current: ${slo.current}`);
        
        // Auto-create incident for critical breaches
        if (slo.metric === 'System Uptime' && slo.current < 99.0) {
          await this.createIncident({
            title: `System Uptime Below 99%`,
            description: `System uptime has dropped to ${slo.current.toFixed(2)}%, below the 99.95% target`,
            status: 'investigating',
            severity: 'critical',
            startedAt: new Date(),
            affectedServices: ['api', 'video_streaming']
          });
        }
      }
    }
  }

  /**
   * Check if we need to auto-create an incident for service degradation
   */
  private async checkForAutoIncident(serviceName: string, status: string): Promise<void> {
    // Check if there's already an active incident for this service
    const activeIncidents = await this.getActiveIncidents();
    const existingIncident = activeIncidents.find(i => 
      i.affectedServices.includes(serviceName) && i.status !== 'resolved'
    );

    if (!existingIncident) {
      // Create new incident
      const severity = status === 'major_outage' ? 'critical' : 
                     status === 'partial_outage' ? 'major' : 'minor';

      await this.createIncident({
        title: `${serviceName.replace('_', ' ')} Service Degradation`,
        description: `Automated detection of ${serviceName.replace('_', ' ')} service degradation`,
        status: 'investigating',
        severity,
        startedAt: new Date(),
        affectedServices: [serviceName]
      });
    }
  }

  /**
   * Handle SLO alerts from the aggregator
   */
  private async handleSLOAlert(alert: any): Promise<void> {
    console.warn(`SLO Alert: ${alert.metric} - ${alert.description}`, alert);
    
    // Create incident for critical alerts
    if (alert.severity === 'critical') {
      await this.createIncident({
        title: `SLO Breach: ${alert.metric}`,
        description: `${alert.description}. Current value: ${alert.value}, Threshold: ${alert.threshold}`,
        status: 'investigating',
        severity: 'critical',
        startedAt: new Date(),
        affectedServices: this.getAffectedServicesForMetric(alert.metric)
      });
    }
  }

  /**
   * Get affected services for a metric
   */
  private getAffectedServicesForMetric(metric: string): string[] {
    switch (metric) {
      case 'playbackP95JoinTime':
      case 'rebufferRatio':
        return ['video_streaming', 'cdn'];
      case 'checkoutSuccessRate':
        return ['payment_processing'];
      case 'payoutP95Latency':
        return ['payment_processing', 'blockchain'];
      case 'errorRate':
        return ['api'];
      default:
        return ['api'];
    }
  }

  /**
   * Get default metrics when none exist
   */
  private getDefaultMetrics(): RealtimeMetrics {
    return {
      timestamp: new Date(),
      playbackP95JoinTime: 1500, // 1.5 seconds
      rebufferRatio: 0.8, // 0.8%
      payoutP95Latency: 18, // 18 hours
      checkoutSuccessRate: 96.5, // 96.5%
      uptime: 99.97, // 99.97%
      activeUsers: 0,
      errorRate: 0.1, // 0.1%
      aiTaggingAccuracy: 96.2, // 96.2%
      leakDetectionRate: 88.5 // 88.5%
    };
  }
}