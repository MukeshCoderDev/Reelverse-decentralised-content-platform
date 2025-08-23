import { getDatabase } from '../api/src/config/database';
import { logger } from '../api/src/utils/logger';

/**
 * Financial Reconciliation and Monitoring System
 * Ensures data integrity and detects discrepancies in financial transactions
 */

interface ReconciliationResult {
  timestamp: Date;
  checks: ReconciliationCheck[];
  totalIssues: number;
  criticalIssues: number;
  status: 'healthy' | 'warning' | 'critical';
}

interface ReconciliationCheck {
  name: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  expectedValue?: number;
  actualValue?: number;
  deviation?: number;
  affectedRecords?: number;
  details?: any;
}

interface BalanceDrift {
  userId: string;
  userEmail: string;
  expectedBalance: number;
  actualBalance: number;
  drift: number;
  driftPercentage: number;
  lastReconciled: Date;
}

interface TransactionAnomalies {
  duplicateTransactions: Array<{
    transactionId: string;
    userId: string;
    amount: number;
    duplicateCount: number;
  }>;
  orphanedSplits: Array<{
    splitId: string;
    parentId: string;
    amount: number;
  }>;
  invalidAmounts: Array<{
    transactionId: string;
    userId: string;
    amount: number;
    issue: string;
  }>;
}

export class FinancialReconciliation {
  private db = getDatabase();
  private reconciliationThreshold = 0.01; // $0.01 acceptable drift
  private warningThreshold = 1.00; // $1.00 warning threshold
  private criticalThreshold = 10.00; // $10.00 critical threshold

  /**
   * Run comprehensive financial reconciliation
   */
  async runReconciliation(): Promise<ReconciliationResult> {
    const startTime = Date.now();
    logger.info('Starting financial reconciliation');

    const checks: ReconciliationCheck[] = [];

    try {
      // 1. Balance integrity checks
      checks.push(await this.checkBalanceIntegrity());
      
      // 2. Transaction consistency checks
      checks.push(await this.checkTransactionConsistency());
      
      // 3. Split calculation verification
      checks.push(await this.checkSplitCalculations());
      
      // 4. Referral bonus verification
      checks.push(await this.checkReferralBonuses());
      
      // 5. Payout consistency checks
      checks.push(await this.checkPayoutConsistency());
      
      // 6. Subscription revenue verification
      checks.push(await this.checkSubscriptionRevenue());
      
      // 7. Platform fee calculations
      checks.push(await this.checkPlatformFees());

      // 8. Idempotency violations
      checks.push(await this.checkIdempotencyViolations());

      const result: ReconciliationResult = {
        timestamp: new Date(),
        checks,
        totalIssues: checks.filter(c => c.status !== 'pass').length,
        criticalIssues: checks.filter(c => c.status === 'fail').length,
        status: this.determineOverallStatus(checks)
      };

      const duration = Date.now() - startTime;
      logger.info(`Financial reconciliation completed in ${duration}ms`, {
        totalChecks: checks.length,
        totalIssues: result.totalIssues,
        criticalIssues: result.criticalIssues,
        status: result.status
      });

      // Send alerts if needed
      if (result.status === 'critical') {
        await this.sendCriticalAlert(result);
      } else if (result.status === 'warning') {
        await this.sendWarningAlert(result);
      }

      return result;

    } catch (error) {
      logger.error('Financial reconciliation failed', { error: error.message, stack: error.stack });
      
      return {
        timestamp: new Date(),
        checks: [{
          name: 'reconciliation_execution',
          status: 'fail',
          message: `Reconciliation failed: ${error.message}`,
          details: { error: error.message }
        }],
        totalIssues: 1,
        criticalIssues: 1,
        status: 'critical'
      };
    }
  }

