import Redis from 'ioredis';
import { FeatureFlagService, FeatureFlag, EvaluationContext, FlagEvaluation } from './featureFlagService';

export interface RemoteConfig {
  endpoint: string;
  apiKey: string;
  refreshInterval: number; // in milliseconds
  timeout: number; // in milliseconds
}

export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  trafficAllocation: number; // percentage of users to include in test
  startDate: Date;
  endDate?: Date;
  enabled: boolean;
}

export interface ABTestVariant {
  id: string;
  name: string;
  weight: number; // percentage allocation within test
  flagOverrides: Record<string, boolean>;
}

export interface FlagAnalytics {
  flagKey: string;
  evaluations: number;
  uniqueUsers: number;
  enabledRate: number;
  conversionRate?: number;
  lastEvaluated: Date;
  performanceImpact?: number;
}

export interface KillSwitchConfig {
  flagKey: string;
  conditions: KillSwitchCondition[];
  enabled: boolean;
  autoActivate: boolean;
}

export interface KillSwitchCondition {
  metric: 'error_rate' | 'response_time' | 'conversion_rate' | 'custom';
  threshold: number;
  operator: 'gt' | 'lt' | 'eq';
  timeWindow: number; // in minutes
}

export class EnhancedFeatureFlagService extends FeatureFlagService {
  private remoteConfig?: RemoteConfig;
  private abTests: Map<string, ABTestConfig> = new Map();
  private killSwitches: Map<string, KillSwitchConfig> = new Map();
  private analytics: Map<string, FlagAnalytics> = new Map();
  private refreshInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;

  constructor(redis: Redis, remoteConfig?: RemoteConfig) {
    super(redis);
    this.remoteConfig = remoteConfig;
    
    if (remoteConfig) {
      this.startRemoteConfigSync();
    }
    
    this.startMetricsCollection();
    this.initializeKillSwitches();
  }

  /**
   * Enhanced flag evaluation with A/B testing and analytics
   */
  async evaluateFlag(flagKey: string, context: EvaluationContext): Promise<FlagEvaluation> {
    try {
      // Check if user is in an A/B test
      const abTestResult = await this.evaluateABTest(flagKey, context);
      if (abTestResult) {
        await this.recordEvaluation(flagKey, context, abTestResult.enabled);
        return abTestResult;
      }

      // Check kill switches
      const killSwitchActive = await this.checkKillSwitch(flagKey);
      if (killSwitchActive) {
        const evaluation: FlagEvaluation = {
          flagKey,
          enabled: false,
          reason: 'Kill switch activated',
          evaluatedAt: new Date()
        };
        await this.recordEvaluation(flagKey, context, false);
        return evaluation;
      }

      // Standard flag evaluation
      const evaluation = await super.evaluateFlag(flagKey, context);
      await this.recordEvaluation(flagKey, context, evaluation.enabled);
      
      return evaluation;
    } catch (error) {
      console.error(`Enhanced flag evaluation error for ${flagKey}:`, error);
      
      // Fallback to safe default
      const evaluation: FlagEvaluation = {
        flagKey,
        enabled: false,
        reason: 'Evaluation error - safe default',
        evaluatedAt: new Date()
      };
      
      return evaluation;
    }
  }

  /**
   * Create A/B test configuration
   */
  async createABTest(config: ABTestConfig): Promise<void> {
    // Validate configuration
    this.validateABTestConfig(config);

    // Store in Redis
    await this.redis.hset(
      `ab_test:${config.id}`,
      'data',
      JSON.stringify(config)
    );

    // Add to test list
    await this.redis.sadd('ab_tests', config.id);

    // Cache locally
    this.abTests.set(config.id, config);

    console.log(`A/B test created: ${config.id}`);
  }

  /**
   * Configure kill switch for a flag
   */
  async configureKillSwitch(config: KillSwitchConfig): Promise<void> {
    await this.redis.hset(
      `kill_switch:${config.flagKey}`,
      'data',
      JSON.stringify(config)
    );

    await this.redis.sadd('kill_switches', config.flagKey);
    this.killSwitches.set(config.flagKey, config);

    console.log(`Kill switch configured for flag: ${config.flagKey}`);
  }

