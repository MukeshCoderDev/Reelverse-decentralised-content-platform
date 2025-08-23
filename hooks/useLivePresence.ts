import { useEffect, useRef, useState } from 'react';

/**
 * Interface for live presence data
 */
export interface LivePresence {
  /** Current viewer count */
  viewers: number;
  /** Whether the stream is currently live */
  isLive: boolean;
  /** Stream latency in milliseconds */
  latencyMs: number;
  /** Stream quality indicator */
  quality: 'poor' | 'good' | 'excellent';
  /** Last update timestamp */
  lastUpdate: Date;
}

/**
 * Hook for managing live presence data with mock WebSocket-like updates
 * Simulates real-time viewer count and stream health updates
 * 
 * @param streamId - The ID of the stream to track
 * @returns Live presence data that updates in real-time
 */
export function useLivePresence(streamId: string): LivePresence {
  // Initialize with random baseline viewer count
  const [viewers, setViewers] = useState(() => 
    Math.floor(500 + Math.random() * 5000)
  );
  
  const [isLive, setIsLive] = useState(true);
  const [latencyMs, setLatencyMs] = useState(() => 
    Math.floor(2000 + Math.random() * 2000)
  );
  
  const [quality, setQuality] = useState<LivePresence['quality']>('good');
  const [lastUpdate, setLastUpdate] = useState(() => new Date());
  
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Simulate real-time updates every 2-3 seconds
    const updateInterval = 2000 + Math.random() * 1000;
    
    timerRef.current = window.setInterval(() => {
      // Update viewer count with realistic fluctuations
      setViewers(prevViewers => {
        const change = Math.floor((Math.random() - 0.5) * 200);
        const newCount = Math.max(0, prevViewers + change);
        
        // Occasionally simulate viewer spikes (e.g., raid, host, viral moment)
        if (Math.random() < 0.05) {
          return newCount + Math.floor(Math.random() * 1000);
        }
        
        return newCount;
      });

      // Update latency with realistic network variations
      setLatencyMs(prevLatency => {
        const latencyChange = Math.floor((Math.random() - 0.5) * 500);
        return Math.max(1500, Math.min(6000, prevLatency + latencyChange));
      });

      // Update quality based on latency
      setQuality(currentLatency => {
        if (currentLatency < 2500) return 'excellent';
        if (currentLatency < 4000) return 'good';
        return 'poor';
      });

      // Rarely simulate stream going offline
      if (Math.random() < 0.002) {
        setIsLive(false);
      }

      setLastUpdate(new Date());
    }, updateInterval);

    // Cleanup timer on unmount or streamId change
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [streamId]);

  // Simulate reconnection if stream goes offline
  useEffect(() => {
    if (!isLive) {
      const reconnectTimer = setTimeout(() => {
        setIsLive(true);
      }, 5000 + Math.random() * 10000);

      return () => clearTimeout(reconnectTimer);
    }
  }, [isLive]);

  return {
    viewers,
    isLive,
    latencyMs,
    quality,
    lastUpdate
  };
}

/**
 * Hook for aggregated live statistics across multiple streams
 * @param streamIds - Array of stream IDs to track
 * @returns Aggregated statistics
 */
export function useLiveStats(streamIds: string[]) {
  const [totalViewers, setTotalViewers] = useState(0);
  const [liveStreamCount, setLiveStreamCount] = useState(0);

  useEffect(() => {
    // Mock aggregated stats
    const mockTotalViewers = streamIds.length * (1000 + Math.random() * 3000);
    const mockLiveCount = Math.floor(streamIds.length * (0.7 + Math.random() * 0.3));

    setTotalViewers(Math.floor(mockTotalViewers));
    setLiveStreamCount(mockLiveCount);
  }, [streamIds]);

  return {
    totalViewers,
    liveStreamCount,
    averageViewersPerStream: liveStreamCount > 0 ? Math.floor(totalViewers / liveStreamCount) : 0
  };
}