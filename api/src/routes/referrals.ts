import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../config/database';
import { authenticateUser } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const ClaimReferralSchema = z.object({
  code: z.string()
    .min(6, 'Referral code must be at least 6 characters')
    .max(20, 'Referral code must be at most 20 characters')
    .regex(/^[A-Z0-9]+$/i, 'Referral code must be alphanumeric')
});

const CreateReferralCodeSchema = z.object({
  customCode: z.string()
    .min(6, 'Custom code must be at least 6 characters')
    .max(20, 'Custom code must be at most 20 characters')
    .regex(/^[A-Z0-9]+$/i, 'Custom code must be alphanumeric')
    .optional(),
  rewardBps: z.number()
    .int()
    .min(100, 'Minimum reward is 1% (100 basis points)')
    .max(1000, 'Maximum reward is 10% (1000 basis points)')
    .default(1000),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional()
});

// Rate limiting for referral actions
const referralRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many referral requests. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for referral claiming (fraud protection)
const claimRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute  
  max: 3,
  message: 'Too many referral claim attempts. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/referrals/claim
 * Process referral code redemption with fraud protection
 * 
 * Body:
 * - code: 6-20 character alphanumeric referral code
 * 
 * Returns:
 * - ok: Success status
 * - expiresAt: 180 days from claim
 * - rewardBps: Usually 1000 (10%)
 * - creatorName: Name of referring creator
 * - maxRewardUSDC: Lifetime cap ($50)
 */
