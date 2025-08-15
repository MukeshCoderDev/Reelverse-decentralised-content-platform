import { ethers } from 'ethers';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';

export interface PayoutMethod {
  id: string;
  creatorWallet: string;
  type: 'usdc' | 'paxum' | 'bank_transfer';
  details: {
    // For USDC
    walletAddress?: string;
    // For Paxum
    paxumEmail?: string;
    // For Bank Transfer
    accountNumber?: string;
    routingNumber?: string;
    bankName?: string;
    accountHolderName?: string;
  };
  isDefault: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayoutRequest {
  id: string;
  creatorWallet: string;
  amount: number;
  currency: 'USDC' | 'USD';
  payoutMethodId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  transactionHash?: string;
  paxumTransactionId?: string;
  failureReason?: string;
  requestedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
}

export interface CreatorBalance {
  creatorWallet: string;
  usdcBalance: number;
  fiatBalance: number;
  pendingUSDC: number;
  pendingFiat: number;
  totalEarnings: number;
  lastPayoutAt?: Date;
  nextPayoutEligible: Date;
}

export interface PayoutStats {
  totalPayouts: number;
  totalAmount: number;
  averageAmount: number;
  successRate: number;
  averageProcessingTime: number; // in hours
  payoutsByMethod: {
    usdc: { count: number; amount: number };
    paxum: { count: number; amount: number };
    bank: { count: number; amount: number };
  };
}

export class PayoutService {
  private readonly MIN_PAYOUT_USDC = 10; // $10 minimum
  private readonly MIN_PAYOUT_FIAT = 50; // $50 minimum
  private readonly PAYOUT_FEE_USDC = 0; // No fee for USDC
  private readonly PAYOUT_FEE_FIAT = 0.05; // 5% fee for fiat

  /**
   * Get creator's current balance
   */
  async getCreatorBalance(creatorWallet: string): Promise<CreatorBalance> {
    const db = getDatabase();
    
    try {
      // Get balance from earnings tracking
      const balanceResult = await db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN currency = 'USDC' AND status = 'available' THEN amount ELSE 0 END), 0) as usdc_balance,
          COALESCE(SUM(CASE WHEN currency = 'USD' AND status = 'available' THEN amount ELSE 0 END), 0) as fiat_balance,
          COALESCE(SUM(CASE WHEN currency = 'USDC' AND status = 'pending' THEN amount ELSE 0 END), 0) as pending_usdc,
          COALESCE(SUM(CASE WHEN currency = 'USD' AND status = 'pending' THEN amount ELSE 0 END), 0) as pending_fiat,
          COALESCE(SUM(amount), 0) as total_earnings
        FROM creator_earnings
        WHERE creator_wallet = $1
      `, [creatorWallet]);
      
      // Get last payout date
      const lastPayoutResult = await db.query(`
        SELECT MAX(completed_at) as last_payout
        FROM payout_requests
        WHERE creator_wallet = $1 AND status = 'completed'
      `, [creatorWallet]);
      
      const balance = balanceResult.rows[0];
      const lastPayout = lastPayoutResult.rows[0]?.last_payout;
      
      // Calculate next payout eligibility (24 hours after last payout)
      const nextPayoutEligible = lastPayout 
        ? new Date(new Date(lastPayout).getTime() + 24 * 60 * 60 * 1000)
        : new Date();
      
      return {
        creatorWallet,
        usdcBalance: parseFloat(balance.usdc_balance),
        fiatBalance: parseFloat(balance.fiat_balance),
        pendingUSDC: parseFloat(balance.pending_usdc),
        pendingFiat: parseFloat(balance.pending_fiat),
        totalEarnings: parseFloat(balance.total_earnings),
        lastPayoutAt: lastPayout ? new Date(lastPayout) : undefined,
        nextPayoutEligible
      };
    } catch (error) {
      logger.error('Failed to get creator balance:', error);
      throw error;
    }
  }

  /**
   * Add or update payout method
   */
  async addPayoutMethod(
    creatorWallet: string,
    type: 'usdc' | 'paxum' | 'bank_transfer',
    details: PayoutMethod['details'],
    isDefault: boolean = false
  ): Promise<PayoutMethod> {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      const methodId = `${type}_${Date.now()}`;
      
      // If this is set as default, unset other defaults
      if (isDefault) {
        await client.query(`
          UPDATE payout_methods
          SET is_default = FALSE
          WHERE creator_wallet = $1
        `, [creatorWallet]);
      }
      
      // Insert new payout method
      await client.query(`
        INSERT INTO payout_methods (
          id, creator_wallet, type, details, is_default, is_verified, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, [methodId, creatorWallet, type, JSON.stringify(details), isDefault, false]);
      
