import React, { useState, useEffect } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { AgencyConciergeChat } from './AgencyConciergeChat';

interface AgencyMetrics {
  revenue: {
    total: number;
    growth: number;
    byCategory: Record<string, number>;
  };
  creators: {
    total: number;
    active: number;
    topPerformers: Array<{
      id: string;
      name: string;
      revenue: number;
    }>;
  };
  content: {
    total: number;
    views: number;
    averageRating: number;
    topPerforming: Array<{
      id: string;
      title: string;
      views: number;
      revenue: number;
    }>;
  };
  engagement: {
    conversionRate: number;
    averageSessionDuration: number;
    returnVisitorRate: number;
  };
}

interface AgencyDashboardProps {
  agencyId: string;
}

export const AgencyDashboard: React.FC<AgencyDashboardProps> = ({ agencyId }) => {
  const [metrics, setMetrics] = useState<AgencyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const [conciergeData, setConciergeData] = useState<any>(null);

  useEffect(() => {
    loadMetrics();
  }, [agencyId, selectedTimeframe]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/agency-concierge/analytics/${agencyId}?timeframe=${selectedTimeframe}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setMetrics(data.data.data);
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConciergeData = (data: any) => {
    setConciergeData(data);
    // Optionally update metrics if the concierge provides new data
    if (data.revenue || data.creators || data.content) {
      setMetrics(prev => prev ? { ...prev, ...data } : null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading agency dashboard...</span>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <Icon name="alert-circle" size={48} className="text-gray-400 mb-4 mx-auto" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load metrics</h3>
        <p className="text-gray-600 mb-4">There was an error loading your agency dashboard</p>
        <Button onClick={loadMetrics}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agency Dashboard</h1>
          <p className="text-gray-600">Comprehensive overview of your agency performance</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <Button onClick={loadMetrics} size="sm">
            <Icon name="refresh-cw" size={16} className="mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Icon name="dollar-sign" size={24} className="text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.revenue.total)}</p>
              <p className={`text-sm ${metrics.revenue.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(metrics.revenue.growth)} from last period
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Icon name="users" size={24} className="text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Creators</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.creators.active}</p>
              <p className="text-sm text-gray-600">of {metrics.creators.total} total</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Icon name="video" size={24} className="text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Content</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.content.total)}</p>
              <p className="text-sm text-gray-600">{formatNumber(metrics.content.views)} views</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Icon name="trending-up" size={24} className="text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {(metrics.engagement.conversionRate * 100).toFixed(1)}%
              </p>
              <p className="text-sm text-gray-600">
                {(metrics.engagement.returnVisitorRate * 100).toFixed(0)}% return rate
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue by Category</h3>
          <div className="space-y-3">
            {Object.entries(metrics.revenue.byCategory).map(([category, amount]) => {
              const percentage = (amount / metrics.revenue.total) * 100;
              return (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                    <span className="text-sm font-medium capitalize">{category}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(amount)}</p>
                    <p className="text-xs text-gray-600">{percentage.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Top Performing Creators</h3>
          <div className="space-y-3">
            {metrics.creators.topPerformers.map((creator, index) => (
              <div key={creator.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                    <span className="text-xs font-semibold">{index + 1}</span>
                  </div>
                  <span className="text-sm font-medium">{creator.name}</span>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(creator.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Top Content */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Top Performing Content</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2">Title</th>
                <th className="text-right py-2">Views</th>
                <th className="text-right py-2">Revenue</th>
                <th className="text-right py-2">Performance</th>
              </tr>
            </thead>
            <tbody>
              {metrics.content.topPerforming.map((content) => (
                <tr key={content.id} className="border-b border-gray-100">
                  <td className="py-3 font-medium">{content.title}</td>
                  <td className="py-3 text-right">{formatNumber(content.views)}</td>
                  <td className="py-3 text-right">{formatCurrency(content.revenue)}</td>
                  <td className="py-3 text-right">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      High
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* AI Insights */}
      {conciergeData && (
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Icon name="cpu" size={20} className="mr-2 text-blue-600" />
            AI Insights from Concierge
          </h3>
          <div className="bg-white rounded-lg p-4">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap">
              {JSON.stringify(conciergeData, null, 2)}
            </pre>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" className="flex flex-col items-center p-4 h-auto">
            <Icon name="download" size={24} className="mb-2" />
            <span className="text-sm">Export Data</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center p-4 h-auto">
            <Icon name="file-text" size={24} className="mb-2" />
            <span className="text-sm">Generate Report</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center p-4 h-auto">
            <Icon name="user-plus" size={24} className="mb-2" />
            <span className="text-sm">Add Creator</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center p-4 h-auto">
            <Icon name="settings" size={24} className="mb-2" />
            <span className="text-sm">Settings</span>
          </Button>
        </div>
      </Card>

      {/* Agency Concierge Chat */}
      <AgencyConciergeChat
        agencyId={agencyId}
        onDataRequest={handleConciergeData}
      />
    </div>
  );
};