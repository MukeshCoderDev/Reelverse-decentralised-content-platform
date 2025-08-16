import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { keyManagementService } from './keyManagementService';
import { auditLoggingService } from './auditLoggingService';

export interface HLSKey {
  id: string;
  keyValue: Buffer;
  keyUri: string;
  iv: Buffer;
  method: 'AES-128' | 'AES-256';
  createdAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired' | 'revoked';
  streamId?: string;
  segmentRange?: {
    start: number;
    end: number;
  };
}

export interface HLSKeyRotationConfig {
  rotationInterval: number; // minutes
  keyMethod: 'AES-128' | 'AES-256';
  segmentsPerKey: number;
  preGenerateKeys: number;
  cdnSyncEnabled: boolean;
  emergencyRotationEnabled: boolean;
}

export interface StreamEncryptionState {
  streamId: string;
  currentKeyId: string;
  nextKeyId?: string;
  segmentCount: number;
  lastRotation: Date;
  rotationConfig: HLSKeyRotationConfig;
  playlistUrl: string;
  cdnEndpoints: string[];
}

export interface KeyRotationEvent {
  id: string;
  streamId: string;
  oldKeyId: string;
  newKeyId: string;
  rotationType: 'scheduled' | 'emergency' | 'manual';
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
  affectedSegments: number;
  cdnSyncStatus: Record<string, boolean>;
}

export class HLSKeyRotationService {
  private hlsKeys: Map<string, HLSKey> = new Map();
  private streamStates: Map<string, StreamEncryptionState> = new Map();
  private rotationEvents: KeyRotationEvent[] = [];
  private rotationTimers: Map<string, NodeJS.Timeout> = new Map();

  // Default configuration
  private defaultConfig: HLSKeyRotationConfig = {
    rotationInterval: 30, // 30 minutes
    keyMethod: 'AES-128',
    segmentsPerKey: 100,
    preGenerateKeys: 3,
    cdnSyncEnabled: true,
    emergencyRotationEnabled: true
  };

  async initializeStream(
    streamId: string,
    playlistUrl: string,
    cdnEndpoints: string[],
    config: Partial<HLSKeyRotationConfig> = {}
  ): Promise<StreamEncryptionState> {
    const rotationConfig = { ...this.defaultConfig, ...config };
    
    // Generate initial key
    const initialKey = await this.generateHLSKey(streamId, rotationConfig.keyMethod);
    
    // Pre-generate additional keys
    const preGeneratedKeys: string[] = [];
    for (let i = 0; i < rotationConfig.preGenerateKeys; i++) {
      const key = await this.generateHLSKey(streamId, rotationConfig.keyMethod);
      preGeneratedKeys.push(key.id);
    }

    const streamState: StreamEncryptionState = {
      streamId,
      currentKeyId: initialKey.id,
      nextKeyId: preGeneratedKeys[0],
      segmentCount: 0,
      lastRotation: new Date(),
      rotationConfig,
      playlistUrl,
      cdnEndpoints
    };

    this.streamStates.set(streamId, streamState);

    // Schedule automatic rotation
    await this.scheduleRotation(streamId);

    // Sync initial key to CDNs
    if (rotationConfig.cdnSyncEnabled) {
      await this.syncKeyToCDNs(initialKey, cdnEndpoints);
    }

    // Log stream initialization
    await auditLoggingService.logAction(
      'system',
      'hls_service',
      'create',
      'hls_stream',
      streamId,
      `HLS stream initialized with encryption`,
      {
        ipAddress: '127.0.0.1',
        userAgent: 'hls-key-rotation-service',
        sessionId: 'hls-init-session'
      },
      true,
      undefined,
      {
        initialKeyId: initialKey.id,
        rotationInterval: rotationConfig.rotationInterval,
        keyMethod: rotationConfig.keyMethod,
        cdnEndpoints: cdnEndpoints.length
      }
    );

    return streamState;
  }

  async generateHLSKey(
    streamId: string,
    method: 'AES-128' | 'AES-256' = 'AES-128'
  ): Promise<HLSKey> {
    const keyId = uuidv4();
    const keySize = method === 'AES-128' ? 16 : 32;
    
    // Generate random key
    const keyValue = crypto.randomBytes(keySize);
    
    // Generate IV (16 bytes for both AES-128 and AES-256)
    const iv = crypto.randomBytes(16);
    
    // Create key URI for HLS playlist
    const keyUri = `/api/hls/keys/${keyId}`;
    
    const hlsKey: HLSKey = {
      id: keyId,
      keyValue,
      keyUri,
      iv,
      method,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      status: 'active',
      streamId
    };

    this.hlsKeys.set(keyId, hlsKey);

    // Encrypt and store key using KMS
    await this.storeKeySecurely(hlsKey);

    return hlsKey;
  }

