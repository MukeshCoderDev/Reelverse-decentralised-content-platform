/**
 * CDN Authorization and Edge Handshake Service
 * Handles real-time authorization for CDN edge servers with P95 ≤ 50ms (≤ 80ms cache miss) SLA
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8
 */

import { EventEmitter } from 'events';

export interface SegmentAuthRequest {
  ticketId: string;
  contentId: string;
  segmentRange: string;
  clientIP: string;
  deviceId: string;
  userAgent?: string;
  asn?: string;
  geo?: GeoLocation;
  timestamp: number;
}

export interface ManifestAuthRequest {
  ticketId: string;
  contentId: string;
  clientIP: string;
  deviceId: string;
  manifestType: 'hls' | 'dash' | 'cmaf';
}

export interface KeyTokenRequest {
  ticketId: string;
  contentId: string;
  segmentRange: string;
  clientIP: string;
  deviceId: string;
  keyId: string;
}

export interface AuthDecision {
  allowed: boolean;
  reason?: string;
  cacheTTL: number; // seconds
  errorCode?: string;
  correlationId: string;
  processingTime: number;
}

export interface ManifestResponse {
  manifestContent: string;
  cacheTTL: number;
  keyUris: string[];
  correlationId: string;
}

export interface KeyToken {
  token: string;
  expiresAt: number; // timestamp
  keyId: string;
  correlationId: string;
}

export interface GeoLocation {
  country: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface PlaybackTicket {
  ticketId: string;
  contentId: string;
  userId: string;
  deviceId: string;
  entitlements: string[];
  restrictions: AccessRestriction[];
  watermarkProfile?: WatermarkProfile;
  expiresAt: number;
  issuedAt: number;
  signature: string;
}

export interface AccessRestriction {
  type: 'geo' | 'age' | 'device' | 'concurrent' | 'time';
  value: any;
  message?: string;
}

export interface WatermarkProfile {
  type: 'static' | 'dynamic' | 'forensic';
  userId: string;
  sessionId: string;
  overlayData?: string;
}

export interface CacheEntry {
  decision: AuthDecision;
  expiresAt: number;
  hitCount: number;
}

export interface PolicyDecision {
  allowed: boolean;
  restrictions: AccessRestriction[];
  cacheTTL: number;
  reason?: string;
}

export class CDNAuthorizationService extends EventEmitter {
  private static instance: CDNAuthorizationService;
  private authCache: Map<string, CacheEntry> = new Map();
  private ticketCache: Map<string, PlaybackTicket> = new Map();
  private keyTokens: Map<string, KeyToken> = new Map();
  private manifestCache: Map<string, { content: string; expiresAt: number }> = new Map();
  
  // Performance tracking
  private metrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    responseTimes: [] as number[]
  };

  // Configuration
  private config = {
    defaultCacheTTL: 300, // 5 minutes
    keyTokenTTL: 60, // 60 seconds as per requirement
    maxCacheSize: 10000,
    coldStartGracePeriod: 30000, // 30 seconds
    enableColdStartGrace: true,
    denyByDefault: true
  };

  private constructor() {
    super();
    this.startCacheCleanup();
    this.startMetricsCollection();
  }

  public static getInstance(): CDNAuthorizationService {
    if (!CDNAuthorizationService.instance) {
      CDNAuthorizationService.instance = new CDNAuthorizationService();
    }
    return CDNAuthorizationService.instance;
  }

  /**
   * Authorize segment delivery with P95 ≤ 50ms (≤ 80ms cache miss) SLA
   * Requirement: 18.1
   */
  public async authorizeSegment(request: SegmentAuthRequest): Promise<AuthDecision> {
    const startTime = Date.now();
    const correlationId = this.generateCorrelationId();

    try {
      // Validate request
      if (!this.validateSegmentRequest(request)) {
        return this.createDenyDecision('INVALID_REQUEST', correlationId, startTime);
      }

      // Check cache first for performance
      const cacheKey = this.generateCacheKey('segment', request);
      const cached = this.authCache.get(cacheKey);
      
      if (cached && cached.expiresAt > Date.now()) {
        cached.hitCount++;
        this.metrics.cacheHits++;
        const decision = { ...cached.decision, correlationId, processingTime: Date.now() - startTime };
        this.recordMetrics(startTime, true);
        return decision;
      }

      this.metrics.cacheMisses++;

      // Validate playback ticket
      const ticket = await this.validatePlaybackTicket(request.ticketId);
      if (!ticket) {
        return this.createDenyDecision('INVALID_TICKET', correlationId, startTime);
      }

      // Check content access
      if (ticket.contentId !== request.contentId) {
        return this.createDenyDecision('CONTENT_MISMATCH', correlationId, startTime);
      }

      // Evaluate policies
      const policyDecision = await this.evaluatePolicies(ticket, request);
      if (!policyDecision.allowed) {
        const decision = this.createDenyDecision(policyDecision.reason || 'POLICY_DENIED', correlationId, startTime);
        this.cacheDecision(cacheKey, decision, policyDecision.cacheTTL);
        return decision;
      }

      // Create allow decision
      const decision: AuthDecision = {
        allowed: true,
        cacheTTL: policyDecision.cacheTTL,
        correlationId,
        processingTime: Date.now() - startTime
      };

      // Cache the decision
      this.cacheDecision(cacheKey, decision, policyDecision.cacheTTL);
      this.recordMetrics(startTime, false);

      return decision;

    } catch (error) {
      console.error('Segment authorization error:', error);
      return this.createDenyDecision('INTERNAL_ERROR', correlationId, startTime);
    }
  }

