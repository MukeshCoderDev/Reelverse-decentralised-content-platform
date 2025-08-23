import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Subscription Renewal Worker
 * 
 * Processes subscription renewals with dunning logic:
 * - Attempts payment for due subscriptions
 * - Implements 3-attempt retry logic over 72 hours
 * - Handles grace periods for failed payments
 * - Creates earnings ledger entries for successful renewals
 * - Processes referral bonuses
 * - Expires old referrals
 * 
 * Designed to run daily via cron job
 */

interface SubscriptionToProcess {
  id: string;
  user_id: string;
  creator_id: string;
  plan_id: string;
  price_usdc: number;
  status: string;
  dunning_state: string;
  dunning_attempts: number;
  next_billing_at: Date;
  grace_until: Date | null;
}

interface ProcessingStats {
  totalProcessed: number;
  successfulRenewals: number;
  failedPayments: number;
  canceledSubscriptions: number;
  expiredReferrals: number;
  errors: string[];
}

export class SubscriptionRenewalWorker {
  private db: any;
  private stats: ProcessingStats;
  
  constructor() {
    this.db = getDatabase();
    this.resetStats();
  }
  
  private resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      successfulRenewals: 0,
      failedPayments: 0,
      canceledSubscriptions: 0,
      expiredReferrals: 0,
      errors: []
    };
  }
  
  /**
   * Main worker execution method
   * Run this daily via cron job
   */
  async processSubscriptionRenewals(): Promise<ProcessingStats> {
    const startTime = Date.now();
    this.resetStats();
    
    logger.info('Starting subscription renewal processing');
    
    try {
      // 1. Expire old referrals first
      await this.expireOldReferrals();
      
      // 2. Process subscriptions due for renewal
      await this.processDueSubscriptions();
      
      // 3. Handle grace period expirations
      await this.processGracePeriodExpirations();
      
      // 4. Clean up dunning state for successful renewals
      await this.cleanupDunningStates();
      
      const duration = Date.now() - startTime;
      
      logger.info('Subscription renewal processing completed', {
        ...this.stats,
        durationMs: duration
      });
      
      return this.stats;
      
    } catch (error) {
      logger.error('Subscription renewal processing failed', {
        error: error.message,
        stats: this.stats
      });
      
      this.stats.errors.push(error.message);
      return this.stats;
    }
  }
  
  /**
   * Expire referrals past their 180-day window
   */
  private async expireOldReferrals(): Promise<void> {
    try {
      const result = await this.db.query(`
        SELECT expire_referrals() as expired_count
      `);
      
      this.stats.expiredReferrals = result.rows[0]?.expired_count || 0;
      
      if (this.stats.expiredReferrals > 0) {
        logger.info('Expired old referrals', {
          count: this.stats.expiredReferrals
        });
      }
      
    } catch (error) {
      logger.error('Failed to expire referrals', { error: error.message });
      this.stats.errors.push(`Referral expiration failed: ${error.message}`);
    }
  }
  
  /**
   * Process subscriptions that are due for renewal
   */
  private async processDueSubscriptions(): Promise<void> {
    const client = await this.db.connect();
    
    try {
      // Get subscriptions due for renewal
      const subscriptionsQuery = await client.query(`
        SELECT 
          id, user_id, creator_id, plan_id, price_usdc, status,
          dunning_state, dunning_attempts, next_billing_at, grace_until
        FROM subscriptions
        WHERE next_billing_at <= NOW()
          AND status IN ('active', 'past_due')
          AND dunning_state IN ('active', 'retry')
        ORDER BY next_billing_at ASC
        LIMIT 1000
      `);
      
      const subscriptions: SubscriptionToProcess[] = subscriptionsQuery.rows;
      this.stats.totalProcessed = subscriptions.length;
      
      if (subscriptions.length === 0) {
        logger.info('No subscriptions due for renewal');
        return;
      }
      
      logger.info('Processing subscription renewals', {
        count: subscriptions.length
      });
      
      // Process each subscription
      for (const subscription of subscriptions) {
        await this.processSubscriptionRenewal(subscription, client);
      }
      
    } finally {
      client.release();
    }
  }
  
  /**
   * Process individual subscription renewal
   */
  private async processSubscriptionRenewal(
    subscription: SubscriptionToProcess,
    client: any
  ): Promise<void> {
    try {
      await client.query('BEGIN');
      
      // Simulate payment processing (integrate with actual payment processor)
      const paymentSuccess = await this.processPayment(subscription);
      
      if (paymentSuccess) {
        await this.handleSuccessfulRenewal(subscription, client);
        this.stats.successfulRenewals++;
      } else {
        await this.handleFailedPayment(subscription, client);
        this.stats.failedPayments++;
      }
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.error('Failed to process subscription renewal', {
        subscriptionId: subscription.id,
        error: error.message
      });
      
      this.stats.errors.push(
        `Subscription ${subscription.id}: ${error.message}`
      );
    }
  }
  
  /**
   * Simulate payment processing
   * In production, integrate with actual payment processor
   */
  private async processPayment(subscription: SubscriptionToProcess): Promise<boolean> {
    // For demo purposes, simulate 90% success rate
    // In production, this would call payment processor API
    const successRate = 0.90;
    const isSuccess = Math.random() < successRate;
    
    // Add some realistic delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    logger.debug('Payment simulation', {
      subscriptionId: subscription.id,
      amount: subscription.price_usdc,
      success: isSuccess
    });
    
    return isSuccess;
  }
  
  /**
   * Handle successful subscription renewal
   */
  private async handleSuccessfulRenewal(
    subscription: SubscriptionToProcess,
    client: any
  ): Promise<void> {
    // 1. Renew the subscription
    await client.query(`
      SELECT renew_subscription($1)
    `, [subscription.id]);
    
    // 2. Calculate creator earnings (90% share)
    const CREATOR_SHARE_PERCENT = 90;
    const grossAmount = subscription.price_usdc;
    const platformFee = grossAmount * (10 / 100);
    const creatorNetAmount = grossAmount * (CREATOR_SHARE_PERCENT / 100);
    
    // 3. Create earnings ledger entry
    await client.query(`
      INSERT INTO earnings_ledger (
        user_id, gross_usdc, fee_usdc, net_usdc, source, meta
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      subscription.creator_id,
      grossAmount,
      platformFee,
      creatorNetAmount,
      'subscription',
      JSON.stringify({
        subscription_id: subscription.id,
        subscriber_user_id: subscription.user_id,
        plan_id: subscription.plan_id,
        renewal_date: new Date().toISOString(),
        billing_cycle: 'renewal'
      })
    ]);
    
    // 4. Process referral if applicable
    await client.query(`
      SELECT process_referral_earnings($1, $2, $3, $4)
    `, [
      subscription.user_id,
      grossAmount,
      'subscription',
      null
    ]);
    
    logger.info('Subscription renewed successfully', {
      subscriptionId: subscription.id,
      creatorId: subscription.creator_id,
      amount: grossAmount
    });
  }
  
  /**
   * Handle failed payment with dunning logic
   */
  private async handleFailedPayment(
    subscription: SubscriptionToProcess,
    client: any
  ): Promise<void> {
    await client.query(`
      SELECT handle_payment_failure($1)
    `, [subscription.id]);
    
    logger.warn('Subscription payment failed', {
      subscriptionId: subscription.id,
      attempt: subscription.dunning_attempts + 1,
      maxAttempts: 3
    });
  }
  
  /**
   * Process subscriptions where grace period has expired
   */
  private async processGracePeriodExpirations(): Promise<void> {
    try {
      const expiredQuery = await this.db.query(`
        UPDATE subscriptions
        SET 
          status = 'canceled',
          canceled_reason = 'payment_failed',
          canceled_at = NOW(),
          updated_at = NOW()
        WHERE status = 'past_due'
          AND grace_until IS NOT NULL
          AND grace_until <= NOW()
        RETURNING id, creator_id
      `);
      
      const expiredSubscriptions = expiredQuery.rows;
      this.stats.canceledSubscriptions = expiredSubscriptions.length;
      
      if (expiredSubscriptions.length > 0) {
        logger.info('Canceled expired subscriptions', {
          count: expiredSubscriptions.length,
          subscriptionIds: expiredSubscriptions.map(s => s.id)
        });
        
        // Log subscription history for each canceled subscription
        for (const sub of expiredSubscriptions) {
          await this.db.query(`
            INSERT INTO subscription_history (subscription_id, event_type, reason)
            VALUES ($1, 'canceled', 'grace_period_expired')
          `, [sub.id]);
        }
      }
      
    } catch (error) {
      logger.error('Failed to process grace period expirations', {
        error: error.message
      });
      
      this.stats.errors.push(`Grace period processing failed: ${error.message}`);
    }
  }
  
  /**
   * Clean up dunning states for subscriptions that are now active
   */
  private async cleanupDunningStates(): Promise<void> {
    try {
      await this.db.query(`
        UPDATE subscriptions
        SET 
          dunning_state = 'active',
          dunning_attempts = 0,
          grace_until = NULL,
          updated_at = NOW()
        WHERE status = 'active'
          AND (dunning_state != 'active' OR dunning_attempts > 0 OR grace_until IS NOT NULL)
      `);
      
    } catch (error) {
      logger.error('Failed to cleanup dunning states', {
        error: error.message
      });
    }
  }
  
  /**
   * Get subscription renewal statistics
   */
  async getSubscriptionStats(): Promise<any> {
    try {
      const stats = await this.db.query(`
        SELECT 
          COUNT(*) as total_subscriptions,
          COUNT(*) FILTER (WHERE status = 'active') as active_subscriptions,
          COUNT(*) FILTER (WHERE status = 'past_due') as past_due_subscriptions,
          COUNT(*) FILTER (WHERE status = 'canceled') as canceled_subscriptions,
          COUNT(*) FILTER (WHERE next_billing_at <= NOW() + INTERVAL '7 days') as due_within_week,
          COUNT(*) FILTER (WHERE dunning_state = 'retry') as in_dunning,
          AVG(price_usdc) FILTER (WHERE status = 'active') as avg_subscription_price
        FROM subscriptions
      `);
      
      return stats.rows[0];
      
    } catch (error) {
      logger.error('Failed to get subscription stats', {
        error: error.message
      });
      
      return null;
    }
  }
}

/**
 * Standalone function for cron job execution
 */
export async function processSubscriptionRenewalsJob(): Promise<ProcessingStats> {
  const worker = new SubscriptionRenewalWorker();
  return await worker.processSubscriptionRenewals();
}

/**
 * Express route handler for manual processing (admin only)
 */
export async function handleSubscriptionRenewalRequest(req: any, res: any): Promise<void> {
  try {
    // Check admin authorization
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'UNAUTHORIZED'
      });
    }
    
    const worker = new SubscriptionRenewalWorker();
    const stats = await worker.processSubscriptionRenewals();
    
    res.json({
      ok: true,
      message: 'Subscription renewal processing completed',
      stats
    });
    
  } catch (error) {
    logger.error('Manual subscription renewal processing failed', {
      error: error.message
    });
    
    res.status(500).json({
      error: 'Subscription renewal processing failed',
      code: 'RENEWAL_PROCESSING_ERROR'
    });
  }
}

/**
 * Get subscription renewal statistics endpoint
 */
export async function getSubscriptionStatsHandler(req: any, res: any): Promise<void> {
  try {
    const worker = new SubscriptionRenewalWorker();
    const stats = await worker.getSubscriptionStats();
    
    if (!stats) {
      return res.status(500).json({
        error: 'Failed to retrieve statistics',
        code: 'STATS_ERROR'
      });
    }
    
    res.json({
      subscriptionStats: {
        totalSubscriptions: parseInt(stats.total_subscriptions),
        activeSubscriptions: parseInt(stats.active_subscriptions),
        pastDueSubscriptions: parseInt(stats.past_due_subscriptions),
        canceledSubscriptions: parseInt(stats.canceled_subscriptions),
        dueWithinWeek: parseInt(stats.due_within_week),
        inDunning: parseInt(stats.in_dunning),
        averageSubscriptionPrice: parseFloat(stats.avg_subscription_price || 0)
      },
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get subscription stats', {
      error: error.message
    });
    
    res.status(500).json({
      error: 'Failed to retrieve subscription statistics',
      code: 'STATS_FETCH_ERROR'
    });
  }
}