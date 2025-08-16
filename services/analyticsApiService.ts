import { publicApiService } from './publicApiService';

export interface AnalyticsQuery {
  startDate: string;
  endDate: string;
  organizationId?: string;
  metrics?: string[];
  groupBy?: 'day' | 'week' | 'month';
}

export interface AnalyticsMetrics {
  totalViews: number;
  totalRevenue: number;
  uniqueViewers: number;
  averageViewDuration: number;
  topContent: ContentMetric[];
  revenueByDay: RevenueMetric[];
  viewsByRegion: RegionMetric[];
}

export interface ContentMetric {
  contentId: string;
  title: string;
  views: number;
  revenue: number;
  averageRating: number;
}

export interface RevenueMetric {
  date: string;
  revenue: number;
  transactions: number;
}

export interface RegionMetric {
  region: string;
  views: number;
  revenue: number;
}

export class AnalyticsApiService {
  /**
   * Get analytics data for organization
   */
  async getAnalytics(query: AnalyticsQuery, organizationId?: string): Promise<AnalyticsMetrics> {
    // Validate date range
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    if (startDate > endDate) {
      throw new Error('Start date must be before end date');
    }

    // Limit date range to prevent excessive queries
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      throw new Error('Date range cannot exceed 365 days');
    }

    // Filter by organization if specified
    const orgFilter = organizationId || query.organizationId;

    // Mock analytics data - in real implementation, this would query the database
    const analytics: AnalyticsMetrics = {
      totalViews: 125000,
      totalRevenue: 45000.50,
      uniqueViewers: 8500,
      averageViewDuration: 420, // seconds
      topContent: [
        {
          contentId: 'content_1',
          title: 'Sample Content 1',
          views: 15000,
          revenue: 5500.00,
          averageRating: 4.8
        },
        {
          contentId: 'content_2', 
          title: 'Sample Content 2',
          views: 12000,
          revenue: 4200.00,
          averageRating: 4.6
        }
      ],
      revenueByDay: this.generateDailyRevenue(startDate, endDate),
      viewsByRegion: [
        { region: 'US', views: 45000, revenue: 18000 },
        { region: 'EU', views: 35000, revenue: 14000 },
        { region: 'APAC', views: 25000, revenue: 8000 },
        { region: 'Other', views: 20000, revenue: 5500 }
      ]
    };

    return analytics;
  }

  /**
   * Get content performance metrics
   */
  async getContentMetrics(contentIds: string[], organizationId?: string): Promise<ContentMetric[]> {
    // Mock content metrics - in real implementation, query database
    return contentIds.map(id => ({
      contentId: id,
      title: `Content ${id}`,
      views: Math.floor(Math.random() * 10000) + 1000,
      revenue: Math.floor(Math.random() * 5000) + 500,
      averageRating: Math.round((Math.random() * 2 + 3) * 10) / 10
    }));
  }

  /**
   * Get revenue breakdown by time period
   */
  async getRevenueBreakdown(
    startDate: string, 
    endDate: string, 
    groupBy: 'day' | 'week' | 'month' = 'day',
    organizationId?: string
  ): Promise<RevenueMetric[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return this.generateDailyRevenue(start, end);
  }

  /**
   * Get viewer demographics and engagement
   */
  async getViewerInsights(organizationId?: string): Promise<any> {
    return {
      demographics: {
        ageGroups: [
          { range: '18-24', percentage: 25 },
          { range: '25-34', percentage: 35 },
          { range: '35-44', percentage: 25 },
          { range: '45+', percentage: 15 }
        ],
        topCountries: [
          { country: 'US', percentage: 40 },
          { country: 'UK', percentage: 15 },
          { country: 'DE', percentage: 12 },
          { country: 'CA', percentage: 10 },
          { country: 'AU', percentage: 8 }
        ]
      },
      engagement: {
        averageSessionDuration: 1800, // seconds
        bounceRate: 0.25,
        returnVisitorRate: 0.65,
        peakHours: [20, 21, 22, 23] // UTC hours
      }
    };
  }

  /**
   * Generate mock daily revenue data
   */
  private generateDailyRevenue(startDate: Date, endDate: Date): RevenueMetric[] {
    const metrics: RevenueMetric[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      metrics.push({
        date: currentDate.toISOString().split('T')[0],
        revenue: Math.floor(Math.random() * 2000) + 500,
        transactions: Math.floor(Math.random() * 100) + 20
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return metrics;
  }
}

export const analyticsApiService = new AnalyticsApiService();