import { Router } from 'express';
import { z } from 'zod';
import { publicAPIService, APIScope, APIRequest } from '../../../services/api/PublicAPIService';
import { referralService, ReferralProgramType } from '../../../services/growth/ReferralService';
import { affiliateDashboardService } from '../../../services/growth/AffiliateDashboardService';

const router = Router();

// Apply middleware to all referral routes
router.use(publicAPIService.correlationMiddleware);
router.use(publicAPIService.rateLimitMiddleware);
router.use(publicAPIService.authenticateAPIKey);

// Validation schemas
const generateCodeSchema = z.object({
  programId: z.string(),
  referrerType: z.enum(['user', 'creator', 'affiliate', 'agency']),
  customCode: z.string().optional(),
  usageLimit: z.number().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional()
});

const trackAttributionSchema = z.object({
  referralCode: z.string(),
  sessionId: z.string(),
  ipAddress: z.string().ip(),
  userAgent: z.string(),
  source: z.string().optional(),
  medium: z.string().optional(),
  campaign: z.string().optional(),
  landingPage: z.string().url()
});

const convertAttributionSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string(),
  conversionValue: z.number().min(0),
  conversionType: z.enum(['purchase', 'subscription', 'creator_signup'])
});

const generateLinkSchema = z.object({
  referralCode: z.string(),
  targetPath: z.string().default('/'),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional()
});

const dashboardMetricsSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime()
});

// GET /api/v1/referrals/programs
router.get('/programs', async (req: APIRequest, res) => {
  try {
    // Mock program data - in production, fetch from database
    const programs = [
      {
        id: 'user-referral-2024',
        name: 'User Referral Program',
        type: 'user_referral',
        description: 'Earn 10% commission on first purchase of referred users',
        commissionRate: 10,
        cookieDuration: 30,
        minimumPayout: 25,
        isActive: true
      },
      {
        id: 'creator-referral-2024',
        name: 'Creator Referral Program',
        type: 'creator_referral',
        description: 'Earn 15% commission on first 3 months of referred creator earnings',
        commissionRate: 15,
        cookieDuration: 60,
        minimumPayout: 50,
        isActive: true
      },
      {
        id: 'affiliate-program-2024',
        name: 'Affiliate Program',
        type: 'affiliate_program',
        description: 'Tiered commission structure with up to 35% on all purchases',
        commissionRate: 35,
        cookieDuration: 90,
        minimumPayout: 100,
        isActive: true
      }
    ];

    publicAPIService.sendResponse(res, req.correlationId, {
      programs
    });
  } catch (error) {
    publicAPIService.sendError(res, req.correlationId, 'PROGRAMS_ERROR', 
      'Failed to fetch referral programs', 500);
  }
});

// POST /api/v1/referrals/codes
router.post('/codes', async (req: APIRequest, res) => {
  try {
    const codeData = generateCodeSchema.parse(req.body);
    
    const referralCode = await referralService.generateReferralCode(
      codeData.programId,
      req.apiKey!.organizationId, // Use org ID as referrer ID for API keys
      codeData.referrerType,
      {
        customCode: codeData.customCode,
        usageLimit: codeData.usageLimit,
        expiresAt: codeData.expiresAt ? new Date(codeData.expiresAt) : undefined,
        metadata: codeData.metadata
      }
    );

    publicAPIService.sendResponse(res, req.correlationId, {
      id: referralCode.id,
      code: referralCode.code,
      programId: referralCode.programId,
      isActive: referralCode.isActive,
      usageLimit: referralCode.usageLimit,
      usageCount: referralCode.usageCount,
      expiresAt: referralCode.expiresAt,
      createdAt: referralCode.createdAt
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid referral code data', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'CODE_GENERATION_ERROR', 
        error.message, 400);
    }
  }
});

// POST /api/v1/referrals/track
router.post('/track', async (req: APIRequest, res) => {
  try {
    const trackingData = trackAttributionSchema.parse(req.body);
    
    const attribution = await referralService.trackAttribution(
      trackingData.referralCode,
      {
        sessionId: trackingData.sessionId,
        ipAddress: trackingData.ipAddress,
        userAgent: trackingData.userAgent,
        source: trackingData.source,
        medium: trackingData.medium,
        campaign: trackingData.campaign,
        landingPage: trackingData.landingPage
      }
    );

    if (!attribution) {
      publicAPIService.sendError(res, req.correlationId, 'INVALID_REFERRAL_CODE', 
        'Referral code not found or inactive', 404);
      return;
    }

    publicAPIService.sendResponse(res, req.correlationId, {
      attributionId: attribution.id,
      referralCode: trackingData.referralCode,
      sessionId: trackingData.sessionId,
      attributedAt: attribution.attributedAt,
      status: attribution.status
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid tracking data', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'TRACKING_ERROR', 
        'Failed to track attribution', 500);
    }
  }
});

// POST /api/v1/referrals/convert
router.post('/convert', async (req: APIRequest, res) => {
  try {
    const conversionData = convertAttributionSchema.parse(req.body);
    
    const attribution = await referralService.convertAttribution(
      conversionData.userId,
      conversionData.sessionId,
      conversionData.conversionValue,
      conversionData.conversionType
    );

    if (!attribution) {
      publicAPIService.sendError(res, req.correlationId, 'NO_ATTRIBUTION', 
        'No valid attribution found for conversion', 404);
      return;
    }

    publicAPIService.sendResponse(res, req.correlationId, {
      attributionId: attribution.id,
      userId: conversionData.userId,
      conversionValue: conversionData.conversionValue,
      commissionEarned: attribution.commissionEarned,
      convertedAt: attribution.convertedAt,
      status: attribution.status
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid conversion data', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'CONVERSION_ERROR', 
        'Failed to process conversion', 500);
    }
  }
});

