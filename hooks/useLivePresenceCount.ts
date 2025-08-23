import { useEffect, useState } from 'react';

/**
 * Hook to track the number of active live streams
 * Currently provides mock data with realistic fluctuations
 * TODO: Replace with actual API integration when backend is ready
 */
export function useLivePresenceCount(): number {
  const [count, setCount] = useState(8); // Start with mock count

  useEffect(() => {
    // Simulate realistic live stream count fluctuations
    const interval = setInterval(() => {
      setCount(currentCount => {
        // Random change between -1 and +1, but never go below 0
        const change = Math.floor((Math.random() - 0.5) * 2);
        const newCount = Math.max(0, currentCount + change);
        
        // Occasionally add a bigger spike to simulate popular events
        if (Math.random() < 0.1) {
          return Math.min(50, newCount + Math.floor(Math.random() * 5));
        }
        
        return newCount;
      });
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return count;
}

/**
 * Hook for more detailed live stream metrics
 * Provides additional context for live streaming features
 */
export function useLiveMetrics() {
  const totalStreams = useLivePresenceCount();
  const [peakToday, setPeakToday] = useState(23);
  const [averageViewers, setAverageViewers] = useState(1250);

  useEffect(() => {
    // Update peak if current count exceeds today's peak
    setPeakToday(current => Math.max(current, totalStreams));
    
    // Simulate average viewer fluctuations
    const interval = setInterval(() => {
      setAverageViewers(current => {
        const change = Math.floor((Math.random() - 0.5) * 100);
        return Math.max(500, current + change);
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [totalStreams]);

  return {
    totalStreams,
    peakToday,
    averageViewers,
    isLive: totalStreams > 0,
  };
}

/**
 * Format live count for display
 * Handles large numbers with appropriate abbreviations
 */
export function formatLiveCount(count: number): string {
  if (count === 0) return '0';
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${Math.floor(count / 100) / 10}K`;
  return `${Math.floor(count / 100000) / 10}M`;
}