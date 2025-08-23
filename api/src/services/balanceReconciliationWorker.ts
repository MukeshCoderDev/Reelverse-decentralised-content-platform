import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Balance Reconciliation Worker
 * 
 * Performs nightly reconciliation to ensure data integrity:
 * - Recomputes user balances from earnings ledger
 * - Compares computed vs stored balances
 * - Detects and reports discrepancies
 * - Refreshes materialized views
 * - Validates earnings ledger consistency
 * - Generates reconciliation reports
 * - Alerts on significant drift
 * 
 * Designed to run nightly via cron job
 */

interface UserBalanceDiscrepancy {
  user_id: string;
  stored_total_earned: number;
  computed_total_earned: number;
  stored_today_earned: number;
  computed_today_earned: number;
  stored_pending: number;
  computed_pending: number;
  stored_available: number;
  computed_available: number;
  drift_amount: number;
  drift_percentage: number;
}

interface LedgerInconsistency {
  id: string;
  user_id: string;
  issue_type: string;
  description: string;
  gross_usdc: number;
  fee_usdc: number;
  net_usdc: number;
  created_at: Date;
}

interface ReconciliationStats {
  totalUsersProcessed: number;
  usersWithDiscrepancies: number;
  totalDriftAmount: number;
  maxDriftAmount: number;
  ledgerInconsistencies: number;
  materialized_views_refreshed: number;
  alerts_generated: number;
  processing_time_ms: number;
  errors: string[];
}

export class BalanceReconciliationWorker {
  private db: any;
  private stats: ReconciliationStats;
  private readonly DRIFT_THRESHOLD_USDC = 0.05; // Alert if drift > $0.05
  private readonly DRIFT_PERCENTAGE_THRESHOLD = 1.0; // Alert if drift > 1%
  
  constructor() {
    this.db = getDatabase();
    this.resetStats();
  }
  
  private resetStats(): void {
    this.stats = {
      totalUsersProcessed: 0,
      usersWithDiscrepancies: 0,
      totalDriftAmount: 0,
      maxDriftAmount: 0,
      ledgerInconsistencies: 0,
      materialized_views_refreshed: 0,
      alerts_generated: 0,
      processing_time_ms: 0,
      errors: []
    };
  }
  
  /**
   * Main reconciliation execution method
   * Run this nightly via cron job
   */
  async reconcileBalances(): Promise<ReconciliationStats> {
    const startTime = Date.now();
    this.resetStats();
    
    logger.info('Starting balance reconciliation');
    
    try {
      // 1. Refresh materialized views first
      await this.refreshMaterializedViews();
      
      // 2. Validate earnings ledger consistency
      await this.validateLedgerConsistency();
      
      // 3. Reconcile user balances
      const discrepancies = await this.reconcileUserBalances();
      
      // 4. Generate reconciliation report
      await this.generateReconciliationReport(discrepancies);
      
      // 5. Send alerts for significant discrepancies
      await this.processAlerts(discrepancies);
      
      this.stats.processing_time_ms = Date.now() - startTime;
      
      logger.info('Balance reconciliation completed', this.stats);
      
      return this.stats;
      
    } catch (error) {
      this.stats.processing_time_ms = Date.now() - startTime;
      
      logger.error('Balance reconciliation failed', {
        error: error.message,
        stats: this.stats
      });
      
      this.stats.errors.push(error.message);
      return this.stats;
    }
  }
  
  /**
   * Refresh materialized views for accurate balance calculations
   */
  private async refreshMaterializedViews(): Promise<void> {
    try {
      logger.info('Refreshing materialized views');
      
      // Refresh user_balances materialized view
      await this.db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY user_balances');
      
      this.stats.materialized_views_refreshed++;
      
      logger.info('Materialized views refreshed successfully');
      
    } catch (error) {
      // If concurrent refresh fails, try regular refresh
      logger.warn('Concurrent refresh failed, trying regular refresh', {
        error: error.message
      });
      
      try {
        await this.db.query('REFRESH MATERIALIZED VIEW user_balances');
        this.stats.materialized_views_refreshed++;
      } catch (regularError) {
        logger.error('Regular refresh also failed', {
          error: regularError.message
        });
        
        this.stats.errors.push(`Materialized view refresh failed: ${regularError.message}`);
      }
    }
  }
  
