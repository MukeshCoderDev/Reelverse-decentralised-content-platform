import { logger } from '../utils/logger';
import { RedisService } from '../config/redis';
import { PolicyEngine } from './policyEngine';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export interface SegmentAuthRequest {
  ticketId: string;
  contentId: string;
  segmentRange: string;
  clientIP: string;
  deviceId: string;
  userAgent?: string;
  asn?: string;
  geo?: {
    country: string;
    region: string;
  };
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
  edgeHeaders?: Record<string, string>;
  rateLimit?: {
    remaining: number;
    resetTime: number;
  };
}

export interface ManifestResponse {
  allowed: boolean;
  manifestContent?: string;
  contentType: string;
  cacheTTL: number;
  reason?: string;
}

export interface KeyToken {
  token: string;
  expiresAt: Date;
  keyData?: string; // Base64 encoded key for AES-HLS
  licenseUrl?: string; // For DRM systems
}

export interface EdgeCachePolicy {
  segmentCacheTTL: number;
  manifestCacheTTL: number;
  keyTokenCacheTTL: number;
  errorCacheTTL: number;
}

export interface ContentManifest {
  contentId: string;
  manifestType: 'hls' | 'dash' | 'cmaf';
  baseUrl: string;
  segments: ManifestSegment[];
  keyIds: string[];
  duration: number;
  bitrates: number[];
}

export interface ManifestSegment {
  url: string;
  duration: number;
  byteRange?: string;
  keyId?: string;
  initSegment?: boolean;
}

export class CDNAuthService {
  private static instance: CDNAuthService;
  private redisService: RedisService;
  private policyEngine: PolicyEngine;
  private keySigningSecret: string;
  private manifestSigningSecret: string;
  private edgeCachePolicy: EdgeCachePolicy;

  private constructor() {
    this.redisService = RedisService.getInstance();
    this.policyEngine = PolicyEngine.getInstance();
    this.keySigningSecret = process.env.KEY_SIGNING_SECRET || 'your-key-signing-secret';
    this.manifestSigningSecret = process.env.MANIFEST_SIGNING_SECRET || 'your-manifest-signing-secret';
    
    this.edgeCachePolicy = {
      segmentCacheTTL: parseInt(process.env.SEGMENT_CACHE_TTL || '300'), // 5 minutes
      manifestCacheTTL: parseInt(process.env.MANIFEST_CACHE_TTL || '60'), // 1 minute
      keyTokenCacheTTL: parseInt(process.env.KEY_TOKEN_CACHE_TTL || '60'),
      errorCacheTTL: parseInt(process.env.ERROR_CACHE_TTL || '30')
    };

  }

  static getInstance() {
    if (!CDNAuthService.instance) CDNAuthService.instance = new CDNAuthService();
    return CDNAuthService.instance;
  }

  async authorizeSegment(req: SegmentAuthRequest): Promise<AuthDecision> {
    // minimal stub implementation
    return { allowed: true, cacheTTL: this.edgeCachePolicy.segmentCacheTTL };
  }

  async authorizeManifest(req: ManifestAuthRequest): Promise<ManifestResponse> {
    return { allowed: true, contentType: 'application/vnd.apple.mpegurl', cacheTTL: this.edgeCachePolicy.manifestCacheTTL };
  }

  async createKeyToken(req: KeyTokenRequest): Promise<KeyToken> {
    const token = jwt.sign({ ticketId: req.ticketId, contentId: req.contentId }, this.keySigningSecret, { expiresIn: this.edgeCachePolicy.keyTokenCacheTTL });
    return { token, expiresAt: new Date(Date.now() + this.edgeCachePolicy.keyTokenCacheTTL * 1000) };
  }

}
