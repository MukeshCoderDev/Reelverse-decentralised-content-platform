import { logger } from '../utils/logger';
import { AgeVerificationService } from './ageVerificationService';
import { RedisService } from '../config/redis';
import { PolicyEngine, PolicyEvaluationRequest } from './policyEngine';
import axios from 'axios';

export interface AccessCheckRequest {
  contentId: string;
  userAddress: string;
  userIP?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  reasons: AccessDenialReason[];
  accessToken?: string;
  expiresAt?: Date;
  watermarkId?: string;
}

export interface AccessDenialReason {
  type: 'age_verification' | 'geographic_restriction' | 'entitlement_required' | 'content_unavailable' | 'moderation_block';
  message: string;
  details?: any;
}

export interface ContentMetadata {
  id: string;
  creatorAddress: string;
  title: string;
  ageRestricted: boolean;
  geographicRestrictions: string[]; // ISO country codes
  entitlementRequired: boolean;
  entitlementType?: 'ppv' | 'subscription';
  entitlementPrice?: string;
  moderationStatus: 'approved' | 'pending' | 'blocked';
  isActive: boolean;
}

export interface GeolocationResult {
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
}

export interface EntitlementCheck {
  hasAccess: boolean;
  entitlementType?: string;
  expiresAt?: Date;
  tokenId?: string;
}

export class ContentAccessService {
  private static instance: ContentAccessService;
  private ageVerificationService: AgeVerificationService;
  private redisService: RedisService;
  private policyEngine: PolicyEngine;
  private geoipApiKey: string;

  private constructor() {
    this.ageVerificationService = AgeVerificationService.getInstance();
    this.redisService = RedisService.getInstance();
    this.policyEngine = PolicyEngine.getInstance();
    this.geoipApiKey = process.env.GEOIP_API_KEY || '';
  }

  public static getInstance(): ContentAccessService {
    if (!ContentAccessService.instance) {
      ContentAccessService.instance = new ContentAccessService();
    }
    return ContentAccessService.instance;
  }

  /**
   * Perform comprehensive access check for content using new policy engine
   */
  async checkAccessWithPolicyEngine(request: AccessCheckRequest): Promise<AccessCheckResult> {
    try {
      logger.info(`Checking access with policy engine for content ${request.contentId} by user ${request.userAddress}`);

      // Get geolocation if IP is provided
      let geolocation = {
        country: 'US',
        region: 'Unknown',
        city: 'Unknown',
        latitude: 0,
        longitude: 0
      };

      if (request.userIP) {
        geolocation = await this.getGeolocation(request.userIP);
      }

      // Create policy evaluation request
      const policyRequest: PolicyEvaluationRequest = {
        contentId: request.contentId,
        userId: request.userAddress,
        deviceId: request.sessionId || 'unknown-device',
        ipAddress: request.userIP || '127.0.0.1',
        geolocation,
        userAgent: request.userAgent || '',
        sessionId: request.sessionId
      };

      // Evaluate access using policy engine
      const policyDecision = await this.policyEngine.evaluateAccess(policyRequest);

      if (!policyDecision.allowed) {
        const reasons: AccessDenialReason[] = policyDecision.restrictions.map(restriction => ({
          type: restriction.type as any,
          message: restriction.message,
          details: restriction.details
        }));

        return {
          allowed: false,
          reasons
        };
      }

      // Create playback ticket if access is allowed
      const ticket = await this.policyEngine.createPlaybackTicket(
        request.contentId,
        request.userAddress,
        policyDecision,
        policyRequest.deviceId,
        240 // 4 hours TTL
      );

      // Generate access token (legacy format for compatibility)
      const accessToken = await this.generateAccessToken(request, {
        id: request.contentId,
        creatorAddress: 'unknown',
        title: 'Content',
        ageRestricted: policyDecision.restrictions.some(r => r.type === 'age'),
        geographicRestrictions: [],
        entitlementRequired: policyDecision.entitlements.some(e => e.purchaseRequired),
        moderationStatus: 'approved',
        isActive: true
      });

      logger.info(`Access granted with policy engine for content ${request.contentId} to user ${request.userAddress}`);

      return {
        allowed: true,
        reasons: [],
        accessToken,
        expiresAt: ticket.expiresAt,
        watermarkId: policyDecision.watermarkProfile?.userData.sessionId
      };

    } catch (error) {
      logger.error('Error checking content access with policy engine:', error);
      return {
        allowed: false,
        reasons: [{
          type: 'content_unavailable',
          message: 'Access check failed due to system error'
        }]
      };
    }
  }

