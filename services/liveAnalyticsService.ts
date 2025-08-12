import { EventEmitter } from 'events';

// Analytics interfaces
export interface LiveAnalytics {
  streamId: string;
  startTime: Date;
  endTime?: Date;
  metrics: RealTimeMetrics;
  performance: PerformanceMetrics;
  audience: AudienceMetrics;
  engagement: EngagementMetrics;
  monetization: MonetizationMetrics;
  technical: TechnicalMetrics;
}

export interface RealTimeMetrics {
  currentViewers: number;
  peakViewers: number;
  totalViews: number;
  averageViewDuration: number;
  chatMessagesPerMinute: number;
  likesPerMinute: number;
  sharesPerMinute: number;
  newFollowers: number;
  newSubscribers: number;
}

export interface PerformanceMetrics {
  streamUptime: number;
  averageBitrate: number;
  qualityScore: number;
  bufferingEvents: number;
  connectionDrops: number;
  latency: number;
  frameDrops: number;
  audioQuality: number;
}

export interface AudienceMetrics {
  demographics: AudienceDemographics;
  geography: GeographicData[];
  devices: DeviceData[];
  platforms: PlatformData[];
  newVsReturning: {
    new: number;
    returning: number;
  };
  retentionCurve: RetentionPoint[];
}

export interface AudienceDemographics {
  ageGroups: { [key: string]: number };
  genderDistribution: { [key: string]: number };
  interests: { [key: string]: number };
}

export interface GeographicData {
  country: string;
  viewers: number;
  percentage: number;
}

export interface DeviceData {
  type: 'desktop' | 'mobile' | 'tablet' | 'tv';
  viewers: number;
  percentage: number;
}

export interface PlatformData {
  platform: string;
  viewers: number;
  percentage: number;
}

export interface RetentionPoint {
  timestamp: number;
  viewersRemaining: number;
  percentage: number;
}

export interface EngagementMetrics {
  totalChatMessages: number;
  uniqueChatters: number;
  averageMessagesPerUser: number;
  totalLikes: number;
  totalShares: number;
  totalComments: number;
  engagementRate: number;
  interactionPeaks: InteractionPeak[];
}

export interface InteractionPeak {
  timestamp: Date;
  type: 'chat' | 'likes' | 'shares' | 'donations';
  value: number;
  context?: string;
}

export interface MonetizationMetrics {
  totalRevenue: number;
  donations: DonationMetrics;
  superChats: SuperChatMetrics;
  subscriptions: SubscriptionMetrics;
  tips: TipMetrics;
  revenuePerViewer: number;
  conversionRate: number;
}

export interface DonationMetrics {
  total: number;
  count: number;
  average: number;
  largest: number;
  currency: string;
}

export interface SuperChatMetrics {
  total: number;
  count: number;
  average: number;
  topMessages: SuperChatMessage[];
}

export interface SuperChatMessage {
  amount: number;
  message: string;
  username: string;
  timestamp: Date;
}

export interface SubscriptionMetrics {
  newSubscriptions: number;
  totalRevenue: number;
  averageTier: number;
  conversionRate: number;
}

export interface TipMetrics {
  total: number;
  count: number;
  average: number;
  topTippers: TopTipper[];
}

export interface TopTipper {
  username: string;
  amount: number;
  count: number;
}

export interface TechnicalMetrics {
  bandwidth: BandwidthMetrics;
  quality: QualityMetrics;
  errors: ErrorMetrics;
  server: ServerMetrics;
}

export interface BandwidthMetrics {
  upload: number;
  download: number;
  peak: number;
  average: number;
}

export interface QualityMetrics {
  resolution: string;
  framerate: number;
  bitrate: number;
  audioQuality: number;
  stabilityScore: number;
}

export interface ErrorMetrics {
  connectionErrors: number;
  encodingErrors: number;
  networkErrors: number;
  totalErrors: number;
}

export interface ServerMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  serverLoad: number;
}

class LiveAnalyticsService extends EventEmitter {
  private analytics: Map<string, LiveAnalytics> = new Map();
  private metricsCollectors: Map<string, NodeJS.Timeout> = new Map();
  private isCollecting = false;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('streamStarted', (streamId: string) => {
      this.initializeAnalytics(streamId);
    });

