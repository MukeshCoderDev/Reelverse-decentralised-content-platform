import express from 'express';
import { DMCAService } from '../../services/dmcaService';
import { LeakToDMCAIntegration } from '../../services/leakToDmcaIntegration';

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
 * Generate DMCA notice for a specific leak
 * POST /api/dmca/generate
 */
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { leakId } = req.body;
    
    if (!leakId) {
      return res.status(400).json({ error: 'leakId is required' });
    }

    const redis = req.app.get('redis');
    const dmcaIntegration: LeakToDMCAIntegration = req.app.get('dmcaIntegration');

    // Get leak data
    const leakData = await redis.hgetall(`leak_match:${leakId}`);
    if (!leakData.id) {
      return res.status(404).json({ error: 'Leak not found' });
    }

    const leak = {
      ...leakData,
      evidence: JSON.parse(leakData.evidence),
      detectedAt: new Date(leakData.detectedAt)
    };

    // Generate DMCA notice
    const dmcaNotice = await dmcaIntegration.processLeakForDMCA(leak);

    if (!dmcaNotice) {
      return res.status(400).json({ 
        error: 'DMCA notice could not be generated',
        reason: 'Platform not supported or match score too low'
      });
    }

    res.json({
      success: true,
      dmcaNotice: {
        id: dmcaNotice.id,
        leakId: dmcaNotice.leakId,
        contentId: dmcaNotice.contentId,
        platform: dmcaNotice.platform,
        targetUrl: dmcaNotice.targetUrl,
        status: dmcaNotice.status,
        generatedAt: dmcaNotice.generatedAt
      }
    });

  } catch (error) {
    console.error('Error generating DMCA notice:', error);
    res.status(500).json({ 
      error: 'Failed to generate DMCA notice',
      details: error.message 
    });
  }
});

/**
 * Get DMCA notice details
 * GET /api/dmca/notice/:dmcaId
 */
router.get('/notice/:dmcaId', requireAuth, async (req, res) => {
  try {
    const { dmcaId } = req.params;
    const redis = req.app.get('redis');

    const noticeData = await redis.hgetall(`dmca_notice:${dmcaId}`);
    if (!noticeData.id) {
      return res.status(404).json({ error: 'DMCA notice not found' });
    }

    const dmcaNotice = {
      ...noticeData,
      evidence: JSON.parse(noticeData.evidence),
      trackingInfo: JSON.parse(noticeData.trackingInfo || '{}'),
      generatedAt: new Date(noticeData.generatedAt)
    };

    res.json(dmcaNotice);

  } catch (error) {
    console.error('Error getting DMCA notice:', error);
    res.status(500).json({ 
      error: 'Failed to get DMCA notice',
      details: error.message 
    });
  }
});

/**
 * Submit DMCA notice
 * POST /api/dmca/submit/:dmcaId
 */
router.post('/submit/:dmcaId', requireAuth, async (req, res) => {
  try {
    const { dmcaId } = req.params;
    const redis = req.app.get('redis');
    const dmcaIntegration: LeakToDMCAIntegration = req.app.get('dmcaIntegration');

    // Get DMCA notice
    const noticeData = await redis.hgetall(`dmca_notice:${dmcaId}`);
    if (!noticeData.id) {
      return res.status(404).json({ error: 'DMCA notice not found' });
    }

    if (noticeData.status !== 'draft') {
      return res.status(400).json({ 
        error: 'DMCA notice cannot be submitted',
        currentStatus: noticeData.status 
      });
    }

    const dmcaNotice = {
      ...noticeData,
      evidence: JSON.parse(noticeData.evidence),
      trackingInfo: JSON.parse(noticeData.trackingInfo || '{}'),
      generatedAt: new Date(noticeData.generatedAt)
    };

    // Submit the notice
    await dmcaIntegration.submitDMCANotice(dmcaNotice);

    res.json({
      success: true,
      dmcaId,
      status: 'sent',
      submittedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error submitting DMCA notice:', error);
    res.status(500).json({ 
      error: 'Failed to submit DMCA notice',
      details: error.message 
    });
  }
});

/**
 * Get DMCA notices for content
 * GET /api/dmca/content/:contentId
 */
router.get('/content/:contentId', requireAuth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const redis = req.app.get('redis');

    // Get DMCA notice IDs for this content
    const dmcaIds = await redis.lrange(`dmca_notices:${contentId}`, 0, -1);
    
    const dmcaNotices = [];
    for (const dmcaId of dmcaIds) {
      const noticeData = await redis.hgetall(`dmca_notice:${dmcaId}`);
      if (noticeData.id) {
        dmcaNotices.push({
          id: noticeData.id,
          leakId: noticeData.leakId,
          platform: noticeData.platform,
          targetUrl: noticeData.targetUrl,
          status: noticeData.status,
          generatedAt: new Date(noticeData.generatedAt),
          updatedAt: noticeData.updatedAt ? new Date(noticeData.updatedAt) : null
        });
      }
    }

    res.json({
      contentId,
      dmcaNotices: dmcaNotices.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
    });

  } catch (error) {
    console.error('Error getting DMCA notices for content:', error);
    res.status(500).json({ 
      error: 'Failed to get DMCA notices',
      details: error.message 
    });
  }
});

