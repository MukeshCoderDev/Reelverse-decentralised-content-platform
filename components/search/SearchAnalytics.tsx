import React, { useState, useEffect } from 'react';
import Icon from '../Icon';
import Button from '../Button';
import Card from '../Card';

interface SearchMetrics {
  totalSearches: number;
  avgSearchTime: number;
  clickThroughRate: number;
  topQueries: Array<{
    query: string;
    count: number;
    ctr: number;
  }>;
  searchTypes: {
    semantic: number;
    hybrid: number;
    keyword: number;
  };
  aiPerformance: {
    avgConfidence: number;
    highConfidenceResults: number;
    userSatisfaction: number;
  };
}

interface SearchAnalyticsProps {
  className?: string;
  timeRange?: '24h' | '7d' | '30d' | '90d';
  onTimeRangeChange?: (range: string) => void;
}

const SearchAnalytics: React.FC<SearchAnalyticsProps> = ({
  className = "",
  timeRange = '7d',
  onTimeRangeChange,
}) => {
  const [metrics, setMetrics] = useState<SearchMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'searches' | 'ctr' | 'confidence'>('searches');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    
    try {
      // Mock analytics data - in real implementation, this would call the analytics API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      const mockMetrics: SearchMetrics = {
        totalSearches: 15420,
        avgSearchTime: 245,
        clickThroughRate: 0.68,
        topQueries: [
          { query: 'blonde woman bedroom', count: 1240, ctr: 0.72 },
          { query: 'romantic couple', count: 980, ctr: 0.65 },
          { query: 'sensual dance', count: 850, ctr: 0.71 },
          { query: 'intimate moments', count: 720, ctr: 0.63 },
          { query: 'lingerie fashion', count: 650, ctr: 0.69 },
        ],
        searchTypes: {
          semantic: 45,
          hybrid: 40,
          keyword: 15,
        },
        aiPerformance: {
          avgConfidence: 0.84,
          highConfidenceResults: 78,
          userSatisfaction: 0.76,
        },
      };
      
      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Failed to fetch search analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case '24h': return 'Last 24 Hours';
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      case '90d': return 'Last 90 Days';
      default: return 'Last 7 Days';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.7) return 'text-blue-500';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-500';
  };

  const getCTRColor = (ctr: number) => {
    if (ctr >= 0.7) return 'text-green-500';
    if (ctr >= 0.6) return 'text-blue-500';
    if (ctr >= 0.5) return 'text-yellow-600';
    return 'text-red-500';
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <h3 className="text-lg font-semibold">Loading search analytics...</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="p-6 animate-pulse">
              <div className="h-8 bg-secondary rounded mb-4" />
              <div className="h-12 bg-secondary rounded" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Icon name="alert-circle" size={48} className="text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Unable to load analytics</h3>
        <Button onClick={fetchAnalytics} variant="outline">
          <Icon name="refresh-cw" size={16} className="mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Icon name="bar-chart" size={20} className="text-primary" />
            Search Analytics
          </h3>
          <p className="text-sm text-muted-foreground">
            AI-powered search performance insights
          </p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Period:</span>
          <select
            value={timeRange}
            onChange={(e) => onTimeRangeChange?.(e.target.value)}
            className="px-3 py-1 bg-secondary border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary/20"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Searches</p>
              <p className="text-2xl font-bold">{formatNumber(metrics.totalSearches)}</p>
            </div>
            <Icon name="search" size={24} className="text-primary" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Search Time</p>
              <p className="text-2xl font-bold">{metrics.avgSearchTime}ms</p>
            </div>
            <Icon name="clock" size={24} className="text-blue-500" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Click-Through Rate</p>
              <p className={`text-2xl font-bold ${getCTRColor(metrics.clickThroughRate)}`}>
                {formatPercentage(metrics.clickThroughRate)}
              </p>
            </div>
            <Icon name="mouse-pointer" size={24} className="text-green-500" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">AI Confidence</p>
              <p className={`text-2xl font-bold ${getConfidenceColor(metrics.aiPerformance.avgConfidence)}`}>
                {formatPercentage(metrics.aiPerformance.avgConfidence)}
              </p>
            </div>
            <Icon name="brain" size={24} className="text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Search Type Distribution */}
      <Card className="p-6">
        <h4 className="text-lg font-semibold mb-4">Search Type Usage</h4>
        <div className="space-y-4">
          {Object.entries(metrics.searchTypes).map(([type, percentage]) => (
            <div key={type} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon 
                  name={type === 'semantic' ? 'brain' : type === 'hybrid' ? 'zap' : 'search'} 
                  size={16} 
                  className="text-primary" 
                />
                <span className="capitalize font-medium">{type} Search</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Top Queries */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold">Top Search Queries</h4>
          <div className="flex items-center gap-2">
            <Button
              variant={selectedMetric === 'searches' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedMetric('searches')}
            >
              Volume
            </Button>
            <Button
              variant={selectedMetric === 'ctr' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedMetric('ctr')}
            >
              CTR
            </Button>
          </div>
        </div>
        
        <div className="space-y-3">
          {metrics.topQueries.map((query, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-6">#{index + 1}</span>
                <span className="font-medium">{query.query}</span>
              </div>
              
              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <div className="font-medium">{formatNumber(query.count)} searches</div>
                  <div className={`text-xs ${getCTRColor(query.ctr)}`}>
                    {formatPercentage(query.ctr)} CTR
                  </div>
                </div>
                
                <div className="w-16 bg-background rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      selectedMetric === 'ctr' ? 'bg-green-500' : 'bg-primary'
                    }`}
                    style={{ 
                      width: selectedMetric === 'ctr' 
                        ? `${query.ctr * 100}%` 
                        : `${(query.count / metrics.topQueries[0].count) * 100}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* AI Performance Metrics */}
      <Card className="p-6">
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Icon name="brain" size={20} className="text-primary" />
          AI Performance
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className={`text-3xl font-bold mb-2 ${getConfidenceColor(metrics.aiPerformance.avgConfidence)}`}>
              {formatPercentage(metrics.aiPerformance.avgConfidence)}
            </div>
            <div className="text-sm text-muted-foreground">Average Confidence</div>
            <div className="text-xs text-muted-foreground mt-1">
              Across all AI-powered searches
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold mb-2 text-green-500">
              {metrics.aiPerformance.highConfidenceResults}%
            </div>
            <div className="text-sm text-muted-foreground">High Confidence</div>
            <div className="text-xs text-muted-foreground mt-1">
              Results with >80% confidence
            </div>
          </div>
          
          <div className="text-center">
            <div className={`text-3xl font-bold mb-2 ${getCTRColor(metrics.aiPerformance.userSatisfaction)}`}>
              {formatPercentage(metrics.aiPerformance.userSatisfaction)}
            </div>
            <div className="text-sm text-muted-foreground">User Satisfaction</div>
            <div className="text-xs text-muted-foreground mt-1">
              Based on engagement metrics
            </div>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" onClick={fetchAnalytics}>
          <Icon name="refresh-cw" size={16} className="mr-2" />
          Refresh Data
        </Button>
        
        <Button variant="outline">
          <Icon name="download" size={16} className="mr-2" />
          Export Report
        </Button>
      </div>
    </div>
  );
};

export default SearchAnalytics;