  /**
   * Validate earnings ledger consistency
   */
  private async validateLedgerConsistency(): Promise<void> {
    logger.info('Validating earnings ledger consistency');
    
    const inconsistencies: LedgerInconsistency[] = [];
    
    try {
      // Check for arithmetic inconsistencies
      const arithmeticQuery = await this.db.query(`
        SELECT 
          id, user_id, gross_usdc, fee_usdc, net_usdc, created_at,
          'arithmetic_mismatch' as issue_type,
          'gross_usdc - fee_usdc != net_usdc' as description
        FROM earnings_ledger
        WHERE ABS((gross_usdc - fee_usdc) - net_usdc) > 0.000001
          AND created_at >= NOW() - INTERVAL '7 days'
        LIMIT 100
      `);
      
      inconsistencies.push(...arithmeticQuery.rows);
      
      // Check for negative values
      const negativeQuery = await this.db.query(`
        SELECT 
          id, user_id, gross_usdc, fee_usdc, net_usdc, created_at,
          'negative_values' as issue_type,
          'negative amounts detected' as description
        FROM earnings_ledger
        WHERE (gross_usdc < 0 OR fee_usdc < 0 OR net_usdc < 0)
          AND created_at >= NOW() - INTERVAL '7 days'
        LIMIT 100
      `);
      
      inconsistencies.push(...negativeQuery.rows);
      
      // Check for orphaned split entries
      const orphanedQuery = await this.db.query(`
        SELECT 
          id, user_id, gross_usdc, fee_usdc, net_usdc, created_at,
          'orphaned_split' as issue_type,
          'split entry without valid parent' as description
        FROM earnings_ledger
        WHERE source = 'split'
          AND parent_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM earnings_ledger parent 
            WHERE parent.id = earnings_ledger.parent_id
          )
          AND created_at >= NOW() - INTERVAL '7 days'
        LIMIT 100
      `);
      
      inconsistencies.push(...orphanedQuery.rows);
      
      // Check for missing idempotency keys on recent entries
      const missingIdempotencyQuery = await this.db.query(`
        SELECT 
          id, user_id, gross_usdc, fee_usdc, net_usdc, created_at,
          'missing_idempotency' as issue_type,
          'recent entry missing idempotency key' as description
        FROM earnings_ledger
        WHERE idempotency_key IS NULL
          AND source IN ('tip', 'subscription')
          AND created_at >= NOW() - INTERVAL '1 day'
        LIMIT 50
      `);
      
      inconsistencies.push(...missingIdempotencyQuery.rows);
      
      this.stats.ledgerInconsistencies = inconsistencies.length;
      
      if (inconsistencies.length > 0) {
        logger.warn('Earnings ledger inconsistencies detected', {
          count: inconsistencies.length,
          types: [...new Set(inconsistencies.map(i => i.issue_type))]
        });
        
        // Log first few inconsistencies for debugging
        inconsistencies.slice(0, 5).forEach(inconsistency => {
          logger.warn('Ledger inconsistency detected', {
            id: inconsistency.id,
            userId: inconsistency.user_id,
            issueType: inconsistency.issue_type,
            description: inconsistency.description,
            amounts: {
              gross: inconsistency.gross_usdc,
              fee: inconsistency.fee_usdc,
              net: inconsistency.net_usdc
            }
          });
        });
      }
      
    } catch (error) {
      logger.error('Ledger consistency validation failed', {
        error: error.message
      });
      
      this.stats.errors.push(`Ledger validation failed: ${error.message}`);
    }
  }
  
