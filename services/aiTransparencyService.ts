import { EventEmitter } from 'events';

export interface AIFeature {
  id: string;
  name: string;
  description: string;
  category: 'content_generation' | 'content_analysis' | 'recommendation' | 'moderation' | 'pricing' | 'tagging';
  purpose: string;
  dataUsed: string[];
  outputType: string;
  accuracy?: number;
  lastUpdated: Date;
  modelVersion?: string;
  isActive: boolean;
}

export interface AIUsageRecord {
  id: string;
  userId: string;
  featureId: string;
  contentId?: string;
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  confidence?: number;
  processingTime: number;
  timestamp: Date;
  userVisible: boolean;
  metadata: Record<string, any>;
}

export interface UserAIPreferences {
  userId: string;
  globalOptOut: boolean;
  featurePreferences: Map<string, {
    enabled: boolean;
    optOutDate?: Date;
    reason?: string;
  }>;
  transparencyLevel: 'minimal' | 'standard' | 'detailed';
  notificationPreferences: {
    aiUsageAlerts: boolean;
    modelUpdates: boolean;
    accuracyReports: boolean;
  };
  lastUpdated: Date;
}

export interface AITransparencyReport {
  id: string;
  userId?: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalAIUsage: number;
    featuresUsed: string[];
    contentGenerated: number;
    contentAnalyzed: number;
    recommendationsMade: number;
  };
  featureBreakdown: Map<string, {
    usageCount: number;
    averageConfidence: number;
    successRate: number;
    userInteractions: number;
  }>;
  ethicsMetrics: {
    biasDetectionRuns: number;
    fairnessScore: number;
    transparencyScore: number;
    userControlScore: number;
  };
  generatedAt: Date;
}

export interface AIDisclosure {
  id: string;
  type: 'content_generation' | 'content_modification' | 'recommendation' | 'analysis';
  contentId: string;
  featureId: string;
  description: string;
  confidence: number;
  humanReviewRequired: boolean;
  userNotified: boolean;
  createdAt: Date;
  metadata: Record<string, any>;
}

export class AITransparencyService extends EventEmitter {
  private aiFeatures: Map<string, AIFeature> = new Map();
  private usageRecords: Map<string, AIUsageRecord> = new Map();
  private userPreferences: Map<string, UserAIPreferences> = new Map();
  private disclosures: Map<string, AIDisclosure> = new Map();
  private transparencyReports: Map<string, AITransparencyReport> = new Map();

  constructor() {
    super();
    this.initializeAIFeatures();
    this.startPeriodicReporting();
  }

  private initializeAIFeatures(): void {
    const features: AIFeature[] = [
      {
        id: 'auto-tagging',
        name: 'Automatic Content Tagging',
        description: 'AI-powered automatic tagging of uploaded content based on visual and audio analysis',
        category: 'tagging',
        purpose: 'Improve content discoverability and organization',
        dataUsed: ['video frames', 'audio tracks', 'metadata'],
        outputType: 'content tags and categories',
        accuracy: 0.87,
        lastUpdated: new Date(),
        modelVersion: 'v2.1.0',
        isActive: true
      },
      {
        id: 'smart-captions',
        name: 'AI-Generated Captions',
        description: 'Automatic generation of captions and subtitles for video content',
        category: 'content_generation',
        purpose: 'Improve accessibility and content reach',
        dataUsed: ['audio tracks', 'speech patterns'],
        outputType: 'text captions with timestamps',
        accuracy: 0.92,
        lastUpdated: new Date(),
        modelVersion: 'v3.0.1',
        isActive: true
      },
      {
        id: 'content-recommendations',
        name: 'Personalized Content Recommendations',
        description: 'AI-driven content recommendations based on user behavior and preferences',
        category: 'recommendation',
        purpose: 'Enhance user experience and content discovery',
        dataUsed: ['viewing history', 'user interactions', 'content metadata'],
        outputType: 'ranked list of recommended content',
        accuracy: 0.78,
        lastUpdated: new Date(),
        modelVersion: 'v1.5.2',
        isActive: true
      },
      {
        id: 'smart-pricing',
        name: 'AI-Suggested Pricing',
        description: 'Machine learning-based pricing suggestions for content creators',
        category: 'pricing',
        purpose: 'Optimize creator revenue and market competitiveness',
        dataUsed: ['content type', 'creator metrics', 'market data', 'engagement rates'],
        outputType: 'suggested price ranges with confidence intervals',
        accuracy: 0.73,
        lastUpdated: new Date(),
        modelVersion: 'v1.2.0',
        isActive: true
      },
      {
        id: 'content-moderation',
        name: 'AI Content Moderation',
        description: 'Automated detection of policy violations and inappropriate content',
        category: 'moderation',
        purpose: 'Maintain platform safety and compliance',
        dataUsed: ['visual content', 'audio content', 'text descriptions'],
        outputType: 'violation flags and severity scores',
        accuracy: 0.89,
        lastUpdated: new Date(),
        modelVersion: 'v4.1.0',
        isActive: true
      },
      {
        id: 'trend-analysis',
        name: 'Trending Content Analysis',
        description: 'AI analysis of content trends and viral potential prediction',
        category: 'content_analysis',
        purpose: 'Help creators understand market trends and optimize content strategy',
        dataUsed: ['engagement metrics', 'content features', 'temporal patterns'],
        outputType: 'trend scores and viral potential ratings',
        accuracy: 0.65,
        lastUpdated: new Date(),
        modelVersion: 'v1.0.3',
        isActive: true
      }
    ];

    features.forEach(feature => {
      this.aiFeatures.set(feature.id, feature);
    });
  }

