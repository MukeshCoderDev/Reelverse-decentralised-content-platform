import React, { useState, useEffect } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';

interface AIAnalyticsSummary {
  totalAssetsGenerated: number;
  averageCTRImprovement: number;
  totalRevenueLift: number;
  topPerformingAssetType: string;
}

interface AssetPerformance {
  generated: number;
  averageCTR: number;
  bestPerforming: {
    title?: string;
    style?: string;
    platform?: string;
    ctr?: number;
    engagement?: number;
    improvement: number;
  };
}

interface CalendarOptimization {
  recommendationsFollowed: number;
  averageUplift: number;
  bestTimeSlot: string;
  bestDay: string;
}

interface AIToolkitAnalyticsProps {
  creatorId: string;
  timeframe?: '7d' | '30d' | '90d';
}

export const AIToolkitAnalytics: React.FC<AIToolkitAnalyticsProps> = ({
  creatorId,
  timeframe = '30d'
}) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AIAnalyticsSummary | null>(null);
  const [titlePerformance, setTitlePerformance] = useState<AssetPerformance | null>(null);
  const [thumbnailPerformance, setThumbnailPerformance] = useState<AssetPerformance | null>(null);
  const [captionPerformance, setCaptionPerformance] = useState<AssetPerformance | null>(null);
  const [calendarOptimization, setCalendarOptimization] = useState<CalendarOptimization | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [creatorId, timeframe]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/creator-ai/analytics/${creatorId}?timeframe=${timeframe}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setSummary(data.data.summary);
        setTitlePerformance(data.data.titlePerformance);
        setThumbnailPerformance(data.data.thumbnailPerformance);
        setCaptionPerformance(data.data.captionPerformance);
        setCalendarOptimization(data.data.calendarOptimization);
      }
    } catch (error) {
      console.error('Error fetching AI analytics:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Toolkit Analytics</h2>
          <p className="text-gray-600">Performance insights for AI-generated content assets</p>
        </div>
        <div className="flex items-center space-x-3">
          <select 
            value={timeframe}
            onChange={(e) => window.location.search = `?timeframe=${e.target.value}`}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <Button onClick={fetchAnalytics} size="sm">Refresh</Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-2xl">🎯</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Assets Generated</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalAssetsGenerated}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-2xl">📈</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg CTR Improvement</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatPercentage(summary.averageCTRImprovement)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <span className="text-2xl">💰</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Revenue Lift</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(summary.totalRevenueLift)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <span className="text-2xl">🏆</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Top Performer</p>
                <p className="text-2xl font-bold text-orange-600 capitalize">
                  {summary.topPerformingAssetType}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Performance Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Title Performance */}
        {titlePerformance && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">📝</span>
              Title Performance
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Generated</span>
                <span className="font-semibold">{titlePerformance.generated}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Average CTR</span>
                <span className="font-semibold">{(titlePerformance.averageCTR * 100).toFixed(2)}%</span>
              </div>
              {titlePerformance.bestPerforming && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900 mb-1">Best Performing Title</p>
                  <p className="text-sm text-gray-600 mb-2">"{titlePerformance.bestPerforming.title}"</p>
                  <div className="flex justify-between text-sm">
                    <span>CTR: {titlePerformance.bestPerforming.ctr && (titlePerformance.bestPerforming.ctr * 100).toFixed(2)}%</span>
                    <span className="text-green-600">
                      {formatPercentage(titlePerformance.bestPerforming.improvement)} improvement
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Thumbnail Performance */}
        {thumbnailPerformance && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">🖼️</span>
              Thumbnail Performance
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Generated</span>
                <span className="font-semibold">{thumbnailPerformance.generated}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Average CTR</span>
                <span className="font-semibold">{(thumbnailPerformance.averageCTR * 100).toFixed(2)}%</span>
              </div>
              {thumbnailPerformance.bestPerforming && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900 mb-1">Best Performing Style</p>
                  <p className="text-sm text-gray-600 mb-2 capitalize">
                    {thumbnailPerformance.bestPerforming.style?.replace('_', ' ')}
                  </p>
                  <div className="flex justify-between text-sm">
                    <span>CTR: {thumbnailPerformance.bestPerforming.ctr && (thumbnailPerformance.bestPerforming.ctr * 100).toFixed(2)}%</span>
                    <span className="text-green-600">
                      {formatPercentage(thumbnailPerformance.bestPerforming.improvement)} improvement
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Caption Performance */}
        {captionPerformance && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">💬</span>
              Caption Performance
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Generated</span>
                <span className="font-semibold">{captionPerformance.generated}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Avg Engagement</span>
                <span className="font-semibold">{captionPerformance.averageCTR.toFixed(1)}</span>
              </div>
              {captionPerformance.bestPerforming && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900 mb-1">Best Performing Platform</p>
                  <p className="text-sm text-gray-600 mb-2 capitalize">
                    {captionPerformance.bestPerforming.platform}
                  </p>
                  <div className="flex justify-between text-sm">
                    <span>Engagement: {captionPerformance.bestPerforming.engagement}</span>
                    <span className="text-green-600">
                      {formatPercentage(captionPerformance.bestPerforming.improvement)} improvement
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Calendar Optimization */}
        {calendarOptimization && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">📅</span>
              Calendar Optimization
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Recommendations Followed</span>
                <span className="font-semibold">{calendarOptimization.recommendationsFollowed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Average Uplift</span>
                <span className="font-semibold text-green-600">
                  {formatPercentage(calendarOptimization.averageUplift)}
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">Best Time Slot</p>
                    <p className="text-gray-600">{calendarOptimization.bestTimeSlot}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Best Day</p>
                    <p className="text-gray-600">{calendarOptimization.bestDay}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Insights and Recommendations */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">💡</span>
          AI Insights & Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Top Recommendation</h4>
            <p className="text-blue-800 text-sm">
              Your thumbnail variations are performing 45% better than manual selections. 
              Consider using AI-generated thumbnails for all new content.
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">Optimization Opportunity</h4>
            <p className="text-green-800 text-sm">
              Following calendar recommendations has increased your revenue by 19% on average. 
              Try posting more content during your optimal time slots.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};