  /**
   * Reconcile user balances by recomputing from ledger
   */
  private async reconcileUserBalances(): Promise<UserBalanceDiscrepancy[]> {
    logger.info('Reconciling user balances');
    
    const discrepancies: UserBalanceDiscrepancy[] = [];
    
    try {
      // Get users with earnings to reconcile
      const usersQuery = await this.db.query(`
        SELECT DISTINCT user_id
        FROM earnings_ledger
        WHERE created_at >= NOW() - INTERVAL '90 days'
        ORDER BY user_id
        LIMIT 10000
      `);
      
      const userIds = usersQuery.rows.map(row => row.user_id);
      this.stats.totalUsersProcessed = userIds.length;
      
      if (userIds.length === 0) {
        logger.info('No users with recent earnings to reconcile');
        return [];
      }
      
      // Process users in batches to avoid memory issues
      const batchSize = 100;
      
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const batchDiscrepancies = await this.reconcileBatch(batch);
        discrepancies.push(...batchDiscrepancies);
      }
      
      this.stats.usersWithDiscrepancies = discrepancies.length;
      this.stats.totalDriftAmount = discrepancies.reduce(
        (sum, d) => sum + Math.abs(d.drift_amount), 0
      );
      this.stats.maxDriftAmount = Math.max(
        ...discrepancies.map(d => Math.abs(d.drift_amount)), 0
      );
      
      logger.info('User balance reconciliation completed', {
        totalUsers: this.stats.totalUsersProcessed,
        usersWithDiscrepancies: this.stats.usersWithDiscrepancies,
        totalDrift: this.stats.totalDriftAmount,
        maxDrift: this.stats.maxDriftAmount
      });
      
      return discrepancies;
      
    } catch (error) {
      logger.error('User balance reconciliation failed', {
        error: error.message
      });
      
      this.stats.errors.push(`Balance reconciliation failed: ${error.message}`);
      return discrepancies;
    }
  }
  
  /**
   * Reconcile a batch of users
   */
  private async reconcileBatch(userIds: string[]): Promise<UserBalanceDiscrepancy[]> {
    const discrepancies: UserBalanceDiscrepancy[] = [];
    
    try {
      // Get stored balances
      const storedQuery = await this.db.query(`
        SELECT 
          user_id,
          total_earned_usdc,
          today_usdc,
          pending_usdc,
          available_usdc
        FROM user_balances
        WHERE user_id = ANY($1)
      `, [userIds]);
      
      const storedBalances = new Map(
        storedQuery.rows.map(row => [row.user_id, row])
      );
      
      // Recompute balances from ledger
      const computedQuery = await this.db.query(`
        SELECT 
          user_id,
          SUM(net_usdc) as total_earned_usdc,
          SUM(CASE WHEN created_at >= CURRENT_DATE THEN net_usdc ELSE 0 END) as today_usdc,
          SUM(CASE WHEN created_at >= NOW() - INTERVAL '72 hours' THEN net_usdc ELSE 0 END) as pending_usdc,
          SUM(CASE WHEN created_at < NOW() - INTERVAL '72 hours' THEN net_usdc ELSE 0 END) as available_usdc
        FROM earnings_ledger
        WHERE user_id = ANY($1)
          AND error_code IS NULL
        GROUP BY user_id
      `, [userIds]);
      
      const computedBalances = new Map(
        computedQuery.rows.map(row => [row.user_id, row])
      );
      
      // Compare stored vs computed
      for (const userId of userIds) {
        const stored = storedBalances.get(userId);
        const computed = computedBalances.get(userId);
        
        if (!stored && !computed) {
          continue; // No balances for this user
        }
        
        const storedTotal = stored ? parseFloat(stored.total_earned_usdc) : 0;
        const computedTotal = computed ? parseFloat(computed.total_earned_usdc) : 0;
        const drift = Math.abs(storedTotal - computedTotal);
        
        if (drift > this.DRIFT_THRESHOLD_USDC) {
          const driftPercentage = storedTotal > 0 ? (drift / storedTotal) * 100 : 100;
          
          discrepancies.push({
            user_id: userId,
            stored_total_earned: storedTotal,
            computed_total_earned: computedTotal,
            stored_today_earned: stored ? parseFloat(stored.today_usdc) : 0,
            computed_today_earned: computed ? parseFloat(computed.today_usdc) : 0,
            stored_pending: stored ? parseFloat(stored.pending_usdc) : 0,
            computed_pending: computed ? parseFloat(computed.pending_usdc) : 0,
            stored_available: stored ? parseFloat(stored.available_usdc) : 0,
            computed_available: computed ? parseFloat(computed.available_usdc) : 0,
            drift_amount: computedTotal - storedTotal,
            drift_percentage: driftPercentage
          });
        }
      }
      
    } catch (error) {
      logger.error('Batch reconciliation failed', {
        error: error.message,
        batchSize: userIds.length
      });
      
      this.stats.errors.push(`Batch reconciliation failed: ${error.message}`);
    }
    
    return discrepancies;
  }
  
  /**
   * Generate reconciliation report
   */
  private async generateReconciliationReport(
    discrepancies: UserBalanceDiscrepancy[]
  ): Promise<void> {
    try {
      const reportData = {
        reconciliation_date: new Date().toISOString(),
        stats: this.stats,
        discrepancies: discrepancies.slice(0, 100), // Limit for storage
        summary: {
          users_processed: this.stats.totalUsersProcessed,
          discrepancies_found: discrepancies.length,
          total_drift_amount: this.stats.totalDriftAmount,
          max_drift_amount: this.stats.maxDriftAmount,
          avg_drift_amount: discrepancies.length > 0 ? 
            this.stats.totalDriftAmount / discrepancies.length : 0,
          significant_discrepancies: discrepancies.filter(
            d => Math.abs(d.drift_amount) > 1.00
          ).length
        }
      };
      
      // Store report in database
      await this.db.query(`
        INSERT INTO reconciliation_reports (
          report_date, report_data, discrepancies_count, total_drift_amount
        ) VALUES ($1, $2, $3, $4)
      `, [
        new Date(),
        JSON.stringify(reportData),
        discrepancies.length,
        this.stats.totalDriftAmount
      ]);
      
      logger.info('Reconciliation report generated', {
        discrepanciesCount: discrepancies.length,
        totalDrift: this.stats.totalDriftAmount
      });
      
    } catch (error) {
      logger.error('Failed to generate reconciliation report', {
        error: error.message
      });
      
      this.stats.errors.push(`Report generation failed: ${error.message}`);
    }
  }
  
  /**
   * Process alerts for significant discrepancies
   */
  private async processAlerts(discrepancies: UserBalanceDiscrepancy[]): Promise<void> {
    const significantDiscrepancies = discrepancies.filter(
      d => Math.abs(d.drift_amount) > this.DRIFT_THRESHOLD_USDC ||
           d.drift_percentage > this.DRIFT_PERCENTAGE_THRESHOLD
    );
    
    if (significantDiscrepancies.length === 0) {
      logger.info('No significant discrepancies requiring alerts');
      return;
    }
    
    this.stats.alerts_generated = significantDiscrepancies.length;
    
    // Log critical discrepancies
    significantDiscrepancies.slice(0, 10).forEach(discrepancy => {
      logger.error('Significant balance discrepancy detected', {
        userId: discrepancy.user_id,
        driftAmount: discrepancy.drift_amount,
        driftPercentage: discrepancy.drift_percentage,
        storedTotal: discrepancy.stored_total_earned,
        computedTotal: discrepancy.computed_total_earned
      });
    });
    
    // TODO: Integrate with alerting system (Slack, PagerDuty, etc.)
    // Example:
    // await this.sendAlert({
    //   type: 'balance_discrepancy',
    //   severity: 'high',
    //   count: significantDiscrepancies.length,
    //   maxDrift: this.stats.maxDriftAmount
    // });
  }
  
  /**
   * Get reconciliation statistics
   */
  async getReconciliationHistory(): Promise<any> {
    try {
      const historyQuery = await this.db.query(`
        SELECT 
          report_date,
          discrepancies_count,
          total_drift_amount,
          report_data->>'processing_time_ms' as processing_time_ms
        FROM reconciliation_reports
        ORDER BY report_date DESC
        LIMIT 30
      `);
      
      return historyQuery.rows.map(row => ({
        date: row.report_date,
        discrepancies: parseInt(row.discrepancies_count),
        totalDrift: parseFloat(row.total_drift_amount),
        processingTimeMs: parseInt(row.processing_time_ms || 0)
      }));
      
    } catch (error) {
      logger.error('Failed to get reconciliation history', {
        error: error.message
      });
      
      return [];
    }
  }
}

