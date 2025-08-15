import express from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { asyncHandler, createUnifiedError } from '../middleware/unifiedErrorHandler';
import { AIGovernanceService } from '../services/aiGovernanceService';
import { auth } from '../middleware/auth';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();

// Initialize services
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const aiGovernanceService = new AIGovernanceService(db, redis);

/**
 * Register a new AI model version
 */
router.post('/models/register',
  auth,
  [
    body('name').notEmpty().withMessage('Model name is required'),
    body('version').notEmpty().withMessage('Model version is required'),
    body('modelType').isIn(['classification', 'embedding', 'generation', 'detection']).withMessage('Invalid model type'),
    body('provider').isIn(['openai', 'huggingface', 'custom']).withMessage('Invalid provider'),
    body('configuration').isObject().withMessage('Configuration must be an object'),
    body('endpoint').optional().isURL().withMessage('Endpoint must be a valid URL'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid model registration', errors.array(), req.correlationId);
    }

    const { name, version, modelType, provider, configuration, endpoint } = req.body;

    try {
      const model = await aiGovernanceService.registerModel(
        name,
        version,
        modelType,
        provider,
        configuration,
        endpoint
      );

      res.status(201).json({
        success: true,
        model: {
          id: model.id,
          name: model.name,
          version: model.version,
          modelType: model.modelType,
          provider: model.provider,
          status: model.status,
          deployedAt: model.deployedAt,
        },
        message: 'AI model registered successfully',
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to register AI model',
        { name, version, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Record AI model output with tagging and version tracking
 */
router.post('/outputs/record',
  auth,
  [
    body('modelId').isUUID().withMessage('Invalid model ID'),
    body('inputData').isObject().withMessage('Input data must be an object'),
    body('outputData').isObject().withMessage('Output data must be an object'),
    body('confidence').isFloat({ min: 0, max: 1 }).withMessage('Confidence must be between 0 and 1'),
    body('processingTime').isInt({ min: 0 }).withMessage('Processing time must be a positive integer'),
    body('userId').optional().isUUID().withMessage('Invalid user ID'),
    body('contentId').optional().isUUID().withMessage('Invalid content ID'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid output recording', errors.array(), req.correlationId);
    }

    const { modelId, inputData, outputData, confidence, processingTime, userId, contentId } = req.body;

    try {
      const aiOutput = await aiGovernanceService.recordOutput(
        modelId,
        inputData,
        outputData,
        confidence,
        processingTime,
        userId,
        contentId
      );

      res.status(201).json({
        success: true,
        output: {
          id: aiOutput.id,
          modelId: aiOutput.modelId,
          modelVersion: aiOutput.modelVersion,
          confidence: aiOutput.confidence,
          tags: aiOutput.tags,
          flagged: aiOutput.flagged,
          flagReason: aiOutput.flagReason,
          reviewStatus: aiOutput.reviewStatus,
        },
        message: 'AI output recorded successfully',
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to record AI output',
        { modelId, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Report abuse or false positive
 */
router.post('/abuse/report',
  auth,
  [
    body('outputId').isUUID().withMessage('Invalid output ID'),
    body('abuseType').isIn(['false_positive', 'false_negative', 'bias', 'inappropriate', 'other']).withMessage('Invalid abuse type'),
    body('description').notEmpty().withMessage('Description is required'),
    body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity level'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid abuse report', errors.array(), req.correlationId);
    }

    const { outputId, abuseType, description, severity } = req.body;
    const reportedBy = req.user.id;

    try {
      const abuseCase = await aiGovernanceService.reportAbuse(
        outputId,
        reportedBy,
        abuseType,
        description,
        severity
      );

      res.status(201).json({
        success: true,
        abuseCase: {
          id: abuseCase.id,
          outputId: abuseCase.outputId,
          abuseType: abuseCase.abuseType,
          severity: abuseCase.severity,
          status: abuseCase.status,
          createdAt: abuseCase.createdAt,
        },
        message: 'Abuse report submitted successfully',
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to report abuse',
        { outputId, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Run red-team test suite
 */
router.post('/models/:modelId/red-team',
  auth,
  [
    param('modelId').isUUID().withMessage('Invalid model ID'),
    body('testSuite').optional().isString().withMessage('Test suite must be a string'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid red-team test request', errors.array(), req.correlationId);
    }

    const { modelId } = req.params;
    const { testSuite = 'comprehensive' } = req.body;

    try {
      const redTeamTest = await aiGovernanceService.runRedTeamTests(modelId, testSuite);

      res.status(201).json({
        success: true,
        redTeamTest: {
          id: redTeamTest.id,
          testSuite: redTeamTest.testSuite,
          modelId: redTeamTest.modelId,
          testType: redTeamTest.testType,
          status: redTeamTest.status,
          startedAt: redTeamTest.startedAt,
        },
        message: 'Red-team tests started successfully',
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to start red-team tests',
        { modelId, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Get red-team test results
 */
router.get('/red-team/:testId',
  auth,
  [
    param('testId').isUUID().withMessage('Invalid test ID'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid test ID', errors.array(), req.correlationId);
    }

    const { testId } = req.params;

    try {
      const result = await db.query(`
        SELECT rt.*, 
               COALESCE(
                 json_agg(
                   json_build_object(
                     'id', rtc.id,
                     'name', rtc.name,
                     'passed', rtc.passed,
                     'score', rtc.score,
                     'notes', rtc.notes
                   )
                 ) FILTER (WHERE rtc.id IS NOT NULL), 
                 '[]'
               ) as test_cases
        FROM red_team_tests rt
        LEFT JOIN red_team_test_cases rtc ON rt.id = rtc.test_id
        WHERE rt.id = $1
        GROUP BY rt.id
      `, [testId]);

      if (result.rows.length === 0) {
        throw createUnifiedError.notFound('Red-team test not found');
      }

      const test = result.rows[0];

      res.json({
        success: true,
        redTeamTest: {
          id: test.id,
          testSuite: test.test_suite,
          modelId: test.model_id,
          testType: test.test_type,
          status: test.status,
          overallScore: parseFloat(test.overall_score),
          passRate: parseFloat(test.pass_rate),
          startedAt: test.started_at,
          completedAt: test.completed_at,
          testCases: test.test_cases,
        },
        correlationId: req.correlationId,
      });
    } catch (error) {
      if (error.statusCode) throw error;
      
      throw createUnifiedError.internal(
        'Failed to get red-team test results',
        { testId, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Get AI governance dashboard metrics
 */
router.get('/metrics/dashboard',
  auth,
  asyncHandler(async (req, res) => {
    try {
      const metrics = await aiGovernanceService.getGovernanceMetrics();

      res.json({
        success: true,
        metrics,
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to get governance metrics',
        { error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Get abuse and false-positive review queue
 */
router.get('/review-queue',
  auth,
  [
    query('status').optional().isIn(['pending', 'escalated', 'all']).withMessage('Invalid status'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid query parameters', errors.array(), req.correlationId);
    }

    const status = req.query.status as 'pending' | 'escalated' | 'all' || 'all';
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    try {
      const reviewQueue = await aiGovernanceService.getReviewQueue(status, limit, offset);

      res.json({
        success: true,
        reviewQueue: {
          outputs: reviewQueue.outputs,
          abuseCases: reviewQueue.abuseCases,
          pagination: {
            limit,
            offset,
            total: reviewQueue.total,
            hasMore: offset + limit < reviewQueue.total,
          },
        },
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to get review queue',
        { status, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Get model performance metrics
 */
router.get('/models/:modelId/metrics',
  auth,
  [
    param('modelId').isUUID().withMessage('Invalid model ID'),
    query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid time range'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid parameters', errors.array(), req.correlationId);
    }

    const { modelId } = req.params;
    const timeRange = req.query.timeRange as string || '24h';

    try {
      // Convert time range to interval
      const intervalMap: Record<string, string> = {
        '1h': '1 hour',
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days',
      };

      const interval = intervalMap[timeRange];

      // Get model metrics
      const metricsResult = await db.query(`
        SELECT 
          COUNT(*) as total_outputs,
          AVG(confidence) as avg_confidence,
          AVG(processing_time) as avg_processing_time,
          COUNT(*) FILTER (WHERE flagged = true) as flagged_outputs,
          COUNT(*) FILTER (WHERE review_status = 'approved') as approved_outputs,
          COUNT(*) FILTER (WHERE review_status = 'rejected') as rejected_outputs
        FROM ai_outputs 
        WHERE model_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
      `, [modelId]);

      // Get drift alerts
      const driftResult = await db.query(`
        SELECT 
          COUNT(*) as total_alerts,
          COUNT(*) FILTER (WHERE status = 'warning') as warning_alerts,
          COUNT(*) FILTER (WHERE status = 'critical') as critical_alerts,
          AVG(drift_score) as avg_drift_score
        FROM embedding_drift 
        WHERE model_id = $1 AND detected_at > NOW() - INTERVAL '${interval}'
      `, [modelId]);

      // Get abuse reports
      const abuseResult = await db.query(`
        SELECT 
          COUNT(*) as total_reports,
          COUNT(*) FILTER (WHERE severity = 'high' OR severity = 'critical') as high_severity_reports
        FROM abuse_cases ac
        JOIN ai_outputs ao ON ac.output_id = ao.id
        WHERE ao.model_id = $1 AND ac.created_at > NOW() - INTERVAL '${interval}'
      `, [modelId]);

      const metrics = metricsResult.rows[0];
      const drift = driftResult.rows[0];
      const abuse = abuseResult.rows[0];

      res.json({
        success: true,
        modelMetrics: {
          totalOutputs: parseInt(metrics.total_outputs) || 0,
          averageConfidence: parseFloat(metrics.avg_confidence) || 0,
          averageProcessingTime: parseFloat(metrics.avg_processing_time) || 0,
          flaggedOutputs: parseInt(metrics.flagged_outputs) || 0,
          approvedOutputs: parseInt(metrics.approved_outputs) || 0,
          rejectedOutputs: parseInt(metrics.rejected_outputs) || 0,
          driftAlerts: {
            total: parseInt(drift.total_alerts) || 0,
            warning: parseInt(drift.warning_alerts) || 0,
            critical: parseInt(drift.critical_alerts) || 0,
            averageDriftScore: parseFloat(drift.avg_drift_score) || 0,
          },
          abuseReports: {
            total: parseInt(abuse.total_reports) || 0,
            highSeverity: parseInt(abuse.high_severity_reports) || 0,
          },
        },
        timeRange,
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to get model metrics',
        { modelId, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Get embedding drift analysis
 */
router.get('/models/:modelId/drift',
  auth,
  [
    param('modelId').isUUID().withMessage('Invalid model ID'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid parameters', errors.array(), req.correlationId);
    }

    const { modelId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    try {
      const driftResult = await db.query(`
        SELECT 
          id,
          drift_score,
          threshold,
          status,
          detected_at,
          alert_sent
        FROM embedding_drift 
        WHERE model_id = $1 
        ORDER BY detected_at DESC 
        LIMIT $2
      `, [modelId, limit]);

      const driftHistory = driftResult.rows.map(row => ({
        id: row.id,
        driftScore: parseFloat(row.drift_score),
        threshold: parseFloat(row.threshold),
        status: row.status,
        detectedAt: row.detected_at,
        alertSent: row.alert_sent,
      }));

      res.json({
        success: true,
        driftHistory,
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to get drift analysis',
        { modelId, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

/**
 * Update abuse case status
 */
router.patch('/abuse/:caseId',
  auth,
  [
    param('caseId').isUUID().withMessage('Invalid case ID'),
    body('status').isIn(['open', 'investigating', 'resolved', 'dismissed']).withMessage('Invalid status'),
    body('assignedTo').optional().isUUID().withMessage('Invalid assigned user ID'),
    body('resolution').optional().isString().withMessage('Resolution must be a string'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createUnifiedError.validation('Invalid abuse case update', errors.array(), req.correlationId);
    }

    const { caseId } = req.params;
    const { status, assignedTo, resolution } = req.body;

    try {
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);

      if (assignedTo) {
        updateFields.push(`assigned_to = $${paramIndex++}`);
        updateValues.push(assignedTo);
      }

      if (resolution) {
        updateFields.push(`resolution = $${paramIndex++}`);
        updateValues.push(resolution);
      }

      if (status === 'resolved' || status === 'dismissed') {
        updateFields.push(`resolved_at = $${paramIndex++}`);
        updateValues.push(new Date());
      }

      updateFields.push(`updated_at = $${paramIndex++}`);
      updateValues.push(new Date());

      updateValues.push(caseId);

      await db.query(`
        UPDATE abuse_cases 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
      `, updateValues);

      res.json({
        success: true,
        message: 'Abuse case updated successfully',
        correlationId: req.correlationId,
      });
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to update abuse case',
        { caseId, error: error.message },
        false,
        req.correlationId
      );
    }
  })
);

export default router;