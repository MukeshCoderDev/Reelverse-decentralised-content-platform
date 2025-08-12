import React, { useState, useEffect } from 'react';
import { InteractiveChart } from './InteractiveChart';

interface EarningsData {
  date: string;
  subscriptions: number;
  donations: number;
  superChat: number;
  nftSales: number;
  total: number;
}

interface EarningsChartProps {
  data: EarningsData[];
  timeRange: '7d' | '30d' | '90d' | '1y';
  onTimeRangeChange: (range: '7d' | '30d' | '90d' | '1y') => void;
}

export const EarningsChart: React.FC<EarningsChartProps> = ({
  data,
  timeRange,
  onTimeRangeChange
}) => {
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('area');
  const [selectedMetric, setSelectedMetric] = useState<'total' | 'subscriptions' | 'donations' | 'superChat' | 'nftSales'>('total');

  const chartData = data.map(item => ({
    x: item.date,
    y: item[selectedMetric],
    label: new Date(item.date).toLocaleDateString(),
    color: getMetricColor(selectedMetric)
  }));

  const revenueBreakdownData = data.length > 0 ? [
    {
      x: 'Subscriptions',
      y: data.reduce((sum, item) => sum + item.subscriptions, 0),
      label: 'Subscriptions',
      color: '#0066cc'
    },
    {
      x: 'Donations',
      y: data.reduce((sum, item) => sum + item.donations, 0),
      label: 'Donations',
      color: '#4ade80'
    },
    {
      x: 'Super Chat',
      y: data.reduce((sum, item) => sum + item.superChat, 0),
      label: 'Super Chat',
      color: '#f59e0b'
    },
    {
      x: 'NFT Sales',
      y: data.reduce((sum, item) => sum + item.nftSales, 0),
      label: 'NFT Sales',
      color: '#8b5cf6'
    }
  ] : [];

  function getMetricColor(metric: string): string {
    const colors = {
      total: '#0066cc',
      subscriptions: '#0066cc',
      donations: '#4ade80',
      superChat: '#f59e0b',
      nftSales: '#8b5cf6'
    };
    return colors[metric as keyof typeof colors] || '#0066cc';
  }

  const totalRevenue = data.reduce((sum, item) => sum + item.total, 0);
  const averageDaily = data.length > 0 ? totalRevenue / data.length : 0;
  const growth = data.length > 1 ? 
    ((data[data.length - 1].total - data[0].total) / data[0].total) * 100 : 0;

  const handleDataPointClick = (point: any, index: number) => {
    console.log('Clicked data point:', point, 'at index:', index);
    // Could open detailed view for that day/period
  };

  return (
    <div className="earnings-chart">
      {/* Header with controls */}
      <div className="chart-header">
        <div className="chart-title-section">
          <h3>Revenue Analytics</h3>
          <div className="chart-metrics">
            <div className="metric">
              <span className="metric-label">Total Revenue</span>
              <span className="metric-value">${totalRevenue.toLocaleString()}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Daily Average</span>
              <span className="metric-value">${averageDaily.toFixed(0)}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Growth</span>
              <span className={`metric-value ${growth >= 0 ? 'positive' : 'negative'}`}>
                {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="chart-controls">
          {/* Time range selector */}
          <div className="time-range-selector">
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <button
                key={range}
                className={`range-button ${timeRange === range ? 'active' : ''}`}
                onClick={() => onTimeRangeChange(range)}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Chart type selector */}
          <div className="chart-type-selector">
            {(['line', 'bar', 'area'] as const).map((type) => (
              <button
                key={type}
                className={`type-button ${chartType === type ? 'active' : ''}`}
                onClick={() => setChartType(type)}
                title={`${type.charAt(0).toUpperCase() + type.slice(1)} Chart`}
              >
                {getChartTypeIcon(type)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric selector */}
      <div className="metric-selector">
        {(['total', 'subscriptions', 'donations', 'superChat', 'nftSales'] as const).map((metric) => (
          <button
            key={metric}
            className={`metric-button ${selectedMetric === metric ? 'active' : ''}`}
            onClick={() => setSelectedMetric(metric)}
            style={{ borderColor: getMetricColor(metric) }}
          >
            <div 
              className="metric-indicator"
              style={{ backgroundColor: getMetricColor(metric) }}
            />
            {formatMetricName(metric)}
          </button>
        ))}
      </div>

      {/* Main chart */}
      <div className="main-chart">
        <InteractiveChart
          data={chartData}
          type={chartType}
          width={800}
          height={400}
          showTooltip={true}
          onDataPointClick={handleDataPointClick}
          className="earnings-main-chart"
        />
      </div>

      {/* Revenue breakdown */}
      <div className="revenue-breakdown">
        <h4>Revenue Breakdown</h4>
        <div className="breakdown-charts">
          <div className="breakdown-pie">
            <InteractiveChart
              data={revenueBreakdownData}
              type="pie"
              width={300}
              height={300}
              showTooltip={true}
              showLegend={true}
              className="breakdown-pie-chart"
            />
          </div>
          
          <div className="breakdown-bars">
            <InteractiveChart
              data={revenueBreakdownData}
              type="bar"
              width={400}
              height={300}
              showTooltip={true}
              className="breakdown-bar-chart"
            />
          </div>
        </div>
      </div>

      {/* Trend analysis */}
      <div className="trend-analysis">
        <h4>Trend Analysis</h4>
        <div className="trend-insights">
          <div className="insight-card">
            <div className="insight-icon">📈</div>
            <div className="insight-content">
              <div className="insight-title">Best Performing Day</div>
              <div className="insight-value">
                {data.length > 0 ? 
                  new Date(data.reduce((max, item) => item.total > max.total ? item : max).date).toLocaleDateString() :
                  'No data'
                }
              </div>
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-icon">💰</div>
            <div className="insight-content">
              <div className="insight-title">Top Revenue Source</div>
              <div className="insight-value">
                {getTopRevenueSource(revenueBreakdownData)}
              </div>
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-icon">📊</div>
            <div className="insight-content">
              <div className="insight-title">Consistency Score</div>
              <div className="insight-value">
                {calculateConsistencyScore(data)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function getChartTypeIcon(type: string): string {
  const icons = {
    line: '📈',
    bar: '📊',
    area: '📉'
  };
  return icons[type as keyof typeof icons] || '📈';
}

function formatMetricName(metric: string): string {
  const names = {
    total: 'Total Revenue',
    subscriptions: 'Subscriptions',
    donations: 'Donations',
    superChat: 'Super Chat',
    nftSales: 'NFT Sales'
  };
  return names[metric as keyof typeof names] || metric;
}

function getTopRevenueSource(data: any[]): string {
  if (data.length === 0) return 'No data';
  const top = data.reduce((max, item) => item.y > max.y ? item : max);
  return top.label;
}

function calculateConsistencyScore(data: EarningsData[]): number {
  if (data.length < 2) return 100;
  
  const values = data.map(item => item.total);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? (stdDev / mean) : 0;
  
  // Convert to consistency score (lower variation = higher consistency)
  return Math.max(0, Math.min(100, 100 - (coefficientOfVariation * 100)));
}