  /**
   * Perform comprehensive access check for content (legacy method)
   */
  async checkAccess(request: AccessCheckRequest): Promise<AccessCheckResult> {
    try {
      logger.info(`Checking access for content ${request.contentId} by user ${request.userAddress}`);

      const reasons: AccessDenialReason[] = [];

      // 1. Get content metadata
      const content = await this.getContentMetadata(request.contentId);
      if (!content) {
        return {
          allowed: false,
          reasons: [{
            type: 'content_unavailable',
            message: 'Content not found or unavailable'
          }]
        };
      }

      // 2. Check if content is active and not blocked by moderation
      if (!content.isActive || content.moderationStatus === 'blocked') {
        reasons.push({
          type: 'content_unavailable',
          message: 'Content is not available',
          details: { 
            active: content.isActive, 
            moderationStatus: content.moderationStatus 
          }
        });
      }

      // 3. Check age verification if content is age-restricted
      if (content.ageRestricted) {
        const ageCheckResult = await this.checkAgeVerification(request.userAddress);
        if (!ageCheckResult.allowed) {
          reasons.push(ageCheckResult.reason);
        }
      }

      // 4. Check geographic restrictions
      if (content.geographicRestrictions.length > 0 && request.userIP) {
        const geoCheckResult = await this.checkGeographicRestrictions(
          request.userIP, 
          content.geographicRestrictions
        );
        if (!geoCheckResult.allowed) {
          reasons.push(geoCheckResult.reason);
        }
      }

      // 5. Check entitlement requirements
      if (content.entitlementRequired) {
        const entitlementCheckResult = await this.checkEntitlements(
          request.userAddress,
          request.contentId,
          content
        );
        if (!entitlementCheckResult.allowed) {
          reasons.push(entitlementCheckResult.reason);
        }
      }

      // If any checks failed, deny access
      if (reasons.length > 0) {
        return {
          allowed: false,
          reasons
        };
      }

      // All checks passed - generate access token
      const accessToken = await this.generateAccessToken(request, content);
      const watermarkId = await this.generateWatermarkId(request.userAddress, request.sessionId);

      logger.info(`Access granted for content ${request.contentId} to user ${request.userAddress}`);

      return {
        allowed: true,
        reasons: [],
        accessToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        watermarkId
      };

    } catch (error) {
      logger.error('Error checking content access:', error);
      return {
        allowed: false,
        reasons: [{
          type: 'content_unavailable',
          message: 'Access check failed due to system error'
        }]
      };
    }
  }

