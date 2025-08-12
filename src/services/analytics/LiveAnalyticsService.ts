import { EventEmitter } from 'events';
import { StreamMetrics } from '../webrtc/WebRTCService';

export interface LiveMetrics {
  timestamp: Date;
  viewerCount: number;
  chatActivity: number;
  streamHealth: {
    bitrate: number;
    frameRate: number;
    latency: number;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
  };
  engagement: {
    likes: number;
    shares: number;
    superChats: number;
    newFollowers: number;
    newSubscribers: number;
  };
  revenue: {
    superChatAmount: number;
    donationAmount: number;
    subscriptionRevenue: number;
  };
}

export interface AnalyticsEvent {
  type: 'viewer_join' | 'viewer_leave' | 'chat_message' | 'super_chat' | 'donation' | 'subscription' | 'like' | 'share';
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface StreamPerformance {
  averageViewers: number;
  peakViewers: number;
  totalViews: number;
  watchTime: number;
  chatMessages: number;
  engagement: {
    likesPerMinute: number;
    sharesPerMinute: number;
    chatMessagesPerMinute: number;
  };
  revenue: {
    total: number;
    superChat: number;
    donations: number;
    subscriptions: number;
  };
  streamHealth: {
    averageBitrate: number;
    averageLatency: number;
    qualityScore: number;
    uptime: number;
  };
}

export interface AudienceInsights {
  demographics: {
    countries: Record<string, number>;
    devices: Record<string, number>;
    browsers: Record<string, number>;
  };
  behavior: {
    averageWatchTime: number;
    dropOffPoints: number[];
    peakEngagementTime: Date;
    returnViewers: number;
  };
  growth: {
    newFollowers: number;
    newSubscribers: number;
    conversionRate: number;
  };
}

export class LiveAnalyticsService extends EventEmitter {
  private metrics: LiveMetrics[] = [];
  private events: AnalyticsEvent[] = [];
  private currentMetrics: LiveMetrics;
  private metricsInterval: NodeJS.Timeout | null = null;
  private streamStartTime: Date | null = null;
  private isTracking = false;

  constructor() {
    super();
    this.currentMetrics = this.initializeMetrics();
  }

  private initializeMetrics(): LiveMetrics {
    return {
      timestamp: new Date(),
      viewerCount: 0,
      chatActivity: 0,
      streamHealth: {
        bitrate: 0,
        frameRate: 0,
        latency: 0,
        quality: 'poor'
      },
      engagement: {
        likes: 0,
        shares: 0,
        superChats: 0,
        newFollowers: 0,
        newSubscribers: 0
      },
      revenue: {
        superChatAmount: 0,
        donationAmount: 0,
        subscriptionRevenue: 0
      }
    };
  }

  startTracking(streamId: string): void {
    this.streamStartTime = new Date();
    this.isTracking = true;
    this.metrics = [];
    this.events = [];
    this.currentMetrics = this.initializeMetrics();

    // Start collecting metrics every 10 seconds
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 10000);

    this.emit('trackingStarted', { streamId, startTime: this.streamStartTime });
  }

  stopTracking(): StreamPerformance {
    this.isTracking = false;
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    const performance = this.calculateStreamPerformance();
    this.emit('trackingStopped', performance);
    
    return performance;
  }

  recordEvent(event: AnalyticsEvent): void {
    if (!this.isTracking) return;

    this.events.push(event);
    this.updateMetricsFromEvent(event);
    this.emit('eventRecorded', event);
  }

  updateStreamMetrics(streamMetrics: StreamMetrics): void {
    if (!this.isTracking) return;

    this.currentMetrics.streamHealth = {
      bitrate: streamMetrics.bitrate,
      frameRate: streamMetrics.frameRate,
      latency: streamMetrics.latency,
      quality: this.calculateQuality(streamMetrics)
    };
  }

  updateViewerCount(count: number): void {
    if (!this.isTracking) return;

    this.currentMetrics.viewerCount = count;
    this.emit('viewerCountUpdated', count);
  }

  recordSuperChat(amount: number, currency: string = 'USD'): void {
    this.recordEvent({
      type: 'super_chat',
      timestamp: new Date(),
      metadata: { amount, currency }
    });
  }

  recordDonation(amount: number, currency: string = 'USD'): void {
    this.recordEvent({
      type: 'donation',
      timestamp: new Date(),
      metadata: { amount, currency }
    });
  }

  recordSubscription(tier: string, amount: number): void {
    this.recordEvent({
      type: 'subscription',
      timestamp: new Date(),
      metadata: { tier, amount }
    });
  }

  recordEngagement(type: 'like' | 'share', userId?: string): void {
    this.recordEvent({
      type,
      timestamp: new Date(),
      userId,
      metadata: {}
    });
  }

  getCurrentMetrics(): LiveMetrics {
    return { ...this.currentMetrics };
  }

