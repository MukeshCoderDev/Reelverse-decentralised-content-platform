/**
 * Smart Pricing and AI-Driven Bundles Service
 * Provides pricing suggestions and bundle recommendations based on conversion data
 */

export interface PricingSuggestion {
  contentId: string;
  currentPrice: number;
  suggestedPrice: number;
  confidence: number;
  reasoning: string;
  expectedImpact: {
    conversionRateChange: number;
    revenueChange: number;
    arpu: number;
  };
  priceElasticity: number;
}

export interface BundleRecommendation {
  id: string;
  title: string;
  contentIds: string[];
  suggestedPrice: number;
  discount: number;
  similarity: number;
  expectedConversion: number;
  reasoning: string;
}

export interface ConversionData {
  contentId: string;
  pricePoint: number;
  views: number;
  purchases: number;
  conversionRate: number;
  revenue: number;
  timestamp: Date;
}

export interface PricingAnalytics {
  contentId: string;
  currentMetrics: {
    price: number;
    conversionRate: number;
    dailyRevenue: number;
    arpu: number;
  };
  priceHistory: Array<{
    price: number;
    date: Date;
    conversionRate: number;
    revenue: number;
  }>;
  elasticity: {
    coefficient: number;
    confidence: number;
  };
  recommendations: PricingSuggestion[];
}

export class SmartPricingService {
  private static instance: SmartPricingService;
  private baseUrl: string;
  private conversionData: Map<string, ConversionData[]> = new Map();

  private constructor() {
    this.baseUrl = process.env.API_URL || 'http://localhost:3001';
  }

  public static getInstance(): SmartPricingService {
    if (!SmartPricingService.instance) {
      SmartPricingService.instance = new SmartPricingService();
    }
    return SmartPricingService.instance;
  }

  /**
   * Generate pricing suggestions based on conversion history
   */
  async generatePricingSuggestions(contentId: string): Promise<PricingSuggestion[]> {
    try {
      const conversionHistory = await this.getConversionHistory(contentId);
      const currentPrice = await this.getCurrentPrice(contentId);
      
      if (conversionHistory.length < 5) {
        // Not enough data for meaningful suggestions
        return [{
          contentId,
          currentPrice,
          suggestedPrice: currentPrice,
          confidence: 0.1,
          reasoning: 'Insufficient conversion data for pricing optimization',
          expectedImpact: {
            conversionRateChange: 0,
            revenueChange: 0,
            arpu: currentPrice
          },
          priceElasticity: 0
        }];
      }

      const elasticity = this.calculatePriceElasticity(conversionHistory);
      const suggestions: PricingSuggestion[] = [];

      // Test different price points
      const priceMultipliers = [0.8, 0.9, 1.1, 1.2, 1.5];
      
      for (const multiplier of priceMultipliers) {
        const testPrice = currentPrice * multiplier;
        const expectedConversion = this.predictConversionRate(conversionHistory, testPrice);
        const expectedRevenue = testPrice * expectedConversion;
        const currentRevenue = currentPrice * this.getAverageConversionRate(conversionHistory);
        
        suggestions.push({
          contentId,
          currentPrice,
          suggestedPrice: testPrice,
          confidence: this.calculateConfidence(conversionHistory, elasticity),
          reasoning: this.generateReasoning(multiplier, expectedConversion, elasticity),
          expectedImpact: {
            conversionRateChange: (expectedConversion / this.getAverageConversionRate(conversionHistory) - 1) * 100,
            revenueChange: (expectedRevenue / currentRevenue - 1) * 100,
            arpu: testPrice
          },
          priceElasticity: elasticity
        });
      }

      // Sort by expected revenue impact
      return suggestions.sort((a, b) => b.expectedImpact.revenueChange - a.expectedImpact.revenueChange);
    } catch (error) {
      console.error('Error generating pricing suggestions:', error);
      return [];
    }
  }

