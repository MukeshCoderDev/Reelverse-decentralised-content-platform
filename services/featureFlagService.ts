import Redis from 'ioredis';

export interface FeatureFlag {
  key: string
  name: string
  description: string
  enabled: boolean
  rules: FlagRule[]
  killSwitchEnabled: boolean
  organizationScoped: boolean
  geoScoped: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

export interface FlagRule {
  id: string
  condition: FlagCondition
  percentage: number
  enabled: boolean
}

export interface FlagCondition {
  type: 'user' | 'organization' | 'geo' | 'random'
  operator: 'equals' | 'in' | 'contains' | 'startsWith'
  values: string[]
}

export interface EvaluationContext {
  userId?: string
  organizationId?: string
  country?: string
  userAgent?: string
  ipAddress?: string
  customAttributes?: Record<string, any>
}

export interface FlagEvaluation {
  flagKey: string
  enabled: boolean
  reason: string
  ruleId?: string
  evaluatedAt: Date
}

export class FeatureFlagService {
  private redis: Redis;
  private cache: Map<string, FeatureFlag> = new Map();
  private cacheExpiry: number = 60000; // 1 minute

  constructor(redis: Redis) {
    this.redis = redis;
    this.startCacheRefresh();
  }

  /**
   * Evaluate a feature flag for given context
   */
  async evaluateFlag(flagKey: string, context: EvaluationContext): Promise<FlagEvaluation> {
    try {
      const flag = await this.getFlag(flagKey);
      
      if (!flag) {
        return {
          flagKey,
          enabled: false,
          reason: 'Flag not found',
          evaluatedAt: new Date()
        };
      }

      // Check kill switch first
      if (flag.killSwitchEnabled) {
        return {
          flagKey,
          enabled: false,
          reason: 'Kill switch activated',
          evaluatedAt: new Date()
        };
      }

      // If flag is globally disabled
      if (!flag.enabled) {
        return {
          flagKey,
          enabled: false,
          reason: 'Flag globally disabled',
          evaluatedAt: new Date()
        };
      }

      // Evaluate rules
      for (const rule of flag.rules) {
        if (!rule.enabled) continue;

        const ruleMatches = this.evaluateRule(rule, context);
        if (ruleMatches) {
          // Check percentage rollout
          const hash = this.hashContext(flagKey, context);
          const enabled = hash < rule.percentage;

          return {
            flagKey,
            enabled,
            reason: enabled ? `Rule ${rule.id} matched` : `Rule ${rule.id} matched but percentage rollout failed`,
            ruleId: rule.id,
            evaluatedAt: new Date()
          };
        }
      }

      // No rules matched, return default (disabled)
      return {
        flagKey,
        enabled: false,
        reason: 'No rules matched',
        evaluatedAt: new Date()
      };

    } catch (error) {
      console.error(`Error evaluating flag ${flagKey}:`, error);
      return {
        flagKey,
        enabled: false,
        reason: 'Evaluation error',
        evaluatedAt: new Date()
      };
    }
  }

