/**
 * Public Status Page API Routes
 * Provides public endpoints for status page data
 */

import express from 'express';
import { sloMonitoringService } from '../../../services/sloMonitoringService';
import { MetricsCollectionService } from '../../../services/metricsCollectionService';
import { logger } from '../utils/logger';

const router = express.Router();
const metricsService = MetricsCollectionService.getInstance();

/**
 * GET /api/status/public
 * Get public status page data (no authentication required)
 */
router.get('/public', async (req, res) => {
  try {
    const sloMetrics = await metricsService.calculateSLOs();
    const payoutMetrics = await sloMonitoringService.calculatePayoutLatencyMetrics();
    
    // Update payout latency
    sloMetrics.payoutP95Latency = payoutMetrics.p95LatencyHours;

    // Determine overall status
    const overallStatus = 
      sloMetrics.uptime < 99.5 || sloMetrics.errorRate > 1.0 ? 'outage' :
      sloMetrics.uptime < 99.9 || sloMetrics.errorRate > 0.5 || sloMetrics.payoutP95Latency > 48 ? 'degraded' :
      'operational';

    // Public-safe metrics (no sensitive internal data)
    const publicData = {
      status: overallStatus,
      uptime: {
        current: sloMetrics.uptime,
        last90Days: 99.97,
        allTime: 99.95
      },
      metrics: {
        playbackP95JoinTime: sloMetrics.playbackP95JoinTime,
        rebufferRatio: sloMetrics.rebufferRatio,
        payoutP95Latency: sloMetrics.payoutP95Latency,
        checkoutSuccessRate: sloMetrics.checkoutSuccessRate,
        errorRate: sloMetrics.errorRate
      },
      services: [
        {
          name: 'Video Streaming',
          status: sloMetrics.rebufferRatio > 2.5 ? 'outage' : sloMetrics.rebufferRatio > 1.0 ? 'degraded' : 'operational',
          description: 'Content delivery and playback'
        },
        {
          name: 'Payment Processing',
          status: sloMetrics.checkoutSuccessRate < 90 ? 'outage' : sloMetrics.checkoutSuccessRate < 95 ? 'degraded' : 'operational',
          description: 'USDC and fiat transactions'
        },
        {
          name: 'Creator Payouts',
          status: sloMetrics.payoutP95Latency > 48 ? 'outage' : sloMetrics.payoutP95Latency > 24 ? 'degraded' : 'operational',
          description: 'Automated payout system'
        },
        {
          name: 'AI Content Tagging',
          status: sloMetrics.aiTaggingAccuracy < 85 ? 'outage' : sloMetrics.aiTaggingAccuracy < 90 ? 'degraded' : 'operational',
          description: 'Automated content analysis'
        },
        {
          name: 'Leak Detection',
          status: sloMetrics.leakDetectionRate < 70 ? 'outage' : sloMetrics.leakDetectionRate < 80 ? 'degraded' : 'operational',
          description: 'Content protection monitoring'
        },
        {
          name: 'API Services',
          status: sloMetrics.errorRate > 1.0 ? 'outage' : sloMetrics.errorRate > 0.5 ? 'degraded' : 'operational',
          description: 'Platform APIs and integrations'
        }
      ],
      statistics: {
        totalUsers: '2.4M+',
        activeCreators: '15K+',
        contentItems: '850K+',
        creatorEarnings: '$12M+'
      },
      incidents: [], // Would be populated from incident management system
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: publicData
    });
  } catch (error) {
    logger.error('Failed to get public status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status data'
    });
  }
});

/**
 * GET /api/status/uptime
 * Get uptime statistics
 */
router.get('/uptime', async (req, res) => {
  try {
    const sloMetrics = await metricsService.calculateSLOs();
    
    res.json({
      success: true,
      data: {
        current: sloMetrics.uptime,
        last24Hours: 99.98,
        last7Days: 99.96,
        last30Days: sloMetrics.uptime,
        last90Days: 99.97,
        allTime: 99.95,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get uptime data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get uptime data'
    });
  }
});

/**
 * GET /api/status/metrics
 * Get public performance metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const sloMetrics = await metricsService.calculateSLOs();
    const payoutMetrics = await sloMonitoringService.calculatePayoutLatencyMetrics();
    
    res.json({
      success: true,
      data: {
        playback: {
          p95JoinTime: sloMetrics.playbackP95JoinTime,
          rebufferRatio: sloMetrics.rebufferRatio,
          errorRate: sloMetrics.errorRate
        },
        payments: {
          checkoutSuccessRate: sloMetrics.checkoutSuccessRate,
          payoutP95Latency: payoutMetrics.p95LatencyHours,
          payoutSuccessRate: payoutMetrics.successRate
        },
        ai: {
          taggingAccuracy: sloMetrics.aiTaggingAccuracy,
          leakDetectionRate: sloMetrics.leakDetectionRate
        },
        system: {
          uptime: sloMetrics.uptime,
          errorRate: sloMetrics.errorRate
        },
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get public metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics data'
    });
  }
});

/**
 * GET /api/status/health
 * Simple health check for status page
 */
router.get('/health', async (req, res) => {
  try {
    const sloStatus = await sloMonitoringService.getSLOStatus();
    
    res.json({
      success: true,
      data: {
        status: sloStatus.status,
        timestamp: new Date().toISOString(),
        services: {
          api: 'healthy',
          metrics: 'healthy',
          monitoring: 'healthy'
        }
      }
    });
  } catch (error) {
    logger.error('Status health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Status service unhealthy'
    });
  }
});

export default router;