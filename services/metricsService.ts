/**
 * Public Metrics and Platform Health Service
 * Handles real-time platform metrics, performance indicators, and credibility data
 */

export interface PlatformMetrics {
  timestamp: string;
  totalCreators: number;
  activeCreators: number;
  totalContent: number;
  totalViews: number;
  totalEarnings: number;
  averageEarningsPerCreator: number;
  contentUploadSuccessRate: number;
  playbackSuccessRate: number;
  averagePlaybackLatency: number;
  platformUptime: number;
  verifiedCreators: number;
  complianceScore: number;
}

export interface PerformanceMetrics {
  uploadMetrics: {
    successRate: number;
    averageUploadTime: number;
    p95UploadTime: number;
    failureReasons: Array<{ reason: string; count: number; percentage: number }>;
  };
  playbackMetrics: {
    successRate: number;
    averageStartTime: number;
    p95StartTime: number;
    bufferingRate: number;
    qualityDistribution: Array<{ quality: string; percentage: number }>;
  };
  systemMetrics: {
    uptime: number;
    responseTime: number;
    errorRate: number;
    throughput: number;
  };
}

export interface TrendingData {
  period: '24h' | '7d' | '30d' | '90d';
  metrics: Array<{
    timestamp: string;
    creators: number;
    content: number;
    views: number;
    earnings: number;
    uptime: number;
  }>;
}

export interface CredibilityIndicators {
  trustScore: number;
  verificationRate: number;
  complianceScore: number;
  transparencyScore: number;
  communityRating: number;
  indicators: Array<{
    category: 'security' | 'compliance' | 'performance' | 'transparency';
    name: string;
    value: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
    description: string;
  }>;
}

export interface ServiceStatus {
  service: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
  uptime: number;
  responseTime: number;
  lastIncident?: {
    date: string;
    description: string;
    duration: number;
    resolved: boolean;
  };
}

export interface PublicScoreboard {
  lastUpdated: string;
  platformMetrics: PlatformMetrics;
  performanceMetrics: PerformanceMetrics;
  credibilityIndicators: CredibilityIndicators;
  serviceStatus: ServiceStatus[];
  trendingData: TrendingData;
}

export class MetricsService {
  private static instance: MetricsService;
  private baseUrl: string;
  private metricsCache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 60000; // 1 minute cache

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  /**
   * Get public scoreboard data
   */
  async getPublicScoreboard(): Promise<PublicScoreboard> {
    try {
      const cacheKey = 'public_scoreboard';
      const cached = this.metricsCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // For demo purposes, return mock data
      const scoreboard: PublicScoreboard = {
        lastUpdated: new Date().toISOString(),
        platformMetrics: await this.getPlatformMetrics(),
        performanceMetrics: await this.getPerformanceMetrics(),
        credibilityIndicators: await this.getCredibilityIndicators(),
        serviceStatus: await this.getServiceStatus(),
        trendingData: await this.getTrendingData('30d')
      };

      this.metricsCache.set(cacheKey, { data: scoreboard, timestamp: Date.now() });
      return scoreboard;
    } catch (error) {
      console.error('Error getting public scoreboard:', error);
      throw new Error('Failed to load public scoreboard');
    }
  }