  getMetricsHistory(): LiveMetrics[] {
    return [...this.metrics];
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  getAudienceInsights(): AudienceInsights {
    const viewerJoinEvents = this.events.filter(e => e.type === 'viewer_join');
    const viewerLeaveEvents = this.events.filter(e => e.type === 'viewer_leave');
    const chatEvents = this.events.filter(e => e.type === 'chat_message');

    // Calculate demographics (mock data for now)
    const demographics = {
      countries: { 'US': 45, 'UK': 20, 'CA': 15, 'AU': 10, 'DE': 10 },
      devices: { 'Desktop': 60, 'Mobile': 35, 'Tablet': 5 },
      browsers: { 'Chrome': 70, 'Firefox': 15, 'Safari': 10, 'Edge': 5 }
    };

    // Calculate behavior metrics
    const totalWatchTime = this.calculateTotalWatchTime();
    const uniqueViewers = new Set(viewerJoinEvents.map(e => e.userId)).size;
    const averageWatchTime = uniqueViewers > 0 ? totalWatchTime / uniqueViewers : 0;

    // Find peak engagement time
    const engagementByTime = this.calculateEngagementByTime();
    const peakEngagementTime = this.findPeakEngagementTime(engagementByTime);

    // Calculate return viewers
    const returnViewers = this.calculateReturnViewers();

    // Calculate growth metrics
    const newFollowers = this.events.filter(e => e.type === 'viewer_join' && e.metadata?.isNewFollower).length;
    const newSubscribers = this.events.filter(e => e.type === 'subscription').length;
    const conversionRate = uniqueViewers > 0 ? (newSubscribers / uniqueViewers) * 100 : 0;

    return {
      demographics,
      behavior: {
        averageWatchTime,
        dropOffPoints: this.calculateDropOffPoints(),
        peakEngagementTime,
        returnViewers
      },
      growth: {
        newFollowers,
        newSubscribers,
        conversionRate
      }
    };
  }

  private collectMetrics(): void {
    if (!this.isTracking) return;

    // Update chat activity (messages in last minute)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    this.currentMetrics.chatActivity = this.events.filter(
      e => e.type === 'chat_message' && e.timestamp > oneMinuteAgo
    ).length;

    // Update timestamp
    this.currentMetrics.timestamp = new Date();

    // Store metrics snapshot
    this.metrics.push({ ...this.currentMetrics });

    this.emit('metricsCollected', this.currentMetrics);
  }

  private updateMetricsFromEvent(event: AnalyticsEvent): void {
    switch (event.type) {
      case 'super_chat':
        this.currentMetrics.engagement.superChats++;
        this.currentMetrics.revenue.superChatAmount += event.metadata?.amount || 0;
        break;
      
      case 'donation':
        this.currentMetrics.revenue.donationAmount += event.metadata?.amount || 0;
        break;
      
      case 'subscription':
        this.currentMetrics.engagement.newSubscribers++;
        this.currentMetrics.revenue.subscriptionRevenue += event.metadata?.amount || 0;
        break;
      
      case 'like':
        this.currentMetrics.engagement.likes++;
        break;
      
      case 'share':
        this.currentMetrics.engagement.shares++;
        break;
      
      case 'viewer_join':
        if (event.metadata?.isNewFollower) {
          this.currentMetrics.engagement.newFollowers++;
        }
        break;
    }
  }

