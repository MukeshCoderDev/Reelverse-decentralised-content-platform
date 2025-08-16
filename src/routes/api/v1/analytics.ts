import { Router } from 'express';
import { z } from 'zod';
import { publicAPIService, APIScope, APIRequest } from '../../../services/api/PublicAPIService';
import { analyticsService } from '../../../services/analytics/AnalyticsService';

const router = Router();

// Apply middleware to all analytics routes
router.use(publicAPIService.correlationMiddleware);
router.use(publicAPIService.rateLimitMiddleware);
router.use(publicAPIService.authenticateAPIKey);
router.use(publicAPIService.requireScope(APIScope.READ_ANALYTICS));

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h')
});

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
});

// GET /api/v1/analytics/overview
router.get('/overview', async (req: APIRequest, res) => {
  try {
    const query = dateRangeSchema.parse(req.query);
    
    const overview = await analyticsService.getOverview({
      organizationId: req.apiKey!.organizationId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      period: query.period
    });

    publicAPIService.sendResponse(res, req.correlationId, overview);
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid query parameters', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'INTERNAL_ERROR', 
        'Failed to fetch analytics overview', 500);
    }
  }
});

// GET /api/v1/analytics/revenue
router.get('/revenue', async (req: APIRequest, res) => {
  try {
    const query = dateRangeSchema.parse(req.query);
    
    const revenue = await analyticsService.getRevenueMetrics({
      organizationId: req.apiKey!.organizationId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      period: query.period
    });

    publicAPIService.sendResponse(res, req.correlationId, revenue);
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid query parameters', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'INTERNAL_ERROR', 
        'Failed to fetch revenue metrics', 500);
    }
  }
});

// GET /api/v1/analytics/content/performance
router.get('/content/performance', async (req: APIRequest, res) => {
  try {
    const query = { ...dateRangeSchema.parse(req.query), ...paginationSchema.parse(req.query) };
    
    const performance = await analyticsService.getContentPerformance({
      organizationId: req.apiKey!.organizationId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      period: query.period,
      page: query.page,
      limit: query.limit
    });

    publicAPIService.sendResponse(res, req.correlationId, performance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid query parameters', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'INTERNAL_ERROR', 
        'Failed to fetch content performance', 500);
    }
  }
});

// GET /api/v1/analytics/users/engagement
router.get('/users/engagement', async (req: APIRequest, res) => {
  try {
    const query = dateRangeSchema.parse(req.query);
    
    const engagement = await analyticsService.getUserEngagement({
      organizationId: req.apiKey!.organizationId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      period: query.period
    });

    publicAPIService.sendResponse(res, req.correlationId, engagement);
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid query parameters', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'INTERNAL_ERROR', 
        'Failed to fetch user engagement', 500);
    }
  }
});

// GET /api/v1/analytics/payouts
router.get('/payouts', async (req: APIRequest, res) => {
  try {
    const query = { ...dateRangeSchema.parse(req.query), ...paginationSchema.parse(req.query) };
    
    const payouts = await analyticsService.getPayoutMetrics({
      organizationId: req.apiKey!.organizationId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      period: query.period,
      page: query.page,
      limit: query.limit
    });

    publicAPIService.sendResponse(res, req.correlationId, payouts);
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid query parameters', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'INTERNAL_ERROR', 
        'Failed to fetch payout metrics', 500);
    }
  }
});

export default router;