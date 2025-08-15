/**
 * Feature Flag System for Reelverse18 Platform
 * Supports remote configuration, A/B testing, and geographic targeting
 */

export enum FeatureFlag {
  // Content & Access Flags
  AGE_BLUR_ENABLED = 'age_blur_enabled',
  CRYPTO_ONLY_MODE = 'crypto_only_mode',
  FIAT_PAYMENTS_ENABLED = 'fiat_payments_enabled',
  SUBSCRIPTION_SYSTEM_ENABLED = 'subscription_system_enabled',
  
  // Verification Flags
  REQUIRE_AGE_VERIFICATION = 'require_age_verification',
  REQUIRE_VERIFIED_TALENT_FOR_PUBLISH = 'require_verified_talent_for_publish',
  PERSONA_KYC_ENABLED = 'persona_kyc_enabled',
  
  // Organization Flags
  AGENCY_FEATURES_ENABLED = 'agency_features_enabled',
  BULK_UPLOAD_ENABLED = 'bulk_upload_enabled',
  MIGRATION_TOOLS_ENABLED = 'migration_tools_enabled',
  
  // Content Processing Flags
  AUTO_PROMO_GENERATION = 'auto_promo_generation',
  WATERMARKING_ENABLED = 'watermarking_enabled',
  PERCEPTUAL_HASHING_ENABLED = 'perceptual_hashing_enabled',
  
  // Storage Flags
  ARWEAVE_STORAGE_ENABLED = 'arweave_storage_enabled',
  IPFS_METADATA_ENABLED = 'ipfs_metadata_enabled',
  SHREDDABLE_CONTENT_ENABLED = 'shreddable_content_enabled',
  
  // Compliance Flags
  DMCA_PROTECTION_ENABLED = 'dmca_protection_enabled',
  CONSENT_MANAGEMENT_ENABLED = 'consent_management_enabled',
  AUDIT_LOGGING_ENABLED = 'audit_logging_enabled',
  GEO_BLOCKING_ENABLED = 'geo_blocking_enabled',
  JAPAN_MOSAIC_TOGGLE = 'japan_mosaic_toggle',
  
  // UI/UX Flags
  NEW_UPLOAD_WIZARD = 'new_upload_wizard',
  ENHANCED_PLAYER_UI = 'enhanced_player_ui',
  DARK_MODE_ENABLED = 'dark_mode_enabled',
  
  // Performance Flags
  CDN_OPTIMIZATION = 'cdn_optimization',
  LAZY_LOADING_ENABLED = 'lazy_loading_enabled',
  
  // Experimental Flags
  AI_CONTENT_TAGGING = 'ai_content_tagging',
  BLOCKCHAIN_ANALYTICS = 'blockchain_analytics',
  SOCIAL_FEATURES = 'social_features'
}

export interface FeatureFlagConfig {
  enabled: boolean;
  rolloutPercentage?: number; // 0-100, for gradual rollouts
  userSegments?: string[]; // Target specific user segments
  geoTargeting?: {
    includedCountries?: string[]; // ISO country codes
    excludedCountries?: string[]; // ISO country codes
  };
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  metadata?: Record<string, any>; // Additional configuration
}

export interface FeatureFlagContext {
  userId?: string;
  userSegment?: string;
  country?: string;
  organizationId?: string;
  organizationType?: 'individual' | 'agency' | 'studio';
  isVerified?: boolean;
  isPremium?: boolean;
}

export interface FeatureFlagProvider {
  getFlag(flag: FeatureFlag, context?: FeatureFlagContext): Promise<boolean>;
  getAllFlags(context?: FeatureFlagContext): Promise<Record<FeatureFlag, boolean>>;
  updateFlag?(flag: FeatureFlag, config: FeatureFlagConfig): Promise<void>;
}