  async rotateStreamKey(
    streamId: string,
    rotationType: 'scheduled' | 'emergency' | 'manual' = 'scheduled'
  ): Promise<KeyRotationEvent> {
    const streamState = this.streamStates.get(streamId);
    if (!streamState) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    const eventId = uuidv4();
    const timestamp = new Date();
    
    try {
      const oldKeyId = streamState.currentKeyId;
      let newKeyId: string;

      // Use pre-generated key if available, otherwise generate new one
      if (streamState.nextKeyId) {
        newKeyId = streamState.nextKeyId;
        
        // Generate next pre-generated key
        const nextKey = await this.generateHLSKey(streamId, streamState.rotationConfig.keyMethod);
        streamState.nextKeyId = nextKey.id;
      } else {
        const newKey = await this.generateHLSKey(streamId, streamState.rotationConfig.keyMethod);
        newKeyId = newKey.id;
      }

      // Update stream state
      streamState.currentKeyId = newKeyId;
      streamState.lastRotation = timestamp;
      streamState.segmentCount = 0; // Reset segment count

      // Sync new key to CDNs
      const cdnSyncStatus: Record<string, boolean> = {};
      if (streamState.rotationConfig.cdnSyncEnabled) {
        const newKey = this.hlsKeys.get(newKeyId)!;
        for (const endpoint of streamState.cdnEndpoints) {
          try {
            await this.syncKeyToCDN(newKey, endpoint);
            cdnSyncStatus[endpoint] = true;
          } catch (error) {
            cdnSyncStatus[endpoint] = false;
            console.error(`Failed to sync key to CDN ${endpoint}:`, error);
          }
        }
      }

      // Update playlist with new key
      await this.updatePlaylist(streamState, newKeyId);

      // Schedule expiration of old key (keep it active for a grace period)
      setTimeout(() => {
        this.expireKey(oldKeyId);
      }, 5 * 60 * 1000); // 5 minute grace period

      const rotationEvent: KeyRotationEvent = {
        id: eventId,
        streamId,
        oldKeyId,
        newKeyId,
        rotationType,
        timestamp,
        success: true,
        affectedSegments: streamState.segmentCount,
        cdnSyncStatus
      };

      this.rotationEvents.push(rotationEvent);

      // Log successful rotation
      await auditLoggingService.logAction(
        'system',
        'hls_service',
        'rotate',
        'hls_key',
        streamId,
        `HLS key rotated: ${oldKeyId} -> ${newKeyId}`,
        {
          ipAddress: '127.0.0.1',
          userAgent: 'hls-key-rotation-service',
          sessionId: 'hls-rotation-session'
        },
        true,
        undefined,
        {
          rotationType,
          oldKeyId,
          newKeyId,
          cdnSyncSuccess: Object.values(cdnSyncStatus).every(Boolean)
        }
      );

      return rotationEvent;
    } catch (error) {
      const rotationEvent: KeyRotationEvent = {
        id: eventId,
        streamId,
        oldKeyId: streamState.currentKeyId,
        newKeyId: '',
        rotationType,
        timestamp,
        success: false,
        errorMessage: error.message,
        affectedSegments: streamState.segmentCount,
        cdnSyncStatus: {}
      };

      this.rotationEvents.push(rotationEvent);

      // Log failed rotation
      await auditLoggingService.logAction(
        'system',
        'hls_service',
        'rotate',
        'hls_key',
        streamId,
        `HLS key rotation failed: ${error.message}`,
        {
          ipAddress: '127.0.0.1',
          userAgent: 'hls-key-rotation-service',
          sessionId: 'hls-rotation-session'
        },
        false,
        error.message,
        { rotationType }
      );

      throw error;
    }
  }

  async emergencyKeyRevocation(streamId: string, reason: string): Promise<void> {
    const streamState = this.streamStates.get(streamId);
    if (!streamState) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    // Immediately revoke current key
    const currentKey = this.hlsKeys.get(streamState.currentKeyId);
    if (currentKey) {
      currentKey.status = 'revoked';
      currentKey.expiresAt = new Date(); // Expire immediately
    }

    // Rotate to new key immediately
    await this.rotateStreamKey(streamId, 'emergency');

    // Remove revoked key from CDNs
    if (streamState.rotationConfig.cdnSyncEnabled && currentKey) {
      for (const endpoint of streamState.cdnEndpoints) {
        await this.removeKeyFromCDN(currentKey, endpoint);
      }
    }

    // Log emergency revocation
    await auditLoggingService.logAction(
      'system',
      'hls_service',
      'delete',
      'hls_key',
      streamState.currentKeyId,
      `Emergency key revocation: ${reason}`,
      {
        ipAddress: '127.0.0.1',
        userAgent: 'hls-key-rotation-service',
        sessionId: 'hls-emergency-session'
      },
      true,
      undefined,
      { reason, streamId }
    );
  }

