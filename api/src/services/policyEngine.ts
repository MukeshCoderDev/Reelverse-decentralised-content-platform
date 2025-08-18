import { logger } from '../utils/logger';
import { RedisService } from '../config/redis';
import { AgeVerificationService } from './ageVerificationService';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface PolicyEvaluationRequest {
  contentId: string;
  userId: string;
  deviceId: string;
  ipAddress: string;
  geolocation: GeoLocation;
  userAgent: string;
  sessionId?: string;
}

export interface GeoLocation {
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  asn?: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  restrictions: AccessRestriction[];
  watermarkProfile?: WatermarkProfile;
  entitlements: EntitlementInfo[];
  deviceLimits: DeviceLimitInfo;
}

export interface AccessRestriction {
  type: 'geo' | 'age' | 'subscription' | 'device_limit' | 'content_unavailable';
  message: string;
  details?: any;
  canOverride: boolean;
}

export interface WatermarkProfile {
  type: 'static_overlay' | 'forensic_embedding' | 'session_based';
  position: WatermarkPosition;
  opacity: number;
  userData: UserWatermarkData;
}

export interface WatermarkPosition {
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
}

export interface UserWatermarkData {
  userId: string;
  sessionId: string;
  timestamp: number;
  displayText: string;
}

export interface EntitlementInfo {
  type: 'subscription' | 'ppv' | 'free';
  hasAccess: boolean;
  expiresAt?: Date;
  purchaseRequired?: boolean;
  price?: number;
  currency?: string;
}

export interface DeviceLimitInfo {
  currentDevices: number;
  maxDevices: number;
  canAddDevice: boolean;
  activeDevices: DeviceInfo[];
}

export interface DeviceInfo {
  deviceId: string;
  deviceName?: string;
  lastActiveAt: Date;
  ipAddress: string;
  userAgent: string;
  trusted: boolean;
}

export interface PlaybackTicket {
  ticketId: string;
  contentId: string;
  userId: string;
  deviceId: string;
  issuedAt: Date;
  expiresAt: Date;
  entitlements: string[];
  watermarkProfile: WatermarkProfile;
  restrictions: AccessRestriction[];
  signature: string;
}

export interface TicketValidation {
  valid: boolean;
  ticket?: PlaybackTicket;
  error?: string;
  remainingTTL?: number;
}

export interface ValidationContext {
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  segmentRange?: string;
  timestamp: Date;
}

export interface ContentPolicy {
  contentId: string;
  ageRestricted: boolean;
  geoRestrictions: string[]; // ISO country codes
  entitlementRequired: boolean;
  entitlementType?: 'subscription' | 'ppv';
  price?: number;
  currency?: string;
  deviceLimit: number;
  watermarkRequired: boolean;
  watermarkType: 'static_overlay' | 'forensic_embedding' | 'session_based';
  isActive: boolean;
  moderationStatus: 'approved' | 'pending' | 'blocked';
}

export class PolicyEngine {
  private static instance: PolicyEngine;
  private redisService: RedisService;
  private ageVerificationService: AgeVerificationService;
  private jwtSecret: string;
  private ticketSigningKey: string;

  private constructor() {
    this.redisService = RedisService.getInstance();
    this.ageVerificationService = AgeVerificationService.getInstance();
    this.jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret-key';
    this.ticketSigningKey = process.env.TICKET_SIGNING_KEY || 'your-ticket-signing-key';
  }

  public static getInstance(): PolicyEngine {
    if (!PolicyEngine.instance) {
      PolicyEngine.instance = new PolicyEngine();
    }
    return PolicyEngine.instance;
  }