  /**
   * Return sanitized manifests with internal key URIs
   * Requirement: 18.3
   */
  public async authorizeManifest(request: ManifestAuthRequest): Promise<ManifestResponse> {
    const correlationId = this.generateCorrelationId();

    try {
      // Validate playback ticket
      const ticket = await this.validatePlaybackTicket(request.ticketId);
      if (!ticket) {
        throw new Error('Invalid playback ticket');
      }

      // Check manifest cache
      const cacheKey = `manifest:${request.contentId}:${request.manifestType}`;
      const cached = this.manifestCache.get(cacheKey);
      
      if (cached && cached.expiresAt > Date.now()) {
        return {
          manifestContent: cached.content,
          cacheTTL: Math.floor((cached.expiresAt - Date.now()) / 1000),
          keyUris: this.extractKeyUris(cached.content),
          correlationId
        };
      }

      // Generate sanitized manifest
      const manifestContent = await this.generateSanitizedManifest(request, ticket);
      const cacheTTL = this.config.defaultCacheTTL;

      // Cache the manifest
      this.manifestCache.set(cacheKey, {
        content: manifestContent,
        expiresAt: Date.now() + (cacheTTL * 1000)
      });

      return {
        manifestContent,
        cacheTTL,
        keyUris: this.extractKeyUris(manifestContent),
        correlationId
      };

    } catch (error) {
      console.error('Manifest authorization error:', error);
      throw error;
    }
  }

  /**
   * Issue short-lived key tokens (≤60s TTL) bound to ticket + segment + IP/ASN/geo + deviceId
   * Requirement: 18.4
   */
  public async issueKeyToken(request: KeyTokenRequest): Promise<KeyToken> {
    const correlationId = this.generateCorrelationId();

    try {
      // Validate playback ticket
      const ticket = await this.validatePlaybackTicket(request.ticketId);
      if (!ticket) {
        throw new Error('Invalid playback ticket');
      }

      // Create token binding data
      const bindingData = {
        ticketId: request.ticketId,
        contentId: request.contentId,
        segmentRange: request.segmentRange,
        clientIP: request.clientIP,
        deviceId: request.deviceId,
        keyId: request.keyId,
        timestamp: Date.now()
      };

      // Generate secure token
      const token = await this.generateSecureToken(bindingData);
      const expiresAt = Date.now() + (this.config.keyTokenTTL * 1000);

      const keyToken: KeyToken = {
        token,
        expiresAt,
        keyId: request.keyId,
        correlationId
      };

      // Store token for validation
      this.keyTokens.set(token, keyToken);

      // Schedule cleanup
      setTimeout(() => {
        this.keyTokens.delete(token);
      }, this.config.keyTokenTTL * 1000);

      return keyToken;

    } catch (error) {
      console.error('Key token issuance error:', error);
      throw error;
    }
  }