  async scheduleRotation(streamId: string): Promise<void> {
    const streamState = this.streamStates.get(streamId);
    if (!streamState) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    // Clear existing timer
    const existingTimer = this.rotationTimers.get(streamId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Schedule new rotation
    const intervalMs = streamState.rotationConfig.rotationInterval * 60 * 1000;
    const timer = setInterval(async () => {
      try {
        await this.rotateStreamKey(streamId, 'scheduled');
      } catch (error) {
        console.error(`Scheduled rotation failed for stream ${streamId}:`, error);
      }
    }, intervalMs);

    this.rotationTimers.set(streamId, timer);
  }

  async updateSegmentCount(streamId: string): Promise<void> {
    const streamState = this.streamStates.get(streamId);
    if (!streamState) {
      return;
    }

    streamState.segmentCount++;

    // Check if we need to rotate based on segment count
    if (streamState.segmentCount >= streamState.rotationConfig.segmentsPerKey) {
      await this.rotateStreamKey(streamId, 'scheduled');
    }
  }

  async getKeyForPlaylist(keyId: string): Promise<HLSKey | null> {
    const key = this.hlsKeys.get(keyId);
    if (!key || key.status !== 'active' || key.expiresAt < new Date()) {
      return null;
    }
    return key;
  }

  async generatePlaylistEntry(streamId: string, segmentNumber: number): Promise<string> {
    const streamState = this.streamStates.get(streamId);
    if (!streamState) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    const currentKey = this.hlsKeys.get(streamState.currentKeyId);
    if (!currentKey) {
      throw new Error(`Current key not found for stream: ${streamId}`);
    }

    // Generate HLS playlist entry with encryption info
    const keyLine = `#EXT-X-KEY:METHOD=${currentKey.method},URI="${currentKey.keyUri}",IV=0x${currentKey.iv.toString('hex')}`;
    const segmentLine = `#EXTINF:10.0,\nsegment_${segmentNumber}.ts`;

    return `${keyLine}\n${segmentLine}`;
  }

  private async storeKeySecurely(hlsKey: HLSKey): Promise<void> {
    // Encrypt HLS key using KMS envelope encryption
    const keyData = Buffer.concat([hlsKey.keyValue, hlsKey.iv]);
    
    try {
      await keyManagementService.encryptData(
        keyData,
        'hls_encryption',
        undefined,
        {
          hlsKeyId: hlsKey.id,
          streamId: hlsKey.streamId,
          method: hlsKey.method,
          createdAt: hlsKey.createdAt.toISOString()
        }
      );
    } catch (error) {
      console.error(`Failed to store HLS key securely: ${hlsKey.id}`, error);
    }
  }

  private async syncKeyToCDNs(hlsKey: HLSKey, cdnEndpoints: string[]): Promise<void> {
    for (const endpoint of cdnEndpoints) {
      await this.syncKeyToCDN(hlsKey, endpoint);
    }
  }

  private async syncKeyToCDN(hlsKey: HLSKey, cdnEndpoint: string): Promise<void> {
    // Mock CDN sync - would make actual API calls to CDN providers
    console.log(`Syncing HLS key ${hlsKey.id} to CDN: ${cdnEndpoint}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In real implementation, would call:
    // - CloudFlare: Update key via API
    // - AWS CloudFront: Update signed URLs
    // - Fastly: Update edge dictionary
    // - Custom CDN: HTTP API call
  }

  private async removeKeyFromCDN(hlsKey: HLSKey, cdnEndpoint: string): Promise<void> {
    // Mock CDN key removal
    console.log(`Removing HLS key ${hlsKey.id} from CDN: ${cdnEndpoint}`);
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async updatePlaylist(streamState: StreamEncryptionState, newKeyId: string): Promise<void> {
    // Mock playlist update - would update actual HLS playlist
    console.log(`Updating playlist for stream ${streamState.streamId} with new key: ${newKeyId}`);
    
    // In real implementation, would:
    // 1. Generate new playlist with updated key info
    // 2. Upload to CDN/origin server
    // 3. Invalidate CDN cache if needed
  }

  private expireKey(keyId: string): void {
    const key = this.hlsKeys.get(keyId);
    if (key) {
      key.status = 'expired';
      key.expiresAt = new Date();
    }
  }

  // Cleanup and management methods
  async stopStream(streamId: string): Promise<void> {
    const streamState = this.streamStates.get(streamId);
    if (!streamState) {
      return;
    }

    // Clear rotation timer
    const timer = this.rotationTimers.get(streamId);
    if (timer) {
      clearInterval(timer);
      this.rotationTimers.delete(streamId);
    }

    // Expire all keys for this stream
    const streamKeys = Array.from(this.hlsKeys.values())
      .filter(key => key.streamId === streamId);
    
    for (const key of streamKeys) {
      key.status = 'expired';
      key.expiresAt = new Date();
    }

    // Remove from CDNs
    if (streamState.rotationConfig.cdnSyncEnabled) {
      for (const key of streamKeys) {
        for (const endpoint of streamState.cdnEndpoints) {
          await this.removeKeyFromCDN(key, endpoint);
        }
      }
    }

    this.streamStates.delete(streamId);

    // Log stream stop
    await auditLoggingService.logAction(
      'system',
      'hls_service',
      'delete',
      'hls_stream',
      streamId,
      'HLS stream stopped and keys expired',
      {
        ipAddress: '127.0.0.1',
        userAgent: 'hls-key-rotation-service',
        sessionId: 'hls-stop-session'
      },
      true,
      undefined,
      { expiredKeys: streamKeys.length }
    );
  }

  async cleanupExpiredKeys(): Promise<number> {
    const now = new Date();
    const expiredKeys = Array.from(this.hlsKeys.values())
      .filter(key => key.expiresAt < now && key.status !== 'expired');

    for (const key of expiredKeys) {
      key.status = 'expired';
    }

    return expiredKeys.length;
  }

  async getRotationMetrics(streamId?: string, startDate?: Date, endDate?: Date): Promise<any> {
    let events = this.rotationEvents;

    if (streamId) {
      events = events.filter(event => event.streamId === streamId);
    }

    if (startDate) {
      events = events.filter(event => event.timestamp >= startDate);
    }

    if (endDate) {
      events = events.filter(event => event.timestamp <= endDate);
    }

    const successfulRotations = events.filter(e => e.success);
    const failedRotations = events.filter(e => !e.success);

    const rotationTypes = events.reduce((acc, event) => {
      acc[event.rotationType] = (acc[event.rotationType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRotations: events.length,
      successfulRotations: successfulRotations.length,
      failedRotations: failedRotations.length,
      successRate: events.length > 0 ? successfulRotations.length / events.length : 0,
      rotationTypes,
      averageRotationInterval: this.calculateAverageRotationInterval(events),
      cdnSyncSuccessRate: this.calculateCDNSyncSuccessRate(events)
    };
  }

  private calculateAverageRotationInterval(events: KeyRotationEvent[]): number {
    if (events.length < 2) return 0;

    const intervals: number[] = [];
    const sortedEvents = events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    for (let i = 1; i < sortedEvents.length; i++) {
      const interval = sortedEvents[i].timestamp.getTime() - sortedEvents[i - 1].timestamp.getTime();
      intervals.push(interval / (1000 * 60)); // Convert to minutes
    }

    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  private calculateCDNSyncSuccessRate(events: KeyRotationEvent[]): number {
    const eventsWithCDNSync = events.filter(e => Object.keys(e.cdnSyncStatus).length > 0);
    if (eventsWithCDNSync.length === 0) return 1;

    let totalSyncs = 0;
    let successfulSyncs = 0;

    for (const event of eventsWithCDNSync) {
      const syncs = Object.values(event.cdnSyncStatus);
      totalSyncs += syncs.length;
      successfulSyncs += syncs.filter(Boolean).length;
    }

    return totalSyncs > 0 ? successfulSyncs / totalSyncs : 1;
  }

  // Query methods
  getStreamState(streamId: string): StreamEncryptionState | undefined {
    return this.streamStates.get(streamId);
  }

  getHLSKey(keyId: string): HLSKey | undefined {
    return this.hlsKeys.get(keyId);
  }

  listActiveStreams(): StreamEncryptionState[] {
    return Array.from(this.streamStates.values());
  }

  getRotationEvents(streamId?: string): KeyRotationEvent[] {
    if (streamId) {
      return this.rotationEvents.filter(event => event.streamId === streamId);
    }
    return this.rotationEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getKeysRequiringRotation(): { streamId: string; lastRotation: Date; overdue: boolean }[] {
    const now = new Date();
    return Array.from(this.streamStates.values()).map(state => {
      const overdueTime = state.lastRotation.getTime() + (state.rotationConfig.rotationInterval * 60 * 1000);
      return {
        streamId: state.streamId,
        lastRotation: state.lastRotation,
        overdue: now.getTime() > overdueTime
      };
    }).filter(item => item.overdue);
  }
}

export const hlsKeyRotationService = new HLSKeyRotationService();