// POST /api/v1/referrals/links
router.post('/links', async (req: APIRequest, res) => {
  try {
    const linkData = generateLinkSchema.parse(req.body);
    
    const referralLink = await referralService.generateReferralLink(
      linkData.referralCode,
      linkData.targetPath,
      {
        source: linkData.utmSource,
        medium: linkData.utmMedium,
        campaign: linkData.utmCampaign
      }
    );

    publicAPIService.sendResponse(res, req.correlationId, {
      referralCode: linkData.referralCode,
      targetPath: linkData.targetPath,
      referralLink,
      utmParams: {
        source: linkData.utmSource,
        medium: linkData.utmMedium,
        campaign: linkData.utmCampaign
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid link data', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'LINK_GENERATION_ERROR', 
        'Failed to generate referral link', 500);
    }
  }
});

// GET /api/v1/referrals/analytics/:referrerId
router.get('/analytics/:referrerId', async (req: APIRequest, res) => {
  try {
    const { referrerId } = z.object({ referrerId: z.string() }).parse(req.params);
    const { startDate, endDate } = dashboardMetricsSchema.parse(req.query);
    
    const analytics = await referralService.getReferrerAnalytics(referrerId, {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    });

    publicAPIService.sendResponse(res, req.correlationId, {
      referrerId,
      timeRange: { startDate, endDate },
      analytics
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid parameters', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'ANALYTICS_ERROR', 
        'Failed to fetch analytics', 500);
    }
  }
});

// GET /api/v1/referrals/dashboard/:affiliateId
router.get('/dashboard/:affiliateId', async (req: APIRequest, res) => {
  try {
    const { affiliateId } = z.object({ affiliateId: z.string() }).parse(req.params);
    const { startDate, endDate } = dashboardMetricsSchema.parse(req.query);
    
    const dashboardMetrics = await affiliateDashboardService.getDashboardMetrics(
      affiliateId,
      {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      }
    );

    publicAPIService.sendResponse(res, req.correlationId, {
      affiliateId,
      timeRange: { startDate, endDate },
      metrics: dashboardMetrics
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid parameters', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'DASHBOARD_ERROR', 
        'Failed to fetch dashboard metrics', 500);
    }
  }
});

// GET /api/v1/referrals/dashboard/:affiliateId/realtime
router.get('/dashboard/:affiliateId/realtime', async (req: APIRequest, res) => {
  try {
    const { affiliateId } = z.object({ affiliateId: z.string() }).parse(req.params);
    
    const realtimeMetrics = await affiliateDashboardService.getRealTimeMetrics(affiliateId);

    publicAPIService.sendResponse(res, req.correlationId, {
      affiliateId,
      timestamp: new Date().toISOString(),
      metrics: realtimeMetrics
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid affiliate ID', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'REALTIME_ERROR', 
        'Failed to fetch real-time metrics', 500);
    }
  }
});

// GET /api/v1/referrals/marketing-materials
router.get('/marketing-materials', async (req: APIRequest, res) => {
  try {
    const { category, type } = z.object({
      category: z.string().optional(),
      type: z.enum(['banner', 'text_link', 'video', 'email_template', 'social_post']).optional()
    }).parse(req.query);
    
    const materials = await affiliateDashboardService.getMarketingMaterials(category, type);

    publicAPIService.sendResponse(res, req.correlationId, {
      materials,
      totalCount: materials.length,
      categories: [...new Set(materials.map(m => m.category))],
      types: [...new Set(materials.map(m => m.type))]
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid filter parameters', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'MATERIALS_ERROR', 
        'Failed to fetch marketing materials', 500);
    }
  }
});

// POST /api/v1/referrals/tracking-link
router.post('/tracking-link', async (req: APIRequest, res) => {
  try {
    const { referralCode, targetUrl, campaignName } = z.object({
      referralCode: z.string(),
      targetUrl: z.string().url(),
      campaignName: z.string().optional()
    }).parse(req.body);
    
    const trackingLink = await affiliateDashboardService.generateTrackingLink(
      req.apiKey!.organizationId,
      referralCode,
      targetUrl,
      campaignName
    );

    publicAPIService.sendResponse(res, req.correlationId, {
      referralCode,
      targetUrl,
      campaignName,
      trackingLink,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid tracking link data', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'TRACKING_LINK_ERROR', 
        'Failed to generate tracking link', 500);
    }
  }
});

// GET /api/v1/referrals/programs/:programId/metrics
router.get('/programs/:programId/metrics', async (req: APIRequest, res) => {
  try {
    const { programId } = z.object({ programId: z.string() }).parse(req.params);
    
    const metrics = await referralService.getProgramMetrics(programId);

    publicAPIService.sendResponse(res, req.correlationId, {
      programId,
      metrics,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid program ID', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'PROGRAM_METRICS_ERROR', 
        'Failed to fetch program metrics', 500);
    }
  }
});

export default router;