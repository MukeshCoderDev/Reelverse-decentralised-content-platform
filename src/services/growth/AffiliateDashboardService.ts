import { EventEmitter } from 'events';
import { referralService, ReferralProgramType } from './ReferralService';
import { logger } from '../logging/Logger';
import { redis } from '../redis/RedisClient';

// Dashboard metrics
export interface AffiliateDashboardMetrics {
  overview: {
    totalEarnings: number;
    pendingEarnings: number;
    thisMonthEarnings: number;
    totalReferrals: number;
    activeReferrals: number;
    conversionRate: number;
    averageOrderValue: number;
  };
  performance: {
    dailyStats: DailyPerformanceStats[];
    monthlyStats: MonthlyPerformanceStats[];
    topPerformingLinks: TopPerformingLink[];
    conversionFunnel: ConversionFunnelStats;
  };
  payouts: {
    nextPayoutDate: Date;
    nextPayoutAmount: number;
    payoutHistory: PayoutHistoryItem[];
    payoutMethods: PayoutMethod[];
  };
  referralCodes: {
    activeCodes: ReferralCodeStats[];
    codePerformance: CodePerformanceMetrics[];
  };
}

export interface DailyPerformanceStats {
  date: Date;
  clicks: number;
  referrals: number;
  conversions: number;
  earnings: number;
  conversionRate: number;
}

export interface MonthlyPerformanceStats {
  month: string;
  totalClicks: number;
  totalReferrals: number;
  totalConversions: number;
  totalEarnings: number;
  averageOrderValue: number;
}

export interface TopPerformingLink {
  url: string;
  referralCode: string;
  clicks: number;
  conversions: number;
  earnings: number;
  conversionRate: number;
}

export interface ConversionFunnelStats {
  clicks: number;
  signups: number;
  firstPurchase: number;
  repeatPurchase: number;
  clickToSignupRate: number;
  signupToFirstPurchaseRate: number;
  firstToRepeatPurchaseRate: number;
}

export interface PayoutHistoryItem {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  paidAt?: Date;
  method: string;
  transactionId?: string;
}

export interface PayoutMethod {
  id: string;
  type: 'crypto' | 'bank_transfer' | 'paypal';
  name: string;
  details: Record<string, any>;
  isDefault: boolean;
  isVerified: boolean;
}

export interface ReferralCodeStats {
  code: string;
  programType: ReferralProgramType;
  isActive: boolean;
  createdAt: Date;
  totalClicks: number;
  totalReferrals: number;
  totalConversions: number;
  totalEarnings: number;
}

export interface CodePerformanceMetrics {
  code: string;
  timeRange: string;
  metrics: {
    impressions: number;
    clicks: number;
    ctr: number; // Click-through rate
    conversions: number;
    conversionRate: number;
    earnings: number;
    epc: number; // Earnings per click
  };
}

// Marketing materials
export interface MarketingMaterial {
  id: string;
  type: 'banner' | 'text_link' | 'video' | 'email_template' | 'social_post';
  title: string;
  description: string;
  content: string;
  dimensions?: string;
  fileUrl?: string;
  previewUrl?: string;
  category: string;
  tags: string[];
  performanceScore: number;
  isActive: boolean;
}

export class AffiliateDashboardService extends EventEmitter {
  constructor() {
    super();
  }

