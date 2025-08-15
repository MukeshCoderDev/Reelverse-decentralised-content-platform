import { Router, Request, Response } from 'express';
import { moderationService } from '../services/moderationService';
import { authenticateWallet } from '../middleware/auth';

const router = Router();

/**
 * Flag content for moderation
 * POST /api/moderation/flag
 */
router.post('/flag', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { contentId, reason, evidenceUrls } = req.body;
    const reporterWallet = (req as any).walletAddress;

    if (!contentId || !reason) {
      return res.status(400).json({
        code: 'MOD_001',
        message: 'Missing required fields: contentId, reason',
        timestamp: Date.now()
      });
    }

    const flag = await moderationService.flagContent(
      contentId,
      reporterWallet,
      reason,
      evidenceUrls || []
    );

    res.json({
      success: true,
      flagId: flag.id,
      status: flag.status,
      timestamp: flag.createdAt
    });
  } catch (error) {
    console.error('Content flagging error:', error);
    res.status(500).json({
      code: 'MOD_002',
      message: 'Failed to flag content',
      timestamp: Date.now()
    });
  }
});

/**
 * Get moderation queue
 * GET /api/moderation/queue
 */
router.get('/queue', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;
    const moderatorWallet = (req as any).walletAddress;

    // TODO: Add role-based access control for moderators
    const queue = await moderationService.getModerationQueue(
      status as string,
      undefined, // Don't filter by moderator for queue view
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      queue,
      total: queue.length,
      hasMore: queue.length === parseInt(limit as string)
    });
  } catch (error) {
    console.error('Moderation queue error:', error);
    res.status(500).json({
      code: 'MOD_003',
      message: 'Failed to get moderation queue',
      timestamp: Date.now()
    });
  }
});

/**
 * Process moderation decision
 * POST /api/moderation/decide
 */
router.post('/decide', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { flagId, decision, reason, blockchainTxHash } = req.body;
    const moderatorWallet = (req as any).walletAddress;

    if (!flagId || !decision || !reason) {
      return res.status(400).json({
        code: 'MOD_004',
        message: 'Missing required fields: flagId, decision, reason',
        timestamp: Date.now()
      });
    }

    if (!['approved', 'rejected', 'takedown'].includes(decision)) {
      return res.status(400).json({
        code: 'MOD_005',
        message: 'Invalid decision. Must be: approved, rejected, or takedown',
        timestamp: Date.now()
      });
    }

    const moderationDecision = await moderationService.processModerationDecision(
      flagId,
      moderatorWallet,
      decision,
      reason,
      blockchainTxHash
    );

    res.json({
      success: true,
      contentId: moderationDecision.contentId,
      decision: moderationDecision.decision,
      blockchainTx: moderationDecision.blockchainTxHash,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Moderation decision error:', error);
    
    if (error instanceof Error && error.message === 'Moderation flag not found') {
      return res.status(404).json({
        code: 'MOD_006',
        message: 'Moderation flag not found',
        timestamp: Date.now()
      });
    }

    res.status(500).json({
      code: 'MOD_007',
      message: 'Failed to process moderation decision',
      timestamp: Date.now()
    });
  }
});

/**
 * Submit DMCA takedown request
 * POST /api/moderation/dmca
 */
router.post('/dmca', async (req: Request, res: Response) => {
  try {
    const {
      contentId,
      claimantName,
      claimantEmail,
      claimantAddress,
      copyrightedWork,
      infringingUrls
    } = req.body;

    if (!contentId || !claimantName || !claimantEmail || !copyrightedWork) {
      return res.status(400).json({
        code: 'MOD_008',
        message: 'Missing required fields: contentId, claimantName, claimantEmail, copyrightedWork',
        timestamp: Date.now()
      });
    }

    const dmcaRequest = await moderationService.submitDMCARequest(
      contentId,
      claimantName,
      claimantEmail,
      claimantAddress || '',
      copyrightedWork,
      infringingUrls || []
    );

    res.json({
      success: true,
      requestId: dmcaRequest.id,
      status: dmcaRequest.status,
      matchesFound: dmcaRequest.perceptualHashMatches.length,
      timestamp: dmcaRequest.submittedAt
    });
  } catch (error) {
    console.error('DMCA submission error:', error);
    res.status(500).json({
      code: 'MOD_009',
      message: 'Failed to submit DMCA request',
      timestamp: Date.now()
    });
  }
});

