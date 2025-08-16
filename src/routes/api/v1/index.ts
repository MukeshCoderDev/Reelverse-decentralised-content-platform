import { Router } from 'express';
import analyticsRouter from './analytics';
import searchRouter from './search';
import entitlementsRouter from './entitlements';
import webhooksRouter from './webhooks';
import { publicAPIService } from '../../../services/api/PublicAPIService';

const router = Router();

// API Info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Decentralized Adult Platform API',
    version: '1.0.0',
    description: 'Public API for partner integrations and analytics access',
    documentation: '/docs',
    endpoints: {
      analytics: '/analytics',
      search: '/search', 
      entitlements: '/entitlements',
      webhooks: '/webhooks'
    },
    rateLimit: {
      default: '100 requests per minute',
      authenticated: '1000 requests per minute'
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <api-key>'
    }
  });
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mount API routes
router.use('/analytics', analyticsRouter);
router.use('/search', searchRouter);
router.use('/entitlements', entitlementsRouter);
router.use('/webhooks', webhooksRouter);

// Global error handler for API routes
router.use((error: any, req: any, res: any, next: any) => {
  const correlationId = req.correlationId || 'unknown';
  
  publicAPIService.sendError(
    res, 
    correlationId, 
    'INTERNAL_ERROR', 
    'An unexpected error occurred', 
    500,
    process.env.NODE_ENV === 'development' ? error.stack : undefined
  );
});

export default router;