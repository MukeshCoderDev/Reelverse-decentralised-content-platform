import React, { useState, useRef, useEffect } from 'react';

interface ChartDataPoint {
  x: number | string;
  y: number;
  label?: string;
  color?: string;
}

interface InteractiveChartProps {
  data: ChartDataPoint[];
  type: 'line' | 'bar' | 'area' | 'pie';
  title?: string;
  width?: number;
  height?: number;
  showTooltip?: boolean;
  showLegend?: boolean;
  onDataPointClick?: (point: ChartDataPoint, index: number) => void;
  className?: string;
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  data,
  type,
  title,
  width = 400,
  height = 300,
  showTooltip = true,
  showLegend = false,
  onDataPointClick,
  className = ''
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ point: ChartDataPoint; index: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const maxY = Math.max(...data.map(d => d.y));
  const minY = Math.min(...data.map(d => d.y), 0);
  const yRange = maxY - minY;

  const scaleY = (value: number) => {
    return chartHeight - ((value - minY) / yRange) * chartHeight;
  };

  const scaleX = (index: number) => {
    return (index / (data.length - 1)) * chartWidth;
  };

  const handleMouseMove = (event: React.MouseEvent, point: ChartDataPoint, index: number) => {
    if (!showTooltip) return;
    
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setHoveredPoint({
        point,
        index,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  const handleClick = (point: ChartDataPoint, index: number) => {
    onDataPointClick?.(point, index);
  };

  const renderLineChart = () => {
    const pathData = data.map((point, index) => {
      const x = scaleX(index);
      const y = scaleY(point.y);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return (
      <g>
        {/* Area fill */}
        <path
          d={`${pathData} L ${scaleX(data.length - 1)} ${chartHeight} L 0 ${chartHeight} Z`}
          fill="url(#gradient)"
          opacity={0.3}
        />
        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke="#0066cc"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Data points */}
        {data.map((point, index) => (
          <circle
            key={index}
            cx={scaleX(index)}
            cy={scaleY(point.y)}
            r={4}
            fill="#0066cc"
            stroke="#fff"
            strokeWidth={2}
            className="cursor-pointer hover:r-6 transition-all"
            onMouseMove={(e) => handleMouseMove(e, point, index)}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleClick(point, index)}
          />
        ))}
      </g>
    );
  };

  const renderBarChart = () => {
    const barWidth = chartWidth / data.length * 0.8;
    const barSpacing = chartWidth / data.length * 0.2;

    return (
      <g>
        {data.map((point, index) => {
          const x = (index * chartWidth / data.length) + barSpacing / 2;
          const y = scaleY(point.y);
          const barHeight = chartHeight - y;
          
          return (
            <rect
              key={index}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={point.color || "#0066cc"}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onMouseMove={(e) => handleMouseMove(e, point, index)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleClick(point, index)}
            />
          );
        })}
      </g>
    );
  };

  const renderAreaChart = () => {
    const pathData = data.map((point, index) => {
      const x = scaleX(index);
      const y = scaleY(point.y);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return (
      <g>
        <path
          d={`${pathData} L ${scaleX(data.length - 1)} ${chartHeight} L 0 ${chartHeight} Z`}
          fill="url(#gradient)"
          className="cursor-pointer"
          onMouseMove={(e) => handleMouseMove(e, data[0], 0)}
          onMouseLeave={handleMouseLeave}
        />
        <path
          d={pathData}
          fill="none"
          stroke="#0066cc"
          strokeWidth={2}
        />
      </g>
    );
  };

  const renderPieChart = () => {
    const total = data.reduce((sum, point) => sum + point.y, 0);
    let currentAngle = 0;
    const centerX = chartWidth / 2;
    const centerY = chartHeight / 2;
    const radius = Math.min(chartWidth, chartHeight) / 2 - 10;

    return (
      <g>
        {data.map((point, index) => {
          const percentage = point.y / total;
          const angle = percentage * 2 * Math.PI;
          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;
          
          const x1 = centerX + radius * Math.cos(startAngle);
          const y1 = centerY + radius * Math.sin(startAngle);
          const x2 = centerX + radius * Math.cos(endAngle);
          const y2 = centerY + radius * Math.sin(endAngle);
          
          const largeArcFlag = angle > Math.PI ? 1 : 0;
          
          const pathData = [
            `M ${centerX} ${centerY}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            'Z'
          ].join(' ');
          
          currentAngle += angle;
          
          return (
            <path
              key={index}
              d={pathData}
              fill={point.color || `hsl(${index * 360 / data.length}, 70%, 50%)`}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onMouseMove={(e) => handleMouseMove(e, point, index)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleClick(point, index)}
            />
          );
        })}
      </g>
    );
  };

  const renderAxes = () => {
    if (type === 'pie') return null;

    return (
      <g>
        {/* Y-axis */}
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={chartHeight}
          stroke="#333"
          strokeWidth={1}
        />
        {/* X-axis */}
        <line
          x1={0}
          y1={chartHeight}
          x2={chartWidth}
          y2={chartHeight}
          stroke="#333"
          strokeWidth={1}
        />
        
        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const value = minY + (yRange * ratio);
          const y = chartHeight - (ratio * chartHeight);
          return (
            <g key={ratio}>
              <line
                x1={-5}
                y1={y}
                x2={0}
                y2={y}
                stroke="#333"
                strokeWidth={1}
              />
              <text
                x={-10}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fill="#666"
              >
                {value.toFixed(0)}
              </text>
            </g>
          );
        })}
        
        {/* X-axis labels */}
        {data.map((point, index) => {
          if (index % Math.ceil(data.length / 5) !== 0) return null;
          const x = scaleX(index);
          return (
            <g key={index}>
              <line
                x1={x}
                y1={chartHeight}
                x2={x}
                y2={chartHeight + 5}
                stroke="#333"
                strokeWidth={1}
              />
              <text
                x={x}
                y={chartHeight + 20}
                textAnchor="middle"
                fontSize="12"
                fill="#666"
              >
                {point.label || point.x}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return renderLineChart();
      case 'bar':
        return renderBarChart();
      case 'area':
        return renderAreaChart();
      case 'pie':
        return renderPieChart();
      default:
        return renderLineChart();
    }
  };

  return (
    <div ref={containerRef} className={`interactive-chart ${className}`}>
      {title && <h3 className="chart-title">{title}</h3>}
      
      <div className="chart-container" style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="chart-svg"
        >
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0066cc" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#0066cc" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          
          <g transform={`translate(${padding.left}, ${padding.top})`}>
            {renderAxes()}
            {renderChart()}
          </g>
        </svg>
        
        {/* Tooltip */}
        {hoveredPoint && showTooltip && (
          <div
            className="chart-tooltip"
            style={{
              position: 'absolute',
              left: hoveredPoint.x + 10,
              top: hoveredPoint.y - 10,
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              pointerEvents: 'none',
              zIndex: 1000,
              whiteSpace: 'nowrap'
            }}
          >
            <div>{hoveredPoint.point.label || hoveredPoint.point.x}</div>
            <div><strong>{hoveredPoint.point.y.toLocaleString()}</strong></div>
          </div>
        )}
      </div>
      
      {/* Legend */}
      {showLegend && type === 'pie' && (
        <div className="chart-legend">
          {data.map((point, index) => (
            <div key={index} className="legend-item">
              <div
                className="legend-color"
                style={{
                  backgroundColor: point.color || `hsl(${index * 360 / data.length}, 70%, 50%)`
                }}
              />
              <span className="legend-label">{point.label || point.x}</span>
              <span className="legend-value">{point.y}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};