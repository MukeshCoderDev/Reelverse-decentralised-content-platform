import { 
  FeatureFlag, 
  FeatureFlagConfig, 
  FeatureFlagContext, 
  FeatureFlagProvider,
  DEFAULT_FLAG_CONFIG 
} from '../FeatureFlags';

/**
 * Local storage-based feature flag provider
 * Useful for development and testing
 */
export class LocalFeatureFlagProvider implements FeatureFlagProvider {
  private storageKey = 'reelverse18_feature_flags';
  private flags: Record<FeatureFlag, FeatureFlagConfig>;

  constructor(initialFlags?: Partial<Record<FeatureFlag, FeatureFlagConfig>>) {
    this.flags = { ...DEFAULT_FLAG_CONFIG, ...initialFlags };
    this.loadFromStorage();
  }

  async getFlag(flag: FeatureFlag, context?: FeatureFlagContext): Promise<boolean> {
    const config = this.flags[flag];
    if (!config) {
      return false;
    }

    return this.evaluateFlag(config, context, flag);
  }

  async getAllFlags(context?: FeatureFlagContext): Promise<Record<FeatureFlag, boolean>> {
    const result: Record<FeatureFlag, boolean> = {} as any;
    
    for (const [flag, config] of Object.entries(this.flags)) {
      result[flag as FeatureFlag] = this.evaluateFlag(config, context, flag as FeatureFlag);
    }

    return result;
  }

  async updateFlag(flag: FeatureFlag, config: FeatureFlagConfig): Promise<void> {
    this.flags[flag] = config;
    this.saveToStorage();
  }

  /**
   * Reset all flags to default configuration
   */
  resetToDefaults(): void {
    this.flags = { ...DEFAULT_FLAG_CONFIG };
    this.saveToStorage();
  }

  /**
   * Get raw flag configuration
   */
  getFlagConfig(flag: FeatureFlag): FeatureFlagConfig | undefined {
    return this.flags[flag];
  }

  /**
   * Set multiple flags at once
   */
  setFlags(flags: Partial<Record<FeatureFlag, FeatureFlagConfig>>): void {
    this.flags = { ...this.flags, ...flags };
    this.saveToStorage();
  }

  private evaluateFlag(
    config: FeatureFlagConfig, 
    context?: FeatureFlagContext,
    flag?: FeatureFlag
  ): boolean {
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
      const hash = this.hashString((flag || 'unknown') + (context?.userId || 'anonymous'));
      const percentage = (hash % 100) + 1;
      return percentage <= config.rolloutPercentage;
    }

    return true;
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsedFlags = JSON.parse(stored);
        this.flags = { ...this.flags, ...parsedFlags };
      }
    } catch (error) {
      console.warn('Failed to load feature flags from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.flags));
    } catch (error) {
      console.warn('Failed to save feature flags to storage:', error);
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
}