  /**
   * Evaluate access policies for content
   */
  async evaluateAccess(request: PolicyEvaluationRequest): Promise<PolicyDecision> {
    try {
      logger.info(`Evaluating access policies for content ${request.contentId} by user ${request.userId}`);

      const restrictions: AccessRestriction[] = [];
      let watermarkProfile: WatermarkProfile | undefined;
      let entitlements: EntitlementInfo[] = [];
      let deviceLimits: DeviceLimitInfo;

      // 1. Get content policy
      const contentPolicy = await this.getContentPolicy(request.contentId);
      if (!contentPolicy) {
        return {
          allowed: false,
          reason: 'Content not found or unavailable',
          restrictions: [{
            type: 'content_unavailable',
            message: 'Content not found or unavailable',
            canOverride: false
          }],
          entitlements: [],
          deviceLimits: { currentDevices: 0, maxDevices: 0, canAddDevice: false, activeDevices: [] }
        };
      }

      // 2. Check content availability
      if (!contentPolicy.isActive || contentPolicy.moderationStatus !== 'approved') {
        restrictions.push({
          type: 'content_unavailable',
          message: 'Content is not available',
          details: { 
            active: contentPolicy.isActive, 
            moderationStatus: contentPolicy.moderationStatus 
          },
          canOverride: false
        });
      }

      // 3. Check age verification
      if (contentPolicy.ageRestricted) {
        const ageCheckResult = await this.checkAgeVerification(request.userId);
        if (!ageCheckResult.allowed) {
          restrictions.push(ageCheckResult.restriction);
        }
      }

      // 4. Check geographic restrictions
      if (contentPolicy.geoRestrictions.length > 0) {
        const geoCheckResult = await this.checkGeographicRestrictions(
          request.geolocation, 
          contentPolicy.geoRestrictions
        );
        if (!geoCheckResult.allowed) {
          restrictions.push(geoCheckResult.restriction);
        }
      }

      // 5. Check entitlements
      entitlements = await this.checkEntitlements(request.userId, contentPolicy);
      const hasValidEntitlement = entitlements.some(e => e.hasAccess);
      
      if (contentPolicy.entitlementRequired && !hasValidEntitlement) {
        restrictions.push({
          type: 'subscription',
          message: `${contentPolicy.entitlementType === 'ppv' ? 'Purchase' : 'Subscription'} required to access this content`,
          details: {
            entitlementType: contentPolicy.entitlementType,
            price: contentPolicy.price,
            currency: contentPolicy.currency
          },
          canOverride: false
        });
      }

      // 6. Check device limits
      deviceLimits = await this.checkDeviceLimits(request.userId, request.deviceId, contentPolicy.deviceLimit);
      if (!deviceLimits.canAddDevice && deviceLimits.currentDevices >= deviceLimits.maxDevices) {
        const deviceExists = deviceLimits.activeDevices.some(d => d.deviceId === request.deviceId);
        if (!deviceExists) {
          restrictions.push({
            type: 'device_limit',
            message: 'Device limit reached. Please remove a device or upgrade your plan.',
            details: {
              currentDevices: deviceLimits.currentDevices,
              maxDevices: deviceLimits.maxDevices,
              activeDevices: deviceLimits.activeDevices
            },
            canOverride: false
          });
        }
      }

      // 7. Generate watermark profile if required
      if (contentPolicy.watermarkRequired) {
        watermarkProfile = await this.generateWatermarkProfile(
          request.userId,
          request.sessionId || crypto.randomUUID(),
          contentPolicy.watermarkType
        );
      }

      const allowed = restrictions.length === 0;
      
      logger.info(`Policy evaluation result for content ${request.contentId}: ${allowed ? 'ALLOWED' : 'DENIED'}`);
      
      return {
        allowed,
        reason: allowed ? undefined : restrictions.map(r => r.message).join('; '),
        restrictions,
        watermarkProfile,
        entitlements,
        deviceLimits
      };

    } catch (error) {
      logger.error('Error evaluating access policies:', error);
      return {
        allowed: false,
        reason: 'Policy evaluation failed due to system error',
        restrictions: [{
          type: 'content_unavailable',
          message: 'Access check failed due to system error',
          canOverride: false
        }],
        entitlements: [],
        deviceLimits: { currentDevices: 0, maxDevices: 0, canAddDevice: false, activeDevices: [] }
      };
    }
  }