    this.on('streamEnded', (streamId: string) => {
      this.finalizeAnalytics(streamId);
    });

    this.on('viewerJoined', (streamId: string, viewerId: string) => {
      this.updateViewerMetrics(streamId, 'join', viewerId);
    });

    this.on('viewerLeft', (streamId: string, viewerId: string) => {
      this.updateViewerMetrics(streamId, 'leave', viewerId);
    });
  }

  initializeAnalytics(streamId: string): void {
    const analytics: LiveAnalytics = {
      streamId,
      startTime: new Date(),
      metrics: {
        currentViewers: 0,
        peakViewers: 0,
        totalViews: 0,
        averageViewDuration: 0,
        chatMessagesPerMinute: 0,
        likesPerMinute: 0,
        sharesPerMinute: 0,
        newFollowers: 0,
        newSubscribers: 0
      },
      performance: {
        streamUptime: 0,
        averageBitrate: 0,
        qualityScore: 100,
        bufferingEvents: 0,
        connectionDrops: 0,
        latency: 0,
        frameDrops: 0,
        audioQuality: 100
      },
      audience: {
        demographics: {
          ageGroups: {},
          genderDistribution: {},
          interests: {}
        },
        geography: [],
        devices: [],
        platforms: [],
        newVsReturning: { new: 0, returning: 0 },
        retentionCurve: []
      },
      engagement: {
        totalChatMessages: 0,
        uniqueChatters: 0,
        averageMessagesPerUser: 0,
        totalLikes: 0,
        totalShares: 0,
        totalComments: 0,
        engagementRate: 0,
        interactionPeaks: []
      },
      monetization: {
        totalRevenue: 0,
        donations: { total: 0, count: 0, average: 0, largest: 0, currency: 'USD' },
        superChats: { total: 0, count: 0, average: 0, topMessages: [] },
        subscriptions: { newSubscriptions: 0, totalRevenue: 0, averageTier: 0, conversionRate: 0 },
        tips: { total: 0, count: 0, average: 0, topTippers: [] },
        revenuePerViewer: 0,
        conversionRate: 0
      },
      technical: {
        bandwidth: { upload: 0, download: 0, peak: 0, average: 0 },
        quality: { resolution: '720p', framerate: 30, bitrate: 0, audioQuality: 100, stabilityScore: 100 },
        errors: { connectionErrors: 0, encodingErrors: 0, networkErrors: 0, totalErrors: 0 },
        server: { cpuUsage: 0, memoryUsage: 0, networkLatency: 0, serverLoad: 0 }
      }
    };

    this.analytics.set(streamId, analytics);
    this.startMetricsCollection(streamId);
  }

  private startMetricsCollection(streamId: string): void {
    const interval = setInterval(() => {
      this.collectRealTimeMetrics(streamId);
    }, 1000); // Collect every second

    this.metricsCollectors.set(streamId, interval);
    this.isCollecting = true;
  }

  private async collectRealTimeMetrics(streamId: string): Promise<void> {
    const analytics = this.analytics.get(streamId);
    if (!analytics) return;

    try {
      // Update uptime
      analytics.performance.streamUptime = Date.now() - analytics.startTime.getTime();

      // Collect technical metrics
      await this.collectTechnicalMetrics(streamId);

      // Update retention curve
      this.updateRetentionCurve(streamId);

      // Calculate engagement rate
      this.calculateEngagementRate(streamId);

      // Update monetization metrics
      this.updateMonetizationMetrics(streamId);

      // Emit real-time update
      this.emit('metricsUpdate', streamId, analytics);

    } catch (error) {
      console.error('Failed to collect metrics:', error);
      this.recordError(streamId, 'collection');
    }
  }

  private async collectTechnicalMetrics(streamId: string): Promise<void> {
    const analytics = this.analytics.get(streamId);
    if (!analytics) return;

    // Simulate technical metrics collection
    // In real implementation, this would interface with WebRTC stats
    analytics.technical.bandwidth.upload = Math.random() * 5000 + 2000; // 2-7 Mbps
    analytics.technical.bandwidth.average = analytics.technical.bandwidth.upload * 0.8;
    analytics.technical.quality.bitrate = analytics.technical.bandwidth.upload;
    analytics.technical.server.cpuUsage = Math.random() * 30 + 20; // 20-50%
    analytics.technical.server.memoryUsage = Math.random() * 40 + 30; // 30-70%
    analytics.technical.server.networkLatency = Math.random() * 50 + 10; // 10-60ms
  }

  private updateViewerMetrics(streamId: string, action: 'join' | 'leave', viewerId: string): void {
    const analytics = this.analytics.get(streamId);
    if (!analytics) return;

    if (action === 'join') {
      analytics.metrics.currentViewers++;
      analytics.metrics.totalViews++;
      
      if (analytics.metrics.currentViewers > analytics.metrics.peakViewers) {
        analytics.metrics.peakViewers = analytics.metrics.currentViewers;
      }
    } else {
      analytics.metrics.currentViewers = Math.max(0, analytics.metrics.currentViewers - 1);
    }

    this.emit('viewerMetricsUpdate', streamId, analytics.metrics);
  }

  private updateRetentionCurve(streamId: string): void {
    const analytics = this.analytics.get(streamId);
    if (!analytics) return;

    const timestamp = Date.now() - analytics.startTime.getTime();
    const viewersRemaining = analytics.metrics.currentViewers;
    const percentage = analytics.metrics.totalViews > 0 
      ? (viewersRemaining / analytics.metrics.totalViews) * 100 
      : 0;

    analytics.audience.retentionCurve.push({
      timestamp,
      viewersRemaining,
      percentage
    });

    // Keep only last 1000 points for performance
    if (analytics.audience.retentionCurve.length > 1000) {
      analytics.audience.retentionCurve = analytics.audience.retentionCurve.slice(-1000);
    }
  }

  private calculateEngagementRate(streamId: string): void {
    const analytics = this.analytics.get(streamId);
    if (!analytics) return;

    const totalInteractions = analytics.engagement.totalChatMessages + 
                            analytics.engagement.totalLikes + 
                            analytics.engagement.totalShares;
    
    analytics.engagement.engagementRate = analytics.metrics.totalViews > 0 
      ? (totalInteractions / analytics.metrics.totalViews) * 100 
      : 0;
  }

  private updateMonetizationMetrics(streamId: string): void {
    const analytics = this.analytics.get(streamId);
    if (!analytics) return;

    // Calculate revenue per viewer
    analytics.monetization.revenuePerViewer = analytics.metrics.totalViews > 0 
      ? analytics.monetization.totalRevenue / analytics.metrics.totalViews 
      : 0;

    // Calculate conversion rate (users who made any payment)
    const totalPayments = analytics.monetization.donations.count + 
                         analytics.monetization.superChats.count + 
                         analytics.monetization.subscriptions.newSubscriptions + 
                         analytics.monetization.tips.count;
    
    analytics.monetization.conversionRate = analytics.metrics.totalViews > 0 
      ? (totalPayments / analytics.metrics.totalViews) * 100 
      : 0;
  }

  // Public methods for recording events
  recordChatMessage(streamId: string, userId: string, message: string): void {
    const analytics = this.analytics.get(streamId);
    if (!analytics) return;

    analytics.engagement.totalChatMessages++;
    
    // Update messages per minute
    const minutesElapsed = (Date.now() - analytics.startTime.getTime()) / 60000;
    analytics.metrics.chatMessagesPerMinute = minutesElapsed > 0 
      ? analytics.engagement.totalChatMessages / minutesElapsed 
      : 0;
  }

  recordLike(streamId: string, userId: string): void {
    const analytics = this.analytics.get(streamId);
    if (!analytics) return;

    analytics.engagement.totalLikes++;
    
    const minutesElapsed = (Date.now() - analytics.startTime.getTime()) / 60000;
    analytics.metrics.likesPerMinute = minutesElapsed > 0 
      ? analytics.engagement.totalLikes / minutesElapsed 
      : 0;
  }

  recordShare(streamId: string, userId: string): void {
    const analytics = this.analytics.get(streamId);
    if (!analytics) return;

    analytics.engagement.totalShares++;
    
    const minutesElapsed = (Date.now() - analytics.startTime.getTime()) / 60000;
    analytics.metrics.sharesPerMinute = minutesElapsed > 0 
      ? analytics.engagement.totalShares / minutesElapsed 
      : 0;
  }

  recordDonation(streamId: string, userId: string, amount: number, currency: string): void {
    const analytics = this.analytics.get(streamId);
    if (!analytics) return;

    analytics.monetization.donations.total += amount;
    analytics.monetization.donations.count++;
    analytics.monetization.donations.average = analytics.monetization.donations.total / analytics.monetization.donations.count;
    
    if (amount > analytics.monetization.donations.largest) {
      analytics.monetization.donations.largest = amount;
    }

    analytics.monetization.totalRevenue += amount;
  }

  recordSuperChat(streamId: string, userId: string, username: string, amount: number, message: string): void {
    const analytics = this.analytics.get(streamId);
    if (!analytics) return;

    analytics.monetization.superChats.total += amount;
    analytics.monetization.superChats.count++;
    analytics.monetization.superChats.average = analytics.monetization.superChats.total / analytics.monetization.superChats.count;
    
    analytics.monetization.superChats.topMessages.push({
      amount,
      message,
      username,
      timestamp: new Date()
    });

    // Keep only top 10 super chats
    analytics.monetization.superChats.topMessages.sort((a, b) => b.amount - a.amount);
    analytics.monetization.superChats.topMessages = analytics.monetization.superChats.topMessages.slice(0, 10);

    analytics.monetization.totalRevenue += amount;
  }

  recordSubscription(streamId: string, userId: string, tier: number, amount: number): void {
    const analytics = this.analytics.get(streamId);
    if (!analytics) return;

    analytics.monetization.subscriptions.newSubscriptions++;
    analytics.monetization.subscriptions.totalRevenue += amount;
    analytics.monetization.totalRevenue += amount;
    analytics.metrics.newSubscribers++;
  }

  recordError(streamId: string, type: 'connection' | 'encoding' | 'network' | 'collection'): void {
    const analytics = this.analytics.get(streamId);
    if (!analytics) return;

    switch (type) {
      case 'connection':
        analytics.technical.errors.connectionErrors++;
        break;
      case 'encoding':
        analytics.technical.errors.encodingErrors++;
        break;
      case 'network':
        analytics.technical.errors.networkErrors++;
        break;
    }

    analytics.technical.errors.totalErrors++;
  }

  private finalizeAnalytics(streamId: string): void {
    const analytics = this.analytics.get(streamId);
    if (!analytics) return;

    analytics.endTime = new Date();
    
    // Stop metrics collection
    const collector = this.metricsCollectors.get(streamId);
    if (collector) {
      clearInterval(collector);
      this.metricsCollectors.delete(streamId);
    }

    // Calculate final metrics
    const durationMinutes = (analytics.endTime.getTime() - analytics.startTime.getTime()) / 60000;
    analytics.metrics.averageViewDuration = analytics.metrics.totalViews > 0 
      ? durationMinutes / analytics.metrics.totalViews 
      : 0;

    this.emit('analyticsFinalized', streamId, analytics);
  }

  // Public getters
  getAnalytics(streamId: string): LiveAnalytics | undefined {
    return this.analytics.get(streamId);
  }

  getRealTimeMetrics(streamId: string): RealTimeMetrics | undefined {
    const analytics = this.analytics.get(streamId);
    return analytics?.metrics;
  }

  getPerformanceMetrics(streamId: string): PerformanceMetrics | undefined {
    const analytics = this.analytics.get(streamId);
    return analytics?.performance;
  }

  getEngagementMetrics(streamId: string): EngagementMetrics | undefined {
    const analytics = this.analytics.get(streamId);
    return analytics?.engagement;
  }

  getMonetizationMetrics(streamId: string): MonetizationMetrics | undefined {
    const analytics = this.analytics.get(streamId);
    return analytics?.monetization;
  }

  // Export analytics data
  exportAnalytics(streamId: string): string {
    const analytics = this.analytics.get(streamId);
    if (!analytics) {
      throw new Error('Analytics not found for stream');
    }

    return JSON.stringify(analytics, null, 2);
  }

  // Clear old analytics data
  clearAnalytics(streamId: string): void {
    this.analytics.delete(streamId);
    
    const collector = this.metricsCollectors.get(streamId);
    if (collector) {
      clearInterval(collector);
      this.metricsCollectors.delete(streamId);
    }
  }
}

export default new LiveAnalyticsService();