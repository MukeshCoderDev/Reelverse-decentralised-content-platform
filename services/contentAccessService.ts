/**
 * Content Access Service
 * Handles content access verification including age, geo, and entitlement checks
 */

export interface ContentAccessResponse {
  contentId: string;
  ageOk: boolean;
  geoOk: boolean;
  hasEntitlement: boolean;
  entitlementType?: 'free' | 'ppv' | 'subscription' | 'nft';
  moderationStatus: 'approved' | 'pending' | 'blocked';
  reason?: string;
  expiresAt?: string;
}

export interface PlaybackTokenResponse {
  hlsUrl: string;
  token: string;
  overlayId: string;
  expiresAt: number;
  watermarkData?: {
    sessionId: string;
    userAddress: string;
    contentId: string;
  };
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
   * Check if user has access to specific content
   */
  async checkAccess(contentId: string, userAddress?: string): Promise<ContentAccessResponse> {
    try {
      const url = new URL(`${this.baseUrl}/api/v1/content/access/${contentId}`);
      if (userAddress) {
        url.searchParams.set('address', userAddress);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to check content access: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error checking content access:', error);
      
      // Return mock data for development/testing
      if (import.meta.env.DEV) {
        return this.getMockAccessResponse(contentId, userAddress);
      }
      
      throw new Error('Failed to check content access');
    }
  }

  /**
   * Request a playback token for authorized content
   */
  async requestPlaybackToken(contentId: string, userAddress: string): Promise<PlaybackTokenResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/content/playback-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId,
          userAddress
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to get playback token: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error requesting playback token:', error);
      
      // Return mock data for development/testing
      if (import.meta.env.DEV) {
        return this.getMockPlaybackToken(contentId, userAddress);
      }
      
      throw error;
    }
  }

  /**
   * Validate a playback token
   */
  async validatePlaybackToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/content/validate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
      });

      return response.ok;
    } catch (error) {
      console.error('Error validating playback token:', error);
      return false;
    }
  }

  /**
   * Report content access for analytics
   */
  async reportAccess(contentId: string, userAddress: string, accessType: 'view' | 'play' | 'complete'): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/v1/content/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId,
          userAddress,
          accessType,
          timestamp: new Date().toISOString()
        }),
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error reporting content access:', error);
      // Don't throw - analytics failures shouldn't block content access
    }
  }

  /**
   * Get user's content library (owned/purchased content)
   */
  async getUserLibrary(userAddress: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/content/library/${userAddress}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to get user library: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data.contentIds || [];
    } catch (error) {
      console.error('Error getting user library:', error);
      return [];
    }
  }

  /**
   * Mock access response for development
   */
  private getMockAccessResponse(contentId: string, userAddress?: string): ContentAccessResponse {
    // Simulate different access scenarios based on contentId
    const isAdultContent = contentId.includes('adult') || contentId.includes('18+');
    const isPremiumContent = contentId.includes('premium') || contentId.includes('paid');
    const isGeoRestricted = contentId.includes('geo-restricted');
    
    // Mock user verification status
    const hasWallet = !!userAddress;
    const isAgeVerified = hasWallet && Math.random() > 0.3; // 70% chance of being age verified
    const hasEntitlement = hasWallet && (!isPremiumContent || Math.random() > 0.5); // 50% chance of having entitlement for premium content
    
    return {
      contentId,
      ageOk: !isAdultContent || isAgeVerified,
      geoOk: !isGeoRestricted,
      hasEntitlement: !isPremiumContent || hasEntitlement,
      entitlementType: isPremiumContent ? (hasEntitlement ? 'ppv' : undefined) : 'free',
      moderationStatus: 'approved',
      reason: !hasWallet ? 'wallet_required' : 
              (isAdultContent && !isAgeVerified) ? 'age_verification_required' :
              (isPremiumContent && !hasEntitlement) ? 'entitlement_required' :
              isGeoRestricted ? 'geo_restricted' : undefined
    };
  }

  /**
   * Mock playback token for development
   */
  private getMockPlaybackToken(contentId: string, userAddress: string): PlaybackTokenResponse {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const token = `mock_token_${sessionId}`;
    
    return {
      hlsUrl: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4?token=${token}`,
      token,
      overlayId: `overlay_${sessionId}`,
      expiresAt: Date.now() + (4 * 60 * 60 * 1000), // 4 hours from now
      watermarkData: {
        sessionId,
        userAddress,
        contentId
      }
    };
  }

  /**
   * Get user-friendly access reason message
   */
  getAccessReasonMessage(reason?: string): string {
    switch (reason) {
      case 'wallet_required':
        return 'Connect your wallet to access this content';
      case 'age_verification_required':
        return 'Age verification required for adult content';
      case 'entitlement_required':
        return 'Purchase required to access this premium content';
      case 'geo_restricted':
        return 'Content not available in your region';
      case 'content_moderated':
        return 'Content is under review or has been removed';
      default:
        return 'Access denied';
    }
  }

  /**
   * Check if content requires payment
   */
  isPaymentRequired(accessResponse: ContentAccessResponse): boolean {
    return !accessResponse.hasEntitlement && 
           accessResponse.ageOk && 
           accessResponse.geoOk && 
           accessResponse.moderationStatus === 'approved';
  }

  /**
   * Check if content is completely blocked (not just payment required)
   */
  isContentBlocked(accessResponse: ContentAccessResponse): boolean {
    return !accessResponse.ageOk || 
           !accessResponse.geoOk || 
           accessResponse.moderationStatus === 'blocked';
  }
}