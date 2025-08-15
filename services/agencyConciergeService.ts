import { OpenAI } from 'openai';
import { WebClient as SlackWebClient } from '@slack/web-api';
import nodemailer from 'nodemailer';

interface AgencyQuery {
  queryId: string;
  agencyId: string;
  userId: string;
  query: string;
  channel: 'slack' | 'email' | 'web';
  channelId?: string; // Slack channel ID or email address
  timestamp: Date;
  resolved: boolean;
  response?: string;
  dataRequested?: string[];
  executionTime?: number;
}

interface AgencyAnalytics {
  agencyId: string;
  timeframe: string;
  metrics: {
    totalRevenue: number;
    totalCreators: number;
    totalContent: number;
    totalViews: number;
    averageRating: number;
    conversionRate: number;
    topPerformingContent: ContentMetric[];
    topPerformingCreators: CreatorMetric[];
    revenueByCategory: Record<string, number>;
    viewsByDay: Record<string, number>;
    geographicDistribution: Record<string, number>;
  };
}

interface ContentMetric {
  contentId: string;
  title: string;
  views: number;
  revenue: number;
  rating: number;
  category: string;
}

interface CreatorMetric {
  creatorId: string;
  name: string;
  totalRevenue: number;
  totalContent: number;
  averageRating: number;
  followers: number;
}

interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  confidence: number;
  lastUpdated: Date;
}

interface NLQueryResult {
  intent: 'analytics' | 'faq' | 'data_export' | 'report_generation' | 'creator_management' | 'content_management';
  entities: Record<string, any>;
  confidence: number;
  suggestedActions: string[];
  dataNeeded: string[];
}

