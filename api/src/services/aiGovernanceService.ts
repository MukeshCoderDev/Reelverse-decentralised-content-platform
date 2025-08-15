import { Pool } from 'pg';
import Redis from 'ioredis';
import { createUnifiedError } from '../middleware/unifiedErrorHandler';
import { logger, logAudit } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface AIModel {
  id: string;
  name: string;
  version: string;
  modelType: 'classification' | 'embedding' | 'generation' | 'detection';
  provider: 'openai' | 'huggingface' | 'custom';
  endpoint?: string;
  configuration: Record<string, any>;
  status: 'active' | 'deprecated' | 'testing' | 'disabled';
  performanceMetrics: ModelPerformanceMetrics;
  deployedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelPerformanceMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  latency: number; // in milliseconds
  throughput: number; // requests per second
  errorRate: number; // percentage
  confidenceThreshold: number;
}

export interface EmbeddingDrift {
  id: string;
  modelId: string;
  baselineEmbedding: number[];
  currentEmbedding: number[];
  driftScore: number;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
  detectedAt: Date;
  alertSent: boolean;
}

export interface AIOutput {
  id: string;
  modelId: string;
  modelVersion: string;
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  confidence: number;
  processingTime: number;
  userId?: string;
  contentId?: string;
  tags: string[];
  flagged: boolean;
  flagReason?: string;
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'escalated';
  createdAt: Date;
}

export interface AbuseCase {
  id: string;
  outputId: string;
  reportedBy: string;
  abuseType: 'false_positive' | 'false_negative' | 'bias' | 'inappropriate' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  assignedTo?: string;
  resolution?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface RedTeamTest {
  id: string;
  testSuite: string;
  modelId: string;
  testType: 'adversarial' | 'bias' | 'safety' | 'robustness' | 'privacy';
  testCases: RedTeamTestCase[];
  status: 'running' | 'completed' | 'failed';
  overallScore: number;
  passRate: number;
  startedAt: Date;
  completedAt?: Date;
}

export interface RedTeamTestCase {
  id: string;
  name: string;
  input: Record<string, any>;
  expectedOutput?: Record<string, any>;
  actualOutput?: Record<string, any>;
  passed: boolean;
  score: number;
  notes?: string;
}

export interface GovernanceMetrics {
  totalModels: number;
  activeModels: number;
  averageLatency: number;
  errorRate: number;
  driftAlerts: number;
  abuseReports: number;
  redTeamTestsPassed: number;
  complianceScore: number;
}

export class AIGovernanceService {
  private db: Pool;
  private redis: Redis;
  private driftThresholds: Map<string, number> = new Map();
  private redTeamSuites: Map<string, RedTeamTestCase[]> = new Map();

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
    this.initializeDriftThresholds();
    this.initializeRedTeamSuites();
    this.startDriftMonitoring();
  }

