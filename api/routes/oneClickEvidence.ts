import express from 'express';
import { OneClickEvidenceService } from '../../services/oneClickEvidenceService';

const router = express.Router();

// Middleware for authentication
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
 * One-click evidence pack generation
 * POST /api/one-click-evidence/generate
 */
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { contentId, metadata } = req.body;
    
    if (!contentId) {
      return res.status(400).json({ error: 'contentId is required' });
    }

    const oneClickService: OneClickEvidenceService = req.app.get('oneClickEvidenceService');
    
    // Generate evidence pack
    const result = await oneClickService.generateOneClickEvidencePack(contentId, metadata);

    if (!result.success) {
      return res.status(500).json({
        error: 'Evidence pack generation failed',
        details: result.error,
        generationTimeMs: result.generationTimeMs
      });
    }

    // Check SLA compliance
    const slaCompliant = result.generationTimeMs <= 30000;

    res.json({
      success: true,
      evidencePack: {
        id: result.evidencePack!.id,
        contentId: result.evidencePack!.contentId,
        generatedAt: result.evidencePack!.generatedAt,
        merkleHash: result.evidencePack!.merkleHash,
        pdfPath: result.evidencePack!.pdfPath,
        blockchainTxHash: result.evidencePack!.blockchainTxHash,
        riskScore: result.evidencePack!.riskAssessment.overall,
        riskLevel: result.evidencePack!.riskAssessment.riskLevel
      },
      performance: {
        generationTimeMs: result.generationTimeMs,
        cached: result.cached,
        slaCompliant,
        slaTargetMs: 30000
      }
    });

  } catch (error) {
    console.error('Error in one-click evidence generation:', error);
    res.status(500).json({ 
      error: 'Failed to generate evidence pack',
      details: error.message 
    });
  }
});

/**
 * Batch generate evidence packs
 * POST /api/one-click-evidence/batch-generate
 */
router.post('/batch-generate', requireAdmin, async (req, res) => {
  try {
    const { contentIds } = req.body;
    
    if (!Array.isArray(contentIds) || contentIds.length === 0) {
      return res.status(400).json({ error: 'contentIds array is required' });
    }

    if (contentIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 content items per batch' });
    }

    const oneClickService: OneClickEvidenceService = req.app.get('oneClickEvidenceService');
    
    // Generate evidence packs in batch
    const results = await oneClickService.batchGenerateEvidencePacks(contentIds);

    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      cached: results.filter(r => r.cached).length,
      averageTimeMs: results.reduce((sum, r) => sum + r.generationTimeMs, 0) / results.length,
      slaCompliant: results.filter(r => r.generationTimeMs <= 30000).length
    };

    res.json({
      success: true,
      summary,
      results: results.map(result => ({
        success: result.success,
        evidencePackId: result.evidencePack?.id,
        contentId: result.evidencePack?.contentId,
        generationTimeMs: result.generationTimeMs,
        cached: result.cached,
        error: result.error
      }))
    });

  } catch (error) {
    console.error('Error in batch evidence generation:', error);
    res.status(500).json({ 
      error: 'Failed to batch generate evidence packs',
      details: error.message 
    });
  }
});

/**
 * Get evidence pack by ID
 * GET /api/one-click-evidence/pack/:packId
 */
router.get('/pack/:packId', requireAuth, async (req, res) => {
  try {
    const { packId } = req.params;
    const redis = req.app.get('redis');

    // Get evidence pack metadata
    const packData = await redis.hgetall(`evidence_pack:${packId}`);
    
    if (!packData.id) {
      return res.status(404).json({ error: 'Evidence pack not found' });
    }

    res.json({
      success: true,
      evidencePack: {
        id: packData.id,
        contentId: packData.contentId,
        generatedAt: new Date(packData.generatedAt),
        merkleHash: packData.merkleHash,
        pdfPath: packData.pdfPath,
        blockchainTxHash: packData.blockchainTxHash || null,
        riskScore: parseFloat(packData.riskScore),
        riskLevel: packData.riskLevel
      }
    });

  } catch (error) {
    console.error('Error getting evidence pack:', error);
    res.status(500).json({ 
      error: 'Failed to get evidence pack',
      details: error.message 
    });
  }
});

/**
 * Get evidence packs for content
 * GET /api/one-click-evidence/content/:contentId
 */
