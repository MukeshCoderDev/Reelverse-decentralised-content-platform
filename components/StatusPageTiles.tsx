/**
 * Status Page Tiles Component
 * Displays real-time SLO metrics in a public status page format
 */

import React, { useState, useEffect } from 'react';
import { StatusPageService, RealtimeMetrics, ServiceStatus, SLOTarget, Incident } from '../services/statusPageService';

interface StatusTileProps {
  title: string;
  value: string | number;
  unit?: string;
  status: 'good' | 'warning' | 'critical';
  target?: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'stable';
}

const StatusTile: React.FC<StatusTileProps> = ({ 
  title, 
  value, 
  unit, 
  status, 
  target, 
  description,
  trend 
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      case 'stable': return '→';
      default: return '';
    }
  };

  return (
    <div className={`p-6 rounded-lg border-2 ${getStatusColor()}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        {trend && <span className="text-lg">{getTrendIcon()}</span>}
      </div>
      
      <div className="flex items-baseline">
        <span className="text-3xl font-bold">
          {typeof value === 'number' ? value.toFixed(value < 10 ? 2 : 1) : value}
        </span>
        {unit && <span className="ml-1 text-sm text-gray-500">{unit}</span>}
      </div>
      
      {target && (
        <div className="mt-1 text-xs text-gray-500">
          Target: {typeof target === 'number' ? target.toFixed(1) : target}{unit}
        </div>
      )}
      
      {description && (
        <div className="mt-2 text-xs text-gray-600">
          {description}
        </div>
      )}
    </div>
  );
};

interface ServiceStatusIndicatorProps {
  services: ServiceStatus[];
}

const ServiceStatusIndicator: React.FC<ServiceStatusIndicatorProps> = ({ services }) => {
  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'operational': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'partial_outage': return 'bg-orange-500';
      case 'major_outage': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'operational': return 'Operational';
      case 'degraded': return 'Degraded';
      case 'partial_outage': return 'Partial Outage';
      case 'major_outage': return 'Major Outage';
      default: return 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Status</h3>
      
      <div className="space-y-3">
        {services.map((service) => (
          <div key={service.name} className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status)} mr-3`}></div>
              <span className="text-sm font-medium text-gray-900 capitalize">
                {service.name.replace('_', ' ')}
              </span>
            </div>
            
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span>{service.uptime.toFixed(2)}% uptime</span>
              <span>{service.responseTime.toFixed(0)}ms</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                service.status === 'operational' ? 'bg-green-100 text-green-800' :
                service.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {getStatusText(service.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface IncidentTimelineProps {
  incidents: Incident[];
}

const IncidentTimeline: React.FC<IncidentTimelineProps> = ({ incidents }) => {
  const getSeverityColor = (severity: Incident['severity']) => {
    switch (severity) {
      case 'minor': return 'bg-yellow-100 text-yellow-800';
      case 'major': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: Incident['status']) => {
    switch (status) {
      case 'investigating': return 'bg-blue-100 text-blue-800';
      case 'identified': return 'bg-purple-100 text-purple-800';
      case 'monitoring': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (incidents.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Incidents</h3>
        <div className="text-center py-8">
          <div className="text-green-500 text-4xl mb-2">✅</div>
          <p className="text-gray-600">No recent incidents</p>
          <p className="text-sm text-gray-500 mt-1">All systems operating normally</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Incidents</h3>
      
      <div className="space-y-4">
        {incidents.slice(0, 5).map((incident) => (
          <div key={incident.id} className="border-l-4 border-gray-200 pl-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">{incident.title}</h4>
              <div className="flex space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(incident.severity)}`}>
                  {incident.severity}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(incident.status)}`}>
                  {incident.status}
                </span>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">{incident.description}</p>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Started: {incident.startedAt.toLocaleString()}</span>
              {incident.resolvedAt && (
                <span>Resolved: {incident.resolvedAt.toLocaleString()}</span>
              )}
            </div>
            
            {incident.updates.length > 0 && (
              <div className="mt-2 text-xs text-gray-600">
                Latest: {incident.updates[incident.updates.length - 1].message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

interface StatusPageTilesProps {
  refreshInterval?: number;
}

export const StatusPageTiles: React.FC<StatusPageTilesProps> = ({ 
  refreshInterval = 30000 // 30 seconds
}) => {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [sloTargets, setSloTargets] = useState<SLOTarget[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const statusPageService = StatusPageService.getInstance();

  const fetchData = async () => {
    try {
      const [metricsData, servicesData, sloData, incidentsData] = await Promise.all([
        statusPageService.getRealtimeMetrics(),
        statusPageService.getServiceStatuses(),
        statusPageService.getSLOTargets(),
        statusPageService.getActiveIncidents()
      ]);

      setMetrics(metricsData);
      setServices(servicesData);
      setSloTargets(sloData);
      setIncidents(incidentsData);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Error fetching status page data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getMetricStatus = (current: number, target: number, isHigherBetter: boolean = false): 'good' | 'warning' | 'critical' => {
    const ratio = isHigherBetter ? current / target : target / current;
    if (ratio >= 1) return 'good';
    if (ratio >= 0.9) return 'warning';
    return 'critical';
  };

  const overallStatus = services.every(s => s.status === 'operational') && 
                       incidents.filter(i => i.status !== 'resolved').length === 0 ? 'operational' : 'degraded';

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Platform Status</h1>
        <div className="flex items-center justify-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            overallStatus === 'operational' ? 'bg-green-500' : 'bg-yellow-500'
          }`}></div>
          <span className="text-lg font-medium text-gray-700">
            {overallStatus === 'operational' ? 'All Systems Operational' : 'Some Systems Degraded'}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Last updated: {lastUpdated.toLocaleString()}
        </p>
      </div>

      {/* SLO Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatusTile
          title="P95 Join Time"
          value={metrics.playbackP95JoinTime}
          unit="ms"
          status={getMetricStatus(metrics.playbackP95JoinTime, 2000)}
          target={2000}
          description="95th percentile time to first frame"
        />
        
        <StatusTile
          title="Rebuffer Ratio"
          value={metrics.rebufferRatio}
          unit="%"
          status={getMetricStatus(metrics.rebufferRatio, 1.0)}
          target={1.0}
          description="Percentage of playback time rebuffering"
        />
        
        <StatusTile
          title="Checkout Success"
          value={metrics.checkoutSuccessRate}
          unit="%"
          status={getMetricStatus(metrics.checkoutSuccessRate, 95.0, true)}
          target={95.0}
          description="Payment completion success rate"
        />
        
        <StatusTile
          title="Payout Latency"
          value={metrics.payoutP95Latency}
          unit="hrs"
          status={getMetricStatus(metrics.payoutP95Latency, 24)}
          target={24}
          description="95th percentile payout processing time"
        />
        
        <StatusTile
          title="System Uptime"
          value={metrics.uptime}
          unit="%"
          status={getMetricStatus(metrics.uptime, 99.95, true)}
          target={99.95}
          description="Overall system availability"
        />
        
        <StatusTile
          title="Error Rate"
          value={metrics.errorRate}
          unit="%"
          status={getMetricStatus(metrics.errorRate, 1.0)}
          target={1.0}
          description="Platform error rate"
        />
        
        <StatusTile
          title="AI Accuracy"
          value={metrics.aiTaggingAccuracy}
          unit="%"
          status={getMetricStatus(metrics.aiTaggingAccuracy, 95.0, true)}
          target={95.0}
          description="AI content tagging accuracy"
        />
        
        <StatusTile
          title="Leak Detection"
          value={metrics.leakDetectionRate}
          unit="%"
          status={getMetricStatus(metrics.leakDetectionRate, 85.0, true)}
          target={85.0}
          description="Content leak detection rate"
        />
      </div>

      {/* Service Status and Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ServiceStatusIndicator services={services} />
        <IncidentTimeline incidents={incidents} />
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 pt-8 border-t border-gray-200">
        <p>This status page is updated in real-time. For support, contact our team.</p>
        <p className="mt-1">
          Metrics are calculated over rolling 5-minute windows with 95th percentile aggregation.
        </p>
      </div>
    </div>
  );
};

export default StatusPageTiles;