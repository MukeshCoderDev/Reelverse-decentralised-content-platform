/**
 * Test component for metrics collection functionality
 */

import React, { useState } from 'react';
import { VideoPlayer } from '../content/VideoPlayer';
import { usePlaybackMetrics, useBusinessMetrics } from '../../lib/hooks/usePlaybackMetrics';
import { MetricsCollectionService } from '../../services/metricsCollectionService';

export const MetricsTestPlayer: React.FC = () => {
  const [showPlayer, setShowPlayer] = useState(false);
  const [metricsData, setMetricsData] = useState<any>(null);
  const businessMetrics = useBusinessMetrics();
  const metricsService = MetricsCollectionService.getInstance();

  const handleShowMetrics = async () => {
    try {
      const sloMetrics = await metricsService.calculateSLOs();
      const realTimeMetrics = await metricsService.getRealTimeMetrics();
      
      setMetricsData({
        sloMetrics,
        realTimeMetrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const handleTestBusinessMetrics = () => {
    // Test business metrics
    const userId = 'test_user_123';
    const amount = 29.99;
    const currency = 'USDC';

    // Simulate checkout flow
    businessMetrics.trackCheckoutStarted(userId, amount, currency);
    
    setTimeout(() => {
      businessMetrics.trackCheckoutCompleted(userId, amount, currency, 2500); // 2.5 seconds
    }, 2500);

    // Simulate payout flow
    setTimeout(() => {
      businessMetrics.trackPayoutInitiated(userId, amount * 0.8, currency);
      
      setTimeout(() => {
        businessMetrics.trackPayoutCompleted(userId, amount * 0.8, currency, 18 * 60 * 60 * 1000); // 18 hours
      }, 1000);
    }, 5000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Metrics Collection Test</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Video Player Test</h3>
          <button
            onClick={() => setShowPlayer(!showPlayer)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {showPlayer ? 'Hide Player' : 'Show Player'}
          </button>
          
          <p className="text-sm text-gray-600">
            The video player will automatically collect playback metrics including:
            join time, rebuffer events, quality changes, and user interactions.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Business Metrics Test</h3>
          <button
            onClick={handleTestBusinessMetrics}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Test Business Events
          </button>
          
          <p className="text-sm text-gray-600">
            This will simulate checkout and payout events to test business metrics collection.
          </p>
        </div>
      </div>

      <div className="mb-6">
        <button
          onClick={handleShowMetrics}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors mr-4"
        >
          Show Current Metrics
        </button>
        
        {metricsData && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <h4 className="font-semibold mb-2">Current Metrics Data:</h4>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(metricsData, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {showPlayer && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Test Video Player</h3>
          <div className="bg-black rounded-lg overflow-hidden">
            <VideoPlayer
              src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
              title="Test Video - Big Buck Bunny"
              contentId="test_content_123"
              userId="test_user_123"
              enableMetrics={true}
              autoPlay={false}
              className="w-full aspect-video"
            />
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold mb-2">Metrics Being Collected:</h4>
            <ul className="text-sm space-y-1">
              <li>• <strong>Join Time:</strong> Time from load start to first frame</li>
              <li>• <strong>Rebuffer Events:</strong> When video pauses to buffer</li>
              <li>• <strong>Quality Changes:</strong> When user changes video quality</li>
              <li>• <strong>Seek Events:</strong> When user scrubs through video</li>
              <li>• <strong>Play/Pause Events:</strong> User interaction tracking</li>
              <li>• <strong>Error Events:</strong> Any playback errors</li>
              <li>• <strong>Session Duration:</strong> Total viewing time</li>
            </ul>
          </div>
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-800 mb-2">Implementation Notes:</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Metrics are batched and sent every 30 seconds to reduce API calls</li>
          <li>• Real-time alerts are triggered for critical events (errors, high join times)</li>
          <li>• Session tracking handles page visibility changes and unload events</li>
          <li>• P95 calculations require sufficient data points for accuracy</li>
          <li>• Business metrics integrate with existing payment and payout systems</li>
        </ul>
      </div>
    </div>
  );
};