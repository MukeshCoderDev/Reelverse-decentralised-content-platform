import React, { useState, useEffect } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { MetricsService, PublicScoreboard as ScoreboardData, TrendingData } from '../../services/metricsService';

interface PublicScoreboardProps {
  embedded?: boolean;
}

export const PublicScoreboard: React.FC<PublicScoreboardProps> = ({
  embedded = false
}) => {
  const [scoreboardData, setScoreboardData] = useState<ScoreboardData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d' | '30d' | '90d'>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const metricsService = MetricsService.getInstance();

  useEffect(() => {
    loadScoreboardData();
    
    // Set up real-time updates
    const unsubscribe = metricsService.subscribeToMetrics((metrics) => {
      setScoreboardData(prev => prev ? { ...prev, platformMetrics: metrics } : null);
      setLastUpdated(new Date().toLocaleTimeString());
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (scoreboardData) {
      loadTrendingData();
    }
  }, [selectedPeriod]);

  const loadScoreboardData = async () => {
    try {
      setIsLoading(true);
      const data = await metricsService.getPublicScoreboard();
      setScoreboardData(data);
      setLastUpdated(new Date(data.lastUpdated).toLocaleTimeString());
    } catch (error) {
      console.error('Error loading scoreboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrendingData = async () => {
    if (!scoreboardData) return;
    
    try {
      const trendingData = await metricsService.getTrendingData(selectedPeriod);
      setScoreboardData(prev => prev ? { ...prev, trendingData } : null);
    } catch (error) {
      console.error('Error loading trending data:', error);
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
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'text-green-400 bg-green-500/20';
      case 'degraded':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'partial_outage':
        return 'text-orange-400 bg-orange-500/20';
      case 'major_outage':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getIndicatorColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-400';
      case 'good':
        return 'text-blue-400';
      case 'fair':
        return 'text-yellow-400';
      case 'poor':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className=\"text-center py-8\">
        <div className=\"animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4\"></div>
        <p className=\"text-gray-400\">Loading platform metrics...</p>
      </div>
    );
  }

  if (!scoreboardData) {
    return (
      <div className=\"text-center py-8\">
        <Icon name=\"alert-triangle\" className=\"w-12 h-12 text-red-400 mx-auto mb-4\" />
        <p className=\"text-gray-400\">Failed to load platform metrics</p>
        <Button onClick={loadScoreboardData} className=\"mt-4\">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${embedded ? '' : 'container mx-auto px-4 py-8'}`}>
      {/* Header */}
      {!embedded && (
        <div className=\"text-center mb-8\">
          <h1 className=\"text-3xl font-bold text-white mb-2\">Platform Scoreboard</h1>
          <p className=\"text-gray-400 mb-4\">
            Real-time transparency into our platform's performance and health
          </p>
          <div className=\"flex items-center justify-center space-x-4 text-sm text-gray-500\">
            <span>Last updated: {lastUpdated}</span>
            <span>•</span>
            <span>Updates every 30 seconds</span>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className=\"grid grid-cols-2 md:grid-cols-4 gap-4\">
        <Card className=\"p-4 text-center\">
          <div className=\"text-2xl font-bold text-white mb-1\">
            {formatNumber(scoreboardData.platformMetrics.totalCreators)}
          </div>
          <div className=\"text-gray-400 text-sm\">Total Creators</div>
          <div className=\"text-green-400 text-xs mt-1\">
            {formatNumber(scoreboardData.platformMetrics.activeCreators)} active
          </div>
        </Card>

        <Card className=\"p-4 text-center\">
          <div className=\"text-2xl font-bold text-white mb-1\">
            {formatNumber(scoreboardData.platformMetrics.totalContent)}
          </div>
          <div className=\"text-gray-400 text-sm\">Content Items</div>
          <div className=\"text-blue-400 text-xs mt-1\">
            {scoreboardData.platformMetrics.verifiedCreators / scoreboardData.platformMetrics.totalCreators * 100}% verified
          </div>
        </Card>

        <Card className=\"p-4 text-center\">
          <div className=\"text-2xl font-bold text-white mb-1\">
            {formatNumber(scoreboardData.platformMetrics.totalViews)}
          </div>
          <div className=\"text-gray-400 text-sm\">Total Views</div>
          <div className=\"text-purple-400 text-xs mt-1\">
            {scoreboardData.performanceMetrics.playbackMetrics.successRate}% success rate
          </div>
        </Card>

        <Card className=\"p-4 text-center\">
          <div className=\"text-2xl font-bold text-white mb-1\">
            {formatCurrency(scoreboardData.platformMetrics.totalEarnings)}
          </div>
          <div className=\"text-gray-400 text-sm\">Creator Earnings</div>
          <div className=\"text-green-400 text-xs mt-1\">
            {formatCurrency(scoreboardData.platformMetrics.averageEarningsPerCreator)} avg
          </div>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
        <Card className=\"p-6\">
          <h2 className=\"text-xl font-semibold text-white mb-4\">Upload Performance</h2>
          <div className=\"space-y-4\">
            <div className=\"flex items-center justify-between\">
              <span className=\"text-gray-400\">Success Rate</span>
              <span className=\"text-green-400 font-semibold\">
                {scoreboardData.performanceMetrics.uploadMetrics.successRate}%
              </span>
            </div>
            <div className=\"flex items-center justify-between\">
              <span className=\"text-gray-400\">Average Time</span>
              <span className=\"text-white\">
                {scoreboardData.performanceMetrics.uploadMetrics.averageUploadTime}s
              </span>
            </div>
            <div className=\"flex items-center justify-between\">
              <span className=\"text-gray-400\">P95 Time</span>
              <span className=\"text-white\">
                {scoreboardData.performanceMetrics.uploadMetrics.p95UploadTime}s
              </span>
            </div>
          </div>
        </Card>

        <Card className=\"p-6\">
          <h2 className=\"text-xl font-semibold text-white mb-4\">Playback Performance</h2>
          <div className=\"space-y-4\">
            <div className=\"flex items-center justify-between\">
              <span className=\"text-gray-400\">Success Rate</span>
              <span className=\"text-green-400 font-semibold\">
                {scoreboardData.performanceMetrics.playbackMetrics.successRate}%
              </span>
            </div>
            <div className=\"flex items-center justify-between\">
              <span className=\"text-gray-400\">Start Time</span>
              <span className=\"text-white\">
                {scoreboardData.performanceMetrics.playbackMetrics.averageStartTime}s
              </span>
            </div>
            <div className=\"flex items-center justify-between\">
              <span className=\"text-gray-400\">Buffering Rate</span>
              <span className=\"text-white\">
                {scoreboardData.performanceMetrics.playbackMetrics.bufferingRate}%
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* System Status */}
      <Card className=\"p-6\">
        <div className=\"flex items-center justify-between mb-4\">
          <h2 className=\"text-xl font-semibold text-white\">System Status</h2>
          <div className=\"text-sm text-gray-400\">
            Overall Uptime: {scoreboardData.performanceMetrics.systemMetrics.uptime}%
          </div>
        </div>
        <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4\">
          {scoreboardData.serviceStatus.map((service) => (
            <div key={service.service} className=\"flex items-center justify-between p-3 bg-gray-800/50 rounded-lg\">
              <div>
                <h3 className=\"font-medium text-white\">{service.service}</h3>
                <p className=\"text-gray-400 text-sm\">{service.uptime}% uptime</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${getStatusColor(service.status)}`}>
                {service.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Credibility Indicators */}
      <Card className=\"p-6\">
        <div className=\"flex items-center justify-between mb-4\">
          <h2 className=\"text-xl font-semibold text-white\">Trust & Credibility</h2>
          <div className=\"text-2xl font-bold text-green-400\">
            {scoreboardData.credibilityIndicators.trustScore}/100
          </div>
        </div>
        
        <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6\">
          <div className=\"text-center\">
            <div className=\"text-xl font-bold text-blue-400\">
              {scoreboardData.credibilityIndicators.verificationRate}%
            </div>
            <div className=\"text-gray-400 text-sm\">Verification Rate</div>
          </div>
          <div className=\"text-center\">
            <div className=\"text-xl font-bold text-green-400\">
              {scoreboardData.credibilityIndicators.complianceScore}%
            </div>
            <div className=\"text-gray-400 text-sm\">Compliance Score</div>
          </div>
          <div className=\"text-center\">
            <div className=\"text-xl font-bold text-purple-400\">
              {scoreboardData.credibilityIndicators.transparencyScore}%
            </div>
            <div className=\"text-gray-400 text-sm\">Transparency</div>
          </div>
          <div className=\"text-center\">
            <div className=\"text-xl font-bold text-yellow-400\">
              {scoreboardData.credibilityIndicators.communityRating}/5
            </div>
            <div className=\"text-gray-400 text-sm\">Community Rating</div>
          </div>
        </div>

        <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">
          {scoreboardData.credibilityIndicators.indicators.map((indicator, index) => (
            <div key={index} className=\"flex items-center justify-between p-3 bg-gray-800/50 rounded-lg\">
              <div className=\"flex-1\">
                <h4 className=\"font-medium text-white\">{indicator.name}</h4>
                <p className=\"text-gray-400 text-sm\">{indicator.description}</p>
              </div>
              <div className=\"text-right ml-4\">
                <div className={`text-lg font-bold ${getIndicatorColor(indicator.status)}`}>
                  {indicator.value}%
                </div>
                <div className={`text-xs ${getIndicatorColor(indicator.status)}`}>
                  {indicator.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Trending Data */}
      <Card className=\"p-6\">
        <div className=\"flex items-center justify-between mb-4\">
          <h2 className=\"text-xl font-semibold text-white\">Platform Growth</h2>
          <div className=\"flex space-x-2\">
            {(['24h', '7d', '30d', '90d'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 rounded text-sm ${
                  selectedPeriod === period
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className=\"grid grid-cols-2 md:grid-cols-4 gap-4\">
          <div className=\"text-center\">
            <div className=\"text-lg font-bold text-white\">
              +{formatNumber(scoreboardData.trendingData.metrics[scoreboardData.trendingData.metrics.length - 1]?.creators - scoreboardData.trendingData.metrics[0]?.creators || 0)}
            </div>
            <div className=\"text-gray-400 text-sm\">New Creators</div>
          </div>
          <div className=\"text-center\">
            <div className=\"text-lg font-bold text-white\">
              +{formatNumber(scoreboardData.trendingData.metrics[scoreboardData.trendingData.metrics.length - 1]?.content - scoreboardData.trendingData.metrics[0]?.content || 0)}
            </div>
            <div className=\"text-gray-400 text-sm\">New Content</div>
          </div>
          <div className=\"text-center\">
            <div className=\"text-lg font-bold text-white\">
              +{formatNumber(scoreboardData.trendingData.metrics[scoreboardData.trendingData.metrics.length - 1]?.views - scoreboardData.trendingData.metrics[0]?.views || 0)}
            </div>
            <div className=\"text-gray-400 text-sm\">New Views</div>
          </div>
          <div className=\"text-center\">
            <div className=\"text-lg font-bold text-white\">
              {scoreboardData.trendingData.metrics.reduce((avg, m) => avg + m.uptime, 0) / scoreboardData.trendingData.metrics.length}%
            </div>
            <div className=\"text-gray-400 text-sm\">Avg Uptime</div>
          </div>
        </div>
      </Card>

      {/* Export Options */}
      {!embedded && (
        <Card className=\"p-6\">
          <h2 className=\"text-xl font-semibold text-white mb-4\">Export Data</h2>
          <div className=\"flex flex-wrap gap-4\">
            <Button variant=\"secondary\">
              <Icon name=\"download\" className=\"w-4 h-4 mr-2\" />
              Download JSON
            </Button>
            <Button variant=\"secondary\">
              <Icon name=\"file-text\" className=\"w-4 h-4 mr-2\" />
              Export CSV
            </Button>
            <Button variant=\"secondary\">
              <Icon name=\"printer\" className=\"w-4 h-4 mr-2\" />
              Generate PDF
            </Button>
            <Button variant=\"secondary\">
              <Icon name=\"share\" className=\"w-4 h-4 mr-2\" />
              Share Link
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};