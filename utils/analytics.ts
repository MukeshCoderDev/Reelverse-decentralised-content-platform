/**
 * Analytics Event Tracking for Monetization Features
 * Provides comprehensive tracking of user interactions and financial events
 */

interface BaseEventProperties {
  timestamp: number;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  platform: 'web' | 'mobile' | 'api';
}

interface TipEventProperties extends BaseEventProperties {
  videoId: string;
  creatorId: string;
  amountUSDC: number;
  hasSplits: boolean;
  splitCount?: number;
  hasReferral: boolean;
  referralCode?: string;
  paymentMethod?: string;
  transactionId?: string;
}

interface SubscriptionEventProperties extends BaseEventProperties {
  creatorId: string;
  planId: string;
  planName: string;
  amountUSDC: number;
  cadence: 'monthly' | 'annual';
  subscriptionId?: string;
  isRenewing?: boolean;
}

interface ReferralEventProperties extends BaseEventProperties {
  referralCode: string;
  referrerId: string;
  action: 'code_generated' | 'link_shared' | 'code_claimed' | 'earnings_generated';
  platform: 'twitter' | 'facebook' | 'linkedin' | 'direct' | 'web';
  earningsUSDC?: number;
}

interface PayoutEventProperties extends BaseEventProperties {
  amountUSDC: number;
  payoutMethodId: string;
  payoutMethodType: 'crypto' | 'bank';
  status: 'requested' | 'processing' | 'completed' | 'failed';
  payoutId: string;
  processingTimeMs?: number;
}

interface FinancialEventProperties extends BaseEventProperties {
  action: 'balance_viewed' | 'export_requested' | 'split_policy_created' | 'split_policy_applied';
  metadata?: Record<string, any>;
}

/**
 * Analytics event tracker with multiple providers
 */
