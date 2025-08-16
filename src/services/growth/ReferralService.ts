import crypto from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import { redis } from '../redis/RedisClient';

// Referral program types
export enum ReferralProgramType {
  USER_REFERRAL = 'user_referral',
  CREATOR_REFERRAL = 'creator_referral',
  AFFILIATE_PROGRAM = 'affiliate_program',
  AGENCY_PARTNERSHIP = 'agency_partnership'
}

// Commission structure
export interface CommissionStructure {
  type: 'percentage' | 'fixed' | 'tiered';
  value: number; // Percentage (0-100) or fixed amount in USDC
  tiers?: CommissionTier[];
  recurringMonths?: number; // For subscription commissions
}

export interface CommissionTier {
  minReferrals: number;
  maxReferrals?: number;
  commissionRate: number;
}

// Referral program configuration
export interface ReferralProgram {
  id: string;
  name: string;
  type: ReferralProgramType;
  isActive: boolean;
  commissionStructure: CommissionStructure;
  cookieDuration: number; // Attribution window in days
  minimumPayout: number; // Minimum amount for payout in USDC
  payoutSchedule: 'weekly' | 'monthly' | 'quarterly';
  terms: string;
  createdAt: Date;
  updatedAt: Date;
}

// Referral code
export interface ReferralCode {
  id: string;
  code: string;
  programId: string;
  referrerId: string;
  referrerType: 'user' | 'creator' | 'affiliate' | 'agency';
  isActive: boolean;
  usageLimit?: number;
  usageCount: number;
  expiresAt?: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

// Attribution record
export interface Attribution {
  id: string;
  referralCodeId: string;
  referrerId: string;
  referredUserId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  source: string; // utm_source
  medium: string; // utm_medium
  campaign: string; // utm_campaign
  landingPage: string;
  attributedAt: Date;
  convertedAt?: Date;
  conversionValue?: number;
  commissionEarned?: number;
  status: 'pending' | 'converted' | 'paid' | 'cancelled';
}

// Commission payout
export interface CommissionPayout {
  id: string;
  referrerId: string;
  referrerType: string;
  programId: string;
  period: string; // YYYY-MM format
  totalCommission: number;
  referralCount: number;
  conversionCount: number;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  paidAt?: Date;
  transactionHash?: string;
  attributions: string[]; // Attribution IDs
}

export class ReferralService extends EventEmitter {
  private programs: Map<string, ReferralProgram> = new Map();
  private codes: Map<string, ReferralCode> = new Map();

  constructor() {
    super();
    this.initializeDefaultPrograms();
  }