  /**
   * Get current platform metrics
   */
  async getPlatformMetrics(): Promise<PlatformMetrics> {
    try {
      // For demo purposes, return mock metrics
      const metrics: PlatformMetrics = {
        timestamp: new Date().toISOString(),
        totalCreators: 12847,
        activeCreators: 8932,
        totalContent: 156789,
        totalViews: 45678901,
        totalEarnings: 2847392.50,
        averageEarningsPerCreator: 318.75,
        contentUploadSuccessRate: 98.7,
        playbackSuccessRate: 99.2,
        averagePlaybackLatency: 1.2,
        platformUptime: 99.8,
        verifiedCreators: 11234,
        complianceScore: 96.5
      };

      return metrics;
    } catch (error) {
      console.error('Error getting platform metrics:', error);
      throw new Error('Failed to load platform metrics');
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      // For demo purposes, return mock performance data
      const metrics: PerformanceMetrics = {
        uploadMetrics: {
          successRate: 98.7,
          averageUploadTime: 45.2,
          p95UploadTime: 120.5,
          failureReasons: [
            { reason: 'Network timeout', count: 23, percentage: 45.1 },
            { reason: 'File format error', count: 15, percentage: 29.4 },
            { reason: 'Size limit exceeded', count: 8, percentage: 15.7 },
            { reason: 'Other', count: 5, percentage: 9.8 }
          ]
        },
        playbackMetrics: {
          successRate: 99.2,
          averageStartTime: 1.2,
          p95StartTime: 2.8,
          bufferingRate: 0.8,
          qualityDistribution: [
            { quality: '1080p', percentage: 45.2 },
            { quality: '720p', percentage: 32.1 },
            { quality: '480p', percentage: 18.7 },
            { quality: '360p', percentage: 4.0 }
          ]
        },
        systemMetrics: {
          uptime: 99.8,
          responseTime: 145,
          errorRate: 0.2,
          throughput: 15420
        }
      };

      return metrics;
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      throw new Error('Failed to load performance metrics');
    }
  }

