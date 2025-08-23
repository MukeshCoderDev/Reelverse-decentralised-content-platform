import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../config/database';
import { authenticateUser } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const LedgerExportSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  source: z.enum(['tip', 'subscription', 'ppv', 'split', 'referral', 'adshare']).optional(),
  format: z.enum(['json', 'csv']).default('json')
});

/**
 * GET /api/finance/summary
 * Get comprehensive real-time earnings summary
 * 
 * Returns:
 * - availableUSDC: Eligible for payout (after hold period)
 * - pendingUSDC: In hold period (72 hours)
 * - lifetimeUSDC: Total ever earned
 * - todayUSDC: Today's net earnings
 * - activeSubscriptions: Count of active subscriptions user has
 * - totalTips: Count of tips received
 * - payoutThreshold: Minimum payout amount ($25)
 * - nextPayoutDate: Next available payout date
 */
router.get('/summary', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const db = getDatabase();
    
    // Get balance summary from materialized view
    const balanceQuery = await db.query(`
      SELECT * FROM get_user_balance($1)
    `, [userId]);
    
    const balance = balanceQuery.rows[0] || {
      total_earned_usdc: 0,
      today_usdc: 0,
      pending_usdc: 0,
      available_usdc: 0,
      last_earning_at: null
    };
    
    // Get subscription metrics
    const subscriptionQuery = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') as active_subscriptions,
        COUNT(*) FILTER (WHERE user_id = $1) as subscriptions_to_others
      FROM subscriptions 
      WHERE creator_id = $1 OR user_id = $1
    `, [userId]);
    
    const subscriptionMetrics = subscriptionQuery.rows[0] || {
      active_subscriptions: 0,
      subscriptions_to_others: 0
    };
    
    // Get tip metrics
    const tipQuery = await db.query(`
      SELECT 
        COUNT(*) as tips_received,
        COUNT(DISTINCT el.meta->>'tipper_user_id') as unique_tippers,
        AVG(el.gross_usdc) as avg_tip_amount
      FROM earnings_ledger el
      WHERE el.user_id = $1 
        AND el.source = 'tip' 
        AND el.parent_id IS NULL
        AND el.error_code IS NULL
    `, [userId]);
    
    const tipMetrics = tipQuery.rows[0] || {
      tips_received: 0,
      unique_tippers: 0,
      avg_tip_amount: 0
    };
    
    // Get payout information
    const payoutQuery = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'paid') as successful_payouts,
        SUM(amount_usdc) FILTER (WHERE status = 'paid') as total_paid_out,
        MAX(processed_at) FILTER (WHERE status = 'paid') as last_payout_at,
        COUNT(*) FILTER (WHERE status IN ('requested', 'processing')) as pending_payouts
      FROM payouts
      WHERE user_id = $1
    `, [userId]);
    
    const payoutMetrics = payoutQuery.rows[0] || {
      successful_payouts: 0,
      total_paid_out: 0,
      last_payout_at: null,
      pending_payouts: 0
    };
    
    // Get payout threshold from config
    const configQuery = await db.query(`
      SELECT get_payout_config('minimum_payout_usdc') as min_payout
    `);
    
    const payoutThreshold = parseFloat(
      configQuery.rows[0]?.min_payout?.replace(/"/g, '') || '25'
    );
    
    // Calculate next payout eligibility (24 hours after last payout)
    const lastPayoutAt = payoutMetrics.last_payout_at;
    const nextPayoutDate = lastPayoutAt 
      ? new Date(new Date(lastPayoutAt).getTime() + 24 * 60 * 60 * 1000)
      : new Date();
    
    // Get recent earnings breakdown
    const earningsBreakdownQuery = await db.query(`
      SELECT 
        source,
        COUNT(*) as transaction_count,
        SUM(net_usdc) as total_net_usdc,
        SUM(gross_usdc) as total_gross_usdc,
        SUM(fee_usdc) as total_fees_usdc
      FROM earnings_ledger
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '30 days'
        AND error_code IS NULL
      GROUP BY source
      ORDER BY total_net_usdc DESC
    `, [userId]);
    
    const earningsBreakdown = earningsBreakdownQuery.rows.map(row => ({
      source: row.source,
      transactionCount: parseInt(row.transaction_count),
      netUSDC: parseFloat(row.total_net_usdc),
      grossUSDC: parseFloat(row.total_gross_usdc),
      feesUSDC: parseFloat(row.total_fees_usdc)
    }));
    
    // Calculate growth metrics (7-day comparison)
    const growthQuery = await db.query(`
      SELECT 
        SUM(net_usdc) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7_days,
        SUM(net_usdc) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days') as previous_7_days
      FROM earnings_ledger
      WHERE user_id = $1 AND error_code IS NULL
    `, [userId]);
    
    const growth = growthQuery.rows[0] || { last_7_days: 0, previous_7_days: 0 };
    const growthRate = growth.previous_7_days > 0 
      ? ((growth.last_7_days - growth.previous_7_days) / growth.previous_7_days) * 100
      : 0;
    
    const response = {
      // Core balance metrics
      availableUSDC: parseFloat(balance.available_usdc),
      pendingUSDC: parseFloat(balance.pending_usdc),
      lifetimeUSDC: parseFloat(balance.total_earned_usdc),
      todayUSDC: parseFloat(balance.today_usdc),
      
      // Subscription metrics
      activeSubscriptions: parseInt(subscriptionMetrics.active_subscriptions),
      subscriptionsToOthers: parseInt(subscriptionMetrics.subscriptions_to_others),
      
      // Tip metrics
      totalTips: parseInt(tipMetrics.tips_received),
      uniqueTippers: parseInt(tipMetrics.unique_tippers),
      averageTipAmount: parseFloat(tipMetrics.avg_tip_amount || 0),
      
      // Payout information
      payoutThreshold,
      nextPayoutDate: nextPayoutDate.toISOString(),
      canRequestPayout: parseFloat(balance.available_usdc) >= payoutThreshold && new Date() >= nextPayoutDate,
      successfulPayouts: parseInt(payoutMetrics.successful_payouts),
      totalPaidOut: parseFloat(payoutMetrics.total_paid_out || 0),
      pendingPayouts: parseInt(payoutMetrics.pending_payouts),
      
      // Earnings breakdown (last 30 days)
      earningsBreakdown,
      
      // Growth metrics
      weeklyGrowthRate: parseFloat(growthRate.toFixed(2)),
      lastWeekEarnings: parseFloat(growth.last_7_days || 0),
      
      // Metadata
      lastEarningAt: balance.last_earning_at,
      generatedAt: new Date().toISOString()
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Failed to generate finance summary', {
      error: error.message,
      userId: (req as any).userId
    });
    
    res.status(500).json({
      error: 'Failed to generate finance summary',
      code: 'FINANCE_SUMMARY_ERROR'
    });
  }
});

