import React, { useState, useEffect } from 'react';
import { InteractiveChart } from './InteractiveChart';

interface AnalyticsData {
  timestamp: string;
  viewers: number;
  engagement: number;
  chatActivity: number;
  subscriptions: number;
  revenue: number;
}

interface AnalyticsChartProps {
  data: AnalyticsData[];
  isLive?: boolean;
  onMetricSelect?: (metric: string) => void;
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  data,
  isLive = false,
  onMetricSelect
}) => {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['viewers', 'engagement']);
  const [chartType, setChartType] = useState<'line' | 'area'>('line');
  const [timeWindow, setTimeWindow] = useState<'5m' | '15m' | '1h' | '6h'>('15m');

  // Filter data based on time window for live streams
  const filteredData = isLive ? 
    data.filter(item => {
      const now = new Date();
      const itemTime = new Date(item.timestamp);
      const windowMs = getTimeWindowMs(timeWindow);
      return (now.getTime() - itemTime.getTime()) <= windowMs;
    }) : data;

  const metrics = [
    { key: 'viewers', label: 'Viewers', color: '#0066cc', icon: '👥' },
    { key: 'engagement', label: 'Engagement', color: '#4ade80', icon: '❤️' },
    { key: 'chatActivity', label: 'Chat Activity', color: '#f59e0b', icon: '💬' },
    { key: 'subscriptions', label: 'New Subs', color: '#8b5cf6', icon: '⭐' },
    { key: 'revenue', label: 'Revenue', color: '#ef4444', icon: '💰' }
  ];

  const toggleMetric = (metricKey: string) => {
    setSelectedMetrics(prev => {
      const newMetrics = prev.includes(metricKey)
        ? prev.filter(m => m !== metricKey)
        : [...prev, metricKey];
      
      onMetricSelect?.(metricKey);
      return newMetrics;
    });
  };

  const getChartData = (metricKey: string) => {
    return filteredData.map((item, index) => ({
      x: index,
      y: item[metricKey as keyof AnalyticsData] as number,
      label: formatTimestamp(item.timestamp),
      color: metrics.find(m => m.key === metricKey)?.color || '#0066cc'
    }));
  };

  const getCurrentStats = () => {
    if (filteredData.length === 0) return null;
    
    const latest = filteredData[filteredData.length - 1];
    const previous = filteredData.length > 1 ? filteredData[filteredData.length - 2] : latest;
    
    return {
      viewers: {
        current: latest.viewers,
        change: latest.viewers - previous.viewers,
        peak: Math.max(...filteredData.map(d => d.viewers))
      },
      engagement: {
        current: latest.engagement,
        change: latest.engagement - previous.engagement,
        average: filteredData.reduce((sum, d) => sum + d.engagement, 0) / filteredData.length
      },
      revenue: {
        current: latest.revenue,
        total: filteredData.reduce((sum, d) => sum + d.revenue, 0),
        change: latest.revenue - previous.revenue
      }
    };
  };

  const stats = getCurrentStats();

  function getTimeWindowMs(window: string): number {
    const windows = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000
    };
    return windows[window as keyof typeof windows] || windows['15m'];
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return isLive ? 
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
      date.toLocaleDateString();
  }

  function formatChange(change: number): string {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(0)}`;
  }

  return (
    <div className="analytics-chart">
      {/* Header with live indicator and stats */}
      <div className="analytics-header">
        <div className="header-left">
          <h3>
            {isLive && <span className="live-indicator">🔴 LIVE</span>}
            Stream Analytics
          </h3>
          
          {stats && (
            <div className="current-stats">
              <div className="stat-item">
                <span className="stat-icon">👥</span>
                <span className="stat-value">{stats.viewers.current.toLocaleString()}</span>
                <span className={`stat-change ${stats.viewers.change >= 0 ? 'positive' : 'negative'}`}>
                  {formatChange(stats.viewers.change)}
                </span>
              </div>
              
              <div className="stat-item">
                <span className="stat-icon">❤️</span>
                <span className="stat-value">{stats.engagement.current.toFixed(1)}</span>
                <span className={`stat-change ${stats.engagement.change >= 0 ? 'positive' : 'negative'}`}>
                  {formatChange(stats.engagement.change)}
                </span>
              </div>
              
              <div className="stat-item">
                <span className="stat-icon">💰</span>
                <span className="stat-value">${stats.revenue.total.toFixed(0)}</span>
                <span className={`stat-change ${stats.revenue.change >= 0 ? 'positive' : 'negative'}`}>
                  {formatChange(stats.revenue.change)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="header-controls">
          {/* Time window selector for live streams */}
          {isLive && (
            <div className="time-window-selector">
              {(['5m', '15m', '1h', '6h'] as const).map((window) => (
                <button
                  key={window}
                  className={`window-button ${timeWindow === window ? 'active' : ''}`}
                  onClick={() => setTimeWindow(window)}
                >
                  {window}
                </button>
              ))}
            </div>
          )}

          {/* Chart type selector */}
          <div className="chart-type-selector">
            <button
              className={`type-button ${chartType === 'line' ? 'active' : ''}`}
              onClick={() => setChartType('line')}
              title="Line Chart"
            >
              📈
            </button>
            <button
              className={`type-button ${chartType === 'area' ? 'active' : ''}`}
              onClick={() => setChartType('area')}
              title="Area Chart"
            >
              📉
            </button>
          </div>
        </div>
      </div>

      {/* Metric selector */}
      <div className="metric-selector">
        {metrics.map((metric) => (
          <button
            key={metric.key}
            className={`metric-toggle ${selectedMetrics.includes(metric.key) ? 'active' : ''}`}
            onClick={() => toggleMetric(metric.key)}
            style={{ 
              borderColor: selectedMetrics.includes(metric.key) ? metric.color : '#333',
              backgroundColor: selectedMetrics.includes(metric.key) ? `${metric.color}20` : 'transparent'
            }}
          >
            <span className="metric-icon">{metric.icon}</span>
            <span className="metric-label">{metric.label}</span>
            <div 
              className="metric-indicator"
              style={{ backgroundColor: metric.color }}
            />
          </button>
        ))}
      </div>

      {/* Multi-line chart */}
      <div className="multi-chart">
        <div className="chart-container">
          <svg width="800" height="400" className="multi-line-chart">
            <defs>
              {selectedMetrics.map((metricKey) => {
                const color = metrics.find(m => m.key === metricKey)?.color || '#0066cc';
                return (
                  <linearGradient key={metricKey} id={`gradient-${metricKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.1} />
                  </linearGradient>
                );
              })}
            </defs>
            
            <g transform="translate(60, 20)">
              {/* Render each selected metric */}
              {selectedMetrics.map((metricKey, index) => {
                const chartData = getChartData(metricKey);
                const color = metrics.find(m => m.key === metricKey)?.color || '#0066cc';
                
                if (chartData.length === 0) return null;
                
                const maxY = Math.max(...chartData.map(d => d.y));
                const minY = Math.min(...chartData.map(d => d.y), 0);
                const yRange = maxY - minY || 1;
                
                const scaleY = (value: number) => {
                  return 340 - ((value - minY) / yRange) * 340;
                };
                
                const scaleX = (index: number) => {
                  return (index / (chartData.length - 1)) * 680;
                };
                
                const pathData = chartData.map((point, i) => {
                  const x = scaleX(i);
                  const y = scaleY(point.y);
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ');
                
                return (
                  <g key={metricKey}>
                    {chartType === 'area' && (
                      <path
                        d={`${pathData} L ${scaleX(chartData.length - 1)} 340 L 0 340 Z`}
                        fill={`url(#gradient-${metricKey})`}
                      />
                    )}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray={index > 0 ? '5,5' : 'none'}
                    />
                    {chartData.map((point, i) => (
                      <circle
                        key={i}
                        cx={scaleX(i)}
                        cy={scaleY(point.y)}
                        r={3}
                        fill={color}
                        stroke="#fff"
                        strokeWidth={1}
                      />
                    ))}
                  </g>
                );
              })}
              
              {/* Axes */}
              <line x1={0} y1={0} x2={0} y2={340} stroke="#333" strokeWidth={1} />
              <line x1={0} y1={340} x2={680} y2={340} stroke="#333" strokeWidth={1} />
            </g>
          </svg>
        </div>
      </div>

      {/* Performance insights */}
      <div className="performance-insights">
        <h4>Performance Insights</h4>
        <div className="insights-grid">
          <div className="insight-card">
            <div className="insight-header">
              <span className="insight-icon">🎯</span>
              <span className="insight-title">Peak Performance</span>
            </div>
            <div className="insight-content">
              {stats && (
                <>
                  <div className="insight-metric">
                    <span className="metric-name">Peak Viewers</span>
                    <span className="metric-value">{stats.viewers.peak.toLocaleString()}</span>
                  </div>
                  <div className="insight-metric">
                    <span className="metric-name">Avg Engagement</span>
                    <span className="metric-value">{stats.engagement.average.toFixed(1)}%</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-header">
              <span className="insight-icon">📈</span>
              <span className="insight-title">Growth Trends</span>
            </div>
            <div className="insight-content">
              <div className="trend-indicator positive">
                <span className="trend-label">Viewer Growth</span>
                <span className="trend-value">+12.5%</span>
              </div>
              <div className="trend-indicator positive">
                <span className="trend-label">Engagement Rate</span>
                <span className="trend-value">+8.3%</span>
              </div>
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-header">
              <span className="insight-icon">⚡</span>
              <span className="insight-title">Real-time Status</span>
            </div>
            <div className="insight-content">
              <div className="status-indicator">
                <span className="status-dot good"></span>
                <span className="status-label">Stream Quality: Excellent</span>
              </div>
              <div className="status-indicator">
                <span className="status-dot good"></span>
                <span className="status-label">Connection: Stable</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};