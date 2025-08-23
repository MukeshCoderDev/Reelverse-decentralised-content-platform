import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../config/database';
import { monetizationSecurity } from '../middleware/monetizationSecurity';
import { logger } from '../utils/logger';
import { ServerAnalytics } from '../../../utils/analytics';
import { authenticateUser } from '../middleware/auth';

const router = Router();

/**
 * POST /api/tips
 * Process USDC tip with automatic splits and referral attribution
 * 
 * Headers:
 * - Idempotency-Key: Required for safe retries
 * - Content-Type: application/json
 * 
 * Body:
 * - videoId: UUID of the video being tipped
 * - creatorId: UUID of the video creator
 * - amountUSDC: Tip amount in USDC (1-100)
 * 
 * Returns:
 * - transactionId: Unique identifier for this tip
 * - todayUSDC: User's earnings today
 * - pendingUSDC: Earnings in hold period
 * - availableUSDC: Available for payout
 */
router.post('/', 
  ...monetizationSecurity.tip,
  async (req: Request, res: Response) => {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      // Get validated data from security middleware
      const { videoId, creatorId, amountUSDC } = (req as any).validated;
      const userId = (req as any).userId;
      const idempotencyKey = req.headers['idempotency-key'] as string;
      
      await client.query('BEGIN');
      
      // 1. Load video split policy (versioned for immutability)
      const splitQuery = await client.query(`
        SELECT 
          vsa.policy_id,
          sp.version,
          jsonb_agg(
            jsonb_build_object(
              'payee_user_id', spi.payee_user_id,
              'percent', spi.percent,
              'is_creator', spi.is_creator
            ) ORDER BY spi.is_creator DESC, spi.percent DESC
          ) as splits
        FROM video_split_applied vsa
        JOIN split_policies sp ON vsa.policy_id = sp.id
        JOIN split_policy_items spi ON sp.id = spi.policy_id
        WHERE vsa.video_id = $1
        GROUP BY vsa.policy_id, sp.version
      `, [videoId]);
      
      let splits = [];
      let policyId = null;
      
      if (splitQuery.rows.length > 0) {
        splits = splitQuery.rows[0].splits;
        policyId = splitQuery.rows[0].policy_id;
      } else {
        // Default: 100% to creator
        splits = [{
          payee_user_id: creatorId,
          percent: 100.00,
          is_creator: true
        }];
      }
      
      // 2. Calculate platform fee and net amount
      const PLATFORM_FEE_PERCENT = 10; // 10% platform fee
      const grossAmount = amountUSDC;
      let platformFee = grossAmount * (PLATFORM_FEE_PERCENT / 100);
      let netAmount = grossAmount - platformFee;
      
      // 3. Check for active referral and apply bonus
      let referralLedgerId = null;
      const referralQuery = await client.query(`
        SELECT * FROM get_active_referral($1)
      `, [userId]);
      
      if (referralQuery.rows.length > 0) {
        const referral = referralQuery.rows[0];
        const referralBonus = grossAmount * (referral.reward_bps / 10000);
        
        // Reduce platform fee by referral bonus (up to the full fee)
        const actualBonus = Math.min(referralBonus, platformFee);
        platformFee -= actualBonus;
        netAmount += actualBonus;
        
        // Create referral earnings for the referrer
        if (actualBonus > 0) {
          referralLedgerId = await client.query(`
            SELECT process_referral_earnings($1, $2, $3, $4)
          `, [userId, grossAmount, 'tip', videoId]);
        }
      }
      
      // 4. Create parent ledger entry
      const parentLedgerQuery = await client.query(`
        INSERT INTO earnings_ledger (
          user_id, gross_usdc, fee_usdc, net_usdc, source, meta, idempotency_key
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        creatorId, // Parent entry goes to creator
        grossAmount,
        platformFee,
        netAmount,
        'tip',
        JSON.stringify({
          video_id: videoId,
          tipper_user_id: userId,
          policy_id: policyId,
          referral_ledger_id: referralLedgerId?.rows[0]?.process_referral_earnings
        }),
        idempotencyKey
      ]);
      
      const parentLedgerId = parentLedgerQuery.rows[0].id;
      
      // 5. Calculate and create split ledger entries
      let totalAssigned = 0;
      const splitLedgerEntries = [];
      
      for (const split of splits) {
        // Calculate share with proper rounding (floor to 6 decimals)
        let shareAmount = Math.floor((netAmount * split.percent / 100) * 1000000) / 1000000;
        
        // Track total for residual calculation
        if (!split.is_creator) {
          totalAssigned += shareAmount;
        }
        
        splitLedgerEntries.push({
          payee_user_id: split.payee_user_id,
          amount: shareAmount,
          percent: split.percent,
          is_creator: split.is_creator
        });
      }
      
      // 6. Assign residual to creator
      const creatorEntry = splitLedgerEntries.find(e => e.is_creator);
      if (creatorEntry) {
        const residual = netAmount - totalAssigned - creatorEntry.amount;
        creatorEntry.amount += residual;
      }
      
      // 7. Create split ledger entries
      for (const entry of splitLedgerEntries) {
        await client.query(`
          INSERT INTO earnings_ledger (
            user_id, gross_usdc, fee_usdc, net_usdc, source, parent_id, meta, idempotency_key
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          entry.payee_user_id,
          entry.amount, // Gross = net for splits
          0, // No additional fees on splits
          entry.amount,
          'split',
          parentLedgerId,
          JSON.stringify({
            video_id: videoId,
            split_percent: entry.percent,
            parent_tip_id: parentLedgerId
          }),
          `${idempotencyKey}_split_${entry.payee_user_id}`
        ]);
      }
      
      await client.query('COMMIT');
      
      // 8. Get updated balance summary for response
      const balanceQuery = await client.query(`
        SELECT * FROM get_user_balance($1)
      `, [userId]);
      
      const balance = balanceQuery.rows[0] || {
        total_earned_usdc: 0,
        today_usdc: 0,
        pending_usdc: 0,
        available_usdc: 0
      };
      
      // 9. Log successful tip
      logger.info('Tip processed successfully', {
        transactionId: parentLedgerId,
        userId,
        creatorId,
        videoId,
        amountUSDC,
        splitCount: splits.length,
        referralApplied: !!referralLedgerId
      });
      
      // 10. Track successful tip analytics
      ServerAnalytics.track('tip_success', {
        videoId,
        creatorId,
        amountUSDC,
        hasSplits: splits.length > 1,
        splitCount: splits.length,
        hasReferral: !!referralLedgerId,
        transactionId: parentLedgerId
      }, req);
      
      // 10. Emit WebSocket event for real-time balance updates
      // This would integrate with your WebSocket service
      // wsService.emit(`user:${userId}:balance_update`, balance);
      
      res.json({
        ok: true,
        transactionId: parentLedgerId,
        todayUSDC: parseFloat(balance.today_usdc),
        pendingUSDC: parseFloat(balance.pending_usdc),
        availableUSDC: parseFloat(balance.available_usdc)
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      if (error.code === '23505' && error.constraint?.includes('idempotency')) {
        // Idempotency key already used - return cached response
        const cachedQuery = await client.query(`
          SELECT id, meta FROM earnings_ledger 
          WHERE idempotency_key = $1 AND user_id = $2
        `, [req.headers['idempotency-key'], (req as any).userId]);
        
        if (cachedQuery.rows.length > 0) {
          const balanceQuery = await client.query(`
            SELECT * FROM get_user_balance($1)
          `, [(req as any).userId]);
          
          const balance = balanceQuery.rows[0];
          
          return res.json({
            ok: true,
            transactionId: cachedQuery.rows[0].id,
            todayUSDC: parseFloat(balance.today_usdc),
            pendingUSDC: parseFloat(balance.pending_usdc),
            availableUSDC: parseFloat(balance.available_usdc)
          });
        }
      }
      
      logger.error('Tip processing failed', {
        error: error.message,
        userId: (req as any).userId,
        videoId: req.body.videoId,
        creatorId: req.body.creatorId,
        amountUSDC: req.body.amountUSDC
      });
      
      // Track tip failure analytics
      ServerAnalytics.track('tip_failed', {
        videoId: req.body.videoId,
        creatorId: req.body.creatorId,
        amountUSDC: req.body.amountUSDC,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message
      }, req);
      
      res.status(500).json({
        error: 'Failed to process tip',
        message: 'Please try again later',
        code: 'TIP_PROCESSING_ERROR'
      });
    } finally {
      client.release();
    }
  }
);

