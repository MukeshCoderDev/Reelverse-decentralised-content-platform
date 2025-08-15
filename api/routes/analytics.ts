import express from 'express';
import { AnalyticsEvent, PerformanceMetric, BusinessMetric } from '../../src/lib/analytics';

const router = express.Router();

// In-memory storage for demo - in production, use proper analytics database
const events: AnalyticsEvent[] = [];
const performanceMetrics: PerformanceMetric[] = [];
const businessMetrics: BusinessMetric[] = [];

// Track analytics events
router.post('/events', async (req, res) => {
  try {
    const event: AnalyticsEvent = req.body;
    
    // Validate event
    if (!event.event || !event.timestamp) {
      return res.status(400).json({ error: 'Invalid event data' });
    }

    // Store event
    events.push(event);
    
    // In production, send to analytics service (Mixpanel, Amplitude, etc.)
    // await analyticsService.track(event);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking analytics event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Track performance metrics
router.post('/performance', async (req, res) => {
  try {
    const metric: PerformanceMetric = req.body;
    
    if (!metric.name || typeof metric.value !== 'number') {
      return res.status(400).json({ error: 'Invalid metric data' });
    }

    performanceMetrics.push(metric);
    
    // Check for performance alerts
    checkPerformanceThresholds(metric);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking performance metric:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Track business metrics
router.post('/business', async (req, res) => {
  try {
    const metric: BusinessMetric = req.body;
    
    if (!metric.name || typeof metric.value !== 'number') {
      return res.status(400).json({ error: 'Invalid business metric data' });
    }

    businessMetrics.push(metric);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking business metric:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get analytics dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    const now = Date.now();
    let startTime: number;
    
    switch (timeRange) {
      case '1h':
        startTime = now - (60 * 60 * 1000);
        break;
      case '24h':
        startTime = now - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = now - (24 * 60 * 60 * 1000);
    }

    // Filter events by time range
    const recentEvents = events.filter(e => e.timestamp >= startTime);
    const recentPerformance = performanceMetrics.filter(m => m.timestamp >= startTime);
    const recentBusiness = businessMetrics.filter(m => m.timestamp >= startTime);

    // Calculate key metrics
    const totalEvents = recentEvents.length;
    const uniqueUsers = new Set(recentEvents.map(e => e.userId).filter(Boolean)).size;
    const pageViews = recentEvents.filter(e => e.event === 'page_viewed').length;
    const contentViews = recentEvents.filter(e => e.event === 'content_viewed').length;
    const purchases = recentEvents.filter(e => e.event === 'content_purchased').length;
    const errors = recentEvents.filter(e => e.event === 'error_occurred').length;

    // Performance metrics
    const avgPageLoad = calculateAverage(recentPerformance.filter(m => m.name === 'page_load_time'));
    const avgPlaybackStart = calculateAverage(recentPerformance.filter(m => m.name === 'playback_start_time'));
    const p95PlaybackStart = calculatePercentile(recentPerformance.filter(m => m.name === 'playback_start_time'), 95);

    // Business metrics
    const totalRevenue = recentBusiness.filter(m => m.name === 'revenue').reduce((sum, m) => sum + m.value, 0);
    const conversionRate = purchases > 0 && contentViews > 0 ? (purchases / contentViews) * 100 : 0;

    // Event breakdown
    const eventsByType = recentEvents.reduce((acc, event) => {
      acc[event.event] = (acc[event.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      summary: {
        totalEvents,
        uniqueUsers,
        pageViews,
        contentViews,
        purchases,
        errors,
        totalRevenue,
        conversionRate: Math.round(conversionRate * 100) / 100
      },
      performance: {
        avgPageLoadTime: Math.round(avgPageLoad),
        avgPlaybackStartTime: Math.round(avgPlaybackStart),
        p95PlaybackStartTime: Math.round(p95PlaybackStart)
      },
      eventsByType,
      timeRange: {
        start: startTime,
        end: now,
        label: timeRange as string
      }
    });
  } catch (error) {
    console.error('Error fetching analytics dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversion funnel data
router.get('/funnel', async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;
    
    const now = Date.now();
    const startTime = now - (7 * 24 * 60 * 60 * 1000); // Default 7 days
    
    const recentEvents = events.filter(e => e.timestamp >= startTime);
    
    // Calculate funnel metrics
    const visitors = new Set(recentEvents.map(e => e.sessionId)).size;
    const signups = recentEvents.filter(e => e.event === 'user_identified').length;
    const ageVerified = recentEvents.filter(e => e.event === 'conversion' && e.properties.conversionType === 'verification').length;
    const contentViewers = new Set(recentEvents.filter(e => e.event === 'content_viewed').map(e => e.userId)).size;
    const purchasers = new Set(recentEvents.filter(e => e.event === 'content_purchased').map(e => e.userId)).size;

    const funnel = [
      { step: 'Visitors', count: visitors, rate: 100 },
      { step: 'Signups', count: signups, rate: visitors > 0 ? (signups / visitors) * 100 : 0 },
      { step: 'Age Verified', count: ageVerified, rate: signups > 0 ? (ageVerified / signups) * 100 : 0 },
      { step: 'Content Viewers', count: contentViewers, rate: ageVerified > 0 ? (contentViewers / ageVerified) * 100 : 0 },
      { step: 'Purchasers', count: purchasers, rate: contentViewers > 0 ? (purchasers / contentViewers) * 100 : 0 }
    ];

    res.json({ funnel });
  } catch (error) {
    console.error('Error fetching funnel data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get real-time metrics
router.get('/realtime', async (req, res) => {
  try {
    const now = Date.now();
    const last5Minutes = now - (5 * 60 * 1000);
    
    const recentEvents = events.filter(e => e.timestamp >= last5Minutes);
    const activeUsers = new Set(recentEvents.map(e => e.userId).filter(Boolean)).size;
    const currentViewers = recentEvents.filter(e => 
      e.event === 'video_playback_started' && 
      e.timestamp >= now - (2 * 60 * 1000) // Last 2 minutes
    ).length;

    res.json({
      activeUsers,
      currentViewers,
      eventsPerMinute: Math.round(recentEvents.length / 5),
      timestamp: now
    });
  } catch (error) {
    console.error('Error fetching realtime metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Performance monitoring endpoint
router.get('/performance/summary', async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    const now = Date.now();
    let startTime: number;
    
    switch (timeRange) {
      case '1h':
        startTime = now - (60 * 60 * 1000);
        break;
      case '24h':
        startTime = now - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = now - (24 * 60 * 60 * 1000);
    }

    const recentMetrics = performanceMetrics.filter(m => m.timestamp >= startTime);
    
    const summary = {
      pageLoadTime: {
        avg: calculateAverage(recentMetrics.filter(m => m.name === 'page_load_time')),
        p95: calculatePercentile(recentMetrics.filter(m => m.name === 'page_load_time'), 95)
      },
      playbackStartTime: {
        avg: calculateAverage(recentMetrics.filter(m => m.name === 'playback_start_time')),
        p95: calculatePercentile(recentMetrics.filter(m => m.name === 'playback_start_time'), 95)
      },
      uploadDuration: {
        avg: calculateAverage(recentMetrics.filter(m => m.name === 'upload_duration')),
        p95: calculatePercentile(recentMetrics.filter(m => m.name === 'upload_duration'), 95)
      },
      coreWebVitals: {
        lcp: calculateAverage(recentMetrics.filter(m => m.name === 'largest_contentful_paint')),
        fid: calculateAverage(recentMetrics.filter(m => m.name === 'first_input_delay')),
        cls: calculateAverage(recentMetrics.filter(m => m.name === 'cumulative_layout_shift'))
      }
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching performance summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions
function calculateAverage(metrics: PerformanceMetric[]): number {
  if (metrics.length === 0) return 0;
  const sum = metrics.reduce((acc, m) => acc + m.value, 0);
  return sum / metrics.length;
}

function calculatePercentile(metrics: PerformanceMetric[], percentile: number): number {
  if (metrics.length === 0) return 0;
  const sorted = metrics.map(m => m.value).sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

function checkPerformanceThresholds(metric: PerformanceMetric) {
  const thresholds = {
    page_load_time: 3000, // 3 seconds
    playback_start_time: 2000, // 2 seconds
    largest_contentful_paint: 2500, // 2.5 seconds
    first_input_delay: 100, // 100ms
    cumulative_layout_shift: 0.1 // 0.1 score
  };

  const threshold = thresholds[metric.name as keyof typeof thresholds];
  if (threshold && metric.value > threshold) {
    // Send alert (in production, integrate with alerting service)
    console.warn(`Performance threshold exceeded: ${metric.name} = ${metric.value}${metric.unit} (threshold: ${threshold})`);
  }
}

export default router;