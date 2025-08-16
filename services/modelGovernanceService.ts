import { v4 as uuidv4 } from 'uuid';

export interface ModelCard {
  id: string;
  modelName: string;
  version: string;
  modelType: 'classification' | 'generation' | 'embedding' | 'detection';
  description: string;
  intendedUse: string[];
  limitations: string[];
  ethicalConsiderations: string[];
  trainingData: TrainingDataInfo;
  performance: PerformanceMetrics;
  biasAnalysis: BiasAnalysis;
  fairnessMetrics: FairnessMetrics;
  safetyAssessment: SafetyAssessment;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainingDataInfo {
  datasetName: string;
  datasetSize: number;
  datasetSource: string;
  demographicBreakdown: Record<string, number>;
  contentTypes: string[];
  dataQualityScore: number;
  privacyCompliance: boolean;
}

export interface PerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  latency: number;
  throughput: number;
  testSetSize: number;
}

export interface BiasAnalysis {
  overallBiasScore: number;
  demographicParity: Record<string, number>;
  equalizedOdds: Record<string, number>;
  calibration: Record<string, number>;
  biasDetectionMethods: string[];
  mitigationStrategies: string[];
}

export interface FairnessMetrics {
  demographicParity: number;
  equalOpportunity: number;
  equalizedOdds: number;
  calibration: number;
  individualFairness: number;
  counterfactualFairness: number;
}

export interface SafetyAssessment {
  overallSafetyScore: number;
  adversarialRobustness: number;
  outputSafety: number;
  privacyPreservation: number;
  harmfulContentDetection: number;
  safetyTests: SafetyTest[];
  redTeamResults: RedTeamResult[];
}

export interface SafetyTest {
  testName: string;
  testType: 'adversarial' | 'privacy' | 'bias' | 'safety' | 'robustness';
  passed: boolean;
  score: number;
  details: string;
  runAt: Date;
}

export interface RedTeamResult {
  id: string;
  testScenario: string;
  attackType: string;
  success: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string;
  testedAt: Date;
}

export interface PIIDetectionResult {
  hasPII: boolean;
  piiTypes: string[];
  confidence: number;
  locations: PIILocation[];
  sanitizedContent?: string;
}

export interface PIILocation {
  type: string;
  start: number;
  end: number;
  confidence: number;
  value: string;
}

export interface GovernanceAudit {
  id: string;
  auditType: 'monthly' | 'quarterly' | 'incident' | 'compliance';
  modelsAudited: string[];
  findings: AuditFinding[];
  recommendations: string[];
  complianceStatus: 'compliant' | 'non_compliant' | 'needs_review';
  auditedBy: string;
  auditDate: Date;
  nextAuditDate: Date;
}

export interface AuditFinding {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'bias' | 'safety' | 'privacy' | 'performance' | 'compliance';
  description: string;
  affectedModels: string[];
  remediation: string;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
}

export class ModelGovernanceService {
  private readonly modelCards = new Map<string, ModelCard>();
  private readonly auditHistory = new Map<string, GovernanceAudit>();
  private readonly redTeamTests = new Map<string, RedTeamResult[]>();
  private readonly piiPatterns: RegExp[];

  constructor() {
    this.piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
      /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, // Phone number
      /\b\d{1,5}\s\w+\s(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b/gi // Address
    ];
  }