  /**
   * Get flag analytics
   */
  async getFlagAnalytics(flagKey: string, timeRange?: { start: Date; end: Date }): Promise<FlagAnalytics | null> {
    try {
      const cached = this.analytics.get(flagKey);
      if (cached && !timeRange) {
        return cached;
      }

      // Calculate analytics from stored data
      const analytics = await this.calculateAnalytics(flagKey, timeRange);
      
      if (!timeRange) {
        this.analytics.set(flagKey, analytics);
      }
      
      return analytics;
    } catch (error) {
      console.error(`Error getting analytics for flag ${flagKey}:`, error);
      return null;
    }
  }

  /**
   * Get all A/B tests
   */
  async getABTests(): Promise<ABTestConfig[]> {
    try {
      const testIds = await this.redis.smembers('ab_tests');
      const tests: ABTestConfig[] = [];

      for (const id of testIds) {
        const testData = await this.redis.hget(`ab_test:${id}`, 'data');
        if (testData) {
          const test = JSON.parse(testData) as ABTestConfig;
          test.startDate = new Date(test.startDate);
          if (test.endDate) {
            test.endDate = new Date(test.endDate);
          }
          tests.push(test);
        }
      }

      return tests;
    } catch (error) {
      console.error('Error getting A/B tests:', error);
      return [];
    }
  }

  /**
   * Emergency kill switch activation
   */
  async emergencyKillSwitch(flagKey: string, reason: string): Promise<void> {
    await this.killSwitch(flagKey);
    
    // Log emergency activation
    console.error(`EMERGENCY KILL SWITCH ACTIVATED for ${flagKey}: ${reason}`);
    
    // Send alert (implement based on your alerting system)
    await this.sendKillSwitchAlert(flagKey, reason, true);
  }

  /**
   * Bulk flag evaluation for performance
   */
  async evaluateFlags(flagKeys: string[], context: EvaluationContext): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // Evaluate in parallel for better performance
    const evaluations = await Promise.allSettled(
      flagKeys.map(key => this.evaluateFlag(key, context))
    );

    evaluations.forEach((result, index) => {
      const flagKey = flagKeys[index];
      if (result.status === 'fulfilled') {
        results[flagKey] = result.value.enabled;
      } else {
        // Safe default on error
        results[flagKey] = false;
        console.error(`Flag evaluation failed for ${flagKey}:`, result.reason);
      }
    });

