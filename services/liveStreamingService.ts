import { EventEmitter } from 'events';

// Core interfaces for live streaming
export interface StreamSettings {
  quality: 'auto' | '1080p' | '720p' | '480p' | '360p';
  bitrate: number;
  framerate: number;
  latency: 'ultra-low' | 'low' | 'normal';
  privacy: 'public' | 'unlisted' | 'private';
  recordingEnabled: boolean;
}

export interface LiveStream {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  status: 'scheduled' | 'live' | 'ended' | 'error';
  startTime: Date;
  endTime?: Date;
  settings: StreamSettings;
  viewerCount: number;
  chatEnabled: boolean;
  monetizationEnabled: boolean;
}

export interface StreamMetrics {
  viewerCount: number;
  peakViewers: number;
  chatMessages: number;
  likes: number;
  shares: number;
  donations: number;
  superChats: number;
  watchTime: number;
  bitrate: number;
  quality: string;
  latency: number;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  maxBitrate: number;
  adaptiveBitrate: boolean;
  audioCodec: string;
  videoCodec: string;
}

class LiveStreamingService extends EventEmitter {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private isStreaming = false;
  private streamId: string | null = null;
  private metrics: StreamMetrics = {
    viewerCount: 0,
    peakViewers: 0,
    chatMessages: 0,
    likes: 0,
    shares: 0,
    donations: 0,
    superChats: 0,
    watchTime: 0,
    bitrate: 0,
    quality: 'auto',
    latency: 0
  };

  private webrtcConfig: WebRTCConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ],
    maxBitrate: 6000000, // 6 Mbps
    adaptiveBitrate: true,
    audioCodec: 'opus',
    videoCodec: 'h264'
  };

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('streamStarted', (streamId: string) => {
      console.log(`Stream ${streamId} started successfully`);
    });

    this.on('streamEnded', (streamId: string) => {
      console.log(`Stream ${streamId} ended`);
    });

    this.on('viewerJoined', (viewerId: string) => {
      this.metrics.viewerCount++;
      if (this.metrics.viewerCount > this.metrics.peakViewers) {
        this.metrics.peakViewers = this.metrics.viewerCount;
      }
    });

    this.on('viewerLeft', (viewerId: string) => {
      this.metrics.viewerCount = Math.max(0, this.metrics.viewerCount - 1);
    });
  }

  async initializeStream(settings: StreamSettings): Promise<string> {
    try {
      // Get user media with specified settings
      const constraints = this.getMediaConstraints(settings);
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create peer connection
      this.peerConnection = new RTCPeerConnection(this.webrtcConfig);
      
      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Setup peer connection event handlers
      this.setupPeerConnectionHandlers();

      // Generate stream ID
      this.streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return this.streamId;
    } catch (error) {
      console.error('Failed to initialize stream:', error);
      throw new Error('Failed to initialize live stream');
    }
  }

  private getMediaConstraints(settings: StreamSettings): MediaStreamConstraints {
    const videoConstraints: MediaTrackConstraints = {
      width: this.getVideoWidth(settings.quality),
      height: this.getVideoHeight(settings.quality),
      frameRate: settings.framerate
    };

    return {
      video: videoConstraints,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2
      }
    };
  }

  private getVideoWidth(quality: string): number {
    switch (quality) {
      case '1080p': return 1920;
      case '720p': return 1280;
      case '480p': return 854;
      case '360p': return 640;
      default: return 1280;
    }
  }

  private getVideoHeight(quality: string): number {
    switch (quality) {
      case '1080p': return 1080;
      case '720p': return 720;
      case '480p': return 480;
      case '360p': return 360;
      default: return 720;
    }
  }

  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate to signaling server
        this.emit('iceCandidate', event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        const state = this.peerConnection.connectionState;
        this.emit('connectionStateChange', state);
        
        if (state === 'connected') {
          this.isStreaming = true;
          this.emit('streamStarted', this.streamId);
          this.startMetricsCollection();
        } else if (state === 'disconnected' || state === 'failed') {
          this.handleStreamError();
        }
      }
    };

    this.peerConnection.ontrack = (event) => {
      // Handle incoming tracks (for viewers)
      this.emit('trackReceived', event.streams[0]);
    };
  }

  async startStream(): Promise<void> {
    if (!this.peerConnection || !this.localStream) {
      throw new Error('Stream not initialized');
    }

    try {
      // Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send offer to signaling server
      this.emit('offer', offer);
    } catch (error) {
      console.error('Failed to start stream:', error);
      throw new Error('Failed to start live stream');
    }
  }

  async stopStream(): Promise<void> {
    this.isStreaming = false;

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.emit('streamEnded', this.streamId);
    this.streamId = null;
  }

  private startMetricsCollection(): void {
    const metricsInterval = setInterval(() => {
      if (!this.isStreaming) {
        clearInterval(metricsInterval);
        return;
      }

      this.collectMetrics();
    }, 1000); // Collect metrics every second
  }

  private async collectMetrics(): Promise<void> {
    if (!this.peerConnection) return;

    try {
      const stats = await this.peerConnection.getStats();
      
      stats.forEach((report) => {
        if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
          this.metrics.bitrate = report.bytesSent * 8 / 1000; // Convert to kbps
        }
      });

      this.emit('metricsUpdate', this.metrics);
    } catch (error) {
      console.error('Failed to collect metrics:', error);
    }
  }

  private handleStreamError(): void {
    this.emit('streamError', 'Connection lost');
    this.stopStream();
  }

  // Adaptive bitrate control
  async adjustBitrate(targetBitrate: number): Promise<void> {
    if (!this.peerConnection) return;

    const sender = this.peerConnection.getSenders().find(s => 
      s.track && s.track.kind === 'video'
    );

    if (sender) {
      const params = sender.getParameters();
      if (params.encodings && params.encodings[0]) {
        params.encodings[0].maxBitrate = targetBitrate;
        await sender.setParameters(params);
      }
    }
  }

  // Get current stream metrics
  getMetrics(): StreamMetrics {
    return { ...this.metrics };
  }

  // Check if currently streaming
  isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }

  // Get current stream ID
  getCurrentStreamId(): string | null {
    return this.streamId;
  }
}

export default new LiveStreamingService();