  // Get comprehensive dashboard metrics for affiliate
  async getDashboardMetrics(
    affiliateId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<AffiliateDashboardMetrics> {
    try {
      const [
        overview,
        performance,
        payouts,
        referralCodes
      ] = await Promise.all([
        this.getOverviewMetrics(affiliateId, timeRange),
        this.getPerformanceMetrics(affiliateId, timeRange),
        this.getPayoutMetrics(affiliateId),
        this.getReferralCodeMetrics(affiliateId, timeRange)
      ]);

      const metrics: AffiliateDashboardMetrics = {
        overview,
        performance,
        payouts,
        referralCodes
      };

      logger.info('Dashboard metrics generated', {
        affiliateId,
        timeRange,
        totalEarnings: overview.totalEarnings
      });

      return metrics;
    } catch (error) {
      logger.error('Failed to generate dashboard metrics', {
        affiliateId,
        error: error.message
      });
      throw error;
    }
  }

  // Get overview metrics
  private async getOverviewMetrics(
    affiliateId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<AffiliateDashboardMetrics['overview']> {
    // Mock implementation - in production, query actual data
    const analytics = await referralService.getReferrerAnalytics(affiliateId, timeRange);
    
    return {
      totalEarnings: analytics.totalCommission,
      pendingEarnings: analytics.pendingCommission,
      thisMonthEarnings: analytics.totalCommission * 0.3, // Mock 30% this month
      totalReferrals: analytics.totalReferrals,
      activeReferrals: Math.floor(analytics.totalReferrals * 0.7), // Mock 70% active
      conversionRate: analytics.conversionRate,
      averageOrderValue: analytics.totalCommission / analytics.conversions
    };
  }

  // Get performance metrics
  private async getPerformanceMetrics(
    affiliateId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<AffiliateDashboardMetrics['performance']> {
    const dailyStats = await this.getDailyPerformanceStats(affiliateId, timeRange);
    const monthlyStats = await this.getMonthlyPerformanceStats(affiliateId);
    const topPerformingLinks = await this.getTopPerformingLinks(affiliateId, timeRange);
    const conversionFunnel = await this.getConversionFunnelStats(affiliateId, timeRange);

    return {
      dailyStats,
      monthlyStats,
      topPerformingLinks,
      conversionFunnel
    };
  }

  // Get daily performance statistics
  private async getDailyPerformanceStats(
    affiliateId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<DailyPerformanceStats[]> {
    const stats: DailyPerformanceStats[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    
    for (let date = new Date(timeRange.startDate); date <= timeRange.endDate; date = new Date(date.getTime() + dayMs)) {
      // Mock data - in production, query actual metrics
      const clicks = Math.floor(Math.random() * 100) + 50;
      const referrals = Math.floor(clicks * 0.3);
      const conversions = Math.floor(referrals * 0.25);
      const earnings = conversions * (Math.random() * 50 + 25);
      
      stats.push({
        date: new Date(date),
        clicks,
        referrals,
        conversions,
        earnings,
        conversionRate: referrals > 0 ? (conversions / referrals) * 100 : 0
      });
    }
    
    return stats;
  }

  // Get monthly performance statistics
  private async getMonthlyPerformanceStats(affiliateId: string): Promise<MonthlyPerformanceStats[]> {
    // Mock data for last 12 months
    const stats: MonthlyPerformanceStats[] = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = month.toISOString().substring(0, 7); // YYYY-MM
      
      const totalClicks = Math.floor(Math.random() * 2000) + 1000;
      const totalReferrals = Math.floor(totalClicks * 0.3);
      const totalConversions = Math.floor(totalReferrals * 0.25);
      const totalEarnings = totalConversions * (Math.random() * 50 + 25);
      
      stats.push({
        month: monthStr,
        totalClicks,
        totalReferrals,
        totalConversions,
        totalEarnings,
        averageOrderValue: totalConversions > 0 ? totalEarnings / totalConversions : 0
      });
    }
    
    return stats;
  }

  // Get top performing links
  private async getTopPerformingLinks(
    affiliateId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<TopPerformingLink[]> {
    // Mock data
    return [
      {
        url: 'https://platform.com/?ref=A1B2C3D4',
        referralCode: 'A1B2C3D4',
        clicks: 1250,
        conversions: 85,
        earnings: 4250.00,
        conversionRate: 6.8
      },
      {
        url: 'https://platform.com/creators?ref=E5F6G7H8',
        referralCode: 'E5F6G7H8',
        clicks: 980,
        conversions: 62,
        earnings: 3100.00,
        conversionRate: 6.3
      },
      {
        url: 'https://platform.com/premium?ref=I9J0K1L2',
        referralCode: 'I9J0K1L2',
        clicks: 750,
        conversions: 45,
        earnings: 2250.00,
        conversionRate: 6.0
      }
    ];
  }

  // Get conversion funnel statistics
  private async getConversionFunnelStats(
    affiliateId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<ConversionFunnelStats> {
    // Mock data
    const clicks = 5000;
    const signups = Math.floor(clicks * 0.15); // 15% click to signup
    const firstPurchase = Math.floor(signups * 0.25); // 25% signup to first purchase
    const repeatPurchase = Math.floor(firstPurchase * 0.4); // 40% first to repeat purchase
    
    return {
      clicks,
      signups,
      firstPurchase,
      repeatPurchase,
      clickToSignupRate: (signups / clicks) * 100,
      signupToFirstPurchaseRate: (firstPurchase / signups) * 100,
      firstToRepeatPurchaseRate: (repeatPurchase / firstPurchase) * 100
    };
  }

  // Get payout metrics
  private async getPayoutMetrics(affiliateId: string): Promise<AffiliateDashboardMetrics['payouts']> {
    const nextPayoutDate = this.getNextPayoutDate();
    const nextPayoutAmount = await this.calculateNextPayoutAmount(affiliateId);
    const payoutHistory = await this.getPayoutHistory(affiliateId);
    const payoutMethods = await this.getPayoutMethods(affiliateId);

    return {
      nextPayoutDate,
      nextPayoutAmount,
      payoutHistory,
      payoutMethods
    };
  }

  // Calculate next payout date
  private getNextPayoutDate(): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15); // 15th of next month
    return nextMonth;
  }

  // Calculate next payout amount
  private async calculateNextPayoutAmount(affiliateId: string): Promise<number> {
    // Mock calculation - in production, sum pending commissions
    return 1250.75;
  }

  // Get payout history
  private async getPayoutHistory(affiliateId: string): Promise<PayoutHistoryItem[]> {
    // Mock data
    return [
      {
        id: 'payout-001',
        amount: 2500.00,
        currency: 'USDC',
        status: 'completed',
        paidAt: new Date('2024-01-15'),
        method: 'Crypto Wallet',
        transactionId: '0x1234...5678'
      },
      {
        id: 'payout-002',
        amount: 1875.50,
        currency: 'USDC',
        status: 'completed',
        paidAt: new Date('2023-12-15'),
        method: 'Crypto Wallet',
        transactionId: '0x8765...4321'
      },
      {
        id: 'payout-003',
        amount: 3200.25,
        currency: 'USDC',
        status: 'processing',
        method: 'Crypto Wallet'
      }
    ];
  }

  // Get payout methods
  private async getPayoutMethods(affiliateId: string): Promise<PayoutMethod[]> {
    // Mock data
    return [
      {
        id: 'method-001',
        type: 'crypto',
        name: 'USDC Wallet',
        details: {
          address: '0x742d35Cc6634C0532925a3b8D4C0532925a3b8D4',
          network: 'Polygon'
        },
        isDefault: true,
        isVerified: true
      },
      {
        id: 'method-002',
        type: 'paypal',
        name: 'PayPal Account',
        details: {
          email: 'affiliate@example.com'
        },
        isDefault: false,
        isVerified: true
      }
    ];
  }

  // Get referral code metrics
  private async getReferralCodeMetrics(
    affiliateId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<AffiliateDashboardMetrics['referralCodes']> {
    const activeCodes = await this.getActiveReferralCodes(affiliateId);
    const codePerformance = await this.getCodePerformanceMetrics(affiliateId, timeRange);

    return {
      activeCodes,
      codePerformance
    };
  }

  // Get active referral codes
  private async getActiveReferralCodes(affiliateId: string): Promise<ReferralCodeStats[]> {
    // Mock data
    return [
      {
        code: 'A1B2C3D4',
        programType: ReferralProgramType.AFFILIATE_PROGRAM,
        isActive: true,
        createdAt: new Date('2024-01-01'),
        totalClicks: 2500,
        totalReferrals: 180,
        totalConversions: 45,
        totalEarnings: 2250.00
      },
      {
        code: 'E5F6G7H8',
        programType: ReferralProgramType.AFFILIATE_PROGRAM,
        isActive: true,
        createdAt: new Date('2024-01-15'),
        totalClicks: 1800,
        totalReferrals: 125,
        totalConversions: 32,
        totalEarnings: 1600.00
      }
    ];
  }

  // Get code performance metrics
  private async getCodePerformanceMetrics(
    affiliateId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<CodePerformanceMetrics[]> {
    // Mock data
    return [
      {
        code: 'A1B2C3D4',
        timeRange: '30d',
        metrics: {
          impressions: 15000,
          clicks: 1250,
          ctr: 8.33,
          conversions: 85,
          conversionRate: 6.8,
          earnings: 4250.00,
          epc: 3.40
        }
      },
      {
        code: 'E5F6G7H8',
        timeRange: '30d',
        metrics: {
          impressions: 12000,
          clicks: 980,
          ctr: 8.17,
          conversions: 62,
          conversionRate: 6.3,
          earnings: 3100.00,
          epc: 3.16
        }
      }
    ];
  }

  // Get marketing materials
  async getMarketingMaterials(
    category?: string,
    type?: string
  ): Promise<MarketingMaterial[]> {
    // Mock marketing materials
    const materials: MarketingMaterial[] = [
      {
        id: 'banner-001',
        type: 'banner',
        title: 'Premium Content Banner - 728x90',
        description: 'High-converting banner for premium content promotion',
        content: '<img src="/banners/premium-728x90.jpg" alt="Premium Content">',
        dimensions: '728x90',
        fileUrl: '/banners/premium-728x90.jpg',
        previewUrl: '/banners/premium-728x90-preview.jpg',
        category: 'premium',
        tags: ['premium', 'banner', 'high-converting'],
        performanceScore: 8.5,
        isActive: true
      },
      {
        id: 'text-001',
        type: 'text_link',
        title: 'Creator Signup Text Link',
        description: 'Compelling text link for creator signups',
        content: 'Join thousands of creators earning on the platform - Sign up now!',
        category: 'creator',
        tags: ['creator', 'signup', 'text'],
        performanceScore: 7.8,
        isActive: true
      },
      {
        id: 'email-001',
        type: 'email_template',
        title: 'Welcome Email Template',
        description: 'Email template for new user onboarding',
        content: 'HTML email template content...',
        category: 'onboarding',
        tags: ['email', 'welcome', 'onboarding'],
        performanceScore: 9.2,
        isActive: true
      }
    ];

    // Filter by category and type if specified
    let filtered = materials;
    if (category) {
      filtered = filtered.filter(m => m.category === category);
    }
    if (type) {
      filtered = filtered.filter(m => m.type === type);
    }

    return filtered.filter(m => m.isActive);
  }

  // Generate custom referral link with tracking
  async generateTrackingLink(
    affiliateId: string,
    referralCode: string,
    targetUrl: string,
    campaignName?: string
  ): Promise<string> {
    const trackingParams = {
      source: 'affiliate',
      medium: 'referral',
      campaign: campaignName || 'default'
    };

    const link = await referralService.generateReferralLink(
      referralCode,
      targetUrl,
      trackingParams
    );

    // Log link generation for analytics
    await this.logLinkGeneration(affiliateId, referralCode, link, campaignName);

    return link;
  }

  // Log link generation for analytics
  private async logLinkGeneration(
    affiliateId: string,
    referralCode: string,
    link: string,
    campaignName?: string
  ): Promise<void> {
    const logEntry = {
      affiliateId,
      referralCode,
      link,
      campaignName,
      generatedAt: new Date()
    };

    await redis.lpush('affiliate:link_generations', JSON.stringify(logEntry));
    await redis.ltrim('affiliate:link_generations', 0, 9999); // Keep last 10k entries

    logger.info('Affiliate link generated', logEntry);
  }

  // Get real-time performance data
  async getRealTimeMetrics(affiliateId: string): Promise<{
    todayClicks: number;
    todayConversions: number;
    todayEarnings: number;
    liveVisitors: number;
    recentConversions: Array<{
      timestamp: Date;
      amount: number;
      referralCode: string;
    }>;
  }> {
    // Mock real-time data
    return {
      todayClicks: 125,
      todayConversions: 8,
      todayEarnings: 400.00,
      liveVisitors: 23,
      recentConversions: [
        {
          timestamp: new Date(Date.now() - 300000), // 5 minutes ago
          amount: 49.99,
          referralCode: 'A1B2C3D4'
        },
        {
          timestamp: new Date(Date.now() - 900000), // 15 minutes ago
          amount: 29.99,
          referralCode: 'E5F6G7H8'
        },
        {
          timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
          amount: 99.99,
          referralCode: 'A1B2C3D4'
        }
      ]
    };
  }
}

export const affiliateDashboardService = new AffiliateDashboardService();