// Default flag configurations
export const DEFAULT_FLAG_CONFIG: Record<FeatureFlag, FeatureFlagConfig> = {
  // Content & Access Flags
  [FeatureFlag.AGE_BLUR_ENABLED]: {
    enabled: true,
    metadata: { description: 'Blur adult content for unverified users' }
  },
  [FeatureFlag.CRYPTO_ONLY_MODE]: {
    enabled: false,
    rolloutPercentage: 10,
    metadata: { description: 'Disable fiat payments, crypto only' }
  },
  [FeatureFlag.FIAT_PAYMENTS_ENABLED]: {
    enabled: true,
    geoTargeting: {
      excludedCountries: ['CN', 'KP'] // Example restricted countries
    },
    metadata: { description: 'Enable CCBill/Segpay fiat payments' }
  },
  [FeatureFlag.SUBSCRIPTION_SYSTEM_ENABLED]: {
    enabled: true,
    metadata: { description: 'Enable subscription-based content access' }
  },

  // Verification Flags
  [FeatureFlag.REQUIRE_AGE_VERIFICATION]: {
    enabled: true,
    metadata: { description: 'Require age verification for adult content' }
  },
  [FeatureFlag.REQUIRE_VERIFIED_TALENT_FOR_PUBLISH]: {
    enabled: false,
    rolloutPercentage: 25,
    metadata: { description: 'Require talent verification before publishing' }
  },
  [FeatureFlag.PERSONA_KYC_ENABLED]: {
    enabled: true,
    metadata: { description: 'Use Persona for KYC verification' }
  },

  // Organization Flags
  [FeatureFlag.AGENCY_FEATURES_ENABLED]: {
    enabled: true,
    metadata: { description: 'Enable agency/organization management features' }
  },
  [FeatureFlag.BULK_UPLOAD_ENABLED]: {
    enabled: true,
    userSegments: ['agency', 'studio'],
    metadata: { description: 'Enable bulk upload functionality' }
  },
  [FeatureFlag.MIGRATION_TOOLS_ENABLED]: {
    enabled: true,
    userSegments: ['agency', 'studio'],
    metadata: { description: 'Enable content migration tools' }
  },

  // Content Processing Flags
  [FeatureFlag.AUTO_PROMO_GENERATION]: {
    enabled: true,
    rolloutPercentage: 80,
    metadata: { description: 'Automatically generate promotional content' }
  },
  [FeatureFlag.WATERMARKING_ENABLED]: {
    enabled: true,
    metadata: { description: 'Add dynamic watermarks to video content' }
  },
  [FeatureFlag.PERCEPTUAL_HASHING_ENABLED]: {
    enabled: true,
    metadata: { description: 'Generate perceptual hashes for DMCA protection' }
  },

  // Storage Flags
  [FeatureFlag.ARWEAVE_STORAGE_ENABLED]: {
    enabled: false,
    rolloutPercentage: 20,
    metadata: { description: 'Enable Arweave permanent storage option' }
  },
  [FeatureFlag.IPFS_METADATA_ENABLED]: {
    enabled: true,
    metadata: { description: 'Store metadata on IPFS' }
  },
  [FeatureFlag.SHREDDABLE_CONTENT_ENABLED]: {
    enabled: true,
    metadata: { description: 'Enable shreddable content with key destruction' }
  },

  // Compliance Flags
  [FeatureFlag.DMCA_PROTECTION_ENABLED]: {
    enabled: true,
    metadata: { description: 'Enable DMCA protection and takedown system' }
  },
  [FeatureFlag.CONSENT_MANAGEMENT_ENABLED]: {
    enabled: true,
    metadata: { description: 'Require participant consent for content' }
  },
  [FeatureFlag.AUDIT_LOGGING_ENABLED]: {
    enabled: true,
    metadata: { description: 'Enable comprehensive audit logging' }
  },
  [FeatureFlag.GEO_BLOCKING_ENABLED]: {
    enabled: true,
    metadata: { description: 'Enable geographic content restrictions' }
  },
  [FeatureFlag.JAPAN_MOSAIC_TOGGLE]: {
    enabled: true,
    geoTargeting: {
      includedCountries: ['JP']
    },
    metadata: { description: 'Enable mosaic toggle for Japan compliance' }
  },

  // UI/UX Flags
  [FeatureFlag.NEW_UPLOAD_WIZARD]: {
    enabled: false,
    rolloutPercentage: 30,
    metadata: { description: 'New improved upload wizard interface' }
  },
  [FeatureFlag.ENHANCED_PLAYER_UI]: {
    enabled: true,
    rolloutPercentage: 70,
    metadata: { description: 'Enhanced video player with new controls' }
  },
  [FeatureFlag.DARK_MODE_ENABLED]: {
    enabled: true,
    metadata: { description: 'Enable dark mode theme option' }
  },

  // Performance Flags
  [FeatureFlag.CDN_OPTIMIZATION]: {
    enabled: true,
    metadata: { description: 'Enable CDN optimizations for content delivery' }
  },
  [FeatureFlag.LAZY_LOADING_ENABLED]: {
    enabled: true,
    metadata: { description: 'Enable lazy loading for content cards' }
  },

  // Experimental Flags
  [FeatureFlag.AI_CONTENT_TAGGING]: {
    enabled: false,
    rolloutPercentage: 5,
    userSegments: ['beta_testers'],
    metadata: { description: 'AI-powered automatic content tagging' }
  },
  [FeatureFlag.BLOCKCHAIN_ANALYTICS]: {
    enabled: false,
    rolloutPercentage: 15,
    metadata: { description: 'Advanced blockchain analytics dashboard' }
  },
  [FeatureFlag.SOCIAL_FEATURES]: {
    enabled: false,
    rolloutPercentage: 10,
    metadata: { description: 'Social features like comments and likes' }
  }
};

