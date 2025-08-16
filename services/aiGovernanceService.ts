import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface ModelCard {
  id: string;
  modelName: string;
  version: string;
  description: string;
  intendedUse: string[];
  limitations: string[];
  ethicalConsiderations: string[];
  trainingData: {
    sources: string[];
    size: number;
    demographics?: Record<string, number>;
    biasAssessment: BiasAssessment;
  };
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    fairnessMetrics: Record<string, number>;
  };
  deployment: {
    environment: 'production' | 'staging' | 'development';
    deployedAt: Date;
    lastUpdated: Date;
    rollbackVersion?: string;
  };
  governance: {
    approvedBy: string;
    reviewDate: Date;
    nextReviewDate: Date;
    complianceStatus: 'compliant' | 'under_review' | 'non_compliant';
  };
}

export interface BiasAssessment {
  id: string;
  modelId: string;
  assessmentDate: Date;
  protectedAttributes: string[];
  biasMetrics: {
    demographicParity: number;
    equalizedOdds: number;
    calibration: number;
    individualFairness: number;
  };
  findings: BiasFinding[];
  mitigationStrategies: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface BiasFinding {
  attribute: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  impact: string;
  recommendation: string;
}

export interface RedTeamTest {
  id: string;
  modelId: string;
  testType: 'adversarial' | 'prompt_injection' | 'data_poisoning' | 'privacy_leak' | 'bias_amplification';
  testDescription: string;
  testInputs: any[];
  expectedOutputs: any[];
  actualOutputs: any[];
  passed: boolean;
  vulnerabilities: Vulnerability[];
  executedAt: Date;
  executedBy: string;
}

export interface Vulnerability {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  mitigation: string;
  status: 'open' | 'mitigated' | 'accepted' | 'false_positive';
}

export interface PIIDetectionResult {
  id: string;
  modelId: string;
  inputText: string;
  detectedPII: PIIEntity[];
  riskScore: number;
  blocked: boolean;
  timestamp: Date;
}

export interface PIIEntity {
  type: 'email' | 'phone' | 'ssn' | 'credit_card' | 'name' | 'address' | 'custom';
  value: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

export interface GovernanceReport {
  id: string;
  reportType: 'monthly' | 'quarterly' | 'annual' | 'incident';
  generatedAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalModels: number;
    modelsInProduction: number;
    biasAssessments: number;
    redTeamTests: number;
    vulnerabilities: number;
    piiIncidents: number;
  };
  findings: GovernanceFinding[];
  recommendations: string[];
  complianceStatus: 'compliant' | 'needs_attention' | 'non_compliant';
}

export interface GovernanceFinding {
  category: 'bias' | 'security' | 'privacy' | 'performance' | 'compliance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedModels: string[];
  recommendation: string;
  dueDate?: Date;
}

export class AIGovernanceService {
  private readonly modelCards = new Map<string, ModelCard>();
  private readonly biasAssessments = new Map<string, BiasAssessment>();
  private readonly redTeamTests = new Map<string, RedTeamTest>();
  private readonly piiDetectionResults = new Map<string, PIIDetectionResult>();
  private readonly governanceReports = new Map<string, GovernanceReport>();

  /**
   * Create or update model card
   */
  async createModelCard(modelData: Omit<ModelCard, 'id' | 'deployment' | 'governance'>): Promise<ModelCard> {
    const modelId = uuidv4();
    
    const modelCard: ModelCard = {
      ...modelData,
      id: modelId,
      deployment: {
        environment: 'development',
        deployedAt: new Date(),
        lastUpdated: new Date()
      },
      governance: {
        approvedBy: 'system',
        reviewDate: new Date(),
        nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        complianceStatus: 'under_review'
      }
    };
    
    this.modelCards.set(modelId, modelCard);
    
    console.log(`Created model card for ${modelData.modelName} v${modelData.version}`);
    return modelCard;
  }