  /**
   * Create a new feature flag
   */
  async createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): Promise<void> {
    const fullFlag: FeatureFlag = {
      ...flag,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.redis.hset(
      `feature_flag:${flag.key}`,
      'data',
      JSON.stringify(fullFlag)
    );

    // Add to flag list
    await this.redis.sadd('feature_flags', flag.key);

    // Clear cache
    this.cache.delete(flag.key);

    console.log(`Feature flag created: ${flag.key}`);
  }

  /**
   * Update an existing feature flag
   */
  async updateFlag(flagKey: string, updates: Partial<FeatureFlag>): Promise<void> {
    const existingFlag = await this.getFlag(flagKey);
    if (!existingFlag) {
      throw new Error(`Feature flag ${flagKey} not found`);
    }

    const updatedFlag: FeatureFlag = {
      ...existingFlag,
      ...updates,
      updatedAt: new Date()
    };

    await this.redis.hset(
      `feature_flag:${flagKey}`,
      'data',
      JSON.stringify(updatedFlag)
    );

    // Clear cache
    this.cache.delete(flagKey);

    console.log(`Feature flag updated: ${flagKey}`);
  }

  /**
   * Activate kill switch for a flag
   */
  async killSwitch(flagKey: string): Promise<void> {
    await this.updateFlag(flagKey, { killSwitchEnabled: true });
    console.warn(`Kill switch activated for flag: ${flagKey}`);
  }

  /**
   * Deactivate kill switch for a flag
   */
  async disableKillSwitch(flagKey: string): Promise<void> {
    await this.updateFlag(flagKey, { killSwitchEnabled: false });
    console.log(`Kill switch deactivated for flag: ${flagKey}`);
  }

  /**
   * Get all feature flags
   */
  async getFlags(organizationId?: string): Promise<FeatureFlag[]> {
    try {
      const flagKeys = await this.redis.smembers('feature_flags');
      const flags: FeatureFlag[] = [];

      for (const key of flagKeys) {
        const flag = await this.getFlag(key);
        if (flag) {
          // Filter by organization if specified
          if (organizationId && flag.organizationScoped) {
            // Check if flag has rules for this organization
            const hasOrgRule = flag.rules.some(rule => 
              rule.condition.type === 'organization' && 
              rule.condition.values.includes(organizationId)
            );
            if (hasOrgRule) {
              flags.push(flag);
            }
          } else if (!flag.organizationScoped) {
            flags.push(flag);
          }
        }
      }

      return flags;
    } catch (error) {
      console.error('Error getting flags:', error);
      return [];
    }
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(flagKey: string): Promise<void> {
    await this.redis.del(`feature_flag:${flagKey}`);
    await this.redis.srem('feature_flags', flagKey);
    this.cache.delete(flagKey);
    console.log(`Feature flag deleted: ${flagKey}`);
  }

  /**
   * Get flag evaluation statistics
   */
  async getFlagStats(flagKey: string, timeRange: { start: Date; end: Date }): Promise<any> {
    try {
      // This would typically query evaluation logs
      // For now, return mock statistics
      return {
        flagKey,
        totalEvaluations: 1250,
        enabledEvaluations: 875,
        enabledPercentage: 70.0,
        uniqueUsers: 450,
        ruleBreakdown: {
          'rule-1': { evaluations: 600, enabled: 420 },
          'rule-2': { evaluations: 400, enabled: 280 },
          'default': { evaluations: 250, enabled: 175 }
        },
        timeRange
      };
    } catch (error) {
      console.error('Error getting flag stats:', error);
      return null;
    }
  }

  /**
   * Get a single feature flag
   */
  private async getFlag(flagKey: string): Promise<FeatureFlag | null> {
    try {
      // Check cache first
      if (this.cache.has(flagKey)) {
        return this.cache.get(flagKey)!;
      }

      // Get from Redis
      const flagData = await this.redis.hget(`feature_flag:${flagKey}`, 'data');
      if (!flagData) {
        return null;
      }

      const flag = JSON.parse(flagData) as FeatureFlag;
      
      // Convert date strings back to Date objects
      flag.createdAt = new Date(flag.createdAt);
      flag.updatedAt = new Date(flag.updatedAt);

      // Cache the flag
      this.cache.set(flagKey, flag);

      return flag;
    } catch (error) {
      console.error(`Error getting flag ${flagKey}:`, error);
      return null;
    }
  }

  /**
   * Evaluate a single rule against context
   */
  private evaluateRule(rule: FlagRule, context: EvaluationContext): boolean {
    const { condition } = rule;

    let contextValue: string | undefined;
    switch (condition.type) {
      case 'user':
        contextValue = context.userId;
        break;
      case 'organization':
        contextValue = context.organizationId;
        break;
      case 'geo':
        contextValue = context.country;
        break;
      case 'random':
        return Math.random() < (rule.percentage / 100);
      default:
        return false;
    }

    if (!contextValue) {
      return false;
    }

    switch (condition.operator) {
      case 'equals':
        return condition.values.includes(contextValue);
      case 'in':
        return condition.values.includes(contextValue);
      case 'contains':
        return condition.values.some(value => contextValue!.includes(value));
      case 'startsWith':
        return condition.values.some(value => contextValue!.startsWith(value));
      default:
        return false;
    }
  }

  /**
   * Hash context for consistent percentage rollouts
   */
  private hashContext(flagKey: string, context: EvaluationContext): number {
    const key = context.userId || context.organizationId || context.ipAddress || 'anonymous';
    const input = `${flagKey}:${key}`;
    
    // Simple hash function for percentage calculation
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash) % 100;
  }

  /**
   * Start cache refresh interval
   */
  private startCacheRefresh(): void {
    setInterval(() => {
      this.cache.clear();
    }, this.cacheExpiry);
  }

  /**
   * Bulk evaluate multiple flags
   */
  async evaluateFlags(flagKeys: string[], context: EvaluationContext): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    const evaluations = await Promise.all(
      flagKeys.map(key => this.evaluateFlag(key, context))
    );

    evaluations.forEach(evaluation => {
      results[evaluation.flagKey] = evaluation.enabled;
    });

    return results;
  }