  private calculateQuality(metrics: StreamMetrics): 'excellent' | 'good' | 'fair' | 'poor' {
    const { bitrate, frameRate, latency } = metrics;
    
    let score = 0;
    
    // Bitrate scoring (0-40 points)
    if (bitrate >= 5000) score += 40;
    else if (bitrate >= 3000) score += 30;
    else if (bitrate >= 1500) score += 20;
    else if (bitrate >= 800) score += 10;
    
    // Frame rate scoring (0-30 points)
    if (frameRate >= 60) score += 30;
    else if (frameRate >= 30) score += 25;
    else if (frameRate >= 24) score += 15;
    else if (frameRate >= 15) score += 5;
    
    // Latency scoring (0-30 points)
    if (latency <= 100) score += 30;
    else if (latency <= 200) score += 25;
    else if (latency <= 500) score += 15;
    else if (latency <= 1000) score += 5;
    
    if (score >= 85) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  private calculateStreamPerformance(): StreamPerformance {
    const viewerCounts = this.metrics.map(m => m.viewerCount);
    const averageViewers = viewerCounts.length > 0 ? 
      viewerCounts.reduce((sum, count) => sum + count, 0) / viewerCounts.length : 0;
    const peakViewers = Math.max(...viewerCounts, 0);
    
    const totalViews = this.events.filter(e => e.type === 'viewer_join').length;
    const watchTime = this.calculateTotalWatchTime();
    const chatMessages = this.events.filter(e => e.type === 'chat_message').length;
    
    const streamDuration = this.streamStartTime ? 
      (Date.now() - this.streamStartTime.getTime()) / 60000 : 1; // minutes
    
    const engagement = {
      likesPerMinute: this.currentMetrics.engagement.likes / streamDuration,
      sharesPerMinute: this.currentMetrics.engagement.shares / streamDuration,
      chatMessagesPerMinute: chatMessages / streamDuration
    };
    
    const revenue = {
      total: this.currentMetrics.revenue.superChatAmount + 
             this.currentMetrics.revenue.donationAmount + 
             this.currentMetrics.revenue.subscriptionRevenue,
      superChat: this.currentMetrics.revenue.superChatAmount,
      donations: this.currentMetrics.revenue.donationAmount,
      subscriptions: this.currentMetrics.revenue.subscriptionRevenue
    };
    
    const bitrateValues = this.metrics.map(m => m.streamHealth.bitrate).filter(b => b > 0);
    const latencyValues = this.metrics.map(m => m.streamHealth.latency).filter(l => l > 0);
    
    const streamHealth = {
      averageBitrate: bitrateValues.length > 0 ? 
        bitrateValues.reduce((sum, b) => sum + b, 0) / bitrateValues.length : 0,
      averageLatency: latencyValues.length > 0 ? 
        latencyValues.reduce((sum, l) => sum + l, 0) / latencyValues.length : 0,
      qualityScore: this.calculateAverageQualityScore(),
      uptime: 99.9 // Mock uptime percentage
    };
    
    return {
      averageViewers,
      peakViewers,
      totalViews,
      watchTime,
      chatMessages,
      engagement,
      revenue,
      streamHealth
    };
  }

  private calculateTotalWatchTime(): number {
    // Simplified calculation - in production, track individual viewer sessions
    const avgViewers = this.metrics.length > 0 ? 
      this.metrics.reduce((sum, m) => sum + m.viewerCount, 0) / this.metrics.length : 0;
    const streamDuration = this.streamStartTime ? 
      (Date.now() - this.streamStartTime.getTime()) / 60000 : 0; // minutes
    
    return avgViewers * streamDuration;
  }

  private calculateEngagementByTime(): Record<string, number> {
    const engagementByMinute: Record<string, number> = {};
    
    this.events.forEach(event => {
      if (['like', 'share', 'chat_message', 'super_chat'].includes(event.type)) {
        const minute = Math.floor(event.timestamp.getTime() / 60000) * 60000;
        const key = new Date(minute).toISOString();
        engagementByMinute[key] = (engagementByMinute[key] || 0) + 1;
      }
    });
    
    return engagementByMinute;
  }

  private findPeakEngagementTime(engagementByTime: Record<string, number>): Date {
    let maxEngagement = 0;
    let peakTime = new Date();
    
    Object.entries(engagementByTime).forEach(([time, engagement]) => {
      if (engagement > maxEngagement) {
        maxEngagement = engagement;
        peakTime = new Date(time);
      }
    });
    
    return peakTime;
  }

  private calculateReturnViewers(): number {
    // Mock calculation - in production, track user sessions across streams
    const uniqueViewers = new Set(this.events.filter(e => e.type === 'viewer_join').map(e => e.userId));
    return Math.floor(uniqueViewers.size * 0.3); // Assume 30% are return viewers
  }

  private calculateDropOffPoints(): number[] {
    // Mock drop-off points - in production, analyze viewer leave patterns
    return [15, 30, 45, 60]; // Minutes where viewers typically drop off
  }

  private calculateAverageQualityScore(): number {
    const qualityScores = this.metrics.map(m => {
      switch (m.streamHealth.quality) {
        case 'excellent': return 100;
        case 'good': return 75;
        case 'fair': return 50;
        case 'poor': return 25;
        default: return 0;
      }
    });
    
    return qualityScores.length > 0 ? 
      qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length : 0;
  }

  // Additional method for component integration
  getAnalytics(timeRange: '1h' | '6h' | '24h' | 'all') {
    const now = new Date();
    let startTime: Date;
    
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startTime = this.streamStartTime || new Date(0);
        break;
    }
    
    const filteredMetrics = this.metrics.filter(m => m.timestamp >= startTime);
    const filteredEvents = this.events.filter(e => e.timestamp >= startTime);
    
    // Generate mock viewer history for chart
    const viewerHistory = filteredMetrics.map((metric, index) => ({
      time: metric.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      viewers: metric.viewerCount
    }));
    
    return {
      metrics: filteredMetrics,
      events: filteredEvents,
      viewerHistory,
      summary: {
        totalViewers: Math.max(...filteredMetrics.map(m => m.viewerCount), 0),
        averageViewers: filteredMetrics.length > 0 ? 
          filteredMetrics.reduce((sum, m) => sum + m.viewerCount, 0) / filteredMetrics.length : 0,
        totalMessages: filteredEvents.filter(e => e.type === 'chat_message').length,
        totalRevenue: filteredEvents
          .filter(e => ['super_chat', 'donation', 'subscription'].includes(e.type))
          .reduce((sum, e) => sum + (e.metadata?.amount || 0), 0)
      }
    };
  }
}