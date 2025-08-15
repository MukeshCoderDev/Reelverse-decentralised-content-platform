/**
 * SLO Monitoring API Routes
 * Provides endpoints for SLO metrics, alerts, and operational dashboard
 */

import express from 'express';
import { sloMonitoringService } from '../../../services/sloMonitoringService';
import { MetricsCollectionService } from '../../../services/metricsCollectionService';
import { logger } from '../utils/logger';

const router = express.Router();
const metricsService = MetricsCollectionService.getInstance();

/**
 * GET /api/slo/status
 * Get current SLO status summary
 */
router.get('/status', async (req, res) => {
  try {
    const status = await sloMonitoringService.getSLOStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get SLO status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SLO status'
    });
  }
});

/**
 * GET /api/slo/metrics
 * Get current SLO metrics with payout latency
 */
router.get('/metrics', async (req, res) => {
  try {
    const sloMetrics = await metricsService.calculateSLOs();
    const payoutMetrics = await sloMonitoringService.calculatePayoutLatencyMetrics();
    
    // Update payout latency in SLO metrics
    sloMetrics.payoutP95Latency = payoutMetrics.p95LatencyHours;

    res.json({
      success: true,
      data: {
        sloMetrics,
        payoutMetrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get SLO metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SLO metrics'
    });
  }
});

/**
 * GET /api/slo/dashboard
 * Get operational dashboard data for internal monitoring
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dashboard = await sloMonitoringService.getOperationalDashboard();
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Failed to get operational dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get operational dashboard'
    });
  }
});

/**
 * GET /api/slo/breaches
 * Get active SLO breaches
 */
router.get('/breaches', async (req, res) => {
  try {
    const dashboard = await sloMonitoringService.getOperationalDashboard();
    
    res.json({
      success: true,
      data: {
        activeBreaches: dashboard.activeBreaches,
        criticalCount: dashboard.activeBreaches.filter(b => b.severity === 'critical').length,
        warningCount: dashboard.activeBreaches.filter(b => b.severity === 'warning').length,
        lastUpdated: dashboard.lastUpdated
      }
    });
  } catch (error) {
    logger.error('Failed to get SLO breaches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SLO breaches'
    });
  }
});

/**
 * GET /api/slo/payout-latency
 * Get detailed payout latency metrics
 */
router.get('/payout-latency', async (req, res) => {
  try {
    const timeframe = req.query.timeframe as 'hour' | 'day' | 'week' || 'day';
    const payoutMetrics = await sloMonitoringService.calculatePayoutLatencyMetrics(timeframe);
    
    res.json({
      success: true,
      data: payoutMetrics
    });
  } catch (error) {
    logger.error('Failed to get payout latency metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payout latency metrics'
    });
  }
});

/**
 * POST /api/slo/webhooks
 * Add webhook URL for SLO alerts
 */
router.post('/webhooks', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Valid webhook URL is required'
      });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook URL format'
      });
    }

    sloMonitoringService.addWebhookUrl(url);
    
    res.json({
      success: true,
      message: 'Webhook URL added successfully'
    });
  } catch (error) {
    logger.error('Failed to add webhook URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add webhook URL'
    });
  }
});

/**
 * DELETE /api/slo/webhooks
 * Remove webhook URL
 */
router.delete('/webhooks', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Valid webhook URL is required'
      });
    }

    sloMonitoringService.removeWebhookUrl(url);
    
    res.json({
      success: true,
      message: 'Webhook URL removed successfully'
    });
  } catch (error) {
    logger.error('Failed to remove webhook URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove webhook URL'
    });
  }
});

/**
 * POST /api/slo/test-alert
 * Test SLO alert webhook (development/testing only)
 */
router.post('/test-alert', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Test alerts not allowed in production'
      });
    }

    const testBreach = {
      id: 'test_breach_' + Date.now(),
      metric: 'payoutP95Latency' as const,
      currentValue: 48.5,
      threshold: 24,
      severity: 'critical' as const,
      description: 'Test SLO breach for webhook validation',
      timestamp: new Date(),
      resolved: false
    };

    await sloMonitoringService.sendSLOAlert('slo_breach', testBreach);
    
    res.json({
      success: true,
      message: 'Test alert sent successfully',
      testBreach
    });
  } catch (error) {
    logger.error('Failed to send test alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test alert'
    });
  }
});

/**
 * GET /api/slo/health
 * Health check endpoint for SLO monitoring service
 */
router.get('/health', async (req, res) => {
  try {
    const status = await sloMonitoringService.getSLOStatus();
    
    res.json({
      success: true,
      data: {
        service: 'SLO Monitoring',
        status: status.status,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        activeBreaches: status.activeBreaches,
        criticalBreaches: status.criticalBreaches
      }
    });
  } catch (error) {
    logger.error('SLO health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'SLO monitoring service unhealthy'
    });
  }
});

export default router;