  // User Preferences Management
  public async getUserAIPreferences(userId: string): Promise<UserAIPreferences> {
    let preferences = this.userPreferences.get(userId);
    
    if (!preferences) {
      // Create default preferences
      preferences = {
        userId,
        globalOptOut: false,
        featurePreferences: new Map(),
        transparencyLevel: 'standard',
        notificationPreferences: {
          aiUsageAlerts: true,
          modelUpdates: true,
          accuracyReports: false
        },
        lastUpdated: new Date()
      };

      // Initialize feature preferences
      this.aiFeatures.forEach((feature, featureId) => {
        preferences!.featurePreferences.set(featureId, {
          enabled: true
        });
      });

      this.userPreferences.set(userId, preferences);
    }

    return preferences;
  }

  public async updateUserAIPreferences(
    userId: string,
    updates: Partial<UserAIPreferences>
  ): Promise<UserAIPreferences> {
    const currentPreferences = await this.getUserAIPreferences(userId);
    
    const updatedPreferences: UserAIPreferences = {
      ...currentPreferences,
      ...updates,
      lastUpdated: new Date()
    };

    this.userPreferences.set(userId, updatedPreferences);
    
    this.emit('preferencesUpdated', { userId, preferences: updatedPreferences });
    
    return updatedPreferences;
  }

  public async optOutOfAIFeature(
    userId: string,
    featureId: string,
    reason?: string
  ): Promise<boolean> {
    const preferences = await this.getUserAIPreferences(userId);
    
    if (!this.aiFeatures.has(featureId)) {
      throw new Error(`AI feature ${featureId} not found`);
    }

    preferences.featurePreferences.set(featureId, {
      enabled: false,
      optOutDate: new Date(),
      reason
    });

    preferences.lastUpdated = new Date();
    this.userPreferences.set(userId, preferences);

    this.emit('featureOptOut', { userId, featureId, reason });
    
    return true;
  }

  public async optInToAIFeature(userId: string, featureId: string): Promise<boolean> {
    const preferences = await this.getUserAIPreferences(userId);
    
    if (!this.aiFeatures.has(featureId)) {
      throw new Error(`AI feature ${featureId} not found`);
    }

    preferences.featurePreferences.set(featureId, {
      enabled: true
    });

    preferences.lastUpdated = new Date();
    this.userPreferences.set(userId, preferences);

    this.emit('featureOptIn', { userId, featureId });
    
    return true;
  }