  private initializeDefaultPrograms() {
    // User referral program
    const userProgram: ReferralProgram = {
      id: 'user-referral-2024',
      name: 'User Referral Program',
      type: ReferralProgramType.USER_REFERRAL,
      isActive: true,
      commissionStructure: {
        type: 'percentage',
        value: 10, // 10% of first purchase
        recurringMonths: 1
      },
      cookieDuration: 30,
      minimumPayout: 25, // $25 USDC minimum
      payoutSchedule: 'monthly',
      terms: 'Earn 10% commission on first purchase of referred users',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Creator referral program
    const creatorProgram: ReferralProgram = {
      id: 'creator-referral-2024',
      name: 'Creator Referral Program',
      type: ReferralProgramType.CREATOR_REFERRAL,
      isActive: true,
      commissionStructure: {
        type: 'percentage',
        value: 15, // 15% of first 3 months
        recurringMonths: 3
      },
      cookieDuration: 60,
      minimumPayout: 50,
      payoutSchedule: 'monthly',
      terms: 'Earn 15% commission on first 3 months of referred creator earnings',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Affiliate program with tiers
    const affiliateProgram: ReferralProgram = {
      id: 'affiliate-program-2024',
      name: 'Affiliate Program',
      type: ReferralProgramType.AFFILIATE_PROGRAM,
      isActive: true,
      commissionStructure: {
        type: 'tiered',
        value: 0,
        tiers: [
          { minReferrals: 0, maxReferrals: 9, commissionRate: 20 },
          { minReferrals: 10, maxReferrals: 49, commissionRate: 25 },
          { minReferrals: 50, maxReferrals: 99, commissionRate: 30 },
          { minReferrals: 100, commissionRate: 35 }
        ],
        recurringMonths: 6
      },
      cookieDuration: 90,
      minimumPayout: 100,
      payoutSchedule: 'monthly',
      terms: 'Tiered commission structure with up to 35% on all purchases',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Agency partnership program
    const agencyProgram: ReferralProgram = {
      id: 'agency-partnership-2024',
      name: 'Agency Partnership Program',
      type: ReferralProgramType.AGENCY_PARTNERSHIP,
      isActive: true,
      commissionStructure: {
        type: 'percentage',
        value: 40, // 40% revenue share
        recurringMonths: 12 // 1 year
      },
      cookieDuration: 180,
      minimumPayout: 500,
      payoutSchedule: 'monthly',
      terms: 'Revenue share partnership for agencies bringing creators',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.programs.set(userProgram.id, userProgram);
    this.programs.set(creatorProgram.id, creatorProgram);
    this.programs.set(affiliateProgram.id, affiliateProgram);
    this.programs.set(agencyProgram.id, agencyProgram);

    logger.info('Referral programs initialized', { 
      programCount: this.programs.size 
    });
  }

  // Generate referral code
  async generateReferralCode(
    programId: string,
    referrerId: string,
    referrerType: 'user' | 'creator' | 'affiliate' | 'agency',
    options: {
      customCode?: string;
      usageLimit?: number;
      expiresAt?: Date;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<ReferralCode> {
    const program = this.programs.get(programId);
    if (!program) {
      throw new Error('Referral program not found');
    }

    if (!program.isActive) {
      throw new Error('Referral program is not active');
    }

    // Generate unique code
    let code = options.customCode;
    if (!code) {
      code = this.generateUniqueCode(referrerType);
    }

    // Check if code already exists
    const existingCode = await this.getCodeByString(code);
    if (existingCode) {
      throw new Error('Referral code already exists');
    }

    const referralCode: ReferralCode = {
      id: crypto.randomUUID(),
      code,
      programId,
      referrerId,
      referrerType,
      isActive: true,
      usageLimit: options.usageLimit,
      usageCount: 0,
      expiresAt: options.expiresAt,
      createdAt: new Date(),
      metadata: options.metadata
    };

    // Store code
    this.codes.set(referralCode.id, referralCode);
    await this.storeReferralCode(referralCode);

    logger.info('Referral code generated', {
      codeId: referralCode.id,
      code: referralCode.code,
      programId,
      referrerId,
      referrerType
    });

    this.emit('referral:code_generated', { referralCode });

    return referralCode;
  }

  // Track referral attribution
  async trackAttribution(
    referralCode: string,
    sessionData: {
      sessionId: string;
      ipAddress: string;
      userAgent: string;
      source?: string;
      medium?: string;
      campaign?: string;
      landingPage: string;
    }
  ): Promise<Attribution | null> {
    const code = await this.getCodeByString(referralCode);
    if (!code || !code.isActive) {
      return null;
    }

    // Check if code is expired
    if (code.expiresAt && new Date() > code.expiresAt) {
      return null;
    }

    // Check usage limit
    if (code.usageLimit && code.usageCount >= code.usageLimit) {
      return null;
    }

    const attribution: Attribution = {
      id: crypto.randomUUID(),
      referralCodeId: code.id,
      referrerId: code.referrerId,
      referredUserId: '', // Will be set when user registers
      sessionId: sessionData.sessionId,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      source: sessionData.source || 'direct',
      medium: sessionData.medium || 'referral',
      campaign: sessionData.campaign || code.code,
      landingPage: sessionData.landingPage,
      attributedAt: new Date(),
      status: 'pending'
    };

    // Store attribution
    await this.storeAttribution(attribution);

    // Set attribution cookie
    await this.setAttributionCookie(sessionData.sessionId, attribution.id);

    logger.info('Referral attribution tracked', {
      attributionId: attribution.id,
      referralCode,
      sessionId: sessionData.sessionId
    });

    this.emit('referral:attribution_tracked', { attribution, code });

    return attribution;
  }

  // Convert attribution when user makes purchase
  async convertAttribution(
    userId: string,
    sessionId: string,
    conversionValue: number,
    conversionType: 'purchase' | 'subscription' | 'creator_signup'
  ): Promise<Attribution | null> {
    // Get attribution from session
    const attributionId = await this.getAttributionFromSession(sessionId);
    if (!attributionId) {
      return null;
    }

    const attribution = await this.getAttribution(attributionId);
    if (!attribution || attribution.status !== 'pending') {
      return null;
    }

    // Check attribution window
    const program = this.programs.get(
      (await this.getReferralCode(attribution.referralCodeId))?.programId || ''
    );
    if (!program) {
      return null;
    }

    const attributionWindow = program.cookieDuration * 24 * 60 * 60 * 1000;
    const isWithinWindow = Date.now() - attribution.attributedAt.getTime() < attributionWindow;
    
    if (!isWithinWindow) {
      return null;
    }

    // Calculate commission
    const commission = this.calculateCommission(program, conversionValue, attribution.referrerId);

    // Update attribution
    attribution.referredUserId = userId;
    attribution.convertedAt = new Date();
    attribution.conversionValue = conversionValue;
    attribution.commissionEarned = commission;
    attribution.status = 'converted';

    await this.storeAttribution(attribution);

    // Update referral code usage count
    const code = await this.getReferralCode(attribution.referralCodeId);
    if (code) {
      code.usageCount++;
      await this.storeReferralCode(code);
    }

    logger.info('Referral conversion tracked', {
      attributionId: attribution.id,
      userId,
      conversionValue,
      commission,
      conversionType
    });

    this.emit('referral:conversion', { 
      attribution, 
      conversionType, 
      commission 
    });

    return attribution;
  }

  // Calculate commission based on program structure
  private calculateCommission(
    program: ReferralProgram,
    conversionValue: number,
    referrerId: string
  ): number {
    const { commissionStructure } = program;

    switch (commissionStructure.type) {
      case 'percentage':
        return (conversionValue * commissionStructure.value) / 100;

      case 'fixed':
        return commissionStructure.value;

      case 'tiered':
        if (!commissionStructure.tiers) return 0;
        
        // Get referrer's total referral count (mock for now)
        const referralCount = 25; // In production, query from database
        
        const tier = commissionStructure.tiers.find(t => 
          referralCount >= t.minReferrals && 
          (!t.maxReferrals || referralCount <= t.maxReferrals)
        );
        
        return tier ? (conversionValue * tier.commissionRate) / 100 : 0;

      default:
        return 0;
    }
  }

  // Generate unique referral code
  private generateUniqueCode(referrerType: string): string {
    const prefix = referrerType.charAt(0).toUpperCase();
    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}${randomPart}`;
  }

  // Get referral code by string
  private async getCodeByString(code: string): Promise<ReferralCode | null> {
    // In production, query database
    for (const [, referralCode] of this.codes) {
      if (referralCode.code === code) {
        return referralCode;
      }
    }
    return null;
  }

  // Get referral code by ID
  private async getReferralCode(codeId: string): Promise<ReferralCode | null> {
    return this.codes.get(codeId) || null;
  }

  // Store referral code
  private async storeReferralCode(code: ReferralCode): Promise<void> {
    await redis.setex(`referral:code:${code.id}`, 86400 * 365, JSON.stringify(code));
    await redis.setex(`referral:code_lookup:${code.code}`, 86400 * 365, code.id);
  }

  // Store attribution
  private async storeAttribution(attribution: Attribution): Promise<void> {
    await redis.setex(`referral:attribution:${attribution.id}`, 86400 * 90, JSON.stringify(attribution));
  }

  // Get attribution
  private async getAttribution(attributionId: string): Promise<Attribution | null> {
    const data = await redis.get(`referral:attribution:${attributionId}`);
    return data ? JSON.parse(data) : null;
  }

  // Set attribution cookie
  private async setAttributionCookie(sessionId: string, attributionId: string): Promise<void> {
    await redis.setex(`referral:session:${sessionId}`, 86400 * 90, attributionId);
  }

  // Get attribution from session
  private async getAttributionFromSession(sessionId: string): Promise<string | null> {
    return await redis.get(`referral:session:${sessionId}`);
  }

  // Generate referral link
  async generateReferralLink(
    referralCode: string,
    targetPath: string = '/',
    utmParams: {
      source?: string;
      medium?: string;
      campaign?: string;
    } = {}
  ): Promise<string> {
    const baseUrl = process.env.FRONTEND_URL || 'https://platform.com';
    const url = new URL(targetPath, baseUrl);
    
    url.searchParams.set('ref', referralCode);
    
    if (utmParams.source) url.searchParams.set('utm_source', utmParams.source);
    if (utmParams.medium) url.searchParams.set('utm_medium', utmParams.medium);
    if (utmParams.campaign) url.searchParams.set('utm_campaign', utmParams.campaign);
    
    return url.toString();
  }

  // Get referrer analytics
  async getReferrerAnalytics(
    referrerId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<{
    totalReferrals: number;
    conversions: number;
    conversionRate: number;
    totalCommission: number;
    pendingCommission: number;
    topPerformingCodes: Array<{
      code: string;
      referrals: number;
      conversions: number;
      commission: number;
    }>;
  }> {
    // Mock implementation - in production, query database
    return {
      totalReferrals: 150,
      conversions: 45,
      conversionRate: 30,
      totalCommission: 2250.50,
      pendingCommission: 450.25,
      topPerformingCodes: [
        { code: 'A1B2C3D4', referrals: 50, conversions: 18, commission: 900 },
        { code: 'E5F6G7H8', referrals: 35, conversions: 12, commission: 600 },
        { code: 'I9J0K1L2', referrals: 25, conversions: 8, commission: 400 }
      ]
    };
  }

  // Process commission payouts
  async processCommissionPayouts(period: string): Promise<CommissionPayout[]> {
    // Mock implementation - in production, calculate actual payouts
    const payouts: CommissionPayout[] = [];
    
    logger.info('Processing commission payouts', { period });
    
    this.emit('referral:payouts_processed', { period, payouts });
    
    return payouts;
  }

  // Get program performance metrics
  async getProgramMetrics(programId: string): Promise<{
    totalReferrals: number;
    totalConversions: number;
    totalCommissionPaid: number;
    averageConversionValue: number;
    topReferrers: Array<{
      referrerId: string;
      referrals: number;
      conversions: number;
      commission: number;
    }>;
  }> {
    // Mock implementation
    return {
      totalReferrals: 1250,
      totalConversions: 375,
      totalCommissionPaid: 18750.00,
      averageConversionValue: 125.50,
      topReferrers: [
        { referrerId: 'user-1', referrals: 100, conversions: 35, commission: 1750 },
        { referrerId: 'creator-2', referrals: 85, conversions: 28, commission: 1400 },
        { referrerId: 'affiliate-3', referrals: 75, conversions: 25, commission: 1250 }
      ]
    };
  }
}

export const referralService = new ReferralService();