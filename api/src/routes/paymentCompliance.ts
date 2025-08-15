import express from 'express';
import { Pool } from 'pg';
import { asyncHandler, createUnifiedError } from '../middleware/unifiedErrorHandler';
import { PaymentComplianceService } from '../services/paymentComplianceService';
import { auth } from '../middleware/auth';
import { body, param, query, validationResult } from 'express-validator';
import multer from 'multer';
import Redis from 'ioredis';

const router = express.Router();

// Initialize services
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const paymentComplianceService = new PaymentComplianceService(db, redis);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  },
});

/**
 * Process 3DS/SCA authentication for EU payments
 */
router.post('/3ds/authenticate',
  auth,
  [
    body('transactionId').isUUID().withMessage('Invalid transaction ID'),
    body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
    body('returnUrl').isURL().withMessage('Valid return URL is required'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid 3DS authentication request', errors.array(), req.correlationId);
    }

    const { transactionId, paymentIntentId, returnUrl } = req.body;

    try {
      const result = await paymentComplianceService.process3DSAuthentication(
        transactionId,
        paymentIntentId,
        returnUrl
      );

      res.json({
        success: true,
        requiresAction: result.requiresAction,
        clientSecret: result.clientSecret,
        redirectUrl: result.redirectUrl,
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.payment(
        'Failed to process 3DS authentication',
        { transactionId, error: error.message },
        true,
        req.correlationId
      );
    }
  })
);

/**
 * Handle 3DS authentication callback
 */
router.post('/3ds/callback',
  [
    body('transactionId').isUUID().withMessage('Invalid transaction ID'),
    body('status').isIn(['success', 'failed', 'abandoned']).withMessage('Invalid status'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid 3DS callback', errors.array(), req.correlationId);
    }

    const { transactionId, status } = req.body;

    try {
      await paymentComplianceService.handle3DSCallback(transactionId, status);

      res.json({
        success: true,
        message: '3DS authentication processed successfully',
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.payment(
        'Failed to handle 3DS callback',
        { transactionId, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Generate receipt and invoice PDF
 */
router.post('/receipts/generate',
  auth,
  [
    body('transactionId').isUUID().withMessage('Invalid transaction ID'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid receipt generation request', errors.array(), req.correlationId);
    }

    const { transactionId } = req.body;

    try {
      const receiptUrl = await paymentComplianceService.generateReceipt(transactionId);

      res.json({
        success: true,
        receiptUrl,
        message: 'Receipt generated successfully',
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to generate receipt',
        { transactionId, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Submit tax form (W-9/W-8BEN)
 */
router.post('/tax-forms',
  auth,
  upload.single('document'),
  [
    body('formType').isIn(['W9', 'W8BEN', 'W8BENE', 'W8ECI', 'W8IMY']).withMessage('Invalid form type'),
    body('formData').isObject().withMessage('Form data must be an object'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid tax form submission', errors.array(), req.correlationId);
    }

    const { formType, formData } = req.body;
    const userId = req.user.id;
    const documentFile = req.file?.buffer;

    try {
      const taxForm = await paymentComplianceService.submitTaxForm(
        userId,
        formType,
        JSON.parse(formData),
        documentFile
      );

      res.status(201).json({
        success: true,
        taxForm: {
          id: taxForm.id,
          formType: taxForm.formType,
          status: taxForm.status,
          submittedAt: taxForm.submittedAt,
          expiresAt: taxForm.expiresAt,
        },
        message: 'Tax form submitted successfully',
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to submit tax form',
        { formType, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Get user's tax forms
 */
router.get('/tax-forms',
  auth,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
      const result = await db.query(
        'SELECT id, form_type, tax_year, status, submitted_at, expires_at FROM tax_forms WHERE user_id = $1 ORDER BY submitted_at DESC',
        [userId]
      );

      const taxForms = result.rows.map(row => ({
        id: row.id,
        formType: row.form_type,
        taxYear: row.tax_year,
        status: row.status,
        submittedAt: row.submitted_at,
        expiresAt: row.expires_at,
      }));

      res.json({
        success: true,
        taxForms,
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to get tax forms',
        { userId, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Calculate VAT/GST for transaction
 */
router.post('/vat/calculate',
  auth,
  [
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    body('customerCountry').isLength({ min: 2, max: 2 }).withMessage('Country must be 2 characters'),
    body('customerType').isIn(['individual', 'business']).withMessage('Invalid customer type'),
    body('customerVATNumber').optional().isString(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid VAT calculation request', errors.array(), req.correlationId);
    }

    const { amount, currency, customerCountry, customerType, customerVATNumber } = req.body;

    try {
      const vatCalculation = await paymentComplianceService.calculateVAT(
        amount,
        currency,
        customerCountry,
        customerType,
        customerVATNumber
      );

      res.json({
        success: true,
        vatCalculation,
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to calculate VAT',
        { amount, currency, customerCountry, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Create chargeback case
 */
router.post('/chargebacks',
  auth,
  [
    body('transactionId').isUUID().withMessage('Invalid transaction ID'),
    body('reason').notEmpty().withMessage('Reason is required'),
    body('reasonCode').notEmpty().withMessage('Reason code is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    body('dueDate').isISO8601().withMessage('Due date must be valid ISO date'),
    body('gatewayChargebackId').optional().isString(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid chargeback case creation', errors.array(), req.correlationId);
    }

    const { transactionId, reason, reasonCode, amount, currency, dueDate, gatewayChargebackId } = req.body;

    try {
      const chargebackCase = await paymentComplianceService.createChargebackCase(
        transactionId,
        reason,
        reasonCode,
        amount,
        currency,
        new Date(dueDate),
        gatewayChargebackId
      );

      res.status(201).json({
        success: true,
        chargebackCase: {
          id: chargebackCase.id,
          transactionId: chargebackCase.transactionId,
          status: chargebackCase.status,
          reason: chargebackCase.reason,
          amount: chargebackCase.amount,
          currency: chargebackCase.currency,
          dueDate: chargebackCase.dueDate,
          evidenceSubmitted: chargebackCase.evidenceSubmitted,
        },
        message: 'Chargeback case created successfully',
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to create chargeback case',
        { transactionId, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Get chargeback cases
 */
router.get('/chargebacks',
  auth,
  [
    query('status').optional().isIn(['received', 'under_review', 'accepted', 'disputed', 'won', 'lost']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid query parameters', errors.array(), req.correlationId);
    }

    const { status, limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;

    try {
      let query = 'SELECT * FROM chargeback_cases WHERE user_id = $1';
      const params = [userId];

      if (status) {
        query += ' AND status = $2';
        params.push(status as string);
      }

      query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit.toString(), offset.toString());

      const result = await db.query(query, params);

      const chargebackCases = result.rows.map(row => ({
        id: row.id,
        transactionId: row.transaction_id,
        status: row.status,
        reason: row.reason,
        reasonCode: row.reason_code,
        amount: parseFloat(row.amount),
        currency: row.currency,
        dueDate: row.due_date,
        evidenceSubmitted: row.evidence_submitted,
        evidenceUrl: row.evidence_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      res.json({
        success: true,
        chargebackCases,
        pagination: {
          limit: parseInt(limit.toString()),
          offset: parseInt(offset.toString()),
          total: chargebackCases.length,
        },
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to get chargeback cases',
        { userId, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Process international payment
 */
router.post('/international/process',
  auth,
  [
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('fromCurrency').isLength({ min: 3, max: 3 }).withMessage('From currency must be 3 characters'),
    body('toCurrency').isLength({ min: 3, max: 3 }).withMessage('To currency must be 3 characters'),
    body('customerCountry').isLength({ min: 2, max: 2 }).withMessage('Country must be 2 characters'),
    body('paymentMethod').isIn(['card', 'bank_transfer', 'crypto']).withMessage('Invalid payment method'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid international payment request', errors.array(), req.correlationId);
    }

    const { amount, fromCurrency, toCurrency, customerCountry, paymentMethod } = req.body;

    try {
      const result = await paymentComplianceService.processInternationalPayment(
        amount,
        fromCurrency,
        toCurrency,
        customerCountry,
        paymentMethod
      );

      res.json({
        success: true,
        internationalPayment: result,
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to process international payment',
        { amount, fromCurrency, toCurrency, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Get payment compliance status
 */
router.get('/compliance/status',
  auth,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
      // Get tax form status
      const taxFormsResult = await db.query(
        'SELECT form_type, status, expires_at FROM tax_forms WHERE user_id = $1 AND status = $2',
        [userId, 'approved']
      );

      // Get recent transactions requiring compliance
      const transactionsResult = await db.query(`
        SELECT id, amount, currency, three_ds_status, vat_amount, receipt_generated
        FROM payment_transactions 
        WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 year'
        ORDER BY created_at DESC
        LIMIT 10
      `, [userId]);

      // Get chargeback cases
      const chargebacksResult = await db.query(
        'SELECT COUNT(*) as total, status FROM chargeback_cases WHERE user_id = $1 GROUP BY status',
        [userId]
      );

      const complianceStatus = {
        taxForms: {
          submitted: taxFormsResult.rows.length > 0,
          forms: taxFormsResult.rows.map(row => ({
            formType: row.form_type,
            status: row.status,
            expiresAt: row.expires_at,
          })),
        },
        transactions: {
          total: transactionsResult.rows.length,
          threeDSCompliant: transactionsResult.rows.filter(t => t.three_ds_status === 'authenticated' || t.three_ds_status === 'bypassed').length,
          receiptsGenerated: transactionsResult.rows.filter(t => t.receipt_generated).length,
          vatCollected: transactionsResult.rows.filter(t => t.vat_amount > 0).length,
        },
        chargebacks: chargebacksResult.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.total);
          return acc;
        }, {} as Record<string, number>),
      };

      res.json({
        success: true,
        complianceStatus,
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to get compliance status',
        { userId, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

export default router;