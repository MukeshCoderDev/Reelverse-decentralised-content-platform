/**
 * SLO Status Indicator Component
 * Compact status indicator for header/sidebar showing system health
 */

import React from 'react';
import { useSLOStatus } from '../../lib/hooks/useSLOMonitoring';

interface SLOStatusIndicatorProps {
  showDetails?: boolean;
  className?: string;
  onClick?: () => void;
}

export const SLOStatusIndicator: React.FC<SLOStatusIndicatorProps> = ({
  showDetails = false,
  className = '',
  onClick
}) => {
  const { status, loading, error } = useSLOStatus();

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
        {showDetails && <span className="text-sm text-gray-500">Checking...</span>}
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className={`flex items-center space-x-2 ${className}`} onClick={onClick}>
        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        {showDetails && <span className="text-sm text-gray-500">Unknown</span>}
      </div>
    );
  }

  const getStatusColor = () => {
    switch (status.status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'healthy': return 'All Systems Operational';
      case 'warning': return `${status.activeBreaches} Warning${status.activeBreaches !== 1 ? 's' : ''}`;
      case 'critical': return `${status.criticalBreaches} Critical Issue${status.criticalBreaches !== 1 ? 's' : ''}`;
      default: return 'Status Unknown';
    }
  };

  const getTextColor = () => {
    switch (status.status) {
      case 'healthy': return 'text-green-700';
      case 'warning': return 'text-yellow-700';
      case 'critical': return 'text-red-700';
      default: return 'text-gray-700';
    }
  };

  return (
    <div 
      className={`flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity ${className}`}
      onClick={onClick}
      title={showDetails ? undefined : getStatusText()}
    >
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
      {showDetails && (
        <span className={`text-sm font-medium ${getTextColor()}`}>
          {getStatusText()}
        </span>
      )}
    </div>
  );
};

/**
 * Detailed SLO Status Card for dashboards
 */
export const SLOStatusCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { status, loading, error } = useSLOStatus();

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <div className="text-gray-500">
          <div className="text-sm font-medium">System Status</div>
          <div className="text-lg">Unable to load status</div>
        </div>
      </div>
    );
  }

  const getStatusColor = () => {
    switch (status.status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = () => {
    switch (status.status) {
      case 'healthy': return '✓';
      case 'warning': return '⚠';
      case 'critical': return '✕';
      default: return '?';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-600 mb-1">System Status</div>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
            <span className="mr-2">{getStatusIcon()}</span>
            {status.status === 'healthy' ? 'All Systems Operational' : 
             status.status === 'warning' ? `${status.activeBreaches} Warning${status.activeBreaches !== 1 ? 's' : ''}` :
             `${status.criticalBreaches} Critical Issue${status.criticalBreaches !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Last Check</div>
          <div className="text-sm font-medium">
            {new Date(status.lastCheck).toLocaleTimeString()}
          </div>
        </div>
      </div>
      
      {status.activeBreaches > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-600">
            Active Issues: {status.activeBreaches} total
            {status.criticalBreaches > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                ({status.criticalBreaches} critical)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};