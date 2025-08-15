import { describe, it, expect, beforeEach, vi } from 'vitest';
import { featureFlags, FeatureFlagContext, DEFAULT_FEATURE_FLAGS } from '../lib/featureFlags';

describe('Feature Flag System', () => {
  beforeEach(() => {
    // Reset feature flags to defaults
    Object.values(DEFAULT_FEATURE_FLAGS).forEach(flag => {
      featureFlags.updateFlag(flag.key, flag);
    });
  });

  describe('Basic Flag Evaluation', () => {
    it('should return true for enabled boolean flags', () => {
      const result = featureFlags.isEnabled('AGE_BLUR_ENABLED');
      expect(result).toBe(true);
    });

    it('should return false for disabled flags', () => {
      featureFlags.updateFlag('AGE_BLUR_ENABLED', { enabled: false });
      const result = featureFlags.isEnabled('AGE_BLUR_ENABLED');
      expect(result).toBe(false);
    });

    it('should return false for non-existent flags', () => {
      const result = featureFlags.isEnabled('NON_EXISTENT_FLAG');
      expect(result).toBe(false);
    });

    it('should return correct values for different flag types', () => {
      const maxUploadSize = featureFlags.getValue('MAX_UPLOAD_SIZE_MB', 1000);
      expect(maxUploadSize).toBe(5000);

      const defaultValue = featureFlags.getValue('NON_EXISTENT_FLAG', 'default');
      expect(defaultValue).toBe('default');
    });
  });

  describe('Geographic Restrictions', () => {
    it('should respect geographic restrictions', () => {
      const context: FeatureFlagContext = { country: 'JP' };
      const result = featureFlags.isEnabled('JAPAN_MOSAIC_TOGGLE', context);
      expect(result).toBe(true);

      const contextUS: FeatureFlagContext = { country: 'US' };
      const resultUS = featureFlags.isEnabled('JAPAN_MOSAIC_TOGGLE', contextUS);
      expect(resultUS).toBe(false);
    });
  });

  describe('Rollout Percentage', () => {
    it('should respect rollout percentage', () => {
      // Create a flag with 50% rollout
      featureFlags.updateFlag('AUTO_PROMO_GENERATION', { 
        rolloutPercentage: 50 
      });

      // Test with different user IDs to check distribution
      const results = [];
      for (let i = 0; i < 100; i++) {
        const context: FeatureFlagContext = { userId: `user${i}` };
        results.push(featureFlags.isEnabled('AUTO_PROMO_GENERATION', context));
      }

      const enabledCount = results.filter(r => r).length;
      // Should be roughly 50% (allow some variance due to hashing)
      expect(enabledCount).toBeGreaterThan(30);
      expect(enabledCount).toBeLessThan(70);
    });

    it('should be consistent for same user', () => {
      featureFlags.updateFlag('AUTO_PROMO_GENERATION', { 
        rolloutPercentage: 50 
      });

      const context: FeatureFlagContext = { userId: 'consistent-user' };
      const result1 = featureFlags.isEnabled('AUTO_PROMO_GENERATION', context);
      const result2 = featureFlags.isEnabled('AUTO_PROMO_GENERATION', context);
      
      expect(result1).toBe(result2);
    });
  });

  describe('Flag Management', () => {
    it('should create new flags', () => {
      const newFlag = {
        key: 'TEST_FLAG',
        name: 'Test Flag',
        description: 'A test flag',
        enabled: true,
        type: 'boolean' as const,
        value: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      featureFlags.createFlag(newFlag);
      const result = featureFlags.isEnabled('TEST_FLAG');
      expect(result).toBe(true);
    });

    it('should update existing flags', () => {
      featureFlags.updateFlag('AGE_BLUR_ENABLED', { 
        enabled: false,
        value: false 
      });

      const result = featureFlags.isEnabled('AGE_BLUR_ENABLED');
      expect(result).toBe(false);
    });

    it('should delete flags', () => {
      featureFlags.deleteFlag('AGE_BLUR_ENABLED');
      const result = featureFlags.isEnabled('AGE_BLUR_ENABLED');
      expect(result).toBe(false);
    });

    it('should list all flags', () => {
      const allFlags = featureFlags.getAllFlags();
      expect(allFlags.length).toBeGreaterThan(0);
      expect(allFlags.some(f => f.key === 'AGE_BLUR_ENABLED')).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    it('should check maintenance mode', () => {
      expect(featureFlags.isMaintenanceMode()).toBe(false);
      
      featureFlags.updateFlag('MAINTENANCE_MODE', { enabled: true, value: true });
      expect(featureFlags.isMaintenanceMode()).toBe(true);
    });

    it('should check crypto only mode', () => {
      expect(featureFlags.isCryptoOnlyMode()).toBe(false);
      
      featureFlags.updateFlag('CRYPTO_ONLY_MODE', { enabled: true, value: true });
      expect(featureFlags.isCryptoOnlyMode()).toBe(true);
    });

    it('should get upload limits', () => {
      expect(featureFlags.getMaxUploadSize()).toBe(5000);
      expect(featureFlags.getMaxBulkUploadFiles()).toBe(50);
    });
  });

  describe('Context-based Evaluation', () => {
    it('should evaluate flags based on user context', () => {
      // Create a flag with user segment condition
      featureFlags.createFlag({
        key: 'PREMIUM_FEATURES',
        name: 'Premium Features',
        description: 'Features for premium users',
        enabled: true,
        type: 'boolean',
        value: true,
        conditions: [{
          type: 'user_segment',
          operator: 'equals',
          value: 'premium'
        }],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const premiumContext: FeatureFlagContext = { userSegment: 'premium' };
      const regularContext: FeatureFlagContext = { userSegment: 'regular' };

      expect(featureFlags.isEnabled('PREMIUM_FEATURES', premiumContext)).toBe(true);
      expect(featureFlags.isEnabled('PREMIUM_FEATURES', regularContext)).toBe(false);
    });

    it('should handle multiple conditions', () => {
      featureFlags.createFlag({
        key: 'VERIFIED_PREMIUM_FEATURES',
        name: 'Verified Premium Features',
        description: 'Features for verified premium users',
        enabled: true,
        type: 'boolean',
        value: true,
        conditions: [
          {
            type: 'user_segment',
            operator: 'equals',
            value: 'premium'
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const context: FeatureFlagContext = {
        userSegment: 'premium',
        isVerified: true
      };

      expect(featureFlags.isEnabled('VERIFIED_PREMIUM_FEATURES', context)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid flag keys gracefully', () => {
      // Mock console.warn to avoid test output
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = featureFlags.isEnabled('');
      expect(result).toBe(false);
      
      consoleSpy.mockRestore();
    });

    it('should handle missing context gracefully', () => {
      const result = featureFlags.isEnabled('AGE_BLUR_ENABLED', undefined);
      expect(result).toBe(true);
    });
  });
});