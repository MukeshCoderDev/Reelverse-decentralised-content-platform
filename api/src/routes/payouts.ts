import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../config/database';
import { authenticateUser } from '../middleware/auth';
import { validateIdempotency } from '../middleware/idempotency';
import { rateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const CreatePayoutMethodSchema = z.object({
  type: z.enum(['usdc_address', 'bank'], {
    errorMap: () => ({ message: 'Type must be either usdc_address or bank' })
  }),
  details: z.record(z.string()).refine((details) => {
    // Validate USDC address format
    if (details.type === 'usdc_address') {
      return details.address && 
             typeof details.address === 'string' && 
             details.address.length >= 42 &&
             details.address.startsWith('0x');
    }
    
    // Validate bank details
    if (details.type === 'bank') {
      return details.accountNumber && 
             details.routingNumber && 
             details.accountName &&
             details.bankName;
    }
    
    return true;
  }, 'Invalid details for payout method type'),
  nickname: z.string().max(50).optional(),
  isDefault: z.boolean().default(false)
});

const RequestPayoutSchema = z.object({
  amountUSDC: z.number()
    .positive('Amount must be positive')
    .multipleOf(0.01, 'Amount must be in cents'),
  payoutMethodId: z.string().uuid('Invalid payout method ID').optional()
});

// Rate limiting for payout operations
const payoutRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many payout requests. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/payouts
 * Request payout to verified payment method
 * 
 * Headers:
 * - Idempotency-Key: Required for safe retries
 * 
 * Body:
 * - amountUSDC: Amount to withdraw
 * - payoutMethodId: Optional specific method (uses default if not provided)
 * 
 * Returns:
 * - payoutId: UUID of payout request
 * - status: 'requested' | 'processing' | 'paid' | 'failed'
 * - estimatedProcessingTime: Expected completion time
 * - remainingAvailableUSDC: Balance after payout
 */
router.post('/',
  authenticateUser,
  payoutRateLimit,
  validateIdempotency,
  async (req: Request, res: Response) => {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      const { amountUSDC, payoutMethodId } = RequestPayoutSchema.parse(req.body);
      const userId = (req as any).userId;
      const idempotencyKey = req.headers['idempotency-key'] as string;
      
      await client.query('BEGIN');
      
      // Check user KYC status (placeholder - integrate with actual KYC service)
      const kycQuery = await client.query(`
        SELECT kyc_verified, sanctions_cleared 
        FROM user_verification 
        WHERE user_id = $1
      `, [userId]);
      
      const kycStatus = kycQuery.rows[0] || { kyc_verified: false, sanctions_cleared: false };
      
      if (!kycStatus.kyc_verified) {
        return res.status(403).json({
          error: 'KYC verification required for payouts',
          code: 'KYC_REQUIRED',
          message: 'Please complete identity verification to request payouts'
        });
      }
      
      if (!kycStatus.sanctions_cleared) {
        return res.status(403).json({
          error: 'Account under compliance review',
          code: 'SANCTIONS_CHECK_PENDING',
          message: 'Your account is being reviewed for compliance'
        });
      }
      
      // Use database function for payout request with built-in validations
      const payoutResult = await client.query(`
        SELECT request_payout($1, $2, $3) as payout_id
      `, [userId, amountUSDC, payoutMethodId]);
      
      const payoutId = payoutResult.rows[0].payout_id;
      
      // Get payout details for response
      const payoutQuery = await client.query(`
        SELECT 
          p.*,
          pm.type as method_type,
          pm.nickname as method_nickname
        FROM payouts p
        JOIN payout_methods pm ON p.payout_method_id = pm.id
        WHERE p.id = $1
      `, [payoutId]);
      
      const payout = payoutQuery.rows[0];
      
      // Get updated available balance
      const balanceQuery = await client.query(`
        SELECT available_usdc FROM user_balances WHERE user_id = $1
      `, [userId]);
      
      const remainingBalance = balanceQuery.rows[0]?.available_usdc || 0;
      
      await client.query('COMMIT');
      
      // Estimate processing time based on method type
      const estimatedHours = payout.method_type === 'usdc_address' ? 1 : 24;
      const estimatedProcessingTime = new Date(
        Date.now() + estimatedHours * 60 * 60 * 1000
      ).toISOString();
      
      logger.info('Payout requested successfully', {
        payoutId,
        userId,
        amountUSDC,
        methodType: payout.method_type,
        remainingBalance: parseFloat(remainingBalance)
      });
      
      res.json({
        ok: true,
        payoutId,
        status: payout.status,
        amountUSDC: parseFloat(payout.amount_usdc),
        feeUSDC: parseFloat(payout.fee_usdc),
        netAmountUSDC: parseFloat(payout.net_amount_usdc),
        estimatedProcessingTime,
        remainingAvailableUSDC: parseFloat(remainingBalance),
        payoutMethod: {
          id: payout.payout_method_id,
          type: payout.method_type,
          nickname: payout.method_nickname
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
      
      // Handle specific payout errors
      if (error.message?.includes('below minimum')) {
        return res.status(400).json({
          error: error.message,
          code: 'AMOUNT_BELOW_MINIMUM'
        });
      }
      
      if (error.message?.includes('Insufficient available balance')) {
        return res.status(400).json({
          error: error.message,
          code: 'INSUFFICIENT_BALANCE'
        });
      }
      
      if (error.message?.includes('No verified default payout method')) {
        return res.status(400).json({
          error: 'No verified payout method found. Please add and verify a payout method.',
          code: 'NO_PAYOUT_METHOD'
        });
      }
      
      if (error.code === '23505' && error.constraint?.includes('idempotency')) {
        // Return existing payout for idempotency
        const existingQuery = await client.query(`
          SELECT id, status, amount_usdc, created_at
          FROM payouts
          WHERE user_id = $1 
          ORDER BY created_at DESC 
          LIMIT 1
        `, [userId]);
        
        if (existingQuery.rows.length > 0) {
          const existing = existingQuery.rows[0];
          return res.json({
            ok: true,
            payoutId: existing.id,
            status: existing.status,
            amountUSDC: parseFloat(existing.amount_usdc),
            message: 'Payout request already exists'
          });
        }
      }
      
      logger.error('Payout request failed', {
        error: error.message,
        userId: (req as any).userId,
        amountUSDC,
        payoutMethodId
      });
      
      res.status(500).json({
        error: 'Failed to process payout request',
        code: 'PAYOUT_REQUEST_ERROR'
      });
    } finally {
      client.release();
    }
  }
);

/**
 * GET /api/payouts
 * Get user's payout history
 */
router.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { 
      page = '1', 
      limit = '20',
      status
    } = req.query as Record<string, string>;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const db = getDatabase();
    
    let whereClause = 'WHERE p.user_id = $1';
    const params = [userId];
    let paramIndex = 2;
    
    if (status) {
      whereClause += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    const query = await db.query(`
      SELECT 
        p.id,
        p.amount_usdc,
        p.fee_usdc,
        p.net_amount_usdc,
        p.status,
        p.requested_at,
        p.processing_started_at,
        p.processed_at,
        p.failure_reason,
        p.tx_hash,
        p.external_tx_id,
        pm.type as method_type,
        pm.nickname as method_nickname,
        pm.details as method_details
      FROM payouts p
      JOIN payout_methods pm ON p.payout_method_id = pm.id
      ${whereClause}
      ORDER BY p.requested_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, parseInt(limit), offset]);
    
    const payouts = query.rows.map(row => ({
      id: row.id,
      amountUSDC: parseFloat(row.amount_usdc),
      feeUSDC: parseFloat(row.fee_usdc),
      netAmountUSDC: parseFloat(row.net_amount_usdc),
      status: row.status,
      requestedAt: row.requested_at,
      processingStartedAt: row.processing_started_at,
      processedAt: row.processed_at,
      failureReason: row.failure_reason,
      txHash: row.tx_hash,
      externalTxId: row.external_tx_id,
      payoutMethod: {
        type: row.method_type,
        nickname: row.method_nickname,
        // Mask sensitive details
        details: row.method_type === 'usdc_address' ? {
          address: `${row.method_details.address.slice(0, 6)}...${row.method_details.address.slice(-4)}`
        } : {
          bankName: row.method_details.bankName,
          accountNumber: `***${row.method_details.accountNumber.slice(-4)}`
        }
      }
    }));
    
    // Get total count
    const countQuery = await db.query(`
      SELECT COUNT(*) as total FROM payouts p ${whereClause}
    `, params.slice(0, paramIndex - 2));
    
    const totalCount = parseInt(countQuery.rows[0].total);
    
    res.json({
      payouts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
    
  } catch (error) {
    logger.error('Failed to fetch payout history', {
      error: error.message,
      userId: (req as any).userId
    });
    
    res.status(500).json({
      error: 'Failed to fetch payout history',
      code: 'PAYOUT_HISTORY_ERROR'
    });
  }
});

/**
 * POST /api/payouts/methods
 * Add payout method
 */
router.post('/methods',
  authenticateUser,
  payoutRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { type, details, nickname, isDefault } = CreatePayoutMethodSchema.parse(req.body);
      const userId = (req as any).userId;
      
      const db = getDatabase();
      
      const methodQuery = await db.query(`
        INSERT INTO payout_methods (user_id, type, details, nickname, is_default)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at
      `, [userId, type, JSON.stringify(details), nickname, isDefault]);
      
      const method = methodQuery.rows[0];
      
      // If set as default, unset other defaults
      if (isDefault) {
        await db.query(`
          UPDATE payout_methods 
          SET is_default = FALSE 
          WHERE user_id = $1 AND id != $2
        `, [userId, method.id]);
      }
      
      logger.info('Payout method added', {
        methodId: method.id,
        userId,
        type,
        isDefault
      });
      
      res.json({
        ok: true,
        payoutMethod: {
          id: method.id,
          type,
          nickname,
          isDefault,
          verified: false, // New methods start unverified
          createdAt: method.created_at
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
      
      logger.error('Failed to add payout method', {
        error: error.message,
        userId: (req as any).userId
      });
      
      res.status(500).json({
        error: 'Failed to add payout method',
        code: 'PAYOUT_METHOD_ERROR'
      });
    }
  }
);

/**
 * GET /api/payouts/methods
 * Get user's payout methods
 */
router.get('/methods', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const db = getDatabase();
    
    const query = await db.query(`
      SELECT 
        id,
        type,
        details,
        nickname,
        is_default,
        verified_at,
        created_at
      FROM payout_methods
      WHERE user_id = $1
      ORDER BY is_default DESC, created_at DESC
    `, [userId]);
    
    const methods = query.rows.map(row => ({
      id: row.id,
      type: row.type,
      nickname: row.nickname,
      isDefault: row.is_default,
      verified: !!row.verified_at,
      verifiedAt: row.verified_at,
      createdAt: row.created_at,
      // Mask sensitive details for security
      details: row.type === 'usdc_address' ? {
        address: `${row.details.address.slice(0, 6)}...${row.details.address.slice(-4)}`,
        network: row.details.network || 'ethereum'
      } : {
        bankName: row.details.bankName,
        accountName: row.details.accountName,
        accountNumber: `***${row.details.accountNumber.slice(-4)}`,
        routingNumber: row.details.routingNumber
      }
    }));
    
    res.json({
      methods,
      total: methods.length
    });
    
  } catch (error) {
    logger.error('Failed to fetch payout methods', {
      error: error.message,
      userId: (req as any).userId
    });
    
    res.status(500).json({
      error: 'Failed to fetch payout methods',
      code: 'PAYOUT_METHODS_FETCH_ERROR'
    });
  }
});

/**
 * PUT /api/payouts/methods/:id
 * Update payout method (set as default, update nickname)
 */
router.put('/methods/:id',
  authenticateUser,
  payoutRateLimit,
  async (req: Request, res: Response) => {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      const { id } = req.params;
      const { isDefault, nickname } = z.object({
        isDefault: z.boolean().optional(),
        nickname: z.string().max(50).optional()
      }).parse(req.body);
      
      const userId = (req as any).userId;
      
      await client.query('BEGIN');
      
      // Verify method ownership
      const methodQuery = await client.query(`
        SELECT id FROM payout_methods 
        WHERE id = $1 AND user_id = $2
      `, [id, userId]);
      
      if (methodQuery.rows.length === 0) {
        return res.status(404).json({
          error: 'Payout method not found',
          code: 'PAYOUT_METHOD_NOT_FOUND'
        });
      }
      
      // If setting as default, unset other defaults
      if (isDefault) {
        await client.query(`
          UPDATE payout_methods 
          SET is_default = FALSE 
          WHERE user_id = $1 AND id != $2
        `, [userId, id]);
      }
      
      // Update the method
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      if (isDefault !== undefined) {
        updateFields.push(`is_default = $${paramIndex}`);
        updateValues.push(isDefault);
        paramIndex++;
      }
      
      if (nickname !== undefined) {
        updateFields.push(`nickname = $${paramIndex}`);
        updateValues.push(nickname);
        paramIndex++;
      }
      
      if (updateFields.length > 0) {
        updateFields.push(`updated_at = NOW()`);
        updateValues.push(id, userId);
        
        await client.query(`
          UPDATE payout_methods 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
        `, updateValues);
      }
      
      await client.query('COMMIT');
      
      res.json({
        ok: true,
        message: 'Payout method updated successfully'
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
      
      logger.error('Failed to update payout method', {
        error: error.message,
        methodId: req.params.id,
        userId: (req as any).userId
      });
      
      res.status(500).json({
        error: 'Failed to update payout method',
        code: 'PAYOUT_METHOD_UPDATE_ERROR'
      });
    } finally {
      client.release();
    }
  }
);

/**
 * DELETE /api/payouts/methods/:id
 * Delete payout method
 */
router.delete('/methods/:id',
  authenticateUser,
  payoutRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).userId;
      const db = getDatabase();
      
      // Check if method has pending payouts
      const pendingQuery = await db.query(`
        SELECT COUNT(*) as count FROM payouts 
        WHERE payout_method_id = $1 AND status IN ('requested', 'processing')
      `, [id]);
      
      if (parseInt(pendingQuery.rows[0].count) > 0) {
        return res.status(400).json({
          error: 'Cannot delete payout method with pending payouts',
          code: 'PAYOUT_METHOD_HAS_PENDING_PAYOUTS'
        });
      }
      
      const deleteQuery = await db.query(`
        DELETE FROM payout_methods 
        WHERE id = $1 AND user_id = $2
        RETURNING type
      `, [id, userId]);
      
      if (deleteQuery.rows.length === 0) {
        return res.status(404).json({
          error: 'Payout method not found',
          code: 'PAYOUT_METHOD_NOT_FOUND'
        });
      }
      
      res.json({
        ok: true,
        message: 'Payout method deleted successfully'
      });
      
    } catch (error) {
      logger.error('Failed to delete payout method', {
        error: error.message,
        methodId: req.params.id,
        userId: (req as any).userId
      });
      
      res.status(500).json({
        error: 'Failed to delete payout method',
        code: 'PAYOUT_METHOD_DELETE_ERROR'
      });
    }
  }
);

export default router;