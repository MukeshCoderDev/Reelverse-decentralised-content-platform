import React, { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { useWallet } from './useWallet';

export interface FeatureFlagContextType {
  flags: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  refreshFlags: () => Promise<void>;
  isEnabled: (flagKey: string) => boolean;
  evaluateFlag: (flagKey: string, context?: Partial<EvaluationContext>) => Promise<boolean>;
}

export interface EvaluationContext {
  userId?: string;
  organizationId?: string;
  country?: string;
  userAgent?: string;
  ipAddress?: string;
  customAttributes?: Record<string, any>;
}

const FeatureFlagContext = createContext<FeatureFlagContextType | null>(null);

export const useFeatureFlags = (): FeatureFlagContextType => {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
};

export const useFeatureFlag = (flagKey: string): boolean => {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(flagKey);
};

interface FeatureFlagProviderProps {
  children: ReactNode;
  userId?: string;
  organizationId?: string;
}

export const FeatureFlagProvider: React.FC<FeatureFlagProviderProps> = ({
  children,
  userId,
  organizationId,
}) => {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { account } = useWallet();

  const buildEvaluationContext = (overrides?: Partial<EvaluationContext>): EvaluationContext => {
    return {
      userId: overrides?.userId || userId || account || undefined,
      organizationId: overrides?.organizationId || organizationId || undefined,
      country: overrides?.country || getCountryFromBrowser(),
      userAgent: navigator.userAgent,
      customAttributes: overrides?.customAttributes,
      ...overrides,
    };
  };

  const evaluateFlag = async (flagKey: string, context?: Partial<EvaluationContext>): Promise<boolean> => {
    try {
      const evaluationContext = buildEvaluationContext(context);
      
      const response = await fetch('/api/v1/feature-flags/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flagKey,
          context: evaluationContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to evaluate flag: ${response.statusText}`);
      }

      const result = await response.json();
      return result.enabled || false;
    } catch (err) {
      console.error(`Error evaluating flag ${flagKey}:`, err);
      return false; // Safe default
    }
  };

  const refreshFlags = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const evaluationContext = buildEvaluationContext();
      
      // Get all platform flags
      const flagKeys = [
        'passkey_wallets',
        'gasless_payments',
        'ai_auto_tagging',
        'leak_detection',
        'forensic_watermarking',
        'compliance_assistant',
        'evidence_packs',
        'multi_language_captions',
        'deepfake_detection',
        'fraud_scoring',
        'creator_ai_toolkit',
        'advanced_search_v2',
        'agency_concierge',
      ];

      const response = await fetch('/api/v1/feature-flags/evaluate-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flagKeys,
          context: evaluationContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch flags: ${response.statusText}`);
      }

      const result = await response.json();
      setFlags(result.flags || {});
    } catch (err) {
      console.error('Error refreshing feature flags:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Set safe defaults on error
      setFlags({
        passkey_wallets: false,
        gasless_payments: false,
        ai_auto_tagging: false,
        leak_detection: false,
        forensic_watermarking: false,
        compliance_assistant: false,
        evidence_packs: false,
        multi_language_captions: false,
        deepfake_detection: false,
        fraud_scoring: false,
        creator_ai_toolkit: false,
        advanced_search_v2: false,
        agency_concierge: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const isEnabled = (flagKey: string): boolean => {
    return flags[flagKey] || false;
  };

  // Initial load and refresh on context changes
  useEffect(() => {
    refreshFlags();
  }, [userId, organizationId, account]);

  // Periodic refresh (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(refreshFlags, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for flag updates via WebSocket or Server-Sent Events
  useEffect(() => {
    const eventSource = new EventSource('/api/v1/feature-flags/stream');
    
    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        if (update.type === 'flag_update') {
          setFlags(prev => ({
            ...prev,
            [update.flagKey]: update.enabled,
          }));
        } else if (update.type === 'kill_switch') {
          setFlags(prev => ({
            ...prev,
            [update.flagKey]: false,
          }));
        }
      } catch (err) {
        console.error('Error processing flag update:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Feature flag stream error:', error);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const contextValue: FeatureFlagContextType = {
    flags,
    loading,
    error,
    refreshFlags,
    isEnabled,
    evaluateFlag,
  };

  return (
    <FeatureFlagContext.Provider value={contextValue}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

// Utility function to get country from browser
const getCountryFromBrowser = (): string | undefined => {
  try {
    // Try to get from Intl API
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const country = locale.split('-')[1];
    return country?.toUpperCase();
  } catch {
    return undefined;
  }
};

// Higher-order component for conditional rendering based on feature flags
export const withFeatureFlag = <P extends object>(
  Component: React.ComponentType<P>,
  flagKey: string,
  fallback?: React.ComponentType<P> | null
) => {
  const WrappedComponent = (props: P) => {
    const isEnabled = useFeatureFlag(flagKey);
    
    if (!isEnabled) {
      return fallback ? React.createElement(fallback, props) : null;
    }
    
    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withFeatureFlag(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

// Hook for feature flag with loading state
export const useFeatureFlagWithLoading = (flagKey: string): { enabled: boolean; loading: boolean } => {
  const { isEnabled, loading } = useFeatureFlags();
  
  return {
    enabled: isEnabled(flagKey),
    loading,
  };
};

// Hook for multiple feature flags
export const useMultipleFeatureFlags = (flagKeys: string[]): Record<string, boolean> => {
  const { flags } = useFeatureFlags();
  
  return flagKeys.reduce((result, key) => {
    result[key] = flags[key] || false;
    return result;
  }, {} as Record<string, boolean>);
};

// Component for conditional rendering
interface FeatureFlagProps {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export const FeatureFlag: React.FC<FeatureFlagProps> = ({ flag, children, fallback = null }) => {
  const isEnabled = useFeatureFlag(flag);
  
  return isEnabled ? <>{children}</> : <>{fallback}</>;
};

// Kill switch component for emergency disabling
interface KillSwitchProps {
  flags: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export const KillSwitch: React.FC<KillSwitchProps> = ({ flags, children, fallback = null }) => {
  const { flags: allFlags } = useFeatureFlags();
  
  // If any flag is disabled (kill switch activated), show fallback
  const anyDisabled = flags.some(flag => !allFlags[flag]);
  
  return anyDisabled ? <>{fallback}</> : <>{children}</>;
};

// Debug component for development
export const FeatureFlagDebug: React.FC = () => {
  const { flags, loading, error } = useFeatureFlags();
  
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg text-xs max-w-sm">
      <h3 className="font-bold mb-2">Feature Flags (Debug)</h3>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-400">Error: {error}</p>}
      <div className="space-y-1">
        {Object.entries(flags).map(([key, enabled]) => (
          <div key={key} className="flex justify-between">
            <span>{key}:</span>
            <span className={enabled ? 'text-green-400' : 'text-red-400'}>
              {enabled ? 'ON' : 'OFF'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};