  /**
   * Register a new AI model version
   */
  async registerModel(
    name: string,
    version: string,
    modelType: 'classification' | 'embedding' | 'generation' | 'detection',
    provider: 'openai' | 'huggingface' | 'custom',
    configuration: Record<string, any>,
    endpoint?: string
  ): Promise<AIModel> {
    try {
      const modelId = uuidv4();
      
      const model: AIModel = {
        id: modelId,
        name,
        version,
        modelType,
        provider,
        endpoint,
        configuration,
        status: 'testing',
        performanceMetrics: {
          latency: 0,
          throughput: 0,
          errorRate: 0,
          confidenceThreshold: 0.5,
        },
        deployedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database
      await this.db.query(`
        INSERT INTO ai_models 
        (id, name, version, model_type, provider, endpoint, configuration, status, performance_metrics, deployed_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        model.id,
        model.name,
        model.version,
        model.modelType,
        model.provider,
        model.endpoint,
        JSON.stringify(model.configuration),
        model.status,
        JSON.stringify(model.performanceMetrics),
        model.deployedAt,
        model.createdAt,
        model.updatedAt,
      ]);

      // Log model registration
      logAudit('AI model registered', null, {
        modelId,
        name,
        version,
        modelType,
        provider,
      });

      return model;
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to register AI model',
        { name, version, error: error.message },
        false
      );
    }
  }

  /**
   * Record AI model output with tagging and version tracking
   */
  async recordOutput(
    modelId: string,
    inputData: Record<string, any>,
    outputData: Record<string, any>,
    confidence: number,
    processingTime: number,
    userId?: string,
    contentId?: string
  ): Promise<AIOutput> {
    try {
      const outputId = uuidv4();

      // Get model information
      const modelResult = await this.db.query(
        'SELECT name, version, model_type FROM ai_models WHERE id = $1',
        [modelId]
      );

      if (modelResult.rows.length === 0) {
        throw createUnifiedError.notFound('AI model not found');
      }

      const model = modelResult.rows[0];

      // Generate tags based on model type and output
      const tags = this.generateOutputTags(model.model_type, outputData, confidence);

      // Check for potential issues
      const { flagged, flagReason } = this.checkForIssues(outputData, confidence, model.model_type);

      const aiOutput: AIOutput = {
        id: outputId,
        modelId,
        modelVersion: model.version,
        inputData,
        outputData,
        confidence,
        processingTime,
        userId,
        contentId,
        tags,
        flagged,
        flagReason,
        reviewStatus: flagged ? 'pending' : 'approved',
        createdAt: new Date(),
      };

      // Store in database
      await this.db.query(`
        INSERT INTO ai_outputs 
        (id, model_id, model_version, input_data, output_data, confidence, processing_time, user_id, content_id, tags, flagged, flag_reason, review_status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        aiOutput.id,
        aiOutput.modelId,
        aiOutput.modelVersion,
        JSON.stringify(aiOutput.inputData),
        JSON.stringify(aiOutput.outputData),
        aiOutput.confidence,
        aiOutput.processingTime,
        aiOutput.userId,
        aiOutput.contentId,
        JSON.stringify(aiOutput.tags),
        aiOutput.flagged,
        aiOutput.flagReason,
        aiOutput.reviewStatus,
        aiOutput.createdAt,
      ]);

      // Update model performance metrics
      await this.updateModelMetrics(modelId, processingTime, confidence, !flagged);

      // Check for embedding drift if this is an embedding model
      if (model.model_type === 'embedding' && Array.isArray(outputData.embedding)) {
        await this.checkEmbeddingDrift(modelId, outputData.embedding);
      }

      return aiOutput;
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to record AI output',
        { modelId, error: error.message },
        false
      );
    }
  }

