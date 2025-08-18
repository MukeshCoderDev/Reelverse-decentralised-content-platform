/**
 * Dynamic Feature Flag System with 30-second propagation
 * Supports kill switches, geo/age policies, and rate limits
 */

import { EventEmitter } from 'events';
import { eventBus } from './eventBus';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  conditions?: FlagCondition[];
  rolloutPercentage?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface FlagCondition {
  type: 'user_id' | 'organization_id' | 'geo' | 'age_verified' | 'subscription_tier';
  operator: 'equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: any;
}

export interface RateLimit {
  key: string;
  limit: number;
  windowMs: number;
  scope: 'user' | 'organization' | 'global';
  enabled: boolean;
}

export interface FlagEvaluationContext {
  userId?: string;
  organizationId?: string;
  geoLocation?: string;
  ageVerified?: boolean;
  subscriptionTier?: string;
  ipAddress?: string;
}

export class FeatureFlagManager extends EventEmitter {
  private flags: Map<string, FeatureFlag> = new Map();
  private rateLimits: Map<string, RateLimit> = new Map();
  private lastUpdate: Date = new Date();
  private propagationInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeDefaultFlags();
    this.initializeDefaultRateLimits();
    this.startPropagationTimer();
  }

  /**
   * Initialize default feature flags
   */
  private initializeDefaultFlags(): void {
    const defaultFlags: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>[] = [
      {
        key: 'permanent_storage',
        enabled: false,
        description: 'Enable permanent storage for content',
        createdBy: 'system'
      },
      {
        key: 'kill_switch_active',
        enabled: false,
        description: 'Emergency kill switch for all operations',
        createdBy: 'system'
      },
      {
        key: 'geo_restrictions_enabled',
        enabled: true,
        description: 'Enable geographic content restrictions',
        createdBy: 'system'
      },
      {
        key: 'age_verification_required',
        enabled: true,
        description: 'Require age verification for adult content',
        createdBy: 'system'
      },
      {
        key: 'drm_license_delivery',
        enabled: true,
        description: 'Enable DRM license delivery service',
        createdBy: 'system'
      },
      {
        key: 'forensic_watermarking',
        enabled: false,
        description: 'Enable forensic watermarking (defer for test mode)',
        createdBy: 'system'
      },
      {
        key: 'leak_detection_crawlers',
        enabled: false,
        description: 'Enable automated leak detection crawlers (defer for test mode)',
        createdBy: 'system'
      }
    ];

    for (const flag of defaultFlags) {
      this.flags.set(flag.key, {
        ...flag,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  /**
   * Initialize default rate limits
   */
  private initializeDefaultRateLimits(): void {
    const defaultRateLimits: RateLimit[] = [
      {
        key: 'license_requests',
        limit: 100,
        windowMs: 60000, // 1 minute
        scope: 'user',
        enabled: true
      },
      {
        key: 'upload_requests',
        limit: 10,
        windowMs: 60000, // 1 minute
        scope: 'organization',
        enabled: true
      },
      {
        key: 'takedown_requests',
        limit: 5,
        windowMs: 86400000, // 1 day
        scope: 'user',
        enabled: true
      },
      {
        key: 'edge_authorization',
        limit: 1000,
        windowMs: 60000, // 1 minute
        scope: 'user',
        enabled: true
      }
    ];

    for (const rateLimit of defaultRateLimits) {
      this.rateLimits.set(rateLimit.key, rateLimit);
    }
  }

  /**
   * Start propagation timer for 30-second updates
   */
  private startPropagationTimer(): void {
    this.propagationInterval = setInterval(() => {
      this.emit('flags_updated', {
        timestamp: new Date(),
        flags: Array.from(this.flags.values()),
        rateLimits: Array.from(this.rateLimits.values())
      });
    }, 30000); // 30 seconds
  }

  /**
   * Evaluate feature flag for given context
   */
  isEnabled(flagKey: string, context: FlagEvaluationContext = {}): boolean {
    const flag = this.flags.get(flagKey);
    
    if (!flag) {
      console.warn(`Feature flag '${flagKey}' not found, defaulting to false`);
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // Check kill switch
    if (this.isEnabled('kill_switch_active') && flagKey !== 'kill_switch_active') {
      return false;
    }

    // Evaluate conditions
    if (flag.conditions && flag.conditions.length > 0) {
      for (const condition of flag.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          return false;
        }
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const hash = this.hashContext(flagKey, context);
      const percentage = hash % 100;
      return percentage < flag.rolloutPercentage;
    }

    return true;
  }

  /**
   * Update feature flag
   */
  async updateFlag(flagKey: string, updates: Partial<FeatureFlag>, updatedBy: string): Promise<void> {
    const existingFlag = this.flags.get(flagKey);
    
    if (!existingFlag) {
      throw new Error(`Feature flag '${flagKey}' not found`);
    }

    const updatedFlag: FeatureFlag = {
      ...existingFlag,
      ...updates,
      key: flagKey, // Ensure key cannot be changed
      updatedAt: new Date()
    };

    this.flags.set(flagKey, updatedFlag);
    this.lastUpdate = new Date();

    // Emit update event
    await eventBus.publish({
      type: 'feature_flag.updated',
      version: '1.0',
      correlationId: `flag-update-${Date.now()}`,
      payload: {
        flagKey,
        previousValue: existingFlag.enabled,
        newValue: updatedFlag.enabled,
        updatedBy
      },
      metadata: {
        source: 'feature-flag-manager',
        userId: updatedBy
      }
    });

    console.log(`[FLAGS] Updated flag '${flagKey}': ${existingFlag.enabled} -> ${updatedFlag.enabled}`);
  }

  /**
   * Update rate limit
   */
  async updateRateLimit(key: string, updates: Partial<RateLimit>): Promise<void> {
    const existingLimit = this.rateLimits.get(key);
    
    if (!existingLimit) {
      throw new Error(`Rate limit '${key}' not found`);
    }

    const updatedLimit: RateLimit = {
      ...existingLimit,
      ...updates,
      key // Ensure key cannot be changed
    };

    this.rateLimits.set(key, updatedLimit);

    // Emit update event
    await eventBus.publish({
      type: 'rate_limit.updated',
      version: '1.0',
      correlationId: `rate-limit-update-${Date.now()}`,
      payload: {
        key,
        previousLimit: existingLimit.limit,
        newLimit: updatedLimit.limit,
        scope: updatedLimit.scope
      },
      metadata: {
        source: 'feature-flag-manager'
      }
    });

    console.log(`[FLAGS] Updated rate limit '${key}': ${existingLimit.limit} -> ${updatedLimit.limit}`);
  }

  /**
   * Get rate limit configuration
   */
  getRateLimit(key: string): RateLimit | undefined {
    return this.rateLimits.get(key);
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get all rate limits
   */
  getAllRateLimits(): RateLimit[] {
    return Array.from(this.rateLimits.values());
  }

  /**
   * Emergency kill switch activation
   */
  async activateKillSwitch(reason: string, activatedBy: string): Promise<void> {
    await this.updateFlag('kill_switch_active', { enabled: true }, activatedBy);
    
    await eventBus.publish({
      type: 'emergency.kill_switch_activated',
      version: '1.0',
      correlationId: `kill-switch-${Date.now()}`,
      payload: {
        reason,
        activatedBy,
        timestamp: new Date()
      },
      metadata: {
        source: 'feature-flag-manager',
        userId: activatedBy
      }
    });

    console.error(`[EMERGENCY] Kill switch activated by ${activatedBy}: ${reason}`);
  }

  /**
   * Evaluate condition against context
   */
  private evaluateCondition(condition: FlagCondition, context: FlagEvaluationContext): boolean {
    const contextValue = this.getContextValue(condition.type, context);
    
    if (contextValue === undefined) {
      return false;
    }

    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(contextValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(contextValue);
      case 'greater_than':
        return contextValue > condition.value;
      case 'less_than':
        return contextValue < condition.value;
      default:
        return false;
    }
  }

  /**
   * Get context value by type
   */
  private getContextValue(type: string, context: FlagEvaluationContext): any {
    switch (type) {
      case 'user_id':
        return context.userId;
      case 'organization_id':
        return context.organizationId;
      case 'geo':
        return context.geoLocation;
      case 'age_verified':
        return context.ageVerified;
      case 'subscription_tier':
        return context.subscriptionTier;
      default:
        return undefined;
    }
  }

  /**
   * Hash context for consistent rollout percentage
   */
  private hashContext(flagKey: string, context: FlagEvaluationContext): number {
    const str = `${flagKey}:${context.userId || 'anonymous'}:${context.organizationId || 'none'}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.propagationInterval) {
      clearInterval(this.propagationInterval);
      this.propagationInterval = null;
    }
  }
}

// Global feature flag manager
export const featureFlags = new FeatureFlagManager();