  /**
   * Generate bundle recommendations based on content similarity
   */
  async generateBundleRecommendations(contentId: string, limit: number = 5): Promise<BundleRecommendation[]> {
    try {
      const similarContent = await this.findSimilarContent(contentId);
      const contentMetadata = await this.getContentMetadata(contentId);
      const recommendations: BundleRecommendation[] = [];

      // Generate different bundle combinations
      for (let i = 0; i < Math.min(limit, similarContent.length); i++) {
        const bundleContent = [contentId, ...similarContent.slice(0, i + 2)];
        const individualPrices = await Promise.all(
          bundleContent.map(id => this.getCurrentPrice(id))
        );
        
        const totalPrice = individualPrices.reduce((sum, price) => sum + price, 0);
        const bundleDiscount = 0.15 + (i * 0.05); // 15-25% discount based on bundle size
        const bundlePrice = totalPrice * (1 - bundleDiscount);
        
        const similarity = this.calculateBundleSimilarity(bundleContent);
        const expectedConversion = this.predictBundleConversion(bundleContent, bundlePrice);

        recommendations.push({
          id: `bundle_${contentId}_${i}`,
          title: this.generateBundleTitle(bundleContent, contentMetadata),
          contentIds: bundleContent,
          suggestedPrice: bundlePrice,
          discount: bundleDiscount * 100,
          similarity,
          expectedConversion,
          reasoning: this.generateBundleReasoning(bundleContent.length, similarity, bundleDiscount)
        });
      }

      return recommendations.sort((a, b) => b.expectedConversion - a.expectedConversion);
    } catch (error) {
      console.error('Error generating bundle recommendations:', error);
      return [];
    }
  }

