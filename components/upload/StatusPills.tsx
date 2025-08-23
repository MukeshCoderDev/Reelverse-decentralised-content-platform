/**
 * StatusPills Component
 * 
 * Visual status indicators for upload pipeline stages
 */

import React from 'react';
import { StatusPillProps, UploadStatus, STATUS_COLORS } from '../../types/upload';
import Icon from '../Icon';

interface StatusPillsProps {
  status: UploadStatus;
  progress?: number;
  errorCode?: string;
  className?: string;
  showRetry?: boolean;
  onRetry?: () => void;
}

const StatusPills: React.FC<StatusPillsProps> = ({
  status,
  progress = 0,
  errorCode,
  className = '',
  showRetry = false,
  onRetry
}) => {
  // Status configuration with icons and labels
  const statusConfig = {
    idle: {
      label: 'Ready',
      icon: 'clock' as const,
      description: 'Select a file to start uploading'
    },
    uploading: {
      label: `Uploading ${Math.round(progress)}%`,
      icon: 'upload' as const,
      description: 'Uploading your video to our servers'
    },
    uploaded: {
      label: 'Upload Complete',
      icon: 'check-circle' as const,
      description: 'Video uploaded successfully'
    },
    processing: {
      label: 'Processing',
      icon: 'loader' as const,
      description: 'Transcoding for every device'
    },
    playable: {
      label: 'SD Ready',
      icon: 'play' as const,
      description: 'Ready to publish - HD finishing in background'
    },
    hd_ready: {
      label: 'HD Ready',
      icon: 'check-circle' as const,
      description: '4K quality available'
    },
    failed: {
      label: 'Failed',
      icon: 'alert-circle' as const,
      description: errorCode ? `Error: ${errorCode}` : 'Upload failed'
    },
    aborted: {
      label: 'Aborted',
      icon: 'x' as const,
      description: 'Upload was cancelled'
    }
  };

  const config = statusConfig[status];
  const colorClass = STATUS_COLORS[status];

  // Get pill styling based on status
  const getPillClasses = (status: UploadStatus): string => {
    const baseClasses = "inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-all duration-200";
    
    switch (status) {
      case 'idle':
        return `${baseClasses} bg-gray-100 text-gray-700`;
      case 'uploading':
        return `${baseClasses} bg-blue-100 text-blue-700`;
      case 'uploaded':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'processing':
        return `${baseClasses} bg-amber-100 text-amber-700`;
      case 'playable':
        return `${baseClasses} bg-green-100 text-green-700`;
      case 'hd_ready':
        return `${baseClasses} bg-emerald-100 text-emerald-700`;
      case 'failed':
        return `${baseClasses} bg-rose-100 text-rose-700`;
      case 'aborted':
        return `${baseClasses} bg-gray-100 text-gray-600`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-700`;
    }
  };

  const getIconClasses = (status: UploadStatus): string => {
    switch (status) {
      case 'processing':
        return 'animate-spin';
      case 'uploading':
        return 'animate-pulse';
      default:
        return '';
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Main Status Pill */}
      <div className={getPillClasses(status)}>
        <Icon 
          name={config.icon} 
          size={16} 
          className={getIconClasses(status)}
        />
        <span>{config.label}</span>
      </div>

      {/* Retry Button for Failed Status */}
      {status === 'failed' && showRetry && onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors duration-200"
          aria-label="Retry upload"
        >
          <Icon name="refresh-cw" size={12} />
          <span>Retry</span>
        </button>
      )}

      {/* Status Description */}
      <div className="text-xs text-slate-500 mt-1">
        {config.description}
      </div>
    </div>
  );
};

// Individual Status Pill Component
const StatusPill: React.FC<StatusPillProps> = ({ status, className = '' }) => {
  const config = {
    idle: { label: 'Ready', color: 'gray' },
    uploading: { label: 'Uploading', color: 'blue' },
    uploaded: { label: 'Uploaded', color: 'blue' },
    processing: { label: 'Processing', color: 'amber' },
    playable: { label: 'SD Ready', color: 'green' },
    hd_ready: { label: 'HD Ready', color: 'emerald' },
    failed: { label: 'Failed', color: 'rose' },
    aborted: { label: 'Aborted', color: 'gray' }
  };

  const { label, color } = config[status];

  return (
    <span 
      className={`inline-block px-2 py-1 text-xs font-medium rounded-full bg-${color}-100 text-${color}-700 ${className}`}
    >
      {label}
    </span>
  );
};

// Pipeline Status Component showing all stages
interface PipelineStatusProps {
  currentStatus: UploadStatus;
  progress?: number;
  className?: string;
}

export const PipelineStatus: React.FC<PipelineStatusProps> = ({
  currentStatus,
  progress = 0,
  className = ''
}) => {
  const stages = [
    { status: 'uploading' as const, label: 'Upload' },
    { status: 'processing' as const, label: 'Process' },
    { status: 'playable' as const, label: 'SD Ready' },
    { status: 'hd_ready' as const, label: 'HD Ready' }
  ];

  const getStageState = (stageStatus: UploadStatus): 'completed' | 'current' | 'pending' | 'failed' => {
    if (currentStatus === 'failed' || currentStatus === 'aborted') {
      return 'failed';
    }

    const statusOrder = ['idle', 'uploading', 'uploaded', 'processing', 'playable', 'hd_ready'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const stageIndex = statusOrder.indexOf(stageStatus);

    if (stageIndex < currentIndex) {
      return 'completed';
    } else if (stageIndex === currentIndex) {
      return 'current';
    } else {
      return 'pending';
    }
  };

  const getStageClasses = (state: string): string => {
    const baseClasses = "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200";
    
    switch (state) {
      case 'completed':
        return `${baseClasses} bg-emerald-100 text-emerald-700`;
      case 'current':
        return `${baseClasses} bg-violet-100 text-violet-700 ring-2 ring-violet-200`;
      case 'failed':
        return `${baseClasses} bg-rose-100 text-rose-700`;
      case 'pending':
      default:
        return `${baseClasses} bg-slate-100 text-slate-500`;
    }
  };

  const getStageIcon = (stageStatus: UploadStatus, state: string): string => {
    if (state === 'completed') return 'check-circle';
    if (state === 'failed') return 'alert-circle';
    if (state === 'current') {
      switch (stageStatus) {
        case 'uploading': return 'upload';
        case 'processing': return 'loader';
        case 'playable': return 'play';
        case 'hd_ready': return 'check-circle';
        default: return 'clock';
      }
    }
    return 'clock';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="text-sm font-medium text-slate-700 mb-3">Upload Pipeline</h4>
      <div className="space-y-2">
        {stages.map((stage, index) => {
          const state = getStageState(stage.status);
          const isCurrentUploading = state === 'current' && stage.status === 'uploading';
          
          return (
            <div key={stage.status} className={getStageClasses(state)}>
              <Icon 
                name={getStageIcon(stage.status, state)} 
                size={16}
                className={state === 'current' && stage.status === 'processing' ? 'animate-spin' : ''}
              />
              <span className="flex-1">{stage.label}</span>
              {isCurrentUploading && (
                <span className="text-xs font-normal">
                  {Math.round(progress)}%
                </span>
              )}
              {state === 'current' && stage.status === 'processing' && (
                <span className="text-xs font-normal">
                  Processing...
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusPills;
export { StatusPill };