  /**
   * Get credibility indicators
   */
  async getCredibilityIndicators(): Promise<CredibilityIndicators> {
    try {
      // For demo purposes, return mock credibility data
      const indicators: CredibilityIndicators = {
        trustScore: 94.2,
        verificationRate: 87.4,
        complianceScore: 96.5,
        transparencyScore: 92.1,
        communityRating: 4.6,
        indicators: [
          {
            category: 'security',
            name: 'Data Encryption',
            value: 100,
            status: 'excellent',
            description: 'All content encrypted with AES-256'
          },
          {
            category: 'security',
            name: 'Access Control',
            value: 98.5,
            status: 'excellent',
            description: 'Multi-factor authentication and blockchain verification'
          },
          {
            category: 'compliance',
            name: '2257 Compliance',
            value: 96.5,
            status: 'excellent',
            description: 'Age verification records maintained for all content'
          },
          {
            category: 'compliance',
            name: 'DMCA Response',
            value: 94.2,
            status: 'excellent',
            description: 'Average 2.3 hour response time to takedown requests'
          },
          {
            category: 'performance',
            name: 'Upload Success Rate',
            value: 98.7,
            status: 'excellent',
            description: 'High reliability content upload pipeline'
          },
          {
            category: 'performance',
            name: 'Playback Quality',
            value: 99.2,
            status: 'excellent',
            description: 'Consistent high-quality video delivery'
          },
          {
            category: 'transparency',
            name: 'Public Metrics',
            value: 95.0,
            status: 'excellent',
            description: 'Real-time platform statistics publicly available'
          },
          {
            category: 'transparency',
            name: 'Audit Trail',
            value: 89.3,
            status: 'good',
            description: 'Comprehensive logging of all platform actions'
          }
        ]
      };

      return indicators;
    } catch (error) {
      console.error('Error getting credibility indicators:', error);
      throw new Error('Failed to load credibility indicators');
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<ServiceStatus[]> {
    try {
      // For demo purposes, return mock service status
      const services: ServiceStatus[] = [
        {
          service: 'Content Upload',
          status: 'operational',
          uptime: 99.8,
          responseTime: 1.2
        },
        {
          service: 'Video Playback',
          status: 'operational',
          uptime: 99.9,
          responseTime: 0.8
        },
        {
          service: 'Payment Processing',
          status: 'operational',
          uptime: 99.7,
          responseTime: 2.1
        },
        {
          service: 'Age Verification',
          status: 'operational',
          uptime: 99.5,
          responseTime: 3.2
        },
        {
          service: 'Content Moderation',
          status: 'degraded',
          uptime: 98.2,
          responseTime: 5.8,
          lastIncident: {
            date: new Date(Date.now() - 7200000).toISOString(),
            description: 'Increased processing time due to high volume',
            duration: 45,
            resolved: false
          }
        },
        {
          service: 'API Gateway',
          status: 'operational',
          uptime: 99.9,
          responseTime: 0.3
        }
      ];

      return services;
    } catch (error) {
      console.error('Error getting service status:', error);
      throw new Error('Failed to load service status');
    }
  }

  /**
   * Get trending data
   */
  async getTrendingData(period: '24h' | '7d' | '30d' | '90d'): Promise<TrendingData> {
    try {
      // For demo purposes, generate mock trending data
      const now = Date.now();
      const intervals = {
        '24h': { count: 24, interval: 3600000 }, // hourly
        '7d': { count: 7, interval: 86400000 }, // daily
        '30d': { count: 30, interval: 86400000 }, // daily
        '90d': { count: 90, interval: 86400000 } // daily
      };

      const { count, interval } = intervals[period];
      const metrics = [];

      for (let i = count - 1; i >= 0; i--) {
        const timestamp = new Date(now - (i * interval)).toISOString();
        const baseCreators = 12000 + Math.floor(Math.random() * 1000);
        const baseContent = 150000 + Math.floor(Math.random() * 10000);
        
        metrics.push({
          timestamp,
          creators: baseCreators + Math.floor(Math.random() * 100),
          content: baseContent + Math.floor(Math.random() * 1000),
          views: 45000000 + Math.floor(Math.random() * 1000000),
          earnings: 2800000 + Math.floor(Math.random() * 100000),
          uptime: 99.0 + Math.random() * 1.0
        });
      }

      return {
        period,
        metrics
      };
    } catch (error) {
      console.error('Error getting trending data:', error);
      throw new Error('Failed to load trending data');
    }
  }

  /**
   * Get historical metrics
   */
  async getHistoricalMetrics(
    startDate: string,
    endDate: string,
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): Promise<PlatformMetrics[]> {
    try {
      // For demo purposes, generate mock historical data
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      const intervals = {
        hour: 3600000,
        day: 86400000,
        week: 604800000
      };

      const interval = intervals[granularity];
      const metrics: PlatformMetrics[] = [];

      for (let timestamp = start; timestamp <= end; timestamp += interval) {
        const baseMetrics = await this.getPlatformMetrics();
        metrics.push({
          ...baseMetrics,
          timestamp: new Date(timestamp).toISOString(),
          totalCreators: baseMetrics.totalCreators + Math.floor(Math.random() * 100 - 50),
          totalContent: baseMetrics.totalContent + Math.floor(Math.random() * 1000 - 500),
          totalViews: baseMetrics.totalViews + Math.floor(Math.random() * 100000 - 50000)
        });
      }

      return metrics;
    } catch (error) {
      console.error('Error getting historical metrics:', error);
      throw new Error('Failed to load historical metrics');
    }
  }

  /**
   * Export metrics data
   */
  async exportMetrics(
    format: 'json' | 'csv' | 'pdf',
    dateRange: { startDate: string; endDate: string }
  ): Promise<{ downloadUrl: string; filename: string }> {
    try {
      // For demo purposes, simulate export
      const filename = `platform_metrics_${dateRange.startDate}_${dateRange.endDate}.${format}`;
      const downloadUrl = `https://demo-cdn.example.com/exports/${filename}`;

      console.log(`Exporting metrics as ${format}:`, filename);
      
      return {
        downloadUrl,
        filename
      };
    } catch (error) {
      console.error('Error exporting metrics:', error);
      throw new Error('Failed to export metrics');
    }
  }

  /**
   * Subscribe to real-time metrics updates
   */
  subscribeToMetrics(callback: (metrics: PlatformMetrics) => void): () => void {
    // For demo purposes, simulate real-time updates
    const interval = setInterval(async () => {
      try {
        const metrics = await this.getPlatformMetrics();
        callback(metrics);
      } catch (error) {
        console.error('Error in metrics subscription:', error);
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }

  /**
   * Clear metrics cache
   */
  clearCache(): void {
    this.metricsCache.clear();
  }
}