router.get('/content/:contentId', requireAuth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const redis = req.app.get('redis');

    // Get evidence pack IDs for this content
    const packIds = await redis.lrange(`evidence_packs:${contentId}`, 0, -1);
    
    const evidencePacks = [];
    for (const packId of packIds) {
      const packData = await redis.hgetall(`evidence_pack:${packId}`);
      if (packData.id) {
        evidencePacks.push({
          id: packData.id,
          generatedAt: new Date(packData.generatedAt),
          merkleHash: packData.merkleHash,
          riskScore: parseFloat(packData.riskScore),
          riskLevel: packData.riskLevel,
          blockchainVerified: !!packData.blockchainTxHash
        });
      }
    }

    // Sort by generation date (newest first)
    evidencePacks.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());

    res.json({
      success: true,
      contentId,
      evidencePacks
    });

  } catch (error) {
    console.error('Error getting evidence packs for content:', error);
    res.status(500).json({ 
      error: 'Failed to get evidence packs',
      details: error.message 
    });
  }
});

/**
 * Download evidence pack PDF
 * GET /api/one-click-evidence/download/:packId
 */
router.get('/download/:packId', requireAuth, async (req, res) => {
  try {
    const { packId } = req.params;
    const redis = req.app.get('redis');

    // Get evidence pack data
    const packData = await redis.hgetall(`evidence_pack:${packId}`);
    
    if (!packData.id) {
      return res.status(404).json({ error: 'Evidence pack not found' });
    }

    const pdfPath = packData.pdfPath;
    
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: 'Evidence pack PDF not found' });
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="evidence-pack-${packId}.pdf"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading evidence pack:', error);
    res.status(500).json({ 
      error: 'Failed to download evidence pack',
      details: error.message 
    });
  }
});

/**
 * Invalidate cache for content
 * DELETE /api/one-click-evidence/cache/:contentId
 */
router.delete('/cache/:contentId', requireAuth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const oneClickService: OneClickEvidenceService = req.app.get('oneClickEvidenceService');

    await oneClickService.invalidateCache(contentId);

    res.json({
      success: true,
      message: `Cache invalidated for content ${contentId}`
    });

  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({ 
      error: 'Failed to invalidate cache',
      details: error.message 
    });
  }
});

/**
 * Get generation statistics (admin only)
 * GET /api/one-click-evidence/stats
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const oneClickService: OneClickEvidenceService = req.app.get('oneClickEvidenceService');
    
    const stats = await oneClickService.getGenerationStats();

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting generation stats:', error);
    res.status(500).json({ 
      error: 'Failed to get generation stats',
      details: error.message 
    });
  }
});

/**
 * Pre-generate evidence packs for high-priority content (admin only)
 * POST /api/one-click-evidence/pre-generate
 */
router.post('/pre-generate', requireAdmin, async (req, res) => {
  try {
    const { contentIds } = req.body;
    
    if (!Array.isArray(contentIds) || contentIds.length === 0) {
      return res.status(400).json({ error: 'contentIds array is required' });
    }

    const oneClickService: OneClickEvidenceService = req.app.get('oneClickEvidenceService');
    
    // Start pre-generation (non-blocking)
    oneClickService.preGenerateEvidencePacks(contentIds);

    res.json({
      success: true,
      message: `Pre-generation started for ${contentIds.length} content items`,
      contentIds
    });

  } catch (error) {
    console.error('Error starting pre-generation:', error);
    res.status(500).json({ 
      error: 'Failed to start pre-generation',
      details: error.message 
    });
  }
});

/**
 * Verify evidence pack blockchain transaction
 * GET /api/one-click-evidence/verify/:packId
 */
router.get('/verify/:packId', requireAuth, async (req, res) => {
  try {
    const { packId } = req.params;
    const redis = req.app.get('redis');

    // Get evidence pack data
    const packData = await redis.hgetall(`evidence_pack:${packId}`);
    
    if (!packData.id) {
      return res.status(404).json({ error: 'Evidence pack not found' });
    }

    const verification = {
      evidencePackId: packId,
      merkleHash: packData.merkleHash,
      blockchainTxHash: packData.blockchainTxHash || null,
      blockchainVerified: !!packData.blockchainTxHash,
      generatedAt: new Date(packData.generatedAt),
      verifiedAt: new Date()
    };

    // In a real implementation, this would verify the blockchain transaction
    if (verification.blockchainTxHash) {
      verification.blockchainVerified = true; // Placeholder verification
    }

    res.json({
      success: true,
      verification
    });

  } catch (error) {
    console.error('Error verifying evidence pack:', error);
    res.status(500).json({ 
      error: 'Failed to verify evidence pack',
      details: error.message 
    });
  }
});

export default router;