export class MonetizationAnalytics {
  private providers: AnalyticsProvider[] = [];
  private isEnabled: boolean = true;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Google Analytics 4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      this.providers.push(new GoogleAnalyticsProvider());
    }

    // Custom analytics backend
    this.providers.push(new CustomAnalyticsProvider());

    // Console logger for development
    if (process.env.NODE_ENV === 'development') {
      this.providers.push(new ConsoleAnalyticsProvider());
    }
  }

  /**
   * Track tip button click
   */
  trackTipClick(properties: Omit<TipEventProperties, 'timestamp' | 'platform'>) {
    this.track('tip_click', {
      ...properties,
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track successful tip completion
   */
  trackTipSuccess(properties: Omit<TipEventProperties, 'timestamp' | 'platform'>) {
    this.track('tip_success', {
      ...properties,
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track tip failure
   */
  trackTipFailure(properties: Omit<TipEventProperties, 'timestamp' | 'platform'> & { 
    errorCode: string; 
    errorMessage: string; 
  }) {
    this.track('tip_failed', {
      ...properties,
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track subscription button click
   */
  trackSubscriptionClick(properties: Omit<SubscriptionEventProperties, 'timestamp' | 'platform'>) {
    this.track('subscription_click', {
      ...properties,
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track subscription start
   */
  trackSubscriptionStart(properties: Omit<SubscriptionEventProperties, 'timestamp' | 'platform'>) {
    this.track('subscription_started', {
      ...properties,
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track subscription renewal
   */
  trackSubscriptionRenewal(properties: Omit<SubscriptionEventProperties, 'timestamp' | 'platform'>) {
    this.track('subscription_renewed', {
      ...properties,
      isRenewing: true,
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track subscription cancellation
   */
  trackSubscriptionCancel(properties: Omit<SubscriptionEventProperties, 'timestamp' | 'platform'> & {
    reason: string;
    hadFailures: boolean;
  }) {
    this.track('subscription_canceled', {
      ...properties,
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track referral code generation
   */
  trackReferralCodeGenerated(properties: Omit<ReferralEventProperties, 'timestamp' | 'platform' | 'action'>) {
    this.track('referral_code_generated', {
      ...properties,
      action: 'code_generated',
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track referral link sharing
   */
  trackReferralShare(properties: Omit<ReferralEventProperties, 'timestamp' | 'action'>) {
    this.track('referral_shared', {
      ...properties,
      action: 'link_shared',
      timestamp: Date.now()
    });
  }

  /**
   * Track referral code claim
   */
  trackReferralClaim(properties: Omit<ReferralEventProperties, 'timestamp' | 'platform' | 'action'>) {
    this.track('referral_claimed', {
      ...properties,
      action: 'code_claimed',
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track referral earnings
   */
  trackReferralEarnings(properties: Omit<ReferralEventProperties, 'timestamp' | 'platform' | 'action'>) {
    this.track('referral_earnings', {
      ...properties,
      action: 'earnings_generated',
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track payout request
   */
  trackPayoutRequest(properties: Omit<PayoutEventProperties, 'timestamp' | 'platform' | 'status'>) {
    this.track('payout_requested', {
      ...properties,
      status: 'requested',
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track payout completion
   */
  trackPayoutComplete(properties: Omit<PayoutEventProperties, 'timestamp' | 'platform' | 'status'>) {
    this.track('payout_completed', {
      ...properties,
      status: 'completed',
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track payout failure
   */
  trackPayoutFailure(properties: Omit<PayoutEventProperties, 'timestamp' | 'platform' | 'status'> & {
    errorCode: string;
    errorMessage: string;
  }) {
    this.track('payout_failed', {
      ...properties,
      status: 'failed',
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track share menu interactions
   */
  trackShareMenuOpen(properties: { videoId: string; creatorId: string; } & BaseEventProperties) {
    this.track('share_menu_opened', {
      ...properties,
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track social media shares
   */
  trackSocialShare(properties: {
    videoId: string;
    creatorId: string;
    platform: 'twitter' | 'facebook' | 'linkedin';
    hasReferral: boolean;
    referralCode?: string;
  } & BaseEventProperties) {
    this.track('social_share', {
      ...properties,
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track financial dashboard interactions
   */
  trackFinanceDashboard(properties: Omit<FinancialEventProperties, 'timestamp' | 'platform'>) {
    this.track('finance_dashboard', {
      ...properties,
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track CSV export
   */
  trackCSVExport(properties: {
    exportType: 'earnings' | 'payouts' | 'referrals';
    period: 'all' | '30d' | '7d';
    recordCount: number;
  } & BaseEventProperties) {
    this.track('csv_exported', {
      ...properties,
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track conversion funnel steps
   */
  trackConversionFunnel(step: 'video_view' | 'tip_button_view' | 'tip_modal_open' | 'tip_amount_select' | 'tip_submit' | 'tip_success', properties: BaseEventProperties & {
    videoId: string;
    creatorId: string;
    funnelId: string;
  }) {
    this.track('conversion_funnel', {
      ...properties,
      step,
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Track A/B test events
   */
  trackABTest(testName: string, variant: string, event: 'impression' | 'conversion', properties: BaseEventProperties) {
    this.track('ab_test', {
      ...properties,
      testName,
      variant,
      event,
      timestamp: Date.now(),
      platform: this.detectPlatform()
    });
  }

  /**
   * Generic track method
   */
  private track(eventName: string, properties: any) {
    if (!this.isEnabled) return;

    this.providers.forEach(provider => {
      try {
        provider.track(eventName, properties);
      } catch (error) {
        console.error(`Analytics provider error:`, error);
      }
    });
  }

  private detectPlatform(): 'web' | 'mobile' | 'api' {
    if (typeof window === 'undefined') return 'api';
    
    const userAgent = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad/.test(userAgent)) {
      return 'mobile';
    }
    
    return 'web';
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  /**
   * Add custom provider
   */
  addProvider(provider: AnalyticsProvider) {
    this.providers.push(provider);
  }
}

/**
 * Analytics provider interface
 */
interface AnalyticsProvider {
  track(eventName: string, properties: any): void;
}

/**
 * Google Analytics 4 provider
 */
class GoogleAnalyticsProvider implements AnalyticsProvider {
  track(eventName: string, properties: any): void {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, {
        custom_parameter_1: properties.userId,
        custom_parameter_2: properties.videoId,
        custom_parameter_3: properties.creatorId,
        value: properties.amountUSDC,
        currency: 'USD',
        event_category: 'monetization',
        event_label: properties.platform,
        ...properties
      });
    }
  }
}

/**
 * Custom analytics backend provider
 */
class CustomAnalyticsProvider implements AnalyticsProvider {
  private queue: Array<{ eventName: string; properties: any; timestamp: number }> = [];
  private flushInterval: NodeJS.Timeout;

  constructor() {
    // Flush events every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  track(eventName: string, properties: any): void {
    this.queue.push({
      eventName,
      properties,
      timestamp: Date.now()
    });

    // Flush immediately for critical events
    if (['tip_success', 'subscription_started', 'payout_completed'].includes(eventName)) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ events })
      });
    } catch (error) {
      console.error('Failed to send analytics events:', error);
      // Re-queue events for retry
      this.queue.unshift(...events);
    }
  }
}

/**
 * Console logger for development
 */
class ConsoleAnalyticsProvider implements AnalyticsProvider {
  track(eventName: string, properties: any): void {
    console.log(`[Analytics] ${eventName}:`, properties);
  }
}

/**
 * Singleton analytics instance
 */
export const analytics = new MonetizationAnalytics();

/**
 * React hook for analytics tracking
 */
export function useAnalytics() {
  return {
    trackTipClick: analytics.trackTipClick.bind(analytics),
    trackTipSuccess: analytics.trackTipSuccess.bind(analytics),
    trackTipFailure: analytics.trackTipFailure.bind(analytics),
    trackSubscriptionClick: analytics.trackSubscriptionClick.bind(analytics),
    trackSubscriptionStart: analytics.trackSubscriptionStart.bind(analytics),
    trackReferralShare: analytics.trackReferralShare.bind(analytics),
    trackReferralClaim: analytics.trackReferralClaim.bind(analytics),
    trackPayoutRequest: analytics.trackPayoutRequest.bind(analytics),
    trackShareMenuOpen: analytics.trackShareMenuOpen.bind(analytics),
    trackSocialShare: analytics.trackSocialShare.bind(analytics),
    trackFinanceDashboard: analytics.trackFinanceDashboard.bind(analytics),
    trackCSVExport: analytics.trackCSVExport.bind(analytics),
    trackConversionFunnel: analytics.trackConversionFunnel.bind(analytics),
    trackABTest: analytics.trackABTest.bind(analytics)
  };
}

/**
 * Server-side analytics for API endpoints
 */
export class ServerAnalytics {
  static track(eventName: string, properties: any, req?: any) {
    const baseProperties = {
      timestamp: Date.now(),
      platform: 'api' as const,
      userId: req?.userId,
      sessionId: req?.sessionId,
      userAgent: req?.headers['user-agent'],
      ipAddress: req?.ip,
      referrer: req?.headers['referer']
    };

    analytics.track(eventName, { ...baseProperties, ...properties } as any);
  }
}