export class AgencyConciergeService {
  private openai: OpenAI;
  private slackClient: SlackWebClient;
  private emailTransporter: nodemailer.Transporter;
  private faqDatabase: FAQEntry[] = [];

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.slackClient = new SlackWebClient(process.env.SLACK_BOT_TOKEN);

    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.initializeFAQDatabase();
  }

  /**
   * Process natural language query from agency
   */
  async processQuery(query: AgencyQuery): Promise<{
    response: string;
    data?: any;
    actions?: string[];
    followUp?: string[];
  }> {
    const startTime = Date.now();

    try {
      // Parse the natural language query
      const nlResult = await this.parseNaturalLanguageQuery(query.query);
      
      let response: string;
      let data: any = null;
      let actions: string[] = [];
      let followUp: string[] = [];

      switch (nlResult.intent) {
        case 'analytics':
          ({ response, data, actions, followUp } = await this.handleAnalyticsQuery(query, nlResult));
          break;
        case 'faq':
          ({ response, actions, followUp } = await this.handleFAQQuery(query, nlResult));
          break;
        case 'data_export':
          ({ response, data, actions } = await this.handleDataExportQuery(query, nlResult));
          break;
        case 'report_generation':
          ({ response, data, actions } = await this.handleReportGenerationQuery(query, nlResult));
          break;
        case 'creator_management':
          ({ response, data, actions, followUp } = await this.handleCreatorManagementQuery(query, nlResult));
          break;
        case 'content_management':
          ({ response, data, actions, followUp } = await this.handleContentManagementQuery(query, nlResult));
          break;
        default:
          response = await this.generateGenericResponse(query.query);
          actions = ['Ask a more specific question', 'Browse our FAQ', 'Contact support'];
      }

      // Store query and response
      const executionTime = Date.now() - startTime;
      await this.storeQueryResponse({
        ...query,
        resolved: true,
        response,
        executionTime
      });

      // Send response via appropriate channel
      await this.sendResponse(query, response, data);

      return { response, data, actions, followUp };
    } catch (error) {
      console.error('Error processing query:', error);
      const errorResponse = 'I encountered an error processing your request. Please try again or contact support.';
      
      await this.storeQueryResponse({
        ...query,
        resolved: false,
        response: errorResponse,
        executionTime: Date.now() - startTime
      });

      return {
        response: errorResponse,
        actions: ['Try rephrasing your question', 'Contact support', 'Check system status']
      };
    }
  }

  /**
   * Handle analytics-related queries
   */
  private async handleAnalyticsQuery(
    query: AgencyQuery,
    nlResult: NLQueryResult
  ): Promise<{ response: string; data: any; actions: string[]; followUp: string[] }> {
    const { entities } = nlResult;
    const timeframe = entities.timeframe || '30d';
    const metric = entities.metric || 'overview';

    // Fetch analytics data
    const analytics = await this.getAgencyAnalytics(query.agencyId, timeframe);
    
    let response: string;
    let data: any = analytics;
    const actions: string[] = [];
    const followUp: string[] = [];

    switch (metric) {
      case 'revenue':
        response = `Your agency generated $${analytics.metrics.totalRevenue.toLocaleString()} in the last ${timeframe}. `;
        response += `This represents a ${this.calculateGrowthRate(analytics.metrics.totalRevenue, timeframe)}% change from the previous period.`;
        actions.push('View detailed revenue breakdown', 'Export revenue report', 'Set revenue alerts');
        followUp.push('Which content categories are performing best?', 'How does this compare to last month?');
        break;

      case 'creators':
        response = `You currently have ${analytics.metrics.totalCreators} active creators. `;
        response += `Your top performer is ${analytics.metrics.topPerformingCreators[0]?.name || 'N/A'} with $${analytics.metrics.topPerformingCreators[0]?.totalRevenue.toLocaleString() || 0} in revenue.`;
        actions.push('View creator leaderboard', 'Analyze creator performance', 'Recruit new creators');
        followUp.push('Which creators need more support?', 'Who are the rising stars?');
        break;

      case 'content':
        response = `Your agency has ${analytics.metrics.totalContent} pieces of content with ${analytics.metrics.totalViews.toLocaleString()} total views. `;
        response += `Average rating is ${analytics.metrics.averageRating.toFixed(1)}/5.0.`;
        actions.push('View content performance', 'Analyze top content', 'Content optimization tips');
        followUp.push('What content types perform best?', 'Which content needs promotion?');
        break;

      case 'conversion':
        response = `Your conversion rate is ${(analytics.metrics.conversionRate * 100).toFixed(2)}%. `;
        response += this.getConversionInsight(analytics.metrics.conversionRate);
        actions.push('Improve conversion rate', 'A/B test pricing', 'Optimize content previews');
        followUp.push('How can we improve conversions?', 'What are industry benchmarks?');
        break;

      default:
        response = this.generateOverviewResponse(analytics);
        actions.push('Deep dive into revenue', 'Analyze creator performance', 'View content metrics');
        followUp.push('What should I focus on this week?', 'Any concerning trends?');
    }

    return { response, data, actions, followUp };
  }

  /**
   * Handle FAQ queries
   */
  private async handleFAQQuery(
    query: AgencyQuery,
    nlResult: NLQueryResult
  ): Promise<{ response: string; actions: string[]; followUp: string[] }> {
    const matchedFAQ = await this.findBestFAQMatch(query.query);
    
    if (matchedFAQ && matchedFAQ.confidence > 0.7) {
      return {
        response: matchedFAQ.answer,
        actions: ['Was this helpful?', 'Ask a follow-up question', 'Browse more FAQs'],
        followUp: ['How do I implement this?', 'Are there any limitations?', 'What are the next steps?']
      };
    } else {
      // Generate AI response for unmatched questions
      const aiResponse = await this.generateAIFAQResponse(query.query);
      return {
        response: aiResponse,
        actions: ['Contact support for more details', 'Submit feedback', 'Browse FAQ categories'],
        followUp: ['Can you provide more specific guidance?', 'Are there video tutorials available?']
      };
    }
  }

  /**
   * Handle data export requests
   */
  private async handleDataExportQuery(
    query: AgencyQuery,
    nlResult: NLQueryResult
  ): Promise<{ response: string; data: any; actions: string[] }> {
    const { entities } = nlResult;
    const dataType = entities.dataType || 'analytics';
    const format = entities.format || 'csv';
    const timeframe = entities.timeframe || '30d';

    // Generate export
    const exportData = await this.generateDataExport(query.agencyId, dataType, format, timeframe);
    
    const response = `I've generated your ${dataType} export in ${format.toUpperCase()} format for the last ${timeframe}. ` +
                    `The file contains ${exportData.recordCount} records and is ready for download.`;

    return {
      response,
      data: exportData,
      actions: ['Download export', 'Schedule regular exports', 'Customize export fields']
    };
  }

  /**
   * Handle report generation requests
   */
  private async handleReportGenerationQuery(
    query: AgencyQuery,
    nlResult: NLQueryResult
  ): Promise<{ response: string; data: any; actions: string[] }> {
    const { entities } = nlResult;
    const reportType = entities.reportType || 'performance';
    const timeframe = entities.timeframe || '30d';

    // Generate report
    const report = await this.generateReport(query.agencyId, reportType, timeframe);
    
    const response = `I've generated your ${reportType} report for the last ${timeframe}. ` +
                    `The report includes key metrics, trends, and actionable insights.`;

    return {
      response,
      data: report,
      actions: ['View full report', 'Share with team', 'Schedule regular reports']
    };
  }

  /**
   * Handle creator management queries
   */
  private async handleCreatorManagementQuery(
    query: AgencyQuery,
    nlResult: NLQueryResult
  ): Promise<{ response: string; data: any; actions: string[]; followUp: string[] }> {
    const { entities } = nlResult;
    const action = entities.action || 'overview';
    const creatorId = entities.creatorId;

    let response: string;
    let data: any;
    const actions: string[] = [];
    const followUp: string[] = [];

    switch (action) {
      case 'performance':
        data = await this.getCreatorPerformance(query.agencyId, creatorId);
        response = creatorId 
          ? `Creator ${data.name} has generated $${data.totalRevenue.toLocaleString()} with ${data.totalContent} pieces of content.`
          : `Your top 5 creators have generated $${data.totalRevenue.toLocaleString()} combined revenue.`;
        actions.push('View detailed analytics', 'Send performance feedback', 'Adjust revenue splits');
        break;

      case 'onboarding':
        response = 'I can help you onboard new creators. The process includes verification, contract setup, and platform training.';
        actions.push('Start creator onboarding', 'View onboarding checklist', 'Schedule training session');
        break;

      default:
        data = await this.getCreatorOverview(query.agencyId);
        response = `You have ${data.totalCreators} active creators. ${data.needsAttention} creators may need attention.`;
        actions.push('View creator dashboard', 'Identify top performers', 'Find creators needing support');
    }

    followUp.push('How can I help creators improve?', 'What are the best practices?');
    return { response, data, actions, followUp };
  }

  /**
   * Handle content management queries
   */
  private async handleContentManagementQuery(
    query: AgencyQuery,
    nlResult: NLQueryResult
  ): Promise<{ response: string; data: any; actions: string[]; followUp: string[] }> {
    const { entities } = nlResult;
    const action = entities.action || 'overview';
    const contentId = entities.contentId;

    let response: string;
    let data: any;
    const actions: string[] = [];
    const followUp: string[] = [];

    switch (action) {
      case 'performance':
        data = await this.getContentPerformance(query.agencyId, contentId);
        response = contentId
          ? `Content "${data.title}" has ${data.views.toLocaleString()} views and generated $${data.revenue.toLocaleString()}.`
          : `Your content library has ${data.totalContent} pieces with ${data.totalViews.toLocaleString()} total views.`;
        actions.push('Optimize underperforming content', 'Promote top content', 'Analyze content trends');
        break;

      case 'moderation':
        data = await this.getContentModerationStatus(query.agencyId);
        response = `${data.pendingReview} pieces of content are pending review. ${data.flagged} items need attention.`;
        actions.push('Review flagged content', 'Update moderation settings', 'View moderation history');
        break;

      default:
        data = await this.getContentOverview(query.agencyId);
        response = `Your content library contains ${data.totalContent} pieces across ${data.categories} categories.`;
        actions.push('View content dashboard', 'Analyze top performers', 'Upload new content');
    }

    followUp.push('How can I improve content performance?', 'What content should I prioritize?');
    return { response, data, actions, followUp };
  }

  /**
   * Parse natural language query to extract intent and entities
   */
  private async parseNaturalLanguageQuery(query: string): Promise<NLQueryResult> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that parses queries for an adult content platform agency dashboard. 
            Extract the intent and entities from user queries. Respond with JSON only.
            
            Possible intents: analytics, faq, data_export, report_generation, creator_management, content_management
            
            Extract entities like: timeframe (7d, 30d, 90d), metric (revenue, creators, content, conversion), 
            dataType (analytics, creators, content, revenue), format (csv, json, pdf), 
            action (performance, onboarding, moderation), creatorId, contentId`
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.1,
        max_tokens: 300,
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      
      return {
        intent: result.intent || 'faq',
        entities: result.entities || {},
        confidence: result.confidence || 0.5,
        suggestedActions: result.suggestedActions || [],
        dataNeeded: result.dataNeeded || []
      };
    } catch (error) {
      console.error('Error parsing NL query:', error);
      return {
        intent: 'faq',
        entities: {},
        confidence: 0.1,
        suggestedActions: [],
        dataNeeded: []
      };
    }
  }

  /**
   * Send response via appropriate channel
   */
  private async sendResponse(query: AgencyQuery, response: string, data?: any): Promise<void> {
    try {
      switch (query.channel) {
        case 'slack':
          await this.sendSlackResponse(query.channelId!, response, data);
          break;
        case 'email':
          await this.sendEmailResponse(query.channelId!, query.query, response, data);
          break;
        case 'web':
          // Web responses are handled by the API directly
          break;
      }
    } catch (error) {
      console.error('Error sending response:', error);
    }
  }

  /**
   * Send response via Slack
   */
  private async sendSlackResponse(channelId: string, response: string, data?: any): Promise<void> {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: response
        }
      }
    ];

    if (data) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '```' + JSON.stringify(data, null, 2) + '```'
        }
      });
    }

    await this.slackClient.chat.postMessage({
      channel: channelId,
      blocks
    });
  }

  /**
   * Send response via email
   */
  private async sendEmailResponse(
    email: string,
    originalQuery: string,
    response: string,
    data?: any
  ): Promise<void> {
    const htmlContent = `
      <h2>Agency Concierge Response</h2>
      <p><strong>Your Question:</strong> ${originalQuery}</p>
      <p><strong>Response:</strong> ${response}</p>
      ${data ? `<pre>${JSON.stringify(data, null, 2)}</pre>` : ''}
      <hr>
      <p><small>This is an automated response from your Agency Concierge AI Assistant.</small></p>
    `;

    await this.emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'concierge@platform.com',
      to: email,
      subject: 'Agency Concierge Response',
      html: htmlContent
    });
  }

  // Private helper methods for data fetching and processing
  private async getAgencyAnalytics(agencyId: string, timeframe: string): Promise<AgencyAnalytics> {
    // Implementation would fetch real analytics data
    return {
      agencyId,
      timeframe,
      metrics: {
        totalRevenue: 125000,
        totalCreators: 45,
        totalContent: 1250,
        totalViews: 2500000,
        averageRating: 4.3,
        conversionRate: 0.087,
        topPerformingContent: [],
        topPerformingCreators: [],
        revenueByCategory: {},
        viewsByDay: {},
        geographicDistribution: {}
      }
    };
  }

  private calculateGrowthRate(currentValue: number, timeframe: string): number {
    // Implementation would calculate actual growth rate
    return Math.random() * 20 - 10; // Placeholder: -10% to +10%
  }

  private getConversionInsight(conversionRate: number): string {
    if (conversionRate > 0.1) return 'This is above industry average!';
    if (conversionRate > 0.05) return 'This is within normal range.';
    return 'This could be improved with optimization.';
  }

  private generateOverviewResponse(analytics: AgencyAnalytics): string {
    return `Here's your agency overview: $${analytics.metrics.totalRevenue.toLocaleString()} revenue, ` +
           `${analytics.metrics.totalCreators} creators, ${analytics.metrics.totalContent} content pieces, ` +
           `${analytics.metrics.totalViews.toLocaleString()} views, ${analytics.metrics.averageRating.toFixed(1)}/5 rating.`;
  }

  private async findBestFAQMatch(query: string): Promise<FAQEntry | null> {
    // Implementation would use vector similarity or keyword matching
    return this.faqDatabase.find(faq => 
      faq.keywords.some(keyword => 
        query.toLowerCase().includes(keyword.toLowerCase())
      )
    ) || null;
  }

  private async generateAIFAQResponse(query: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for an adult content platform agency. Provide accurate, professional responses to agency questions.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      return completion.choices[0].message.content || 'I apologize, but I cannot provide a specific answer to that question. Please contact support for assistance.';
    } catch (error) {
      return 'I encountered an error generating a response. Please try again or contact support.';
    }
  }

  private initializeFAQDatabase(): void {
    this.faqDatabase = [
      {
        id: '1',
        question: 'How do I add a new creator to my agency?',
        answer: 'To add a new creator, go to the Creator Management section, click "Add Creator", and follow the onboarding process including verification and contract setup.',
        category: 'creator_management',
        keywords: ['add creator', 'new creator', 'onboard', 'creator management'],
        confidence: 0.9,
        lastUpdated: new Date()
      },
      {
        id: '2',
        question: 'How can I view my revenue analytics?',
        answer: 'Revenue analytics are available in the Analytics dashboard. You can filter by time period, creator, or content category to get detailed insights.',
        category: 'analytics',
        keywords: ['revenue', 'analytics', 'earnings', 'money', 'income'],
        confidence: 0.9,
        lastUpdated: new Date()
      },
      {
        id: '3',
        question: 'What are the content moderation guidelines?',
        answer: 'All content must comply with platform guidelines including age verification, consent documentation, and content quality standards. Check the Moderation section for detailed guidelines.',
        category: 'content_management',
        keywords: ['moderation', 'guidelines', 'content rules', 'compliance'],
        confidence: 0.9,
        lastUpdated: new Date()
      }
    ];
  }

  // Placeholder methods for data operations
  private async storeQueryResponse(query: AgencyQuery): Promise<void> {
    // Implementation would store in database
  }

  private async generateDataExport(agencyId: string, dataType: string, format: string, timeframe: string): Promise<any> {
    return { recordCount: 1000, downloadUrl: 'https://example.com/export.csv' };
  }

  private async generateReport(agencyId: string, reportType: string, timeframe: string): Promise<any> {
    return { reportUrl: 'https://example.com/report.pdf', insights: [] };
  }

  private async getCreatorPerformance(agencyId: string, creatorId?: string): Promise<any> {
    return { name: 'Sample Creator', totalRevenue: 25000, totalContent: 50 };
  }

  private async getCreatorOverview(agencyId: string): Promise<any> {
    return { totalCreators: 45, needsAttention: 3 };
  }

  private async getContentPerformance(agencyId: string, contentId?: string): Promise<any> {
    return { title: 'Sample Content', views: 50000, revenue: 2500 };
  }

  private async getContentModerationStatus(agencyId: string): Promise<any> {
    return { pendingReview: 5, flagged: 2 };
  }

  private async getContentOverview(agencyId: string): Promise<any> {
    return { totalContent: 1250, categories: 8 };
  }
}