  /**
   * Conduct bias assessment for a model
   */
  async conductBiasAssessment(
    modelId: string,
    testData: any[],
    protectedAttributes: string[]
  ): Promise<BiasAssessment> {
    const modelCard = this.modelCards.get(modelId);
    if (!modelCard) {
      throw new Error('Model card not found');
    }

    const assessmentId = uuidv4();
    
    // Simulate bias testing
    const biasMetrics = await this.calculateBiasMetrics(testData, protectedAttributes);
    const findings = await this.analyzeBiasFindings(biasMetrics, protectedAttributes);
    const riskLevel = this.calculateBiasRiskLevel(findings);
    
    const assessment: BiasAssessment = {
      id: assessmentId,
      modelId,
      assessmentDate: new Date(),
      protectedAttributes,
      biasMetrics,
      findings,
      mitigationStrategies: this.generateMitigationStrategies(findings),
      riskLevel
    };
    
    this.biasAssessments.set(assessmentId, assessment);
    
    // Update model card with bias assessment
    modelCard.trainingData.biasAssessment = assessment;
    
    console.log(`Completed bias assessment for model ${modelId} with risk level: ${riskLevel}`);
    return assessment;
  }

  /**
   * Execute red team testing
   */
  async executeRedTeamTest(
    modelId: string,
    testType: RedTeamTest['testType'],
    testDescription: string,
    testInputs: any[]
  ): Promise<RedTeamTest> {
    const modelCard = this.modelCards.get(modelId);
    if (!modelCard) {
      throw new Error('Model card not found');
    }

    const testId = uuidv4();
    
    // Execute test based on type
    const testResults = await this.runRedTeamTest(testType, testInputs, modelId);
    
    const redTeamTest: RedTeamTest = {
      id: testId,
      modelId,
      testType,
      testDescription,
      testInputs,
      expectedOutputs: testResults.expected,
      actualOutputs: testResults.actual,
      passed: testResults.passed,
      vulnerabilities: testResults.vulnerabilities,
      executedAt: new Date(),
      executedBy: 'automated_red_team'
    };
    
    this.redTeamTests.set(testId, redTeamTest);
    
    console.log(`Red team test ${testType} for model ${modelId}: ${testResults.passed ? 'PASSED' : 'FAILED'}`);
    return redTeamTest;
  }

  /**
   * Detect PII in model inputs/outputs
   */
  async detectPII(
    modelId: string,
    inputText: string,
    outputText?: string
  ): Promise<PIIDetectionResult> {
    const detectionId = uuidv4();
    
    // Detect PII in input
    const inputPII = this.extractPIIEntities(inputText);
    const outputPII = outputText ? this.extractPIIEntities(outputText) : [];
    
    const allPII = [...inputPII, ...outputPII];
    const riskScore = this.calculatePIIRiskScore(allPII);
    const blocked = riskScore > 0.7; // Block if high risk
    
    const result: PIIDetectionResult = {
      id: detectionId,
      modelId,
      inputText: blocked ? '[REDACTED]' : inputText,
      detectedPII: allPII,
      riskScore,
      blocked,
      timestamp: new Date()
    };
    
    this.piiDetectionResults.set(detectionId, result);
    
    if (blocked) {
      console.warn(`PII detected and blocked for model ${modelId}. Risk score: ${riskScore}`);
    }
    
    return result;
  }

  /**
   * Enforce boundary controls for AI models
   */
  async enforceBoundaries(
    modelId: string,
    input: any,
    context: {
      userId?: string;
      sessionId?: string;
      contentType?: string;
    }
  ): Promise<{
    allowed: boolean;
    reason?: string;
    sanitizedInput?: any;
  }> {
    const modelCard = this.modelCards.get(modelId);
    if (!modelCard) {
      return { allowed: false, reason: 'Model not found' };
    }

    // Check if model is approved for production use
    if (modelCard.governance.complianceStatus === 'non_compliant') {
      return { allowed: false, reason: 'Model not compliant for production use' };
    }

    // Check PII in input
    if (typeof input === 'string') {
      const piiResult = await this.detectPII(modelId, input);
      if (piiResult.blocked) {
        return { 
          allowed: false, 
          reason: 'PII detected in input',
          sanitizedInput: this.sanitizeInput(input, piiResult.detectedPII)
        };
      }
    }

    // Check rate limits and usage patterns
    const rateLimitCheck = await this.checkRateLimits(modelId, context.userId);
    if (!rateLimitCheck.allowed) {
      return { allowed: false, reason: rateLimitCheck.reason };
    }

    // Check content appropriateness
    const contentCheck = await this.checkContentAppropriate(input, context.contentType);
    if (!contentCheck.appropriate) {
      return { allowed: false, reason: contentCheck.reason };
    }

    return { allowed: true };
  }

