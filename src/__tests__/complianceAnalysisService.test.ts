import { ComplianceAnalysisService, DEFAULT_COMPLIANCE_CONFIG } from '../../services/complianceAnalysisService';
import { ContentMetadata } from '../../types';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }))
  };
});

describe('ComplianceAnalysisService', () => {
  let complianceService: ComplianceAnalysisService;
  let mockOpenAI: any;

  beforeEach(() => {
    const config = {
      ...DEFAULT_COMPLIANCE_CONFIG,
      openaiApiKey: 'test-key'
    };
    
    complianceService = new ComplianceAnalysisService(config);
    mockOpenAI = (complianceService as any).openai;
  });

  describe('analyzeContent', () => {
    const mockMetadata: ContentMetadata = {
      duration: 1200,
      participants: [
        { id: 'user1', name: 'Creator 1', age: 25 }
      ],
      location: 'US',
      uploadDate: '2024-01-15T10:00:00Z',
      tags: ['adult', 'content'],
      category: 'premium'
    };

    beforeEach(() => {
      // Mock OpenAI responses
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: '1. Upload missing 2257 documentation\n2. Verify consent forms\n3. Update age verification records'
          }
        }]
      });

      // Mock getComplianceDocuments
      jest.spyOn(complianceService as any, 'getComplianceDocuments').mockResolvedValue([
        {
          type: '2257',
          documentUrl: 'https://example.com/2257.pdf',
          hash: 'abc123',
          verified: true,
          uploadedAt: new Date('2024-01-14T10:00:00Z')
        },
        {
          type: 'consent',
          documentUrl: 'https://example.com/consent.pdf',
          hash: 'def456',
          verified: true,
          uploadedAt: new Date('2024-01-14T10:00:00Z')
        }
      ]);
    });

    it('should analyze content and return compliance report', async () => {
      const report = await complianceService.analyzeContent('content123', mockMetadata);

      expect(report).toBeDefined();
      expect(report.contentId).toBe('content123');
      expect(report.riskScore).toBeDefined();
      expect(report.riskScore.overall).toBeGreaterThanOrEqual(0);
      expect(report.riskScore.overall).toBeLessThanOrEqual(100);
      expect(report.violations).toBeInstanceOf(Array);
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(typeof report.evidenceComplete).toBe('boolean');
      expect(report.consentValidation).toBeDefined();
      expect(report.analyzedAt).toBeInstanceOf(Date);
      expect(report.nextReviewDate).toBeInstanceOf(Date);
    });

    it('should calculate risk score with proper breakdown', async () => {
      const report = await complianceService.analyzeContent('content123', mockMetadata);

      expect(report.riskScore.breakdown).toBeDefined();
      expect(report.riskScore.breakdown.documentCompleteness).toBeGreaterThanOrEqual(0);
      expect(report.riskScore.breakdown.documentCompleteness).toBeLessThanOrEqual(1);
      expect(report.riskScore.breakdown.consentValidity).toBeGreaterThanOrEqual(0);
      expect(report.riskScore.breakdown.consentValidity).toBeLessThanOrEqual(1);
      expect(report.riskScore.breakdown.geoCompliance).toBeGreaterThanOrEqual(0);
      expect(report.riskScore.breakdown.geoCompliance).toBeLessThanOrEqual(1);
      expect(report.riskScore.breakdown.ageVerification).toBeGreaterThanOrEqual(0);
      expect(report.riskScore.breakdown.ageVerification).toBeLessThanOrEqual(1);
      expect(report.riskScore.breakdown.contentRisk).toBeGreaterThanOrEqual(0);
      expect(report.riskScore.breakdown.contentRisk).toBeLessThanOrEqual(1);
    });

    it('should determine correct risk level', async () => {
      const report = await complianceService.analyzeContent('content123', mockMetadata);

      expect(['low', 'medium', 'high', 'critical']).toContain(report.riskScore.riskLevel);
    });

    it('should generate AI recommendations', async () => {
      const report = await complianceService.analyzeContent('content123', mockMetadata);

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations[0]).toContain('Upload missing 2257 documentation');
    });

    it('should handle AI service failures gracefully', async () => {
      // Mock AI failure
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('AI service unavailable'));

      const report = await complianceService.analyzeContent('content123', mockMetadata);

      // Should still return a report with fallback recommendations
      expect(report).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('validateConsent', () => {
    const mockMetadata: ContentMetadata = {
      duration: 1200,
      participants: [
        { id: 'user1', name: 'Creator 1', age: 25 }
      ],
      location: 'US',
      uploadDate: '2024-01-15T10:00:00Z'
    };

    beforeEach(() => {
      // Mock AI anomaly detection
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'No anomalies detected.'
          }
        }]
      });
    });

    it('should validate consent with complete documentation', async () => {
      // Mock complete documents
      jest.spyOn(complianceService as any, 'getComplianceDocuments').mockResolvedValue([
        {
          type: 'consent',
          verified: true,
          uploadedAt: new Date('2024-01-14T10:00:00Z')
        },
        {
          type: 'id_verification',
          verified: true,
          uploadedAt: new Date('2024-01-14T10:00:00Z')
        }
      ]);

      const validation = await complianceService.validateConsent('content123', mockMetadata);

      expect(validation.isValid).toBe(true);
      expect(validation.contentId).toBe('content123');
      expect(validation.participantCount).toBe(1);
      expect(validation.anomalies).toHaveLength(0);
    });

    it('should detect missing consent documentation', async () => {
      // Mock missing consent documents
      jest.spyOn(complianceService as any, 'getComplianceDocuments').mockResolvedValue([
        {
          type: 'id_verification',
          verified: true,
          uploadedAt: new Date('2024-01-14T10:00:00Z')
        }
      ]);

      const validation = await complianceService.validateConsent('content123', mockMetadata);

      expect(validation.isValid).toBe(false);
      expect(validation.anomalies).toContain('Missing consent documentation');
    });

    it('should detect participant count mismatch', async () => {
      const multiParticipantMetadata = {
        ...mockMetadata,
        participants: [
          { id: 'user1', name: 'Creator 1', age: 25 },
          { id: 'user2', name: 'Creator 2', age: 28 }
        ]
      };

      // Mock single consent document for multi-participant content
      jest.spyOn(complianceService as any, 'getComplianceDocuments').mockResolvedValue([
        {
          type: 'consent',
          verified: true,
          uploadedAt: new Date('2024-01-14T10:00:00Z')
        }
      ]);

      const validation = await complianceService.validateConsent('content123', multiParticipantMetadata);

      expect(validation.isValid).toBe(false);
      expect(validation.anomalies.some(a => a.includes('count mismatch'))).toBe(true);
    });

    it('should detect expired documents', async () => {
      // Mock expired documents
      jest.spyOn(complianceService as any, 'getComplianceDocuments').mockResolvedValue([
        {
          type: 'consent',
          verified: true,
          uploadedAt: new Date('2024-01-14T10:00:00Z'),
          expiresAt: new Date('2024-01-01T10:00:00Z') // Expired
        }
      ]);

      const validation = await complianceService.validateConsent('content123', mockMetadata);

      expect(validation.isValid).toBe(false);
      expect(validation.anomalies.some(a => a.includes('expired documents'))).toBe(true);
    });

    it('should detect AI-identified anomalies', async () => {
      // Mock AI detecting anomalies
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Suspicious timing pattern detected\nMismatched participant information'
          }
        }]
      });

      jest.spyOn(complianceService as any, 'getComplianceDocuments').mockResolvedValue([
        {
          type: 'consent',
          verified: true,
          uploadedAt: new Date('2024-01-14T10:00:00Z')
        },
        {
          type: 'id_verification',
          verified: true,
          uploadedAt: new Date('2024-01-14T10:00:00Z')
        }
      ]);

      const validation = await complianceService.validateConsent('content123', mockMetadata);

      expect(validation.isValid).toBe(false);
      expect(validation.anomalies).toContain('Suspicious timing pattern detected');
      expect(validation.anomalies).toContain('Mismatched participant information');
    });
  });

  describe('calculateRiskScore', () => {
    const mockMetadata: ContentMetadata = {
      duration: 1200,
      participants: [{ id: 'user1', name: 'Creator 1', age: 25 }],
      location: 'US',
      uploadDate: '2024-01-15T10:00:00Z'
    };

    const mockDocuments = [
      {
        type: '2257' as const,
        verified: true,
        uploadedAt: new Date('2024-01-14T10:00:00Z'),
        documentUrl: 'test.pdf',
        hash: 'abc123'
      }
    ];

    const mockConsentValidation = {
      contentId: 'content123',
      isValid: true,
      anomalies: [],
      participantCount: 1,
      documentsFound: 2,
      validatedAt: new Date()
    };

    it('should calculate risk score with all components', async () => {
      const riskScore = await complianceService.calculateRiskScore(
        mockMetadata,
        mockDocuments,
        mockConsentValidation
      );

      expect(riskScore.overall).toBeGreaterThanOrEqual(0);
      expect(riskScore.overall).toBeLessThanOrEqual(100);
      expect(riskScore.breakdown).toBeDefined();
      expect(riskScore.riskLevel).toBeDefined();
      expect(riskScore.calculatedAt).toBeInstanceOf(Date);
    });

    it('should assign higher risk for incomplete documentation', async () => {
      const incompleteDocuments = []; // No documents

      const riskScore = await complianceService.calculateRiskScore(
        mockMetadata,
        incompleteDocuments,
        mockConsentValidation
      );

      expect(riskScore.breakdown.documentCompleteness).toBe(0);
      expect(riskScore.overall).toBeLessThan(50); // Should be lower due to missing docs
    });

    it('should assign higher risk for invalid consent', async () => {
      const invalidConsent = {
        ...mockConsentValidation,
        isValid: false,
        anomalies: ['Missing consent documentation']
      };

      const riskScore = await complianceService.calculateRiskScore(
        mockMetadata,
        mockDocuments,
        invalidConsent
      );

      expect(riskScore.breakdown.consentValidity).toBeLessThan(1);
    });

    it('should determine correct risk levels', async () => {
      // Test high-risk scenario
      const highRiskConsent = {
        ...mockConsentValidation,
        isValid: false,
        anomalies: ['Multiple violations']
      };

      const highRiskScore = await complianceService.calculateRiskScore(
        mockMetadata,
        [], // No documents
        highRiskConsent
      );

      expect(['high', 'critical']).toContain(highRiskScore.riskLevel);

      // Test low-risk scenario
      const completeDocuments = [
        { type: '2257' as const, verified: true, uploadedAt: new Date(), documentUrl: 'test.pdf', hash: 'abc' },
        { type: 'consent' as const, verified: true, uploadedAt: new Date(), documentUrl: 'test.pdf', hash: 'def' },
        { type: 'id_verification' as const, verified: true, uploadedAt: new Date(), documentUrl: 'test.pdf', hash: 'ghi' },
        { type: 'age_verification' as const, verified: true, uploadedAt: new Date(), documentUrl: 'test.pdf', hash: 'jkl' }
      ];

      const lowRiskScore = await complianceService.calculateRiskScore(
        mockMetadata,
        completeDocuments,
        mockConsentValidation
      );

      expect(['low', 'medium']).toContain(lowRiskScore.riskLevel);
    });
  });
});