/**
 * Get pending DMCA notices requiring review (admin only)
 * GET /api/dmca/pending
 */
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const dmcaIntegration: LeakToDMCAIntegration = req.app.get('dmcaIntegration');
    
    const pendingNotices = await dmcaIntegration.getPendingReview();

    res.json({
      count: pendingNotices.length,
      notices: pendingNotices.map(notice => ({
        id: notice.id,
        leakId: notice.leakId,
        contentId: notice.contentId,
        platform: notice.platform,
        targetUrl: notice.targetUrl,
        generatedAt: notice.generatedAt
      }))
    });

  } catch (error) {
    console.error('Error getting pending DMCA notices:', error);
    res.status(500).json({ 
      error: 'Failed to get pending DMCA notices',
      details: error.message 
    });
  }
});

/**
 * Update DMCA notice status
 * PUT /api/dmca/notice/:dmcaId/status
 */
router.put('/notice/:dmcaId/status', requireAuth, async (req, res) => {
  try {
    const { dmcaId } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['draft', 'sent', 'acknowledged', 'removed', 'disputed', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        validStatuses 
      });
    }

    const redis = req.app.get('redis');
    const noticeKey = `dmca_notice:${dmcaId}`;
    
    // Check if notice exists
    const exists = await redis.exists(noticeKey);
    if (!exists) {
      return res.status(404).json({ error: 'DMCA notice not found' });
    }

    // Update status
    await redis.hset(noticeKey, {
      status,
      updatedAt: new Date().toISOString(),
      notes: notes || ''
    });

    // If marked as removed, update the related leak status
    if (status === 'removed') {
      const noticeData = await redis.hgetall(noticeKey);
      if (noticeData.leakId) {
        await redis.hset(`leak_match:${noticeData.leakId}`, {
          status: 'removed',
          updatedAt: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      dmcaId,
      status,
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating DMCA notice status:', error);
    res.status(500).json({ 
      error: 'Failed to update DMCA notice status',
      details: error.message 
    });
  }
});

/**
 * Get DMCA statistics (admin only)
 * GET /api/dmca/stats
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const dmcaIntegration: LeakToDMCAIntegration = req.app.get('dmcaIntegration');
    
    const stats = await dmcaIntegration.getDMCAStats();

    res.json({
      ...stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting DMCA stats:', error);
    res.status(500).json({ 
      error: 'Failed to get DMCA stats',
      details: error.message 
    });
  }
});

/**
 * Batch process leaks for DMCA (admin only)
 * POST /api/dmca/batch-process
 */
router.post('/batch-process', requireAdmin, async (req, res) => {
  try {
    const { leakIds, autoSubmit } = req.body;
    
    if (!Array.isArray(leakIds) || leakIds.length === 0) {
      return res.status(400).json({ error: 'leakIds array is required' });
    }

    const redis = req.app.get('redis');
    const dmcaIntegration: LeakToDMCAIntegration = req.app.get('dmcaIntegration');

    // Get leak data for all IDs
    const leaks = [];
    for (const leakId of leakIds) {
      const leakData = await redis.hgetall(`leak_match:${leakId}`);
      if (leakData.id) {
        leaks.push({
          ...leakData,
          evidence: JSON.parse(leakData.evidence),
          detectedAt: new Date(leakData.detectedAt)
        });
      }
    }

    // Process batch
    const dmcaNotices = await dmcaIntegration.processBatchLeaks(leaks);

    res.json({
      success: true,
      processed: dmcaNotices.length,
      requested: leakIds.length,
      dmcaNotices: dmcaNotices.map(notice => ({
        id: notice.id,
        leakId: notice.leakId,
        contentId: notice.contentId,
        platform: notice.platform,
        status: notice.status
      }))
    });

  } catch (error) {
    console.error('Error batch processing DMCA notices:', error);
    res.status(500).json({ 
      error: 'Failed to batch process DMCA notices',
      details: error.message 
    });
  }
});

export default router;