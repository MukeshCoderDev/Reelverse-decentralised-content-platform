import { financialReconciliation } from '../services/financialReconciliation';
import { logger } from '../utils/logger';

/**
 * Financial Reconciliation Scheduler
 * Runs daily reconciliation checks and sends alerts if issues are detected
 */
export class ReconciliationScheduler {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the scheduler to run reconciliation daily at 2 AM UTC
   */
  start() {
    if (this.isRunning) {
      logger.warn('Reconciliation scheduler is already running');
      return;
    }

    // Calculate time until next 2 AM UTC
    const now = new Date();
    const next2AM = new Date();
    next2AM.setUTCHours(2, 0, 0, 0);
    
    // If it's already past 2 AM today, schedule for tomorrow
    if (now.getTime() > next2AM.getTime()) {
      next2AM.setUTCDate(next2AM.getUTCDate() + 1);
    }
    
    const initialDelay = next2AM.getTime() - now.getTime();
    
    logger.info('Starting financial reconciliation scheduler', {
      nextRun: next2AM.toISOString(),
      initialDelayMs: initialDelay
    });

    // Schedule the first run
    setTimeout(() => {
      this.runReconciliation();
      
      // Then run every 24 hours
      this.interval = setInterval(() => {
        this.runReconciliation();
      }, 24 * 60 * 60 * 1000); // 24 hours
      
    }, initialDelay);

    this.isRunning = true;
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    logger.info('Financial reconciliation scheduler stopped');
  }

  /**
   * Run reconciliation manually
   */
  async runReconciliation() {
    try {
      logger.info('Starting scheduled financial reconciliation');
      
      const result = await financialReconciliation.runReconciliation();
      
      logger.info('Scheduled financial reconciliation completed', {
        status: result.status,
        totalIssues: result.totalIssues,
        criticalIssues: result.criticalIssues,
        checks: result.checks.length
      });

      // Update last run metrics
      this.updateMetrics(result);

    } catch (error) {
      logger.error('Scheduled financial reconciliation failed', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Update Prometheus metrics for monitoring
   */
  private updateMetrics(result: any) {
    // This would integrate with your metrics system
    // Example with prometheus-client:
    // reconciliationRunsTotal.inc({ status: result.status });
    // reconciliationIssuesTotal.set(result.totalIssues);
    // reconciliationCriticalIssuesTotal.set(result.criticalIssues);
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.interval ? 'Scheduled' : 'Not scheduled'
    };
  }
}

/**
 * Export singleton instance
 */
export const reconciliationScheduler = new ReconciliationScheduler();

/**
 * Express endpoint to trigger manual reconciliation
 */
export async function manualReconciliationHandler(req: any, res: any) {
  try {
    logger.info('Manual financial reconciliation triggered', {
      userId: req.userId,
      ip: req.ip
    });
    
    const result = await financialReconciliation.runReconciliation();
    
    res.json({
      success: true,
      result: {
        timestamp: result.timestamp,
        status: result.status,
        totalIssues: result.totalIssues,
        criticalIssues: result.criticalIssues,
        checks: result.checks.map(c => ({
          name: c.name,
          status: c.status,
          message: c.message,
          affectedRecords: c.affectedRecords
        }))
      }
    });
    
  } catch (error) {
    logger.error('Manual financial reconciliation failed', {
      error: error.message,
      userId: req.userId
    });
    
    res.status(500).json({
      error: 'Failed to run reconciliation',
      code: 'RECONCILIATION_ERROR'
    });
  }
}

/**
 * Express endpoint to get reconciliation metrics
 */
export async function reconciliationMetricsHandler(req: any, res: any) {
  try {
    const metrics = await financialReconciliation.getMetrics();
    const schedulerStatus = reconciliationScheduler.getStatus();
    
    res.json({
      reconciliation: metrics,
      scheduler: schedulerStatus,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get reconciliation metrics', {
      error: error.message
    });
    
    res.status(500).json({
      error: 'Failed to get metrics',
      code: 'METRICS_ERROR'
    });
  }
}