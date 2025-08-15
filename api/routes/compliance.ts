import express from 'express';
import { ComplianceAnalysisService } from '../../services/complianceAnalysisService';
import { EvidencePackService } from '../../services/evidencePackService';

const router = express.Router();

// Middleware for authentication and authorization
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Analyze content compliance and generate risk score
 * POST /api/compliance/analyze
 */
router.post('/analyze', requireAuth, async (req, res) => {
  try {
    const { contentId, metadata } = req.body;
    
    if (!contentId) {
      return res.status(400).json({ error: 'contentId is required' });
    }

    if (!metadata) {
      return res.status(400).json({ error: 'metadata is required' });
    }

    const complianceService: ComplianceAnalysisService = req.app.get('complianceService');
    
    // Perform compliance analysis
    const complianceReport = await complianceService.analyzeContent(contentId, metadata);

    res.json({
      success: true,
      report: {
        contentId: complianceReport.contentId,
        riskScore: complianceReport.riskScore,
        violations: complianceReport.violations,
        recommendations: complianceReport.recommendations,
        evidenceComplete: complianceReport.evidenceComplete,
        consentValid: complianceReport.consentValidation.isValid,
        analyzedAt: complianceReport.analyzedAt,
        nextReviewDate: complianceReport.nextReviewDate
      }
    });

  } catch (error) {
    console.error('Error analyzing compliance:', error);
    res.status(500).json({ 
      error: 'Failed to analyze compliance',
      details: error.message 
    });
  }
});

/**
 * Generate evidence pack for content
 * POST /api/compliance/evidence-pack
 */
router.post('/evidence-pack', requireAuth, async (req, res) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({ error: 'contentId is required' });
    }

    const complianceService: ComplianceAnalysisService = req.app.get('complianceService');
    const evidencePackService: EvidencePackService = req.app.get('evidencePackService');

    // First get compliance report
    const metadata = await getContentMetadata(contentId); // Helper function
    const complianceReport = await complianceService.analyzeContent(contentId, metadata);

    // Generate evidence pack
    const evidencePack = await evidencePackService.generateEvidencePack(contentId, complianceReport);

    res.json({
      success: true,
      evidencePack: {
        id: evidencePack.id,
        contentId: evidencePack.contentId,
        generatedAt: evidencePack.generatedAt,
        merkleHash: evidencePack.merkleHash,
        pdfPath: evidencePack.pdfPath,
        blockchainTxHash: evidencePack.blockchainTxHash,
        riskScore: evidencePack.riskAssessment.overall,
        evidenceComplete: complianceReport.evidenceComplete
      }
    });

  } catch (error) {
    console.error('Error generating evidence pack:', error);
    res.status(500).json({ 
      error: 'Failed to generate evidence pack',
      details: error.message 
    });
  }
});

/**
 * Validate consent for content
 * POST /api/compliance/validate-consent
 */
router.post('/validate-consent', requireAuth, async (req, res) => {
  try {
    const { contentId, metadata } = req.body;
    
    if (!contentId) {
      return res.status(400).json({ error: 'contentId is required' });
    }

    const complianceService: ComplianceAnalysisService = req.app.get('complianceService');
    
    // Validate consent
    const consentValidation = await complianceService.validateConsent(contentId, metadata || {});

    res.json({
      success: true,
      validation: consentValidation
    });

  } catch (error) {
    console.error('Error validating consent:', error);
    res.status(500).json({ 
      error: 'Failed to validate consent',
      details: error.message 
    });
  }
});

/**
 * Get compliance report for content
 * GET /api/compliance/report/:contentId
 */
router.get('/report/:contentId', requireAuth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const redis = req.app.get('redis');

    // Check if we have a cached compliance report
    const cachedReport = await redis.get(`compliance_report:${contentId}`);
    
    if (cachedReport) {
      const report = JSON.parse(cachedReport);
      return res.json({
        success: true,
        report: {
          ...report,
          analyzedAt: new Date(report.analyzedAt),
          nextReviewDate: new Date(report.nextReviewDate)
        },
        cached: true
      });
    }

    // If no cached report, suggest running analysis
    res.status(404).json({ 
      error: 'No compliance report found',
      suggestion: 'Run compliance analysis first using POST /api/compliance/analyze'
    });

  } catch (error) {
    console.error('Error getting compliance report:', error);
    res.status(500).json({ 
      error: 'Failed to get compliance report',
      details: error.message 
    });
  }
});

/**
 * Get content risk score only
 * GET /api/compliance/risk-score/:contentId
 */
router.get('/risk-score/:contentId', requireAuth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const redis = req.app.get('redis');

    // Get cached risk score
    const cachedReport = await redis.get(`compliance_report:${contentId}`);
    
    if (!cachedReport) {
      return res.status(404).json({ 
        error: 'No risk score available',
        suggestion: 'Run compliance analysis first'
      });
    }

    const report = JSON.parse(cachedReport);
    
    res.json({
      success: true,
      contentId,
      riskScore: report.riskScore,
      lastAnalyzed: new Date(report.analyzedAt)
    });

  } catch (error) {
    console.error('Error getting risk score:', error);
    res.status(500).json({ 
      error: 'Failed to get risk score',
      details: error.message 
    });
  }
});

