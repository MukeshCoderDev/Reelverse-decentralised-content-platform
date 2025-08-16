import express from 'express';
import { publicApiService } from '../../services/publicApiService';
import { analyticsApiService } from '../../services/analyticsApiService';
import { contentSearchApiService } from '../../services/contentSearchApiService';
import { entitlementApiService } from '../../services/entitlementApiService';
import { webhookApiService } from '../../services/webhookApiService';

const router = express.Router();

// Middleware to add CORS headers for public API
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// API Documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    name: 'Platform Public API',
    version: '1.0.0',
    description: 'Public API for partner integrations and analytics access',
    documentation: 'https://docs.platform.com/api',
    endpoints: {
      analytics: {
        'GET /analytics': 'Get analytics data',
        'GET /analytics/content/:contentId': 'Get content metrics',
        'GET /analytics/revenue': 'Get revenue breakdown'
      },
      search: {
        'GET /search': 'Search content',
        'GET /content/:id': 'Get content details',
        'GET /trending': 'Get trending content',
        'GET /recommendations/:contentId': 'Get content recommendations'
      },
      entitlements: {
        'POST /entitlements/check': 'Check user entitlements',
        'POST /entitlements/bulk': 'Bulk entitlement check',
        'GET /users/:userId/library': 'Get user library',
        'GET /users/:userId/subscription': 'Get subscription status'
      },
      webhooks: {
        'POST /webhooks': 'Create webhook',
        'GET /webhooks': 'List webhooks',
        'PUT /webhooks/:id': 'Update webhook',
        'DELETE /webhooks/:id': 'Delete webhook',
        'GET /webhooks/:id/deliveries': 'Get webhook deliveries'
      }
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer YOUR_API_KEY',
      scopes: ['analytics:read', 'content:search', 'entitlements:verify', 'webhooks:manage']
    },
    rateLimits: {
      basic: '100 requests per 15 minutes',
      premium: '1,000 requests per 15 minutes',
      enterprise: '10,000 requests per 15 minutes'
    }
  });
});