export class FeatureFlagService {
  private provider: FeatureFlagProvider;
  private cache: Map<string, { value: boolean; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(provider: FeatureFlagProvider) {
    this.provider = provider;
  }

  /**
   * Check if a feature flag is enabled for the given context
   */
  async isEnabled(flag: FeatureFlag, context?: FeatureFlagContext): Promise<boolean> {
    const cacheKey = this.getCacheKey(flag, context);
    const cached = this.cache.get(cacheKey);

    // Return cached value if still valid
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.value;
    }

    try {
      const value = await this.provider.getFlag(flag, context);
      
      // Cache the result
      this.cache.set(cacheKey, {
        value,
        timestamp: Date.now()
      });

      return value;
    } catch (error) {
      console.error(`Failed to get feature flag ${flag}:`, error);
      
      // Return cached value if available, otherwise default
      if (cached) {
        return cached.value;
      }
      
      // Fallback to default configuration
      return this.getDefaultValue(flag, context);
    }
  }

  /**
   * Get all feature flags for the given context
   */
  async getAllFlags(context?: FeatureFlagContext): Promise<Record<FeatureFlag, boolean>> {
    try {
      return await this.provider.getAllFlags(context);
    } catch (error) {
      console.error('Failed to get all feature flags:', error);
      
      // Fallback to default configurations
      const flags: Record<FeatureFlag, boolean> = {} as any;
      for (const flag of Object.values(FeatureFlag)) {
        flags[flag] = this.getDefaultValue(flag, context);
      }
      return flags;
    }
  }

  /**
   * Clear the cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update a feature flag configuration (if provider supports it)
   */
  async updateFlag(flag: FeatureFlag, config: FeatureFlagConfig): Promise<void> {
    if (this.provider.updateFlag) {
      await this.provider.updateFlag(flag, config);
      
      // Clear cache for this flag
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.startsWith(`${flag}:`)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      throw new Error('Provider does not support flag updates');
    }
  }

  private getCacheKey(flag: FeatureFlag, context?: FeatureFlagContext): string {
    const contextKey = context ? JSON.stringify(context) : 'default';
    return `${flag}:${contextKey}`;
  }

  private getDefaultValue(flag: FeatureFlag, context?: FeatureFlagContext): boolean {
    const config = DEFAULT_FLAG_CONFIG[flag];
    if (!config) {
      return false;
    }

    // Check if flag is enabled
    if (!config.enabled) {
      return false;
    }

    // Check date range
    if (config.startDate && new Date() < new Date(config.startDate)) {
      return false;
    }
    if (config.endDate && new Date() > new Date(config.endDate)) {
      return false;
    }

    // Check user segments
    if (config.userSegments && context?.userSegment) {
      if (!config.userSegments.includes(context.userSegment)) {
        return false;
      }
    }

    // Check geo targeting
    if (config.geoTargeting && context?.country) {
      const { includedCountries, excludedCountries } = config.geoTargeting;
      
      if (includedCountries && !includedCountries.includes(context.country)) {
        return false;
      }
      
      if (excludedCountries && excludedCountries.includes(context.country)) {
        return false;
      }
    }

    // Check rollout percentage
    if (config.rolloutPercentage !== undefined) {
      const hash = this.hashString(flag + (context?.userId || 'anonymous'));
      const percentage = (hash % 100) + 1;
      return percentage <= config.rolloutPercentage;
    }

    return true;
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
}