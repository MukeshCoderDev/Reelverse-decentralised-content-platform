import { Router } from 'express';
import { z } from 'zod';
import { publicAPIService, APIScope, APIRequest } from '../../../services/api/PublicAPIService';
import { entitlementService } from '../../../services/entitlements/EntitlementService';

const router = Router();

// Apply middleware to all entitlement routes
router.use(publicAPIService.correlationMiddleware);
router.use(publicAPIService.rateLimitMiddleware);
router.use(publicAPIService.authenticateAPIKey);
router.use(publicAPIService.requireScope(APIScope.VERIFY_ENTITLEMENTS));

// Validation schemas
const verifyEntitlementSchema = z.object({
  userId: z.string().uuid(),
  contentId: z.string().uuid(),
  accessType: z.enum(['view', 'download', 'stream']).default('view')
});

const bulkVerifySchema = z.object({
  requests: z.array(verifyEntitlementSchema).max(100)
});

const userEntitlementsSchema = z.object({
  userId: z.string().uuid(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['active', 'expired', 'all']).default('active')
});

// POST /api/v1/entitlements/verify
router.post('/verify', async (req: APIRequest, res) => {
  try {
    const { userId, contentId, accessType } = verifyEntitlementSchema.parse(req.body);
    
    const entitlement = await entitlementService.verifyEntitlement({
      userId,
      contentId,
      accessType,
      organizationId: req.apiKey!.organizationId
    });

    publicAPIService.sendResponse(res, req.correlationId, {
      userId,
      contentId,
      accessType,
      hasAccess: entitlement.hasAccess,
      entitlementType: entitlement.type,
      expiresAt: entitlement.expiresAt,
      restrictions: entitlement.restrictions
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid verification request', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'VERIFICATION_ERROR', 
        'Entitlement verification failed', 500);
    }
  }
});

// POST /api/v1/entitlements/verify/bulk
router.post('/verify/bulk', async (req: APIRequest, res) => {
  try {
    const { requests } = bulkVerifySchema.parse(req.body);
    
    const results = await Promise.all(
      requests.map(async (request) => {
        try {
          const entitlement = await entitlementService.verifyEntitlement({
            ...request,
            organizationId: req.apiKey!.organizationId
          });
          
          return {
            userId: request.userId,
            contentId: request.contentId,
            accessType: request.accessType,
            hasAccess: entitlement.hasAccess,
            entitlementType: entitlement.type,
            expiresAt: entitlement.expiresAt,
            restrictions: entitlement.restrictions,
            error: null
          };
        } catch (error) {
          return {
            userId: request.userId,
            contentId: request.contentId,
            accessType: request.accessType,
            hasAccess: false,
            error: error.message
          };
        }
      })
    );

    publicAPIService.sendResponse(res, req.correlationId, {
      results,
      totalRequests: requests.length,
      successCount: results.filter(r => !r.error).length,
      errorCount: results.filter(r => r.error).length
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid bulk verification request', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'BULK_VERIFICATION_ERROR', 
        'Bulk verification failed', 500);
    }
  }
});

// GET /api/v1/entitlements/user/:userId
router.get('/user/:userId', async (req: APIRequest, res) => {
  try {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.params);
    const { page, limit, status } = userEntitlementsSchema.parse(req.query);
    
    const entitlements = await entitlementService.getUserEntitlements({
      userId,
      organizationId: req.apiKey!.organizationId,
      page,
      limit,
      status
    });

    publicAPIService.sendResponse(res, req.correlationId, {
      userId,
      entitlements: entitlements.items.map(e => ({
        contentId: e.contentId,
        contentTitle: e.content?.title,
        entitlementType: e.type,
        accessTypes: e.accessTypes,
        purchasedAt: e.createdAt,
        expiresAt: e.expiresAt,
        status: e.status,
        restrictions: e.restrictions
      })),
      pagination: {
        page,
        limit,
        total: entitlements.total,
        totalPages: Math.ceil(entitlements.total / limit)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid user ID or parameters', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'USER_ENTITLEMENTS_ERROR', 
        'Failed to fetch user entitlements', 500);
    }
  }
});

// GET /api/v1/entitlements/content/:contentId/stats
router.get('/content/:contentId/stats', async (req: APIRequest, res) => {
  try {
    const { contentId } = z.object({ contentId: z.string().uuid() }).parse(req.params);
    
    const stats = await entitlementService.getContentEntitlementStats({
      contentId,
      organizationId: req.apiKey!.organizationId
    });

    publicAPIService.sendResponse(res, req.correlationId, {
      contentId,
      stats: {
        totalPurchases: stats.totalPurchases,
        activePurchases: stats.activePurchases,
        revenue: stats.revenue,
        uniqueUsers: stats.uniqueUsers,
        averagePrice: stats.averagePrice,
        conversionRate: stats.conversionRate
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid content ID', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'CONTENT_STATS_ERROR', 
        'Failed to fetch content stats', 500);
    }
  }
});

export default router;