  /**
   * Detect embedding drift and alert on quality degradation
   */
  async checkEmbeddingDrift(modelId: string, currentEmbedding: number[]): Promise<void> {
    try {
      // Get baseline embedding for this model
      const baselineResult = await this.redis.get(`embedding_baseline:${modelId}`);
      
      if (!baselineResult) {
        // Set this as baseline if none exists
        await this.redis.set(`embedding_baseline:${modelId}`, JSON.stringify(currentEmbedding));
        return;
      }

      const baselineEmbedding = JSON.parse(baselineResult);
      
      // Calculate cosine similarity (drift score)
      const driftScore = this.calculateCosineSimilarity(baselineEmbedding, currentEmbedding);
      const threshold = this.driftThresholds.get(modelId) || 0.8;

      let status: 'normal' | 'warning' | 'critical' = 'normal';
      if (driftScore < threshold) {
        status = driftScore < (threshold - 0.1) ? 'critical' : 'warning';
      }

      // Record drift measurement
      const driftId = uuidv4();
      const drift: EmbeddingDrift = {
        id: driftId,
        modelId,
        baselineEmbedding,
        currentEmbedding,
        driftScore,
        threshold,
        status,
        detectedAt: new Date(),
        alertSent: false,
      };

      await this.db.query(`
        INSERT INTO embedding_drift 
        (id, model_id, baseline_embedding, current_embedding, drift_score, threshold, status, detected_at, alert_sent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        drift.id,
        drift.modelId,
        JSON.stringify(drift.baselineEmbedding),
        JSON.stringify(drift.currentEmbedding),
        drift.driftScore,
        drift.threshold,
        drift.status,
        drift.detectedAt,
        drift.alertSent,
      ]);

      // Send alert if drift is significant
      if (status !== 'normal') {
        await this.sendDriftAlert(drift);
      }

    } catch (error) {
      logger.error('Error checking embedding drift', error, { modelId });
    }
  }

  /**
   * Create abuse report and review queue
   */
  async reportAbuse(
    outputId: string,
    reportedBy: string,
    abuseType: 'false_positive' | 'false_negative' | 'bias' | 'inappropriate' | 'other',
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<AbuseCase> {
    try {
      const caseId = uuidv4();

      const abuseCase: AbuseCase = {
        id: caseId,
        outputId,
        reportedBy,
        abuseType,
        description,
        severity,
        status: 'open',
        createdAt: new Date(),
      };

      // Store in database
      await this.db.query(`
        INSERT INTO abuse_cases 
        (id, output_id, reported_by, abuse_type, description, severity, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        abuseCase.id,
        abuseCase.outputId,
        abuseCase.reportedBy,
        abuseCase.abuseType,
        abuseCase.description,
        abuseCase.severity,
        abuseCase.status,
        abuseCase.createdAt,
      ]);

      // Update output review status
      await this.db.query(
        'UPDATE ai_outputs SET review_status = $1 WHERE id = $2',
        ['escalated', outputId]
      );

      // Log abuse report
      logAudit('AI abuse reported', reportedBy, {
        caseId,
        outputId,
        abuseType,
        severity,
      });

      return abuseCase;
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to report abuse',
        { outputId, error: error.message },
        false
      );
    }
  }

  /**
   * Run red-team test suite integration in CI/CD pipeline
   */
  async runRedTeamTests(
    modelId: string,
    testSuite: string = 'comprehensive'
  ): Promise<RedTeamTest> {
    try {
      const testId = uuidv4();
      const testCases = this.redTeamSuites.get(testSuite) || [];

      const redTeamTest: RedTeamTest = {
        id: testId,
        testSuite,
        modelId,
        testType: 'adversarial', // This would be determined by test suite
        testCases: [],
        status: 'running',
        overallScore: 0,
        passRate: 0,
        startedAt: new Date(),
      };

      // Store initial test record
      await this.db.query(`
        INSERT INTO red_team_tests 
        (id, test_suite, model_id, test_type, status, overall_score, pass_rate, started_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        redTeamTest.id,
        redTeamTest.testSuite,
        redTeamTest.modelId,
        redTeamTest.testType,
        redTeamTest.status,
        redTeamTest.overallScore,
        redTeamTest.passRate,
        redTeamTest.startedAt,
      ]);

      // Run tests asynchronously
      this.executeRedTeamTests(testId, modelId, testCases);

      return redTeamTest;
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to start red-team tests',
        { modelId, testSuite, error: error.message },
        false
      );
    }
  }

  /**
   * Get AI governance dashboard metrics
   */
  async getGovernanceMetrics(): Promise<GovernanceMetrics> {
    try {
      // Get model counts
      const modelStats = await this.db.query(`
        SELECT 
          COUNT(*) as total_models,
          COUNT(*) FILTER (WHERE status = 'active') as active_models
        FROM ai_models
      `);

      // Get performance metrics
      const performanceStats = await this.db.query(`
        SELECT 
          AVG(processing_time) as avg_latency,
          COUNT(*) FILTER (WHERE flagged = true) * 100.0 / COUNT(*) as error_rate
        FROM ai_outputs 
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);

      // Get drift alerts
      const driftStats = await this.db.query(`
        SELECT COUNT(*) as drift_alerts
        FROM embedding_drift 
        WHERE status IN ('warning', 'critical') 
        AND detected_at > NOW() - INTERVAL '24 hours'
      `);

      // Get abuse reports
      const abuseStats = await this.db.query(`
        SELECT COUNT(*) as abuse_reports
        FROM abuse_cases 
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);

      // Get red-team test results
      const redTeamStats = await this.db.query(`
        SELECT AVG(pass_rate) as avg_pass_rate
        FROM red_team_tests 
        WHERE status = 'completed' 
        AND started_at > NOW() - INTERVAL '7 days'
      `);

      const metrics: GovernanceMetrics = {
        totalModels: parseInt(modelStats.rows[0].total_models) || 0,
        activeModels: parseInt(modelStats.rows[0].active_models) || 0,
        averageLatency: parseFloat(performanceStats.rows[0].avg_latency) || 0,
        errorRate: parseFloat(performanceStats.rows[0].error_rate) || 0,
        driftAlerts: parseInt(driftStats.rows[0].drift_alerts) || 0,
        abuseReports: parseInt(abuseStats.rows[0].abuse_reports) || 0,
        redTeamTestsPassed: parseFloat(redTeamStats.rows[0].avg_pass_rate) || 0,
        complianceScore: 0, // Calculate based on various factors
      };

      // Calculate compliance score
      metrics.complianceScore = this.calculateComplianceScore(metrics);

      return metrics;
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to get governance metrics',
        { error: error.message },
        false
      );
    }
  }

  /**
   * Get abuse and false-positive review queue
   */
  async getReviewQueue(
    status: 'pending' | 'escalated' | 'all' = 'all',
    limit: number = 50,
    offset: number = 0
  ): Promise<{ outputs: AIOutput[]; abuseCases: AbuseCase[]; total: number }> {
    try {
      // Get flagged outputs
      let outputQuery = `
        SELECT ao.*, am.name as model_name, am.version as model_version
        FROM ai_outputs ao
        JOIN ai_models am ON ao.model_id = am.id
        WHERE ao.flagged = true
      `;
      const outputParams: any[] = [];

      if (status !== 'all') {
        outputQuery += ' AND ao.review_status = $1';
        outputParams.push(status);
      }

      outputQuery += ' ORDER BY ao.created_at DESC LIMIT $' + (outputParams.length + 1) + ' OFFSET $' + (outputParams.length + 2);
      outputParams.push(limit, offset);

      const outputResult = await this.db.query(outputQuery, outputParams);

      // Get abuse cases
      let abuseQuery = 'SELECT * FROM abuse_cases WHERE 1=1';
      const abuseParams: any[] = [];

      if (status !== 'all') {
        abuseQuery += ' AND status = $1';
        abuseParams.push(status === 'pending' ? 'open' : status);
      }

      abuseQuery += ' ORDER BY created_at DESC LIMIT $' + (abuseParams.length + 1) + ' OFFSET $' + (abuseParams.length + 2);
      abuseParams.push(limit, offset);

      const abuseResult = await this.db.query(abuseQuery, abuseParams);

      // Get total count
      const totalResult = await this.db.query(`
        SELECT 
          (SELECT COUNT(*) FROM ai_outputs WHERE flagged = true ${status !== 'all' ? 'AND review_status = $1' : ''}) +
          (SELECT COUNT(*) FROM abuse_cases ${status !== 'all' ? 'WHERE status = $1' : ''}) as total
      `, status !== 'all' ? [status === 'pending' ? 'open' : status] : []);

      const outputs = outputResult.rows.map(row => ({
        id: row.id,
        modelId: row.model_id,
        modelVersion: row.model_version,
        inputData: JSON.parse(row.input_data),
        outputData: JSON.parse(row.output_data),
        confidence: parseFloat(row.confidence),
        processingTime: parseInt(row.processing_time),
        userId: row.user_id,
        contentId: row.content_id,
        tags: JSON.parse(row.tags),
        flagged: row.flagged,
        flagReason: row.flag_reason,
        reviewStatus: row.review_status,
        createdAt: row.created_at,
      }));

      const abuseCases = abuseResult.rows.map(row => ({
        id: row.id,
        outputId: row.output_id,
        reportedBy: row.reported_by,
        abuseType: row.abuse_type,
        description: row.description,
        severity: row.severity,
        status: row.status,
        assignedTo: row.assigned_to,
        resolution: row.resolution,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
      }));

      return {
        outputs,
        abuseCases,
        total: parseInt(totalResult.rows[0].total),
      };
    } catch (error) {
      throw createUnifiedError.internal(
        'Failed to get review queue',
        { status, error: error.message },
        false
      );
    }
  }

  /**
   * Update model performance metrics
   */
  private async updateModelMetrics(
    modelId: string,
    processingTime: number,
    confidence: number,
    success: boolean
  ): Promise<void> {
    try {
      // Get current metrics
      const result = await this.db.query(
        'SELECT performance_metrics FROM ai_models WHERE id = $1',
        [modelId]
      );

      if (result.rows.length === 0) return;

      const currentMetrics = JSON.parse(result.rows[0].performance_metrics);

      // Update metrics (simple moving average)
      const alpha = 0.1; // Smoothing factor
      currentMetrics.latency = currentMetrics.latency * (1 - alpha) + processingTime * alpha;
      
      // Update error rate
      const errorRate = success ? 0 : 1;
      currentMetrics.errorRate = currentMetrics.errorRate * (1 - alpha) + errorRate * alpha;

      // Update in database
      await this.db.query(
        'UPDATE ai_models SET performance_metrics = $1, updated_at = $2 WHERE id = $3',
        [JSON.stringify(currentMetrics), new Date(), modelId]
      );

    } catch (error) {
      logger.error('Error updating model metrics', error, { modelId });
    }
  }

  /**
   * Generate output tags based on model type and output
   */
  private generateOutputTags(
    modelType: string,
    outputData: Record<string, any>,
    confidence: number
  ): string[] {
    const tags: string[] = [];

    // Add model type tag
    tags.push(`model:${modelType}`);

    // Add confidence level tag
    if (confidence >= 0.9) tags.push('confidence:high');
    else if (confidence >= 0.7) tags.push('confidence:medium');
    else tags.push('confidence:low');

    // Add specific tags based on model type
    switch (modelType) {
      case 'classification':
        if (outputData.category) tags.push(`category:${outputData.category}`);
        break;
      case 'detection':
        if (outputData.detected) tags.push('detection:positive');
        if (outputData.objects) tags.push(`objects:${outputData.objects.length}`);
        break;
      case 'generation':
        if (outputData.text) tags.push('type:text');
        if (outputData.image) tags.push('type:image');
        break;
      case 'embedding':
        if (outputData.embedding) tags.push(`dimensions:${outputData.embedding.length}`);
        break;
    }

    return tags;
  }

  /**
   * Check for potential issues in AI output
   */
  private checkForIssues(
    outputData: Record<string, any>,
    confidence: number,
    modelType: string
  ): { flagged: boolean; flagReason?: string } {
    // Low confidence threshold
    if (confidence < 0.3) {
      return { flagged: true, flagReason: 'Low confidence score' };
    }

    // Check for potential bias indicators
    if (outputData.bias_score && outputData.bias_score > 0.8) {
      return { flagged: true, flagReason: 'High bias score detected' };
    }

    // Check for inappropriate content flags
    if (outputData.inappropriate && outputData.inappropriate === true) {
      return { flagged: true, flagReason: 'Inappropriate content detected' };
    }

    // Check for anomalous outputs
    if (modelType === 'embedding' && outputData.embedding) {
      const magnitude = Math.sqrt(outputData.embedding.reduce((sum: number, val: number) => sum + val * val, 0));
      if (magnitude < 0.1 || magnitude > 10) {
        return { flagged: true, flagReason: 'Anomalous embedding magnitude' };
      }
    }

    return { flagged: false };
  }

  /**
   * Calculate cosine similarity for drift detection
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Send drift alert
   */
  private async sendDriftAlert(drift: EmbeddingDrift): Promise<void> {
    try {
      // Log alert
      logger.warn('Embedding drift detected', {
        modelId: drift.modelId,
        driftScore: drift.driftScore,
        threshold: drift.threshold,
        status: drift.status,
      });

      // Update alert sent status
      await this.db.query(
        'UPDATE embedding_drift SET alert_sent = true WHERE id = $1',
        [drift.id]
      );

      // Send to monitoring system (implement based on your setup)
      await this.redis.publish('ai_alerts', JSON.stringify({
        type: 'embedding_drift',
        modelId: drift.modelId,
        severity: drift.status,
        driftScore: drift.driftScore,
        timestamp: drift.detectedAt,
      }));

    } catch (error) {
      logger.error('Error sending drift alert', error, { driftId: drift.id });
    }
  }

  /**
   * Execute red-team tests asynchronously
   */
  private async executeRedTeamTests(
    testId: string,
    modelId: string,
    testCases: RedTeamTestCase[]
  ): Promise<void> {
    try {
      const results: RedTeamTestCase[] = [];
      let passedTests = 0;

      for (const testCase of testCases) {
        try {
          // Execute test case (this would call the actual model)
          const result = await this.executeTestCase(modelId, testCase);
          results.push(result);
          
          if (result.passed) passedTests++;

          // Store individual test result
          await this.db.query(`
            INSERT INTO red_team_test_cases 
            (id, test_id, name, input_data, expected_output, actual_output, passed, score, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            result.id,
            testId,
            result.name,
            JSON.stringify(result.input),
            JSON.stringify(result.expectedOutput),
            JSON.stringify(result.actualOutput),
            result.passed,
            result.score,
            result.notes,
          ]);

        } catch (error) {
          logger.error('Red-team test case failed', error, { testId, testCase: testCase.name });
        }
      }

      // Calculate overall results
      const passRate = testCases.length > 0 ? (passedTests / testCases.length) * 100 : 0;
      const overallScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;

      // Update test record
      await this.db.query(`
        UPDATE red_team_tests 
        SET status = 'completed', overall_score = $1, pass_rate = $2, completed_at = $3
        WHERE id = $4
      `, [overallScore, passRate, new Date(), testId]);

    } catch (error) {
      // Mark test as failed
      await this.db.query(
        'UPDATE red_team_tests SET status = $1 WHERE id = $2',
        ['failed', testId]
      );
      
      logger.error('Red-team test execution failed', error, { testId, modelId });
    }
  }

  /**
   * Execute individual test case
   */
  private async executeTestCase(modelId: string, testCase: RedTeamTestCase): Promise<RedTeamTestCase> {
    // This would integrate with your actual AI model inference
    // For now, we'll simulate the test execution
    
    const result: RedTeamTestCase = {
      ...testCase,
      actualOutput: { simulated: true, result: 'test_output' },
      passed: Math.random() > 0.2, // 80% pass rate simulation
      score: Math.random() * 100,
      notes: 'Simulated test execution',
    };

    return result;
  }

  /**
   * Calculate compliance score based on various metrics
   */
  private calculateComplianceScore(metrics: GovernanceMetrics): number {
    let score = 100;

    // Deduct points for high error rate
    if (metrics.errorRate > 5) score -= 20;
    else if (metrics.errorRate > 2) score -= 10;

    // Deduct points for drift alerts
    if (metrics.driftAlerts > 5) score -= 15;
    else if (metrics.driftAlerts > 2) score -= 5;

    // Deduct points for abuse reports
    if (metrics.abuseReports > 10) score -= 15;
    else if (metrics.abuseReports > 5) score -= 5;

    // Deduct points for low red-team test pass rate
    if (metrics.redTeamTestsPassed < 80) score -= 20;
    else if (metrics.redTeamTestsPassed < 90) score -= 10;

    return Math.max(0, score);
  }

  /**
   * Initialize drift thresholds for different models
   */
  private initializeDriftThresholds(): void {
    // Default thresholds - these would be configured per model
    this.driftThresholds.set('default', 0.8);
    this.driftThresholds.set('embedding', 0.85);
    this.driftThresholds.set('classification', 0.75);
  }

  /**
   * Initialize red-team test suites
   */
  private initializeRedTeamSuites(): void {
    // Comprehensive test suite
    const comprehensiveTests: RedTeamTestCase[] = [
      {
        id: uuidv4(),
        name: 'Adversarial Input Test',
        input: { text: 'This is a test with adversarial content...' },
        expectedOutput: { safe: true },
        passed: false,
        score: 0,
      },
      {
        id: uuidv4(),
        name: 'Bias Detection Test',
        input: { text: 'Test for potential bias in model output...' },
        expectedOutput: { bias_score: 0.1 },
        passed: false,
        score: 0,
      },
      {
        id: uuidv4(),
        name: 'Privacy Leakage Test',
        input: { text: 'Test for potential privacy information leakage...' },
        expectedOutput: { privacy_safe: true },
        passed: false,
        score: 0,
      },
    ];

    this.redTeamSuites.set('comprehensive', comprehensiveTests);
  }

  /**
   * Start drift monitoring background process
   */
  private startDriftMonitoring(): void {
    // Run drift monitoring every hour
    setInterval(async () => {
      try {
        await this.performDriftMonitoring();
      } catch (error) {
        logger.error('Drift monitoring failed', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Perform periodic drift monitoring
   */
  private async performDriftMonitoring(): Promise<void> {
    try {
      // Get all active embedding models
      const modelsResult = await this.db.query(
        'SELECT id FROM ai_models WHERE model_type = $1 AND status = $2',
        ['embedding', 'active']
      );

      for (const model of modelsResult.rows) {
        // Check recent embeddings for drift
        const recentEmbeddings = await this.db.query(`
          SELECT output_data FROM ai_outputs 
          WHERE model_id = $1 AND created_at > NOW() - INTERVAL '1 hour'
          ORDER BY created_at DESC
          LIMIT 10
        `, [model.id]);

        for (const output of recentEmbeddings.rows) {
          const outputData = JSON.parse(output.output_data);
          if (outputData.embedding) {
            await this.checkEmbeddingDrift(model.id, outputData.embedding);
          }
        }
      }
    } catch (error) {
      logger.error('Error in drift monitoring', error);
    }
  }
}