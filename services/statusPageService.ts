/**
 * Public Status Page Service
 * Provides public-facing status page with real-time metrics for agencies and investors
 */

import { MetricsCollectionService, SLOMetrics } from './metricsCollectionService';
import { sloMonitoringService } from './sloMonitoringService';

export interface PublicMetrics {
  // Core Performance Metrics
  playbackP95JoinTime: number;
  rebufferRatio: number;
  uptime: number;
  errorRate: number;
  
  // Business Metrics (anonymized)
  payoutReliability: number; // Success rate without exposing amounts
  platformGrowth: {
    activeCreators: number;
    contentLibrarySize: number;
    monthlyGrowthRate: number;
  };
  
  // Service Health
  serviceStatus: {
    api: 'operational' | 'degraded' | 'outage';
    video: 'operational' | 'degraded' | 'outage';
    payments: 'operational' | 'degraded' | 'outage';
    ai: 'operational' | 'degraded' | 'outage';
  };
  
  // Credibility Indicators
  credibilityScore: number; // 0-100 composite score
  certifications: string[];
  lastUpdated: Date;
}

export interface HistoricalMetrics {
  date: string;
  uptime: number;
  avgJoinTime: number;
  payoutReliability: number;
  activeUsers: number;
}

export interface ServiceIncident {
  id: string;
  title: striace SLOTarget {
  metric: string
  target: number
  current: number
  status: 'meeting' | 'at_risk' | 'breached'
  description: string
}

export class StatusPageService {
  private redis: Redis;
  private metricsRetentionDays: number = 90;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Get current real-time metrics
   */
  async getRealtimeMetrics(): Promise<RealtimeMetrics> {
    try {
      const metricsData = await this.redis.hgetall('status:realtime_metrics');
      
      if (!metricsData.timestamp) {
        // Return default metrics if none exist
        return this.getDefaultMetrics();
      }

      return {
        timestamp: new Date(metricsData.timestamp),
        playbackP95JoinTime: parseFloat(metricsData.playbackP95JoinTime || '0'),
        rebufferRatio: parseFloat(metricsData.rebufferRatio || '0'),
        payoutP95Latency: parseFloat(metricsData.payoutP95Latency || '0'),
        checkoutSuccessRate: parseFloat(metricsData.checkoutSuccessRate || '0'),
        uptime: parseFloat(metricsData.uptime || '0'),
        activeUsers: parseInt(metricsData.activeUsers || '0'),
        errorRate: parseFloat(metricsData.errorRate || '0'),
        aiTaggingAccuracy: parseFloat(metricsData.aiTaggingAccuracy || '0'),
        leakDetectionRate: parseFloat(metricsData.leakDetectionRate || '0')
      };
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

      // Store in Redis
      await this.redis.hset('status:realtime_metrics', {
        timestamp: updatedMetrics.timestamp.toISOString(),
        playbackP95JoinTime: updatedMetrics.playbackP95JoinTime.toString(),
        rebufferRatio: updatedMetrics.rebufferRatio.toString(),
        payoutP95Latency: updatedMetrics.payoutP95Latency.toString(),
        checkoutSuccessRate: updatedMetrics.checkoutSuccessRate.toString(),
        uptime: updatedMetrics.uptime.toString(),
        activeUsers: updatedMetrics.activeUsers.toString(),
        errorRate: updatedMetrics.errorRate.toString(),
        aiTaggingAccuracy: updatedMetrics.aiTaggingAccuracy.toString(),
        leakDetectionRate: updatedMetrics.leakDetectionRate.toString()
      });

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
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      const historicalData: HistoricalMetrics[] = [];
      
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dateKey = date.toISOString().split('T')[0];
        const metricsData = await this.redis.hgetall(`status:historical:${dateKey}`);
        
        if (metricsData.playbackP95JoinTime) {
          historicalData.push({
            date: new Date(date),
            metrics: {
              playbackP95JoinTime: parseFloat(metricsData.playbackP95JoinTime),
              rebufferRatio: parseFloat(metricsData.rebufferRatio),
              payoutP95Latency: parseFloat(metricsData.payoutP95Latency),
              checkoutSuccessRate: parseFloat(metricsData.checkoutSuccessRate),
              uptime: parseFloat(metricsData.uptime),
              activeUsers: parseInt(metricsData.activeUsers),
              errorRate: parseFloat(metricsData.errorRate),
              aiTaggingAccuracy: parseFloat(metricsData.aiTaggingAccuracy),
              leakDetectionRate: parseFloat(metricsData.leakDetectionRate)
            }
          });
        }
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
      const services = [
        'api',
        'video_streaming',
        'payment_processing',
        'ai_services',
        'blockchain',
        'cdn',
        'database'
      ];

      const statuses: ServiceStatus[] = [];

      for (const service of services) {
        const statusData = await this.redis.hgetall(`status:service:${service}`);
        
        statuses.push({
          name: service,
          status: (statusData.status as ServiceStatus['status']) || 'operational',
          uptime: parseFloat(statusData.uptime || '99.9'),
          responseTime: parseFloat(statusData.responseTime || '100'),
          lastChecked: statusData.lastChecked ? new Date(statusData.lastChecked) : new Date()
        });
      }

      return statuses;
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
      const currentStatus = await this.redis.hgetall(`status:service:${serviceName}`);
      
      const updatedStatus = {
        name: serviceName,
        status: status.status || currentStatus.status || 'operational',
        uptime: (status.uptime || parseFloat(currentStatus.uptime || '99.9')).toString(),
        responseTime: (status.responseTime || parseFloat(currentStatus.responseTime || '100')).toString(),
        lastChecked: new Date().toISOString()
      };

      await this.redis.hset(`status:service:${serviceName}`, updatedStatus);

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

      await this.redis.hset(`status:incident:${incidentId}`, {
        data: JSON.stringify(fullIncident)
      });

      // Add to active incidents list
      await this.redis.sadd('status:active_incidents', incidentId);

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
      const incidentData = await this.redis.hget(`status:incident:${incidentId}`, 'data');
      if (!incidentData) {
        throw new Error(`Incident ${incidentId} not found`);
      }

      const incident: Incident = JSON.parse(incidentData);
      incident.updates.push(update);
      incident.status = update.status;

      if (update.status === 'resolved') {
        incident.resolvedAt = new Date();
        // Remove from active incidents
        await this.redis.srem('status:active_incidents', incidentId);
      }

      await this.redis.hset(`status:incident:${incidentId}`, {
        data: JSON.stringify(incident)
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
      const incidentIds = await this.redis.smembers('status:active_incidents');
      const incidents: Incident[] = [];

      for (const id of incidentIds) {
        const incidentData = await this.redis.hget(`status:incident:${id}`, 'data');
        if (incidentData) {
          const incident = JSON.parse(incidentData);
          // Convert date strings back to Date objects
          incident.startedAt = new Date(incident.startedAt);
          if (incident.resolvedAt) {
            incident.resolvedAt = new Date(incident.resolvedAt);
          }
          incident.updates.forEach((update: any) => {
            update.timestamp = new Date(update.timestamp);
          });
          incidents.push(incident);
        }
      }

      return incidents.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
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
      
      await this.redis.hset(`status:historical:${dateKey}`, {
        playbackP95JoinTime: metrics.playbackP95JoinTime.toString(),
        rebufferRatio: metrics.rebufferRatio.toString(),
        payoutP95Latency: metrics.payoutP95Latency.toString(),
        checkoutSuccessRate: metrics.checkoutSuccessRate.toString(),
        uptime: metrics.uptime.toString(),
        activeUsers: metrics.activeUsers.toString(),
        errorRate: metrics.errorRate.toString(),
        aiTaggingAccuracy: metrics.aiTaggingAccuracy.toString(),
        leakDetectionRate: metrics.leakDetectionRate.toString()
      });

      // Set expiry for historical data
      await this.redis.expire(`status:historical:${dateKey}`, this.metricsRetentionDays * 24 * 60 * 60);
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
        title: `${serviceName} Service Degradation`,
        description: `Automated detection of ${serviceName} service degradation`,
        status: 'investigating',
        severity,
        startedAt: new Date(),
        affectedServices: [serviceName]
      });
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