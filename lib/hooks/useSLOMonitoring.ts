/**
 * React Hook for SLO Monitoring
 * Provides easy access to SLO metrics and operational dashboard data
 */

import { useState, useEffect, useCallback } from 'react';

interface SLOMetrics {
  playbackP95JoinTime: number;
  rebufferRatio: number;
  payoutP95Latency: number;
  checkoutSuccessRate: number;
  uptime: number;
  errorRate: number;
  aiTaggingAccuracy: number;
  leakDetectionRate: number;
}

interface PayoutLatencyMetrics {
  p95LatencyHours: number;
  p99LatencyHours: number;
  averageLatencyHours: number;
  totalPayouts: number;
  successRate: number;
  failedPayouts: number;
  timeframe: string;
}

interface SLOBreach {
  id: string;
  metric: keyof SLOMetrics;
  currentValue: number;
  threshold: number;
  severity: 'warning' | 'critical';
  description: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

interface SLOStatus {
  status: 'healthy' | 'warning' | 'critical';
  activeBreaches: number;
  criticalBreaches: number;
  lastCheck: Date;
}

interface OperationalDashboard {
  sloMetrics: SLOMetrics;
  payoutLatency: PayoutLatencyMetrics;
  activeBreaches: SLOBreach[];
  systemHealth: {
    uptime: number;
    errorRate: number;
    responseTime: number;
  };
  lastUpdated: Date;
}

interface UseSLOMonitoringOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  apiUrl?: string;
}

interface UseSLOMonitoringReturn {
  // Data
  status: SLOStatus | null;
  metrics: SLOMetrics | null;
  payoutMetrics: PayoutLatencyMetrics | null;
  dashboard: OperationalDashboard | null;
  breaches: SLOBreach[];
  
  // State
  loading: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshMetrics: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
  addWebhook: (url: string) => Promise<boolean>;
  removeWebhook: (url: string) => Promise<boolean>;
  testAlert: () => Promise<boolean>;
}

export const useSLOMonitoring = (options: UseSLOMonitoringOptions = {}): UseSLOMonitoringReturn => {
  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
    apiUrl = '/api/v1/slo'
  } = options;

  // State
  const [status, setStatus] = useState<SLOStatus | null>(null);
  const [metrics, setMetrics] = useState<SLOMetrics | null>(null);
  const [payoutMetrics, setPayoutMetrics] = useState<PayoutLatencyMetrics | null>(null);
  const [dashboard, setDashboard] = useState<OperationalDashboard | null>(null);
  const [breaches, setBreaches] = useState<SLOBreach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch SLO status
  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/status`);
      const result = await response.json();
      
      if (result.success) {
        setStatus(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch SLO status');
      }
    } catch (err) {
      setError('Network error fetching SLO status');
      console.error('SLO status fetch error:', err);
    }
  }, [apiUrl]);

  // Fetch SLO metrics
  const refreshMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/metrics`);
      const result = await response.json();
      
      if (result.success) {
        setMetrics(result.data.sloMetrics);
        setPayoutMetrics(result.data.payoutMetrics);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch SLO metrics');
      }
    } catch (err) {
      setError('Network error fetching SLO metrics');
      console.error('SLO metrics fetch error:', err);
    }
  }, [apiUrl]);

  // Fetch operational dashboard
  const refreshDashboard = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/dashboard`);
      const result = await response.json();
      
      if (result.success) {
        setDashboard(result.data);
        setBreaches(result.data.activeBreaches);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      setError('Network error fetching dashboard data');
      console.error('Dashboard fetch error:', err);
    }
  }, [apiUrl]);

  // Refresh all data
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        refreshStatus(),
        refreshMetrics(),
        refreshDashboard()
      ]);
    } finally {
      setLoading(false);
    }
  }, [refreshStatus, refreshMetrics, refreshDashboard]);

  // Add webhook URL
  const addWebhook = useCallback(async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });
      
      const result = await response.json();
      return result.success;
    } catch (err) {
      console.error('Failed to add webhook:', err);
      return false;
    }
  }, [apiUrl]);

  // Remove webhook URL
  const removeWebhook = useCallback(async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/webhooks`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });
      
      const result = await response.json();
      return result.success;
    } catch (err) {
      console.error('Failed to remove webhook:', err);
      return false;
    }
  }, [apiUrl]);

  // Test alert
  const testAlert = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/test-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      return result.success;
    } catch (err) {
      console.error('Failed to send test alert:', err);
      return false;
    }
  }, [apiUrl]);

  // Auto-refresh effect
  useEffect(() => {
    // Initial load
    refresh();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(refresh, refreshInterval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [refresh, autoRefresh, refreshInterval]);

  return {
    // Data
    status,
    metrics,
    payoutMetrics,
    dashboard,
    breaches,
    
    // State
    loading,
    error,
    
    // Actions
    refresh,
    refreshStatus,
    refreshMetrics,
    refreshDashboard,
    addWebhook,
    removeWebhook,
    testAlert
  };
};

// Utility hooks for specific use cases

/**
 * Hook for getting just the SLO status (lightweight)
 */
export const useSLOStatus = (refreshInterval = 60000) => {
  const { status, loading, error, refreshStatus } = useSLOMonitoring({
    autoRefresh: true,
    refreshInterval
  });

  return {
    status,
    loading,
    error,
    refresh: refreshStatus
  };
};

/**
 * Hook for getting SLO metrics only
 */
export const useSLOMetrics = (refreshInterval = 30000) => {
  const { metrics, payoutMetrics, loading, error, refreshMetrics } = useSLOMonitoring({
    autoRefresh: true,
    refreshInterval
  });

  return {
    metrics,
    payoutMetrics,
    loading,
    error,
    refresh: refreshMetrics
  };
};

/**
 * Hook for getting active breaches only
 */
export const useSLOBreaches = (refreshInterval = 15000) => {
  const { breaches, loading, error } = useSLOMonitoring({
    autoRefresh: true,
    refreshInterval
  });

  const criticalBreaches = breaches.filter(b => b.severity === 'critical');
  const warningBreaches = breaches.filter(b => b.severity === 'warning');

  return {
    breaches,
    criticalBreaches,
    warningBreaches,
    hasCritical: criticalBreaches.length > 0,
    hasWarning: warningBreaches.length > 0,
    totalCount: breaches.length,
    loading,
    error
  };
};