import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../config/database';
import { authenticateUser } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const SplitItemSchema = z.object({
  payeeUserId: z.string().uuid('Invalid payee user ID'),
  percent: z.number()
    .min(0.01, 'Minimum split is 0.01%')
    .max(100, 'Maximum split is 100%')
    .multipleOf(0.01, 'Split must be in hundredths'),
  isCreator: z.boolean().default(false)
});

const CreateSplitPolicySchema = z.object({
  splits: z.array(SplitItemSchema)
    .min(1, 'At least one split required')
    .max(10, 'Maximum 10 splits allowed')
    .refine(
      (splits) => {
        const total = splits.reduce((sum, split) => sum + split.percent, 0);
        return Math.abs(total - 100) < 0.001; // Allow for floating point precision
      },
      'Split percentages must total exactly 100%'
    )
    .refine(
      (splits) => splits.filter(s => s.isCreator).length === 1,
      'Exactly one payee must be marked as creator'
    )
});

const UpdateVideoSplitsSchema = z.object({
  policyId: z.string().uuid('Invalid policy ID').optional(),
  splits: z.array(SplitItemSchema).optional()
}).refine(
  (data) => data.policyId || data.splits,
  'Either policyId or splits must be provided'
);

// Rate limiting for split management
const splitsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Too many split management requests. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * GET /api/videos/:id/splits
 * Retrieve current split policy for video (versioned)
 * 
 * Returns:
 * - policyId: UUID of the applied policy
 * - version: Policy version number
 * - splits: Array of payee splits with percentages
 * - totalPercent: Always 100.00
 * - appliedAt: When policy was applied to video
 */
router.get('/:videoId/splits', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const db = getDatabase();
    
    // Validate video ID format
    if (!videoId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        error: 'Invalid video ID format',
        code: 'INVALID_VIDEO_ID'
      });
    }
    
    const query = await db.query(`
      SELECT 
        vsa.policy_id,
        sp.version,
        sp.total_percent,
        vsa.applied_at,
        jsonb_agg(
          jsonb_build_object(
            'payeeUserId', spi.payee_user_id,
            'percent', spi.percent,
            'isCreator', spi.is_creator,
            'name', COALESCE(u.username, u.email, 'Unknown User')
          ) ORDER BY spi.is_creator DESC, spi.percent DESC
        ) as splits
      FROM video_split_applied vsa
      JOIN split_policies sp ON vsa.policy_id = sp.id
      JOIN split_policy_items spi ON sp.id = spi.policy_id
      LEFT JOIN users u ON spi.payee_user_id = u.id
      WHERE vsa.video_id = $1
      GROUP BY vsa.policy_id, sp.version, sp.total_percent, vsa.applied_at
    `, [videoId]);
    
    if (query.rows.length === 0) {
      return res.status(404).json({
        error: 'No split policy found for this video',
        code: 'NO_SPLIT_POLICY',
        message: 'Video uses default 100% creator split'
      });
    }
    
    const result = query.rows[0];
    
    res.json({
      policyId: result.policy_id,
      version: result.version,
      splits: result.splits,
      totalPercent: parseFloat(result.total_percent),
      appliedAt: result.applied_at
    });
    
  } catch (error) {
    logger.error('Failed to fetch video splits', {
      error: error.message,
      videoId: req.params.videoId
    });
    
    res.status(500).json({
      error: 'Failed to fetch video splits',
      code: 'SPLITS_FETCH_ERROR'
    });
  }
});

/**
 * POST /api/videos/:id/splits
 * Create and apply new split policy to video
 * Only video creator can set splits
 */
