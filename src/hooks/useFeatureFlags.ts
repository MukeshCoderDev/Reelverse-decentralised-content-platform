import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { 
  FeatureFlag, 
  FeatureFlagContext, 
  FeatureFlagService 
} from '../lib/featureFlags/FeatureFlags';
import { LocalFeatureFlagProvider } from '../lib/featureFlags/providers/LocalProvider';
import { RemoteFeatureFlagProvider } from '../lib/featureFlags/providers/RemoteProvider';

interface FeatureFlagProviderProps {
  children: ReactNode;
  provider?: 'local' | 'remote';
  remoteConfig?: {
    apiEndpoint: string;
    apiKey?: string;
    pollInterval?: number;
  };
  context?: FeatureFlagContext;
}

interface FeatureFlagHookResult {
  isEnabled: (flag: FeatureFlag) => boolean;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  getAllFlags: () => Record<FeatureFlag, boolean>;
}

const FeatureFlagServiceContext = createContext<FeatureFlagService | null>(null);
const FeatureFlagContextContext = createContext<FeatureFlagContext | null>(null);

export function FeatureFlagProvider({ 
  children, 
  provider = 'local',
  remoteConfig,
  context 
}: FeatureFlagProviderProps) {
  const [service] = useState(() => {
    if (provider === 'remote' && remoteConfig) {
      const remoteProvider = new RemoteFeatureFlagProvider(remoteConfig);
      return new FeatureFlagService(remoteProvider);
    } else {
      const localProvider = new LocalFeatureFlagProvider();
      return new FeatureFlagService(localProvider);
    }
  });

  return (
    <FeatureFlagServiceContext.Provider value={service}>
      <FeatureFlagContextContext.Provider value={context || null}>
        {children}
      </FeatureFlagContextContext.Provider>
    </FeatureFlagServiceContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagHookResult {
  const service = useContext(FeatureFlagServiceContext);
  const context = useContext(FeatureFlagContextContext);
  
  const [flags, setFlags] = useState<Record<FeatureFlag, boolean>>({} as any);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  if (!service) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }

  const loadFlags = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const allFlags = await service.getAllFlags(context || undefined);
      setFlags(allFlags);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, [service, context]);

  const isEnabled = (flag: FeatureFlag): boolean => {
    return flags[flag] || false;
  };

  const refresh = async (): Promise<void> => {
    await loadFlags();
  };

  const getAllFlags = (): Record<FeatureFlag, boolean> => {
    return { ...flags };
  };

  return {
    isEnabled,
    isLoading,
    error,
    refresh,
    getAllFlags
  };
}

// Hook for checking a single feature flag
export function useFeatureFlag(flag: FeatureFlag): {
  isEnabled: boolean;
  isLoading: boolean;
  error: Error | null;
} {
  const service = useContext(FeatureFlagServiceContext);
  const context = useContext(FeatureFlagContextContext);
  
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  if (!service) {
    throw new Error('useFeatureFlag must be used within a FeatureFlagProvider');
  }

  useEffect(() => {
    const checkFlag = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const enabled = await service.isEnabled(flag, context || undefined);
        setIsEnabled(enabled);
      } catch (err) {
        setError(err as Error);
        setIsEnabled(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkFlag();
  }, [service, flag, context]);

  return { isEnabled, isLoading, error };
}

// Hook for conditional rendering based on feature flags
export function useConditionalFeature<T>(
  flag: FeatureFlag,
  enabledValue: T,
  disabledValue: T
): T {
  const { isEnabled } = useFeatureFlag(flag);
  return isEnabled ? enabledValue : disabledValue;
}

// Hook for A/B testing
export function useABTest(
  flagA: FeatureFlag,
  flagB: FeatureFlag
): 'A' | 'B' | 'control' {
  const { isEnabled: isAEnabled } = useFeatureFlag(flagA);
  const { isEnabled: isBEnabled } = useFeatureFlag(flagB);

  if (isAEnabled && !isBEnabled) return 'A';
  if (!isAEnabled && isBEnabled) return 'B';
  return 'control';
}

// Higher-order component for feature flag gating
export function withFeatureFlag<P extends object>(
  flag: FeatureFlag,
  Component: React.ComponentType<P>,
  FallbackComponent?: React.ComponentType<P>
) {
  return function FeatureFlaggedComponent(props: P) {
    const { isEnabled, isLoading } = useFeatureFlag(flag);

    if (isLoading) {
      return null; // or a loading spinner
    }

    if (isEnabled) {
      return <Component {...props} />;
    }

    if (FallbackComponent) {
      return <FallbackComponent {...props} />;
    }

    return null;
  };
}

// Component for conditional rendering
interface FeatureGateProps {
  flag: FeatureFlag;
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
}

export function FeatureGate({ flag, children, fallback, loading }: FeatureGateProps) {
  const { isEnabled, isLoading } = useFeatureFlag(flag);

  if (isLoading) {
    return <>{loading || null}</>;
  }

  if (isEnabled) {
    return <>{children}</>;
  }

  return <>{fallback || null}</>;
}

// Hook for feature flag analytics
export function useFeatureFlagAnalytics() {
  const { getAllFlags } = useFeatureFlags();

  const trackFeatureFlagUsage = (flag: FeatureFlag, action: string) => {
    const flags = getAllFlags();
    const isEnabled = flags[flag];

    // Send analytics event
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'feature_flag_usage', {
        flag_name: flag,
        flag_enabled: isEnabled,
        action: action,
        timestamp: Date.now()
      });
    }

    // Log for debugging
    console.log(`Feature flag usage: ${flag} (${isEnabled ? 'enabled' : 'disabled'}) - ${action}`);
  };

  return { trackFeatureFlagUsage };
}