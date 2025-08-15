import express from 'express';
import { AdvancedSearchService } from '../../../services/advancedSearchService';
import { authenticateToken } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';

const router = express.Router();
const searchService = new AdvancedSearchService();

/**
 * Advanced hybrid search with personalization
 */
router.post('/search', optionalAuth, async (req, res) => {
  try {
    const {
      query,
      filters,
      limit = 20,
      offset = 0,
      personalizeResults = true
    } = req.body;

    if (!query && !filters) {
      return res.status(400).json({
        error: 'Query or filters are required'
      });
    }

    const userId = req.user?.id;
    
    const searchResults = await searchService.search({
      query,
      userId,
      filters,
      limit,
      offset,
      personalizeResults: personalizeResults && !!userId
    });

    res.json({
      success: true,
      data: searchResults
    });
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get personalized content recommendations
 */
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10, exclude } = req.query;
    
    const excludeContentIds = exclude 
      ? (Array.isArray(exclude) ? exclude : [exclude]) as string[]
      : [];

    const recommendations = await searchService.getPersonalizedRecommendations(
      userId,
      parseInt(limit as string),
      excludeContentIds
    );

    res.json({
      success: true,
      data: {
        recommendations,
        userId,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get trending content
 */
router.get('/trending', optionalAuth, async (req, res) => {
  try {
    const { timeframe = '24h', limit = 20 } = req.query;
    
    if (!['1h', '24h', '7d'].includes(timeframe as string)) {
      return res.status(400).json({
        error: 'Invalid timeframe. Must be 1h, 24h, or 7d'
      });
    }

    const trendingContent = await searchService.getTrendingContent(
      timeframe as '1h' | '24h' | '7d',
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: {
        trending: trendingContent,
        timeframe,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting trending content:', error);
    res.status(500).json({
      error: 'Failed to get trending content',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Track user interactions for personalization
 */
router.post('/interactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      contentId,
      interactionType,
      dwellTime,
      sessionId,
      metadata
    } = req.body;

    if (!contentId || !interactionType || !sessionId) {
      return res.status(400).json({
        error: 'Content ID, interaction type, and session ID are required'
      });
    }

    await searchService.trackInteraction({
      userId,
      contentId,
      interactionType,
      timestamp: new Date(),
      dwellTime,
      sessionId,
      metadata
    });

    res.json({
      success: true,
      message: 'Interaction tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking interaction:', error);
    res.status(500).json({
      error: 'Failed to track interaction',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get search algorithm transparency information
 */
router.get('/transparency', optionalAuth, async (req, res) => {
  try {
    const transparencyInfo = {
      algorithms: {
        hybrid: {
          name: 'Hybrid Search',
          description: 'Combines keyword matching (BM25), semantic similarity (vector embeddings), and popularity signals',
          factors: [
            { name: 'Keyword Relevance', weight: 0.4, description: 'How well keywords match content' },
            { name: 'Semantic Similarity', weight: 0.4, description: 'Meaning-based content matching' },
            { name: 'Popularity Score', weight: 0.2, description: 'User engagement metrics' }
          ]
        },
        vector: {
          name: 'Semantic Search',
          description: 'Uses AI embeddings to find content with similar meaning to your search',
          factors: [
            { name: 'Vector Similarity', weight: 1.0, description: 'AI-powered semantic matching' }
          ]
        },
        bm25: {
          name: 'Keyword Search',
          description: 'Traditional keyword-based search using BM25 algorithm',
          factors: [
            { name: 'Term Frequency', weight: 0.6, description: 'How often keywords appear' },
            { name: 'Document Frequency', weight: 0.4, description: 'Rarity of keywords' }
          ]
        },
        popularity: {
          name: 'Popularity Ranking',
          description: 'Content ranked by user engagement and popularity metrics',
          factors: [
            { name: 'View Count', weight: 0.3, description: 'Total number of views' },
            { name: 'Purchase Rate', weight: 0.4, description: 'Conversion to purchases' },
            { name: 'User Rating', weight: 0.3, description: 'Average user ratings' }
          ]
        },
        personalized: {
          name: 'Personalized Ranking',
          description: 'Results tailored to your viewing history and preferences',
          factors: [
            { name: 'Category Preference', weight: 0.3, description: 'Your preferred content categories' },
            { name: 'Tag Affinity', weight: 0.3, description: 'Tags you engage with most' },
            { name: 'Creator Preference', weight: 0.2, description: 'Creators you follow or purchase from' },
            { name: 'Behavioral Signals', weight: 0.2, description: 'Your browsing and purchase patterns' }
          ]
        }
      },
      banditOptimization: {
        description: 'We use multi-armed bandit algorithms to automatically optimize which search algorithm works best for different users and queries',
        explorationRate: 0.1,
        explanation: 'We balance showing you the best results (exploitation) with trying new approaches (exploration) to continuously improve your experience'
      },
      personalization: {
        description: 'When you\'re logged in, we personalize results based on your preferences and behavior',
        dataUsed: [
          'Content categories you view and purchase',
          'Tags and keywords you search for',
          'Creators you follow or support',
          'Time spent viewing different content types',
          'Purchase history and preferences'
        ],
        privacy: 'All personalization data is encrypted and used only to improve your experience. You can opt out of personalization in your settings.'
      },
      qualitySignals: {
        description: 'We use various signals to determine content quality and relevance',
        signals: [
          'User ratings and reviews',
          'Engagement metrics (views, likes, shares)',
          'Content freshness and upload date',
          'Creator verification status',
          'Production quality indicators',
          'Compliance and safety scores'
        ]
      }
    };

    res.json({
      success: true,
      data: transparencyInfo
    });
  } catch (error) {
    console.error('Error getting transparency info:', error);
    res.status(500).json({
      error: 'Failed to get transparency information',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get search analytics and performance metrics
 */
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeframe = '30d' } = req.query;

    // This would fetch real analytics data
    const analyticsData = {
      userId,
      timeframe,
      searchMetrics: {
        totalSearches: 247,
        averageResultsClicked: 2.3,
        averageDwellTime: 45.2,
        conversionRate: 0.087,
        topQueries: [
          { query: 'premium content', count: 23, ctr: 0.12 },
          { query: 'exclusive videos', count: 18, ctr: 0.09 },
          { query: 'behind scenes', count: 15, ctr: 0.14 }
        ]
      },
      personalizationMetrics: {
        profileCompleteness: 0.78,
        recommendationAccuracy: 0.65,
        personalizedCTR: 0.094,
        genericCTR: 0.067,
        improvementRate: 0.40
      },
      algorithmPerformance: {
        hybrid: { usage: 0.45, satisfaction: 0.82, ctr: 0.091 },
        vector: { usage: 0.25, satisfaction: 0.79, ctr: 0.088 },
        bm25: { usage: 0.15, satisfaction: 0.71, ctr: 0.074 },
        popularity: { usage: 0.10, satisfaction: 0.85, ctr: 0.103 },
        personalized: { usage: 0.05, satisfaction: 0.89, ctr: 0.112 }
      },
      engagementMetrics: {
        averageSessionDuration: 18.5,
        pagesPerSession: 4.2,
        bounceRate: 0.23,
        returnVisitorRate: 0.67
      }
    };

    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    console.error('Error getting search analytics:', error);
    res.status(500).json({
      error: 'Failed to get search analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * A/B test endpoint for algorithm comparison
 */
router.post('/ab-test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      query,
      algorithmA,
      algorithmB,
      filters
    } = req.body;

    if (!query || !algorithmA || !algorithmB) {
      return res.status(400).json({
        error: 'Query and both algorithms are required for A/B testing'
      });
    }

    // Run both algorithms in parallel
    const [resultsA, resultsB] = await Promise.all([
      searchService.search({
        query,
        userId,
        filters,
        limit: 10,
        personalizeResults: algorithmA === 'personalized'
      }),
      searchService.search({
        query,
        userId,
        filters,
        limit: 10,
        personalizeResults: algorithmB === 'personalized'
      })
    ]);

    res.json({
      success: true,
      data: {
        query,
        algorithmA: {
          name: algorithmA,
          results: resultsA.results,
          algorithmUsed: resultsA.algorithmUsed
        },
        algorithmB: {
          name: algorithmB,
          results: resultsB.results,
          algorithmUsed: resultsB.algorithmUsed
        },
        testId: `ab_${Date.now()}_${userId}`,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error running A/B test:', error);
    res.status(500).json({
      error: 'Failed to run A/B test',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;