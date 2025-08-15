// Feature flag system for Reelverse18 platform configuration

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'boolean' | 'string' | 'number' | 'json';
  value?: any;
  conditions?: FeatureFlagCondition[];
  rolloutPercentage?: number;
  geoRestrictions?: string[]; // Country codes
  userSegments?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface FeatureFlagCondition {
  type: 'user_segment' | 'geo_location' | 'wallet_address' | 'organization' | 'random_percentage';
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'percentage';
  value: any;
}

export interface FeatureFlagContext {
  userId?: string;
  walletAddress?: string;
  organizationId?: string;
  country?: string;
  userSegment?: string;
  isVerified?: boolean;
  isTalentVerified?: boolean;
}

// Default feature flags for the platform
export const DEFAULT_FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // Content and Access Control
  AGE_BLUR_ENABLED: {
    key: 'AGE_BLUR_ENABLED',
    name: 'Age Blur',
    description: 'Blur adult content for unverified users',
    enabled: true,
    type: 'boolean',
    value: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  CRYPTO_ONLY_MODE: {
    key: 'CRYPTO_ONLY_MODE',
    name: 'Crypto Only Mode',
    description: 'Only allow crypto payments, disable fiat',
    enabled: false,
    type: 'boolean',
    value: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  REQUIRE_VERIFIED_TALENT_FOR_PUBLISH: {
    key: 'REQUIRE_VERIFIED_TALENT_FOR_PUBLISH',
    name: 'Require Talent Verification',
    description: 'Require talent verification before content publishing',
    enabled: false,
    type: 'boolean',
    value: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Geographic Controls
  JAPAN_MOSAIC_TOGGLE: {
    key: 'JAPAN_MOSAIC_TOGGLE',
    name: 'Japan Mosaic Toggle',
    description: 'Enable mosaic censoring for Japan',
    enabled: true,
    type: 'boolean',
    value: true,
    geoRestrictions: ['JP'],
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  GEO_BLOCKING_ENABLED: {
    key: 'GEO_BLOCKING_ENABLED',
    name: 'Geographic Blocking',
    description: 'Enable geographic content restrictions',
    enabled: true,
    type: 'boolean',
    value: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Agency Features
  AGENCY_FEATURES_ENABLED: {
    key: 'AGENCY_FEATURES_ENABLED',
    name: 'Agency Features',
    description: 'Enable organization and agency management features',
    enabled: true,
    type: 'boolean',
    value: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  BULK_UPLOAD_ENABLED: {
    key: 'BULK_UPLOAD_ENABLED',
    name: 'Bulk Upload',
    description: 'Enable bulk upload functionality',
    enabled: true,
    type: 'boolean',
    value: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  MIGRATION_TOOLS_ENABLED: {
    key: 'MIGRATION_TOOLS_ENABLED',
    name: 'Migration Tools',
    description: 'Enable content migration and import tools',
    enabled: true,
    type: 'boolean',
    value: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Payment and Monetization
  FIAT_PAYMENTS_ENABLED: {
    key: 'FIAT_PAYMENTS_ENABLED',
    name: 'Fiat Payments',
    description: 'Enable fiat payment processing',
    enabled: true,
    type: 'boolean',
    value: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  SUBSCRIPTION_FEATURES_ENABLED: {
    key: 'SUBSCRIPTION_FEATURES_ENABLED',
    name: 'Subscription Features',
    description: 'Enable subscription-based content access',
    enabled: true,
    type: 'boolean',
    value: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Content Processing
  AUTO_PROMO_GENERATION: {
    key: 'AUTO_PROMO_GENERATION',
    name: 'Auto Promo Generation',
    description: 'Automatically generate promotional content',
    enabled: true,
    type: 'boolean',
    value: true,
    rolloutPercentage: 80, // Gradual rollout
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  WATERMARKING_ENABLED: {
    key: 'WATERMARKING_ENABLED',
    name: 'Video Watermarking',
    description: 'Enable dynamic video watermarking',
    enabled: true,
    type: 'boolean',
    value: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Compliance and Moderation
  AUTOMATED_MODERATION: {
    key: 'AUTOMATED_MODERATION',
    name: 'Automated Moderation',
    description: 'Enable AI-powered content moderation',
    enabled: false,
    type: 'boolean',
    value: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  DMCA_PROTECTION_ENABLED: {
    key: 'DMCA_PROTECTION_ENABLED',
    name: 'DMCA Protection',
    description: 'Enable perceptual hash DMCA protection',
    enabled: true,
    type: 'boolean',
    value: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Platform Configuration
  MAINTENANCE_MODE: {
    key: 'MAINTENANCE_MODE',
    name: 'Maintenance Mode',
    description: 'Put platform in maintenance mode',
    enabled: false,
    type: 'boolean',
    value: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  PUBLIC_METRICS_ENABLED: {
    key: 'PUBLIC_METRICS_ENABLED',
    name: 'Public Metrics',
    description: 'Enable public metrics dashboard',
    enabled: true,
    type: 'boolean',
    value: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  // Upload Limits
  MAX_UPLOAD_SIZE_MB: {
    key: 'MAX_UPLOAD_SIZE_MB',
    name: 'Max Upload Size',
    description: 'Maximum file size for uploads in MB',
    enabled: true,
    type: 'number',
    value: 5000, // 5GB
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  
  MAX_BULK_UPLOAD_FILES: {
    key: 'MAX_BULK_UPLOAD_FILES',
    name: 'Max Bulk Upload Files',
    description: 'Maximum number of files in bulk upload',
    enabled: true,
    type: 'number',
    value: 50,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
};

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private remoteConfig: any = null;
  private lastFetch = 0;
  private fetchInterval = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeFlags();
  }

  private initializeFlags() {
    Object.values(DEFAULT_FEATURE_FLAGS).forEach(flag => {
      this.flags.set(flag.key, flag);
    });
  }

  async fetchRemoteConfig() {
    const now = Date.now();
    if (now - this.lastFetch < this.fetchInterval) {
      return;
    }

    try {
      // In production, fetch from remote config service
      // const response = await fetch('/api/feature-flags');
      // this.remoteConfig = await response.json();
      
      // For now, use localStorage for persistence
      const stored = localStorage.getItem('reelverse_feature_flags');
      if (stored) {
        const storedFlags = JSON.parse(stored);
        Object.values(storedFlags).forEach((flag: any) => {
          this.flags.set(flag.key, flag);
        });
      }
      
      this.lastFetch = now;
    } catch (error) {
      console.warn('Failed to fetch remote feature flags:', error);
    }
  }

  isEnabled(flagKey: string, context?: FeatureFlagContext): boolean {
    const flag = this.flags.get(flagKey);
    if (!flag) {
      console.warn(`Feature flag '${flagKey}' not found`);
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // Check conditions if provided
    if (flag.conditions && context) {
      const conditionsMet = this.evaluateConditions(flag.conditions, context);
      if (!conditionsMet) {
        return false;
      }
    }

    // Check geographic restrictions
    if (flag.geoRestrictions && context?.country) {
      if (!flag.geoRestrictions.includes(context.country)) {
        return false;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined) {
      const hash = this.hashString(context?.userId || context?.walletAddress || 'anonymous');
      const percentage = (hash % 100) + 1;
      if (percentage > flag.rolloutPercentage) {
        return false;
      }
    }

    return flag.type === 'boolean' ? flag.value : true;
  }

  getValue<T = any>(flagKey: string, defaultValue: T, context?: FeatureFlagContext): T {
    const flag = this.flags.get(flagKey);
    if (!flag || !this.isEnabled(flagKey, context)) {
      return defaultValue;
    }

    return flag.value !== undefined ? flag.value : defaultValue;
  }

  private evaluateConditions(conditions: FeatureFlagCondition[], context: FeatureFlagContext): boolean {
    return conditions.every(condition => {
      switch (condition.type) {
        case 'user_segment':
          return this.evaluateCondition(context.userSegment, condition);
        case 'geo_location':
          return this.evaluateCondition(context.country, condition);
        case 'wallet_address':
          return this.evaluateCondition(context.walletAddress, condition);
        case 'organization':
          return this.evaluateCondition(context.organizationId, condition);
        case 'random_percentage':
          const hash = this.hashString(context.userId || context.walletAddress || 'anonymous');
          const percentage = (hash % 100) + 1;
          return percentage <= condition.value;
        default:
          return true;
      }
    });
  }

  private evaluateCondition(value: any, condition: FeatureFlagCondition): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value);
      case 'percentage':
        const hash = this.hashString(String(value));
        const percentage = (hash % 100) + 1;
        return percentage <= condition.value;
      default:
        return true;
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Admin methods for flag management
  updateFlag(flagKey: string, updates: Partial<FeatureFlag>) {
    const flag = this.flags.get(flagKey);
    if (flag) {
      const updatedFlag = { ...flag, ...updates, updatedAt: Date.now() };
      this.flags.set(flagKey, updatedFlag);
      this.persistFlags();
    }
  }

  createFlag(flag: FeatureFlag) {
    this.flags.set(flag.key, flag);
    this.persistFlags();
  }

  deleteFlag(flagKey: string) {
    this.flags.delete(flagKey);
    this.persistFlags();
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  private persistFlags() {
    const flagsObject = Object.fromEntries(this.flags);
    localStorage.setItem('reelverse_feature_flags', JSON.stringify(flagsObject));
  }

  // Utility methods for common checks
  isMaintenanceMode(context?: FeatureFlagContext): boolean {
    return this.isEnabled('MAINTENANCE_MODE', context);
  }

  isCryptoOnlyMode(context?: FeatureFlagContext): boolean {
    return this.isEnabled('CRYPTO_ONLY_MODE', context);
  }

  isAgeBlurEnabled(context?: FeatureFlagContext): boolean {
    return this.isEnabled('AGE_BLUR_ENABLED', context);
  }

  isAgencyFeaturesEnabled(context?: FeatureFlagContext): boolean {
    return this.isEnabled('AGENCY_FEATURES_ENABLED', context);
  }

  isBulkUploadEnabled(context?: FeatureFlagContext): boolean {
    return this.isEnabled('BULK_UPLOAD_ENABLED', context);
  }

  getMaxUploadSize(context?: FeatureFlagContext): number {
    return this.getValue('MAX_UPLOAD_SIZE_MB', 1000, context);
  }

  getMaxBulkUploadFiles(context?: FeatureFlagContext): number {
    return this.getValue('MAX_BULK_UPLOAD_FILES', 10, context);
  }
}

// Singleton instance
export const featureFlags = new FeatureFlagService();

// React hook for feature flags
export function useFeatureFlag(flagKey: string, context?: FeatureFlagContext) {
  const [isEnabled, setIsEnabled] = React.useState(() => 
    featureFlags.isEnabled(flagKey, context)
  );

  React.useEffect(() => {
    const checkFlag = async () => {
      await featureFlags.fetchRemoteConfig();
      setIsEnabled(featureFlags.isEnabled(flagKey, context));
    };

    checkFlag();
    
    // Set up periodic refresh
    const interval = setInterval(checkFlag, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [flagKey, context]);

  return isEnabled;
}

export function useFeatureFlagValue<T>(
  flagKey: string, 
  defaultValue: T, 
  context?: FeatureFlagContext
): T {
  const [value, setValue] = React.useState<T>(() => 
    featureFlags.getValue(flagKey, defaultValue, context)
  );

  React.useEffect(() => {
    const checkValue = async () => {
      await featureFlags.fetchRemoteConfig();
      setValue(featureFlags.getValue(flagKey, defaultValue, context));
    };

    checkValue();
    
    const interval = setInterval(checkValue, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [flagKey, defaultValue, context]);

  return value;
}