router.post('/:videoId/splits',
  authenticateUser,
  splitsRateLimit,
  async (req: Request, res: Response) => {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      const { videoId } = req.params;
      const userId = (req as any).userId;
      const { splits } = CreateSplitPolicySchema.parse(req.body);
      
      await client.query('BEGIN');
      
      // Verify user owns the video
      const videoQuery = await client.query(`
        SELECT creator_id FROM videos WHERE id = $1
      `, [videoId]);
      
      if (videoQuery.rows.length === 0) {
        return res.status(404).json({
          error: 'Video not found',
          code: 'VIDEO_NOT_FOUND'
        });
      }
      
      const videoCreatorId = videoQuery.rows[0].creator_id;
      
      if (videoCreatorId !== userId) {
        return res.status(403).json({
          error: 'Only video creator can set splits',
          code: 'UNAUTHORIZED_SPLIT_MODIFICATION'
        });
      }
      
      // Verify all payee users exist
      const payeeIds = splits.map(s => s.payeeUserId);
      const usersQuery = await client.query(`
        SELECT id, username, email FROM users WHERE id = ANY($1)
      `, [payeeIds]);
      
      if (usersQuery.rows.length !== payeeIds.length) {
        const foundIds = usersQuery.rows.map(u => u.id);
        const missingIds = payeeIds.filter(id => !foundIds.includes(id));
        
        return res.status(400).json({
          error: 'Some payee users not found',
          code: 'INVALID_PAYEE_USERS',
          missingUserIds: missingIds
        });
      }
      
      // Ensure creator is included in splits
      const creatorSplit = splits.find(s => s.isCreator && s.payeeUserId === userId);
      if (!creatorSplit) {
        return res.status(400).json({
          error: 'Video creator must be included in splits as creator',
          code: 'CREATOR_NOT_IN_SPLITS'
        });
      }
      
      // Create split policy
      const policyData = splits.map(s => ({
        payee_user_id: s.payeeUserId,
        percent: s.percent,
        is_creator: s.isCreator
      }));
      
      const policyQuery = await client.query(`
        SELECT create_split_policy('video', $1, $2)
      `, [userId, JSON.stringify(policyData)]);
      
      const policyId = policyQuery.rows[0].create_split_policy;
      
      // Apply policy to video
      await client.query(`
        SELECT apply_split_policy_to_video($1, $2)
      `, [videoId, policyId]);
      
      await client.query('COMMIT');
      
      // Get the created policy with user details
      const resultQuery = await client.query(`
        SELECT 
          sp.id as policy_id,
          sp.version,
          sp.total_percent,
          NOW() as applied_at,
          jsonb_agg(
            jsonb_build_object(
              'payeeUserId', spi.payee_user_id,
              'percent', spi.percent,
              'isCreator', spi.is_creator,
              'name', COALESCE(u.username, u.email, 'Unknown User')
            ) ORDER BY spi.is_creator DESC, spi.percent DESC
          ) as splits
        FROM split_policies sp
        JOIN split_policy_items spi ON sp.id = spi.policy_id
        LEFT JOIN users u ON spi.payee_user_id = u.id
        WHERE sp.id = $1
        GROUP BY sp.id, sp.version, sp.total_percent
      `, [policyId]);
      
      const result = resultQuery.rows[0];
      
      logger.info('Video split policy created and applied', {
        videoId,
        policyId,
        creatorId: userId,
        splitCount: splits.length
      });
      
      res.json({
        ok: true,
        policyId: result.policy_id,
        version: result.version,
        splits: result.splits,
        totalPercent: parseFloat(result.total_percent),
        appliedAt: result.applied_at
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      logger.error('Failed to create video split policy', {
        error: error.message,
        videoId: req.params.videoId,
        userId: (req as any).userId
      });
      
      res.status(500).json({
        error: 'Failed to create split policy',
        code: 'SPLIT_CREATION_ERROR'
      });
    } finally {
      client.release();
    }
  }
);

/**
 * PUT /api/videos/:id/splits
 * Update video split policy (creates new version)
 */
router.put('/:videoId/splits',
  authenticateUser,
  splitsRateLimit,
  async (req: Request, res: Response) => {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      const { videoId } = req.params;
      const userId = (req as any).userId;
      const { policyId, splits } = UpdateVideoSplitsSchema.parse(req.body);
      
      await client.query('BEGIN');
      
      // Verify user owns the video
      const videoQuery = await client.query(`
        SELECT creator_id FROM videos WHERE id = $1
      `, [videoId]);
      
      if (videoQuery.rows.length === 0) {
        return res.status(404).json({
          error: 'Video not found',
          code: 'VIDEO_NOT_FOUND'
        });
      }
      
      if (videoQuery.rows[0].creator_id !== userId) {
        return res.status(403).json({
          error: 'Only video creator can modify splits',
          code: 'UNAUTHORIZED_SPLIT_MODIFICATION'
        });
      }
      
      let finalPolicyId = policyId;
      
      // If splits provided, create new policy
      if (splits) {
        // Validate splits (same as POST)
        const creatorSplit = splits.find(s => s.isCreator && s.payeeUserId === userId);
        if (!creatorSplit) {
          return res.status(400).json({
            error: 'Video creator must be included in splits as creator',
            code: 'CREATOR_NOT_IN_SPLITS'
          });
        }
        
        const policyData = splits.map(s => ({
          payee_user_id: s.payeeUserId,
          percent: s.percent,
          is_creator: s.isCreator
        }));
        
        const newPolicyQuery = await client.query(`
          SELECT create_split_policy('video', $1, $2)
        `, [userId, JSON.stringify(policyData)]);
        
        finalPolicyId = newPolicyQuery.rows[0].create_split_policy;
      }
      
      // Apply policy to video
      await client.query(`
        SELECT apply_split_policy_to_video($1, $2)
      `, [videoId, finalPolicyId]);
      
      await client.query('COMMIT');
      
      // Return updated policy
      const resultQuery = await client.query(`
        SELECT 
          vsa.policy_id,
          sp.version,
          sp.total_percent,
          vsa.applied_at,
          jsonb_agg(
            jsonb_build_object(
              'payeeUserId', spi.payee_user_id,
              'percent', spi.percent,
              'isCreator', spi.is_creator,
              'name', COALESCE(u.username, u.email, 'Unknown User')
            ) ORDER BY spi.is_creator DESC, spi.percent DESC
          ) as splits
        FROM video_split_applied vsa
        JOIN split_policies sp ON vsa.policy_id = sp.id
        JOIN split_policy_items spi ON sp.id = spi.policy_id
        LEFT JOIN users u ON spi.payee_user_id = u.id
        WHERE vsa.video_id = $1
        GROUP BY vsa.policy_id, sp.version, sp.total_percent, vsa.applied_at
      `, [videoId]);
      
      const result = resultQuery.rows[0];
      
      res.json({
        ok: true,
        policyId: result.policy_id,
        version: result.version,
        splits: result.splits,
        totalPercent: parseFloat(result.total_percent),
        appliedAt: result.applied_at
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      logger.error('Failed to update video split policy', {
        error: error.message,
        videoId: req.params.videoId,
        userId: (req as any).userId
      });
      
      res.status(500).json({
        error: 'Failed to update split policy',
        code: 'SPLIT_UPDATE_ERROR'
      });
    } finally {
      client.release();
    }
  }
);

/**
 * DELETE /api/videos/:id/splits
 * Remove split policy (revert to 100% creator)
 */
router.delete('/:videoId/splits',
  authenticateUser,
  splitsRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { videoId } = req.params;
      const userId = (req as any).userId;
      const db = getDatabase();
      
      // Verify user owns the video
      const videoQuery = await db.query(`
        SELECT creator_id FROM videos WHERE id = $1
      `, [videoId]);
      
      if (videoQuery.rows.length === 0) {
        return res.status(404).json({
          error: 'Video not found',
          code: 'VIDEO_NOT_FOUND'
        });
      }
      
      if (videoQuery.rows[0].creator_id !== userId) {
        return res.status(403).json({
          error: 'Only video creator can remove splits',
          code: 'UNAUTHORIZED_SPLIT_MODIFICATION'
        });
      }
      
      // Remove split policy application
      const deleteQuery = await db.query(`
        DELETE FROM video_split_applied WHERE video_id = $1
        RETURNING policy_id
      `, [videoId]);
      
      if (deleteQuery.rows.length === 0) {
        return res.status(404).json({
          error: 'No split policy found for this video',
          code: 'NO_SPLIT_POLICY'
        });
      }
      
      logger.info('Video split policy removed', {
        videoId,
        creatorId: userId,
        removedPolicyId: deleteQuery.rows[0].policy_id
      });
      
      res.json({
        ok: true,
        message: 'Split policy removed. Video now uses 100% creator split.'
      });
      
    } catch (error) {
      logger.error('Failed to remove video split policy', {
        error: error.message,
        videoId: req.params.videoId,
        userId: (req as any).userId
      });
      
      res.status(500).json({
        error: 'Failed to remove split policy',
        code: 'SPLIT_REMOVAL_ERROR'
      });
    }
  }
);

