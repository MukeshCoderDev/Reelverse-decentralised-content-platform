import React, { useState, useEffect } from 'react';
import { LiveStreamingOrchestrator } from '../../services/LiveStreamingOrchestrator';
import { LiveMetrics } from '../../services/analytics/LiveAnalyticsService';

interface StreamAnalyticsProps {
  metrics: LiveMetrics;
  performance: any;
  orchestrator: LiveStreamingOrchestrator;
}

export const StreamAnalytics: React.FC<StreamAnalyticsProps> = ({
  metrics,
  performance,
  orchestrator
}) => {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | 'all'>('1h');
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  useEffect(() => {
    const updateAnalytics = () => {
      const data = orchestrator.getAnalytics(timeRange);
      setAnalyticsData(data);
    };

    updateAnalytics();
    const interval = setInterval(updateAnalytics, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [orchestrator, timeRange]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="stream-analytics">
      {/* Time range selector */}
      <div className="analytics-header">
        <h3>Stream Analytics</h3>
        <div className="time-range-selector">
          {(['1h', '6h', '24h', 'all'] as const).map((range) => (
            <button
              key={range}
              className={`range-button ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range === 'all' ? 'All Time' : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Key metrics cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">👥</div>
          <div className="metric-content">
            <div className="metric-value">{formatNumber(metrics.currentViewers)}</div>
            <div className="metric-label">Current Viewers</div>
            <div className="metric-change positive">
              +{formatNumber(metrics.peakViewers - metrics.currentViewers)} peak
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⏱️</div>
          <div className="metric-content">
            <div className="metric-value">{formatDuration(metrics.averageWatchTime)}</div>
            <div className="metric-label">Avg Watch Time</div>
            <div className="metric-change positive">
              +12% vs last stream
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💬</div>
          <div className="metric-content">
            <div className="metric-value">{formatNumber(metrics.totalMessages)}</div>
            <div className="metric-label">Chat Messages</div>
            <div className="metric-change positive">
              {(metrics.totalMessages / metrics.currentViewers).toFixed(1)} per viewer
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <div className="metric-value">${metrics.revenue.toFixed(2)}</div>
            <div className="metric-label">Revenue</div>
            <div className="metric-change positive">
              +${(metrics.revenue * 0.15).toFixed(2)} vs last stream
            </div>
          </div>
        </div>
      </div>

      {/* Performance metrics */}
      <div className="performance-section">
        <h4>Stream Performance</h4>
        <div className="performance-grid">
          <div className="performance-item">
            <span className="performance-label">Stream Quality</span>
            <div className="performance-bar">
              <div 
                className="performance-fill good"
                style={{ width: `${performance.quality}%` }}
              />
            </div>
            <span className="performance-value">{performance.quality}%</span>
          </div>

          <div className="performance-item">
            <span className="performance-label">Connection Stability</span>
            <div className="performance-bar">
              <div 
                className="performance-fill excellent"
                style={{ width: `${performance.stability}%` }}
              />
            </div>
            <span className="performance-value">{performance.stability}%</span>
          </div>

          <div className="performance-item">
            <span className="performance-label">Latency</span>
            <span className="performance-value">{performance.latency}ms</span>
            <span className={`performance-status ${performance.latency < 100 ? 'good' : 'warning'}`}>
              {performance.latency < 100 ? 'Excellent' : 'Fair'}
            </span>
          </div>

          <div className="performance-item">
            <span className="performance-label">Bitrate</span>
            <span className="performance-value">{performance.bitrate} kbps</span>
            <span className="performance-status good">Stable</span>
          </div>
        </div>
      </div>

      {/* Viewer engagement chart */}
      <div className="engagement-section">
        <h4>Viewer Engagement</h4>
        <div className="engagement-chart">
          {analyticsData?.viewerHistory && (
            <ViewerChart data={analyticsData.viewerHistory} />
          )}
        </div>
      </div>

      {/* Chat activity */}
      <div className="chat-activity-section">
        <h4>Chat Activity</h4>
        <div className="chat-stats">
          <div className="chat-stat">
            <span className="stat-label">Messages per minute</span>
            <span className="stat-value">{(metrics.totalMessages / (performance.uptime / 60)).toFixed(1)}</span>
          </div>
          <div className="chat-stat">
            <span className="stat-label">Active chatters</span>
            <span className="stat-value">{Math.floor(metrics.currentViewers * 0.3)}</span>
          </div>
          <div className="chat-stat">
            <span className="stat-label">Super Chats</span>
            <span className="stat-value">{metrics.superChats}</span>
          </div>
        </div>
      </div>

      {/* Revenue breakdown */}
      <div className="revenue-section">
        <h4>Revenue Breakdown</h4>
        <div className="revenue-breakdown">
          <div className="revenue-item">
            <span className="revenue-source">Super Chat</span>
            <span className="revenue-amount">${(metrics.revenue * 0.6).toFixed(2)}</span>
            <span className="revenue-percentage">60%</span>
          </div>
          <div className="revenue-item">
            <span className="revenue-source">Donations</span>
            <span className="revenue-amount">${(metrics.revenue * 0.3).toFixed(2)}</span>
            <span className="revenue-percentage">30%</span>
          </div>
          <div className="revenue-item">
            <span className="revenue-source">New Subscribers</span>
            <span className="revenue-amount">${(metrics.revenue * 0.1).toFixed(2)}</span>
            <span className="revenue-percentage">10%</span>
          </div>
        </div>
      </div>

      {/* Top moments */}
      <div className="moments-section">
        <h4>Top Moments</h4>
        <div className="moments-list">
          <div className="moment-item">
            <span className="moment-time">1:23:45</span>
            <span className="moment-description">Peak viewers (1,234)</span>
            <span className="moment-metric">👥 +456</span>
          </div>
          <div className="moment-item">
            <span className="moment-time">0:45:12</span>
            <span className="moment-description">Highest Super Chat ($50)</span>
            <span className="moment-metric">💰 $50</span>
          </div>
          <div className="moment-item">
            <span className="moment-time">2:01:33</span>
            <span className="moment-description">Chat activity spike</span>
            <span className="moment-metric">💬 +89/min</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple viewer chart component
const ViewerChart: React.FC<{ data: Array<{ time: string; viewers: number }> }> = ({ data }) => {
  const maxViewers = Math.max(...data.map(d => d.viewers));
  
  return (
    <div className="viewer-chart">
      <div className="chart-container">
        {data.map((point, index) => (
          <div
            key={index}
            className="chart-bar"
            style={{
              height: `${(point.viewers / maxViewers) * 100}%`,
              left: `${(index / (data.length - 1)) * 100}%`
            }}
            title={`${point.time}: ${point.viewers} viewers`}
          />
        ))}
      </div>
      <div className="chart-labels">
        <span>0</span>
        <span>{formatNumber(maxViewers)}</span>
      </div>
    </div>
  );
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};