import { publicApiService } from './publicApiService';

export interface EntitlementCheck {
  userId: string;
  contentId: string;
  accessType: 'view' | 'download' | 'stream';
}

export interface EntitlementResult {
  hasAccess: boolean;
  accessType: 'purchased' | 'subscription' | 'free' | 'preview';
  expiresAt?: string;
  restrictions?: {
    downloadLimit?: number;
    viewLimit?: number;
    geoRestrictions?: string[];
  };
  purchaseOptions?: PurchaseOption[];
}

export interface PurchaseOption {
  type: 'purchase' | 'rent' | 'subscription';
  price: number;
  currency: string;
  duration?: number; // for rentals, in hours
  description: string;
}

export interface BulkEntitlementCheck {
  userId: string;
  contentIds: string[];
  accessType: 'view' | 'download' | 'stream';
}

export interface BulkEntitlementResult {
  results: Record<string, EntitlementResult>;
  processingTime: number;
}

export class EntitlementApiService {
  /**
   * Check if user has access to specific content
   */
  async checkEntitlement(check: EntitlementCheck): Promise<EntitlementResult> {
    // Validate input
    this.validateEntitlementCheck(check);

    // Mock entitlement check - in real implementation, query user purchases/subscriptions
    const mockResult: EntitlementResult = {
      hasAccess: true,
      accessType: 'purchased',
      expiresAt: undefined, // Permanent access for purchases
      restrictions: {
        downloadLimit: 5,
        geoRestrictions: ['CN', 'KP'] // Example geo restrictions
      }
    };

    // Simulate different access scenarios based on contentId
    if (check.contentId.includes('premium')) {
      return {
        hasAccess: false,
        accessType: 'preview',
        purchaseOptions: [
          {
            type: 'purchase',
            price: 29.99,
            currency: 'USD',
            description: 'Permanent access to premium content'
          },
          {
            type: 'rent',
            price: 9.99,
            currency: 'USD',
            duration: 48,
            description: '48-hour rental access'
          }
        ]
      };
    }

    if (check.contentId.includes('subscription')) {
      return {
        hasAccess: true,
        accessType: 'subscription',
        expiresAt: '2024-02-15T23:59:59Z',
        restrictions: {
          viewLimit: 100,
          geoRestrictions: ['CN']
        }
      };
    }

    return mockResult;
  }

  /**
   * Check entitlements for multiple content items
   */
  async checkBulkEntitlements(bulkCheck: BulkEntitlementCheck): Promise<BulkEntitlementResult> {
    const startTime = Date.now();
    
    // Validate input
    this.validateBulkEntitlementCheck(bulkCheck);

    const results: Record<string, EntitlementResult> = {};

    // Process each content ID
    for (const contentId of bulkCheck.contentIds) {
      try {
        results[contentId] = await this.checkEntitlement({
          userId: bulkCheck.userId,
          contentId,
          accessType: bulkCheck.accessType
        });
      } catch (error) {
        // Handle individual failures gracefully
        results[contentId] = {
          hasAccess: false,
          accessType: 'preview',
          purchaseOptions: []
        };
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      results,
      processingTime
    };
  }

  /**
   * Get user's content library (purchased/subscribed content)
   */
  async getUserLibrary(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<{
    content: LibraryItem[];
    totalCount: number;
    page: number;
    hasMore: boolean;
  }> {
    // Validate pagination
    if (page < 1) throw new Error('Page must be positive');
    if (limit < 1 || limit > 100) throw new Error('Limit must be between 1 and 100');

    // Mock user library - in real implementation, query user's purchases/subscriptions
    const mockLibrary: LibraryItem[] = [
      {
        contentId: 'content_001',
        title: 'Purchased Content 1',
        accessType: 'purchased',
        purchasedAt: '2024-01-10T14:30:00Z',
        expiresAt: undefined,
        downloadCount: 2,
        viewCount: 15
      },
      {
        contentId: 'content_002',
        title: 'Subscription Content 1',
        accessType: 'subscription',
        purchasedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-02-01T00:00:00Z',
        downloadCount: 0,
        viewCount: 8
      }
    ];

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedContent = mockLibrary.slice(startIndex, startIndex + limit);

    return {
      content: paginatedContent,
      totalCount: mockLibrary.length,
      page,
      hasMore: startIndex + limit < mockLibrary.length
    };
  }

  /**
   * Get subscription status for user
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus | null> {
    // Mock subscription status - in real implementation, query subscription data
    return {
      subscriptionId: 'sub_123456',
      planName: 'Premium Monthly',
      status: 'active',
      currentPeriodStart: '2024-01-01T00:00:00Z',
      currentPeriodEnd: '2024-02-01T00:00:00Z',
      autoRenew: true,
      price: 29.99,
      currency: 'USD'
    };
  }

  /**
   * Validate single entitlement check
   */
  private validateEntitlementCheck(check: EntitlementCheck): void {
    if (!check.userId || check.userId.trim().length === 0) {
      throw new Error('User ID is required');
    }

    if (!check.contentId || check.contentId.trim().length === 0) {
      throw new Error('Content ID is required');
    }

    if (!['view', 'download', 'stream'].includes(check.accessType)) {
      throw new Error('Invalid access type');
    }
  }

  /**
   * Validate bulk entitlement check
   */
  private validateBulkEntitlementCheck(bulkCheck: BulkEntitlementCheck): void {
    if (!bulkCheck.userId || bulkCheck.userId.trim().length === 0) {
      throw new Error('User ID is required');
    }

    if (!bulkCheck.contentIds || bulkCheck.contentIds.length === 0) {
      throw new Error('Content IDs are required');
    }

    if (bulkCheck.contentIds.length > 50) {
      throw new Error('Maximum 50 content IDs per bulk request');
    }

    if (!['view', 'download', 'stream'].includes(bulkCheck.accessType)) {
      throw new Error('Invalid access type');
    }
  }
}

export interface LibraryItem {
  contentId: string;
  title: string;
  accessType: 'purchased' | 'subscription' | 'rental';
  purchasedAt: string;
  expiresAt?: string;
  downloadCount: number;
  viewCount: number;
}

export interface SubscriptionStatus {
  subscriptionId: string;
  planName: string;
  status: 'active' | 'canceled' | 'expired' | 'past_due';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  autoRenew: boolean;
  price: number;
  currency: string;
}

export const entitlementApiService = new EntitlementApiService();