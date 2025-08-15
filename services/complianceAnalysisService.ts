import OpenAI from 'openai';
import { ComplianceReport, ConsentValidation, RiskScore, ComplianceViolation, ContentMetadata } from '../types';

export interface ComplianceDocument {
  type: '2257' | 'consent' | 'id_verification' | 'geo_compliance' | 'age_verification';
  documentUrl: string;
  hash: string;
  verified: boolean;
  uploadedAt: Date;
  expiresAt?: Date;
}

export interface ComplianceAnalysisConfig {
  openaiApiKey: string;
  model: string;
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
  };
  requiredDocuments: string[];
  geoComplianceRules: Record<string, string[]>;
}

export class ComplianceAnalysisService {
  private openai: OpenAI;
  private config: ComplianceAnalysisConfig;

  constructor(config: ComplianceAnalysisConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey
    });
  }

  /**
   * Analyze content for compliance issues and generate risk score
   */
  async analyzeContent(contentId: string, metadata: ContentMetadata): Promise<ComplianceReport> {
    try {
      console.log(`Starting compliance analysis for content ${contentId}`);

      // Get all compliance documents for this content
      const documents = await this.getComplianceDocuments(contentId);

      // Validate consent completeness
      const consentValidation = await this.validateConsent(contentId, metadata);

      // Calculate risk score
      const riskScore = await this.calculateRiskScore(metadata, documents, consentValidation);

      // Detect violations
      const violations = await this.detectViolations(metadata, documents, consentValidation);

      // Generate AI recommendations
      const recommendations = await this.generateRecommendations(violations, riskScore, metadata);

      const report: ComplianceReport = {
        contentId,
        riskScore,
        violations,
        recommendations,
        evidenceComplete: this.isEvidenceComplete(documents),
        consentValidation,
        documents,
        analyzedAt: new Date(),
        nextReviewDate: this.calculateNextReviewDate(riskScore)
      };

      console.log(`Compliance analysis completed for content ${contentId}, risk score: ${riskScore.overall}`);
      return report;

    } catch (error) {
      console.error(`Compliance analysis failed for content ${contentId}:`, error);
      throw error;
    }
  }

  /**
   * Validate consent with anomaly detection
   */
  async validateConsent(contentId: string, metadata: ContentMetadata): Promise<ConsentValidation> {
    try {
      const documents = await this.getComplianceDocuments(contentId);
      const anomalies: string[] = [];
      let isValid = true;

      // Check for required consent documents
      const consentDocs = documents.filter(doc => doc.type === 'consent');
      const idDocs = documents.filter(doc => doc.type === 'id_verification');

      if (consentDocs.length === 0) {
        anomalies.push('Missing consent documentation');
        isValid = false;
      }

      if (idDocs.length === 0) {
        anomalies.push('Missing ID verification');
        isValid = false;
      }

      // Check for participant count mismatch
      const expectedParticipants = metadata.participants?.length || 1;
      const consentCount = consentDocs.length;
      const idCount = idDocs.length;

      if (consentCount !== expectedParticipants) {
        anomalies.push(`Consent count mismatch: expected ${expectedParticipants}, found ${consentCount}`);
        isValid = false;
      }

      if (idCount !== expectedParticipants) {
        anomalies.push(`ID verification count mismatch: expected ${expectedParticipants}, found ${idCount}`);
        isValid = false;
      }

      // Check for expired documents
      const now = new Date();
      const expiredDocs = documents.filter(doc => doc.expiresAt && doc.expiresAt < now);
      if (expiredDocs.length > 0) {
        anomalies.push(`${expiredDocs.length} expired documents found`);
        isValid = false;
      }

      // AI-powered anomaly detection using LLM
      const aiAnomalies = await this.detectAIAnomalies(contentId, metadata, documents);
      anomalies.push(...aiAnomalies);

      if (aiAnomalies.length > 0) {
        isValid = false;
      }

      return {
        contentId,
        isValid,
        anomalies,
        participantCount: expectedParticipants,
        documentsFound: documents.length,
        validatedAt: new Date()
      };

    } catch (error) {
      console.error(`Consent validation failed for content ${contentId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate comprehensive risk score
   */
  async calculateRiskScore(
    metadata: ContentMetadata,
    documents: ComplianceDocument[],
    consentValidation: ConsentValidation
  ): Promise<RiskScore> {
    const scores = {
      documentCompleteness: this.scoreDocumentCompleteness(documents),
      consentValidity: this.scoreConsentValidity(consentValidation),
      geoCompliance: await this.scoreGeoCompliance(metadata),
      ageVerification: this.scoreAgeVerification(documents),
      contentRisk: await this.scoreContentRisk(metadata)
    };

    // Weighted average calculation
    const weights = {
      documentCompleteness: 0.25,
      consentValidity: 0.30,
      geoCompliance: 0.20,
      ageVerification: 0.15,
      contentRisk: 0.10
    };

    const overall = Object.entries(scores).reduce((sum, [key, score]) => {
      return sum + (score * weights[key as keyof typeof weights]);
    }, 0);

    const riskLevel = this.determineRiskLevel(overall);

    return {
      overall: Math.round(overall * 100) / 100,
      breakdown: scores,
      riskLevel,
      calculatedAt: new Date()
    };
  }

  /**
   * Detect compliance violations
   */
  private async detectViolations(
    metadata: ContentMetadata,
    documents: ComplianceDocument[],
    consentValidation: ConsentValidation
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Missing required documents
    for (const requiredType of this.config.requiredDocuments) {
      const hasDoc = documents.some(doc => doc.type === requiredType && doc.verified);
      if (!hasDoc) {
        violations.push({
          type: 'missing_document',
          severity: 'high',
          description: `Missing required document: ${requiredType}`,
          recommendation: `Upload and verify ${requiredType} documentation`,
          documentType: requiredType
        });
      }
    }

    // Consent validation failures
    if (!consentValidation.isValid) {
      for (const anomaly of consentValidation.anomalies) {
        violations.push({
          type: 'consent_anomaly',
          severity: 'high',
          description: anomaly,
          recommendation: 'Review and correct consent documentation'
        });
      }
    }

    // Geo-compliance violations
    const geoViolations = await this.checkGeoCompliance(metadata);
    violations.push(...geoViolations);

    // Expired documents
    const now = new Date();
    const expiredDocs = documents.filter(doc => doc.expiresAt && doc.expiresAt < now);
    for (const doc of expiredDocs) {
      violations.push({
        type: 'expired_document',
        severity: 'medium',
        description: `Expired ${doc.type} document`,
        recommendation: `Renew ${doc.type} documentation`,
        documentType: doc.type
      });
    }

    return violations;
  }

  /**
   * Generate AI-powered recommendations
   */
  private async generateRecommendations(
    violations: ComplianceViolation[],
    riskScore: RiskScore,
    metadata: ContentMetadata
  ): Promise<string[]> {
    try {
      const prompt = `
        As a compliance expert, analyze this content compliance situation and provide specific recommendations:

        Risk Score: ${riskScore.overall}/100 (${riskScore.riskLevel})
        Risk Breakdown: ${JSON.stringify(riskScore.breakdown, null, 2)}
        
        Violations Found:
        ${violations.map(v => `- ${v.severity.toUpperCase()}: ${v.description}`).join('\n')}
        
        Content Metadata:
        - Duration: ${metadata.duration} seconds
        - Participants: ${metadata.participants?.length || 1}
        - Location: ${metadata.location || 'Unknown'}
        - Upload Date: ${metadata.uploadDate}
        
        Provide 3-5 specific, actionable recommendations to improve compliance and reduce risk.
        Focus on the most critical issues first.
      `;

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a compliance expert specializing in adult content regulations, 2257 requirements, and risk management. Provide clear, actionable recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      const recommendations = response.choices[0]?.message?.content
        ?.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(rec => rec.length > 10) || [];

      return recommendations.slice(0, 5); // Limit to 5 recommendations

    } catch (error) {
      console.error('Failed to generate AI recommendations:', error);
      
      // Fallback to rule-based recommendations
      const fallbackRecs = violations.map(v => v.recommendation).filter(Boolean);
      return [...new Set(fallbackRecs)]; // Remove duplicates
    }
  }

  /**
   * AI-powered anomaly detection
   */
  private async detectAIAnomalies(
    contentId: string,
    metadata: ContentMetadata,
    documents: ComplianceDocument[]
  ): Promise<string[]> {
    try {
      const prompt = `
        Analyze this adult content compliance data for anomalies or red flags:

        Content ID: ${contentId}
        Duration: ${metadata.duration} seconds
        Participants: ${metadata.participants?.length || 1}
        Location: ${metadata.location || 'Unknown'}
        Upload Date: ${metadata.uploadDate}
        
        Documents Available:
        ${documents.map(doc => `- ${doc.type}: ${doc.verified ? 'Verified' : 'Unverified'} (uploaded: ${doc.uploadedAt})`).join('\n')}
        
        Look for:
        - Mismatched participant counts
        - Suspicious timing patterns
        - Missing critical documentation
        - Unusual metadata combinations
        - Potential compliance risks
        
        List any anomalies found, one per line. If no anomalies, respond with "No anomalies detected."
      `;

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert compliance auditor. Identify potential anomalies or red flags in adult content compliance data.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content || '';
      
      if (content.includes('No anomalies detected')) {
        return [];
      }

      return content
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(anomaly => anomaly.length > 5);

    } catch (error) {
      console.error('AI anomaly detection failed:', error);
      return []; // Return empty array on failure
    }
  }

  /**
   * Score document completeness (0-1)
   */
  private scoreDocumentCompleteness(documents: ComplianceDocument[]): number {
    const requiredCount = this.config.requiredDocuments.length;
    const verifiedCount = documents.filter(doc => 
      this.config.requiredDocuments.includes(doc.type) && doc.verified
    ).length;

    return Math.min(verifiedCount / requiredCount, 1.0);
  }

  /**
   * Score consent validity (0-1)
   */
  private scoreConsentValidity(consentValidation: ConsentValidation): number {
    if (consentValidation.isValid) {
      return 1.0;
    }

    // Partial score based on severity of anomalies
    const severityPenalties = {
      'Missing consent documentation': 0.5,
      'Missing ID verification': 0.4,
      'count mismatch': 0.3,
      'expired documents': 0.2
    };

    let penalty = 0;
    for (const anomaly of consentValidation.anomalies) {
      for (const [pattern, penaltyValue] of Object.entries(severityPenalties)) {
        if (anomaly.toLowerCase().includes(pattern.toLowerCase())) {
          penalty += penaltyValue;
          break;
        }
      }
    }

    return Math.max(0, 1.0 - penalty);
  }

  /**
   * Score geo-compliance (0-1)
   */
  private async scoreGeoCompliance(metadata: ContentMetadata): Promise<number> {
    if (!metadata.location) {
      return 0.5; // Neutral score for unknown location
    }

    const geoRules = this.config.geoComplianceRules[metadata.location];
    if (!geoRules) {
      return 0.8; // Good score for locations without specific rules
    }

    // Check compliance with geo-specific rules
    // This would integrate with actual geo-compliance checking
    return 1.0; // Placeholder - assume compliant
  }

  /**
   * Score age verification (0-1)
   */
  private scoreAgeVerification(documents: ComplianceDocument[]): number {
    const ageVerificationDocs = documents.filter(doc => 
      doc.type === 'age_verification' && doc.verified
    );

    return ageVerificationDocs.length > 0 ? 1.0 : 0.0;
  }

  /**
   * Score content-specific risk factors (0-1)
   */
  private async scoreContentRisk(metadata: ContentMetadata): Promise<number> {
    // Analyze content metadata for risk factors
    let riskFactors = 0;

    // Very short or very long content might be riskier
    if (metadata.duration < 60 || metadata.duration > 7200) {
      riskFactors += 0.1;
    }

    // Multiple participants increase complexity
    const participantCount = metadata.participants?.length || 1;
    if (participantCount > 3) {
      riskFactors += 0.2;
    }

    // Recent uploads might need more scrutiny
    const daysSinceUpload = (Date.now() - new Date(metadata.uploadDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpload < 1) {
      riskFactors += 0.1;
    }

    return Math.max(0, 1.0 - riskFactors);
  }

  /**
   * Determine risk level from overall score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.config.riskThresholds.low) return 'low';
    if (score >= this.config.riskThresholds.medium) return 'medium';
    if (score >= this.config.riskThresholds.high) return 'high';
    return 'critical';
  }

  /**
   * Check if all required evidence is complete
   */
  private isEvidenceComplete(documents: ComplianceDocument[]): boolean {
    return this.config.requiredDocuments.every(requiredType =>
      documents.some(doc => doc.type === requiredType && doc.verified)
    );
  }

  /**
   * Calculate next review date based on risk score
   */
  private calculateNextReviewDate(riskScore: RiskScore): Date {
    const now = new Date();
    let daysUntilReview: number;

    switch (riskScore.riskLevel) {
      case 'critical':
        daysUntilReview = 1;
        break;
      case 'high':
        daysUntilReview = 7;
        break;
      case 'medium':
        daysUntilReview = 30;
        break;
      case 'low':
        daysUntilReview = 90;
        break;
      default:
        daysUntilReview = 30;
    }

    return new Date(now.getTime() + daysUntilReview * 24 * 60 * 60 * 1000);
  }

  /**
   * Get compliance documents for content (placeholder - would integrate with existing system)
   */
  private async getComplianceDocuments(contentId: string): Promise<ComplianceDocument[]> {
    // This would integrate with existing compliance document storage
    // For now, return mock data
    return [
      {
        type: '2257',
        documentUrl: `https://compliance.example.com/2257/${contentId}.pdf`,
        hash: 'abc123',
        verified: true,
        uploadedAt: new Date(Date.now() - 86400000) // 1 day ago
      },
      {
        type: 'consent',
        documentUrl: `https://compliance.example.com/consent/${contentId}.pdf`,
        hash: 'def456',
        verified: true,
        uploadedAt: new Date(Date.now() - 86400000)
      }
    ];
  }

  /**
   * Check geo-compliance violations
   */
  private async checkGeoCompliance(metadata: ContentMetadata): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    if (!metadata.location) {
      violations.push({
        type: 'geo_compliance',
        severity: 'medium',
        description: 'Location information missing',
        recommendation: 'Add location metadata for geo-compliance verification'
      });
    }

    // Add more geo-compliance checks as needed
    return violations;
  }
}

// Default configuration
export const DEFAULT_COMPLIANCE_CONFIG: ComplianceAnalysisConfig = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  model: 'gpt-4',
  riskThresholds: {
    low: 0.8,
    medium: 0.6,
    high: 0.4
  },
  requiredDocuments: ['2257', 'consent', 'id_verification', 'age_verification'],
  geoComplianceRules: {
    'US': ['2257_compliance', 'age_verification'],
    'EU': ['gdpr_compliance', 'age_verification'],
    'UK': ['uk_compliance', 'age_verification']
  }
};