/**
 * GET /api/finance/ledger
 * Get paginated earnings ledger with filtering
 */
router.get('/ledger', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      page = '1',
      limit = '50',
      source,
      startDate,
      endDate
    } = req.query as Record<string, string>;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const db = getDatabase();
    
    let whereClause = 'WHERE el.user_id = $1 AND el.error_code IS NULL';
    const params = [userId];
    let paramIndex = 2;
    
    if (source) {
      whereClause += ` AND el.source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }
    
    if (startDate) {
      whereClause += ` AND el.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      whereClause += ` AND el.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    // Get total count
    const countQuery = await db.query(`
      SELECT COUNT(*) as total
      FROM earnings_ledger el
      ${whereClause}
    `, params);
    
    const totalCount = parseInt(countQuery.rows[0].total);
    
    // Get paginated results
    const ledgerQuery = await db.query(`
      SELECT 
        el.id,
        el.gross_usdc,
        el.fee_usdc,
        el.net_usdc,
        el.source,
        el.parent_id,
        el.meta,
        el.created_at,
        parent.meta as parent_meta
      FROM earnings_ledger el
      LEFT JOIN earnings_ledger parent ON el.parent_id = parent.id
      ${whereClause}
      ORDER BY el.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, parseInt(limit), offset]);
    
    const entries = ledgerQuery.rows.map(row => ({
      id: row.id,
      grossUSDC: parseFloat(row.gross_usdc),
      feeUSDC: parseFloat(row.fee_usdc),
      netUSDC: parseFloat(row.net_usdc),
      source: row.source,
      parentId: row.parent_id,
      meta: row.meta,
      parentMeta: row.parent_meta,
      createdAt: row.created_at
    }));
    
    res.json({
      entries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
    
  } catch (error) {
    logger.error('Failed to fetch earnings ledger', {
      error: error.message,
      userId: (req as any).userId
    });
    
    res.status(500).json({
      error: 'Failed to fetch earnings ledger',
      code: 'LEDGER_FETCH_ERROR'
    });
  }
});

