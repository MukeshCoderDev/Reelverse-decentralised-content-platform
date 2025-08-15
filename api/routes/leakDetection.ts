import express from 'express';
import { LeakDetectionService } from '../../services/leakDetectionService';
import { LeakDetectionQueue } from '../../services/leakDetectionQueue';
import { VideoFingerprintService } from '../../services/videoFingerprintService';

const router = express.Router();

// Middleware to check authentication (assuming existing auth middleware)
const requireAuth = (req: any, res: any, next: any) => {
  // Implementation depends on existing auth system
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Middleware to check admin permissions for sensitive operations
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Start monitoring content for leaks
 * POST /api/leak-detection/monitor
 */
router.post('/monitor', requireAuth, async (req, res) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({ error: 'contentId is required' });
    }

    // Get services from app context (assuming dependency injection)
    const leakDetectionService: LeakDetectionService = req.app.get('leakDetectionService');
    const leakDetectionQueue: LeakDetectionQueue = req.app.get('leakDetectionQueue');
    const fingerprintService: VideoFingerprintService = req.app.get('fingerprintService');

    // Generate fingerprint for the content
    const contentUrl = await getContentUrl(contentId); // Helper function to get content URL
    const fingerprint = await fingerprintService.generateFingerprint(contentUrl);

    // Start monitoring
    await leakDetectionService.startMonitoring(contentId, fingerprint);
    await leakDetectionQueue.addToMonitoring(contentId);

    res.json({
      success: true,
      message: `Started leak monitoring for content ${contentId}`,
      contentId,
      fingerprintGenerated: true
    });

  } catch (error) {
    console.error('Error starting leak monitoring:', error);
    res.status(500).json({ 
      error: 'Failed to start leak monitoring',
      details: error.message 
    });
  }
});

/**
 * Get leak detection results for content
 * GET /api/leak-detection/results/:contentId
 */
router.get('/results/:contentId', requireAuth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const leakDetectionService: LeakDetectionService = req.app.get('leakDetectionService');

    // Get leak matches from Redis
    const redis = req.app.get('redis');
    const leakIds = await redis.lrange(`leaks:${contentId}`, 0, -1);
    
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

    // Get monitoring status
    const monitoringData = await redis.hgetall(`leak_monitor:${contentId}`);

    res.json({
      contentId,
      monitoringStatus: monitoringData.status || 'not_monitored',
      leaksFound: leaks.length,
      leaks,
      monitoringStarted: monitoringData.startedAt ? new Date(parseInt(monitoringData.startedAt)) : null,
      slaDeadline: monitoringData.slaDeadline ? new Date(parseInt(monitoringData.slaDeadline)) : null
    });

  } catch (error) {
    console.error('Error getting leak detection results:', error);
    res.status(500).json({ 
      error: 'Failed to get leak detection results',
      details: error.message 
    });
  }
});

/**
 * Manually trigger leak detection for content
 * POST /api/leak-detection/scan
 */
router.post('/scan', requireAuth, async (req, res) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({ error: 'contentId is required' });
    }

    const leakDetectionService: LeakDetectionService = req.app.get('leakDetectionService');
    
    // Trigger immediate scan
    const leaks = await leakDetectionService.detectLeaks(contentId);

    res.json({
      success: true,
      contentId,
      leaksFound: leaks.length,
      leaks: leaks.map(leak => ({
        platform: leak.platform,
        url: leak.detectedUrl,
        matchScore: leak.matchScore,
        detectedAt: leak.detectedAt
      }))
    });

  } catch (error) {
    console.error('Error scanning for leaks:', error);
    res.status(500).json({ 
      error: 'Failed to scan for leaks',
      details: error.message 
    });
  }
});

/**
 * Get leak detection statistics (admin only)
 * GET /api/leak-detection/stats
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const leakDetectionService: LeakDetectionService = req.app.get('leakDetectionService');
    const leakDetectionQueue: LeakDetectionQueue = req.app.get('leakDetectionQueue');

    const [detectionStats, queueStats] = await Promise.all([
      leakDetectionService.getDetectionStats(),
      leakDetectionQueue.getQueueStats()
    ]);

    res.json({
      detection: detectionStats,
      queue: queueStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting leak detection stats:', error);
    res.status(500).json({ 
      error: 'Failed to get leak detection stats',
      details: error.message 
    });
  }
});

/**
 * Update leak status (mark as resolved, disputed, etc.)
 * PUT /api/leak-detection/leak/:leakId/status
 */
router.put('/leak/:leakId/status', requireAuth, async (req, res) => {
  try {
    const { leakId } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['detected', 'dmca_sent', 'removed', 'disputed', 'false_positive'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        validStatuses 
      });
    }

    const redis = req.app.get('redis');
    const leakKey = `leak_match:${leakId}`;
    
    // Check if leak exists
    const exists = await redis.exists(leakKey);
    if (!exists) {
      return res.status(404).json({ error: 'Leak not found' });
    }

    // Update status
    await redis.hset(leakKey, {
      status,
      updatedAt: new Date().toISOString(),
      notes: notes || ''
    });

    res.json({
      success: true,
      leakId,
      status,
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating leak status:', error);
    res.status(500).json({ 
      error: 'Failed to update leak status',
      details: error.message 
    });
  }
});

/**
 * Pause/resume leak detection queue (admin only)
 * POST /api/leak-detection/queue/control
 */
router.post('/queue/control', requireAdmin, async (req, res) => {
  try {
    const { action } = req.body; // 'pause' or 'resume'
    
    if (!['pause', 'resume'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use "pause" or "resume"' });
    }

    const leakDetectionQueue: LeakDetectionQueue = req.app.get('leakDetectionQueue');
    
    if (action === 'pause') {
      await leakDetectionQueue.pause();
    } else {
      await leakDetectionQueue.resume();
    }

    res.json({
      success: true,
      action,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error controlling queue:', error);
    res.status(500).json({ 
      error: 'Failed to control queue',
      details: error.message 
    });
  }
});

// Helper function to get content URL (implementation depends on existing system)
async function getContentUrl(contentId: string): Promise<string> {
  // This would integrate with existing content management system
  // For now, return a placeholder
  return `https://platform.example.com/content/${contentId}/video.mp4`;
}

export default router;