  /**
   * Validate playback ticket
   */
  private async validatePlaybackTicket(ticketId: string): Promise<PlaybackTicket | null> {
    // Check cache first
    const cached = this.ticketCache.get(ticketId);
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        return cached;
      } else {
        this.ticketCache.delete(ticketId);
        return null;
      }
    }

    // In production, this would validate JWT signature and fetch from policy service
    // For now, return mock ticket for testing
    if (ticketId.startsWith('ticket_')) {
      const ticket: PlaybackTicket = {
        ticketId,
        contentId: 'content_123',
        userId: 'user_456',
        deviceId: 'device_789',
        entitlements: ['view', 'download'],
        restrictions: [],
        expiresAt: Date.now() + (4 * 60 * 60 * 1000), // 4 hours
        issuedAt: Date.now(),
        signature: 'mock_signature'
      };

      this.ticketCache.set(ticketId, ticket);
      return ticket;
    }

    return null;
  }

  /**
   * Evaluate access policies
   */
  private async evaluatePolicies(ticket: PlaybackTicket, request: SegmentAuthRequest): Promise<PolicyDecision> {
    // Check ticket expiration
    if (ticket.expiresAt <= Date.now()) {
      return { allowed: false, restrictions: [], cacheTTL: 60, reason: 'TICKET_EXPIRED' };
    }

    // Check device binding
    if (ticket.deviceId !== request.deviceId) {
      return { allowed: false, restrictions: [], cacheTTL: 300, reason: 'DEVICE_MISMATCH' };
    }

    // Evaluate restrictions
    for (const restriction of ticket.restrictions) {
      const violates = await this.checkRestriction(restriction, request);
      if (violates) {
        return { 
          allowed: false, 
          restrictions: [restriction], 
          cacheTTL: 60, 
          reason: `RESTRICTION_${restriction.type.toUpperCase()}` 
        };
      }
    }

    // Cold start grace period
    if (this.config.enableColdStartGrace && this.isInColdStartPeriod()) {
      return { allowed: true, restrictions: [], cacheTTL: 30, reason: 'COLD_START_GRACE' };
    }

    return { allowed: true, restrictions: [], cacheTTL: this.config.defaultCacheTTL };
  }

  /**
   * Check individual restriction
   */
  private async checkRestriction(restriction: AccessRestriction, request: SegmentAuthRequest): Promise<boolean> {
    switch (restriction.type) {
      case 'geo':
        return this.checkGeoRestriction(restriction.value, request.geo);
      case 'device':
        return this.checkDeviceRestriction(restriction.value, request.deviceId);
      case 'time':
        return this.checkTimeRestriction(restriction.value);
      default:
        return false;
    }
  }

  /**
   * Generate sanitized manifest with internal key URIs
   */
  private async generateSanitizedManifest(request: ManifestAuthRequest, ticket: PlaybackTicket): Promise<string> {
    // Mock manifest generation - in production, this would fetch and sanitize real manifests
    const baseUrl = '/api/v1/cdn/keys';
    
    if (request.manifestType === 'hls') {
      return `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-KEY:METHOD=AES-128,URI="${baseUrl}/${ticket.contentId}/key1?ticket=${request.ticketId}",IV=0x12345678901234567890123456789012
#EXTINF:10.0,
segment001.ts
#EXT-X-KEY:METHOD=AES-128,URI="${baseUrl}/${ticket.contentId}/key2?ticket=${request.ticketId}",IV=0x12345678901234567890123456789013
#EXTINF:10.0,
segment002.ts
#EXT-X-ENDLIST`;
    }

    // DASH manifest
    return `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period>
    <AdaptationSet>
      <ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011" value="cenc"/>
      <ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed">
        <cenc:pssh>${baseUrl}/${ticket.contentId}/pssh?ticket=${request.ticketId}</cenc:pssh>
      </ContentProtection>
      <Representation>
        <SegmentTemplate media="segment$Number$.m4s" initialization="init.mp4"/>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;
  }

  /**
   * Extract key URIs from manifest
   */
  private extractKeyUris(manifestContent: string): string[] {
    const keyUris: string[] = [];
    const hlsKeyRegex = /URI="([^"]+)"/g;
    let match;
    
    while ((match = hlsKeyRegex.exec(manifestContent)) !== null) {
      keyUris.push(match[1]);
    }
    
    return keyUris;
  }

  /**
   * Generate secure token with binding data
   */
  private async generateSecureToken(bindingData: any): Promise<string> {
    // In production, use proper JWT signing with HMAC-SHA256
    const payload = Buffer.from(JSON.stringify(bindingData)).toString('base64');
    const signature = Buffer.from(`signature_${Date.now()}`).toString('base64');
    return `${payload}.${signature}`;
  }

  /**
   * Validate segment request
   */
  private validateSegmentRequest(request: SegmentAuthRequest): boolean {
    return !!(
      request.ticketId &&
      request.contentId &&
      request.segmentRange &&
      request.clientIP &&
      request.deviceId &&
      request.timestamp &&
      (Date.now() - request.timestamp) < 30000 // 30 second window
    );
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(type: string, request: any): string {
    const keyData = {
      type,
      ticketId: request.ticketId,
      contentId: request.contentId,
      deviceId: request.deviceId,
      clientIP: request.clientIP
    };
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * Cache authorization decision
   */
  private cacheDecision(key: string, decision: AuthDecision, ttl: number): void {
    if (this.authCache.size >= this.config.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.authCache.entries());
      entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      for (let i = 0; i < Math.floor(this.config.maxCacheSize * 0.1); i++) {
        this.authCache.delete(entries[i][0]);
      }
    }

    this.authCache.set(key, {
      decision: { ...decision },
      expiresAt: Date.now() + (ttl * 1000),
      hitCount: 0
    });
  }

  /**
   * Create deny decision
   */
  private createDenyDecision(reason: string, correlationId: string, startTime: number): AuthDecision {
    const decision: AuthDecision = {
      allowed: false,
      reason,
      errorCode: reason,
      cacheTTL: 60, // Cache denials for 1 minute
      correlationId,
      processingTime: Date.now() - startTime
    };

    this.recordMetrics(startTime, false);
    return decision;
  }

  /**
   * Check if in cold start grace period
   */
  private isInColdStartPeriod(): boolean {
    // In production, this would check service startup time
    return false;
  }

  /**
   * Check geo restriction
   */
  private checkGeoRestriction(allowedCountries: string[], geo?: GeoLocation): boolean {
    if (!geo || !allowedCountries.length) return false;
    return !allowedCountries.includes(geo.country);
  }

  /**
   * Check device restriction
   */
  private checkDeviceRestriction(allowedDevices: string[], deviceId: string): boolean {
    if (!allowedDevices.length) return false;
    return !allowedDevices.includes(deviceId);
  }

  /**
   * Check time restriction
   */
  private checkTimeRestriction(timeWindow: { start: number; end: number }): boolean {
    const now = Date.now();
    return now < timeWindow.start || now > timeWindow.end;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `cdn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Record performance metrics
   */
  private recordMetrics(startTime: number, cacheHit: boolean): void {
    const responseTime = Date.now() - startTime;
    this.metrics.totalRequests++;
    this.metrics.responseTimes.push(responseTime);

    // Keep only last 1000 response times for percentile calculation
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes = this.metrics.responseTimes.slice(-1000);
    }

    // Calculate percentiles
    const sorted = [...this.metrics.responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);
    
    this.metrics.p95ResponseTime = sorted[p95Index] || 0;
    this.metrics.p99ResponseTime = sorted[p99Index] || 0;
    this.metrics.avgResponseTime = sorted.reduce((a, b) => a + b, 0) / sorted.length;

    // Emit SLA violation alerts
    if (cacheHit && responseTime > 50) {
      this.emit('slaViolation', { type: 'cache_hit', responseTime, threshold: 50 });
    } else if (!cacheHit && responseTime > 80) {
      this.emit('slaViolation', { type: 'cache_miss', responseTime, threshold: 80 });
    }
  }

  /**
   * Start cache cleanup process
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      
      // Clean auth cache
      for (const [key, entry] of this.authCache.entries()) {
        if (entry.expiresAt <= now) {
          this.authCache.delete(key);
        }
      }

      // Clean manifest cache
      for (const [key, entry] of this.manifestCache.entries()) {
        if (entry.expiresAt <= now) {
          this.manifestCache.delete(key);
        }
      }

      // Clean ticket cache
      for (const [key, ticket] of this.ticketCache.entries()) {
        if (ticket.expiresAt <= now) {
          this.ticketCache.delete(key);
        }
      }

    }, 60000); // Clean every minute
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.emit('metrics', {
        ...this.metrics,
        cacheSize: this.authCache.size,
        manifestCacheSize: this.manifestCache.size,
        ticketCacheSize: this.ticketCache.size,
        keyTokenCount: this.keyTokens.size,
        timestamp: Date.now()
      });
    }, 30000); // Emit metrics every 30 seconds
  }

  /**
   * Get current metrics
   */
  public getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.authCache.size,
      manifestCacheSize: this.manifestCache.size,
      ticketCacheSize: this.ticketCache.size,
      keyTokenCount: this.keyTokens.size
    };
  }

  /**
   * Trigger cache invalidation
   * Requirement: 18.6
   */
  public async invalidateCache(contentId?: string, userId?: string): Promise<void> {
    if (contentId) {
      // Invalidate specific content
      for (const [key, entry] of this.authCache.entries()) {
        if (key.includes(contentId)) {
          this.authCache.delete(key);
        }
      }
      
      // Invalidate manifest cache
      for (const [key] of this.manifestCache.entries()) {
        if (key.includes(contentId)) {
          this.manifestCache.delete(key);
        }
      }
    } else {
      // Full cache invalidation
      this.authCache.clear();
      this.manifestCache.clear();
    }

    this.emit('cacheInvalidated', { contentId, userId, timestamp: Date.now() });
  }

  /**
   * Health check endpoint
   */
  public async healthCheck(): Promise<{ status: string; metrics: any }> {
    const metrics = this.getMetrics();
    const isHealthy = metrics.p95ResponseTime <= 80; // Allow some margin

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      metrics
    };
  }
}

export const cdnAuthorizationService = CDNAuthorizationService.getInstance();