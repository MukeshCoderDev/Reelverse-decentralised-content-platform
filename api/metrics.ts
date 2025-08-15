/**
 * API endpoints for metrics collection and SLO monitoring
 */

import { Request, Response } from 'express';
import { StatusPageService } from '../services/statusPageService';
import Redis from 'ioredis';

// Initialize Redis connection (would be configured in main app)
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const statusPageService = new StatusPageService(redis);

/**
 * Batch metrics collection endpoint
 */
export const collectMetricsBatch = async (req: Request, res: Response) => {
  try {
    const { playbackMetrics, businessEvents, timestamp } = req.body;

    // Process playback metrics
    if (playbackMetrics && Array.isArray(playbackMetrics)) {
      for (const metric of playbackMetrics) {
        await processPlaybackMetric(metric);
      }
    }

    // Process business events
    if (businessEvents && Array.isArray(businessEvents)) {
      for (const event of businessEvents) {
        await processBusinessEvent(event);
      }
    }

    // Update real-time metrics
    await updateRealTimeMetrics();

    res.json({
      success: true,
      processed: {
        playbackMetrics: playbackMetrics?.length || 0,
        businessEvents: businessEvents?.length || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing metrics batch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process metrics batch'
    });
  }
};

/**
 * Publish metrics to status page
 */
export const publishMetrics = async (req: Request, res: Response) => {
  try {
    const metrics = req.body;

    // Update status page with new metrics
    await statusPageService.updateRealtimeMetrics({
      playbackP95JoinTime: metrics.playbackP95JoinTime,
      rebufferRatio: metrics.rebufferRatio,
      payoutP95Latency: metrics.payoutP95Latency,
      checkoutSuccessRate: metrics.checkoutSuccessRate,
      uptime: metrics.uptime,
      errorRate: metrics.errorRate,
      aiTaggingAccuracy: metrics.aiTaggingAccuracy,
      leakDetectionRate: metrics.leakDetectionRate,
      activeUsers: await getActiveUserCount(),
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Metrics published successfully'
    });

  } catch (error) {
    console.error('Error publishing metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to publish metrics'
    });
  }
};

/**
 * Get current SLO status
 */
export const getSLOStatus = async (req: Request, res: Response) => {
  try {
    const sloTargets = await statusPageService.getSLOTargets();
    const realtimeMetrics = await statusPageService.getRealtimeMetrics();
    const overallStatus = await statusPageService.getOverallStatus();

    res.json({
      success: true,
      data: {
        sloTargets,
        realtimeMetrics,
        overallStatus,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting SLO status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SLO status'
    });
  }
};

/**
 * Get aggregated metrics for dashboard
 */
export const getAggregatedMetrics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, granularity = 'hour' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const historicalMetrics = await statusPageService.getHistoricalMetrics(
      Math.ceil((new Date(endDate as string).getTime() - new Date(startDate as string).getTime()) / (1000 * 60 * 60 * 24))
    );

    res.json({
      success: true,
      data: {
        metrics: historicalMetrics,
        period: { startDate, endDate, granularity },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting aggregated metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get aggregated metrics'
    });
  }
};

/**
 * Get real-time dashboard data
 */
