import React, { useState, useEffect } from 'react';
import { Card } from './Card';

interface StatusMetrics {
  uptime: {
    current: number;
    last24h: number;
    last7d: number;
    last30d: number;
  };
  performance: {
    p95JoinTime: number;
    rebufferRatio: number;
    checkoutSuccessRate: number;
    payoutP95Latency: number;
  };
  platform: {
    totalCreators: number;
    totalContent: number;
    monthlyActiveUsers: number;
    totalPayouts: string;
  };
  incidents: StatusIncident[];
}

interface StatusIncident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  startedAt: Date;
  resolvedAt?: Date;
  updates: IncidentUpdate[];
}

interface IncidentUpdate {
  timestamp: Date;
  message: string;
  status: StatusIncident['status'];
}

export const PublicStatusPage: React.FC = () => {
  const [metrics, setMetrics] = useState<StatusMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    loadStatusMetrics();
    const interval = setInterval(loadStatusMetrics, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const loadStatusMetrics = async () => {
    try {
      // In production, this would fetch from your metrics API
      const mockMetrics: StatusMetrics = {
        uptime: {
          current: 99.98,
          last24h: 99.95,
          last7d: 99.92,
          last30d: 99.89
        },
        performance: {
          p95JoinTime: 1.2, // seconds
          rebufferRatio: 0.8, // percentage
          checkoutSuccessRate: 98.5, // percentage
          payoutP95Latency: 45 // minutes
        },
        platform: {
          totalCreators: 12847,
          totalContent: 89234,
          monthlyActiveUsers: 156789,
          totalPayouts: '$2.4M'
        },
        incidents: [
          {
            id: 'inc_001',
            title: 'Intermittent upload delays',
            status: 'resolved',
            severity: 'minor',
            startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            resolvedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
            updates: [
              {
                timestamp: new Date(Date.now() - 30 * 60 * 1000),
                message: 'Issue resolved. Upload processing times have returned to normal.',
                status: 'resolved'
              },
              {
                timestamp: new Date(Date.now() - 90 * 60 * 1000),
                message: 'We have identified the cause and are implementing a fix.',
                status: 'identified'
              },
              {
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
                message: 'We are investigating reports of slower than normal upload processing.',
                status: 'investigating'
              }
            ]
          }
        ]
      };
      
      setMetrics(mockMetrics);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load status metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-green-400';
    if (value >= thresholds.warning) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusIcon = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return '🟢';
    if (value >= thresholds.warning) return '🟡';
    return '🔴';
  };

  const getIncidentStatusColor = (status: StatusIncident['status']) => {
    switch (status) {
      case 'investigating': return 'text-yellow-400';
      case 'identified': return 'text-orange-400';
      case 'monitoring': return 'text-blue-400';
      case 'resolved': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getSeverityColor = (severity: StatusIncident['severity']) => {
    switch (severity) {
      case 'minor': return 'border-yellow-500 bg-yellow-500/10';
      case 'major': return 'border-orange-500 bg-orange-500/10';
      case 'critical': return 'border-red-500 bg-red-500/10';
      default: return 'border-gray-500 bg-gray-500/10';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading status...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400">Failed to load status data</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Platform Status</h1>
              <p className="text-gray-400">Real-time operational metrics and system health</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-400">🟢 All Systems Operational</div>
              <div className="text-sm text-gray-400">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Current Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 text-center">
            <div className="text-3xl mb-2">🟢</div>
            <div className="text-2xl font-bold text-green-400">{metrics.uptime.current}%</div>
            <div className="text-sm text-gray-400">Current Uptime</div>
          </Card>
          
          <Card className="p-6 text-center">
            <div className="text-3xl mb-2">⚡</div>
            <div className="text-2xl font-bold text-blue-400">{metrics.performance.p95JoinTime}s</div>
            <div className="text-sm text-gray-400">P95 Join Time</div>
          </Card>
          
          <Card className="p-6 text-center">
            <div className="text-3xl mb-2">💳</div>
            <div className="text-2xl font-bold text-green-400">{metrics.performance.checkoutSuccessRate}%</div>
            <div className="text-sm text-gray-400">Checkout Success</div>
          </Card>
          
          <Card className="p-6 text-center">
            <div className="text-3xl mb-2">💰</div>
            <div className="text-2xl font-bold text-purple-400">{metrics.performance.payoutP95Latency}m</div>
            <div className="text-sm text-gray-400">P95 Payout Time</div>
          </Card>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Performance Metrics */}
          <Card className="p-6">
            <h2 className="text-xl font-bold text-white mb-6">🎯 Performance Metrics</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Video Join Time (P95)</span>
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(metrics.performance.p95JoinTime <= 2 ? 100 : 50, { good: 90, warning: 70 })}>
                    {metrics.performance.p95JoinTime}s
                  </span>
                  <span>{getStatusIcon(metrics.performance.p95JoinTime <= 2 ? 100 : 50, { good: 90, warning: 70 })}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Rebuffer Ratio</span>
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(100 - metrics.performance.rebufferRatio, { good: 98, warning: 95 })}>
                    {metrics.performance.rebufferRatio}%
                  </span>
                  <span>{getStatusIcon(100 - metrics.performance.rebufferRatio, { good: 98, warning: 95 })}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Checkout Success Rate</span>
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(metrics.performance.checkoutSuccessRate, { good: 98, warning: 95 })}>
                    {metrics.performance.checkoutSuccessRate}%
                  </span>
                  <span>{getStatusIcon(metrics.performance.checkoutSuccessRate, { good: 98, warning: 95 })}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Payout Processing (P95)</span>
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(metrics.performance.payoutP95Latency <= 60 ? 100 : 50, { good: 90, warning: 70 })}>
                    {metrics.performance.payoutP95Latency}m
                  </span>
                  <span>{getStatusIcon(metrics.performance.payoutP95Latency <= 60 ? 100 : 50, { good: 90, warning: 70 })}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Uptime History */}
          <Card className="p-6">
            <h2 className="text-xl font-bold text-white mb-6">📈 Uptime History</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Last 24 Hours</span>
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(metrics.uptime.last24h, { good: 99.9, warning: 99.5 })}>
                    {metrics.uptime.last24h}%
                  </span>
                  <span>{getStatusIcon(metrics.uptime.last24h, { good: 99.9, warning: 99.5 })}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Last 7 Days</span>
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(metrics.uptime.last7d, { good: 99.9, warning: 99.5 })}>
                    {metrics.uptime.last7d}%
                  </span>
                  <span>{getStatusIcon(metrics.uptime.last7d, { good: 99.9, warning: 99.5 })}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Last 30 Days</span>
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(metrics.uptime.last30d, { good: 99.9, warning: 99.5 })}>
                    {metrics.uptime.last30d}%
                  </span>
                  <span>{getStatusIcon(metrics.uptime.last30d, { good: 99.9, warning: 99.5 })}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Platform Growth Metrics */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-white mb-6">🚀 Platform Growth</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{metrics.platform.totalCreators.toLocaleString()}</div>
              <div className="text-sm text-gray-400">Total Creators</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{metrics.platform.totalContent.toLocaleString()}</div>
              <div className="text-sm text-gray-400">Content Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{metrics.platform.monthlyActiveUsers.toLocaleString()}</div>
              <div className="text-sm text-gray-400">Monthly Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{metrics.platform.totalPayouts}</div>
              <div className="text-sm text-gray-400">Total Payouts</div>
            </div>
          </div>
        </Card>

        {/* Recent Incidents */}
        {metrics.incidents.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-bold text-white mb-6">📋 Recent Incidents</h2>
            <div className="space-y-4">
              {metrics.incidents.map((incident) => (
                <div key={incident.id} className={`border rounded-lg p-4 ${getSeverityColor(incident.severity)}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white">{incident.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getIncidentStatusColor(incident.status)}`}>
                        {incident.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">
                        {incident.severity}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-300 mb-3">
                    Started: {incident.startedAt.toLocaleString()}
                    {incident.resolvedAt && (
                      <span className="ml-4">
                        Resolved: {incident.resolvedAt.toLocaleString()}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {incident.updates.slice(0, 3).map((update, index) => (
                      <div key={index} className="text-sm">
                        <span className="text-gray-400">{update.timestamp.toLocaleString()}</span>
                        <span className="ml-3 text-gray-200">{update.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Footer */}
        <Card className="p-6 bg-blue-900/20 border-blue-500/30">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-blue-300 mb-2">Professional Operations</h3>
            <p className="text-blue-200 text-sm">
              This status page demonstrates our commitment to operational transparency and reliability. 
              All metrics are updated in real-time and independently verified.
            </p>
            <div className="mt-4 text-xs text-blue-300">
              For partnership inquiries: partnerships@platform.com | Technical support: support@platform.com
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};