// Analytics endpoints
router.get('/analytics', 
  publicApiService.createAuthMiddleware('analytics:read'),
  async (req, res) => {
    try {
      const query = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        organizationId: req.query.organizationId as string,
        metrics: req.query.metrics ? (req.query.metrics as string).split(',') : undefined,
        groupBy: req.query.groupBy as 'day' | 'week' | 'month'
      };

      const analytics = await analyticsApiService.getAnalytics(query, req.apiKey?.organizationId);
      
      res.json(publicApiService.createSuccessResponse(analytics, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

router.get('/analytics/content/:contentId',
  publicApiService.createAuthMiddleware('analytics:read'),
  async (req, res) => {
    try {
      const contentIds = [req.params.contentId];
      const metrics = await analyticsApiService.getContentMetrics(contentIds, req.apiKey?.organizationId);
      
      res.json(publicApiService.createSuccessResponse(metrics[0] || null, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

router.get('/analytics/revenue',
  publicApiService.createAuthMiddleware('analytics:read'),
  async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const groupBy = req.query.groupBy as 'day' | 'week' | 'month' || 'day';

      const revenue = await analyticsApiService.getRevenueBreakdown(
        startDate, 
        endDate, 
        groupBy, 
        req.apiKey?.organizationId
      );
      
      res.json(publicApiService.createSuccessResponse(revenue, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

// Content search endpoints
router.get('/search',
  publicApiService.createAuthMiddleware('content:search'),
  async (req, res) => {
    try {
      const searchQuery = {
        query: req.query.q as string,
        filters: req.query.filters ? JSON.parse(req.query.filters as string) : undefined,
        sort: req.query.sort as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
      };

      const results = await contentSearchApiService.searchContent(searchQuery, req.apiKey?.organizationId);
      
      res.json(publicApiService.createSuccessResponse(results, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

router.get('/content/:id',
  publicApiService.createAuthMiddleware('content:search'),
  async (req, res) => {
    try {
      const content = await contentSearchApiService.getContentById(req.params.id, req.apiKey?.organizationId);
      
      if (!content) {
        return res.status(404).json(
          publicApiService.createErrorResponse('NOT_FOUND', 'Content not found', req.correlationId)
        );
      }
      
      res.json(publicApiService.createSuccessResponse(content, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

router.get('/trending',
  publicApiService.createAuthMiddleware('content:search'),
  async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const trending = await contentSearchApiService.getTrendingContent(limit, req.apiKey?.organizationId);
      
      res.json(publicApiService.createSuccessResponse(trending, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

router.get('/recommendations/:contentId',
  publicApiService.createAuthMiddleware('content:search'),
  async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const recommendations = await contentSearchApiService.getRecommendations(
        req.params.contentId, 
        limit, 
        req.apiKey?.organizationId
      );
      
      res.json(publicApiService.createSuccessResponse(recommendations, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

// Entitlement endpoints
router.post('/entitlements/check',
  publicApiService.createAuthMiddleware('entitlements:verify'),
  async (req, res) => {
    try {
      const entitlementCheck = req.body;
      const result = await entitlementApiService.checkEntitlement(entitlementCheck);
      
      res.json(publicApiService.createSuccessResponse(result, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

router.post('/entitlements/bulk',
  publicApiService.createAuthMiddleware('entitlements:verify'),
  async (req, res) => {
    try {
      const bulkCheck = req.body;
      const results = await entitlementApiService.checkBulkEntitlements(bulkCheck);
      
      res.json(publicApiService.createSuccessResponse(results, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

router.get('/users/:userId/library',
  publicApiService.createAuthMiddleware('entitlements:verify'),
  async (req, res) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      const library = await entitlementApiService.getUserLibrary(req.params.userId, page, limit);
      
      res.json(publicApiService.createSuccessResponse(library, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

router.get('/users/:userId/subscription',
  publicApiService.createAuthMiddleware('entitlements:verify'),
  async (req, res) => {
    try {
      const subscription = await entitlementApiService.getSubscriptionStatus(req.params.userId);
      
      res.json(publicApiService.createSuccessResponse(subscription, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

// Webhook endpoints
router.post('/webhooks',
  publicApiService.createAuthMiddleware('webhooks:manage'),
  async (req, res) => {
    try {
      const { url, events, description } = req.body;
      const webhook = await webhookApiService.createWebhook(
        url, 
        events, 
        req.apiKey?.organizationId, 
        description
      );
      
      res.status(201).json(publicApiService.createSuccessResponse(webhook, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

router.get('/webhooks',
  publicApiService.createAuthMiddleware('webhooks:manage'),
  async (req, res) => {
    try {
      const webhooks = await webhookApiService.listWebhooks(req.apiKey?.organizationId);
      
      res.json(publicApiService.createSuccessResponse(webhooks, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

router.put('/webhooks/:id',
  publicApiService.createAuthMiddleware('webhooks:manage'),
  async (req, res) => {
    try {
      const updates = req.body;
      const webhook = await webhookApiService.updateWebhook(req.params.id, updates);
      
      res.json(publicApiService.createSuccessResponse(webhook, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

router.delete('/webhooks/:id',
  publicApiService.createAuthMiddleware('webhooks:manage'),
  async (req, res) => {
    try {
      await webhookApiService.deleteWebhook(req.params.id);
      
      res.json(publicApiService.createSuccessResponse({ deleted: true }, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

router.get('/webhooks/:id/deliveries',
  publicApiService.createAuthMiddleware('webhooks:manage'),
  async (req, res) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      const deliveries = await webhookApiService.getWebhookDeliveries(req.params.id, page, limit);
      
      res.json(publicApiService.createSuccessResponse(deliveries, req.correlationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json(
        publicApiService.createErrorResponse('INVALID_REQUEST', errorMessage, req.correlationId)
      );
    }
  }
);

export default router;