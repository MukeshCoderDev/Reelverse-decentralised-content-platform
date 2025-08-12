import { EventEmitter } from 'events';
import { StreamingService, StreamSettings, StreamConfig, LiveStream } from './streaming/StreamingService';
import { LiveChatService, ChatMessage, ChatSettings } from './chat/LiveChatService';
import { LiveAnalyticsService, LiveMetrics, StreamPerformance } from './analytics/LiveAnalyticsService';
import { ModerationService, ModerationAction, AutoModerationConfig } from './moderation/ModerationService';
import { LiveMonetizationService, MonetizationEvent, RevenueMetrics } from './monetization/LiveMonetizationService';

export interface LiveStreamingState {
  isLive: boolean;
  stream: LiveStream | null;
  viewerCount: number;
  chatConnected: boolean;
  monetizationEnabled: boolean;
  moderationEnabled: boolean;
  analyticsTracking: boolean;
}

export interface StreamDashboard {
  stream: LiveStream | null;
  metrics: LiveMetrics;
  revenue: RevenueMetrics;
  chatStats: {
    messageCount: number;
    activeUsers: number;
    moderationActions: number;
  };
  performance: {
    bitrate: number;
    latency: number;
    quality: string;
    uptime: number;
  };
}

export class LiveStreamingOrchestrator extends EventEmitter {
  private streamingService: StreamingService;
  private chatService: LiveChatService;
  private analyticsService: LiveAnalyticsService;
  private moderationService: ModerationService;
  private monetizationService: LiveMonetizationService;
  
  private currentStreamId: string | null = null;
  private userId: string | null = null;
  private state: LiveStreamingState;

  constructor() {
    super();
    
    this.streamingService = new StreamingService();
    this.chatService = new LiveChatService();
    this.analyticsService = new LiveAnalyticsService();
    this.moderationService = new ModerationService();
    this.monetizationService = new LiveMonetizationService();
    
    this.state = {
      isLive: false,
      stream: null,
      viewerCount: 0,
      chatConnected: false,
      monetizationEnabled: false,
      moderationEnabled: true,
      analyticsTracking: false
    };

    this.setupEventHandlers();
  }