    return results;
  }

  /**
   * Initialize platform-specific kill switches
   */
  private async initializeKillSwitches(): Promise<void> {
    const platformKillSwitches: KillSwitchConfig[] = [
      {
        flagKey: 'passkey_wallets',
        conditions: [
          {
            metric: 'error_rate',
            threshold: 5, // 5% error rate
            operator: 'gt',
            timeWindow: 5
          }
        ],
        enabled: true,
        autoActivate: true
      },
      {
        flagKey: 'gasless_payments',
        conditions: [
          {
            metric: 'error_rate',
            threshold: 2, // 2% error rate for payments
            operator: 'gt',
            timeWindow: 3
          },
          {
            metric: 'response_time',
            threshold: 10000, // 10 second response time
            operator: 'gt',
            timeWindow: 5
          }
        ],
        enabled: true,
        autoActivate: true
      },
      {
        flagKey: 'ai_auto_tagging',
        conditions: [
          {
            metric: 'error_rate',
            threshold: 10, // 10% error rate for AI services
            operator: 'gt',
            timeWindow: 10
          }
        ],
        enabled: true,
        autoActivate: false // Manual activation for AI services
      }
    ];

    for (const config of platformKillSwitches) {
      try {
        const existing = await this.redis.hget(`kill_switch:${config.flagKey}`, 'data');
        if (!existing) {
          await this.configureKillSwitch(config);
        }
      } catch (error) {
        console.error(`Error initializing kill switch for ${config.flagKey}:`, error);
      }
    }
  }

  /**
   * Evaluate A/B test for flag
   */
  private async evaluateABTest(flagKey: string, context: EvaluationContext): Promise<FlagEvaluation | null> {
    try {
      const tests = await this.getABTests();
      const activeTest = tests.find(test => 
        test.enabled &&
        test.variants.some(variant => variant.flagOverrides[flagKey] !== undefined) &&
        new Date() >= test.startDate &&
        (!test.endDate || new Date() <= test.endDate)
      );

      if (!activeTest) {
        return null;
      }

      // Check if user is in test
      const hash = this.hashContext(`ab_test_${activeTest.id}`, context);
      if (hash >= activeTest.trafficAllocation) {
        return null; // User not in test
      }

      // Determine variant
      const variantHash = this.hashContext(`variant_${activeTest.id}`, context);
      let cumulativeWeight = 0;
      
      for (const variant of activeTest.variants) {
        cumulativeWeight += variant.weight;
        if (variantHash < cumulativeWeight) {
          const enabled = variant.flagOverrides[flagKey] ?? false;
          
          return {
            flagKey,
            enabled,
            reason: `A/B test ${activeTest.id} - variant ${variant.id}`,
            ruleId: `ab_test_${activeTest.id}_${variant.id}`,
            evaluatedAt: new Date()
          };
        }
      }

      return null;
    } catch (error) {
      console.error(`A/B test evaluation error for ${flagKey}:`, error);
      return null;
    }
  }

  /**
   * Check if kill switch should be activated
   */
  private async checkKillSwitch(flagKey: string): Promise<boolean> {
    try {
      const killSwitch = this.killSwitches.get(flagKey);
      if (!killSwitch || !killSwitch.enabled) {
        return false;
      }

      // Check if already activated
      const flag = await this.getFlag(flagKey);
      if (flag?.killSwitchEnabled) {
        return true;
      }

      // Check conditions for auto-activation
      if (killSwitch.autoActivate) {
        for (const condition of killSwitch.conditions) {
          const shouldActivate = await this.evaluateKillSwitchCondition(flagKey, condition);
          if (shouldActivate) {
            await this.emergencyKillSwitch(flagKey, `Auto-activated: ${condition.metric} ${condition.operator} ${condition.threshold}`);
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error(`Kill switch check error for ${flagKey}:`, error);
      return false;
    }
  }

  /**
   * Record flag evaluation for analytics
   */
  private async recordEvaluation(flagKey: string, context: EvaluationContext, enabled: boolean): Promise<void> {
    try {
      const timestamp = Date.now();
      const userId = context.userId || 'anonymous';
      
      // Store evaluation record
      await this.redis.zadd(
        `flag_evaluations:${flagKey}`,
        timestamp,
        JSON.stringify({ userId, enabled, timestamp })
      );

      // Expire old records (keep 30 days)
      const thirtyDaysAgo = timestamp - (30 * 24 * 60 * 60 * 1000);
      await this.redis.zremrangebyscore(`flag_evaluations:${flagKey}`, 0, thirtyDaysAgo);

      // Update real-time counters
      await this.redis.hincrby(`flag_stats:${flagKey}`, 'total_evaluations', 1);
      if (enabled) {
        await this.redis.hincrby(`flag_stats:${flagKey}`, 'enabled_evaluations', 1);
      }
      await this.redis.hset(`flag_stats:${flagKey}`, 'last_evaluated', timestamp);

    } catch (error) {
      console.error(`Error recording evaluation for ${flagKey}:`, error);
    }
  }

  /**
   * Calculate analytics for a flag
   */
  private async calculateAnalytics(flagKey: string, timeRange?: { start: Date; end: Date }): Promise<FlagAnalytics> {
    try {
      const stats = await this.redis.hgetall(`flag_stats:${flagKey}`);
      
      const analytics: FlagAnalytics = {
        flagKey,
        evaluations: parseInt(stats.total_evaluations || '0'),
        uniqueUsers: 0, // Calculate from evaluation records
        enabledRate: 0,
        lastEvaluated: new Date(parseInt(stats.last_evaluated || '0'))
      };

      if (analytics.evaluations > 0) {
        const enabledEvaluations = parseInt(stats.enabled_evaluations || '0');
        analytics.enabledRate = (enabledEvaluations / analytics.evaluations) * 100;
      }

      // Calculate unique users from evaluation records
      const startTime = timeRange?.start.getTime() || 0;
      const endTime = timeRange?.end.getTime() || Date.now();
      
      const evaluations = await this.redis.zrangebyscore(
        `flag_evaluations:${flagKey}`,
        startTime,
        endTime
      );

      const uniqueUsers = new Set();
      evaluations.forEach(evaluation => {
        try {
          const data = JSON.parse(evaluation);
          uniqueUsers.add(data.userId);
        } catch (e) {
          // Skip invalid records
        }
      });

      analytics.uniqueUsers = uniqueUsers.size;

      return analytics;
    } catch (error) {
      console.error(`Error calculating analytics for ${flagKey}:`, error);
      return {
        flagKey,
        evaluations: 0,
        uniqueUsers: 0,
        enabledRate: 0,
        lastEvaluated: new Date()
      };
    }
  }

  /**
   * Validate A/B test configuration
   */
  private validateABTestConfig(config: ABTestConfig): void {
    if (!config.id || !config.name) {
      throw new Error('A/B test must have id and name');
    }

    if (config.variants.length === 0) {
      throw new Error('A/B test must have at least one variant');
    }

    const totalWeight = config.variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error('Variant weights must sum to 100%');
    }

    if (config.trafficAllocation < 0 || config.trafficAllocation > 100) {
      throw new Error('Traffic allocation must be between 0 and 100%');
    }
  }

  /**
   * Evaluate kill switch condition
   */
  private async evaluateKillSwitchCondition(flagKey: string, condition: KillSwitchCondition): Promise<boolean> {
    try {
      // This would integrate with your metrics system
      // For now, return false (implement based on your monitoring setup)
      return false;
    } catch (error) {
      console.error(`Error evaluating kill switch condition for ${flagKey}:`, error);
      return false;
    }
  }

  /**
   * Send kill switch alert
   */
  private async sendKillSwitchAlert(flagKey: string, reason: string, emergency: boolean): Promise<void> {
    try {
      // Implement based on your alerting system (Slack, email, etc.)
      console.warn(`Kill switch alert for ${flagKey}: ${reason} (Emergency: ${emergency})`);
    } catch (error) {
      console.error(`Error sending kill switch alert for ${flagKey}:`, error);
    }
  }

  /**
   * Start remote configuration sync
   */
  private startRemoteConfigSync(): void {
    if (!this.remoteConfig) return;

    this.refreshInterval = setInterval(async () => {
      try {
        await this.syncRemoteConfig();
      } catch (error) {
        console.error('Remote config sync failed:', error);
      }
    }, this.remoteConfig.refreshInterval);
  }

  /**
   * Sync with remote configuration
   */
  private async syncRemoteConfig(): Promise<void> {
    if (!this.remoteConfig) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.remoteConfig.timeout);

      const response = await fetch(this.remoteConfig.endpoint, {
        headers: {
          'Authorization': `Bearer ${this.remoteConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Remote config fetch failed: ${response.status}`);
      }

      const config = await response.json();
      await this.applyRemoteConfig(config);

    } catch (error) {
      console.error('Remote config sync error:', error);
    }
  }

  /**
   * Apply remote configuration
   */
  private async applyRemoteConfig(config: any): Promise<void> {
    try {
      // Apply flag updates
      if (config.flags) {
        for (const flagUpdate of config.flags) {
          await this.updateFlag(flagUpdate.key, flagUpdate);
        }
      }

      // Apply kill switch updates
      if (config.killSwitches) {
        for (const killSwitchUpdate of config.killSwitches) {
          if (killSwitchUpdate.activate) {
            await this.emergencyKillSwitch(killSwitchUpdate.flagKey, killSwitchUpdate.reason);
          }
        }
      }

      console.log('Remote config applied successfully');
    } catch (error) {
      console.error('Error applying remote config:', error);
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Metrics collection failed:', error);
      }
    }, 60000); // Collect every minute
  }

  /**
   * Collect and aggregate metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const flags = await this.getFlags();
      
      for (const flag of flags) {
        const analytics = await this.getFlagAnalytics(flag.key);
        if (analytics) {
          // Store aggregated metrics
          await this.redis.hset(
            `flag_metrics:${flag.key}:${Date.now()}`,
            {
              evaluations: analytics.evaluations,
              uniqueUsers: analytics.uniqueUsers,
              enabledRate: analytics.enabledRate,
            }
          );
        }
      }
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    console.log('Enhanced feature flag service shutdown complete');
  }
}