  /**
   * Generate monthly governance report
   */
  async generateGovernanceReport(
    reportType: GovernanceReport['reportType'] = 'monthly'
  ): Promise<GovernanceReport> {
    const reportId = uuidv4();
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // Collect statistics
    const totalModels = this.modelCards.size;
    const modelsInProduction = Array.from(this.modelCards.values())
      .filter(m => m.deployment.environment === 'production').length;
    
    const recentAssessments = Array.from(this.biasAssessments.values())
      .filter(a => a.assessmentDate >= startDate && a.assessmentDate <= endDate);
    
    const recentTests = Array.from(this.redTeamTests.values())
      .filter(t => t.executedAt >= startDate && t.executedAt <= endDate);
    
    const recentPIIIncidents = Array.from(this.piiDetectionResults.values())
      .filter(p => p.timestamp >= startDate && p.timestamp <= endDate && p.blocked);
    
    const vulnerabilities = recentTests.flatMap(t => t.vulnerabilities)
      .filter(v => v.status === 'open');
    
    // Generate findings
    const findings = await this.generateGovernanceFindings(
      recentAssessments,
      recentTests,
      vulnerabilities,
      recentPIIIncidents
    );
    
    const report: GovernanceReport = {
      id: reportId,
      reportType,
      generatedAt: now,
      period: { startDate, endDate },
      summary: {
        totalModels,
        modelsInProduction,
        biasAssessments: recentAssessments.length,
        redTeamTests: recentTests.length,
        vulnerabilities: vulnerabilities.length,
        piiIncidents: recentPIIIncidents.length
      },
      findings,
      recommendations: this.generateRecommendations(findings),
      complianceStatus: this.calculateOverallCompliance(findings)
    };
    
    this.governanceReports.set(reportId, report);
    
    console.log(`Generated ${reportType} governance report with ${findings.length} findings`);
    return report;
  }

  /**
   * Get model governance dashboard data
   */
  async getGovernanceDashboard(): Promise<{
    modelOverview: {
      total: number;
      production: number;
      underReview: number;
      nonCompliant: number;
    };
    riskSummary: {
      highRiskModels: number;
      openVulnerabilities: number;
      recentPIIIncidents: number;
      overdueReviews: number;
    };
    recentActivity: {
      biasAssessments: BiasAssessment[];
      redTeamTests: RedTeamTest[];
      piiDetections: PIIDetectionResult[];
    };
  }> {
    const models = Array.from(this.modelCards.values());
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return {
      modelOverview: {
        total: models.length,
        production: models.filter(m => m.deployment.environment === 'production').length,
        underReview: models.filter(m => m.governance.complianceStatus === 'under_review').length,
        nonCompliant: models.filter(m => m.governance.complianceStatus === 'non_compliant').length
      },
      riskSummary: {
        highRiskModels: Array.from(this.biasAssessments.values())
          .filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical').length,
        openVulnerabilities: Array.from(this.redTeamTests.values())
          .flatMap(t => t.vulnerabilities)
          .filter(v => v.status === 'open').length,
        recentPIIIncidents: Array.from(this.piiDetectionResults.values())
          .filter(p => p.timestamp >= weekAgo && p.blocked).length,
        overdueReviews: models.filter(m => m.governance.nextReviewDate < now).length
      },
      recentActivity: {
        biasAssessments: Array.from(this.biasAssessments.values())
          .filter(a => a.assessmentDate >= weekAgo)
          .sort((a, b) => b.assessmentDate.getTime() - a.assessmentDate.getTime())
          .slice(0, 5),
        redTeamTests: Array.from(this.redTeamTests.values())
          .filter(t => t.executedAt >= weekAgo)
          .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
          .slice(0, 5),
        piiDetections: Array.from(this.piiDetectionResults.values())
          .filter(p => p.timestamp >= weekAgo && p.blocked)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 5)
      }
    };
  }

  // Private helper methods
  private async calculateBiasMetrics(
    testData: any[],
    protectedAttributes: string[]
  ): Promise<BiasAssessment['biasMetrics']> {
    // Simulate bias metric calculations
    return {
      demographicParity: Math.random() * 0.2, // 0-0.2 range
      equalizedOdds: Math.random() * 0.15,
      calibration: Math.random() * 0.1,
      individualFairness: Math.random() * 0.25
    };
  }