  // AI Usage Recording
  public async recordAIUsage(
    userId: string,
    featureId: string,
    inputData: Record<string, any>,
    outputData: Record<string, any>,
    options: {
      contentId?: string;
      confidence?: number;
      processingTime?: number;
      userVisible?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<AIUsageRecord> {
    // Check if user has opted out of this feature
    const preferences = await this.getUserAIPreferences(userId);
    const featurePreference = preferences.featurePreferences.get(featureId);
    
    if (preferences.globalOptOut || !featurePreference?.enabled) {
      throw new Error(`User has opted out of AI feature: ${featureId}`);
    }

    const usageRecord: AIUsageRecord = {
      id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      featureId,
      contentId: options.contentId,
      inputData,
      outputData,
      confidence: options.confidence,
      processingTime: options.processingTime || 0,
      timestamp: new Date(),
      userVisible: options.userVisible !== false,
      metadata: options.metadata || {}
    };

    this.usageRecords.set(usageRecord.id, usageRecord);

    // Create disclosure if user-visible
    if (usageRecord.userVisible) {
      await this.createAIDisclosure(usageRecord);
    }

    this.emit('aiUsageRecorded', usageRecord);
    
    return usageRecord;
  }

  // AI Disclosure Management
  private async createAIDisclosure(usageRecord: AIUsageRecord): Promise<AIDisclosure> {
    const feature = this.aiFeatures.get(usageRecord.featureId);
    if (!feature) {
      throw new Error(`AI feature ${usageRecord.featureId} not found`);
    }

    const disclosure: AIDisclosure = {
      id: `disclosure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: this.mapCategoryToDisclosureType(feature.category),
      contentId: usageRecord.contentId || '',
      featureId: usageRecord.featureId,
      description: this.generateDisclosureDescription(feature, usageRecord),
      confidence: usageRecord.confidence || 0,
      humanReviewRequired: this.shouldRequireHumanReview(feature, usageRecord),
      userNotified: false,
      createdAt: new Date(),
      metadata: {
        usageRecordId: usageRecord.id,
        modelVersion: feature.modelVersion
      }
    };

    this.disclosures.set(disclosure.id, disclosure);
    
    // Notify user if preferences allow
    await this.notifyUserOfAIUsage(usageRecord.userId, disclosure);

    return disclosure;
  }

  private mapCategoryToDisclosureType(category: AIFeature['category']): AIDisclosure['type'] {
    switch (category) {
      case 'content_generation':
        return 'content_generation';
      case 'tagging':
      case 'content_analysis':
        return 'analysis';
      case 'recommendation':
        return 'recommendation';
      case 'moderation':
      case 'pricing':
        return 'analysis';
      default:
        return 'analysis';
    }
  }

  private generateDisclosureDescription(feature: AIFeature, usageRecord: AIUsageRecord): string {
    switch (feature.category) {
      case 'content_generation':
        return `AI generated ${feature.outputType} for your content using ${feature.name}`;
      case 'tagging':
        return `AI automatically tagged your content using ${feature.name}`;
      case 'recommendation':
        return `AI recommended this content using ${feature.name}`;
      case 'pricing':
        return `AI suggested pricing using ${feature.name}`;
      case 'moderation':
        return `AI analyzed content for policy compliance using ${feature.name}`;
      case 'content_analysis':
        return `AI analyzed content trends using ${feature.name}`;
      default:
        return `AI processed your content using ${feature.name}`;
    }
  }

  private shouldRequireHumanReview(feature: AIFeature, usageRecord: AIUsageRecord): boolean {
    // Require human review for low confidence results or sensitive categories
    if (usageRecord.confidence && usageRecord.confidence < 0.7) {
      return true;
    }
    
    if (feature.category === 'moderation' && usageRecord.confidence && usageRecord.confidence > 0.8) {
      return true; // High confidence moderation flags need human review
    }

    return false;
  }

  private async notifyUserOfAIUsage(userId: string, disclosure: AIDisclosure): Promise<void> {
    const preferences = await this.getUserAIPreferences(userId);
    
    if (preferences.notificationPreferences.aiUsageAlerts) {
      // In a real implementation, this would send actual notifications
      console.log(`AI Usage Notification for user ${userId}: ${disclosure.description}`);
      
      disclosure.userNotified = true;
      this.disclosures.set(disclosure.id, disclosure);
    }
  }

  // Transparency Reporting
  public async generateTransparencyReport(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AITransparencyReport> {
    const reportPeriod = {
      startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate: endDate || new Date()
    };

    // Filter usage records
    const relevantRecords = Array.from(this.usageRecords.values()).filter(record => {
      const matchesUser = !userId || record.userId === userId;
      const inPeriod = record.timestamp >= reportPeriod.startDate && 
                     record.timestamp <= reportPeriod.endDate;
      return matchesUser && inPeriod;
    });

    // Calculate summary metrics
    const featuresUsed = [...new Set(relevantRecords.map(r => r.featureId))];
    const contentGenerated = relevantRecords.filter(r => {
      const feature = this.aiFeatures.get(r.featureId);
      return feature?.category === 'content_generation';
    }).length;

    const contentAnalyzed = relevantRecords.filter(r => {
      const feature = this.aiFeatures.get(r.featureId);
      return feature?.category === 'content_analysis' || feature?.category === 'tagging';
    }).length;

    const recommendationsMade = relevantRecords.filter(r => {
      const feature = this.aiFeatures.get(r.featureId);
      return feature?.category === 'recommendation';
    }).length;

    // Calculate feature breakdown
    const featureBreakdown = new Map<string, any>();
    featuresUsed.forEach(featureId => {
      const featureRecords = relevantRecords.filter(r => r.featureId === featureId);
      const confidenceValues = featureRecords
        .map(r => r.confidence)
        .filter(c => c !== undefined) as number[];
      
      featureBreakdown.set(featureId, {
        usageCount: featureRecords.length,
        averageConfidence: confidenceValues.length > 0 
          ? confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length 
          : 0,
        successRate: 0.85, // Placeholder - would be calculated from actual success metrics
        userInteractions: featureRecords.filter(r => r.userVisible).length
      });
    });

    // Calculate ethics metrics
    const ethicsMetrics = {
      biasDetectionRuns: Math.floor(relevantRecords.length * 0.1), // 10% of records run bias detection
      fairnessScore: 0.82, // Placeholder - would be calculated from fairness audits
      transparencyScore: this.calculateTransparencyScore(userId),
      userControlScore: this.calculateUserControlScore(userId)
    };

    const report: AITransparencyReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      period: reportPeriod,
      summary: {
        totalAIUsage: relevantRecords.length,
        featuresUsed,
        contentGenerated,
        contentAnalyzed,
        recommendationsMade
      },
      featureBreakdown,
      ethicsMetrics,
      generatedAt: new Date()
    };

    this.transparencyReports.set(report.id, report);
    
    return report;
  }

  private calculateTransparencyScore(userId?: string): number {
    if (!userId) return 0.75; // Platform average
    
    const preferences = this.userPreferences.get(userId);
    if (!preferences) return 0.5;

    let score = 0;
    
    // Base score for having preferences set
    score += 0.3;
    
    // Score for transparency level
    switch (preferences.transparencyLevel) {
      case 'detailed': score += 0.4; break;
      case 'standard': score += 0.3; break;
      case 'minimal': score += 0.1; break;
    }
    
    // Score for notification preferences
    if (preferences.notificationPreferences.aiUsageAlerts) score += 0.2;
    if (preferences.notificationPreferences.modelUpdates) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  private calculateUserControlScore(userId?: string): number {
    if (!userId) return 0.70; // Platform average
    
    const preferences = this.userPreferences.get(userId);
    if (!preferences) return 0.3;

    let score = 0;
    
    // Base score for having control
    score += 0.4;
    
    // Score for feature-level control
    const totalFeatures = this.aiFeatures.size;
    const customizedFeatures = Array.from(preferences.featurePreferences.values())
      .filter(pref => pref.optOutDate || !pref.enabled).length;
    
    score += (customizedFeatures / totalFeatures) * 0.4;
    
    // Score for global opt-out availability
    score += 0.2;
    
    return Math.min(score, 1.0);
  }

  // Public API Methods
  public getAIFeatures(): AIFeature[] {
    return Array.from(this.aiFeatures.values()).filter(f => f.isActive);
  }

  public getAIFeature(featureId: string): AIFeature | undefined {
    return this.aiFeatures.get(featureId);
  }

  public async getUserAIUsage(userId: string, limit: number = 100): Promise<AIUsageRecord[]> {
    return Array.from(this.usageRecords.values())
      .filter(record => record.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  public async getUserAIDisclosures(userId: string, limit: number = 50): Promise<AIDisclosure[]> {
    const userUsageRecords = await this.getUserAIUsage(userId);
    const userUsageIds = new Set(userUsageRecords.map(r => r.id));
    
    return Array.from(this.disclosures.values())
      .filter(disclosure => 
        disclosure.metadata.usageRecordId && 
        userUsageIds.has(disclosure.metadata.usageRecordId)
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  public async isAIFeatureEnabled(userId: string, featureId: string): Promise<boolean> {
    const preferences = await this.getUserAIPreferences(userId);
    
    if (preferences.globalOptOut) {
      return false;
    }

    const featurePreference = preferences.featurePreferences.get(featureId);
    return featurePreference?.enabled !== false;
  }

  // Periodic reporting
  private startPeriodicReporting(): void {
    // Generate weekly transparency reports
    setInterval(async () => {
      try {
        const report = await this.generateTransparencyReport();
        this.emit('weeklyTransparencyReport', report);
      } catch (error) {
        console.error('Failed to generate weekly transparency report:', error);
      }
    }, 7 * 24 * 60 * 60 * 1000); // Weekly
  }

  // Analytics and Insights
  public getAIUsageAnalytics(): {
    totalUsage: number;
    activeFeatures: number;
    averageConfidence: number;
    userOptOutRate: number;
  } {
    const totalUsage = this.usageRecords.size;
    const activeFeatures = Array.from(this.aiFeatures.values()).filter(f => f.isActive).length;
    
    const confidenceValues = Array.from(this.usageRecords.values())
      .map(r => r.confidence)
      .filter(c => c !== undefined) as number[];
    
    const averageConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length
      : 0;

    const totalUsers = this.userPreferences.size;
    const optedOutUsers = Array.from(this.userPreferences.values())
      .filter(p => p.globalOptOut).length;
    
    const userOptOutRate = totalUsers > 0 ? optedOutUsers / totalUsers : 0;

    return {
      totalUsage,
      activeFeatures,
      averageConfidence,
      userOptOutRate
    };
  }
}

export const aiTransparencyService = new AITransparencyService();