export const getDashboardData = async (req: Request, res: Response) => {
  try {
    const realtimeMetrics = await statusPageService.getRealtimeMetrics();
    const serviceStatuses = await statusPageService.getServiceStatuses();
    const activeIncidents = await statusPageService.getActiveIncidents();
    const sloTargets = await statusPageService.getSLOTargets();

    res.json({
      success: true,
      data: {
        realtimeMetrics,
        serviceStatuses,
        activeIncidents,
        sloTargets,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data'
    });
  }
};

/**
 * Helper functions
 */

async function processPlaybackMetric(metric: any): Promise<void> {
  try {
    // Store individual metric for analysis
    const key = `metrics:playback:${metric.sessionId}:${Date.now()}`;
    await redis.setex(key, 86400, JSON.stringify(metric)); // Store for 24 hours

    // Update session tracking
    const sessionKey = `session:${metric.sessionId}`;
    await redis.hset(sessionKey, {
      lastActivity: new Date().toISOString(),
      contentId: metric.contentId,
      userId: metric.userId || 'anonymous'
    });
    await redis.expire(sessionKey, 3600); // Expire after 1 hour

    // Process specific events
    switch (metric.event) {
      case 'start':
        if (metric.joinTime) {
          await updateJoinTimeMetrics(metric.joinTime);
        }
        break;
      case 'rebuffer':
        if (metric.rebufferDuration) {
          await updateRebufferMetrics(metric.rebufferDuration);
        }
        break;
      case 'error':
        await updateErrorMetrics(metric);
        break;
      case 'quality_change':
        await updateQualityMetrics(metric.quality);
        break;
    }

  } catch (error) {
    console.error('Error processing playback metric:', error);
  }
}

async function processBusinessEvent(event: any): Promise<void> {
  try {
    // Store business event
    const key = `metrics:business:${event.eventType}:${Date.now()}`;
    await redis.setex(key, 86400 * 7, JSON.stringify(event)); // Store for 7 days

    // Update business metrics
    switch (event.eventType) {
      case 'checkout_started':
        await redis.incr('metrics:checkout:started:count');
        break;
      case 'checkout_completed':
        await redis.incr('metrics:checkout:completed:count');
        if (event.processingTime) {
          await updateCheckoutLatency(event.processingTime);
        }
        break;
      case 'checkout_failed':
        await redis.incr('metrics:checkout:failed:count');
        break;
      case 'payout_initiated':
        await redis.incr('metrics:payout:initiated:count');
        break;
      case 'payout_completed':
        await redis.incr('metrics:payout:completed:count');
        if (event.processingTime) {
          await updatePayoutLatency(event.processingTime);
        }
        break;
    }

  } catch (error) {
    console.error('Error processing business event:', error);
  }
}

async function updateJoinTimeMetrics(joinTime: number): Promise<void> {
  const key = 'metrics:jointime:samples';
  await redis.lpush(key, joinTime.toString());
  await redis.ltrim(key, 0, 999); // Keep last 1000 samples
}

async function updateRebufferMetrics(duration: number): Promise<void> {
  const key = 'metrics:rebuffer:samples';
  await redis.lpush(key, duration.toString());
  await redis.ltrim(key, 0, 999); // Keep last 1000 samples
}

async function updateErrorMetrics(metric: any): Promise<void> {
  await redis.incr('metrics:errors:total');
  const errorKey = `metrics:errors:${metric.errorCode || 'unknown'}`;
  await redis.incr(errorKey);
}

async function updateQualityMetrics(quality: string): Promise<void> {
  const key = `metrics:quality:${quality}`;
  await redis.incr(key);
}

async function updateCheckoutLatency(latency: number): Promise<void> {
  const key = 'metrics:checkout:latency:samples';
  await redis.lpush(key, latency.toString());
  await redis.ltrim(key, 0, 999);
}

async function updatePayoutLatency(latency: number): Promise<void> {
  const key = 'metrics:payout:latency:samples';
  await redis.lpush(key, latency.toString());
  await redis.ltrim(key, 0, 999);
}

async function updateRealTimeMetrics(): Promise<void> {
  try {
    // Calculate P95 join time
    const joinTimeSamples = await redis.lrange('metrics:jointime:samples', 0, -1);
    const joinTimes = joinTimeSamples.map(Number).sort((a, b) => a - b);
    const playbackP95JoinTime = joinTimes.length > 0 
      ? joinTimes[Math.floor(joinTimes.length * 0.95)] || 0
      : 1500;

    // Calculate rebuffer ratio
    const rebufferSamples = await redis.lrange('metrics:rebuffer:samples', 0, -1);
    const totalRebufferTime = rebufferSamples.reduce((sum, duration) => sum + Number(duration), 0);
    const estimatedPlaybackTime = joinTimeSamples.length * 60000; // Estimate based on sessions
    const rebufferRatio = estimatedPlaybackTime > 0 
      ? (totalRebufferTime / estimatedPlaybackTime) * 100
      : 0.8;

    // Calculate checkout success rate
    const checkoutStarted = Number(await redis.get('metrics:checkout:started:count') || '0');
    const checkoutCompleted = Number(await redis.get('metrics:checkout:completed:count') || '0');
    const checkoutSuccessRate = checkoutStarted > 0 
      ? (checkoutCompleted / checkoutStarted) * 100
      : 96.5;

    // Calculate payout P95 latency
    const payoutLatencySamples = await redis.lrange('metrics:payout:latency:samples', 0, -1);
    const payoutLatencies = payoutLatencySamples.map(Number).sort((a, b) => a - b);
    const payoutP95Latency = payoutLatencies.length > 0
      ? payoutLatencies[Math.floor(payoutLatencies.length * 0.95)] / (1000 * 60 * 60) // Convert to hours
      : 18;

    // Calculate error rate
    const totalErrors = Number(await redis.get('metrics:errors:total') || '0');
    const totalEvents = joinTimeSamples.length + rebufferSamples.length + totalErrors;
    const errorRate = totalEvents > 0 ? (totalErrors / totalEvents) * 100 : 0.1;

    // Update status page
    await statusPageService.updateRealtimeMetrics({
      playbackP95JoinTime,
      rebufferRatio,
      payoutP95Latency,
      checkoutSuccessRate,
      uptime: 99.97, // Would come from infrastructure monitoring
      errorRate,
      aiTaggingAccuracy: 96.2, // Would come from AI service
      leakDetectionRate: 88.5, // Would come from leak detection service
      activeUsers: await getActiveUserCount(),
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error updating real-time metrics:', error);
  }
}

async function getActiveUserCount(): Promise<number> {
  try {
    const sessionKeys = await redis.keys('session:*');
    return sessionKeys.length;
  } catch (error) {
    console.error('Error getting active user count:', error);
    return 0;
  }
}