  private async analyzeBiasFindings(
    metrics: BiasAssessment['biasMetrics'],
    protectedAttributes: string[]
  ): Promise<BiasFinding[]> {
    const findings: BiasFinding[] = [];
    
    if (metrics.demographicParity > 0.1) {
      findings.push({
        attribute: 'demographic_parity',
        description: 'Significant demographic parity violation detected',
        severity: metrics.demographicParity > 0.15 ? 'high' : 'medium',
        impact: 'Model may discriminate against protected groups',
        recommendation: 'Rebalance training data and apply fairness constraints'
      });
    }
    
    if (metrics.equalizedOdds > 0.1) {
      findings.push({
        attribute: 'equalized_odds',
        description: 'Equalized odds violation detected',
        severity: metrics.equalizedOdds > 0.12 ? 'high' : 'medium',
        impact: 'Different error rates across protected groups',
        recommendation: 'Apply post-processing fairness techniques'
      });
    }
    
    return findings;
  }

  private calculateBiasRiskLevel(findings: BiasFinding[]): BiasAssessment['riskLevel'] {
    const highSeverityCount = findings.filter(f => f.severity === 'high').length;
    const mediumSeverityCount = findings.filter(f => f.severity === 'medium').length;
    
    if (highSeverityCount >= 2) return 'critical';
    if (highSeverityCount >= 1) return 'high';
    if (mediumSeverityCount >= 2) return 'medium';
    return 'low';
  }

  private generateMitigationStrategies(findings: BiasFinding[]): string[] {
    const strategies = new Set<string>();
    
    findings.forEach(finding => {
      if (finding.attribute === 'demographic_parity') {
        strategies.add('Implement demographic parity constraints during training');
        strategies.add('Augment training data for underrepresented groups');
      }
      if (finding.attribute === 'equalized_odds') {
        strategies.add('Apply equalized odds post-processing');
        strategies.add('Use adversarial debiasing techniques');
      }
    });
    
    return Array.from(strategies);
  }

  private async runRedTeamTest(
    testType: RedTeamTest['testType'],
    testInputs: any[],
    modelId: string
  ): Promise<{
    expected: any[];
    actual: any[];
    passed: boolean;
    vulnerabilities: Vulnerability[];
  }> {
    const vulnerabilities: Vulnerability[] = [];
    
    // Simulate different test types
    switch (testType) {
      case 'adversarial':
        // Test adversarial inputs
        if (Math.random() < 0.3) { // 30% chance of finding vulnerability
          vulnerabilities.push({
            id: uuidv4(),
            type: 'adversarial_attack',
            severity: 'medium',
            description: 'Model susceptible to adversarial perturbations',
            impact: 'Incorrect predictions on maliciously crafted inputs',
            mitigation: 'Implement adversarial training',
            status: 'open'
          });
        }
        break;
        
      case 'prompt_injection':
        // Test prompt injection attacks
        if (Math.random() < 0.2) { // 20% chance
          vulnerabilities.push({
            id: uuidv4(),
            type: 'prompt_injection',
            severity: 'high',
            description: 'Model vulnerable to prompt injection attacks',
            impact: 'Unauthorized access to system prompts or data',
            mitigation: 'Implement input sanitization and prompt filtering',
            status: 'open'
          });
        }
        break;
        
      case 'privacy_leak':
        // Test for privacy leaks
        if (Math.random() < 0.15) { // 15% chance
          vulnerabilities.push({
            id: uuidv4(),
            type: 'privacy_leak',
            severity: 'critical',
            description: 'Model may leak training data information',
            impact: 'Potential exposure of sensitive training data',
            mitigation: 'Implement differential privacy techniques',
            status: 'open'
          });
        }
        break;
    }
    
    return {
      expected: testInputs.map(() => 'safe_output'),
      actual: testInputs.map(() => vulnerabilities.length > 0 ? 'vulnerable_output' : 'safe_output'),
      passed: vulnerabilities.length === 0,
      vulnerabilities
    };
  }

