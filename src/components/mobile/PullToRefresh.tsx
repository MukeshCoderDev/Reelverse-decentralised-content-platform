import React, { useState, useRef, useEffect } from 'react';
import { useGestures } from '../../hooks/useGestures';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  disabled?: boolean;
  className?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  threshold = 80,
  disabled = false,
  className = ''
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [canRefresh, setCanRefresh] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePullToRefresh = async () => {
    if (disabled || isRefreshing) return;

    setIsRefreshing(true);
    
    try {
      await onRefresh();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
      setCanRefresh(false);
    }
  };

  const { elementRef, gestureState } = useGestures({
    onPullToRefresh: handlePullToRefresh
  }, {
    pullThreshold: threshold
  });

  // Update pull distance and refresh state
  useEffect(() => {
    if (gestureState.isPulling) {
      setPullDistance(gestureState.pullDistance);
      setCanRefresh(gestureState.pullDistance >= threshold);
    } else if (!isRefreshing) {
      setPullDistance(0);
      setCanRefresh(false);
    }
  }, [gestureState.isPulling, gestureState.pullDistance, threshold, isRefreshing]);

  // Combine refs
  useEffect(() => {
    if (containerRef.current && elementRef.current !== containerRef.current) {
      (elementRef as any).current = containerRef.current;
    }
  }, [elementRef]);

  const refreshIndicatorHeight = Math.min(pullDistance, threshold + 20);
  const refreshProgress = Math.min(pullDistance / threshold, 1);
  const rotation = refreshProgress * 360;

  return (
    <div
      ref={containerRef}
      className={`pull-to-refresh ${className} ${disabled ? 'disabled' : ''}`}
      style={{
        transform: `translateY(${isRefreshing ? threshold : Math.min(pullDistance * 0.5, threshold * 0.5)}px)`,
        transition: gestureState.isPulling ? 'none' : 'transform 0.3s ease-out'
      }}
    >
      {/* Refresh Indicator */}
      <div
        className="refresh-indicator"
        style={{
          height: `${refreshIndicatorHeight}px`,
          opacity: pullDistance > 10 ? 1 : 0,
          transition: gestureState.isPulling ? 'none' : 'all 0.3s ease-out'
        }}
      >
        <div className="refresh-content">
          {isRefreshing ? (
            <div className="refresh-spinner">
              <div className="spinner-ring"></div>
            </div>
          ) : (
            <div
              className={`refresh-arrow ${canRefresh ? 'can-refresh' : ''}`}
              style={{
                transform: `rotate(${canRefresh ? 180 : rotation}deg)`,
                transition: canRefresh ? 'transform 0.2s ease-out' : 'none'
              }}
            >
              ↓
            </div>
          )}
          
          <div className="refresh-text">
            {isRefreshing ? 'Refreshing...' : 
             canRefresh ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="refresh-content-wrapper">
        {children}
      </div>
    </div>
  );
};