  /**
   * Check balance integrity across all users
   */
  private async checkBalanceIntegrity(): Promise<ReconciliationCheck> {
    const client = await this.db.connect();
    
    try {
      // Compare materialized view balances with calculated balances
      const query = `
        WITH calculated_balances AS (
          SELECT 
            user_id,
            SUM(CASE WHEN net_usdc > 0 THEN net_usdc ELSE 0 END) as calculated_available,
            SUM(net_usdc) as calculated_total
          FROM earnings_ledger 
          WHERE error_code IS NULL
          GROUP BY user_id
        ),
        materialized_balances AS (
          SELECT 
            user_id,
            available_usdc as materialized_available,
            total_earned_usdc as materialized_total
          FROM user_balance_summary
        )
        SELECT 
          cb.user_id,
          cb.calculated_available,
          mb.materialized_available,
          ABS(cb.calculated_available - mb.materialized_available) as drift,
          u.email
        FROM calculated_balances cb
        JOIN materialized_balances mb ON cb.user_id = mb.user_id
        JOIN users u ON cb.user_id = u.id
        WHERE ABS(cb.calculated_available - mb.materialized_available) > $1
        ORDER BY drift DESC
        LIMIT 100
      `;

      const result = await client.query(query, [this.reconciliationThreshold]);
      const drifts = result.rows as BalanceDrift[];

      if (drifts.length === 0) {
        return {
          name: 'balance_integrity',
          status: 'pass',
          message: 'All user balances are consistent'
        };
      }

      const maxDrift = Math.max(...drifts.map(d => Math.abs(d.drift)));
      const totalDrift = drifts.reduce((sum, d) => sum + Math.abs(d.drift), 0);

      const status = maxDrift > this.criticalThreshold ? 'fail' : 
                    maxDrift > this.warningThreshold ? 'warning' : 'pass';

      return {
        name: 'balance_integrity',
        status,
        message: `Found ${drifts.length} users with balance drift. Max drift: $${maxDrift.toFixed(2)}`,
        affectedRecords: drifts.length,
        details: {
          maxDrift,
          totalDrift,
          topDrifts: drifts.slice(0, 10)
        }
      };

    } finally {
      client.release();
    }
  }

  /**
   * Check transaction consistency
   */
  private async checkTransactionConsistency(): Promise<ReconciliationCheck> {
    const client = await this.db.connect();
    
    try {
      const checks = await Promise.all([
        // Check for negative amounts where they shouldn't be
        client.query(`
          SELECT COUNT(*) as count 
          FROM earnings_ledger 
          WHERE gross_usdc < 0 AND source IN ('tip', 'subscription')
        `),
        
        // Check for missing split entries
        client.query(`
          SELECT COUNT(*) as count
          FROM earnings_ledger parent
          LEFT JOIN earnings_ledger splits ON parent.id = splits.parent_id
          WHERE parent.source = 'tip' AND parent.parent_id IS NULL 
            AND splits.id IS NULL
        `),
        
        // Check for split amounts not matching parent
        client.query(`
          SELECT parent.id, parent.net_usdc as parent_amount, SUM(splits.net_usdc) as splits_total
          FROM earnings_ledger parent
          JOIN earnings_ledger splits ON parent.id = splits.parent_id
          WHERE parent.source = 'tip' AND parent.parent_id IS NULL
          GROUP BY parent.id, parent.net_usdc
          HAVING ABS(parent.net_usdc - SUM(splits.net_usdc)) > 0.01
          LIMIT 10
        `)
      ]);

      const negativeAmounts = checks[0].rows[0].count;
      const missingSplits = checks[1].rows[0].count;
      const mismatchedSplits = checks[2].rows;

      const totalIssues = parseInt(negativeAmounts) + parseInt(missingSplits) + mismatchedSplits.length;

      if (totalIssues === 0) {
        return {
          name: 'transaction_consistency',
          status: 'pass',
          message: 'All transactions are consistent'
        };
      }

      const status = totalIssues > 10 ? 'fail' : totalIssues > 0 ? 'warning' : 'pass';

      return {
        name: 'transaction_consistency',
        status,
        message: `Found ${totalIssues} transaction consistency issues`,
        affectedRecords: totalIssues,
        details: {
          negativeAmounts: parseInt(negativeAmounts),
          missingSplits: parseInt(missingSplits),
          mismatchedSplits: mismatchedSplits.length,
          examples: mismatchedSplits
        }
      };

    } finally {
      client.release();
    }
  }

  /**
   * Verify split calculations are correct
   */
  private async checkSplitCalculations(): Promise<ReconciliationCheck> {
    const client = await this.db.connect();
    
    try {
      // Check if split percentages add up to 100% for each policy
      const query = `
        SELECT 
          sp.id as policy_id,
          sp.name,
          SUM(spi.percent) as total_percent,
          COUNT(spi.id) as payee_count
        FROM split_policies sp
        JOIN split_policy_items spi ON sp.id = spi.policy_id
        WHERE sp.status = 'active'
        GROUP BY sp.id, sp.name
        HAVING ABS(SUM(spi.percent) - 100.0) > 0.01
      `;

      const result = await client.query(query);
      const invalidPolicies = result.rows;

      if (invalidPolicies.length === 0) {
        return {
          name: 'split_calculations',
          status: 'pass',
          message: 'All split policies have correct percentages'
        };
      }

      return {
        name: 'split_calculations',
        status: 'fail',
        message: `Found ${invalidPolicies.length} split policies with incorrect percentages`,
        affectedRecords: invalidPolicies.length,
        details: { invalidPolicies }
      };

    } finally {
      client.release();
    }
  }

