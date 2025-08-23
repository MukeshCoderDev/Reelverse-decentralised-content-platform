import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../config/database';
import { authenticateUser } from '../middleware/auth';
import { validateIdempotency } from '../middleware/idempotency';
import { rateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';
import { ServerAnalytics } from '../../../utils/analytics';

const router = Router();

// Validation schemas
const CreateSubscriptionSchema = z.object({
  creatorId: z.string().uuid('Invalid creator ID'),
  planId: z.string().uuid('Invalid plan ID').optional(),
  priceUSDC: z.number().min(1).max(100).optional(), // For custom pricing
  plan: z.enum(['monthly', 'annual']).default('monthly')
});

const CreatePlanSchema = z.object({
  name: z.string().min(1).max(100),
  priceUSDC: z.number().min(1).max(100),
  cadence: z.enum(['monthly', 'annual'])
});

const UpdateSubscriptionSchema = z.object({
  action: z.enum(['cancel', 'reactivate', 'change_plan']),
  planId: z.string().uuid().optional(),
  reason: z.string().max(200).optional()
});

// Rate limiting: 5 subscription actions per minute per user
const subscriptionRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many subscription requests. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/subscriptions
 * Create or manage subscription to creator
 * 
 * Body:
 * - creatorId: UUID of the creator to subscribe to
 * - planId: Optional UUID of specific plan (uses default if not provided)
 * - priceUSDC: Optional custom price (for legacy support)
 * - plan: 'monthly' or 'annual' (default: 'monthly')
 */
router.post('/',
  authenticateUser,
  subscriptionRateLimit,
  validateIdempotency,
  async (req: Request, res: Response) => {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      const { creatorId, planId, priceUSDC, plan } = CreateSubscriptionSchema.parse(req.body);
      const userId = (req as any).userId;
      const idempotencyKey = req.headers['idempotency-key'] as string;
      
      // Prevent self-subscription
      if (userId === creatorId) {
        return res.status(400).json({
          error: 'Cannot subscribe to yourself',
          code: 'SELF_SUBSCRIPTION_NOT_ALLOWED'
        });
      }
      
      await client.query('BEGIN');
      
      // Check for existing active subscription
      const existingQuery = await client.query(`
        SELECT id, status, plan_id, price_usdc, next_billing_at
        FROM subscriptions
        WHERE user_id = $1 AND creator_id = $2 AND status = 'active'
      `, [userId, creatorId]);
      
      if (existingQuery.rows.length > 0) {
        const existing = existingQuery.rows[0];
        
        // Return existing subscription (idempotent)
        await client.query('COMMIT');
        
        return res.json({
          ok: true,
          subscriptionId: existing.id,
          status: 'existing',
          nextRenewalDate: existing.next_billing_at,
          priceUSDC: parseFloat(existing.price_usdc),
          plan: {
            id: existing.plan_id,
            cadence: plan
          }
        });
      }
      
      // Get or create plan
      let selectedPlanId = planId;
      let selectedPrice = priceUSDC;
      
      if (!selectedPlanId) {
        // Look for creator's default plan or create one
        const defaultPlanQuery = await client.query(`
          SELECT id, price_usdc, cadence
          FROM plans
          WHERE creator_id = $1 AND cadence = $2 AND status = 'active'
          ORDER BY created_at DESC
          LIMIT 1
        `, [creatorId, plan]);
        
        if (defaultPlanQuery.rows.length > 0) {
          const defaultPlan = defaultPlanQuery.rows[0];
          selectedPlanId = defaultPlan.id;
          selectedPrice = parseFloat(defaultPlan.price_usdc);
        } else {
          // Create default plan
          const defaultPrice = selectedPrice || (plan === 'monthly' ? 4.99 : 49.99);
          
          const createPlanQuery = await client.query(`
            INSERT INTO plans (creator_id, name, price_usdc, cadence)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `, [
            creatorId,
            `${plan === 'monthly' ? 'Monthly' : 'Annual'} Subscription`,
            defaultPrice,
            plan
          ]);
          
          selectedPlanId = createPlanQuery.rows[0].id;
          selectedPrice = defaultPrice;
        }
      } else {
        // Verify plan exists and get price
        const planQuery = await client.query(`
          SELECT price_usdc, cadence, status
          FROM plans
          WHERE id = $1 AND creator_id = $2
        `, [selectedPlanId, creatorId]);
        
        if (planQuery.rows.length === 0) {
          return res.status(404).json({
            error: 'Plan not found',
            code: 'PLAN_NOT_FOUND'
          });
        }
        
        const planData = planQuery.rows[0];
        
        if (planData.status !== 'active') {
          return res.status(400).json({
            error: 'Plan is not active',
            code: 'PLAN_INACTIVE'
          });
        }
        
        selectedPrice = parseFloat(planData.price_usdc);
      }
      
      // Create subscription
      const subscriptionId = await client.query(`
        SELECT create_subscription($1, $2, $3)
      `, [userId, creatorId, selectedPlanId]);
      
      const newSubscriptionId = subscriptionId.rows[0].create_subscription;
      
      // Calculate creator share (90% to creator, 10% platform fee)
      const CREATOR_SHARE_PERCENT = 90;
      const grossAmount = selectedPrice;
      const platformFee = grossAmount * (10 / 100); // 10% platform fee
      const creatorNetAmount = grossAmount * (CREATOR_SHARE_PERCENT / 100);
      
      // Create immediate earnings ledger entry for creator
      await client.query(`
        INSERT INTO earnings_ledger (
          user_id, gross_usdc, fee_usdc, net_usdc, source, meta, idempotency_key
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        creatorId,
        grossAmount,
        platformFee,
        creatorNetAmount,
        'subscription',
        JSON.stringify({
          subscription_id: newSubscriptionId,
          subscriber_user_id: userId,
          plan_id: selectedPlanId,
          billing_period: plan
        }),
        idempotencyKey
      ]);
      
      // Process referral if applicable
      const referralQuery = await client.query(`
        SELECT process_referral_earnings($1, $2, $3, $4)
      `, [userId, grossAmount, 'subscription', null]);
      
      await client.query('COMMIT');
      
      // Get subscription details for response
      const subscriptionQuery = await client.query(`
        SELECT s.*, p.name as plan_name, p.cadence
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.id = $1
      `, [newSubscriptionId]);
      
      const subscription = subscriptionQuery.rows[0];
      
      logger.info('Subscription created successfully', {
        subscriptionId: newSubscriptionId,
        userId,
        creatorId,
        planId: selectedPlanId,
        priceUSDC: selectedPrice,
        cadence: plan
      });
      
      // Track successful subscription analytics
      ServerAnalytics.track('subscription_started', {
        creatorId,
        planId: selectedPlanId,
        planName: subscription.plan_name,
        amountUSDC: selectedPrice,
        cadence: plan,
        subscriptionId: newSubscriptionId
      }, req);
      
      res.json({
        ok: true,
        subscriptionId: newSubscriptionId,
        status: 'created',
        nextRenewalDate: subscription.next_billing_at,
        priceUSDC: selectedPrice,
        plan: {
          id: selectedPlanId,
          name: subscription.plan_name,
          cadence: subscription.cadence
        }
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
      
      logger.error('Subscription creation failed', {
        error: error.message,
        userId: (req as any).userId,
        creatorId: req.body.creatorId
      });
      
      // Track subscription failure analytics
      ServerAnalytics.track('subscription_failed', {
        creatorId: req.body.creatorId,
        planId: req.body.planId,
        amountUSDC: req.body.priceUSDC,
        cadence: req.body.plan,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message
      }, req);
      
      res.status(500).json({
        error: 'Failed to create subscription',
        code: 'SUBSCRIPTION_ERROR'
      });
    } finally {
      client.release();
    }
  }
);

/**
 * GET /api/subscriptions/user
 * Get user's subscriptions
 */
router.get('/user', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const db = getDatabase();
    
    const query = await db.query(`
      SELECT 
        s.id,
        s.creator_id,
        s.status,
        s.price_usdc,
        s.started_at,
        s.next_billing_at,
        s.canceled_at,
        p.name as plan_name,
        p.cadence,
        u.username as creator_name
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      LEFT JOIN users u ON s.creator_id = u.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
    `, [userId]);
    
    const subscriptions = query.rows.map(row => ({
      id: row.id,
      creatorId: row.creator_id,
      creatorName: row.creator_name,
      status: row.status,
      priceUSDC: parseFloat(row.price_usdc),
      plan: {
        name: row.plan_name,
        cadence: row.cadence
      },
      startedAt: row.started_at,
      nextBillingAt: row.next_billing_at,
      canceledAt: row.canceled_at
    }));
    
    res.json({
      subscriptions,
      total: subscriptions.length
    });
    
  } catch (error) {
    logger.error('Failed to fetch user subscriptions', {
      error: error.message,
      userId: (req as any).userId
    });
    
    res.status(500).json({
      error: 'Failed to fetch subscriptions',
      code: 'SUBSCRIPTIONS_FETCH_ERROR'
    });
  }
});

/**
 * PUT /api/subscriptions/:id
 * Update subscription (cancel, reactivate, change plan)
 */
router.put('/:id',
  authenticateUser,
  subscriptionRateLimit,
  async (req: Request, res: Response) => {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      const { id } = req.params;
      const { action, planId, reason } = UpdateSubscriptionSchema.parse(req.body);
      const userId = (req as any).userId;
      
      await client.query('BEGIN');
      
      // Verify subscription ownership
      const subscriptionQuery = await client.query(`
        SELECT * FROM subscriptions
        WHERE id = $1 AND user_id = $2
      `, [id, userId]);
      
      if (subscriptionQuery.rows.length === 0) {
        return res.status(404).json({
          error: 'Subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND'
        });
      }
      
      const subscription = subscriptionQuery.rows[0];
      
      switch (action) {
        case 'cancel':
          const success = await client.query(`
            SELECT cancel_subscription($1, $2)
          `, [id, reason || 'user_canceled']);
          
          if (!success.rows[0].cancel_subscription) {
            return res.status(400).json({
              error: 'Failed to cancel subscription',
              code: 'CANCEL_FAILED'
            });
          }
          
          // Track subscription cancellation
          ServerAnalytics.track('subscription_canceled', {
            creatorId: subscription.creator_id,
            planId: subscription.plan_id,
            planName: subscription.plan_name || 'Unknown',
            amountUSDC: parseFloat(subscription.price_usdc),
            cadence: subscription.cadence || 'monthly',
            subscriptionId: id,
            reason: reason || 'user_canceled',
            hadFailures: false // You could track if there were previous payment failures
          }, req);
          break;
          
        case 'reactivate':
          if (subscription.status !== 'canceled') {
            return res.status(400).json({
              error: 'Only canceled subscriptions can be reactivated',
              code: 'INVALID_STATUS_FOR_REACTIVATION'
            });
          }
          
          await client.query(`
            UPDATE subscriptions
            SET 
              status = 'active',
              canceled_at = NULL,
              canceled_reason = NULL,
              next_billing_at = NOW() + INTERVAL '1 month',
              updated_at = NOW()
            WHERE id = $1
          `, [id]);
          
          // Track subscription reactivation
          ServerAnalytics.track('subscription_reactivated', {
            creatorId: subscription.creator_id,
            planId: subscription.plan_id,
            planName: subscription.plan_name || 'Unknown',
            amountUSDC: parseFloat(subscription.price_usdc),
            cadence: subscription.cadence || 'monthly',
            subscriptionId: id
          }, req);
          break;
          
        case 'change_plan':
          if (!planId) {
            return res.status(400).json({
              error: 'Plan ID required for plan change',
              code: 'PLAN_ID_REQUIRED'
            });
          }
          
          // Verify new plan exists and belongs to same creator
          const newPlanQuery = await client.query(`
            SELECT price_usdc, cadence
            FROM plans
            WHERE id = $1 AND creator_id = $2 AND status = 'active'
          `, [planId, subscription.creator_id]);
          
          if (newPlanQuery.rows.length === 0) {
            return res.status(404).json({
              error: 'New plan not found',
              code: 'NEW_PLAN_NOT_FOUND'
            });
          }
          
          const newPlan = newPlanQuery.rows[0];
          
          await client.query(`
            UPDATE subscriptions
            SET 
              plan_id = $1,
              price_usdc = $2,
              updated_at = NOW()
            WHERE id = $3
          `, [planId, newPlan.price_usdc, id]);
          break;
      }
      
      await client.query('COMMIT');
      
      // Get updated subscription
      const updatedQuery = await client.query(`
        SELECT s.*, p.name as plan_name, p.cadence
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.id = $1
      `, [id]);
      
      const updated = updatedQuery.rows[0];
      
      res.json({
        ok: true,
        subscription: {
          id: updated.id,
          status: updated.status,
          priceUSDC: parseFloat(updated.price_usdc),
          nextBillingAt: updated.next_billing_at,
          canceledAt: updated.canceled_at,
          plan: {
            id: updated.plan_id,
            name: updated.plan_name,
            cadence: updated.cadence
          }
        }
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
      
      logger.error('Subscription update failed', {
        error: error.message,
        subscriptionId: req.params.id,
        userId: (req as any).userId
      });
      
      res.status(500).json({
        error: 'Failed to update subscription',
        code: 'SUBSCRIPTION_UPDATE_ERROR'
      });
    } finally {
      client.release();
    }
  }
);

/**
 * POST /api/subscriptions/plans
 * Create subscription plan (creator only)
 */
router.post('/plans',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const { name, priceUSDC, cadence } = CreatePlanSchema.parse(req.body);
      const creatorId = (req as any).userId;
      
      const db = getDatabase();
      const query = await db.query(`
        INSERT INTO plans (creator_id, name, price_usdc, cadence)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [creatorId, name, priceUSDC, cadence]);
      
      const plan = query.rows[0];
      
      res.json({
        ok: true,
        plan: {
          id: plan.id,
          name: plan.name,
          priceUSDC: parseFloat(plan.price_usdc),
          cadence: plan.cadence,
          status: plan.status,
          createdAt: plan.created_at
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
      
      logger.error('Plan creation failed', {
        error: error.message,
        creatorId: (req as any).userId
      });
      
      res.status(500).json({
        error: 'Failed to create plan',
        code: 'PLAN_CREATION_ERROR'
      });
    }
  }
);

/**
 * GET /api/subscriptions/creator/:creatorId/plans
 * Get creator's subscription plans
 */
router.get('/creator/:creatorId/plans', async (req: Request, res: Response) => {
  try {
    const { creatorId } = req.params;
    const db = getDatabase();
    
    const query = await db.query(`
      SELECT 
        p.*,
        COUNT(s.id) as subscriber_count,
        SUM(s.price_usdc) FILTER (WHERE s.status = 'active') as monthly_revenue
      FROM plans p
      LEFT JOIN subscriptions s ON p.id = s.plan_id AND s.status = 'active'
      WHERE p.creator_id = $1 AND p.status = 'active'
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, [creatorId]);
    
    const plans = query.rows.map(row => ({
      id: row.id,
      name: row.name,
      priceUSDC: parseFloat(row.price_usdc),
      cadence: row.cadence,
      subscriberCount: parseInt(row.subscriber_count),
      monthlyRevenue: parseFloat(row.monthly_revenue || 0),
      createdAt: row.created_at
    }));
    
    res.json({
      plans,
      total: plans.length
    });
    
  } catch (error) {
    logger.error('Failed to fetch creator plans', {
      error: error.message,
      creatorId: req.params.creatorId
    });
    
    res.status(500).json({
      error: 'Failed to fetch plans',
      code: 'PLANS_FETCH_ERROR'
    });
  }
});

export default router;