/**
 * GET /api/videos/splits/policies
 * Get user's split policies for reuse
 */
router.get('/splits/policies', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const db = getDatabase();
    
    const query = await db.query(`
      SELECT 
        sp.id,
        sp.version,
        sp.total_percent,
        sp.created_at,
        COUNT(vsa.video_id) as videos_using_count,
        jsonb_agg(
          jsonb_build_object(
            'payeeUserId', spi.payee_user_id,
            'percent', spi.percent,
            'isCreator', spi.is_creator,
            'name', COALESCE(u.username, u.email, 'Unknown User')
          ) ORDER BY spi.is_creator DESC, spi.percent DESC
        ) as splits
      FROM split_policies sp
      JOIN split_policy_items spi ON sp.id = spi.policy_id
      LEFT JOIN users u ON spi.payee_user_id = u.id
      LEFT JOIN video_split_applied vsa ON sp.id = vsa.policy_id
      WHERE sp.created_by = $1 AND sp.scope = 'video'
      GROUP BY sp.id, sp.version, sp.total_percent, sp.created_at
      ORDER BY sp.created_at DESC
    `, [userId]);
    
    const policies = query.rows.map(row => ({
      id: row.id,
      version: row.version,
      splits: row.splits,
      totalPercent: parseFloat(row.total_percent),
      videosUsingCount: parseInt(row.videos_using_count),
      createdAt: row.created_at
    }));
    
    res.json({
      policies,
      total: policies.length
    });
    
  } catch (error) {
    logger.error('Failed to fetch split policies', {
      error: error.message,
      userId: (req as any).userId
    });
    
    res.status(500).json({
      error: 'Failed to fetch split policies',
      code: 'POLICIES_FETCH_ERROR'
    });
  }
});

export default router;