import express from 'express';
import { asyncHandler, createUnifiedError } from '../src/middleware/unifiedErrorHandler';
import { EnhancedFeatureFlagService } from '../../services/enhancedFeatureFlagService';
import { auth } from '../src/middleware/auth';
import Redis from 'ioredis';

const router = express.Router();

// Initialize Redis and Enhanced Feature Flag Service
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const featureFlagService = new EnhancedFeatureFlagService(redis, {
  endpoint: process.env.REMOTE_CONFIG_ENDPOINT || '',
  apiKey: process.env.REMOTE_CONFIG_API_KEY || '',
  refreshInterval: 60000, // 1 minute
  timeout: 5000, // 5 seconds
});

// Initialize platform flags on startup
featureFlagService.initializePlatformFlags().catch(console.error);

/**
 * Evaluate a single feature flag
 */
router.post('/evaluate', asyncHandler(async (req, res) => {
  const { flagKey, context } = req.body;

  if (!flagKey) {
    throw createUnifiedError.validation('Flag key is required', undefined, req.correlationId);
  }

  try {
    const evaluation = await featureFlagService.evaluateFlag(flagKey, context || {});
    
    res.json({
      success: true,
      flagKey,
      enabled: evaluation.enabled,
      reason: evaluation.reason,
      ruleId: evaluation.ruleId,
      evaluatedAt: evaluation.evaluatedAt,
      correlationId: req.correlationId,
    });
  } catch (error) {
    throw createUnifiedError.featureFlag(flagKey, 'Flag evaluation failed', { error: error.message }, req.correlationId);
  }
}));

/**
 * Evaluate multiple feature flags in bulk
 */
router.post('/evaluate-bulk', asyncHandler(async (req, res) => {
  const { flagKeys, context } = req.body;

  if (!Array.isArray(flagKeys) || flagKeys.length === 0) {
    throw createUnifiedError.validation('Flag keys array is required', undefined, req.correlationId);
  }

  try {
    const flags = await featureFlagService.evaluateFlags(flagKeys, context || {});
    
    res.json({
      success: true,
      flags,
      evaluatedAt: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  } catch (error) {
    throw createUnifiedError.featureFlag('bulk_evaluation', 'Bulk flag evaluation failed', { error: error.message }, req.correlationId);
  }
}));

/**
 * Server-Sent Events stream for real-time flag updates
 */
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Set up Redis subscription for flag updates
  const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  subscriber.subscribe('flag_updates', 'kill_switch_activations');
  
  subscriber.on('message', (channel, message) => {
    try {
      const update = JSON.parse(message);
      res.write(`data: ${JSON.stringify(update)}\n\n`);
    } catch (error) {
      console.error('Error sending SSE update:', error);
    }
  });

  // Handle client disconnect
  req.on('close', () => {
    subscriber.unsubscribe();
    subscriber.disconnect();
  });
});

// Admin routes (require authentication)
router.use('/admin', auth);

/**
 * Get all feature flags (admin)
 */
router.get('/admin/flags', asyncHandler(async (req, res) => {
  try {
    const flags = await featureFlagService.getFlags(req.user?.organizationId);
    
    res.json({
      success: true,
      flags,
      correlationId: req.correlationId,
    });
  } catch (error) {
    throw createUnifiedError.internal('Failed to fetch flags', { error: error.message }, false, req.correlationId);
  }
}));

/**
 * Create a new feature flag (admin)
 */
router.post('/admin/flags', asyncHandler(async (req, res) => {
  const flagData = req.body;

  if (!flagData.key || !flagData.name) {
    throw createUnifiedError.validation('Flag key and name are required', undefined, req.correlationId);
  }

  try {
    await featureFlagService.createFlag({
      ...flagData,
      createdBy: req.user?.id || 'system',
    });
    
    res.status(201).json({
      success: true,
      message: 'Feature flag created successfully',
      correlationId: req.correlationId,
    });
  } catch (error) {
    throw createUnifiedError.internal('Failed to create flag', { error: error.message }, false, req.correlationId);
  }
}));

/**
 * Update a feature flag (admin)
 */
router.patch('/admin/flags/:flagKey', asyncHandler(async (req, res) => {
  const { flagKey } = req.params;
  const updates = req.body;

  try {
    await featureFlagService.updateFlag(flagKey, updates);
    
    // Publish update to subscribers
    await redis.publish('flag_updates', JSON.stringify({
      type: 'flag_update',
      flagKey,
      enabled: updates.enabled,
      timestamp: new Date().toISOString(),
    }));
    
    res.json({
      success: true,
      message: 'Feature flag updated successfully',
      correlationId: req.correlationId,
    });
  } catch (error) {
    throw createUnifiedError.internal('Failed to update flag', { error: error.message }, false, req.correlationId);
  }
}));

/**
 * Activate kill switch (admin)
 */
