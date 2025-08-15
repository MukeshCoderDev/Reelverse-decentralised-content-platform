import express from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { asyncHandler, createUnifiedError } from '../middleware/unifiedErrorHandler';
import { PrivacyComplianceService } from '../services/privacyComplianceService';
import { auth } from '../middleware/auth';
import { body, param, query, validationResult } from 'express-validator';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// Initialize services
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const privacyService = new PrivacyComplianceService(db, redis);

/**
 * Record consent preferences
 */
router.post('/consent', 
  [
    body('consents').isArray().withMessage('Consents must be an array'),
    body('consents.*.consentType').isIn(['essential', 'analytics', 'marketing', 'personalization', 'third_party', 'data_processing']).withMessage('Invalid consent type'),
    body('consents.*.granted').isBoolean().withMessage('Granted must be a boolean'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid consent data', errors.array(), req.correlationId);
    }

    const { consents } = req.body;
    const userId = req.user?.id || 'anonymous';
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    try {
      const consentRecords = [];

      for (const consent of consents) {
        const record = await privacyService.recordConsent(
          userId,
          consent.consentType,
          consent.granted,
          ipAddress,
          userAgent,
          '1.0',
          { source: 'web_ui' }
        );
        consentRecords.push(record);
      }

      res.json({
        success: true,
        message: 'Consent preferences recorded successfully',
        consentRecords: consentRecords.map(r => ({
          id: r.id,
          consentType: r.consentType,
          granted: r.granted,
          grantedAt: r.grantedAt,
        })),
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to record consent',
        { error: error.message, userId },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Get user's consent status
 */
router.get('/consent', 
  auth,
  asyncHandler(async (req, res) => {
    try {
      const consentStatus = await privacyService.getUserConsentStatus(req.user.id);

      res.json({
        success: true,
        consentStatus,
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to get consent status',
        { error: error.message, userId: req.user.id },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Request data export (GDPR/CCPA)
 */
router.post('/data-export',
  auth,
  [
    body('exportType').isIn(['gdpr', 'ccpa', 'custom']).withMessage('Invalid export type'),
    body('dataTypes').isArray().withMessage('Data types must be an array'),
    body('dataTypes.*').isIn(['profile', 'content', 'financial', 'analytics', 'communications', 'verification', 'consent', 'logs']).withMessage('Invalid data type'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid export request', errors.array(), req.correlationId);
    }

    const { exportType, dataTypes } = req.body;
    const userId = req.user.id;

    try {
      // Log PII access
      await privacyService.logPIIAccess(
        userId,
        userId, // User requesting their own data
        'export',
        dataTypes,
        `${exportType.toUpperCase()} data export request`,
        req.ip || 'unknown',
        req.correlationId
      );

      const exportRequest = await privacyService.requestDataExport(
        userId,
        exportType,
        dataTypes,
        userId,
        req.correlationId
      );

      res.json({
        success: true,
        message: 'Data export request created successfully',
        requestId: exportRequest.id,
        status: exportRequest.status,
        estimatedCompletion: '30 days',
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to create data export request',
        { error: error.message, userId, exportType },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Get data export status
 */
router.get('/data-export/:requestId',
  auth,
  [
    param('requestId').isUUID().withMessage('Invalid request ID'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid request ID', errors.array(), req.correlationId);
    }

    const { requestId } = req.params;
    const userId = req.user.id;

    try {
      const result = await db.query(
        'SELECT * FROM data_export_requests WHERE id = $1 AND user_id = $2',
        [requestId, userId]
      );

      if (result.rows.length === 0) {
        throw createUnifiedError.notFound('Export request not found');
      }

      const request = result.rows[0];

      res.json({
        success: true,
        request: {
          id: request.id,
          status: request.status,
          exportType: request.export_type,
          dataTypes: JSON.parse(request.data_types),
          requestedAt: request.requested_at,
          completedAt: request.completed_at,
          downloadUrl: request.download_url,
          expiresAt: request.expires_at,
          errorMessage: request.error_message,
        },
        correlationId: req.correlationId,
      });
    } catch (error) {
      if (error.statusCode) throw error;
      
      throw createUnifiedError.internal(
        'Failed to get export status',
        { error: error.message, requestId, userId },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Download exported data
 */
router.get('/download/:token',
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    try {
      // Verify download token
      const requestId = await redis.get(`download_token:${token}`);
      if (!requestId) {
        throw createUnifiedError.notFound('Invalid or expired download token');
      }

      // Get export request
      const result = await db.query(
        'SELECT * FROM data_export_requests WHERE id = $1 AND status = $2',
        [requestId, 'completed']
      );

      if (result.rows.length === 0) {
        throw createUnifiedError.notFound('Export not found or not ready');
      }

      const request = result.rows[0];

      // Check if expired
      if (request.expires_at && new Date() > new Date(request.expires_at)) {
        throw createUnifiedError.notFound('Download link has expired');
      }

      // Serve file
      const filePath = path.join(process.env.DATA_EXPORT_PATH || './data-exports', `${requestId}.zip`);
      
      try {
        await fs.access(filePath);
      } catch {
        throw createUnifiedError.notFound('Export file not found');
      }

      // Log download
      await privacyService.logPIIAccess(
        request.user_id,
        request.user_id,
        'export',
        JSON.parse(request.data_types),
        'Data export download',
        req.ip || 'unknown',
        req.correlationId
      );

      res.download(filePath, `data-export-${requestId}.zip`);
    } catch (error) {
      if (error.statusCode) throw error;
      
      throw createUnifiedError.internal(
        'Failed to download export',
        { error: error.message, token },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Request data deletion (Right to be forgotten)
 */
router.post('/data-deletion',
  auth,
  [
    body('deletionType').isIn(['full', 'partial', 'anonymization']).withMessage('Invalid deletion type'),
    body('dataTypes').optional().isArray().withMessage('Data types must be an array'),
    body('dataTypes.*').optional().isIn(['profile', 'content', 'financial', 'analytics', 'communications', 'verification', 'consent', 'logs']).withMessage('Invalid data type'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid deletion request', errors.array(), req.correlationId);
    }

    const { deletionType, dataTypes = [] } = req.body;
    const userId = req.user.id;

    try {
      // Log PII access
      await privacyService.logPIIAccess(
        userId,
        userId,
        'delete',
        dataTypes,
        `${deletionType} data deletion request`,
        req.ip || 'unknown',
        req.correlationId
      );

      const deletionRequest = await privacyService.requestDataDeletion(
        userId,
        deletionType,
        dataTypes,
        userId,
        req.correlationId
      );

      res.json({
        success: true,
        message: 'Data deletion request created successfully. Please check your email to verify this request.',
        requestId: deletionRequest.id,
        status: deletionRequest.status,
        verificationRequired: deletionRequest.verificationRequired,
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to create data deletion request',
        { error: error.message, userId, deletionType },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Verify data deletion request
 */
router.post('/data-deletion/verify/:token',
  [
    param('token').isUUID().withMessage('Invalid verification token'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid verification token', errors.array(), req.correlationId);
    }

    const { token } = req.params;

    try {
      await privacyService.verifyAndProcessDeletion(token);

      res.json({
        success: true,
        message: 'Data deletion request verified and processed successfully',
        correlationId: req.correlationId,
      });
    } catch (error) {
      if (error.statusCode) throw error;
      
      throw createUnifiedError.internal(
        'Failed to verify deletion request',
        { error: error.message, token },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Get user's data processing activities
 */
router.get('/data-activities',
  auth,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid query parameters', errors.array(), req.correlationId);
    }

    const userId = req.user.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    try {
      // Get PII access logs
      const result = await db.query(`
        SELECT id, accessed_by, access_type, data_types, purpose, 
               ip_address, timestamp, correlation_id
        FROM pii_access_logs 
        WHERE user_id = $1 
        ORDER BY timestamp DESC 
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);

      // Get total count
      const countResult = await db.query(
        'SELECT COUNT(*) FROM pii_access_logs WHERE user_id = $1',
        [userId]
      );

      const activities = result.rows.map(row => ({
        id: row.id,
        accessedBy: row.accessed_by,
        accessType: row.access_type,
        dataTypes: JSON.parse(row.data_types),
        purpose: row.purpose,
        ipAddress: row.ip_address,
        timestamp: row.timestamp,
        correlationId: row.correlation_id,
      }));

      res.json({
        success: true,
        activities,
        pagination: {
          total: parseInt(countResult.rows[0].count),
          limit,
          offset,
          hasMore: offset + limit < parseInt(countResult.rows[0].count),
        },
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to get data activities',
        { error: error.message, userId },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Get privacy policy and data processing information
 */
router.get('/policy',
  asyncHandler(async (req, res) => {
    try {
      // Get retention policies
      const retentionResult = await db.query(
        'SELECT data_type, retention_period, legal_basis FROM data_retention_policies'
      );

      const retentionPolicies = retentionResult.rows.reduce((acc, row) => {
        acc[row.data_type] = {
          retentionPeriod: row.retention_period,
          legalBasis: row.legal_basis,
        };
        return acc;
      }, {});

      res.json({
        success: true,
        policy: {
          dataTypes: {
            profile: 'Personal information including name, email, and profile details',
            content: 'Uploaded videos, images, and associated metadata',
            financial: 'Transaction history, earnings, and payout information',
            analytics: 'Usage statistics, view counts, and engagement metrics',
            communications: 'Messages, notifications, and support interactions',
            verification: 'Identity verification documents and status',
            consent: 'Cookie preferences and consent records',
            logs: 'Access logs, login history, and security events',
          },
          retentionPolicies,
          rights: {
            access: 'You have the right to access your personal data',
            rectification: 'You have the right to correct inaccurate data',
            erasure: 'You have the right to request deletion of your data',
            portability: 'You have the right to export your data',
            restriction: 'You have the right to restrict processing',
            objection: 'You have the right to object to processing',
          },
          contact: {
            email: 'privacy@reelverse.com',
            address: 'Data Protection Officer, Reelverse Inc.',
          },
        },
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to get privacy policy',
        { error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

export default router;