/**
 * ProgressBar Component
 * 
 * Accessible progress bar with determinate and indeterminate modes
 */

import React from 'react';
import { ProgressBarProps } from '../../types/upload';

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  isIndeterminate = false,
  speed,
  eta,
  className = ''
}) => {
  // Format speed for display
  const formatSpeed = (bytesPerSecond: number): string => {
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let size = bytesPerSecond;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Format ETA for display
  const formatETA = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  // Generate accessible label
  const getAriaLabel = (): string => {
    if (isIndeterminate) {
      return 'Processing... Please wait';
    }
    
    let label = `Upload progress: ${Math.round(clampedProgress)}% complete`;
    
    if (speed) {
      label += `, ${formatSpeed(speed)}`;
    }
    
    if (eta) {
      label += `, ${formatETA(eta)} remaining`;
    }
    
    return label;
  };

  const getValueText = (): string => {
    if (isIndeterminate) {
      return 'Processing';
    }
    
    let text = `${Math.round(clampedProgress)}% complete`;
    
    if (speed && eta) {
      text += `, ${formatSpeed(speed)}, ${formatETA(eta)} remaining`;
    } else if (speed) {
      text += `, ${formatSpeed(speed)}`;
    } else if (eta) {
      text += `, ${formatETA(eta)} remaining`;
    }
    
    return text;
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Progress Info */}
      <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
        <span className="font-medium">
          {isIndeterminate ? 'Processing...' : `${Math.round(clampedProgress)}%`}
        </span>
        
        {!isIndeterminate && (speed || eta) && (
          <div className="flex items-center space-x-3 text-xs">
            {speed && (
              <span className="text-slate-500">
                {formatSpeed(speed)}
              </span>
            )}
            {eta && (
              <span className="text-slate-500">
                {formatETA(eta)} left
              </span>
            )}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div
          className="w-full h-2 bg-slate-200 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={isIndeterminate ? undefined : clampedProgress}
          aria-valuemin={isIndeterminate ? undefined : 0}
          aria-valuemax={isIndeterminate ? undefined : 100}
          aria-valuetext={getValueText()}
          aria-label={getAriaLabel()}
        >
          {isIndeterminate ? (
            // Indeterminate animation
            <div className="h-full bg-gradient-to-r from-violet-500 to-violet-600 animate-pulse" />
          ) : (
            // Determinate progress
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all duration-300 ease-out"
              style={{ width: `${clampedProgress}%` }}
            />
          )}
        </div>

        {/* Indeterminate sliding animation */}
        {isIndeterminate && (
          <div className="absolute inset-0 h-full bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full w-1/3 bg-gradient-to-r from-transparent via-violet-500 to-transparent animate-slide"
              style={{
                animation: 'slide 2s infinite ease-in-out'
              }}
            />
          </div>
        )}
      </div>

      {/* Live region for screen readers */}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      >
        {getAriaLabel()}
      </div>
      
      {/* CSS for custom animation */}
      <style jsx>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        
        .animate-slide {
          animation: slide 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default ProgressBar;