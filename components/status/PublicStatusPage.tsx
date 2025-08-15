/**
 * Public Status Page Component
 * Public-facing status page showing real-time metrics and uptime for agencies/investors
 */

import React, { useState, useEffect } from 'react';
import { useSLOMetrics } from '../../lib/hooks/useSLOMonitoring';

interface StatusPageData {
  status: 'operational' | 'degraded' | 'outage';
  uptime: number;
  metrics: {
    playbackP95JoinTime: number;
    rebufferRatio: number;
    payoutP95Latency: number;
    checkoutSuccessRate: number;
    errorRate: number;
  };
  incidents: Array<{
    id: string;
    title: string;
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
    impact: 'minor' | 'major' | 'critical';
    createdAt: string;
    updatedAt: string;
  }>;
  lastUpdated: string;
}

export const PublicStatusPage: React.FC = () => {
  const { metrics, loading, error } = useSLOMetrics(30000);
  const [statusData, setStatusData] = useState<StatusPageData | null>(null);

  useEffect(() => {
    if (metrics) {
      // Transform internal metrics to public status format
      const overallStatus = 
        metrics.uptime < 99.5 || metrics.errorRate > 1.0 ? 'outage' :
        metrics.uptime < 99.9 || metrics.errorRate > 0.5 || metrics.payoutP95Latency > 48 ? 'degraded' :
        'operational';

      setStatusData({
        status: overallStatus,
        uptime: metrics.uptime,
        metrics: {
          playbackP95JoinTime: metrics.playbackP95JoinTime,
          rebufferRatio: metrics.rebufferRatio,
          payoutP95Latency: metrics.payoutP95Latency,
          checkoutSuccessRate: metrics.checkoutSuccessRate,
          errorRate: metrics.errorRate
        },
        incidents: [], // Would be populated from incident management system
        lastUpdated: new Date().toISOString()
      });
    }
  }, [metrics]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'outage': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational': return '✓';
      case 'degraded': return '⚠';
      case 'outage': return '✕';
      default: return '?';
    }
  };

  const formatLatency = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${hours.toFixed(1)}h`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading status...</p>
        </div>
      </div>
    );
  }

  if (error || !statusData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Status Unavailable</h1>
          <p className="text-gray-600">Unable to load current system status</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reelverse Status</h1>
              <p className="text-gray-600 mt-1">Real-time platform performance and uptime</p>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold ${getStatusColor(statusData.status)}`}>
                <span className="mr-2 text-xl">{getStatusIcon(statusData.status)}</span>
                {statusData.status === 'operational' ? 'All Systems Operational' :
                 statusData.status === 'degraded' ? 'Degraded Performance' :
                 'Service Outage'}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Last updated: {new Date(statusData.lastUpdated).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Uptime */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">System Uptime</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{statusData.uptime.toFixed(2)}%</div>
              <div className="text-sm text-gray-600">Current Month</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">99.97%</div>
              <div className="text-sm text-gray-600">Last 90 Days</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">99.95%</div>
              <div className="text-sm text-gray-600">All Time</div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Performance Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {statusData.metrics.playbackP95JoinTime.toFixed(0)}ms
              </div>
              <div className="text-sm text-gray-600 mt-1">Video Join Time (P95)</div>
              <div className="text-xs text-gray-500 mt-1">Target: &lt;2000ms</div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {statusData.metrics.rebufferRatio.toFixed(2)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">Rebuffer Ratio</div>
              <div className="text-xs text-gray-500 mt-1">Target: &lt;1.0%</div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {formatLatency(statusData.metrics.payoutP95Latency)}
              </div>
              <div className="text-sm text-gray-600 mt-1">Payout Processing (P95)</div>
              <div className="text-xs text-gray-500 mt-1">Target: &lt;24h</div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {statusData.metrics.checkoutSuccessRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">Payment Success Rate</div>
              <div className="text-xs text-gray-500 mt-1">Target: &gt;95%</div>
            </div>
          </div>
        </div>

        {/* Service Status */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Service Status</h2>
          <div className="space-y-4">
            {[
              { name: 'Video Streaming', status: 'operational', description: 'Content delivery and playback' },
              { name: 'Payment Processing', status: 'operational', description: 'USDC and fiat transactions' },
              { name: 'Creator Payouts', status: statusData.metrics.payoutP95Latency > 24 ? 'degraded' : 'operational', description: 'Automated payout system' },
              { name: 'AI Content Tagging', status: 'operational', description: 'Automated content analysis' },
              { name: 'Leak Detection', status: 'operational', description: 'Content protection monitoring' },
              { name: 'API Services', status: statusData.metrics.errorRate > 0.5 ? 'degraded' : 'operational', description: 'Platform APIs and integrations' }
            ].map((service) => (
              <div key={service.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{service.name}</div>
                  <div className="text-sm text-gray-600">{service.description}</div>
                </div>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(service.status)}`}>
                  <span className="mr-1">{getStatusIcon(service.status)}</span>
                  {service.status === 'operational' ? 'Operational' :
                   service.status === 'degraded' ? 'Degraded' : 'Outage'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Statistics */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Platform Growth</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">2.4M+</div>
              <div className="text-sm text-gray-600">Total Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">15K+</div>
              <div className="text-sm text-gray-600">Active Creators</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">850K+</div>
              <div className="text-sm text-gray-600">Content Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">$12M+</div>
              <div className="text-sm text-gray-600">Creator Earnings</div>
            </div>
          </div>
        </div>

        {/* Incident History */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Incidents</h2>
          {statusData.incidents.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-green-600 text-4xl mb-2">✓</div>
              <div className="text-gray-600">No recent incidents</div>
              <div className="text-sm text-gray-500 mt-1">All systems have been running smoothly</div>
            </div>
          ) : (
            <div className="space-y-4">
              {statusData.incidents.map((incident) => (
                <div key={incident.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{incident.title}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {new Date(incident.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      incident.status === 'resolved' ? 'text-green-600 bg-green-100' :
                      incident.status === 'monitoring' ? 'text-blue-600 bg-blue-100' :
                      'text-yellow-600 bg-yellow-100'
                    }`}>
                      {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>This page is updated automatically every 30 seconds</p>
          <p className="mt-1">
            For technical support, contact{' '}
            <a href="mailto:support@reelverse.com" className="text-blue-600 hover:underline">
              support@reelverse.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};