router.post('/admin/flags/:flagKey/kill-switch', asyncHandler(async (req, res) => {
  const { flagKey } = req.params;
  const { reason } = req.body;

  try {
    await featureFlagService.emergencyKillSwitch(flagKey, reason || 'Manual activation');
    
    // Publish kill switch activation
    await redis.publish('kill_switch_activations', JSON.stringify({
      type: 'kill_switch',
      flagKey,
      reason,
      activatedBy: req.user?.id,
      timestamp: new Date().toISOString(),
    }));
    
    res.json({
      success: true,
      message: 'Kill switch activated successfully',
      correlationId: req.correlationId,
    });
  } catch (error) {
    throw createUnifiedError.internal('Failed to activate kill switch', { error: error.message }, false, req.correlationId);
  }
}));

/**
 * Deactivate kill switch (admin)
 */
router.delete('/admin/flags/:flagKey/kill-switch', asyncHandler(async (req, res) => {
  const { flagKey } = req.params;

  try {
    await featureFlagService.disableKillSwitch(flagKey);
    
    res.json({
      success: true,
      message: 'Kill switch deactivated successfully',
      correlationId: req.correlationId,
    });
  } catch (error) {
    throw createUnifiedError.internal('Failed to deactivate kill switch', { error: error.message }, false, req.correlationId);
  }
}));

/**
 * Get flag analytics (admin)
 */
router.get('/admin/flags/analytics', asyncHandler(async (req, res) => {
  try {
    const flags = await featureFlagService.getFlags();
    const analytics: Record<string, any> = {};
    
    // Get analytics for each flag
    await Promise.all(flags.map(async (flag) => {
      const flagAnalytics = await featureFlagService.getFlagAnalytics(flag.key);
      if (flagAnalytics) {
        analytics[flag.key] = flagAnalytics;
      }
    }));
    
    res.json({
      success: true,
      analytics,
      correlationId: req.correlationId,
    });
  } catch (error) {
    throw createUnifiedError.internal('Failed to fetch analytics', { error: error.message }, false, req.correlationId);
  }
}));

/**
 * Get flag analytics for specific flag (admin)
 */
router.get('/admin/flags/:flagKey/analytics', asyncHandler(async (req, res) => {
  const { flagKey } = req.params;
  const { start, end } = req.query;

  let timeRange;
  if (start && end) {
    timeRange = {
      start: new Date(start as string),
      end: new Date(end as string),
    };
  }

  try {
    const analytics = await featureFlagService.getFlagAnalytics(flagKey, timeRange);
    
    res.json({
      success: true,
      analytics,
      correlationId: req.correlationId,
    });
  } catch (error) {
    throw createUnifiedError.internal('Failed to fetch flag analytics', { error: error.message }, false, req.correlationId);
  }
}));

/**
 * Create A/B test (admin)
 */
router.post('/admin/ab-tests', asyncHandler(async (req, res) => {
  const testConfig = req.body;

  if (!testConfig.id || !testConfig.name || !testConfig.variants) {
    throw createUnifiedError.validation('Test ID, name, and variants are required', undefined, req.correlationId);
  }

  try {
    await featureFlagService.createABTest(testConfig);
    
    res.status(201).json({
      success: true,
      message: 'A/B test created successfully',
      correlationId: req.correlationId,
    });
  } catch (error) {
    throw createUnifiedError.internal('Failed to create A/B test', { error: error.message }, false, req.correlationId);
  }
}));

/**
 * Get all A/B tests (admin)
 */
router.get('/admin/ab-tests', asyncHandler(async (req, res) => {
  try {
    const tests = await featureFlagService.getABTests();
    
    res.json({
      success: true,
      tests,
      correlationId: req.correlationId,
    });
  } catch (error) {
    throw createUnifiedError.internal('Failed to fetch A/B tests', { error: error.message }, false, req.correlationId);
  }
}));

/**
 * Configure kill switch conditions (admin)
 */
router.post('/admin/kill-switches/:flagKey', asyncHandler(async (req, res) => {
  const { flagKey } = req.params;
  const config = req.body;

  try {
    await featureFlagService.configureKillSwitch({
      flagKey,
      ...config,
    });
    
    res.json({
      success: true,
      message: 'Kill switch configured successfully',
      correlationId: req.correlationId,
    });
  } catch (error) {
    throw createUnifiedError.internal('Failed to configure kill switch', { error: error.message }, false, req.correlationId);
  }
}));

/**
 * Health check for feature flag service
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    // Test Redis connection
    await redis.ping();
    
    // Test flag evaluation
    const testEvaluation = await featureFlagService.evaluateFlag('health_check', {});
    
    res.json({
      success: true,
      status: 'healthy',
      services: {
        redis: 'connected',
        flagService: 'operational',
      },
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  }
}));

// Graceful shutdown
process.on('SIGTERM', async () => {
  await featureFlagService.shutdown();
  await redis.disconnect();
});

export default router;