  /**
   * Verify referral bonus calculations
   */
  private async checkReferralBonuses(): Promise<ReconciliationCheck> {
    const client = await this.db.connect();
    
    try {
      // Check referral bonuses are within expected range (0-20%)
      const query = `
        SELECT 
          el.id,
          el.user_id,
          el.gross_usdc,
          el.meta->>'referral_bonus_rate' as bonus_rate,
          r.reward_bps
        FROM earnings_ledger el
        JOIN referrals r ON el.meta->>'referral_id' = r.id::text
        WHERE el.source = 'referral'
          AND (
            (el.meta->>'referral_bonus_rate')::numeric > 0.20 
            OR (el.meta->>'referral_bonus_rate')::numeric < 0
          )
        LIMIT 50
      `;

      const result = await client.query(query);
      const invalidBonuses = result.rows;

      if (invalidBonuses.length === 0) {
        return {
          name: 'referral_bonuses',
          status: 'pass',
          message: 'All referral bonuses are within expected range'
        };
      }

      return {
        name: 'referral_bonuses',
        status: 'warning',
        message: `Found ${invalidBonuses.length} referral bonuses outside expected range`,
        affectedRecords: invalidBonuses.length,
        details: { invalidBonuses }
      };

    } finally {
      client.release();
    }
  }

  /**
   * Check payout consistency
   */
  private async checkPayoutConsistency(): Promise<ReconciliationCheck> {
    const client = await this.db.connect();
    
    try {
      const checks = await Promise.all([
        // Check for payouts exceeding available balance
        client.query(`
          SELECT p.id, p.user_id, p.amount_usdc, ubs.available_usdc
          FROM payouts p
          JOIN user_balance_summary ubs ON p.user_id = ubs.user_id
          WHERE p.status IN ('pending', 'processing', 'completed')
            AND p.amount_usdc > ubs.available_usdc + p.amount_usdc
          LIMIT 10
        `),
        
        // Check for stuck payouts
        client.query(`
          SELECT COUNT(*) as count
          FROM payouts 
          WHERE status = 'processing' 
            AND requested_at < NOW() - INTERVAL '24 hours'
        `)
      ]);

      const excessivePayouts = checks[0].rows;
      const stuckPayouts = parseInt(checks[1].rows[0].count);

      const totalIssues = excessivePayouts.length + stuckPayouts;

      if (totalIssues === 0) {
        return {
          name: 'payout_consistency',
          status: 'pass',
          message: 'All payouts are consistent'
        };
      }

      const status = excessivePayouts.length > 0 ? 'fail' : 'warning';

      return {
        name: 'payout_consistency',
        status,
        message: `Found ${totalIssues} payout issues`,
        affectedRecords: totalIssues,
        details: {
          excessivePayouts: excessivePayouts.length,
          stuckPayouts,
          examples: excessivePayouts
        }
      };

    } finally {
      client.release();
    }
  }

  /**
   * Verify subscription revenue calculations
   */
  private async checkSubscriptionRevenue(): Promise<ReconciliationCheck> {
    const client = await this.db.connect();
    
    try {
      // Check if subscription earnings match plan prices
      const query = `
        SELECT 
          el.id,
          el.gross_usdc,
          p.price_usdc,
          s.id as subscription_id,
          ABS(el.gross_usdc - (p.price_usdc * 0.9)) as deviation
        FROM earnings_ledger el
        JOIN subscriptions s ON el.meta->>'subscription_id' = s.id::text
        JOIN plans p ON s.plan_id = p.id
        WHERE el.source = 'subscription'
          AND ABS(el.gross_usdc - (p.price_usdc * 0.9)) > 0.01
        LIMIT 20
      `;

      const result = await client.query(query);
      const deviations = result.rows;

      if (deviations.length === 0) {
        return {
          name: 'subscription_revenue',
          status: 'pass',
          message: 'All subscription revenue calculations are correct'
        };
      }

      const maxDeviation = Math.max(...deviations.map(d => d.deviation));
      const status = maxDeviation > this.criticalThreshold ? 'fail' : 'warning';

      return {
        name: 'subscription_revenue',
        status,
        message: `Found ${deviations.length} subscription revenue deviations`,
        affectedRecords: deviations.length,
        details: { deviations, maxDeviation }
      };

    } finally {
      client.release();
    }
  }