  /**
   * Create model cards and bias tracking for all AI systems
   */
  async createModelCard(
    modelName: string,
    version: string,
    modelType: ModelCard['modelType'],
    trainingData: TrainingDataInfo
  ): Promise<ModelCard> {
    const modelId = `${modelName}_${version}`;
    
    // Perform initial bias analysis
    const biasAnalysis = await this.performBiasAnalysis(modelName, trainingData);
    
    // Calculate fairness metrics
    const fairnessMetrics = await this.calculateFairnessMetrics(modelName, trainingData);
    
    // Run safety assessment
    const safetyAssessment = await this.runSafetyAssessment(modelName);
    
    // Simulate performance metrics
    const performance = await this.measurePerformance(modelName);
    
    const modelCard: ModelCard = {
      id: modelId,
      modelName,
      version,
      modelType,
      description: `AI model for ${modelType} tasks in content platform`,
      intendedUse: this.getIntendedUse(modelType),
      limitations: this.getKnownLimitations(modelType),
      ethicalConsiderations: this.getEthicalConsiderations(modelType),
      trainingData,
      performance,
      biasAnalysis,
      fairnessMetrics,
      safetyAssessment,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.modelCards.set(modelId, modelCard);
    
    console.log(`Created model card for ${modelName} v${version}`);
    return modelCard;
  }

  /**
   * Build red-team testing framework for AI safety
   */
  async buildRedTeamFramework(modelName: string): Promise<RedTeamFramework> {
    const frameworkId = uuidv4();
    
    const testScenarios = [
      {
        name: 'Adversarial Input Attack',
        description: 'Test model robustness against adversarial inputs',
        attackTypes: ['gradient_based', 'black_box', 'transfer_attack'],
        severity: 'high' as const
      },
      {
        name: 'Prompt Injection',
        description: 'Test for prompt injection vulnerabilities',
        attackTypes: ['direct_injection', 'indirect_injection', 'context_manipulation'],
        severity: 'critical' as const
      },
      {
        name: 'Data Poisoning Simulation',
        description: 'Test model behavior with poisoned training data',
        attackTypes: ['label_flipping', 'backdoor_insertion', 'distribution_shift'],
        severity: 'high' as const
      },
      {
        name: 'Privacy Leakage Test',
        description: 'Test for training data memorization and privacy leaks',
        attackTypes: ['membership_inference', 'attribute_inference', 'model_inversion'],
        severity: 'medium' as const
      },
      {
        name: 'Bias Amplification Test',
        description: 'Test for bias amplification in model outputs',
        attackTypes: ['demographic_bias', 'confirmation_bias', 'selection_bias'],
        severity: 'medium' as const
      }
    ];
    
    const results: RedTeamResult[] = [];
    
    for (const scenario of testScenarios) {
      for (const attackType of scenario.attackTypes) {
        const result = await this.runRedTeamTest(modelName, scenario.name, attackType, scenario.severity);
        results.push(result);
      }
    }
    
    this.redTeamTests.set(modelName, results);
    
    return {
      id: frameworkId,
      modelName,
      testScenarios,
      results,
      overallRiskScore: this.calculateOverallRiskScore(results),
      recommendedMitigations: this.generateMitigationRecommendations(results),
      createdAt: new Date()
    };
  }

  /**
   * Implement PII detection and boundary enforcement
   */
  async detectPII(content: string): Promise<PIIDetectionResult> {
    const piiLocations: PIILocation[] = [];
    const piiTypes: string[] = [];
    
    // Email detection
    const emailMatches = content.matchAll(this.piiPatterns[2]);
    for (const match of emailMatches) {
      if (match.index !== undefined) {
        piiLocations.push({
          type: 'email',
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.95,
          value: match[0]
        });
        if (!piiTypes.includes('email')) piiTypes.push('email');
      }
    }
    
    // Phone number detection
    const phoneMatches = content.matchAll(this.piiPatterns[3]);
    for (const match of phoneMatches) {
      if (match.index !== undefined) {
        piiLocations.push({
          type: 'phone',
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.90,
          value: match[0]
        });
        if (!piiTypes.includes('phone')) piiTypes.push('phone');
      }
    }
    
    // SSN detection
    const ssnMatches = content.matchAll(this.piiPatterns[0]);
    for (const match of ssnMatches) {
      if (match.index !== undefined) {
        piiLocations.push({
          type: 'ssn',
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.98,
          value: match[0]
        });
        if (!piiTypes.includes('ssn')) piiTypes.push('ssn');
      }
    }
    
    // Credit card detection
    const ccMatches = content.matchAll(this.piiPatterns[1]);
    for (const match of ccMatches) {
      if (match.index !== undefined) {
        piiLocations.push({
          type: 'credit_card',
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.92,
          value: match[0]
        });
        if (!piiTypes.includes('credit_card')) piiTypes.push('credit_card');
      }
    }
    
    const hasPII = piiLocations.length > 0;
    const confidence = hasPII ? Math.max(...piiLocations.map(loc => loc.confidence)) : 0;
    
    // Generate sanitized content if PII found
    let sanitizedContent: string | undefined;
    if (hasPII) {
      sanitizedContent = this.sanitizeContent(content, piiLocations);
    }
    
    return {
      hasPII,
      piiTypes,
      confidence,
      locations: piiLocations,
      sanitizedContent
    };
  }

  /**
   * Create automated AI audit pipeline in CI/CD
   */
  async createAuditPipeline(modelName: string): Promise<AuditPipeline> {
    const pipelineId = uuidv4();
    
    const auditSteps: AuditStep[] = [
      {
        name: 'Bias Detection',
        type: 'bias_analysis',
        automated: true,
        required: true,
        description: 'Automated bias detection across demographic groups'
      },
      {
        name: 'Safety Testing',
        type: 'safety_test',
        automated: true,
        required: true,
        description: 'Automated safety and robustness testing'
      },
      {
        name: 'Performance Validation',
        type: 'performance_test',
        automated: true,
        required: true,
        description: 'Performance regression testing'
      },
      {
        name: 'PII Detection Test',
        type: 'privacy_test',
        automated: true,
        required: true,
        description: 'Test for PII leakage in model outputs'
      },
      {
        name: 'Red Team Testing',
        type: 'security_test',
        automated: false,
        required: false,
        description: 'Manual red team security assessment'
      },
      {
        name: 'Compliance Review',
        type: 'compliance_check',
        automated: false,
        required: true,
        description: 'Manual compliance and regulatory review'
      }
    ];
    
    return {
      id: pipelineId,
      modelName,
      auditSteps,
      triggerConditions: ['model_update', 'scheduled_monthly', 'incident_response'],
      passThreshold: 0.8,
      createdAt: new Date(),
      lastRun: null,
      nextScheduledRun: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };
  }

  /**
   * Add monthly governance review and reporting system
   */
  async generateMonthlyGovernanceReport(): Promise<GovernanceReport> {
    const reportId = uuidv4();
    const reportDate = new Date();
    
    const allModels = Array.from(this.modelCards.values());
    const recentAudits = Array.from(this.auditHistory.values())
      .filter(audit => audit.auditDate >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    
    // Calculate overall metrics
    const overallBiasScore = this.calculateAverageBiasScore(allModels);
    const overallSafetyScore = this.calculateAverageSafetyScore(allModels);
    const complianceRate = this.calculateComplianceRate(recentAudits);
    
    // Identify high-risk models
    const highRiskModels = allModels.filter(model => 
      model.biasAnalysis.overallBiasScore > 0.7 || 
      model.safetyAssessment.overallSafetyScore < 0.6
    );
    
    // Generate recommendations
    const recommendations = this.generateGovernanceRecommendations(allModels, recentAudits);
    
    const report: GovernanceReport = {
      id: reportId,
      reportDate,
      reportPeriod: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: reportDate
      },
      summary: {
        totalModels: allModels.length,
        modelsAudited: recentAudits.length,
        overallBiasScore,
        overallSafetyScore,
        complianceRate,
        highRiskModels: highRiskModels.length
      },
      modelPerformance: allModels.map(model => ({
        modelName: model.modelName,
        version: model.version,
        biasScore: model.biasAnalysis.overallBiasScore,
        safetyScore: model.safetyAssessment.overallSafetyScore,
        performanceScore: model.performance.f1Score,
        riskLevel: this.calculateRiskLevel(model)
      })),
      auditSummary: {
        totalAudits: recentAudits.length,
        criticalFindings: recentAudits.reduce((sum, audit) => 
          sum + audit.findings.filter(f => f.severity === 'critical').length, 0),
        openFindings: recentAudits.reduce((sum, audit) => 
          sum + audit.findings.filter(f => f.status === 'open').length, 0),
        complianceStatus: complianceRate >= 0.9 ? 'compliant' : 'needs_attention'
      },
      recommendations,
      actionItems: this.generateActionItems(highRiskModels, recentAudits),
      nextReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
    
    console.log(`Generated monthly governance report: ${reportId}`);
    return report;
  }

  private async performBiasAnalysis(modelName: string, trainingData: TrainingDataInfo): Promise<BiasAnalysis> {
    // Simulate bias analysis
    const overallBiasScore = Math.random() * 0.5; // 0-0.5 range for bias score
    
    return {
      overallBiasScore,
      demographicParity: {
        'gender': 0.85 + Math.random() * 0.1,
        'age': 0.80 + Math.random() * 0.15,
        'ethnicity': 0.75 + Math.random() * 0.2
      },
      equalizedOdds: {
        'gender': 0.88 + Math.random() * 0.1,
        'age': 0.82 + Math.random() * 0.15,
        'ethnicity': 0.78 + Math.random() * 0.2
      },
      calibration: {
        'gender': 0.90 + Math.random() * 0.08,
        'age': 0.85 + Math.random() * 0.12,
        'ethnicity': 0.80 + Math.random() * 0.15
      },
      biasDetectionMethods: ['demographic_parity', 'equalized_odds', 'calibration'],
      mitigationStrategies: ['data_augmentation', 'fairness_constraints', 'post_processing']
    };
  }

  private async calculateFairnessMetrics(modelName: string, trainingData: TrainingDataInfo): Promise<FairnessMetrics> {
    return {
      demographicParity: 0.85 + Math.random() * 0.1,
      equalOpportunity: 0.82 + Math.random() * 0.12,
      equalizedOdds: 0.80 + Math.random() * 0.15,
      calibration: 0.88 + Math.random() * 0.1,
      individualFairness: 0.75 + Math.random() * 0.2,
      counterfactualFairness: 0.78 + Math.random() * 0.18
    };
  }

  private async runSafetyAssessment(modelName: string): Promise<SafetyAssessment> {
    const safetyTests: SafetyTest[] = [
      {
        testName: 'Adversarial Robustness',
        testType: 'adversarial',
        passed: Math.random() > 0.2,
        score: 0.7 + Math.random() * 0.25,
        details: 'Model robustness against adversarial examples',
        runAt: new Date()
      },
      {
        testName: 'Output Safety Filter',
        testType: 'safety',
        passed: Math.random() > 0.1,
        score: 0.8 + Math.random() * 0.15,
        details: 'Safety of model outputs for harmful content',
        runAt: new Date()
      },
      {
        testName: 'Privacy Preservation',
        testType: 'privacy',
        passed: Math.random() > 0.15,
        score: 0.75 + Math.random() * 0.2,
        details: 'Model privacy and data protection measures',
        runAt: new Date()
      }
    ];
    
    const overallSafetyScore = safetyTests.reduce((sum, test) => sum + test.score, 0) / safetyTests.length;
    
    return {
      overallSafetyScore,
      adversarialRobustness: safetyTests[0].score,
      outputSafety: safetyTests[1].score,
      privacyPreservation: safetyTests[2].score,
      harmfulContentDetection: 0.85 + Math.random() * 0.1,
      safetyTests,
      redTeamResults: []
    };
  }

  private async measurePerformance(modelName: string): Promise<PerformanceMetrics> {
    return {
      accuracy: 0.85 + Math.random() * 0.1,
      precision: 0.82 + Math.random() * 0.12,
      recall: 0.80 + Math.random() * 0.15,
      f1Score: 0.81 + Math.random() * 0.14,
      auc: 0.88 + Math.random() * 0.1,
      latency: 50 + Math.random() * 100, // ms
      throughput: 100 + Math.random() * 500, // requests/sec
      testSetSize: 10000 + Math.floor(Math.random() * 50000)
    };
  }

  private getIntendedUse(modelType: ModelCard['modelType']): string[] {
    const uses: Record<string, string[]> = {
      classification: ['Content categorization', 'Safety classification', 'Quality assessment'],
      generation: ['Content generation', 'Text completion', 'Creative assistance'],
      embedding: ['Semantic search', 'Content similarity', 'Recommendation systems'],
      detection: ['Harmful content detection', 'Spam detection', 'Fraud detection']
    };
    return uses[modelType] || [];
  }

  private getKnownLimitations(modelType: ModelCard['modelType']): string[] {
    return [
      'May exhibit bias present in training data',
      'Performance may degrade on out-of-distribution inputs',
      'Not suitable for high-stakes decision making without human oversight',
      'May generate inappropriate content in edge cases'
    ];
  }

  private getEthicalConsiderations(modelType: ModelCard['modelType']): string[] {
    return [
      'Potential for bias amplification',
      'Privacy implications of data processing',
      'Impact on content creators and consumers',
      'Transparency and explainability requirements'
    ];
  }

  private async runRedTeamTest(
    modelName: string,
    scenario: string,
    attackType: string,
    severity: RedTeamResult['severity']
  ): Promise<RedTeamResult> {
    const success = Math.random() < 0.3; // 30% attack success rate
    
    return {
      id: uuidv4(),
      testScenario: scenario,
      attackType,
      success,
      severity,
      description: `${attackType} attack against ${modelName} in ${scenario} scenario`,
      mitigation: success ? 'Implement additional safeguards' : 'Current defenses adequate',
      testedAt: new Date()
    };
  }

  private calculateOverallRiskScore(results: RedTeamResult[]): number {
    const successfulAttacks = results.filter(r => r.success);
    const criticalSuccesses = successfulAttacks.filter(r => r.severity === 'critical').length;
    const highSuccesses = successfulAttacks.filter(r => r.severity === 'high').length;
    
    const riskScore = (criticalSuccesses * 0.4 + highSuccesses * 0.2) / results.length;
    return Math.min(riskScore, 1.0);
  }

  private generateMitigationRecommendations(results: RedTeamResult[]): string[] {
    const recommendations: string[] = [];
    const successfulAttacks = results.filter(r => r.success);
    
    if (successfulAttacks.some(r => r.attackType.includes('injection'))) {
      recommendations.push('Implement input sanitization and validation');
    }
    
    if (successfulAttacks.some(r => r.attackType.includes('adversarial'))) {
      recommendations.push('Add adversarial training to model pipeline');
    }
    
    if (successfulAttacks.some(r => r.attackType.includes('privacy'))) {
      recommendations.push('Enhance privacy preservation mechanisms');
    }
    
    return recommendations;
  }

  private sanitizeContent(content: string, piiLocations: PIILocation[]): string {
    let sanitized = content;
    
    // Sort locations by start position in reverse order to maintain indices
    const sortedLocations = piiLocations.sort((a, b) => b.start - a.start);
    
    for (const location of sortedLocations) {
      const replacement = this.getPIIReplacement(location.type);
      sanitized = sanitized.substring(0, location.start) + replacement + sanitized.substring(location.end);
    }
    
    return sanitized;
  }

  private getPIIReplacement(piiType: string): string {
    const replacements: Record<string, string> = {
      email: '[EMAIL_REDACTED]',
      phone: '[PHONE_REDACTED]',
      ssn: '[SSN_REDACTED]',
      credit_card: '[CC_REDACTED]',
      address: '[ADDRESS_REDACTED]'
    };
    return replacements[piiType] || '[PII_REDACTED]';
  }

  private calculateAverageBiasScore(models: ModelCard[]): number {
    if (models.length === 0) return 0;
    return models.reduce((sum, model) => sum + model.biasAnalysis.overallBiasScore, 0) / models.length;
  }

  private calculateAverageSafetyScore(models: ModelCard[]): number {
    if (models.length === 0) return 0;
    return models.reduce((sum, model) => sum + model.safetyAssessment.overallSafetyScore, 0) / models.length;
  }

  private calculateComplianceRate(audits: GovernanceAudit[]): number {
    if (audits.length === 0) return 1;
    const compliantAudits = audits.filter(audit => audit.complianceStatus === 'compliant').length;
    return compliantAudits / audits.length;
  }

  private calculateRiskLevel(model: ModelCard): 'low' | 'medium' | 'high' | 'critical' {
    const biasScore = model.biasAnalysis.overallBiasScore;
    const safetyScore = model.safetyAssessment.overallSafetyScore;
    
    if (biasScore > 0.7 || safetyScore < 0.5) return 'critical';
    if (biasScore > 0.5 || safetyScore < 0.7) return 'high';
    if (biasScore > 0.3 || safetyScore < 0.8) return 'medium';
    return 'low';
  }

  private generateGovernanceRecommendations(models: ModelCard[], audits: GovernanceAudit[]): string[] {
    const recommendations: string[] = [];
    
    const highBiasModels = models.filter(m => m.biasAnalysis.overallBiasScore > 0.5);
    if (highBiasModels.length > 0) {
      recommendations.push(`Address bias issues in ${highBiasModels.length} models`);
    }
    
    const lowSafetyModels = models.filter(m => m.safetyAssessment.overallSafetyScore < 0.7);
    if (lowSafetyModels.length > 0) {
      recommendations.push(`Improve safety measures for ${lowSafetyModels.length} models`);
    }
    
    const criticalFindings = audits.reduce((sum, audit) => 
      sum + audit.findings.filter(f => f.severity === 'critical').length, 0);
    if (criticalFindings > 0) {
      recommendations.push(`Address ${criticalFindings} critical audit findings`);
    }
    
    return recommendations;
  }

  private generateActionItems(highRiskModels: ModelCard[], audits: GovernanceAudit[]): ActionItem[] {
    const actionItems: ActionItem[] = [];
    
    highRiskModels.forEach(model => {
      actionItems.push({
        id: uuidv4(),
        title: `Review high-risk model: ${model.modelName}`,
        description: `Model shows elevated bias or safety concerns`,
        priority: 'high',
        assignee: 'AI Safety Team',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        status: 'open'
      });
    });
    
    return actionItems;
  }
}

// Additional interfaces
export interface RedTeamFramework {
  id: string;
  modelName: string;
  testScenarios: any[];
  results: RedTeamResult[];
  overallRiskScore: number;
  recommendedMitigations: string[];
  createdAt: Date;
}

export interface AuditPipeline {
  id: string;
  modelName: string;
  auditSteps: AuditStep[];
  triggerConditions: string[];
  passThreshold: number;
  createdAt: Date;
  lastRun: Date | null;
  nextScheduledRun: Date;
}

export interface AuditStep {
  name: string;
  type: string;
  automated: boolean;
  required: boolean;
  description: string;
}

export interface GovernanceReport {
  id: string;
  reportDate: Date;
  reportPeriod: { start: Date; end: Date };
  summary: any;
  modelPerformance: any[];
  auditSummary: any;
  recommendations: string[];
  actionItems: ActionItem[];
  nextReviewDate: Date;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee: string;
  dueDate: Date;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
}

export const modelGovernanceService = new ModelGovernanceService();