  async initializeStream(
    userId: string,
    settings: StreamSettings,
    config: StreamConfig
  ): Promise<LiveStream> {
    this.userId = userId;
    
    try {
      // Create the stream
      const stream = await this.streamingService.createStream(settings, config);
      this.currentStreamId = stream.id;
      this.state.stream = stream;
      
      // Initialize chat
      await this.chatService.connect(stream.id, userId);
      this.state.chatConnected = true;
      
      // Enable monetization if configured
      if (settings.monetization.enabled) {
        this.monetizationService.enableMonetization(stream.id);
        this.state.monetizationEnabled = true;
      }
      
      this.emit('streamInitialized', stream);
      return stream;
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  async startLiveStream(): Promise<void> {
    if (!this.currentStreamId || !this.userId) {
      throw new Error('Stream not initialized');
    }

    try {
      // Start the stream
      await this.streamingService.startLiveStream();
      this.state.isLive = true;
      
      // Start analytics tracking
      this.analyticsService.startTracking(this.currentStreamId);
      this.state.analyticsTracking = true;
      
      this.emit('streamStarted', this.state.stream);
    } catch (error) {
      this.emit('streamError', error);
      throw error;
    }
  }

  async stopLiveStream(): Promise<StreamPerformance> {
    if (!this.state.isLive) {
      throw new Error('No active stream');
    }

    try {
      // Stop the stream
      const archivedStream = await this.streamingService.stopLiveStream();
      this.state.isLive = false;
      this.state.stream = null;
      
      // Stop analytics and get performance data
      const performance = this.analyticsService.stopTracking();
      this.state.analyticsTracking = false;
      
      // Disconnect chat
      this.chatService.disconnect();
      this.state.chatConnected = false;
      
      // Disable monetization
      this.monetizationService.disableMonetization();
      this.state.monetizationEnabled = false;
      
      this.currentStreamId = null;
      this.userId = null;
      
      this.emit('streamEnded', { stream: archivedStream, performance });
      return performance;
    } catch (error) {
      this.emit('streamError', error);
      throw error;
    }
  }

  async sendChatMessage(message: string): Promise<void> {
    if (!this.userId || !this.state.chatConnected) {
      throw new Error('Chat not connected');
    }

    try {
      await this.chatService.sendMessage(message, this.userId);
    } catch (error) {
      this.emit('chatError', error);
      throw error;
    }
  }

  async sendSuperChat(message: string, amount: number): Promise<MonetizationEvent> {
    if (!this.userId || !this.state.monetizationEnabled) {
      throw new Error('Monetization not enabled');
    }

    try {
      const event = await this.monetizationService.processSuperChat(
        this.userId,
        'Current User', // Would get from user service
        amount,
        message
      );
      
      // Also send as chat message
      await this.chatService.sendSuperChat(message, amount, 'USD', this.userId);
      
      return event;
    } catch (error) {
      this.emit('monetizationError', error);
      throw error;
    }
  }

  async moderateMessage(messageId: string, action: 'delete' | 'timeout' | 'ban'): Promise<void> {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    try {
      switch (action) {
        case 'delete':
          await this.chatService.deleteMessage(messageId, this.userId);
          break;
        case 'timeout':
          // Extract user ID from message - would need message lookup
          await this.chatService.timeoutUser('targetUserId', 300, this.userId);
          break;
        case 'ban':
          // Extract user ID from message - would need message lookup
          await this.chatService.banUser('targetUserId', this.userId);
          break;
      }
    } catch (error) {
      this.emit('moderationError', error);
      throw error;
    }
  }

  updateStreamSettings(settings: Partial<StreamSettings>): void {
    this.streamingService.updateStreamSettings(settings);
  }

  updateChatSettings(settings: Partial<ChatSettings>): void {
    this.chatService.updateSettings(settings);
  }

  updateModerationConfig(config: Partial<AutoModerationConfig>): void {
    this.moderationService.updateConfig(config);
  }

  getDashboard(): StreamDashboard {
    const stream = this.streamingService.getCurrentStream();
    const metrics = this.analyticsService.getCurrentMetrics();
    const revenue = this.monetizationService.getRevenue();
    const chatMessages = this.chatService.getMessages();
    const chatUsers = this.chatService.getUsers();
    const moderationActions = this.moderationService.getActions();

    return {
      stream,
      metrics,
      revenue,
      chatStats: {
        messageCount: chatMessages.length,
        activeUsers: chatUsers.length,
        moderationActions: moderationActions.length
      },
      performance: {
        bitrate: metrics.streamHealth.bitrate,
        latency: metrics.streamHealth.latency,
        quality: metrics.streamHealth.quality,
        uptime: stream ? this.calculateUptime(stream.startTime) : 0
      }
    };
  }

  getState(): LiveStreamingState {
    return { ...this.state };
  }

  private setupEventHandlers(): void {
    // Streaming service events
    this.streamingService.on('streamStarted', (stream) => {
      this.emit('streamEvent', { type: 'started', data: stream });
    });

    this.streamingService.on('streamEnded', (stream) => {
      this.emit('streamEvent', { type: 'ended', data: stream });
    });

    this.streamingService.on('viewerJoined', (data) => {
      this.state.viewerCount = data.viewerCount;
      this.analyticsService.updateViewerCount(data.viewerCount);
      this.emit('viewerCountChanged', data.viewerCount);
    });

    this.streamingService.on('viewerLeft', (data) => {
      this.state.viewerCount = data.viewerCount;
      this.analyticsService.updateViewerCount(data.viewerCount);
      this.emit('viewerCountChanged', data.viewerCount);
    });

    this.streamingService.on('streamMetrics', (metrics) => {
      this.analyticsService.updateStreamMetrics(metrics);
      this.emit('metricsUpdated', metrics);
    });

    // Chat service events
    this.chatService.on('messageReceived', (message: ChatMessage) => {
      // Auto-moderate the message
      if (this.state.moderationEnabled) {
        this.moderationService.moderateMessage(message).then(action => {
          if (action) {
            this.emit('moderationAction', action);
          }
        });
      }
      
      // Track analytics
      this.analyticsService.recordEvent({
        type: 'chat_message',
        timestamp: message.timestamp,
        userId: message.userId
      });
      
      this.emit('chatMessage', message);
    });

    this.chatService.on('superChatReceived', (superChat) => {
      this.analyticsService.recordSuperChat(superChat.metadata?.amount || 0);
      this.emit('superChatReceived', superChat);
    });

    this.chatService.on('userJoined', (user) => {
      this.analyticsService.recordEvent({
        type: 'viewer_join',
        timestamp: new Date(),
        userId: user.id
      });
      this.emit('userJoined', user);
    });

    this.chatService.on('userLeft', (userId) => {
      this.analyticsService.recordEvent({
        type: 'viewer_leave',
        timestamp: new Date(),
        userId
      });
      this.emit('userLeft', userId);
    });

    // Monetization service events
    this.monetizationService.on('superChatReceived', (event) => {
      this.analyticsService.recordSuperChat(event.amount, event.currency);
      this.emit('monetizationEvent', event);
    });

    this.monetizationService.on('donationReceived', (event) => {
      this.analyticsService.recordDonation(event.amount, event.currency);
      this.emit('monetizationEvent', event);
    });

    this.monetizationService.on('subscriptionReceived', (event) => {
      this.analyticsService.recordSubscription(event.metadata?.tierName || '', event.amount);
      this.emit('monetizationEvent', event);
    });

    // Moderation service events
    this.moderationService.on('actionExecuted', (action: ModerationAction) => {
      this.emit('moderationAction', action);
    });

    this.moderationService.on('userBanned', (data) => {
      this.emit('userBanned', data);
    });

    this.moderationService.on('userTimedOut', (data) => {
      this.emit('userTimedOut', data);
    });

    // Analytics service events
    this.analyticsService.on('metricsCollected', (metrics) => {
      this.emit('analyticsUpdate', metrics);
    });

    this.analyticsService.on('eventRecorded', (event) => {
      this.emit('analyticsEvent', event);
    });
  }

  private calculateUptime(startTime?: Date): number {
    if (!startTime) return 0;
    return Math.floor((Date.now() - startTime.getTime()) / 1000); // seconds
  }

  // Utility methods for external access
  getChatMessages(): ChatMessage[] {
    return this.chatService.getMessages();
  }

  getChatUsers() {
    return this.chatService.getUsers();
  }

  getAnalytics() {
    return {
      current: this.analyticsService.getCurrentMetrics(),
      history: this.analyticsService.getMetricsHistory(),
      insights: this.analyticsService.getAudienceInsights()
    };
  }

  getRevenue() {
    return {
      current: this.monetizationService.getRevenue(),
      events: this.monetizationService.getEvents(),
      payout: this.monetizationService.getPayoutInfo(),
      topDonors: this.monetizationService.getTopDonors()
    };
  }

  getModerationData() {
    return {
      rules: this.moderationService.getRules(),
      actions: this.moderationService.getActions(),
      config: this.moderationService.getConfig(),
      stats: this.moderationService.getStats()
    };
  }

  // Additional methods for component integration
  getAnalytics(timeRange: '1h' | '6h' | '24h' | 'all') {
    return this.analyticsService.getAnalytics(timeRange);
  }

  getRevenueData() {
    return this.monetizationService.getRevenue();
  }

  getRecentDonations() {
    return this.monetizationService.getRecentDonations();
  }

  getRecentSuperChats() {
    return this.monetizationService.getRecentSuperChats();
  }

  getNewSubscribers() {
    return this.monetizationService.getNewSubscribers();
  }

  getActiveGoals() {
    return this.monetizationService.getActiveGoals();
  }

  updateMonetizationSettings(settings: any) {
    this.monetizationService.updateSettings(settings);
  }

  createDonationGoal() {
    return this.monetizationService.createGoal();
  }

  exportRevenueReport() {
    return this.monetizationService.exportReport();
  }

  viewPayoutSettings() {
    return this.monetizationService.getPayoutSettings();
  }

  // Moderation methods
  getModerationQueue() {
    return this.moderationService.getModerationQueue();
  }

  getBannedUsers() {
    return this.moderationService.getBannedUsers();
  }

  getTimeoutUsers() {
    return this.moderationService.getTimeoutUsers();
  }

  getAutoModSettings() {
    return this.moderationService.getAutoModSettings();
  }

  getModerators() {
    return this.moderationService.getModerators();
  }

  getChatSettings() {
    return this.chatService.getSettings();
  }

  async banUser(userId: string, reason: string) {
    return this.moderationService.banUser(userId, reason);
  }

  async timeoutUser(userId: string, duration: number, reason: string) {
    return this.moderationService.timeoutUser(userId, duration, reason);
  }

  async unbanUser(userId: string) {
    return this.moderationService.unbanUser(userId);
  }

  async deleteMessage(messageId: string) {
    return this.chatService.deleteMessage(messageId, this.userId || '');
  }

  async approveMessage(messageId: string) {
    return this.moderationService.approveMessage(messageId);
  }

  updateAutoModSettings(settings: any) {
    this.moderationService.updateAutoModSettings(settings);
  }

  removeTimeout(userId: string) {
    return this.moderationService.removeTimeout(userId);
  }

  addModerator(username: string) {
    return this.moderationService.addModerator(username);
  }

  removeModerator(userId: string) {
    return this.moderationService.removeModerator(userId);
  }

  clearChat() {
    return this.chatService.clearChat();
  }

  exportModerationLogs() {
    return this.moderationService.exportLogs();
  }

  enableEmergencyMode() {
    return this.moderationService.enableEmergencyMode();
  }
}