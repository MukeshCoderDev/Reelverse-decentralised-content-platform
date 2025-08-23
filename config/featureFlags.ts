/**
 * Feature flags configuration for Reelverse
 * Controls feature visibility and behavior across the application
 */
export const FEATURES = {
  /** Hide wallet connect functionality - treasury covers gas for now */
  WALLET_CONNECT_ENABLED: false,
  
  /** Show earnings pill in header actions */
  EARNINGS_PILL_ENABLED: true,
  
  /** Enable live streaming features */
  LIVE_ENABLED: true,
  
  /** Enable shorts/vertical feed features */
  SHORTS_ENABLED: true,
  
  /** Show Go Live button for creators */
  GO_LIVE_ENABLED: true,
  
  /** Enable mobile-specific optimizations */
  MOBILE_OPTIMIZATIONS_ENABLED: true,
} as const;

/**
 * Type-safe feature flag checker
 */
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature];
}

/**
 * Environment-based feature overrides
 * Can be used to enable/disable features based on environment
 */
export function getFeatureOverrides() {
  const env = process.env.NODE_ENV;
  
  // Development overrides
  if (env === 'development') {
    return {
      // Enable all features in development
      ...FEATURES,
    };
  }
  
  // Production overrides
  if (env === 'production') {
    return {
      ...FEATURES,
      // Keep wallet connect disabled in production for now
      WALLET_CONNECT_ENABLED: false,
    };
  }
  
  return FEATURES;
}

/**
 * Get effective feature flags with environment overrides
 */
export function getEffectiveFeatures() {
  return getFeatureOverrides();
}