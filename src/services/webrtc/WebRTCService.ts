import { EventEmitter } from 'events';

export interface StreamConfig {
  video: {
    width: number;
    height: number;
    frameRate: number;
    bitrate: number;
  };
  audio: {
    sampleRate: number;
    bitrate: number;
    channels: number;
  };
}

export interface StreamMetrics {
  bitrate: number;
  frameRate: number;
  resolution: string;
  latency: number;
  packetsLost: number;
  jitter: number;
  timestamp: number;
}

export class WebRTCService extends EventEmitter {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private isStreaming = false;
  private streamConfig: StreamConfig;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(config: StreamConfig) {
    super();
    this.streamConfig = config;
    this.setupPeerConnection();
  }

  private setupPeerConnection(): void {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };

    this.peerConnection = new RTCPeerConnection(configuration);
    
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit('iceCandidate', event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      this.emit('connectionStateChange', state);
      
      if (state === 'connected') {
        this.startMetricsCollection();
      } else if (state === 'disconnected' || state === 'failed') {
        this.stopMetricsCollection();
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onmessage = (event) => {
        this.emit('dataChannelMessage', JSON.parse(event.data));
      };
    };
  }

  async startStream(): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: this.streamConfig.video.width },
          height: { ideal: this.streamConfig.video.height },
          frameRate: { ideal: this.streamConfig.video.frameRate }
        },
        audio: {
          sampleRate: { ideal: this.streamConfig.audio.sampleRate },
          channelCount: { ideal: this.streamConfig.audio.channels }
        }
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Add tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Create data channel for real-time communication
      this.dataChannel = this.peerConnection!.createDataChannel('streamData', {
        ordered: true
      });

      this.isStreaming = true;
      this.emit('streamStarted', this.localStream);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async stopStream(): Promise<void> {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.setupPeerConnection();
    }

    this.stopMetricsCollection();
    this.isStreaming = false;
    this.emit('streamStopped');
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.setRemoteDescription(description);
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.addIceCandidate(candidate);
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      if (this.peerConnection) {
        const stats = await this.peerConnection.getStats();
        const metrics = this.parseStats(stats);
        this.emit('metrics', metrics);
      }
    }, 1000);
  }

  private stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  private parseStats(stats: RTCStatsReport): StreamMetrics {
    let bitrate = 0;
    let frameRate = 0;
    let resolution = '';
    let latency = 0;
    let packetsLost = 0;
    let jitter = 0;

    stats.forEach((report) => {
      if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
        bitrate = report.bytesSent * 8 / 1000; // Convert to kbps
        frameRate = report.framesPerSecond || 0;
        resolution = `${report.frameWidth}x${report.frameHeight}`;
      }
      
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        latency = report.currentRoundTripTime * 1000; // Convert to ms
      }
      
      if (report.type === 'inbound-rtp') {
        packetsLost = report.packetsLost || 0;
        jitter = report.jitter || 0;
      }
    });

    return {
      bitrate,
      frameRate,
      resolution,
      latency,
      packetsLost,
      jitter,
      timestamp: Date.now()
    };
  }

  sendDataChannelMessage(data: any): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(data));
    }
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  isStreamingActive(): boolean {
    return this.isStreaming;
  }

  updateStreamConfig(config: Partial<StreamConfig>): void {
    this.streamConfig = { ...this.streamConfig, ...config };
  }
}