  /**
   * Create predefined flags for the platform
   */
  async initializePlatformFlags(): Promise<void> {
    const platformFlags: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>[] = [
      {
        key: 'passkey_wallets',
        name: 'Passkey Wallets',
        description: 'Enable passkey wallet creation and authentication',
        enabled: true,
        killSwitchEnabled: false,
        organizationScoped: false,
        geoScoped: false,
        createdBy: 'system',
        rules: [
          {
            id: 'default-rule',
            condition: { type: 'random', operator: 'equals', values: [] },
            percentage: 100,
            enabled: true
          }
        ]
      },
      {
        key: 'gasless_payments',
        name: 'Gasless USDC Payments',
        description: 'Enable gasless USDC payments with Permit2',
        enabled: true,
        killSwitchEnabled: false,
        organizationScoped: false,
        geoScoped: false,
        createdBy: 'system',
        rules: [
          {
            id: 'default-rule',
            condition: { type: 'random', operator: 'equals', values: [] },
            percentage: 100,
            enabled: true
          }
        ]
      },
      {
        key: 'ai_auto_tagging',
        name: 'AI Auto-Tagging',
        description: 'Enable AI-powered automatic content tagging',
        enabled: true,
        killSwitchEnabled: false,
        organizationScoped: false,
        geoScoped: false,
        createdBy: 'system',
        rules: [
          {
            id: 'default-rule',
            condition: { type: 'random', operator: 'equals', values: [] },
            percentage: 100,
            enabled: true
          }
        ]
      },
      {
        key: 'leak_detection',
        name: 'AI Leak Detection',
        description: 'Enable AI-powered leak detection and DMCA automation',
        enabled: true,
        killSwitchEnabled: false,
        organizationScoped: false,
        geoScoped: false,
        createdBy: 'system',
        rules: [
          {
            id: 'default-rule',
            condition: { type: 'random', operator: 'equals', values: [] },
            percentage: 100,
            enabled: true
          }
        ]
      },
      {
        key: 'forensic_watermarking',
        name: 'Forensic Watermarking',
        description: 'Enable forensic watermarking for premium content',
        enabled: false,
        killSwitchEnabled: false,
        organizationScoped: true,
        geoScoped: false,
        createdBy: 'system',
        rules: [
          {
            id: 'premium-orgs',
            condition: { type: 'organization', operator: 'in', values: [] },
            percentage: 100,
            enabled: true
          }
        ]
      }
    ];

    for (const flag of platformFlags) {
      try {
        const existing = await this.getFlag(flag.key);
        if (!existing) {
          await this.createFlag(flag);
        }
      } catch (error) {
        console.error(`Error initializing flag ${flag.key}:`, error);
      }
    }

    console.log('Platform feature flags initialized');
  }
}

// Default feature flags for critical features
export const CRITICAL_FEATURE_FLAGS = {
  PASSKEY_WALLETS: 'passkey_wallets',
  GASLESS_PAYMENTS: 'gasless_payments',
  AI_AUTO_TAGGING: 'ai_auto_tagging',
  LEAK_DETECTION: 'leak_detection',
  FORENSIC_WATERMARKING: 'forensic_watermarking',
  COMPLIANCE_ASSISTANT: 'compliance_assistant',
  EVIDENCE_PACKS: 'evidence_packs'
} as const;