/**
 * Standalone function for cron job execution
 */
export async function reconcileBalancesJob(): Promise<ReconciliationStats> {
  const worker = new BalanceReconciliationWorker();
  return await worker.reconcileBalances();
}

/**
 * Express route handler for manual reconciliation (admin only)
 */
export async function handleReconciliationRequest(req: any, res: any): Promise<void> {
  try {
    // Check admin authorization
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'UNAUTHORIZED'
      });
    }
    
    const worker = new BalanceReconciliationWorker();
    const stats = await worker.reconcileBalances();
    
    res.json({
      ok: true,
      message: 'Balance reconciliation completed',
      stats
    });
    
  } catch (error) {
    logger.error('Manual balance reconciliation failed', {
      error: error.message
    });
    
    res.status(500).json({
      error: 'Balance reconciliation failed',
      code: 'RECONCILIATION_ERROR'
    });
  }
}

/**
 * Get reconciliation history endpoint
 */
export async function getReconciliationHistoryHandler(req: any, res: any): Promise<void> {
  try {
    const worker = new BalanceReconciliationWorker();
    const history = await worker.getReconciliationHistory();
    
    res.json({
      reconciliationHistory: history,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get reconciliation history', {
      error: error.message
    });
    
    res.status(500).json({
      error: 'Failed to retrieve reconciliation history',
      code: 'HISTORY_FETCH_ERROR'
    });
  }
}

// Add reconciliation_reports table migration if not exists
export const RECONCILIATION_REPORTS_MIGRATION = `
CREATE TABLE IF NOT EXISTS reconciliation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  report_data JSONB NOT NULL,
  discrepancies_count INTEGER NOT NULL DEFAULT 0,
  total_drift_amount NUMERIC(20,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_reports_date ON reconciliation_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_reconciliation_reports_discrepancies ON reconciliation_reports(discrepancies_count);
`;