  /**
   * Check age verification status
   */
  private async checkAgeVerification(userAddress: string): Promise<{
    allowed: boolean;
    reason?: AccessDenialReason;
  }> {
    try {
      const verificationStatus = await this.ageVerificationService.getVerificationStatus(userAddress);
      
      if (verificationStatus.status !== 'verified') {
        return {
          allowed: false,
          reason: {
            type: 'age_verification',
            message: 'Age verification required to access this content',
            details: {
              currentStatus: verificationStatus.status,
              provider: verificationStatus.provider
            }
          }
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Error checking age verification:', error);
      return {
        allowed: false,
        reason: {
          type: 'age_verification',
          message: 'Unable to verify age status'
        }
      };
    }
  }

  /**
   * Check geographic restrictions based on IP address
   */
  private async checkGeographicRestrictions(
    userIP: string, 
    restrictedCountries: string[]
  ): Promise<{
    allowed: boolean;
    reason?: AccessDenialReason;
  }> {
    try {
      // Check cache first
      const cacheKey = `geoip:${userIP}`;
      const cachedResult = await this.redisService.get(cacheKey);
      
      let geolocation: GeolocationResult;
      
      if (cachedResult) {
        geolocation = JSON.parse(cachedResult);
      } else {
        geolocation = await this.getGeolocation(userIP);
        // Cache for 1 hour
        await this.redisService.set(cacheKey, JSON.stringify(geolocation), 3600);
      }

      // Check if user's country is in restricted list
      if (restrictedCountries.includes(geolocation.country.toUpperCase())) {
        return {
          allowed: false,
          reason: {
            type: 'geographic_restriction',
            message: 'Content is not available in your region',
            details: {
              userCountry: geolocation.country,
              restrictedCountries
            }
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
   * Check user entitlements for content
   */
  private async checkEntitlements(
    userAddress: string,
    contentId: string,
    content: ContentMetadata
  ): Promise<{
    allowed: boolean;
    reason?: AccessDenialReason;
  }> {
    try {
      const entitlement = await this.getUserEntitlement(userAddress, contentId);
      
      if (!entitlement.hasAccess) {
        return {
          allowed: false,
          reason: {
            type: 'entitlement_required',
            message: `${content.entitlementType === 'ppv' ? 'Purchase' : 'Subscription'} required to access this content`,
            details: {
              entitlementType: content.entitlementType,
              price: content.entitlementPrice,
              contentId
            }
          }
        };
      }

      // Check if entitlement has expired
      if (entitlement.expiresAt && new Date() > entitlement.expiresAt) {
        return {
          allowed: false,
          reason: {
            type: 'entitlement_required',
            message: 'Your access to this content has expired',
            details: {
              expiredAt: entitlement.expiresAt,
              entitlementType: entitlement.entitlementType
            }
          }
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Error checking entitlements:', error);
      return {
        allowed: false,
        reason: {
          type: 'entitlement_required',
          message: 'Unable to verify content access rights'
        }
      };
    }
  }

  /**
   * Get content metadata from database/blockchain
   */
  private async getContentMetadata(contentId: string): Promise<ContentMetadata | null> {
    try {
      // Check cache first
      const cacheKey = `content:${contentId}`;
      const cachedContent = await this.redisService.get(cacheKey);
      
      if (cachedContent) {
        return JSON.parse(cachedContent);
      }

      // TODO: Implement actual database/blockchain query
      // For now, return mock data
      const mockContent: ContentMetadata = {
        id: contentId,
        creatorAddress: '0x1234567890123456789012345678901234567890',
        title: 'Sample Content',
        ageRestricted: true,
        geographicRestrictions: ['US', 'UK'], // Example restrictions
        entitlementRequired: true,
        entitlementType: 'ppv',
        entitlementPrice: '10.00',
        moderationStatus: 'approved',
        isActive: true
      };

      // Cache for 5 minutes
      await this.redisService.set(cacheKey, JSON.stringify(mockContent), 300);
      
      return mockContent;
    } catch (error) {
      logger.error('Error getting content metadata:', error);
      return null;
    }
  }

  /**
   * Get user's geolocation from IP address
   */
  private async getGeolocation(ip: string): Promise<GeolocationResult> {
    try {
      // Use a free geolocation service (replace with your preferred provider)
      const response = await axios.get(`http://ip-api.com/json/${ip}`, {
        timeout: 5000
      });

      if (response.data.status === 'success') {
        return {
          country: response.data.countryCode,
          region: response.data.regionName,
          city: response.data.city,
          latitude: response.data.lat,
          longitude: response.data.lon
        };
      }

      throw new Error('Geolocation lookup failed');
    } catch (error) {
      logger.error('Error getting geolocation:', error);
      // Return default location on error
      return {
        country: 'US',
        region: 'Unknown',
        city: 'Unknown',
        latitude: 0,
        longitude: 0
      };
    }
  }

  /**
   * Check user's entitlement for specific content
   */
  private async getUserEntitlement(userAddress: string, contentId: string): Promise<EntitlementCheck> {
    try {
      // Check cache first
      const cacheKey = `entitlement:${userAddress}:${contentId}`;
      const cachedEntitlement = await this.redisService.get(cacheKey);
      
      if (cachedEntitlement) {
        return JSON.parse(cachedEntitlement);
      }

      // TODO: Implement actual blockchain query to check NFT ownership
      // For now, return mock data
      const mockEntitlement: EntitlementCheck = {
        hasAccess: false, // Default to no access
        entitlementType: 'ppv',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        tokenId: '123'
      };

      // Cache for 1 minute (short cache for entitlements)
      await this.redisService.set(cacheKey, JSON.stringify(mockEntitlement), 60);
      
      return mockEntitlement;
    } catch (error) {
      logger.error('Error checking user entitlement:', error);
      return { hasAccess: false };
    }
  }

  /**
   * Generate access token for authorized content access
   */
  private async generateAccessToken(request: AccessCheckRequest, content: ContentMetadata): Promise<string> {
    const tokenData = {
      contentId: request.contentId,
      userAddress: request.userAddress,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      sessionId: request.sessionId,
      contentTitle: content.title
    };

    // TODO: Implement JWT signing with proper secret
    // For now, return base64 encoded data
    return Buffer.from(JSON.stringify(tokenData)).toString('base64');
  }

  /**
   * Generate watermark ID for video playback
   */
  private async generateWatermarkId(userAddress: string, sessionId?: string): Promise<string> {
    const watermarkData = {
      address: userAddress.substring(0, 8) + '...' + userAddress.substring(userAddress.length - 6),
      session: sessionId?.substring(0, 8) || 'unknown',
      timestamp: Date.now()
    };

    return Buffer.from(JSON.stringify(watermarkData)).toString('base64');
  }

  /**
   * Validate access token
   */
  async validateAccessToken(token: string, contentId: string): Promise<{
    valid: boolean;
    userAddress?: string;
    expiresAt?: Date;
  }> {
    try {
      // TODO: Implement JWT verification
      // For now, decode base64
      const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
      
      if (tokenData.contentId !== contentId) {
        return { valid: false };
      }

      if (new Date() > new Date(tokenData.expiresAt)) {
        return { valid: false };
      }

      return {
        valid: true,
        userAddress: tokenData.userAddress,
        expiresAt: new Date(tokenData.expiresAt)
      };
    } catch (error) {
      logger.error('Error validating access token:', error);
      return { valid: false };
    }
  }

  /**
   * Log access attempt for audit trail
   */
  async logAccessAttempt(request: AccessCheckRequest, result: AccessCheckResult): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        contentId: request.contentId,
        userAddress: request.userAddress,
        userIP: request.userIP,
        allowed: result.allowed,
        reasons: result.reasons,
        sessionId: request.sessionId,
        watermarkId: result.watermarkId
      };

      // Store in Redis for recent access logs (24 hours)
      const logKey = `access_log:${Date.now()}:${request.userAddress}:${request.contentId}`;
      await this.redisService.set(logKey, JSON.stringify(logEntry), 86400);

      logger.info('Access attempt logged:', logEntry);
    } catch (error) {
      logger.error('Error logging access attempt:', error);
    }
  }
}