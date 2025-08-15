import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FeatureFlagService, FeatureFlag, FeatureFlagContext } from '../FeatureFlags';
import { LocalFeatureFlagProvider } from '../providers/LocalProvider';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let provider: LocalFeatureFlagProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    provider = new LocalFeatureFlagProvider();
    service = new FeatureFlagService(provider);
  });

  describe('isEnabled', () => {
    it('should return true for enabled flags', async () => {
      const result = await service.isEnabled(FeatureFlag.AGE_BLUR_ENABLED);
      expect(result).toBe(true);
    });

    it('should return false for disabled flags', async () => {
      const result = await service.isEnabled(FeatureFlag.CRYPTO_ONLY_MODE);
      expect(result).toBe(false);
    });

    it('should respect rollout percentage', async () => {
      const context: FeatureFlagContext = { userId: 'test-user-1' };
      
      // This should be deterministic based on the hash
      const result = await service.isEnabled(FeatureFlag.CRYPTO_ONLY_MODE, context);
      
      // The result should be consistent for the same user
      const result2 = await service.isEnabled(FeatureFlag.CRYPTO_ONLY_MODE, context);
      expect(result).toBe(result2);
    });

    it('should respect user segments', async () => {
      const agencyContext: FeatureFlagContext = { 
        userId: 'test-user',
        userSegment: 'agency' 
      };
      
      const individualContext: FeatureFlagContext = { 
        userId: 'test-user',
        userSegment: 'individual' 
      };

      const agencyResult = await service.isEnabled(FeatureFlag.BULK_UPLOAD_ENABLED, agencyContext);
      const individualResult = await service.isEnabled(FeatureFlag.BULK_UPLOAD_ENABLED, individualContext);

      expect(agencyResult).toBe(true);
      expect(individualResult).toBe(false);
    });

    it('should respect geo targeting', async () => {
      const jpContext: FeatureFlagContext = { 
        userId: 'test-user',
        country: 'JP' 
      };
      
      const usContext: FeatureFlagContext = { 
        userId: 'test-user',
        country: 'US' 
      };

      const jpResult = await service.isEnabled(FeatureFlag.JAPAN_MOSAIC_TOGGLE, jpContext);
      const usResult = await service.isEnabled(FeatureFlag.JAPAN_MOSAIC_TOGGLE, usContext);

      expect(jpResult).toBe(true);
      expect(usResult).toBe(false);
    });

    it('should respect date ranges', async () => {
      // Update flag with future start date
      await provider.updateFlag(FeatureFlag.AI_CONTENT_TAGGING, {
        enabled: true,
        startDate: new Date(Date.now() + 86400000).toISOString() // Tomorrow
      });

      const result = await service.isEnabled(FeatureFlag.AI_CONTENT_TAGGING);
      expect(result).toBe(false);
    });

    it('should cache results', async () => {
      const spy = jest.spyOn(provider, 'getFlag');
      
      // First call
      await service.isEnabled(FeatureFlag.AGE_BLUR_ENABLED);
      expect(spy).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      await service.isEnabled(FeatureFlag.AGE_BLUR_ENABLED);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAllFlags', () => {
    it('should return all flags with their status', async () => {
      const flags = await service.getAllFlags();
      
      expect(flags).toHaveProperty(FeatureFlag.AGE_BLUR_ENABLED);
      expect(flags).toHaveProperty(FeatureFlag.CRYPTO_ONLY_MODE);
      expect(typeof flags[FeatureFlag.AGE_BLUR_ENABLED]).toBe('boolean');
    });

    it('should apply context to all flags', async () => {
      const context: FeatureFlagContext = { 
        userId: 'test-user',
        userSegment: 'agency',
        country: 'JP'
      };

      const flags = await service.getAllFlags(context);
      
      // Should enable agency-specific features
      expect(flags[FeatureFlag.BULK_UPLOAD_ENABLED]).toBe(true);
      
      // Should enable Japan-specific features
      expect(flags[FeatureFlag.JAPAN_MOSAIC_TOGGLE]).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should fallback to default values on provider error', async () => {
      const errorProvider = {
        getFlag: jest.fn().mockRejectedValue(new Error('Provider error')),
        getAllFlags: jest.fn().mockRejectedValue(new Error('Provider error'))
      };

      const errorService = new FeatureFlagService(errorProvider);
      
      // Should not throw and return default value
      const result = await errorService.isEnabled(FeatureFlag.AGE_BLUR_ENABLED);
      expect(typeof result).toBe('boolean');
    });

    it('should use cached values when provider fails', async () => {
      // First successful call
      const result1 = await service.isEnabled(FeatureFlag.AGE_BLUR_ENABLED);
      
      // Mock provider to fail
      jest.spyOn(provider, 'getFlag').mockRejectedValue(new Error('Network error'));
      
      // Should return cached value
      const result2 = await service.isEnabled(FeatureFlag.AGE_BLUR_ENABLED);
      expect(result2).toBe(result1);
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const spy = jest.spyOn(provider, 'getFlag');
      
      // First call
      await service.isEnabled(FeatureFlag.AGE_BLUR_ENABLED);
      expect(spy).toHaveBeenCalledTimes(1);
      
      // Clear cache
      service.clearCache();
      
      // Next call should hit provider again
      await service.isEnabled(FeatureFlag.AGE_BLUR_ENABLED);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
});

describe('LocalFeatureFlagProvider', () => {
  let provider: LocalFeatureFlagProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    provider = new LocalFeatureFlagProvider();
  });

  describe('flag evaluation', () => {
    it('should evaluate enabled flags correctly', async () => {
      const result = await provider.getFlag(FeatureFlag.AGE_BLUR_ENABLED);
      expect(result).toBe(true);
    });

    it('should evaluate disabled flags correctly', async () => {
      const result = await provider.getFlag(FeatureFlag.CRYPTO_ONLY_MODE);
      expect(result).toBe(false);
    });

    it('should handle rollout percentages', async () => {
      const context1: FeatureFlagContext = { userId: 'user1' };
      const context2: FeatureFlagContext = { userId: 'user2' };

      const result1 = await provider.getFlag(FeatureFlag.CRYPTO_ONLY_MODE, context1);
      const result2 = await provider.getFlag(FeatureFlag.CRYPTO_ONLY_MODE, context2);

      // Results should be deterministic for each user
      const result1Again = await provider.getFlag(FeatureFlag.CRYPTO_ONLY_MODE, context1);
      expect(result1).toBe(result1Again);
    });
  });

  describe('flag updates', () => {
    it('should update flag configuration', async () => {
      await provider.updateFlag(FeatureFlag.CRYPTO_ONLY_MODE, {
        enabled: true,
        rolloutPercentage: 100
      });

      const result = await provider.getFlag(FeatureFlag.CRYPTO_ONLY_MODE);
      expect(result).toBe(true);
    });

    it('should persist updates to localStorage', async () => {
      await provider.updateFlag(FeatureFlag.CRYPTO_ONLY_MODE, {
        enabled: true
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('storage integration', () => {
    it('should load flags from localStorage', () => {
      const storedFlags = {
        [FeatureFlag.CRYPTO_ONLY_MODE]: { enabled: true }
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedFlags));
      
      const newProvider = new LocalFeatureFlagProvider();
      const config = newProvider.getFlagConfig(FeatureFlag.CRYPTO_ONLY_MODE);
      
      expect(config?.enabled).toBe(true);
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => new LocalFeatureFlagProvider()).not.toThrow();
    });
  });

  describe('utility methods', () => {
    it('should reset to defaults', () => {
      provider.updateFlag(FeatureFlag.CRYPTO_ONLY_MODE, { enabled: true });
      provider.resetToDefaults();
      
      const config = provider.getFlagConfig(FeatureFlag.CRYPTO_ONLY_MODE);
      expect(config?.enabled).toBe(false); // Default value
    });

    it('should set multiple flags', () => {
      provider.setFlags({
        [FeatureFlag.CRYPTO_ONLY_MODE]: { enabled: true },
        [FeatureFlag.DARK_MODE_ENABLED]: { enabled: false }
      });

      expect(provider.getFlagConfig(FeatureFlag.CRYPTO_ONLY_MODE)?.enabled).toBe(true);
      expect(provider.getFlagConfig(FeatureFlag.DARK_MODE_ENABLED)?.enabled).toBe(false);
    });
  });
});