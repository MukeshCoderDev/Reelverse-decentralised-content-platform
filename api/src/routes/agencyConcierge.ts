import express from 'express';
import { AgencyConciergeService } from '../../../services/agencyConciergeService';
import { authenticateToken } from '../middleware/auth';
import { validateAgencyAccess } from '../middleware/validation';

const router = express.Router();
const conciergeService = new AgencyConciergeService();

/**
 * Process natural language query
 */
router.post('/query', authenticateToken, validateAgencyAccess, async (req, res) => {
  try {
    const { query, channel = 'web', channelId } = req.body;
    const userId = req.user.id;
    const agencyId = req.user.agencyId;

    if (!query) {
      return res.status(400).json({
        error: 'Query is required'
      });
    }

    const queryRequest = {
      queryId: `query_${Date.now()}_${userId}`,
      agencyId,
      userId,
      query,
      channel,
      channelId,
      timestamp: new Date(),
      resolved: false
    };

    const result = await conciergeService.processQuery(queryRequest);

    res.json({
      success: true,
      data: {
        queryId: queryRequest.queryId,
        response: result.response,
        data: result.data,
        actions: result.actions,
        followUp: result.followUp,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error processing concierge query:', error);
    res.status(500).json({
      error: 'Failed to process query',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get agency analytics data (secure, read-only)
 */
router.get('/analytics/:agencyId', authenticateToken, validateAgencyAccess, async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { timeframe = '30d', metric = 'overview' } = req.query;

    // Validate agency access
    if (req.user.agencyId !== agencyId) {
      return res.status(403).json({
        error: 'Access denied to this agency data'
      });
    }

    // This would fetch real analytics data with proper access controls
    const analyticsData = {
      agencyId,
      timeframe,
      metric,
      data: {
        revenue: {
          total: 125000,
          growth: 15.3,
          byCategory: {
            premium: 75000,
            exclusive: 35000,
            standard: 15000
          }
        },
        creators: {
          total: 45,
          active: 38,
          topPerformers: [
            { id: 'creator1', name: 'Creator A', revenue: 25000 },
            { id: 'creator2', name: 'Creator B', revenue: 18500 },
            { id: 'creator3', name: 'Creator C', revenue: 15200 }
          ]
        },
        content: {
          total: 1250,
          views: 2500000,
          averageRating: 4.3,
          topPerforming: [
            { id: 'content1', title: 'Premium Content A', views: 125000, revenue: 8500 },
            { id: 'content2', title: 'Exclusive Content B', views: 98000, revenue: 6200 }
          ]
        },
        engagement: {
          conversionRate: 0.087,
          averageSessionDuration: 18.5,
          returnVisitorRate: 0.67
        }
      },
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    console.error('Error fetching agency analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get creator performance data (secure, read-only)
 */
router.get('/creators/:agencyId', authenticateToken, validateAgencyAccess, async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { creatorId, timeframe = '30d', limit = 10 } = req.query;

    // Validate agency access
    if (req.user.agencyId !== agencyId) {
      return res.status(403).json({
        error: 'Access denied to this agency data'
      });
    }

    const creatorData = {
      agencyId,
      timeframe,
      creators: creatorId ? [
        {
          id: creatorId,
          name: 'Sample Creator',
          revenue: 25000,
          content: 50,
          views: 500000,
          rating: 4.5,
          followers: 12500,
          growth: 12.3,
          topContent: [
            { id: 'content1', title: 'Top Video', views: 50000, revenue: 3500 }
          ]
        }
      ] : [
        { id: 'creator1', name: 'Creator A', revenue: 25000, content: 50, rating: 4.5 },
        { id: 'creator2', name: 'Creator B', revenue: 18500, content: 35, rating: 4.3 },
        { id: 'creator3', name: 'Creator C', revenue: 15200, content: 42, rating: 4.1 }
      ],
      summary: {
        totalCreators: 45,
        totalRevenue: 125000,
        averageRating: 4.3,
        needsAttention: 3
      },
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: creatorData
    });
  } catch (error) {
    console.error('Error fetching creator data:', error);
    res.status(500).json({
      error: 'Failed to fetch creator data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get content performance data (secure, read-only)
 */
router.get('/content/:agencyId', authenticateToken, validateAgencyAccess, async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { contentId, timeframe = '30d', category, limit = 20 } = req.query;

    // Validate agency access
    if (req.user.agencyId !== agencyId) {
      return res.status(403).json({
        error: 'Access denied to this agency data'
      });
    }

    const contentData = {
      agencyId,
      timeframe,
      content: contentId ? [
        {
          id: contentId,
          title: 'Sample Content',
          views: 50000,
          revenue: 2500,
          rating: 4.2,
          category: 'premium',
          creator: 'Creator A',
          uploadDate: '2024-01-15',
          performance: {
            clickThroughRate: 0.085,
            conversionRate: 0.12,
            engagementRate: 0.67
          }
        }
      ] : [
        { id: 'content1', title: 'Premium Content A', views: 125000, revenue: 8500, rating: 4.5 },
        { id: 'content2', title: 'Exclusive Content B', views: 98000, revenue: 6200, rating: 4.3 },
        { id: 'content3', title: 'Standard Content C', views: 75000, revenue: 4100, rating: 4.1 }
      ],
      summary: {
        totalContent: 1250,
        totalViews: 2500000,
        totalRevenue: 125000,
        averageRating: 4.3,
        categories: ['premium', 'exclusive', 'standard'],
        pendingModeration: 5
      },
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: contentData
    });
  } catch (error) {
    console.error('Error fetching content data:', error);
    res.status(500).json({
      error: 'Failed to fetch content data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate data export (secure)
 */
router.post('/export/:agencyId', authenticateToken, validateAgencyAccess, async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { dataType, format = 'csv', timeframe = '30d', filters } = req.body;

    // Validate agency access
    if (req.user.agencyId !== agencyId) {
      return res.status(403).json({
        error: 'Access denied to this agency data'
      });
    }

    if (!dataType) {
      return res.status(400).json({
        error: 'Data type is required'
      });
    }

    // Generate export (this would create actual export files)
    const exportResult = {
      exportId: `export_${Date.now()}_${agencyId}`,
      dataType,
      format,
      timeframe,
      recordCount: 1000,
      fileSize: '2.5 MB',
      downloadUrl: `https://api.platform.com/exports/download/${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: exportResult
    });
  } catch (error) {
    console.error('Error generating export:', error);
    res.status(500).json({
      error: 'Failed to generate export',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate report (secure)
 */
router.post('/report/:agencyId', authenticateToken, validateAgencyAccess, async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { reportType, timeframe = '30d', includeCharts = true, format = 'pdf' } = req.body;

    // Validate agency access
    if (req.user.agencyId !== agencyId) {
      return res.status(403).json({
        error: 'Access denied to this agency data'
      });
    }

    if (!reportType) {
      return res.status(400).json({
        error: 'Report type is required'
      });
    }

    // Generate report (this would create actual report files)
    const reportResult = {
      reportId: `report_${Date.now()}_${agencyId}`,
      reportType,
      timeframe,
      format,
      includeCharts,
      pageCount: 15,
      fileSize: '5.2 MB',
      downloadUrl: `https://api.platform.com/reports/download/${Date.now()}`,
      insights: [
        'Revenue increased by 15.3% compared to previous period',
        'Top performing category is Premium content (60% of revenue)',
        '3 creators need attention for performance improvement',
        'Content upload rate is 23% above target'
      ],
      recommendations: [
        'Focus marketing efforts on Premium content category',
        'Provide additional support to underperforming creators',
        'Consider expanding successful content formats',
        'Optimize pricing for Standard category content'
      ],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: reportResult
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      error: 'Failed to generate report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get FAQ database
 */
router.get('/faq', authenticateToken, async (req, res) => {
  try {
    const { category, search, limit = 20 } = req.query;

    // This would fetch from actual FAQ database
    const faqData = [
      {
        id: '1',
        question: 'How do I add a new creator to my agency?',
        answer: 'To add a new creator, go to the Creator Management section, click "Add Creator", and follow the onboarding process including verification and contract setup.',
        category: 'creator_management',
        keywords: ['add creator', 'new creator', 'onboard', 'creator management'],
        lastUpdated: '2024-01-15T10:00:00Z'
      },
      {
        id: '2',
        question: 'How can I view my revenue analytics?',
        answer: 'Revenue analytics are available in the Analytics dashboard. You can filter by time period, creator, or content category to get detailed insights.',
        category: 'analytics',
        keywords: ['revenue', 'analytics', 'earnings', 'money', 'income'],
        lastUpdated: '2024-01-15T10:00:00Z'
      },
      {
        id: '3',
        question: 'What are the content moderation guidelines?',
        answer: 'All content must comply with platform guidelines including age verification, consent documentation, and content quality standards. Check the Moderation section for detailed guidelines.',
        category: 'content_management',
        keywords: ['moderation', 'guidelines', 'content rules', 'compliance'],
        lastUpdated: '2024-01-15T10:00:00Z'
      }
    ];

    let filteredFAQ = faqData;

    if (category) {
      filteredFAQ = filteredFAQ.filter(faq => faq.category === category);
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredFAQ = filteredFAQ.filter(faq => 
        faq.question.toLowerCase().includes(searchLower) ||
        faq.answer.toLowerCase().includes(searchLower) ||
        faq.keywords.some(keyword => keyword.toLowerCase().includes(searchLower))
      );
    }

    filteredFAQ = filteredFAQ.slice(0, parseInt(limit as string));

    res.json({
      success: true,
      data: {
        faqs: filteredFAQ,
        categories: ['creator_management', 'analytics', 'content_management', 'payments', 'compliance'],
        totalCount: filteredFAQ.length
      }
    });
  } catch (error) {
    console.error('Error fetching FAQ:', error);
    res.status(500).json({
      error: 'Failed to fetch FAQ',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Slack webhook endpoint
 */
router.post('/slack/webhook', async (req, res) => {
  try {
    const { challenge, event } = req.body;

    // Handle Slack URL verification
    if (challenge) {
      return res.json({ challenge });
    }

    // Handle Slack events
    if (event && event.type === 'message' && !event.bot_id) {
      const { user, text, channel } = event;
      
      // Process the message as a query
      const queryRequest = {
        queryId: `slack_${Date.now()}_${user}`,
        agencyId: 'agency_from_slack_user', // This would be resolved from Slack user
        userId: user,
        query: text,
        channel: 'slack' as const,
        channelId: channel,
        timestamp: new Date(),
        resolved: false
      };

      // Process asynchronously
      conciergeService.processQuery(queryRequest).catch(console.error);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error handling Slack webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Email webhook endpoint (for services like SendGrid, Mailgun)
 */
router.post('/email/webhook', async (req, res) => {
  try {
    const { from, subject, text } = req.body;

    // Extract agency/user info from email
    const agencyId = 'agency_from_email'; // This would be resolved from email
    const userId = 'user_from_email';

    const queryRequest = {
      queryId: `email_${Date.now()}_${userId}`,
      agencyId,
      userId,
      query: text || subject,
      channel: 'email' as const,
      channelId: from,
      timestamp: new Date(),
      resolved: false
    };

    // Process asynchronously
    conciergeService.processQuery(queryRequest).catch(console.error);

    res.json({ ok: true });
  } catch (error) {
    console.error('Error handling email webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;