/**
 * GET /api/finance/ledger.csv
 * Stream CSV export of earnings ledger
 */
router.get('/ledger.csv', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { startDate, endDate, source } = LedgerExportSchema.parse(req.query);
    
    const db = getDatabase();
    
    // Set CSV headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="earnings-ledger.csv"');
    
    // Write CSV header
    res.write('Date,Source,Gross USDC,Fee USDC,Net USDC,Video ID,Transaction ID,Notes\n');
    
    let whereClause = 'WHERE el.user_id = $1 AND el.error_code IS NULL';
    const params = [userId];
    let paramIndex = 2;
    
    if (source) {
      whereClause += ` AND el.source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }
    
    if (startDate) {
      whereClause += ` AND el.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      whereClause += ` AND el.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    // Stream results
    const client = await db.connect();
    
    try {
      const query = client.query(`
        SELECT 
          el.created_at,
          el.source,
          el.gross_usdc,
          el.fee_usdc,
          el.net_usdc,
          el.meta,
          el.id
        FROM earnings_ledger el
        ${whereClause}
        ORDER BY el.created_at DESC
      `, params);
      
      query.on('row', (row) => {
        const date = new Date(row.created_at).toISOString().split('T')[0];
        const videoId = row.meta?.video_id || '';
        const notes = row.source === 'split' ? 'Split payment' : 
                     row.source === 'referral' ? 'Referral bonus' :
                     row.source === 'subscription' ? 'Subscription payment' : '';
        
        res.write(`${date},${row.source},${row.gross_usdc},${row.fee_usdc},${row.net_usdc},${videoId},${row.id},"${notes}"\n`);
      });
      
      query.on('end', () => {
        res.end();
      });
      
      query.on('error', (error) => {
        logger.error('CSV export stream error', { error: error.message });
        res.status(500).end('Export failed');
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Failed to export earnings ledger', {
      error: error.message,
      userId: (req as any).userId
    });
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to export earnings ledger',
        code: 'LEDGER_EXPORT_ERROR'
      });
    }
  }
});

/**
 * GET /api/finance/analytics
 * Get advanced analytics and insights
 */
router.get('/analytics', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const db = getDatabase();
    
    // Daily earnings over last 30 days
    const dailyEarningsQuery = await db.query(`
      SELECT 
        DATE(created_at) as date,
        SUM(net_usdc) as daily_earnings,
        COUNT(*) as transaction_count
      FROM earnings_ledger
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '30 days'
        AND error_code IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [userId]);
    
    const dailyEarnings = dailyEarningsQuery.rows.map(row => ({
      date: row.date,
      earnings: parseFloat(row.daily_earnings),
      transactionCount: parseInt(row.transaction_count)
    }));
    
    // Top earning videos (if video_id exists in meta)
    const topVideosQuery = await db.query(`
      SELECT 
        meta->>'video_id' as video_id,
        SUM(net_usdc) as total_earnings,
        COUNT(*) as tip_count
      FROM earnings_ledger
      WHERE user_id = $1 
        AND source IN ('tip', 'split')
        AND meta->>'video_id' IS NOT NULL
        AND error_code IS NULL
      GROUP BY meta->>'video_id'
      ORDER BY total_earnings DESC
      LIMIT 10
    `, [userId]);
    
    const topVideos = topVideosQuery.rows.map(row => ({
      videoId: row.video_id,
      totalEarnings: parseFloat(row.total_earnings),
      tipCount: parseInt(row.tip_count)
    }));
    
    // Revenue source breakdown
    const revenueSourcesQuery = await db.query(`
      SELECT 
        source,
        SUM(net_usdc) as total_earnings,
        COUNT(*) as transaction_count,
        AVG(net_usdc) as avg_transaction
      FROM earnings_ledger
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '90 days'
        AND error_code IS NULL
      GROUP BY source
      ORDER BY total_earnings DESC
    `, [userId]);
    
    const revenueSources = revenueSourcesQuery.rows.map(row => ({
      source: row.source,
      totalEarnings: parseFloat(row.total_earnings),
      transactionCount: parseInt(row.transaction_count),
      averageTransaction: parseFloat(row.avg_transaction)
    }));
    
    res.json({
      dailyEarnings,
      topVideos,
      revenueSources,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to generate finance analytics', {
      error: error.message,
      userId: (req as any).userId
    });
    
    res.status(500).json({
      error: 'Failed to generate analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
});

export default router;