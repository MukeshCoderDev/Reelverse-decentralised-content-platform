import React, { useState, useEffect } from 'react';
import { AdvancedAnalyticsService, CreatorAnalytics, UserBehaviorMetrics, ABTestConfig, PredictiveModel } from '../../services/analytics/AdvancedAnalyticsService';

interface AnalyticsDashboardProps {
  analyticsService: AdvancedAnalyticsService;
  userId?: string;
  creatorId?: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  analyticsService,
  userId,
  creatorId
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'behavior' | 'creator' | 'experiments' | 'predictions'>('overview');
  const [creatorAnalytics, setCreatorAnalytics] = useState<CreatorAnalytics | null>(null);
  const [userMetrics, setUserMetrics] = useState<UserBehaviorMetrics | null>(null);
  const [abTests, setAbTests] = useState<ABTestConfig[]>([]);
  const [predictiveModels, setPredictiveModels] = useState<PredictiveModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalyticsData();
  }, [userId, creatorId]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      if (creatorId) {
        const analytics = await analyticsService.getCreatorAnalytics(creatorId);
        setCreatorAnalytics(analytics);
      }

      if (userId) {
        const metrics = await analyticsService.getUserBehaviorMetrics(userId);
        setUserMetrics(metrics);
      }

      // Load other data...
      setLoading(false);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return '📈';
    if (value < 0) return '📉';
    return '➡️';
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Advanced Analytics & Insights</h1>
        <p className="text-gray-600">Comprehensive analytics and predictive insights</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'behavior', label: 'User Behavior', icon: '👥' },
            { id: 'creator', label: 'Creator Insights', icon: '🎬' },
            { id: 'experiments', label: 'A/B Tests', icon: '🧪' },
            { id: 'predictions', label: 'Predictions', icon: '🔮' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatNumber(creatorAnalytics?.metrics.uniqueViewers || 0)}
                  </p>
                </div>
                <div className="text-2xl">👥</div>
              </div>
              <div className="mt-2 flex items-center text-sm">
                <span className={getTrendColor(5.2)}>
                  {getTrendIcon(5.2)} +5.2%
                </span>
                <span className="text-gray-600 ml-1">vs last month</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(creatorAnalytics?.metrics.revenue || 0)}
                  </p>
                </div>
                <div className="text-2xl">💰</div>
              </div>
              <div className="mt-2 flex items-center text-sm">
                <span className={getTrendColor(creatorAnalytics?.metrics.revenueGrowth || 0)}>
                  {getTrendIcon(creatorAnalytics?.metrics.revenueGrowth || 0)} 
                  {formatPercentage(creatorAnalytics?.metrics.revenueGrowth || 0)}
                </span>
                <span className="text-gray-600 ml-1">vs last month</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Engagement Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPercentage(creatorAnalytics?.metrics.engagement.engagementRate || 0)}
                  </p>
                </div>
                <div className="text-2xl">❤️</div>
              </div>
              <div className="mt-2 flex items-center text-sm">
                <span className="text-green-600">📈 +0.8%</span>
                <span className="text-gray-600 ml-1">vs last month</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Watch Time</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatNumber(creatorAnalytics?.metrics.watchTime || 0)}h
                  </p>
                </div>
                <div className="text-2xl">⏱️</div>
              </div>
              <div className="mt-2 flex items-center text-sm">
                <span className="text-green-600">📈 +12.3%</span>
                <span className="text-gray-600 ml-1">vs last month</span>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Views Trend</h3>
              <div className="h-64 flex items-end space-x-1">
                {creatorAnalytics?.trends.viewsTrend.slice(-30).map((value, index) => (
                  <div
                    key={index}
                    className="bg-blue-500 rounded-t"
                    style={{
                      height: `${(value / Math.max(...(creatorAnalytics?.trends.viewsTrend || [1]))) * 100}%`,
                      width: '8px'
                    }}
                  ></div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
              <div className="h-64 flex items-end space-x-1">
                {creatorAnalytics?.trends.revenueTrend.slice(-30).map((value, index) => (
                  <div
                    key={index}
                    className="bg-green-500 rounded-t"
                    style={{
                      height: `${(value / Math.max(...(creatorAnalytics?.trends.revenueTrend || [1]))) * 100}%`,
                      width: '8px'
                    }}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Behavior Tab */}
      {activeTab === 'behavior' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Behavior Metrics</h3>
            {userMetrics ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-600">Session Count</p>
                  <p className="text-2xl font-bold text-gray-900">{userMetrics.sessionCount}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Session Duration</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round(userMetrics.averageSessionDuration / 60)}m
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Engagement Score</p>
                  <p className="text-2xl font-bold text-gray-900">{userMetrics.engagementScore}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-600">No user behavior data available</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Journey Analysis</h3>
            <p className="text-gray-600">User journey tracking and funnel analysis would be displayed here</p>
          </div>
        </div>
      )}

      {/* Creator Insights Tab */}
      {activeTab === 'creator' && creatorAnalytics && (
        <div className="space-y-6">
          {/* Demographics */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Audience Demographics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Age Groups</h4>
                <div className="space-y-2">
                  {Object.entries(creatorAnalytics.metrics.demographics.ageGroups).map(([age, percentage]) => (
                    <div key={age} className="flex justify-between">
                      <span className="text-sm text-gray-600">{age}</span>
                      <span className="text-sm font-medium">{percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Gender</h4>
                <div className="space-y-2">
                  {Object.entries(creatorAnalytics.metrics.demographics.genders).map(([gender, percentage]) => (
                    <div key={gender} className="flex justify-between">
                      <span className="text-sm text-gray-600 capitalize">{gender}</span>
                      <span className="text-sm font-medium">{percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Top Countries</h4>
                <div className="space-y-2">
                  {Object.entries(creatorAnalytics.metrics.demographics.countries).map(([country, percentage]) => (
                    <div key={country} className="flex justify-between">
                      <span className="text-sm text-gray-600">{country}</span>
                      <span className="text-sm font-medium">{percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Devices</h4>
                <div className="space-y-2">
                  {Object.entries(creatorAnalytics.metrics.demographics.devices).map(([device, percentage]) => (
                    <div key={device} className="flex justify-between">
                      <span className="text-sm text-gray-600 capitalize">{device}</span>
                      <span className="text-sm font-medium">{percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Recommendations</h3>
            <div className="space-y-4">
              {creatorAnalytics.recommendations.map((rec, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{rec.title}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                      rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {rec.priority} priority
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                  <p className="text-sm font-medium text-blue-600 mb-1">{rec.action}</p>
                  <p className="text-xs text-gray-500">
                    {rec.expectedImpact} • {Math.round(rec.confidence * 100)}% confidence
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* A/B Tests Tab */}
      {activeTab === 'experiments' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">A/B Tests</h3>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create New Test
              </button>
            </div>
            
            {abTests.length === 0 ? (
              <p className="text-gray-600">No A/B tests configured yet</p>
            ) : (
              <div className="space-y-4">
                {abTests.map((test) => (
                  <div key={test.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{test.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        test.status === 'running' ? 'bg-green-100 text-green-800' :
                        test.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {test.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{test.description}</p>
                    <div className="text-xs text-gray-500">
                      {test.variants.length} variants • {test.trafficAllocation}% traffic
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Predictions Tab */}
      {activeTab === 'predictions' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Predictive Models</h3>
            {predictiveModels.length === 0 ? (
              <p className="text-gray-600">No predictive models available</p>
            ) : (
              <div className="space-y-4">
                {predictiveModels.map((model) => (
                  <div key={model.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{model.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        model.status === 'ready' ? 'bg-green-100 text-green-800' :
                        model.status === 'training' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {model.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Accuracy: {Math.round(model.accuracy * 100)}% • 
                      Type: {model.type} • 
                      Features: {model.features.length}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Predictions</h3>
            <p className="text-gray-600">Predictive insights and forecasts would be displayed here</p>
          </div>
        </div>
      )}
    </div>
  );
};