  /**
   * Verify platform fee calculations
   */
  private async checkPlatformFees(): Promise<ReconciliationCheck> {
    const client = await this.db.connect();
    
    try {
      // Check if platform fees are within expected range (5-15%)
      const query = `
        SELECT 
          id,
          gross_usdc,
          fee_usdc,
          net_usdc,
          (fee_usdc / NULLIF(gross_usdc, 0) * 100) as fee_percentage
        FROM earnings_ledger
        WHERE parent_id IS NULL 
          AND source IN ('tip', 'subscription')
          AND gross_usdc > 0
          AND (
            (fee_usdc / gross_usdc * 100) < 5 
            OR (fee_usdc / gross_usdc * 100) > 15
          )
        LIMIT 50
      `;

      const result = await client.query(query);
      const invalidFees = result.rows;

      if (invalidFees.length === 0) {
        return {
          name: 'platform_fees',
          status: 'pass',
          message: 'All platform fees are within expected range'
        };
      }

      return {
        name: 'platform_fees',
        status: 'warning',
        message: `Found ${invalidFees.length} transactions with unexpected platform fees`,
        affectedRecords: invalidFees.length,
        details: { invalidFees }
      };

    } finally {
      client.release();
    }
  }

  /**
   * Check for idempotency violations
   */
  private async checkIdempotencyViolations(): Promise<ReconciliationCheck> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT 
          idempotency_key,
          COUNT(*) as duplicate_count,
          array_agg(id) as transaction_ids
        FROM earnings_ledger
        WHERE idempotency_key IS NOT NULL
        GROUP BY idempotency_key
        HAVING COUNT(*) > 1
        LIMIT 20
      `;

      const result = await client.query(query);
      const violations = result.rows;

      if (violations.length === 0) {
        return {
          name: 'idempotency_violations',
          status: 'pass',
          message: 'No idempotency violations found'
        };
      }

      return {
        name: 'idempotency_violations',
        status: 'fail',
        message: `Found ${violations.length} idempotency violations`,
        affectedRecords: violations.length,
        details: { violations }
      };

    } finally {
      client.release();
    }
  }

  /**
   * Determine overall reconciliation status
   */
  private determineOverallStatus(checks: ReconciliationCheck[]): 'healthy' | 'warning' | 'critical' {
    const hasFailures = checks.some(c => c.status === 'fail');
    const hasWarnings = checks.some(c => c.status === 'warning');

    if (hasFailures) return 'critical';
    if (hasWarnings) return 'warning';
    return 'healthy';
  }

  /**
   * Send critical alert
   */
  private async sendCriticalAlert(result: ReconciliationResult): Promise<void> {
    const failedChecks = result.checks.filter(c => c.status === 'fail');
    
    logger.error('CRITICAL: Financial reconciliation failures detected', {
      timestamp: result.timestamp,
      failedChecks: failedChecks.map(c => ({
        name: c.name,
        message: c.message,
        affectedRecords: c.affectedRecords
      }))
    });

    // Send to alerting system (Slack, PagerDuty, etc.)
    await this.sendAlert('critical', result);
  }

  /**
   * Send warning alert
   */
  private async sendWarningAlert(result: ReconciliationResult): Promise<void> {
    const warningChecks = result.checks.filter(c => c.status === 'warning');
    
    logger.warn('WARNING: Financial reconciliation issues detected', {
      timestamp: result.timestamp,
      warningChecks: warningChecks.map(c => ({
        name: c.name,
        message: c.message,
        affectedRecords: c.affectedRecords
      }))
    });

    // Send to alerting system
    await this.sendAlert('warning', result);
  }

  /**
   * Send alert to external systems
   */
  private async sendAlert(severity: 'critical' | 'warning', result: ReconciliationResult): Promise<void> {
    try {
      // Example: Send to Slack webhook
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Financial Reconciliation ${severity.toUpperCase()}`,
            attachments: [{
              color: severity === 'critical' ? 'danger' : 'warning',
              fields: result.checks
                .filter(c => c.status !== 'pass')
                .map(c => ({
                  title: c.name,
                  value: c.message,
                  short: false
                }))
            }]
          })
        });
      }

      // Example: Send email notification
      // await sendEmail({
      //   to: 'finance-team@reelverse.com',
      //   subject: `Financial Reconciliation ${severity.toUpperCase()}`,
      //   body: this.formatEmailAlert(result)
      // });

    } catch (error) {
      logger.error('Failed to send reconciliation alert', { error: error.message });
    }
  }

  /**
   * Get reconciliation metrics for monitoring dashboard
   */
  async getMetrics(): Promise<{
    lastReconciliation: Date | null;
    totalChecks: number;
    passedChecks: number;
    warningChecks: number;
    failedChecks: number;
    overallStatus: string;
  }> {
    // This would typically be stored in a database or cache
    // For now, return mock data
    return {
      lastReconciliation: new Date(),
      totalChecks: 8,
      passedChecks: 6,
      warningChecks: 2,
      failedChecks: 0,
      overallStatus: 'warning'
    };
  }
}

/**
 * Export singleton instance
 */
export const financialReconciliation = new FinancialReconciliation();