/**
 * Process DMCA takedown decision
 * POST /api/moderation/dmca/:requestId/process
 */
router.post('/dmca/:requestId/process', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { approved, reason } = req.body;
    const moderatorWallet = (req as any).walletAddress;

    if (typeof approved !== 'boolean' || !reason) {
      return res.status(400).json({
        code: 'MOD_010',
        message: 'Missing required fields: approved (boolean), reason',
        timestamp: Date.now()
      });
    }

    await moderationService.processDMCATakedown(
      requestId,
      moderatorWallet,
      approved,
      reason
    );

    res.json({
      success: true,
      requestId,
      approved,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('DMCA processing error:', error);
    
    if (error instanceof Error && error.message === 'DMCA request not found') {
      return res.status(404).json({
        code: 'MOD_011',
        message: 'DMCA request not found',
        timestamp: Date.now()
      });
    }

    res.status(500).json({
      code: 'MOD_012',
      message: 'Failed to process DMCA takedown',
      timestamp: Date.now()
    });
  }
});

/**
 * Find similar content using perceptual hash
 * POST /api/moderation/similar
 */
router.post('/similar', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { contentUrl, threshold = 0.85 } = req.body;

    if (!contentUrl) {
      return res.status(400).json({
        code: 'MOD_013',
        message: 'Missing required field: contentUrl',
        timestamp: Date.now()
      });
    }

    // Compute perceptual hash for the content
    const perceptualHash = await moderationService.computePerceptualHash(contentUrl);
    
    // Find similar content
    const matches = await moderationService.findSimilarContent(perceptualHash, threshold);

    res.json({
      perceptualHash,
      matches,
      matchCount: matches.length,
      threshold
    });
  } catch (error) {
    console.error('Similar content search error:', error);
    res.status(500).json({
      code: 'MOD_014',
      message: 'Failed to find similar content',
      timestamp: Date.now()
    });
  }
});

/**
 * Get moderation statistics
 * GET /api/moderation/stats
 */
router.get('/stats', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { timeframe = 'week' } = req.query;

    if (!['day', 'week', 'month'].includes(timeframe as string)) {
      return res.status(400).json({
        code: 'MOD_015',
        message: 'Invalid timeframe. Must be: day, week, or month',
        timestamp: Date.now()
      });
    }

    const stats = await moderationService.getModerationStats(timeframe as any);

    res.json({
      timeframe,
      stats,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Moderation stats error:', error);
    res.status(500).json({
      code: 'MOD_016',
      message: 'Failed to get moderation statistics',
      timestamp: Date.now()
    });
  }
});

/**
 * Get audit trail for content
 * GET /api/moderation/audit/:contentId
 */
router.get('/audit/:contentId', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params;

    const auditTrail = await moderationService.generateAuditTrail(contentId);

    res.json({
      contentId,
      auditTrail,
      entryCount: auditTrail.length
    });
  } catch (error) {
    console.error('Audit trail error:', error);
    res.status(500).json({
      code: 'MOD_017',
      message: 'Failed to generate audit trail',
      timestamp: Date.now()
    });
  }
});

/**
 * Get my moderation history (for moderators)
 * GET /api/moderation/my-decisions
 */
router.get('/my-decisions', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const moderatorWallet = (req as any).walletAddress;

    const decisions = await moderationService.getModerationQueue(
      'resolved',
      moderatorWallet,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      decisions,
      total: decisions.length,
      hasMore: decisions.length === parseInt(limit as string)
    });
  } catch (error) {
    console.error('Moderation history error:', error);
    res.status(500).json({
      code: 'MOD_018',
      message: 'Failed to get moderation history',
      timestamp: Date.now()
    });
  }
});

export default router;