/**
 * Get compliance dashboard data (admin only)
 * GET /api/compliance/dashboard
 */
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const redis = req.app.get('redis');
    const evidencePackService: EvidencePackService = req.app.get('evidencePackService');

    // Get compliance statistics
    const reportKeys = await redis.keys('compliance_report:*');
    const stats = {
      totalAnalyzed: reportKeys.length,
      riskDistribution: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      violationTypes: {} as Record<string, number>,
      evidencePackStats: await evidencePackService.getEvidencePackStats()
    };

    // Analyze risk distribution and violations
    for (const key of reportKeys) {
      const reportData = await redis.get(key);
      if (reportData) {
        const report = JSON.parse(reportData);
        
        // Count risk levels
        stats.riskDistribution[report.riskScore.riskLevel]++;
        
        // Count violation types
        for (const violation of report.violations || []) {
          stats.violationTypes[violation.type] = (stats.violationTypes[violation.type] || 0) + 1;
        }
      }
    }

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting compliance dashboard:', error);
    res.status(500).json({ 
      error: 'Failed to get compliance dashboard',
      details: error.message 
    });
  }
});

/**
 * Get high-risk content requiring review (admin only)
 * GET /api/compliance/high-risk
 */
router.get('/high-risk', requireAdmin, async (req, res) => {
  try {
    const redis = req.app.get('redis');
    const reportKeys = await redis.keys('compliance_report:*');
    const highRiskContent = [];

    for (const key of reportKeys) {
      const reportData = await redis.get(key);
      if (reportData) {
        const report = JSON.parse(reportData);
        
        if (report.riskScore.riskLevel === 'high' || report.riskScore.riskLevel === 'critical') {
          highRiskContent.push({
            contentId: report.contentId,
            riskScore: report.riskScore.overall,
            riskLevel: report.riskScore.riskLevel,
            violationCount: report.violations?.length || 0,
            evidenceComplete: report.evidenceComplete,
            analyzedAt: new Date(report.analyzedAt),
            nextReviewDate: new Date(report.nextReviewDate)
          });
        }
      }
    }

    // Sort by risk score (highest first)
    highRiskContent.sort((a, b) => a.riskScore - b.riskScore);

    res.json({
      success: true,
      count: highRiskContent.length,
      content: highRiskContent
    });

  } catch (error) {
    console.error('Error getting high-risk content:', error);
    res.status(500).json({ 
      error: 'Failed to get high-risk content',
      details: error.message 
    });
  }
});

/**
 * Verify evidence pack integrity
 * POST /api/compliance/verify-evidence-pack
 */
router.post('/verify-evidence-pack', requireAuth, async (req, res) => {
  try {
    const { evidencePackId } = req.body;
    
    if (!evidencePackId) {
      return res.status(400).json({ error: 'evidencePackId is required' });
    }

    const evidencePackService: EvidencePackService = req.app.get('evidencePackService');
    const redis = req.app.get('redis');

    // Get evidence pack data
    const packData = await redis.get(`evidence_pack:${evidencePackId}`);
    if (!packData) {
      return res.status(404).json({ error: 'Evidence pack not found' });
    }

    const evidencePack = JSON.parse(packData);
    
    // Verify integrity
    const isValid = await evidencePackService.verifyEvidencePack(evidencePack);

    res.json({
      success: true,
      evidencePackId,
      isValid,
      verifiedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error verifying evidence pack:', error);
    res.status(500).json({ 
      error: 'Failed to verify evidence pack',
      details: error.message 
    });
  }
});

/**
 * Batch analyze multiple content items (admin only)
 * POST /api/compliance/batch-analyze
 */
router.post('/batch-analyze', requireAdmin, async (req, res) => {
  try {
    const { contentIds } = req.body;
    
    if (!Array.isArray(contentIds) || contentIds.length === 0) {
      return res.status(400).json({ error: 'contentIds array is required' });
    }

    const complianceService: ComplianceAnalysisService = req.app.get('complianceService');
    const results = [];

    for (const contentId of contentIds) {
      try {
        const metadata = await getContentMetadata(contentId);
        const report = await complianceService.analyzeContent(contentId, metadata);
        
        results.push({
          contentId,
          success: true,
          riskScore: report.riskScore.overall,
          riskLevel: report.riskScore.riskLevel,
          violationCount: report.violations.length
        });

        // Add small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        results.push({
          contentId,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      processed: results.length,
      successful: successCount,
      failed: results.length - successCount,
      results
    });

  } catch (error) {
    console.error('Error batch analyzing compliance:', error);
    res.status(500).json({ 
      error: 'Failed to batch analyze compliance',
      details: error.message 
    });
  }
});

// Helper function to get content metadata (would integrate with existing system)
async function getContentMetadata(contentId: string): Promise<any> {
  // This would integrate with existing content management system
  // For now, return mock metadata
  return {
    duration: 1200,
    participants: [
      { id: 'user1', name: 'Creator 1', age: 25 }
    ],
    location: 'US',
    uploadDate: new Date().toISOString(),
    tags: ['adult', 'content'],
    category: 'premium'
  };
}

export default router;