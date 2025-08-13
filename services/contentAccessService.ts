/**
 * Frontend Content Access Service
 * Handles content access control and playback authorization
 */

export interface AccessCheckRequest {
  contentId: string;
  userAddress: string;
  sessionId?: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  reasons: AccessDenialReason[];
  accessToken?: string;
  expiresAt?: string;
  watermarkId?: string;
}

export interface AccessDenialReason {
  type: 'age_verification' | 'geographic_restriction' | 'entitlement_required' | 'content_unavailable' | 'moderation_block';
  message: string;
  details?: any;
}

export interface PlaybackTokenRequest {
  contentId: string;
  userAddress: string;
  accessToken: string;
  sessionId?: string;
}

export interface PlaybackTokenResult {
  hlsUrl: string;
  token: string;
  watermarkId: string;
  expiresAt: string;
  sessionId?: string;
}

export interface ContentRequirements {
  ageVerificationRequired: boolean;
  geographicRestrictions: string[];
  entitlementRequired: boolean;
  entitlementType?: 'ppv' | 'subscription';
  price?: string;
  currency?: string;
}

export class ContentAccessService {
  private static instance: ContentAccessService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  public static getInstance(): ContentAccessService {
    if (!ContentAccessService.instance) {
      ContentAccessService.instance = new ContentAccessService();
    }
    return ContentAccessService.instance;
  }

  /**
   * Check if user can access specific content
   */
  async checkAccess(request: AccessCheckRequest): Promise<AccessCheckResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/content/${request.contentId}/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress: request.userAddress,
          sessionId: request.sessionId
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Access check failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error checking content access:', error);
      throw error;
    }
  }

  /**
   * Get playback token for authorized content
   */
  async getPlaybackToken(request: PlaybackTokenRequest): Promise<PlaybackTokenResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/content/playback-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Playback token request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting playback token:', error);
      throw error;
    }
  }

  /**
   * Get content requirements (public endpoint)
   */
  async getContentRequirements(contentId: string): Promise<ContentRequirements> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/content/${contentId}/requirements`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get content requirements: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting content requirements:', error);
      throw error;
    }
  }

  /**
   * Complete access flow: check access and get playback token if authorized
   */
  async getAuthorizedPlayback(
    contentId: string,
    userAddress: string,
    sessionId?: string
  ): Promise<{
    success: boolean;
    playbackData?: PlaybackTokenResult;
    accessResult?: AccessCheckResult;
  }> {
    try {
      // First check access
      const accessResult = await this.checkAccess({
        contentId,
        userAddress,
        sessionId
      });

      if (!accessResult.allowed) {
        return {
          success: false,
          accessResult
        };
      }

      // If access is allowed, get playback token
      const playbackData = await this.getPlaybackToken({
        contentId,
        userAddress,
        accessToken: accessResult.accessToken!,
        sessionId
      });

      return {
        success: true,
        playbackData,
        accessResult
      };
    } catch (error) {
      console.error('Error getting authorized playback:', error);
      throw error;
    }
  }

  /**
   * Get user-friendly message for access denial reasons
   */
  getAccessDenialMessage(reasons: AccessDenialReason[]): string {
    if (reasons.length === 0) {
      return 'Access denied for unknown reason';
    }

    const primaryReason = reasons[0];
    
    switch (primaryReason.type) {
      case 'age_verification':
        return 'Age verification required. You must be 18+ to view this content.';
      case 'geographic_restriction':
        return 'This content is not available in your region.';
      case 'entitlement_required':
        const entitlementType = primaryReason.details?.entitlementType;
        const price = primaryReason.details?.price;
        if (entitlementType === 'ppv') {
          return `Purchase required${price ? ` ($${price})` : ''} to view this content.`;
        } else {
          return 'Subscription required to view this content.';
        }
      case 'content_unavailable':
        return 'This content is currently unavailable.';
      case 'moderation_block':
        return 'This content has been blocked by moderation.';
      default:
        return primaryReason.message || 'Access denied';
    }
  }

  /**
   * Get suggested actions for access denial reasons
   */
  getSuggestedActions(reasons: AccessDenialReason[]): Array<{
    action: string;
    label: string;
    type: 'primary' | 'secondary';
  }> {
    const actions: Array<{ action: string; label: string; type: 'primary' | 'secondary' }> = [];

    reasons.forEach(reason => {
      switch (reason.type) {
        case 'age_verification':
          actions.push({
            action: 'verify_age',
            label: 'Verify Age',
            type: 'primary'
          });
          break;
        case 'entitlement_required':
          const entitlementType = reason.details?.entitlementType;
          if (entitlementType === 'ppv') {
            actions.push({
              action: 'purchase_content',
              label: 'Purchase Content',
              type: 'primary'
            });
          } else {
            actions.push({
              action: 'subscribe',
              label: 'Subscribe',
              type: 'primary'
            });
          }
          break;
        case 'geographic_restriction':
          actions.push({
            action: 'learn_more',
            label: 'Learn More',
            type: 'secondary'
          });
          break;
      }
    });

    return actions;
  }

  /**
   * Check if user needs to take action before accessing content
   */
  async needsAction(contentId: string, userAddress: string): Promise<{
    needsAction: boolean;
    actions: string[];
    requirements: ContentRequirements;
  }> {
    try {
      const [accessResult, requirements] = await Promise.all([
        this.checkAccess({ contentId, userAddress }),
        this.getContentRequirements(contentId)
      ]);

      if (accessResult.allowed) {
        return {
          needsAction: false,
          actions: [],
          requirements
        };
      }

      const actions = accessResult.reasons.map(reason => {
        switch (reason.type) {
          case 'age_verification':
            return 'verify_age';
          case 'entitlement_required':
            return reason.details?.entitlementType === 'ppv' ? 'purchase' : 'subscribe';
          default:
            return 'unknown';
        }
      }).filter(action => action !== 'unknown');

      return {
        needsAction: true,
        actions,
        requirements
      };
    } catch (error) {
      console.error('Error checking action needs:', error);
      return {
        needsAction: true,
        actions: ['unknown'],
        requirements: {
          ageVerificationRequired: true,
          geographicRestrictions: [],
          entitlementRequired: true
        }
      };
    }
  }

  /**
   * Generate session ID for tracking
   */
  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Parse watermark ID for display
   */
  parseWatermarkId(watermarkId: string): {
    address: string;
    session: string;
    timestamp: number;
  } | null {
    try {
      const decoded = JSON.parse(atob(watermarkId));
      return {
        address: decoded.address,
        session: decoded.session,
        timestamp: decoded.timestamp
      };
    } catch (error) {
      console.error('Error parsing watermark ID:', error);
      return null;
    }
  }

  /**
   * Check if access token is still valid
   */
  isTokenValid(expiresAt: string): boolean {
    return new Date() < new Date(expiresAt);
  }

  /**
   * Get time remaining for access token
   */
  getTokenTimeRemaining(expiresAt: string): number {
    const expiry = new Date(expiresAt);
    const now = new Date();
    return Math.max(0, expiry.getTime() - now.getTime());
  }

  /**
   * Format time remaining in human readable format
   */
  formatTimeRemaining(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}