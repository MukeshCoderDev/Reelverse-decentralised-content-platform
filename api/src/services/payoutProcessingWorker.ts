import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Payout Processing Worker
 * 
 * Handles batch processing of payout requests:
 * - Creates daily batches of pending payouts
 * - Processes USDC and bank transfer payouts
 * - Handles transaction confirmations and failures
 * - Implements retry logic for failed payouts
 * - Updates payout statuses and user balances
 * - Integrates with treasury and third-party processors
 * 
 * Designed to run daily via cron job
 */

interface PayoutToBatch {
  id: string;
  user_id: string;
  amount_usdc: number;
  fee_usdc: number;
  net_amount_usdc: number;
  payout_method_id: string;
  method_type: 'usdc_address' | 'bank';
  method_details: any;
  requested_at: Date;
  retry_count: number;
}

interface PayoutBatch {
  id: string;
  processor: string;
  payouts: PayoutToBatch[];
  total_amount_usdc: number;
  total_fees_usdc: number;
}

interface ProcessingStats {
  batchesCreated: number;
  totalPayouts: number;
  usdcPayouts: number;
  bankPayouts: number;
  successfulPayouts: number;
  failedPayouts: number;
  totalAmountProcessed: number;
  errors: string[];
}

export class PayoutProcessingWorker {
  private db: any;
  private stats: ProcessingStats;
  
  constructor() {
    this.db = getDatabase();
    this.resetStats();
  }
  
  private resetStats(): void {
    this.stats = {
      batchesCreated: 0,
      totalPayouts: 0,
      usdcPayouts: 0,
      bankPayouts: 0,
      successfulPayouts: 0,
      failedPayouts: 0,
      totalAmountProcessed: 0,
      errors: []
    };
  }
  
  /**
   * Main worker execution method
   * Run this daily via cron job
   */
  async processPayouts(): Promise<ProcessingStats> {
    const startTime = Date.now();
    this.resetStats();
    
    logger.info('Starting payout processing');
    
    try {
      // 1. Create batches for pending payouts
      const batches = await this.createPayoutBatches();
      
      if (batches.length === 0) {
        logger.info('No payouts to process');
        return this.stats;
      }
      
      // 2. Process each batch
      for (const batch of batches) {
        await this.processBatch(batch);
      }
      
      // 3. Handle failed payouts (retry logic)
      await this.retryFailedPayouts();
      
      // 4. Update batch statuses
      await this.updateBatchStatuses();
      
      const duration = Date.now() - startTime;
      
      logger.info('Payout processing completed', {
        ...this.stats,
        durationMs: duration
      });
      
      return this.stats;
      
    } catch (error) {
      logger.error('Payout processing failed', {
        error: error.message,
        stats: this.stats
      });
      
      this.stats.errors.push(error.message);
      return this.stats;
    }
  }
  