  private extractPIIEntities(text: string): PIIEntity[] {
    const entities: PIIEntity[] = [];
    
    // Email detection
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let match;
    while ((match = emailRegex.exec(text)) !== null) {
      entities.push({
        type: 'email',
        value: match[0],
        confidence: 0.95,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
    
    // Phone number detection (simple pattern)
    const phoneRegex = /\b\d{3}-\d{3}-\d{4}\b|\b\(\d{3}\)\s*\d{3}-\d{4}\b/g;
    while ((match = phoneRegex.exec(text)) !== null) {
      entities.push({
        type: 'phone',
        value: match[0],
        confidence: 0.9,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
    
    // SSN detection
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    while ((match = ssnRegex.exec(text)) !== null) {
      entities.push({
        type: 'ssn',
        value: match[0],
        confidence: 0.98,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
    
    return entities;
  }

  private calculatePIIRiskScore(entities: PIIEntity[]): number {
    if (entities.length === 0) return 0;
    
    const weights = {
      email: 0.3,
      phone: 0.4,
      ssn: 0.9,
      credit_card: 0.8,
      name: 0.2,
      address: 0.5
    };
    
    const totalRisk = entities.reduce((sum, entity) => {
      return sum + (weights[entity.type] || 0.1) * entity.confidence;
    }, 0);
    
    return Math.min(1, totalRisk / entities.length);
  }

  private sanitizeInput(input: string, piiEntities: PIIEntity[]): string {
    let sanitized = input;
    
    // Replace PII with placeholders (in reverse order to maintain indices)
    piiEntities
      .sort((a, b) => b.startIndex - a.startIndex)
      .forEach(entity => {
        const placeholder = `[${entity.type.toUpperCase()}_REDACTED]`;
        sanitized = sanitized.substring(0, entity.startIndex) + 
                   placeholder + 
                   sanitized.substring(entity.endIndex);
      });
    
    return sanitized;
  }

  private async checkRateLimits(
    modelId: string,
    userId?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Simulate rate limiting check
    if (Math.random() < 0.05) { // 5% chance of rate limit
      return { allowed: false, reason: 'Rate limit exceeded' };
    }
    return { allowed: true };
  }

  private async checkContentAppropriate(
    input: any,
    contentType?: string
  ): Promise<{ appropriate: boolean; reason?: string }> {
    // Simulate content appropriateness check
    if (typeof input === 'string' && input.toLowerCase().includes('inappropriate')) {
      return { appropriate: false, reason: 'Inappropriate content detected' };
    }
    return { appropriate: true };
  }

  private async generateGovernanceFindings(
    assessments: BiasAssessment[],
    tests: RedTeamTest[],
    vulnerabilities: Vulnerability[],
    piiIncidents: PIIDetectionResult[]
  ): Promise<GovernanceFinding[]> {
    const findings: GovernanceFinding[] = [];
    
    // High-risk bias findings
    const highRiskAssessments = assessments.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical');
    if (highRiskAssessments.length > 0) {
      findings.push({
        category: 'bias',
        severity: 'high',
        description: `${highRiskAssessments.length} models with high bias risk detected`,
        affectedModels: highRiskAssessments.map(a => a.modelId),
        recommendation: 'Immediate bias mitigation required before production deployment'
      });
    }
    
    // Critical vulnerabilities
    const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
    if (criticalVulns.length > 0) {
      findings.push({
        category: 'security',
        severity: 'critical',
        description: `${criticalVulns.length} critical security vulnerabilities found`,
        affectedModels: [...new Set(tests.filter(t => t.vulnerabilities.some(v => v.severity === 'critical')).map(t => t.modelId))],
        recommendation: 'Immediate security patches required',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });
    }
    
    // PII incidents
    if (piiIncidents.length > 10) {
      findings.push({
        category: 'privacy',
        severity: 'medium',
        description: `High volume of PII incidents: ${piiIncidents.length}`,
        affectedModels: [...new Set(piiIncidents.map(p => p.modelId))],
        recommendation: 'Review and strengthen PII detection mechanisms'
      });
    }
    
    return findings;
  }

  private generateRecommendations(findings: GovernanceFinding[]): string[] {
    const recommendations = new Set<string>();
    
    findings.forEach(finding => {
      switch (finding.category) {
        case 'bias':
          recommendations.add('Implement regular bias testing in CI/CD pipeline');
          recommendations.add('Establish bias review board for model approvals');
          break;
        case 'security':
          recommendations.add('Integrate automated security testing');
          recommendations.add('Establish vulnerability disclosure process');
          break;
        case 'privacy':
          recommendations.add('Enhance PII detection and prevention systems');
          recommendations.add('Implement privacy-preserving ML techniques');
          break;
      }
    });
    
    return Array.from(recommendations);
  }

  private calculateOverallCompliance(findings: GovernanceFinding[]): GovernanceReport['complianceStatus'] {
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    const highFindings = findings.filter(f => f.severity === 'high');
    
    if (criticalFindings.length > 0) return 'non_compliant';
    if (highFindings.length > 2) return 'needs_attention';
    return 'compliant';
  }
}

export const aiGovernanceService = new AIGovernanceService();