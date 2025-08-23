import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../config/database';
import { authenticateUser } from '../middleware/auth';
import { logger } from '../utils/logger';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

// Analytics events rate limiting
const analyticsRateLimit = rateLimit({
  key: 'analytics',
  limit: 100, // 100 events per window
  windowMs: 60 * 1000 // 1 minute window
});

// Event validation schema
const AnalyticsEventSchema = z.object({
  eventName: z.string().min(1).max(100),
  properties: z.record(z.any()),
  timestamp: z.number()
});

const AnalyticsEventsSchema = z.object({
  events: z.array(AnalyticsEventSchema).max(50) // Max 50 events per batch
});

/**
 * POST /api/analytics/events
 * Batch analytics events tracking endpoint
 */
router.post('/events', 
  analyticsRateLimit,
  async (req: Request, res: Response) => {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      const { events } = AnalyticsEventsSchema.parse(req.body);
      const userId = (req as any).userId; // Optional - works for anonymous events too
      
      // Store events in database for analysis
      const insertPromises = events.map(async (event) => {
        return client.query(`
          INSERT INTO analytics_events (
            user_id,
            event_name,
            properties,
            timestamp,
            session_id,
            user_agent,
            ip_address,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          userId || null,
          event.eventName,
          JSON.stringify(event.properties),
          new Date(event.timestamp),
          req.headers['x-session-id'] || null,
          req.headers['user-agent'] || null,
          req.ip || null
        ]);
      });
      
      await Promise.all(insertPromises);
      
      // Log high-value events for immediate processing
      const criticalEvents = events.filter(e => 
        ['tip_success', 'subscription_started', 'payout_completed'].includes(e.eventName)
      );
      
      if (criticalEvents.length > 0) {
        logger.info('Critical analytics events received', {
          userId,
          events: criticalEvents.map(e => ({
            eventName: e.eventName,
            timestamp: e.timestamp,
            videoId: e.properties.videoId,
            creatorId: e.properties.creatorId,
            amountUSDC: e.properties.amountUSDC
          }))
        });
      }
      
      res.json({
        success: true,
        eventsProcessed: events.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid event data',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      logger.error('Failed to process analytics events', {
        error: error.message,
        userId: (req as any).userId,
        eventCount: req.body.events?.length || 0
      });
      
      res.status(500).json({
        error: 'Failed to process analytics events',
        code: 'ANALYTICS_ERROR'
      });
    } finally {
      client.release();
    }
  }
);

/**
 * GET /api/analytics/insights
 * Get analytics insights for authenticated user
 */
router.get('/insights',
  authenticateUser,
  async (req: Request, res: Response) => {
    const db = getDatabase();
    
    try {
      const userId = (req as any).userId;
      const { period = '30d' } = req.query;
      
      let intervalClause = "INTERVAL '30 days'";
      if (period === '7d') intervalClause = "INTERVAL '7 days'";
      if (period === '1d') intervalClause = "INTERVAL '1 day'";
      
      // Get event analytics for user's content
      const eventAnalytics = await db.query(`
        SELECT 
          event_name,
          COUNT(*) as event_count,
          COUNT(DISTINCT user_id) as unique_users,
          DATE_TRUNC('day', timestamp) as date
        FROM analytics_events 
        WHERE properties->>'creatorId' = $1
          AND timestamp >= NOW() - ${intervalClause}
        GROUP BY event_name, DATE_TRUNC('day', timestamp)
        ORDER BY date DESC, event_count DESC
      `, [userId]);
      
      // Get conversion funnel data
      const funnelData = await db.query(`
        WITH funnel_events AS (
          SELECT 
            properties->>'funnelId' as funnel_id,
            properties->>'step' as step,
            COUNT(*) as step_count
          FROM analytics_events 
          WHERE event_name = 'conversion_funnel'
            AND properties->>'creatorId' = $1
            AND timestamp >= NOW() - ${intervalClause}
          GROUP BY properties->>'funnelId', properties->>'step'
        )
        SELECT 
          step,
          SUM(step_count) as total_count
        FROM funnel_events
        GROUP BY step
        ORDER BY 
          CASE step
            WHEN 'video_view' THEN 1
            WHEN 'tip_button_view' THEN 2
            WHEN 'tip_modal_open' THEN 3
            WHEN 'tip_amount_select' THEN 4
            WHEN 'tip_submit' THEN 5
            WHEN 'tip_success' THEN 6
          END
      `, [userId]);
      
      // Get top performing content
      const topContent = await db.query(`
        SELECT 
          properties->>'videoId' as video_id,
          COUNT(*) FILTER (WHERE event_name = 'tip_click') as tip_clicks,
          COUNT(*) FILTER (WHERE event_name = 'tip_success') as tip_conversions,
          COUNT(*) FILTER (WHERE event_name = 'subscription_click') as sub_clicks,
          COUNT(*) FILTER (WHERE event_name = 'subscription_started') as sub_conversions,
          SUM((properties->>'amountUSDC')::numeric) FILTER (WHERE event_name = 'tip_success') as total_tips
        FROM analytics_events
        WHERE properties->>'creatorId' = $1
          AND timestamp >= NOW() - ${intervalClause}
          AND properties->>'videoId' IS NOT NULL
        GROUP BY properties->>'videoId'
        ORDER BY total_tips DESC NULLS LAST
        LIMIT 10
      `, [userId]);
      
      res.json({
        period,
        eventAnalytics: eventAnalytics.rows,
        conversionFunnel: funnelData.rows,
        topContent: topContent.rows.map(row => ({
          videoId: row.video_id,
          tipClicks: parseInt(row.tip_clicks || 0),
          tipConversions: parseInt(row.tip_conversions || 0),
          subscriptionClicks: parseInt(row.sub_clicks || 0),
          subscriptionConversions: parseInt(row.sub_conversions || 0),
          totalTips: parseFloat(row.total_tips || 0),
          tipConversionRate: row.tip_clicks > 0 ? 
            (parseInt(row.tip_conversions || 0) / parseInt(row.tip_clicks)) * 100 : 0
        }))
      });
      
    } catch (error) {
      logger.error('Failed to fetch analytics insights', {
        error: error.message,
        userId: (req as any).userId
      });
      
      res.status(500).json({
        error: 'Failed to fetch analytics insights',
        code: 'INSIGHTS_ERROR'
      });
    }
  }
);

export default router;