  /**
   * Create payout batches grouped by processor type
   */
  private async createPayoutBatches(): Promise<PayoutBatch[]> {
    const client = await this.db.connect();
    const batches: PayoutBatch[] = [];
    
    try {
      await client.query('BEGIN');
      
      // Create USDC batch
      const usdcBatch = await this.createBatchForProcessor('treasury', 'usdc_address', client);
      if (usdcBatch) {
        batches.push(usdcBatch);
      }
      
      // Create bank transfer batch
      const bankBatch = await this.createBatchForProcessor('third_party', 'bank', client);
      if (bankBatch) {
        batches.push(bankBatch);
      }
      
      await client.query('COMMIT');
      this.stats.batchesCreated = batches.length;
      
      logger.info('Created payout batches', {
        batchCount: batches.length,
        totalPayouts: batches.reduce((sum, b) => sum + b.payouts.length, 0)
      });
      
      return batches;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Create batch for specific processor type
   */
  private async createBatchForProcessor(
    processor: string,
    methodType: string,
    client: any
  ): Promise<PayoutBatch | null> {
    // Get eligible payouts
    const payoutsQuery = await client.query(`
      SELECT 
        p.id, p.user_id, p.amount_usdc, p.fee_usdc, p.net_amount_usdc,
        p.payout_method_id, p.requested_at, p.retry_count,
        pm.type as method_type, pm.details as method_details
      FROM payouts p
      JOIN payout_methods pm ON p.payout_method_id = pm.id
      WHERE p.status = 'requested'
        AND pm.type = $1
        AND pm.verified_at IS NOT NULL
        AND p.requested_at <= NOW() - INTERVAL '10 minutes'
      ORDER BY p.requested_at ASC
      LIMIT 100
    `, [methodType]);
    
    const payouts: PayoutToBatch[] = payoutsQuery.rows;
    
    if (payouts.length === 0) {
      return null;
    }
    
    // Create batch using database function
    const batchQuery = await client.query(`
      SELECT create_payout_batch($1) as batch_id
    `, [processor]);
    
    const batchId = batchQuery.rows[0].batch_id;
    
    // Calculate totals
    const totalAmount = payouts.reduce((sum, p) => sum + p.amount_usdc, 0);
    const totalFees = payouts.reduce((sum, p) => sum + p.fee_usdc, 0);
    
    this.stats.totalPayouts += payouts.length;
    this.stats.totalAmountProcessed += totalAmount;
    
    if (methodType === 'usdc_address') {
      this.stats.usdcPayouts += payouts.length;
    } else {
      this.stats.bankPayouts += payouts.length;
    }
    
    return {
      id: batchId,
      processor,
      payouts,
      total_amount_usdc: totalAmount,
      total_fees_usdc: totalFees
    };
  }
  
  /**
   * Process individual batch
   */
  private async processBatch(batch: PayoutBatch): Promise<void> {
    logger.info('Processing payout batch', {
      batchId: batch.id,
      processor: batch.processor,
      payoutCount: batch.payouts.length,
      totalAmount: batch.total_amount_usdc
    });
    
    try {
      if (batch.processor === 'treasury') {
        await this.processTreasuryBatch(batch);
      } else if (batch.processor === 'third_party') {
        await this.processThirdPartyBatch(batch);
      }
      
    } catch (error) {
      logger.error('Batch processing failed', {
        batchId: batch.id,
        error: error.message
      });
      
      this.stats.errors.push(`Batch ${batch.id}: ${error.message}`);
      
      // Mark batch as failed
      await this.markBatchFailed(batch.id, error.message);
    }
  }
  
  /**
   * Process USDC payouts via treasury
   */
  private async processTreasuryBatch(batch: PayoutBatch): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const payout of batch.payouts) {
        try {
          // Simulate treasury transaction (replace with actual treasury API)
          const txResult = await this.executeTreasuryTransaction(payout);
          
          if (txResult.success) {
            // Mark payout as completed
            await client.query(`
              SELECT complete_payout($1, $2, $3)
            `, [payout.id, txResult.txHash, null]);
            
            this.stats.successfulPayouts++;
            
            logger.info('USDC payout completed', {
              payoutId: payout.id,
              amount: payout.net_amount_usdc,
              txHash: txResult.txHash
            });
            
          } else {
            // Mark payout as failed
            await client.query(`
              SELECT fail_payout($1, $2)
            `, [payout.id, txResult.error]);
            
            this.stats.failedPayouts++;
            
            logger.warn('USDC payout failed', {
              payoutId: payout.id,
              error: txResult.error
            });
          }
          
        } catch (error) {
          // Handle individual payout error
          await client.query(`
            SELECT fail_payout($1, $2)
          `, [payout.id, error.message]);
          
          this.stats.failedPayouts++;
          this.stats.errors.push(`Payout ${payout.id}: ${error.message}`);
        }
      }
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Process bank transfer payouts via third-party
   */
  private async processThirdPartyBatch(batch: PayoutBatch): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Process bank transfers in bulk (simulate third-party API)
      const bulkResult = await this.executeThirdPartyBulkTransfer(batch);
      
      for (let i = 0; i < batch.payouts.length; i++) {
        const payout = batch.payouts[i];
        const result = bulkResult.results[i];
        
        if (result.success) {
          await client.query(`
            SELECT complete_payout($1, $2, $3)
          `, [payout.id, null, result.externalTxId]);
          
          this.stats.successfulPayouts++;
          
        } else {
          await client.query(`
            SELECT fail_payout($1, $2)
          `, [payout.id, result.error]);
          
          this.stats.failedPayouts++;
        }
      }
      
      await client.query('COMMIT');
      
      logger.info('Bank transfer batch processed', {
        batchId: batch.id,
        successful: bulkResult.successCount,
        failed: bulkResult.failureCount
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Simulate treasury USDC transaction
   * Replace with actual treasury API integration
   */
  private async executeTreasuryTransaction(payout: PayoutToBatch): Promise<any> {
    // Simulate transaction processing
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Simulate 95% success rate
    const success = Math.random() < 0.95;
    
    if (success) {
      return {
        success: true,
        txHash: `0x${Math.random().toString(16).substr(2, 64)}`
      };
    } else {
      return {
        success: false,
        error: 'Treasury transaction failed: Insufficient funds'
      };
    }
  }
  
  /**
   * Simulate third-party bulk transfer
   * Replace with actual third-party API integration
   */
  private async executeThirdPartyBulkTransfer(batch: PayoutBatch): Promise<any> {
    // Simulate bulk processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const payout of batch.payouts) {
      const success = Math.random() < 0.92; // 92% success rate for bank transfers
      
      if (success) {
        results.push({
          success: true,
          externalTxId: `BT${Date.now()}${Math.random().toString(36).substr(2, 9)}`
        });
        successCount++;
      } else {
        results.push({
          success: false,
          error: 'Bank transfer failed: Invalid account details'
        });
        failureCount++;
      }
    }
    
    return {
      results,
      successCount,
      failureCount
    };
  }
  
  /**
   * Retry failed payouts that haven't exceeded retry limit
   */
  private async retryFailedPayouts(): Promise<void> {
    try {
      const retryQuery = await this.db.query(`
        UPDATE payouts
        SET 
          status = 'requested',
          processing_started_at = NULL,
          batch_id = NULL,
          updated_at = NOW()
        WHERE status = 'failed'
          AND retry_count < max_retries
          AND requested_at <= NOW() - INTERVAL '1 hour'
        RETURNING id, retry_count
      `);
      
      const retriedPayouts = retryQuery.rows;
      
      if (retriedPayouts.length > 0) {
        logger.info('Retrying failed payouts', {
          count: retriedPayouts.length,
          payoutIds: retriedPayouts.map(p => p.id)
        });
      }
      
    } catch (error) {
      logger.error('Failed to retry failed payouts', {
        error: error.message
      });
    }
  }
  
  /**
   * Update batch statuses based on payout results
   */
  private async updateBatchStatuses(): Promise<void> {
    try {
      await this.db.query(`
        UPDATE payout_batches pb
        SET 
          status = CASE
            WHEN NOT EXISTS(
              SELECT 1 FROM payouts p 
              WHERE p.batch_id = pb.id 
              AND p.status IN ('requested', 'processing')
            ) THEN 'completed'
            ELSE pb.status
          END,
          completed_at = CASE
            WHEN NOT EXISTS(
              SELECT 1 FROM payouts p 
              WHERE p.batch_id = pb.id 
              AND p.status IN ('requested', 'processing')
            ) THEN NOW()
            ELSE pb.completed_at
          END,
          updated_at = NOW()
        WHERE status = 'processing'
      `);
      
    } catch (error) {
      logger.error('Failed to update batch statuses', {
        error: error.message
      });
    }
  }
  
  /**
   * Mark batch as failed
   */
  private async markBatchFailed(batchId: string, reason: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE payout_batches
        SET 
          status = 'failed',
          notes = $2,
          updated_at = NOW()
        WHERE id = $1
      `, [batchId, reason]);
      
    } catch (error) {
      logger.error('Failed to mark batch as failed', {
        batchId,
        error: error.message
      });
    }
  }
  
  /**
   * Get payout processing statistics
   */
  async getPayoutStats(): Promise<any> {
    try {
      const stats = await this.db.query(`
        SELECT 
          COUNT(*) as total_payouts,
          COUNT(*) FILTER (WHERE status = 'requested') as pending_payouts,
          COUNT(*) FILTER (WHERE status = 'processing') as processing_payouts,
          COUNT(*) FILTER (WHERE status = 'paid') as successful_payouts,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_payouts,
          SUM(amount_usdc) FILTER (WHERE status = 'paid') as total_paid_amount,
          AVG(amount_usdc) FILTER (WHERE status = 'paid') as avg_payout_amount,
          COUNT(DISTINCT batch_id) FILTER (WHERE batch_id IS NOT NULL) as total_batches
        FROM payouts
        WHERE requested_at >= NOW() - INTERVAL '30 days'
      `);
      
      const batchStats = await this.db.query(`
        SELECT 
          COUNT(*) as total_batches,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_batches,
          COUNT(*) FILTER (WHERE status = 'processing') as processing_batches,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_batches,
          AVG(total_amount_usdc) as avg_batch_amount
        FROM payout_batches
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `);
      
      return {
        payouts: stats.rows[0],
        batches: batchStats.rows[0]
      };
      
    } catch (error) {
      logger.error('Failed to get payout stats', {
        error: error.message
      });
      
      return null;
    }
  }
}

/**
 * Standalone function for cron job execution
 */
export async function processPayoutsJob(): Promise<ProcessingStats> {
  const worker = new PayoutProcessingWorker();
  return await worker.processPayouts();
}

/**
 * Express route handler for manual processing (admin only)
 */
export async function handlePayoutProcessingRequest(req: any, res: any): Promise<void> {
  try {
    // Check admin authorization
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'UNAUTHORIZED'
      });
    }
    
    const worker = new PayoutProcessingWorker();
    const stats = await worker.processPayouts();
    
    res.json({
      ok: true,
      message: 'Payout processing completed',
      stats
    });
    
  } catch (error) {
    logger.error('Manual payout processing failed', {
      error: error.message
    });
    
    res.status(500).json({
      error: 'Payout processing failed',
      code: 'PAYOUT_PROCESSING_ERROR'
    });
  }
}

/**
 * Get payout statistics endpoint
 */
export async function getPayoutStatsHandler(req: any, res: any): Promise<void> {
  try {
    const worker = new PayoutProcessingWorker();
    const stats = await worker.getPayoutStats();
    
    if (!stats) {
      return res.status(500).json({
        error: 'Failed to retrieve statistics',
        code: 'STATS_ERROR'
      });
    }
    
    res.json({
      payoutStats: {
        totalPayouts: parseInt(stats.payouts.total_payouts),
        pendingPayouts: parseInt(stats.payouts.pending_payouts),
        processingPayouts: parseInt(stats.payouts.processing_payouts),
        successfulPayouts: parseInt(stats.payouts.successful_payouts),
        failedPayouts: parseInt(stats.payouts.failed_payouts),
        totalPaidAmount: parseFloat(stats.payouts.total_paid_amount || 0),
        averagePayoutAmount: parseFloat(stats.payouts.avg_payout_amount || 0),
        totalBatches: parseInt(stats.payouts.total_batches),
        batchStats: {
          totalBatches: parseInt(stats.batches.total_batches),
          completedBatches: parseInt(stats.batches.completed_batches),
          processingBatches: parseInt(stats.batches.processing_batches),
          failedBatches: parseInt(stats.batches.failed_batches),
          averageBatchAmount: parseFloat(stats.batches.avg_batch_amount || 0)
        }
      },
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get payout stats', {
      error: error.message
    });
    
    res.status(500).json({
      error: 'Failed to retrieve payout statistics',
      code: 'STATS_FETCH_ERROR'
    });
  }
}