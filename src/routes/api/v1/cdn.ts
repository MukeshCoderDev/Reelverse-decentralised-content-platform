import { Router } from 'express';
import { z } from 'zod';
import { publicAPIService, APIScope, APIRequest } from '../../../services/api/PublicAPIService';
import { multiCDNService, CDNProvider } from '../../../services/cdn/MultiCDNService';
import { cdnMonitoringService } from '../../../services/cdn/CDNMonitoringService';

const router = Router();

// Apply middleware to all CDN routes
router.use(publicAPIService.correlationMiddleware);
router.use(publicAPIService.rateLimitMiddleware);
router.use(publicAPIService.authenticateAPIKey);

// Validation schemas
const signedUrlSchema = z.object({
  contentId: z.string().uuid(),
  expiresIn: z.number().min(60).max(86400).default(3600), // 1 minute to 24 hours
  allowedIPs: z.array(z.string().ip()).optional(),
  allowedCountries: z.array(z.string().length(2)).optional(),
  maxDownloads: z.number().min(1).optional(),
  preferredProvider: z.nativeEnum(CDNProvider).optional()
});

const failoverUrlSchema = z.object({
  contentId: z.string().uuid(),
  expiresIn: z.number().min(60).max(86400).default(3600)
});

// GET /api/v1/cdn/status
router.get('/status', async (req: APIRequest, res) => {
  try {
    const metrics = await multiCDNService.getPerformanceMetrics();
    const activeAlerts = await cdnMonitoringService.getActiveAlerts();
    
    publicAPIService.sendResponse(res, req.correlationId, {
      status: 'operational',
      cdns: metrics.cdns,
      currentPrimary: metrics.currentPrimary,
      totalRequests: metrics.totalRequests,
      failoverCount: metrics.failoverCount,
      activeAlerts: activeAlerts.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    publicAPIService.sendError(res, req.correlationId, 'CDN_STATUS_ERROR', 
      'Failed to fetch CDN status', 500);
  }
});

// POST /api/v1/cdn/signed-url
router.post('/signed-url', async (req: APIRequest, res) => {
  try {
    const urlConfig = signedUrlSchema.parse(req.body);
    
    const signedUrl = await multiCDNService.generateSignedURL({
      contentId: urlConfig.contentId,
      expiresIn: urlConfig.expiresIn,
      allowedIPs: urlConfig.allowedIPs,
      allowedCountries: urlConfig.allowedCountries,
      maxDownloads: urlConfig.maxDownloads
    }, urlConfig.preferredProvider);

    publicAPIService.sendResponse(res, req.correlationId, {
      url: signedUrl,
      contentId: urlConfig.contentId,
      expiresAt: new Date(Date.now() + urlConfig.expiresIn * 1000).toISOString(),
      provider: urlConfig.preferredProvider || 'auto-selected',
      restrictions: {
        allowedIPs: urlConfig.allowedIPs,
        allowedCountries: urlConfig.allowedCountries,
        maxDownloads: urlConfig.maxDownloads
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid signed URL request', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'SIGNED_URL_ERROR', 
        'Failed to generate signed URL', 500);
    }
  }
});

// POST /api/v1/cdn/failover-urls
router.post('/failover-urls', async (req: APIRequest, res) => {
  try {
    const urlConfig = failoverUrlSchema.parse(req.body);
    
    const urls = await multiCDNService.generateFailoverURLs({
      contentId: urlConfig.contentId,
      expiresIn: urlConfig.expiresIn
    });

    publicAPIService.sendResponse(res, req.correlationId, {
      primary: urls.primary,
      fallback: urls.fallback,
      contentId: urlConfig.contentId,
      expiresAt: new Date(Date.now() + urlConfig.expiresIn * 1000).toISOString(),
      totalUrls: 1 + urls.fallback.length
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid failover URL request', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'FAILOVER_URL_ERROR', 
        'Failed to generate failover URLs', 500);
    }
  }
});

// GET /api/v1/cdn/performance
router.get('/performance', async (req: APIRequest, res) => {
  try {
    const { timeRange } = z.object({
      timeRange: z.coerce.number().min(300).max(86400).default(3600) // 5 minutes to 24 hours
    }).parse(req.query);
    
    const metrics = await cdnMonitoringService.getPerformanceMetrics(timeRange);
    
    // Aggregate metrics by provider
    const aggregated = metrics.reduce((acc, metric) => {
      if (!acc[metric.provider]) {
        acc[metric.provider] = {
          provider: metric.provider,
          avgResponseTime: 0,
          avgErrorRate: 0,
          avgThroughput: 0,
          avgCacheHitRatio: 0,
          totalBandwidth: 0,
          dataPoints: 0
        };
      }
      
      const agg = acc[metric.provider];
      agg.avgResponseTime = (agg.avgResponseTime * agg.dataPoints + metric.responseTime) / (agg.dataPoints + 1);
      agg.avgErrorRate = (agg.avgErrorRate * agg.dataPoints + metric.errorRate) / (agg.dataPoints + 1);
      agg.avgThroughput = (agg.avgThroughput * agg.dataPoints + metric.throughput) / (agg.dataPoints + 1);
      agg.avgCacheHitRatio = (agg.avgCacheHitRatio * agg.dataPoints + metric.cacheHitRatio) / (agg.dataPoints + 1);
      agg.totalBandwidth += metric.bandwidthUsage;
      agg.dataPoints++;
      
      return acc;
    }, {} as any);

    publicAPIService.sendResponse(res, req.correlationId, {
      timeRange,
      providers: Object.values(aggregated),
      rawMetrics: metrics.slice(-100) // Last 100 data points
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid time range', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'PERFORMANCE_ERROR', 
        'Failed to fetch performance metrics', 500);
    }
  }
});

// GET /api/v1/cdn/alerts
router.get('/alerts', async (req: APIRequest, res) => {
  try {
    const activeAlerts = await cdnMonitoringService.getActiveAlerts();
    
    publicAPIService.sendResponse(res, req.correlationId, {
      alerts: activeAlerts.map(alert => ({
        id: alert.id,
        type: alert.type,
        provider: alert.provider,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp,
        acknowledged: alert.acknowledged
      })),
      totalCount: activeAlerts.length,
      criticalCount: activeAlerts.filter(a => a.severity === 'critical').length,
      highCount: activeAlerts.filter(a => a.severity === 'high').length
    });
  } catch (error) {
    publicAPIService.sendError(res, req.correlationId, 'ALERTS_ERROR', 
      'Failed to fetch CDN alerts', 500);
  }
});

// POST /api/v1/cdn/alerts/:alertId/acknowledge
router.post('/alerts/:alertId/acknowledge', async (req: APIRequest, res) => {
  try {
    const { alertId } = z.object({ alertId: z.string() }).parse(req.params);
    
    await cdnMonitoringService.acknowledgeAlert(alertId);
    
    publicAPIService.sendResponse(res, req.correlationId, {
      message: 'Alert acknowledged successfully',
      alertId
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid alert ID', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'ACKNOWLEDGE_ERROR', 
        'Failed to acknowledge alert', 500);
    }
  }
});

// GET /api/v1/cdn/regional-compliance
router.get('/regional-compliance', async (req: APIRequest, res) => {
  try {
    const complianceResults = await multiCDNService.testRegionalAccess();
    
    publicAPIService.sendResponse(res, req.correlationId, {
      regions: complianceResults,
      compliantRegions: complianceResults.filter(r => r.accessible).length,
      totalRegions: complianceResults.length,
      lastTested: new Date().toISOString()
    });
  } catch (error) {
    publicAPIService.sendError(res, req.correlationId, 'COMPLIANCE_ERROR', 
      'Failed to test regional compliance', 500);
  }
});

// GET /api/v1/cdn/health
router.get('/health', async (req: APIRequest, res) => {
  try {
    const metrics = await multiCDNService.getPerformanceMetrics();
    const healthyCDNs = metrics.cdns.filter(cdn => cdn.isHealthy);
    
    const overallHealth = healthyCDNs.length > 0 ? 'healthy' : 'unhealthy';
    
    publicAPIService.sendResponse(res, req.correlationId, {
      status: overallHealth,
      healthyCDNs: healthyCDNs.length,
      totalCDNs: metrics.cdns.length,
      currentPrimary: metrics.currentPrimary,
      cdns: metrics.cdns.map(cdn => ({
        provider: cdn.provider,
        isHealthy: cdn.isHealthy,
        responseTime: cdn.responseTime,
        lastCheck: cdn.lastCheck
      }))
    });
  } catch (error) {
    publicAPIService.sendError(res, req.correlationId, 'HEALTH_ERROR', 
      'Failed to fetch CDN health status', 500);
  }
});

export default router;