  /**
   * Apply pricing suggestion to content
   */
  async applyPricingSuggestion(contentId: string, newPrice: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/content/${contentId}/price`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ price: newPrice })
      });

      if (response.ok) {
        // Track price change for analytics
        await this.trackPriceChange(contentId, newPrice);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error applying pricing suggestion:', error);
      return false;
    }
  }

  /**
   * Get pricing analytics for content
   */
  async getPricingAnalytics(contentId: string): Promise<PricingAnalytics | null> {
    try {
      const conversionHistory = await this.getConversionHistory(contentId);
      const currentPrice = await this.getCurrentPrice(contentId);
      
      if (conversionHistory.length === 0) {
        return null;
      }

      const currentMetrics = this.calculateCurrentMetrics(conversionHistory, currentPrice);
      const priceHistory = this.buildPriceHistory(conversionHistory);
      const elasticity = this.calculatePriceElasticity(conversionHistory);
      const recommendations = await this.generatePricingSuggestions(contentId);

      return {
        contentId,
        currentMetrics,
        priceHistory,
        elasticity: {
          coefficient: elasticity,
          confidence: this.calculateConfidence(conversionHistory, elasticity)
        },
        recommendations: recommendations.slice(0, 3) // Top 3 recommendations
      };
    } catch (error) {
      console.error('Error getting pricing analytics:', error);
      return null;
    }
  }

  /**
   * Track conversion data for pricing optimization
   */
  async trackConversion(contentId: string, price: number, purchased: boolean): Promise<void> {
    try {
      const today = new Date().toDateString();
      const existing = this.conversionData.get(contentId) || [];
      
      let todayData = existing.find(d => d.timestamp.toDateString() === today);
      if (!todayData) {
        todayData = {
          contentId,
          pricePoint: price,
          views: 0,
          purchases: 0,
          conversionRate: 0,
          revenue: 0,
          timestamp: new Date()
        };
        existing.push(todayData);
      }

      todayData.views++;
      if (purchased) {
        todayData.purchases++;
        todayData.revenue += price;
      }
      todayData.conversionRate = todayData.purchases / todayData.views;

      this.conversionData.set(contentId, existing);
    } catch (error) {
      console.error('Error tracking conversion:', error);
    }
  }

  /**
   * Private helper methods
   */
  private async getConversionHistory(contentId: string): Promise<ConversionData[]> {
    // In production, this would query the database
    return this.conversionData.get(contentId) || [];
  }

  private async getCurrentPrice(contentId: string): Promise<number> {
    // In production, this would query the content database
    return 9.99; // Default price
  }

  private async findSimilarContent(contentId: string): Promise<string[]> {
    // In production, this would use vector similarity search
    return ['content_2', 'content_3', 'content_4', 'content_5'];
  }

  private async getContentMetadata(contentId: string): Promise<any> {
    // In production, this would query content metadata
    return { title: 'Sample Content', category: 'premium', tags: ['popular'] };
  }

  private calculatePriceElasticity(history: ConversionData[]): number {
    if (history.length < 3) return -1; // Default elasticity

    // Simple linear regression to calculate price elasticity
    const prices = history.map(h => Math.log(h.pricePoint));
    const conversions = history.map(h => Math.log(Math.max(h.conversionRate, 0.001)));
    
    const n = prices.length;
    const sumX = prices.reduce((a, b) => a + b, 0);
    const sumY = conversions.reduce((a, b) => a + b, 0);
    const sumXY = prices.reduce((sum, x, i) => sum + x * conversions[i], 0);
    const sumXX = prices.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return Math.max(-5, Math.min(-0.1, slope)); // Clamp elasticity
  }

  private predictConversionRate(history: ConversionData[], price: number): number {
    const avgConversion = this.getAverageConversionRate(history);
    const elasticity = this.calculatePriceElasticity(history);
    const avgPrice = history.reduce((sum, h) => sum + h.pricePoint, 0) / history.length;
    
    const priceChange = (price - avgPrice) / avgPrice;
    const conversionChange = elasticity * priceChange;
    
    return Math.max(0.001, avgConversion * (1 + conversionChange));
  }

  private getAverageConversionRate(history: ConversionData[]): number {
    if (history.length === 0) return 0.05; // Default 5%
    return history.reduce((sum, h) => sum + h.conversionRate, 0) / history.length;
  }

  private calculateConfidence(history: ConversionData[], elasticity: number): number {
    const dataPoints = history.length;
    const elasticityConfidence = Math.abs(elasticity) > 0.1 ? 0.8 : 0.4;
    const dataConfidence = Math.min(1, dataPoints / 20);
    
    return elasticityConfidence * dataConfidence;
  }

  private generateReasoning(multiplier: number, expectedConversion: number, elasticity: number): string {
    if (multiplier < 1) {
      return `Lower price should increase conversion rate by ${((expectedConversion / 0.05 - 1) * 100).toFixed(1)}% based on price elasticity of ${elasticity.toFixed(2)}`;
    } else if (multiplier > 1) {
      return `Higher price may reduce conversion but increase revenue per sale. Elasticity: ${elasticity.toFixed(2)}`;
    }
    return 'Current price appears optimal based on conversion data';
  }

  private calculateBundleSimilarity(contentIds: string[]): number {
    // In production, this would use actual content similarity metrics
    return 0.75 + Math.random() * 0.2; // 75-95% similarity
  }

  private predictBundleConversion(contentIds: string[], price: number): number {
    // Bundle conversion is typically lower but with higher value
    const baseConversion = 0.03; // 3% base bundle conversion
    const sizeBonus = Math.max(0, (contentIds.length - 2) * 0.005);
    return baseConversion + sizeBonus;
  }

  private generateBundleTitle(contentIds: string[], metadata: any): string {
    return `Premium Bundle (${contentIds.length} items)`;
  }

  private generateBundleReasoning(size: number, similarity: number, discount: number): string {
    return `${size}-item bundle with ${(similarity * 100).toFixed(0)}% content similarity. ${(discount * 100).toFixed(0)}% discount should drive bundle adoption.`;
  }

  private calculateCurrentMetrics(history: ConversionData[], currentPrice: number) {
    const recent = history.slice(-7); // Last 7 data points
    const avgConversion = recent.reduce((sum, h) => sum + h.conversionRate, 0) / recent.length;
    const dailyRevenue = recent.reduce((sum, h) => sum + h.revenue, 0) / recent.length;
    
    return {
      price: currentPrice,
      conversionRate: avgConversion,
      dailyRevenue,
      arpu: currentPrice
    };
  }

  private buildPriceHistory(history: ConversionData[]) {
    return history.map(h => ({
      price: h.pricePoint,
      date: h.timestamp,
      conversionRate: h.conversionRate,
      revenue: h.revenue
    }));
  }

  private async trackPriceChange(contentId: string, newPrice: number): Promise<void> {
    // Track price changes for analytics
    console.log(`Price changed for ${contentId}: $${newPrice}`);
  }
}

export const smartPricingService = SmartPricingService.getInstance();