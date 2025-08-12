import { EventEmitter } from 'events';
import { WebRTCService, StreamConfig, StreamMetrics } from '../webrtc/WebRTCService';

export interface StreamSettings {
  title: string;
  description: string;
  thumbnail?: string;
  privacy: 'public' | 'unlisted' | 'private';
  category: string;
  tags: string[];
  monetization: {
    enabled: boolean;
    superChatEnabled: boolean;
    donationsEnabled: boolean;
    subscriptionRequired: boolean;
  };
  recording: {
    enabled: boolean;
    quality: 'source' | '1080p' | '720p' | '480p';
  };
}

export interface LiveStream {
  id: string;
  streamKey: string;
  rtmpUrl: string;
  status: 'scheduled' | 'live' | 'ended';
  settings: StreamSettings;
  config: StreamConfig;
  startTime?: Date;
  endTime?: Date;
  viewerCount: number;
  peakViewers: number;
  totalViews: number;
  duration: number;
  metrics: StreamMetrics[];
}

export interface StreamAnalytics {
  totalStreams: number;
  totalWatchTime: number;
  averageViewers: number;
  peakConcurrentViewers: number;
  chatMessages: number;
  superChatRevenue: number;
  newSubscribers: number;
  engagement: {
    likes: number;
    shares: number;
    comments: number;
  };
}

export class StreamingService extends EventEmitter {
  private webrtcService: WebRTCService;
  private currentStream: LiveStream | null = null;
  private streamAnalytics: StreamAnalytics;
  private viewerConnections: Map<string, RTCPeerConnection> = new Map();

  constructor() {
    super();
    this.streamAnalytics = this.initializeAnalytics();
  }

  private initializeAnalytics(): StreamAnalytics {
    return {
      totalStreams: 0,
      totalWatchTime: 0,
      averageViewers: 0,
      peakConcurrentViewers: 0,
      chatMessages: 0,
      superChatRevenue: 0,
      newSubscribers: 0,
      engagement: {
        likes: 0,
        shares: 0,
        comments: 0
      }
    };
  }

  async createStream(settings: StreamSettings, config: StreamConfig): Promise<LiveStream> {
    const streamId = this.generateStreamId();
    const streamKey = this.generateStreamKey();
    
    this.currentStream = {
      id: streamId,
      streamKey,
      rtmpUrl: `rtmp://live.reelverse.com/live/${streamKey}`,
      status: 'scheduled',
      settings,
      config,
      viewerCount: 0,
      peakViewers: 0,
      totalViews: 0,
      duration: 0,
      metrics: []
    };

    // Initialize WebRTC service with stream config
    this.webrtcService = new WebRTCService(config);
    this.setupWebRTCEventHandlers();

    this.emit('streamCreated', this.currentStream);
    return this.currentStream;
  }

  async startLiveStream(): Promise<void> {
    if (!this.currentStream) {
      throw new Error('No stream created');
    }

    try {
      await this.webrtcService.startStream();
      
      this.currentStream.status = 'live';
      this.currentStream.startTime = new Date();
      
      this.streamAnalytics.totalStreams++;
      
      this.emit('streamStarted', this.currentStream);
    } catch (error) {
      this.emit('streamError', error);
      throw error;
    }
  }

  async stopLiveStream(): Promise<void> {
    if (!this.currentStream) {
      throw new Error('No active stream');
    }

    try {
      await this.webrtcService.stopStream();
      
      this.currentStream.status = 'ended';
      this.currentStream.endTime = new Date();
      
      if (this.currentStream.startTime) {
        this.currentStream.duration = 
          this.currentStream.endTime.getTime() - this.currentStream.startTime.getTime();
      }

      // Close all viewer connections
      this.viewerConnections.forEach(connection => connection.close());
      this.viewerConnections.clear();

      this.emit('streamEnded', this.currentStream);
      
      // Archive the stream
      const archivedStream = { ...this.currentStream };
      this.currentStream = null;
      
      return archivedStream;
    } catch (error) {
      this.emit('streamError', error);
      throw error;
    }
  }