  /**
   * Create signed playback ticket with embedded entitlements
   */
  async createPlaybackTicket(
    contentId: string, 
    userId: string, 
    policyDecision: PolicyDecision,
    deviceId: string,
    ttlMinutes: number = 5
  ): Promise<PlaybackTicket> {
    try {
      const ticketId = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (ttlMinutes * 60 * 1000));

      const ticket: Omit<PlaybackTicket, 'signature'> = {
        ticketId,
        contentId,
        userId,
        deviceId,
        issuedAt: now,
        expiresAt,
        entitlements: policyDecision.entitlements.filter(e => e.hasAccess).map(e => e.type),
        watermarkProfile: policyDecision.watermarkProfile!,
        restrictions: policyDecision.restrictions
      };

      // Sign the ticket
      const ticketData = JSON.stringify(ticket);
      const signature = crypto
        .createHmac('sha256', this.ticketSigningKey)
        .update(ticketData)
        .digest('hex');

      const signedTicket: PlaybackTicket = {
        ...ticket,
        signature
      };

      // Store ticket in Redis with TTL
      const ticketKey = `ticket:${ticketId}`;
      await this.redisService.set(
        ticketKey,
        JSON.stringify(signedTicket),
        ttlMinutes * 60
      );

      // Track active tickets for user
      const userTicketKey = `user_tickets:${userId}`;
      await this.redisService.sadd(userTicketKey, ticketId);
      await this.redisService.expire(userTicketKey, ttlMinutes * 60);

      logger.info(`Created playback ticket ${ticketId} for content ${contentId}, user ${userId}`);
      
      return signedTicket;

    } catch (error) {
      logger.error('Error creating playback ticket:', error);
      throw new Error('Failed to create playback ticket');
    }
  }

  /**
   * Validate playback ticket
   */
  async validateTicket(ticketId: string, context: ValidationContext): Promise<TicketValidation> {
    try {
      // Get ticket from Redis
      const ticketKey = `ticket:${ticketId}`;
      const ticketData = await this.redisService.get(ticketKey);
      
      if (!ticketData) {
        return {
          valid: false,
          error: 'Ticket not found or expired'
        };
      }

      const ticket: PlaybackTicket = JSON.parse(ticketData);

      // Check expiration
      if (new Date() > ticket.expiresAt) {
        return {
          valid: false,
          error: 'Ticket has expired'
        };
      }

      // Verify signature
      const ticketForVerification = { ...ticket };
      delete (ticketForVerification as any).signature;
      const expectedSignature = crypto
        .createHmac('sha256', this.ticketSigningKey)
        .update(JSON.stringify(ticketForVerification))
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(ticket.signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
        return {
          valid: false,
          error: 'Invalid ticket signature'
        };
      }

      // Validate context (device binding)
      if (ticket.deviceId !== context.deviceId) {
        return {
          valid: false,
          error: 'Ticket is bound to a different device'
        };
      }

      // Get remaining TTL
      const remainingTTL = await this.redisService.ttl(ticketKey);

      return {
        valid: true,
        ticket,
        remainingTTL: remainingTTL > 0 ? remainingTTL : 0
      };

    } catch (error) {
      logger.error('Error validating ticket:', error);
      return {
        valid: false,
        error: 'Ticket validation failed'
      };
    }
  }

  /**
   * Check age verification status
   */
  private async checkAgeVerification(userId: string): Promise<{
    allowed: boolean;
    restriction?: AccessRestriction;
  }> {
    try {
      const verificationStatus = await this.ageVerificationService.getVerificationStatus(userId);
      
      if (verificationStatus.status !== 'verified') {
        return {
          allowed: false,
          restriction: {
            type: 'age',
            message: 'Age verification required to access this content',
            details: {
              currentStatus: verificationStatus.status,
              provider: verificationStatus.provider
            },
            canOverride: false
          }
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Error checking age verification:', error);
      return {
        allowed: false,
        restriction: {
          type: 'age',
          message: 'Unable to verify age status',
          canOverride: false
        }
      };
    }
  }

  /**
   * Check geographic restrictions
   */
  private async checkGeographicRestrictions(
    geolocation: GeoLocation,
    restrictedCountries: string[]
  ): Promise<{
    allowed: boolean;
    restriction?: AccessRestriction;
  }> {
    try {
      // Check if user's country is in restricted list
      if (restrictedCountries.includes(geolocation.country.toUpperCase())) {
        return {
          allowed: false,
          restriction: {
            type: 'geo',
            message: 'Content is not available in your region',
            details: {
              userCountry: geolocation.country,
              restrictedCountries
            },
            canOverride: false
          }
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Error checking geographic restrictions:', error);
      // On error, allow access (fail open for geo restrictions)
      return { allowed: true };
    }
  }

  /**
   * Check user entitlements
   */
  private async checkEntitlements(userId: string, contentPolicy: ContentPolicy): Promise<EntitlementInfo[]> {
    try {
      const entitlements: EntitlementInfo[] = [];

      if (!contentPolicy.entitlementRequired) {
        entitlements.push({
          type: 'free',
          hasAccess: true
        });
        return entitlements;
      }

      // Check subscription entitlements
      if (contentPolicy.entitlementType === 'subscription') {
        const subscription = await this.getUserSubscription(userId);
        entitlements.push({
          type: 'subscription',
          hasAccess: subscription.active,
          expiresAt: subscription.expiresAt,
          purchaseRequired: !subscription.active
        });
      }

      // Check PPV entitlements
      if (contentPolicy.entitlementType === 'ppv') {
        const ppvAccess = await this.getUserPPVAccess(userId, contentPolicy.contentId);
        entitlements.push({
          type: 'ppv',
          hasAccess: ppvAccess.purchased,
          purchaseRequired: !ppvAccess.purchased,
          price: contentPolicy.price,
          currency: contentPolicy.currency
        });
      }

      return entitlements;
    } catch (error) {
      logger.error('Error checking entitlements:', error);
      return [{
        type: contentPolicy.entitlementType || 'subscription',
        hasAccess: false,
        purchaseRequired: true
      }];
    }
  }

  /**
   * Check device limits and manage device registration
   */
  private async checkDeviceLimits(userId: string, deviceId: string, maxDevices: number): Promise<DeviceLimitInfo> {
    try {
      const userDevicesKey = `user_devices:${userId}`;
      const deviceKeys = await this.redisService.smembers(userDevicesKey);
      
      const activeDevices: DeviceInfo[] = [];
      
      // Check each registered device
      for (const key of deviceKeys) {
        const deviceData = await this.redisService.get(`device:${key}`);
        if (deviceData) {
          const device: DeviceInfo = JSON.parse(deviceData);
          // Only count devices active in last 30 days
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          if (device.lastActiveAt > thirtyDaysAgo) {
            activeDevices.push(device);
          }
        }
      }

      const currentDevices = activeDevices.length;
      const deviceExists = activeDevices.some(d => d.deviceId === deviceId);
      const canAddDevice = deviceExists || currentDevices < maxDevices;

      // Register/update current device if allowed
      if (canAddDevice) {
        await this.registerDevice(userId, deviceId);
      }

      return {
        currentDevices,
        maxDevices,
        canAddDevice,
        activeDevices
      };
    } catch (error) {
      logger.error('Error checking device limits:', error);
      return {
        currentDevices: 0,
        maxDevices,
        canAddDevice: true,
        activeDevices: []
      };
    }
  }

  /**
   * Generate watermark profile for content
   */
  private async generateWatermarkProfile(
    userId: string,
    sessionId: string,
    watermarkType: 'static_overlay' | 'forensic_embedding' | 'session_based'
  ): Promise<WatermarkProfile> {
    const userData: UserWatermarkData = {
      userId: userId.substring(0, 8) + '...' + userId.substring(userId.length - 6),
      sessionId: sessionId.substring(0, 8),
      timestamp: Date.now(),
      displayText: `${userId.substring(0, 6)}...${userId.substring(userId.length - 4)} | ${sessionId.substring(0, 8)}`
    };

    return {
      type: watermarkType,
      position: {
        x: 85, // Bottom right
        y: 90,
        anchor: 'bottom-right'
      },
      opacity: 0.7,
      userData
    };
  }

  /**
   * Get content policy from cache or database
   */
  private async getContentPolicy(contentId: string): Promise<ContentPolicy | null> {
    try {
      const cacheKey = `content_policy:${contentId}`;
      const cachedPolicy = await this.redisService.get(cacheKey);
      
      if (cachedPolicy) {
        return JSON.parse(cachedPolicy);
      }

      // TODO: Implement actual database query
      // For now, return mock policy
      const mockPolicy: ContentPolicy = {
        contentId,
        ageRestricted: true,
        geoRestrictions: [], // No geo restrictions for now
        entitlementRequired: true,
        entitlementType: 'ppv',
        price: 10.00,
        currency: 'USD',
        deviceLimit: 3,
        watermarkRequired: true,
        watermarkType: 'session_based',
        isActive: true,
        moderationStatus: 'approved'
      };

      // Cache for 5 minutes
      await this.redisService.set(cacheKey, JSON.stringify(mockPolicy), 300);
      
      return mockPolicy;
    } catch (error) {
      logger.error('Error getting content policy:', error);
      return null;
    }
  }

  /**
   * Get user subscription status
   */
  private async getUserSubscription(userId: string): Promise<{
    active: boolean;
    expiresAt?: Date;
  }> {
    try {
      // TODO: Implement actual subscription check
      return {
        active: false, // Default to no subscription
        expiresAt: undefined
      };
    } catch (error) {
      logger.error('Error getting user subscription:', error);
      return { active: false };
    }
  }

  /**
   * Get user PPV access for content
   */
  private async getUserPPVAccess(userId: string, contentId: string): Promise<{
    purchased: boolean;
  }> {
    try {
      // TODO: Implement actual PPV check
      return {
        purchased: false // Default to no purchase
      };
    } catch (error) {
      logger.error('Error getting user PPV access:', error);
      return { purchased: false };
    }
  }

  /**
   * Register or update device information
   */
  private async registerDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const deviceInfo: DeviceInfo = {
        deviceId,
        lastActiveAt: new Date(),
        ipAddress: '', // Will be filled by caller
        userAgent: '', // Will be filled by caller
        trusted: false
      };

      const deviceKey = `device:${deviceId}`;
      await this.redisService.set(deviceKey, JSON.stringify(deviceInfo), 30 * 24 * 60 * 60); // 30 days

      const userDevicesKey = `user_devices:${userId}`;
      await this.redisService.sadd(userDevicesKey, deviceId);
      await this.redisService.expire(userDevicesKey, 30 * 24 * 60 * 60); // 30 days

    } catch (error) {
      logger.error('Error registering device:', error);
    }
  }

  /**
   * Revoke all tickets for a user (for emergency access revocation)
   */
  async revokeUserTickets(userId: string): Promise<number> {
    try {
      const userTicketKey = `user_tickets:${userId}`;
      const ticketIds = await this.redisService.smembers(userTicketKey);
      
      let revokedCount = 0;
      for (const ticketId of ticketIds) {
        const ticketKey = `ticket:${ticketId}`;
        const deleted = await this.redisService.del(ticketKey);
        if (deleted) revokedCount++;
      }

      // Clear user ticket set
      await this.redisService.del(userTicketKey);

      logger.info(`Revoked ${revokedCount} tickets for user ${userId}`);
      return revokedCount;
    } catch (error) {
      logger.error('Error revoking user tickets:', error);
      return 0;
    }
  }

  /**
   * Revoke all tickets for content (for takedown scenarios)
   */
  async revokeContentTickets(contentId: string): Promise<number> {
    try {
      // This would require indexing tickets by content ID
      // For now, we'll implement a simple scan approach
      const pattern = 'ticket:*';
      const keys = await this.redisService.keys(pattern);
      
      let revokedCount = 0;
      for (const key of keys) {
        const ticketData = await this.redisService.get(key);
        if (ticketData) {
          const ticket: PlaybackTicket = JSON.parse(ticketData);
          if (ticket.contentId === contentId) {
            await this.redisService.del(key);
            revokedCount++;
          }
        }
      }

      logger.info(`Revoked ${revokedCount} tickets for content ${contentId}`);
      return revokedCount;
    } catch (error) {
      logger.error('Error revoking content tickets:', error);
      return 0;
    }
  }
}