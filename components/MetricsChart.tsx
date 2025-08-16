/**
 * Metrics Chart Component
 * Displays historical SLO metrics with trending data
 */

import React, { useState, useEffect, useMemo } from 'react';
import { StatusPageService, HistoricalMetrics } from '../services/statusPageService';

interface ChartDataPoint {
  timestamp: number;
  value: number;
  label: string;
}

interface MetricsChartProps {
  metric: 'playbackP95JoinTime' | 'rebufferRatio' | 'checkoutSuccessRate' | 'payoutP95Latency' | 'uptime' | 'errorRate';
  title: string;
  unit: string;
  target?: number;
  timeRange: '24h' | '7d' | '30d';
  height?: number;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({
  metric,
  title,
  unit,
  target,
  timeRange,
  height = 300
}) => {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusPageService = StatusPageService.getInstance();

  const timeRangeDays = useMemo(() => {
    switch (timeRange) {
      case '24h': return 1;
      case '7d': return 7;
      case '30d': return 30;
      default: return 7;
    }
  }, [timeRange]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const historicalData = await statusPageService.getHistoricalMetrics(timeRangeDays);
        
        const chartData: ChartDataPoint[] = historicalData.map(item => ({
          timestamp: item.date.getTime(),
          value: item.metrics[metric],
          label: item.date.toLocaleDateString()
        }));

        setData(chartData);
      } catch (err) {
        setError('Failed to load chart data');
        console.error('Error fetching chart data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [metric, timeRangeDays]);

  const chartDimensions = useMemo(() => {
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const width = 800 - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    return { margin, width, height: chartHeight };
  }, [height]);

  const scales = useMemo(() => {
    if (data.length === 0) return null;

    const xMin = Math.min(...data.map(d => d.timestamp));
    const xMax = Math.max(...data.map(d => d.timestamp));
    const yMin = Math.min(...data.map(d => d.value));
    const yMax = Math.max(...data.map(d => d.value));

    // Add some padding to y-axis
    const yPadding = (yMax - yMin) * 0.1;
    const yMinPadded = Math.max(0, yMin - yPadding);
    const yMaxPadded = yMax + yPadding;

    return {
      x: (timestamp: number) => ((timestamp - xMin) / (xMax - xMin)) * chartDimensions.width,
      y: (value: number) => chartDimensions.height - ((value - yMinPadded) / (yMaxPadded - yMinPadded)) * chartDimensions.height,
      yMin: yMinPadded,
      yMax: yMaxPadded
    };
  }, [data, chartDimensions]);

  const pathData = useMemo(() => {
    if (!scales || data.length === 0) return '';

    const points = data.map(d => `${scales.x(d.timestamp)},${scales.y(d.value)}`);
    return `M ${points.join(' L ')}`;
  }, [data, scales]);

  const targetLine = useMemo(() => {
    if (!scales || !target) return null;

    const y = scales.y(target);
    return `M 0,${y} L ${chartDimensions.width},${y}`;
  }, [scales, target, chartDimensions]);

  const yAxisTicks = useMemo(() => {
    if (!scales) return [];

    const tickCount = 5;
    const ticks = [];
    
    for (let i = 0; i <= tickCount; i++) {
      const value = scales.yMin + (scales.yMax - scales.yMin) * (i / tickCount);
      const y = scales.y(value);
      
      ticks.push({
        value: value.toFixed(value < 10 ? 2 : 1),
        y,
        label: `${value.toFixed(value < 10 ? 1 : 0)}${unit}`
      });
    }
    
    return ticks;
  }, [scales, unit]);

  const xAxisTicks = useMemo(() => {
    if (!scales || data.length === 0) return [];

    const tickCount = Math.min(6, data.length);
    const ticks = [];
    
    for (let i = 0; i < tickCount; i++) {
      const index = Math.floor((data.length - 1) * (i / (tickCount - 1)));
      const point = data[index];
      const x = scales.x(point.timestamp);
      
      const date = new Date(point.timestamp);
      const label = timeRange === '24h' 
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      
      ticks.push({ x, label });
    }
    
    return ticks;
  }, [scales, data, timeRange]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <div className="text-2xl mb-2">📊</div>
            <p>{error || 'No data available'}</p>
          </div>
        </div>
      </div>
    );
  }

  const currentValue = data[data.length - 1]?.value || 0;
  const previousValue = data[data.length - 2]?.value || currentValue;
  const trend = currentValue > previousValue ? 'up' : currentValue < previousValue ? 'down' : 'stable';
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center space-x-2">
          <span className="text-2xl font-bold text-gray-900">
            {currentValue.toFixed(currentValue < 10 ? 2 : 1)}{unit}
          </span>
          <span className={`text-sm ${trendColor}`}>
            {trend === 'up' ? '↗️' : trend === 'down' ? '↘️' : '→'}
          </span>
        </div>
      </div>

      <div className="relative">
        <svg 
          width={chartDimensions.width + chartDimensions.margin.left + chartDimensions.margin.right}
          height={height}
          className="overflow-visible"
        >
          <g transform={`translate(${chartDimensions.margin.left}, ${chartDimensions.margin.top})`}>
            {/* Grid lines */}
            {yAxisTicks.map((tick, index) => (
              <g key={index}>
                <line
                  x1={0}
                  y1={tick.y}
                  x2={chartDimensions.width}
                  y2={tick.y}
                  stroke="#f3f4f6"
                  strokeWidth={1}
                />
                <text
                  x={-10}
                  y={tick.y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="text-xs fill-gray-500"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Target line */}
            {targetLine && (
              <path
                d={targetLine}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5,5"
                fill="none"
              />
            )}

            {/* Data line */}
            <path
              d={pathData}
              stroke="#3b82f6"
              strokeWidth={3}
              fill="none"
              className="drop-shadow-sm"
            />

            {/* Data points */}
            {data.map((point, index) => (
              <circle
                key={index}
                cx={scales!.x(point.timestamp)}
                cy={scales!.y(point.value)}
                r={4}
                fill="#3b82f6"
                stroke="white"
                strokeWidth={2}
                className="drop-shadow-sm"
              />
            ))}

            {/* X-axis */}
            <line
              x1={0}
              y1={chartDimensions.height}
              x2={chartDimensions.width}
              y2={chartDimensions.height}
              stroke="#d1d5db"
              strokeWidth={1}
            />

            {/* X-axis ticks */}
            {xAxisTicks.map((tick, index) => (
              <g key={index}>
                <line
                  x1={tick.x}
                  y1={chartDimensions.height}
                  x2={tick.x}
                  y2={chartDimensions.height + 5}
                  stroke="#d1d5db"
                  strokeWidth={1}
                />
                <text
                  x={tick.x}
                  y={chartDimensions.height + 20}
                  textAnchor="middle"
                  className="text-xs fill-gray-500"
                >
                  {tick.label}
                </text>
              </g>
            ))}
          </g>
        </svg>

        {/* Legend */}
        <div className="flex items-center justify-center mt-4 space-x-6 text-xs text-gray-500">
          <div className="flex items-center">
            <div className="w-3 h-0.5 bg-blue-500 mr-2"></div>
            <span>Current Value</span>
          </div>
          {target && (
            <div className="flex items-center">
              <div className="w-3 h-0.5 bg-red-500 border-dashed mr-2"></div>
              <span>Target ({target}{unit})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface MetricsDashboardProps {
  timeRange: '24h' | '7d' | '30d';
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ timeRange }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricsChart
          metric="playbackP95JoinTime"
          title="P95 Join Time"
          unit="ms"
          target={2000}
          timeRange={timeRange}
        />
        
        <MetricsChart
          metric="rebufferRatio"
          title="Rebuffer Ratio"
          unit="%"
          target={1.0}
          timeRange={timeRange}
        />
        
        <MetricsChart
          metric="checkoutSuccessRate"
          title="Checkout Success Rate"
          unit="%"
          target={95.0}
          timeRange={timeRange}
        />
        
        <MetricsChart
          metric="payoutP95Latency"
          title="Payout P95 Latency"
          unit="hrs"
          target={24}
          timeRange={timeRange}
        />
      </div>
    </div>
  );
};

export default MetricsChart;