      // Log audit trail
      await client.query(`
        INSERT INTO audit_logs (event_type, user_wallet, event_data)
        VALUES ('payout_method_added', $1, $2)
      `, [
        creatorWallet,
        JSON.stringify({
          method_id: methodId,
          type: type,
          is_default: isDefault
        })
      ]);
      
      await client.query('COMMIT');
      
      const payoutMethod: PayoutMethod = {
        id: methodId,
        creatorWallet,
        type,
        details,
        isDefault,
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      logger.info(`Payout method added: ${methodId} for ${creatorWallet}`);
      return payoutMethod;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to add payout method:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get creator's payout methods
   */
  async getPayoutMethods(creatorWallet: string): Promise<PayoutMethod[]> {
    const db = getDatabase();
    
    try {
      const result = await db.query(`
        SELECT id, creator_wallet, type, details, is_default, is_verified, created_at, updated_at
        FROM payout_methods
        WHERE creator_wallet = $1
        ORDER BY is_default DESC, created_at DESC
      `, [creatorWallet]);
      
      return result.rows.map(row => ({
        id: row.id,
        creatorWallet: row.creator_wallet,
        type: row.type,
        details: row.details,
        isDefault: row.is_default,
        isVerified: row.is_verified,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      logger.error('Failed to get payout methods:', error);
      throw error;
    }
  }

  /**
   * Request USDC payout (instant)
   */
  async requestUSDCPayout(
    creatorWallet: string,
    amount: number,
    payoutMethodId?: string
  ): Promise<PayoutRequest> {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Validate minimum amount
      if (amount < this.MIN_PAYOUT_USDC) {
        throw new Error(`Minimum USDC payout is $${this.MIN_PAYOUT_USDC}`);
      }
      
      // Check balance
      const balance = await this.getCreatorBalance(creatorWallet);
      if (balance.usdcBalance < amount) {
        throw new Error('Insufficient USDC balance');
      }
      
      // Get payout method
      let payoutMethod: PayoutMethod | null = null;
      if (payoutMethodId) {
        const methodResult = await client.query(`
          SELECT * FROM payout_methods WHERE id = $1 AND creator_wallet = $2
        `, [payoutMethodId, creatorWallet]);
        
        if (methodResult.rows.length === 0) {
          throw new Error('Payout method not found');
        }
        payoutMethod = methodResult.rows[0];
      } else {
        // Use default USDC method or creator's wallet
        const defaultResult = await client.query(`
          SELECT * FROM payout_methods 
          WHERE creator_wallet = $1 AND type = 'usdc' AND is_default = TRUE
        `, [creatorWallet]);
        
        if (defaultResult.rows.length > 0) {
          payoutMethod = defaultResult.rows[0];
        }
      }
      
      const requestId = `usdc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create payout request
      await client.query(`
        INSERT INTO payout_requests (
          id, creator_wallet, amount, currency, payout_method_id, status, requested_at
        ) VALUES ($1, $2, $3, 'USDC', $4, 'processing', NOW())
      `, [requestId, creatorWallet, amount, payoutMethod?.id || 'wallet']);
      
      // Deduct from available balance
      await client.query(`
        UPDATE creator_earnings
        SET amount = amount - $2
        WHERE creator_wallet = $1 AND currency = 'USDC' AND status = 'available'
        AND amount >= $2
      `, [creatorWallet, amount]);
      
      // Process instant USDC transfer (simplified - would integrate with actual blockchain)
      const targetAddress = payoutMethod?.details.walletAddress || creatorWallet;
      const transactionHash = await this.processUSDCTransfer(targetAddress, amount);
      
      // Update request as completed
      await client.query(`
        UPDATE payout_requests
        SET status = 'completed', transaction_hash = $2, processed_at = NOW(), completed_at = NOW()
        WHERE id = $1
      `, [requestId, transactionHash]);
      
      // Log audit trail
      await client.query(`
        INSERT INTO audit_logs (event_type, user_wallet, event_data)
        VALUES ('usdc_payout_completed', $1, $2)
      `, [
        creatorWallet,
        JSON.stringify({
          request_id: requestId,
          amount: amount,
          transaction_hash: transactionHash,
          target_address: targetAddress
        })
      ]);
      
      await client.query('COMMIT');
      
      const payoutRequest: PayoutRequest = {
        id: requestId,
        creatorWallet,
        amount,
        currency: 'USDC',
        payoutMethodId: payoutMethod?.id || 'wallet',
        status: 'completed',
        transactionHash,
        requestedAt: new Date(),
        processedAt: new Date(),
        completedAt: new Date()
      };
      
      logger.info(`USDC payout completed: ${requestId} for ${creatorWallet}, amount: ${amount}`);
      return payoutRequest;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to process USDC payout:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Request fiat payout via Paxum
   */
  async requestFiatPayout(
    creatorWallet: string,
    amount: number,
    payoutMethodId: string
  ): Promise<PayoutRequest> {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Validate minimum amount
      if (amount < this.MIN_PAYOUT_FIAT) {
        throw new Error(`Minimum fiat payout is $${this.MIN_PAYOUT_FIAT}`);
      }
      
      // Check balance
      const balance = await this.getCreatorBalance(creatorWallet);
      const netAmount = amount * (1 - this.PAYOUT_FEE_FIAT);
      
      if (balance.fiatBalance < amount) {
        throw new Error('Insufficient fiat balance');
      }
      
      // Get payout method
      const methodResult = await client.query(`
        SELECT * FROM payout_methods WHERE id = $1 AND creator_wallet = $2
      `, [payoutMethodId, creatorWallet]);
      
      if (methodResult.rows.length === 0) {
        throw new Error('Payout method not found');
      }
      
      const payoutMethod = methodResult.rows[0];
      
      if (!['paxum', 'bank_transfer'].includes(payoutMethod.type)) {
        throw new Error('Invalid payout method for fiat transfer');
      }
      
      const requestId = `fiat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create payout request
      await client.query(`
        INSERT INTO payout_requests (
          id, creator_wallet, amount, currency, payout_method_id, status, requested_at
        ) VALUES ($1, $2, $3, 'USD', $4, 'processing', NOW())
      `, [requestId, creatorWallet, netAmount, payoutMethodId]);
      
      // Deduct from available balance
      await client.query(`
        UPDATE creator_earnings
        SET amount = amount - $2
        WHERE creator_wallet = $1 AND currency = 'USD' AND status = 'available'
        AND amount >= $2
      `, [creatorWallet, amount]);
      
      // Process fiat transfer (would integrate with Paxum API)
      let paxumTransactionId: string | undefined;
      
      if (payoutMethod.type === 'paxum') {
        paxumTransactionId = await this.processPaxumTransfer(
          payoutMethod.details.paxumEmail!,
          netAmount
        );
      } else {
        // Bank transfer processing would go here
        paxumTransactionId = `bank_${Date.now()}`;
      }
      
      // Update request as completed
      await client.query(`
        UPDATE payout_requests
        SET status = 'completed', paxum_transaction_id = $2, processed_at = NOW(), completed_at = NOW()
        WHERE id = $1
      `, [requestId, paxumTransactionId]);
      
      // Log audit trail
      await client.query(`
        INSERT INTO audit_logs (event_type, user_wallet, event_data)
        VALUES ('fiat_payout_completed', $1, $2)
      `, [
        creatorWallet,
        JSON.stringify({
          request_id: requestId,
          amount: netAmount,
          fee: amount - netAmount,
          paxum_transaction_id: paxumTransactionId,
          method_type: payoutMethod.type
        })
      ]);
      
      await client.query('COMMIT');
      
      const payoutRequest: PayoutRequest = {
        id: requestId,
        creatorWallet,
        amount: netAmount,
        currency: 'USD',
        payoutMethodId,
        status: 'completed',
        paxumTransactionId,
        requestedAt: new Date(),
        processedAt: new Date(),
        completedAt: new Date()
      };
      
      logger.info(`Fiat payout completed: ${requestId} for ${creatorWallet}, amount: ${netAmount}`);
      return payoutRequest;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to process fiat payout:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get payout history for creator
   */
  async getPayoutHistory(
    creatorWallet: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PayoutRequest[]> {
    const db = getDatabase();
    
    try {
      const result = await db.query(`
        SELECT 
          id, creator_wallet, amount, currency, payout_method_id, status,
          transaction_hash, paxum_transaction_id, failure_reason,
          requested_at, processed_at, completed_at
        FROM payout_requests
        WHERE creator_wallet = $1
        ORDER BY requested_at DESC
        LIMIT $2 OFFSET $3
      `, [creatorWallet, limit, offset]);
      
      return result.rows.map(row => ({
        id: row.id,
        creatorWallet: row.creator_wallet,
        amount: parseFloat(row.amount),
        currency: row.currency,
        payoutMethodId: row.payout_method_id,
        status: row.status,
        transactionHash: row.transaction_hash,
        paxumTransactionId: row.paxum_transaction_id,
        failureReason: row.failure_reason,
        requestedAt: row.requested_at,
        processedAt: row.processed_at,
        completedAt: row.completed_at
      }));
    } catch (error) {
      logger.error('Failed to get payout history:', error);
      throw error;
    }
  }

  /**
   * Get payout statistics
   */
  async getPayoutStats(timeframe: 'day' | 'week' | 'month' = 'month'): Promise<PayoutStats> {
    const db = getDatabase();
    
    try {
      let timeCondition = '';
      switch (timeframe) {
        case 'day':
          timeCondition = "completed_at >= NOW() - INTERVAL '1 day'";
          break;
        case 'week':
          timeCondition = "completed_at >= NOW() - INTERVAL '1 week'";
          break;
        case 'month':
          timeCondition = "completed_at >= NOW() - INTERVAL '1 month'";
          break;
      }
      
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total_payouts,
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(AVG(amount), 0) as average_amount,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::FLOAT / COUNT(*) as success_rate,
          AVG(EXTRACT(EPOCH FROM (completed_at - requested_at))/3600) as avg_processing_hours
        FROM payout_requests
        WHERE ${timeCondition}
      `);
      
      const methodStatsResult = await db.query(`
        SELECT 
          pm.type,
          COUNT(pr.*) as count,
          COALESCE(SUM(pr.amount), 0) as amount
        FROM payout_requests pr
        JOIN payout_methods pm ON pr.payout_method_id = pm.id
        WHERE ${timeCondition}
        GROUP BY pm.type
      `);
      
      const stats = statsResult.rows[0];
      const methodStats = methodStatsResult.rows;
      
      const payoutsByMethod = {
        usdc: { count: 0, amount: 0 },
        paxum: { count: 0, amount: 0 },
        bank: { count: 0, amount: 0 }
      };
      
      methodStats.forEach(row => {
        if (row.type === 'usdc') {
          payoutsByMethod.usdc = { count: parseInt(row.count), amount: parseFloat(row.amount) };
        } else if (row.type === 'paxum') {
          payoutsByMethod.paxum = { count: parseInt(row.count), amount: parseFloat(row.amount) };
        } else if (row.type === 'bank_transfer') {
          payoutsByMethod.bank = { count: parseInt(row.count), amount: parseFloat(row.amount) };
        }
      });
      
      return {
        totalPayouts: parseInt(stats.total_payouts),
        totalAmount: parseFloat(stats.total_amount),
        averageAmount: parseFloat(stats.average_amount),
        successRate: parseFloat(stats.success_rate),
        averageProcessingTime: parseFloat(stats.avg_processing_hours) || 0,
        payoutsByMethod
      };
    } catch (error) {
      logger.error('Failed to get payout stats:', error);
      throw error;
    }
  }

  /**
   * Process USDC transfer (simplified implementation)
   */
  private async processUSDCTransfer(targetAddress: string, amount: number): Promise<string> {
    // This is a simplified implementation
    // In production, this would integrate with actual blockchain transactions
    
    try {
      // Simulate blockchain transaction
      const transactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;
      
      // In real implementation:
      // 1. Create USDC transfer transaction
      // 2. Sign with platform wallet
      // 3. Broadcast to network
      // 4. Wait for confirmation
      
      logger.info(`USDC transfer simulated: ${amount} USDC to ${targetAddress}, tx: ${transactionHash}`);
      return transactionHash;
    } catch (error) {
      logger.error('USDC transfer failed:', error);
      throw new Error('USDC transfer failed');
    }
  }

  /**
   * Process Paxum transfer (simplified implementation)
   */
  private async processPaxumTransfer(paxumEmail: string, amount: number): Promise<string> {
    // This is a simplified implementation
    // In production, this would integrate with Paxum API
    
    try {
      // Simulate Paxum API call
      const transactionId = `PX${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      // In real implementation:
      // 1. Call Paxum API to initiate transfer
      // 2. Handle API response and errors
      // 3. Store transaction reference
      // 4. Handle webhooks for status updates
      
      logger.info(`Paxum transfer simulated: $${amount} to ${paxumEmail}, ref: ${transactionId}`);
      return transactionId;
    } catch (error) {
      logger.error('Paxum transfer failed:', error);
      throw new Error('Paxum transfer failed');
    }
  }
}

// Export singleton instance
export const payoutService = new PayoutService();