/**
 * GET /api/tips/user/:userId
 * Get user's tip history (sent tips)
 */
router.get('/user/:userId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = (req as any).userId;
    
    // Users can only view their own tip history
    if (userId !== currentUserId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }
    
    const db = getDatabase();
    const query = await db.query(`
      SELECT 
        el.id,
        el.gross_usdc,
        el.created_at,
        el.meta->>'video_id' as video_id,
        el.meta->>'tipper_user_id' as tipper_user_id,
        COUNT(splits.id) as split_count
      FROM earnings_ledger el
      LEFT JOIN earnings_ledger splits ON splits.parent_id = el.id
      WHERE el.source = 'tip' 
        AND el.meta->>'tipper_user_id' = $1
        AND el.parent_id IS NULL
      GROUP BY el.id, el.gross_usdc, el.created_at, el.meta
      ORDER BY el.created_at DESC
      LIMIT 50
    `, [userId]);
    
    const tips = query.rows.map(row => ({
      id: row.id,
      amount: parseFloat(row.gross_usdc),
      videoId: row.video_id,
      createdAt: row.created_at,
      splitCount: parseInt(row.split_count)
    }));
    
    res.json({
      tips,
      total: tips.length
    });
    
  } catch (error) {
    logger.error('Failed to fetch tip history', {
      error: error.message,
      userId: req.params.userId
    });
    
    res.status(500).json({
      error: 'Failed to fetch tip history',
      code: 'TIP_HISTORY_ERROR'
    });
  }
});

export default router;