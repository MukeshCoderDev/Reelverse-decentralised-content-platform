import express from 'express';
import { CreatorAIToolkitService } from '../../services/creatorAIToolkitService';
import { authenticateToken } from '../middleware/auth';
import { validateCreatorAccess } from '../middleware/validation';

const router = express.Router();
const aiToolkit = new CreatorAIToolkitService();

/**
 * Generate AI-powered title suggestions
 */
router.post('/titles/generate', authenticateToken, validateCreatorAccess, async (req, res) => {
  try {
    const { contentId, contentMetadata, options } = req.body;

    if (!contentId || !contentMetadata) {
      return res.status(400).json({
        error: 'Content ID and metadata are required'
      });
    }

    const suggestions = await aiToolkit.generateTitleSuggestions(
      contentId,
      contentMetadata,
      options
    );

    res.json({
      success: true,
      data: {
        contentId,
        suggestions,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating title suggestions:', error);
    res.status(500).json({
      error: 'Failed to generate title suggestions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate thumbnail variations
 */
router.post('/thumbnails/generate', authenticateToken, validateCreatorAccess, async (req, res) => {
  try {
    const { contentId, videoUrl, options } = req.body;

    if (!contentId || !videoUrl) {
      return res.status(400).json({
        error: 'Content ID and video URL are required'
      });
    }

    const variations = await aiToolkit.generateThumbnailVariations(
      contentId,
      videoUrl,
      options
    );

    res.json({
      success: true,
      data: {
        contentId,
        variations,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating thumbnail variations:', error);
    res.status(500).json({
      error: 'Failed to generate thumbnail variations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate caption suggestions for social media
 */
router.post('/captions/generate', authenticateToken, validateCreatorAccess, async (req, res) => {
  try {
    const { contentId, contentMetadata, platform = 'twitter' } = req.body;

    if (!contentId || !contentMetadata) {
      return res.status(400).json({
        error: 'Content ID and metadata are required'
      });
    }

    const suggestions = await aiToolkit.generateCaptionSuggestions(
      contentId,
      contentMetadata,
      platform
    );

    res.json({
      success: true,
      data: {
        contentId,
        platform,
        suggestions,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating caption suggestions:', error);
    res.status(500).json({
      error: 'Failed to generate caption suggestions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate brand-safe SFW preview
 */
router.post('/sfw-preview/generate', authenticateToken, validateCreatorAccess, async (req, res) => {
  try {
    const { contentId, videoUrl, options } = req.body;

    if (!contentId || !videoUrl) {
      return res.status(400).json({
        error: 'Content ID and video URL are required'
      });
    }

    const preview = await aiToolkit.generateSFWPreview(
      contentId,
      videoUrl,
      options
    );

    res.json({
      success: true,
      data: {
        contentId,
        preview,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating SFW preview:', error);
    res.status(500).json({
      error: 'Failed to generate SFW preview',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get content calendar recommendations
 */
router.get('/calendar/:creatorId', authenticateToken, validateCreatorAccess, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { timeframe = 'week' } = req.query;

    if (!creatorId) {
      return res.status(400).json({
        error: 'Creator ID is required'
      });
    }

    const recommendations = await aiToolkit.generateContentCalendarRecommendations(
      creatorId,
      timeframe as 'week' | 'month'
    );

    res.json({
      success: true,
      data: {
        creatorId,
        timeframe,
        recommendations,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating content calendar:', error);
    res.status(500).json({
      error: 'Failed to generate content calendar',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Track CTR improvement metrics
 */
router.post('/analytics/ctr', authenticateToken, validateCreatorAccess, async (req, res) => {
  try {
    const { creatorId, assetId, assetType, metrics } = req.body;

    if (!creatorId || !assetId || !assetType || !metrics) {
      return res.status(400).json({
        error: 'Creator ID, asset ID, asset type, and metrics are required'
      });
    }

    const analytics = await aiToolkit.trackCTRImprovement(
      creatorId,
      assetId,
      assetType,
      metrics
    );

    res.json({
      success: true,
      data: {
        analytics,
        recordedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error tracking CTR improvement:', error);
    res.status(500).json({
      error: 'Failed to track CTR improvement',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get AI toolkit analytics dashboard data
 */
router.get('/analytics/:creatorId', authenticateToken, validateCreatorAccess, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { timeframe = '30d' } = req.query;

    // This would fetch comprehensive analytics data
    const dashboardData = {
      creatorId,
      timeframe,
      summary: {
        totalAssetsGenerated: 156,
        averageCTRImprovement: 23.5,
        totalRevenueLift: 1250.75,
        topPerformingAssetType: 'thumbnail'
      },
      titlePerformance: {
        generated: 45,
        averageCTR: 0.087,
        bestPerforming: {
          title: "Exclusive Behind-the-Scenes Content",
          ctr: 0.142,
          improvement: 34.2
        }
      },
      thumbnailPerformance: {
        generated: 78,
        averageCTR: 0.156,
        bestPerforming: {
          style: 'close_up',
          ctr: 0.203,
          improvement: 45.7
        }
      },
      captionPerformance: {
        generated: 33,
        averageEngagement: 127.5,
        bestPerforming: {
          platform: 'twitter',
          engagement: 245,
          improvement: 28.9
        }
      },
      calendarOptimization: {
        recommendationsFollowed: 18,
        averageUplift: 19.3,
        bestTimeSlot: '2:00 PM - 4:00 PM',
        bestDay: 'Thursday'
      }
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Error fetching AI toolkit analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;