router.post('/claim',
  claimRateLimit,
  async (req: Request, res: Response) => {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      const { code } = ClaimReferralSchema.parse(req.body);
      const userId = (req as any).userId; // May be null for anonymous users
      
      // Extract client information for fraud detection
      const clientIp = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
      
      await client.query('BEGIN');
      
      // For anonymous users, we'll store the referral in a temporary way
      // and associate it when they sign up
      if (!userId) {
        // Look up referral code for validation
        const codeQuery = await client.query(`
          SELECT 
            rc.id,
            rc.creator_id,
            rc.reward_bps,
            rc.active,
            rc.expires_at,
            rc.max_uses,
            rc.current_uses,
            u.username as creator_name
          FROM referral_codes rc
          JOIN users u ON rc.creator_id = u.id
          WHERE LOWER(rc.code) = LOWER($1)
        `, [code]);
        
        if (codeQuery.rows.length === 0) {
          return res.status(404).json({
            error: 'Referral code not found',
            code: 'REFERRAL_CODE_NOT_FOUND'
          });
        }
        
        const referralCode = codeQuery.rows[0];
        
        // Validate code is active and not expired
        if (!referralCode.active) {
          return res.status(400).json({
            error: 'Referral code is inactive',
            code: 'REFERRAL_CODE_INACTIVE'
          });
        }
        
        if (referralCode.expires_at && new Date(referralCode.expires_at) <= new Date()) {
          return res.status(400).json({
            error: 'Referral code has expired',
            code: 'REFERRAL_CODE_EXPIRED'
          });
        }
        
        if (referralCode.max_uses && referralCode.current_uses >= referralCode.max_uses) {
          return res.status(400).json({
            error: 'Referral code usage limit reached',
            code: 'REFERRAL_CODE_LIMIT_REACHED'
          });
        }
        
        await client.query('COMMIT');
        
        // Return code info for anonymous users (they'll claim when signing up)
        return res.json({
          ok: true,
          anonymous: true,
          code: code.toUpperCase(),
          expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
          rewardBps: referralCode.reward_bps,
          creatorName: referralCode.creator_name,
          maxRewardUSDC: 50.00,
          message: 'Referral code valid. Sign up to activate referral bonus.'
        });
      }
      
      // For authenticated users, claim the referral
      const referralId = await client.query(`
        SELECT claim_referral_code($1, $2, $3, $4, $5)
      `, [
        code,
        userId,
        clientIp,
        userAgent,
        deviceFingerprint
      ]);
      
      const claimedReferralId = referralId.rows[0].claim_referral_code;
      
      if (!claimedReferralId) {
        return res.status(400).json({
          error: 'Failed to claim referral code',
          code: 'REFERRAL_CLAIM_FAILED'
        });
      }
      
      // Get referral details for response
      const referralQuery = await client.query(`
        SELECT 
          r.expires_at,
          rc.reward_bps,
          rc.code,
          u.username as creator_name
        FROM referrals r
        JOIN referral_codes rc ON r.referral_code_id = rc.id
        JOIN users u ON r.referrer_user_id = u.id
        WHERE r.id = $1
      `, [claimedReferralId]);
      
      const referralData = referralQuery.rows[0];
      
      await client.query('COMMIT');
      
      logger.info('Referral code claimed successfully', {
        referralId: claimedReferralId,
        userId,
        code,
        referrerName: referralData.creator_name,
        clientIp
      });
      
      res.json({
        ok: true,
        referralId: claimedReferralId,
        expiresAt: referralData.expires_at,
        rewardBps: referralData.reward_bps,
        creatorName: referralData.creator_name,
        maxRewardUSDC: 50.00
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
      
      // Handle specific database errors
      if (error.message?.includes('Cannot refer yourself')) {
        return res.status(400).json({
          error: 'Cannot use your own referral code',
          code: 'SELF_REFERRAL_NOT_ALLOWED'
        });
      }
      
      if (error.message?.includes('already has an active referral')) {
        return res.status(400).json({
          error: 'You already have an active referral',
          code: 'REFERRAL_ALREADY_ACTIVE'
        });
      }
      
      if (error.message?.includes('not found or inactive')) {
        return res.status(404).json({
          error: 'Referral code not found or inactive',
          code: 'REFERRAL_CODE_NOT_FOUND'
        });
      }
      
      logger.error('Referral claim failed', {
        error: error.message,
        code: req.body.code,
        userId: (req as any).userId,
        clientIp: req.ip
      });
      
      res.status(500).json({
        error: 'Failed to claim referral code',
        code: 'REFERRAL_CLAIM_ERROR'
      });
    } finally {
      client.release();
    }
  }
);

/**
 * POST /api/referrals/codes
 * Create referral code for authenticated user
 */
router.post('/codes',
  authenticateUser,
  referralRateLimit,  
  async (req: Request, res: Response) => {
    try {
      const { customCode, rewardBps, maxUses, expiresAt } = CreateReferralCodeSchema.parse(req.body);
      const creatorId = (req as any).userId;
      
      const db = getDatabase();
      
      const referralCodeId = await db.query(`
        SELECT create_referral_code($1, $2, $3, $4, $5)
      `, [
        creatorId,
        rewardBps,
        customCode,
        maxUses,
        expiresAt
      ]);
      
      const codeId = referralCodeId.rows[0].create_referral_code;
      
      // Get created code details
      const codeQuery = await db.query(`
        SELECT code, reward_bps, max_uses, expires_at, created_at
        FROM referral_codes
        WHERE id = $1
      `, [codeId]);
      
      const codeData = codeQuery.rows[0];
      
      logger.info('Referral code created', {
        codeId,
        creatorId,
        code: codeData.code,
        customCode: !!customCode
      });
      
      res.json({
        ok: true,
        referralCode: {
          id: codeId,
          code: codeData.code,
          rewardBps: codeData.reward_bps,
          maxUses: codeData.max_uses,
          expiresAt: codeData.expires_at,
          createdAt: codeData.created_at
        }
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      if (error.message?.includes('already exists')) {
        return res.status(409).json({
          error: 'Referral code already exists',
          code: 'REFERRAL_CODE_EXISTS'
        });
      }
      
      logger.error('Referral code creation failed', {
        error: error.message,
        creatorId: (req as any).userId
      });
      
      res.status(500).json({
        error: 'Failed to create referral code',
        code: 'REFERRAL_CODE_CREATION_ERROR'
      });
    }
  }
);

/**
 * GET /api/referrals/codes
 * Get user's referral codes and analytics
 */
router.get('/codes', authenticateUser, async (req: Request, res: Response) => {
  try {
    const creatorId = (req as any).userId;
    const db = getDatabase();
    
    const query = await db.query(`
      SELECT 
        rc.id,
        rc.code,
        rc.reward_bps,
        rc.active,
        rc.max_uses,
        rc.current_uses,
        rc.expires_at,
        rc.created_at,
        COUNT(r.id) as total_referrals,
        COUNT(r.id) FILTER (WHERE r.status = 'active') as active_referrals,
        SUM(r.total_attributed_usdc) as total_attributed_revenue,
        SUM(r.total_referrer_earnings_usdc) as total_earnings
      FROM referral_codes rc
      LEFT JOIN referrals r ON rc.id = r.referral_code_id
      WHERE rc.creator_id = $1
      GROUP BY rc.id, rc.code, rc.reward_bps, rc.active, rc.max_uses, rc.current_uses, rc.expires_at, rc.created_at
      ORDER BY rc.created_at DESC
    `, [creatorId]);
    
    const codes = query.rows.map(row => ({
      id: row.id,
      code: row.code,
      rewardBps: row.reward_bps,
      active: row.active,
      maxUses: row.max_uses,
      currentUses: row.current_uses,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      analytics: {
        totalReferrals: parseInt(row.total_referrals),
        activeReferrals: parseInt(row.active_referrals),
        totalAttributedRevenue: parseFloat(row.total_attributed_revenue || 0),
        totalEarnings: parseFloat(row.total_earnings || 0)
      }
    }));
    
    res.json({
      codes,
      total: codes.length
    });
    
  } catch (error) {
    logger.error('Failed to fetch referral codes', {
      error: error.message,
      creatorId: (req as any).userId
    });
    
    res.status(500).json({
      error: 'Failed to fetch referral codes',
      code: 'REFERRAL_CODES_FETCH_ERROR'
    });
  }
});

/**
 * PUT /api/referrals/codes/:id
 * Update referral code (activate/deactivate)
 */
router.put('/codes/:id',
  authenticateUser,
  referralRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { active } = z.object({
        active: z.boolean()
      }).parse(req.body);
      
      const creatorId = (req as any).userId;
      const db = getDatabase();
      
      const updateQuery = await db.query(`
        UPDATE referral_codes
        SET active = $1, updated_at = NOW()
        WHERE id = $2 AND creator_id = $3
        RETURNING code, active
      `, [active, id, creatorId]);
      
      if (updateQuery.rows.length === 0) {
        return res.status(404).json({
          error: 'Referral code not found',
          code: 'REFERRAL_CODE_NOT_FOUND'
        });
      }
      
      const result = updateQuery.rows[0];
      
      res.json({
        ok: true,
        code: result.code,
        active: result.active
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      logger.error('Failed to update referral code', {
        error: error.message,
        codeId: req.params.id,
        creatorId: (req as any).userId
      });
      
      res.status(500).json({
        error: 'Failed to update referral code',
        code: 'REFERRAL_CODE_UPDATE_ERROR'
      });
    }
  }
);

/**
 * GET /api/referrals/status
 * Get user's referral status (are they referred by someone?)
 */
router.get('/status', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const db = getDatabase();
    
    const query = await db.query(`
      SELECT * FROM get_active_referral($1)
    `, [userId]);
    
    if (query.rows.length === 0) {
      return res.json({
        hasActiveReferral: false,
        referral: null
      });
    }
    
    const referral = query.rows[0];
    
    // Get referrer details
    const referrerQuery = await db.query(`
      SELECT username, email FROM users WHERE id = $1
    `, [referral.referrer_user_id]);
    
    const referrer = referrerQuery.rows[0];
    
    res.json({
      hasActiveReferral: true,
      referral: {
        referrerId: referral.referrer_user_id,
        referrerName: referrer?.username || referrer?.email,
        rewardBps: referral.reward_bps,
        expiresAt: referral.expires_at,
        totalEarningsCapUSDC: parseFloat(referral.total_earnings_cap_usdc)
      }
    });
    
  } catch (error) {
    logger.error('Failed to fetch referral status', {
      error: error.message,
      userId: (req as any).userId
    });
    
    res.status(500).json({
      error: 'Failed to fetch referral status',
      code: 'REFERRAL_STATUS_ERROR'
    });
  }
});

/**
 * GET /api/referrals/earnings
 * Get user's referral earnings history
 */
router.get('/earnings', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const db = getDatabase();
    
    const query = await db.query(`
      SELECT 
        re.id,
        re.source_transaction_usdc,
        re.referral_percentage,
        re.referral_earnings_usdc,
        re.source_type,
        re.video_id,
        re.created_at,
        el.created_at as earning_date,
        r.referred_user_id,
        u.username as referred_user_name
      FROM referral_earnings re
      JOIN earnings_ledger el ON re.earnings_ledger_id = el.id
      JOIN referrals r ON re.referral_id = r.id
      LEFT JOIN users u ON r.referred_user_id = u.id
      WHERE r.referrer_user_id = $1
      ORDER BY re.created_at DESC
      LIMIT 100
    `, [userId]);
    
    const earnings = query.rows.map(row => ({
      id: row.id,
      sourceTransactionUSDC: parseFloat(row.source_transaction_usdc),
      referralPercentage: parseFloat(row.referral_percentage),
      referralEarningsUSDC: parseFloat(row.referral_earnings_usdc),
      sourceType: row.source_type,
      videoId: row.video_id,
      referredUserId: row.referred_user_id,
      referredUserName: row.referred_user_name,
      createdAt: row.created_at
    }));
    
    // Get summary
    const summaryQuery = await db.query(`
      SELECT 
        COUNT(re.id) as total_transactions,
        SUM(re.referral_earnings_usdc) as total_earnings,
        COUNT(DISTINCT r.referred_user_id) as unique_referrals
      FROM referral_earnings re
      JOIN referrals r ON re.referral_id = r.id
      WHERE r.referrer_user_id = $1
    `, [userId]);
    
    const summary = summaryQuery.rows[0];
    
    res.json({
      earnings,
      summary: {
        totalTransactions: parseInt(summary.total_transactions),
        totalEarnings: parseFloat(summary.total_earnings || 0),
        uniqueReferrals: parseInt(summary.unique_referrals)
      }
    });
    
  } catch (error) {
    logger.error('Failed to fetch referral earnings', {
      error: error.message,
      userId: (req as any).userId
    });
    
    res.status(500).json({
      error: 'Failed to fetch referral earnings',
      code: 'REFERRAL_EARNINGS_ERROR'
    });
  }
});

export default router;