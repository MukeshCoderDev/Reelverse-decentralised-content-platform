/**
 * SLO Operational Dashboard Component
 * Internal dashboard for monitoring SLO metrics and breaches
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../Card';
import { Spinner } from '../Spinner';

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

export const SLODashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<OperationalDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboard = async () => {
    try {
      const response = await fetch('/api/slo/dashboard');
      const result = await response.json();
      
      if (result.success) {
        setDashboard(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      setError('Network error fetching dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchDashboard, 30000); // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const formatLatency = (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    return `${hours.toFixed(1)}h`;
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  const getMetricStatus = (metric: keyof SLOMetrics, value: number): 'healthy' | 'warning' | 'critical' => {
    // Define thresholds for visual indicators
    const thresholds = {
      playbackP95JoinTime: { warning: 2000, critical: 5000 },
      rebufferRatio: { warning: 1.0, critical: 2.5 },
      payoutP95Latency: { warning: 24, critical: 48 },
      checkoutSuccessRate: { warning: 95, critical: 90 },
      uptime: { warning: 99.9, critical: 99.5 },
      errorRate: { warning: 0.5, critical: 1.0 },
      aiTaggingAccuracy: { warning: 90, critical: 85 },
      leakDetectionRate: { warning: 80, critical: 70 }
    };

    const threshold = thresholds[metric];
    if (!threshold) return 'healthy';

    if (metric === 'checkoutSuccessRate' || metric === 'uptime' || metric === 'aiTaggingAccuracy' || metric === 'leakDetectionRate') {
      // Higher is better metrics
      if (value < threshold.critical) return 'critical';
      if (value < threshold.warning) return 'warning';
    } else {
      // Lower is better metrics
      if (value > threshold.critical) return 'critical';
      if (value > threshold.warning) return 'warning';
    }
    
    return 'healthy';
  };

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical'): string => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBg = (status: 'healthy' | 'warning' | 'critical'): string => {
    switch (status) {
      case 'healthy': return 'bg-green-100';
      case 'warning': return 'bg-yellow-100';
      case 'critical': return 'bg-red-100';
      default: return 'bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
        <span className="ml-2">Loading SLO Dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-red-600">
          <h3 className="text-lg font-semibold mb-2">Error Loading Dashboard</h3>
          <p>{error}</p>
          <button 
            onClick={fetchDashboard}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  if (!dashboard) {
    return (
      <Card className="p-6">
        <div className="text-gray-600">No dashboard data available</div>
      </Card>
    );
  }

  const criticalBreaches = dashboard.activeBreaches.filter(b => b.severity === 'critical');
  const warningBreaches = dashboard.activeBreaches.filter(b => b.severity === 'warning');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">SLO Operational Dashboard</h2>
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">System Status</div>
          <div className={`text-2xl font-bold ${criticalBreaches.length > 0 ? 'text-red-600' : warningBreaches.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
            {criticalBreaches.length > 0 ? 'Critical' : warningBreaches.length > 0 ? 'Warning' : 'Healthy'}
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="text-sm text-gray-600">Active Breaches</div>
          <div className="text-2xl font-bold">{dashboard.activeBreaches.length}</div>
          <div className="text-xs text-gray-500">
            {criticalBreaches.length} critical, {warningBreaches.length} warning
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="text-sm text-gray-600">System Uptime</div>
          <div className={`text-2xl font-bold ${getStatusColor(getMetricStatus('uptime', dashboard.systemHealth.uptime))}`}>
            {formatPercentage(dashboard.systemHealth.uptime)}
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="text-sm text-gray-600">Last Updated</div>
          <div className="text-lg font-semibold">
            {new Date(dashboard.lastUpdated).toLocaleTimeString()}
          </div>
        </Card>
      </div>

      {/* Active Breaches */}
      {dashboard.activeBreaches.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Active SLO Breaches</h3>
          <div className="space-y-3">
            {dashboard.activeBreaches.map((breach) => (
              <div
                key={breach.id}
                className={`p-4 rounded-lg border-l-4 ${
                  breach.severity === 'critical' 
                    ? 'border-red-500 bg-red-50' 
                    : 'border-yellow-500 bg-yellow-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`font-semibold ${breach.severity === 'critical' ? 'text-red-800' : 'text-yellow-800'}`}>
                      {breach.severity.toUpperCase()}: {breach.description}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Current: {breach.currentValue.toFixed(2)} | Threshold: {breach.threshold}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(breach.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* SLO Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Playback Metrics */}
        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-2">Video Join Time (P95)</div>
          <div className={`text-xl font-bold ${getStatusColor(getMetricStatus('playbackP95JoinTime', dashboard.sloMetrics.playbackP95JoinTime))}`}>
            {dashboard.sloMetrics.playbackP95JoinTime.toFixed(0)}ms
          </div>
          <div className="text-xs text-gray-500 mt-1">Target: &lt;2000ms</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-2">Rebuffer Ratio</div>
          <div className={`text-xl font-bold ${getStatusColor(getMetricStatus('rebufferRatio', dashboard.sloMetrics.rebufferRatio))}`}>
            {formatPercentage(dashboard.sloMetrics.rebufferRatio)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Target: &lt;1.0%</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-2">Checkout Success Rate</div>
          <div className={`text-xl font-bold ${getStatusColor(getMetricStatus('checkoutSuccessRate', dashboard.sloMetrics.checkoutSuccessRate))}`}>
            {formatPercentage(dashboard.sloMetrics.checkoutSuccessRate)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Target: &gt;95%</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-2">Error Rate</div>
          <div className={`text-xl font-bold ${getStatusColor(getMetricStatus('errorRate', dashboard.sloMetrics.errorRate))}`}>
            {formatPercentage(dashboard.sloMetrics.errorRate)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Target: &lt;0.5%</div>
        </Card>
      </div>

      {/* Payout Metrics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Payout Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600">P95 Latency</div>
            <div className={`text-2xl font-bold ${getStatusColor(getMetricStatus('payoutP95Latency', dashboard.payoutLatency.p95LatencyHours))}`}>
              {formatLatency(dashboard.payoutLatency.p95LatencyHours)}
            </div>
            <div className="text-xs text-gray-500">Target: &lt;24h</div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600">P99 Latency</div>
            <div className="text-xl font-semibold">
              {formatLatency(dashboard.payoutLatency.p99LatencyHours)}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600">Success Rate</div>
            <div className="text-xl font-semibold text-green-600">
              {formatPercentage(dashboard.payoutLatency.successRate)}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600">Total Payouts</div>
            <div className="text-xl font-semibold">
              {dashboard.payoutLatency.totalPayouts}
            </div>
            <div className="text-xs text-gray-500">
              {dashboard.payoutLatency.failedPayouts} failed
            </div>
          </div>
        </div>
      </Card>

      {/* AI Metrics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">AI Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600">AI Tagging Accuracy</div>
            <div className={`text-2xl font-bold ${getStatusColor(getMetricStatus('aiTaggingAccuracy', dashboard.sloMetrics.aiTaggingAccuracy))}`}>
              {formatPercentage(dashboard.sloMetrics.aiTaggingAccuracy)}
            </div>
            <div className="text-xs text-gray-500">Target: &gt;95%</div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600">Leak Detection Rate</div>
            <div className={`text-2xl font-bold ${getStatusColor(getMetricStatus('leakDetectionRate', dashboard.sloMetrics.leakDetectionRate))}`}>
              {formatPercentage(dashboard.sloMetrics.leakDetectionRate)}
            </div>
            <div className="text-xs text-gray-500">Target: &gt;80%</div>
          </div>
        </div>
      </Card>
    </div>
  );
};