  async addViewer(viewerId: string): Promise<RTCSessionDescriptionInit> {
    if (!this.currentStream || this.currentStream.status !== 'live') {
      throw new Error('No active live stream');
    }

    // Create peer connection for viewer
    const viewerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    // Add stream tracks to viewer connection
    const localStream = await this.webrtcService.getLocalStream();
    if (localStream) {
      localStream.getTracks().forEach(track => {
        viewerConnection.addTrack(track, localStream);
      });
    }

    this.viewerConnections.set(viewerId, viewerConnection);
    
    // Update viewer count
    this.currentStream.viewerCount = this.viewerConnections.size;
    this.currentStream.peakViewers = Math.max(
      this.currentStream.peakViewers, 
      this.currentStream.viewerCount
    );

    this.emit('viewerJoined', { viewerId, viewerCount: this.currentStream.viewerCount });

    // Create and return offer for viewer
    const offer = await viewerConnection.createOffer();
    await viewerConnection.setLocalDescription(offer);
    
    return offer;
  }

  async removeViewer(viewerId: string): Promise<void> {
    const connection = this.viewerConnections.get(viewerId);
    if (connection) {
      connection.close();
      this.viewerConnections.delete(viewerId);
      
      if (this.currentStream) {
        this.currentStream.viewerCount = this.viewerConnections.size;
      }

      this.emit('viewerLeft', { viewerId, viewerCount: this.currentStream?.viewerCount || 0 });
    }
  }

  async handleViewerAnswer(viewerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const connection = this.viewerConnections.get(viewerId);
    if (connection) {
      await connection.setRemoteDescription(answer);
    }
  }

  async handleViewerIceCandidate(viewerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const connection = this.viewerConnections.get(viewerId);
    if (connection) {
      await connection.addIceCandidate(candidate);
    }
  }

  updateStreamSettings(settings: Partial<StreamSettings>): void {
    if (this.currentStream) {
      this.currentStream.settings = { ...this.currentStream.settings, ...settings };
      this.emit('streamSettingsUpdated', this.currentStream.settings);
    }
  }

  updateStreamConfig(config: Partial<StreamConfig>): void {
    if (this.webrtcService) {
      this.webrtcService.updateStreamConfig(config);
    }
    
    if (this.currentStream) {
      this.currentStream.config = { ...this.currentStream.config, ...config };
      this.emit('streamConfigUpdated', this.currentStream.config);
    }
  }

  getCurrentStream(): LiveStream | null {
    return this.currentStream;
  }

  getStreamAnalytics(): StreamAnalytics {
    return { ...this.streamAnalytics };
  }

  getViewerCount(): number {
    return this.viewerConnections.size;
  }

  private setupWebRTCEventHandlers(): void {
    this.webrtcService.on('streamStarted', (stream) => {
      this.emit('webrtcStreamStarted', stream);
    });

    this.webrtcService.on('streamStopped', () => {
      this.emit('webrtcStreamStopped');
    });

    this.webrtcService.on('metrics', (metrics: StreamMetrics) => {
      if (this.currentStream) {
        this.currentStream.metrics.push(metrics);
        this.emit('streamMetrics', metrics);
      }
    });

    this.webrtcService.on('error', (error) => {
      this.emit('streamError', error);
    });

    this.webrtcService.on('connectionStateChange', (state) => {
      this.emit('connectionStateChange', state);
    });
  }

  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateStreamKey(): string {
    return `sk_${Math.random().toString(36).substr(2, 16)}_${Date.now()}`;
  }

  // Analytics methods
  incrementChatMessages(): void {
    this.streamAnalytics.chatMessages++;
  }

  addSuperChatRevenue(amount: number): void {
    this.streamAnalytics.superChatRevenue += amount;
  }

  incrementNewSubscribers(): void {
    this.streamAnalytics.newSubscribers++;
  }

  incrementEngagement(type: 'likes' | 'shares' | 'comments'): void {
    this.streamAnalytics.engagement[type]++;
  }

  updateWatchTime(minutes: number): void {
    this.streamAnalytics.totalWatchTime += minutes;
  }
}