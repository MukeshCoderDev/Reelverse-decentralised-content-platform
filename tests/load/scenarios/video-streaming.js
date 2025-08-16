/**
 * k6 Load Test - Video Streaming Scenario
 * Tests video delivery and streaming performance
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { config, customMetrics, generateTestUser, randomChoice } from '../k6-config.js';

// Video streaming metrics
const videoJoinTime = new Trend('video_join_time');
const videoBufferHealth = new Trend('video_buffer_health');
const videoBitrate = new Trend('video_bitrate');
const videoRebufferEvents = new Counter('video_rebuffer_events');
const videoQualityChanges = new Counter('video_quality_changes');
const concurrentViewers = new Counter('concurrent_viewers');
const streamingErrors = new Rate('streaming_errors');
const cdnResponseTime = new Trend('cdn_response_time');

// Video quality levels
const qualityLevels = [
  { name: '1080p', bitrate: 5000, resolution: '1920x1080' },
  { name: '720p', bitrate: 2500, resolution: '1280x720' },
  { name: '480p', bitrate: 1000, resolution: '854x480' },
  { name: '360p', bitrate: 500, resolution: '640x360' }
];

export default function() {
  const user = generateTestUser();
  
  try {
    // Simulate video streaming session
    streamVideoContent(user);
    concurrentViewers.add(1);
    
  } catch (error) {
    streamingErrors.add(1);
    console.error(`Video streaming failed: ${error}`);
  }
}

function streamVideoContent(user) {
  // 1. Navigate to video content
  const contentId = randomChoice([
    config.testContent.freeVideo,
    config.testContent.premiumVideo
  ]);
  
  const contentResponse = http.get(`${config.baseUrl}/content/${contentId}`);
  check(contentResponse, {
    'video page loads': (r) => r.status === 200,
    'video page load time < 3s': (r) => r.timings.duration < 3000,
  });
  
  // 2. Request video stream
  const joinStart = Date.now();
  const streamResponse = http.get(
    `${config.apiUrl}/api/v1/content/${contentId}/stream`,
    {
      headers: {
        'Accept': 'application/vnd.apple.mpegurl, video/mp4',
        'User-Agent': 'k6-video-client/1.0'
      }
    }
  );
  
  check(streamResponse, {
    'video stream available': (r) => r.status === 200,
    'stream response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  const joinTime = Date.now() - joinStart;
  videoJoinTime.add(joinTime);
  customMetrics.videoJoinTime.add(joinTime);
  
  if (streamResponse.status !== 200) {
    throw new Error('Video stream not available');
  }
  
  // 3. Parse stream manifest (HLS/DASH)
  const streamData = parseStreamManifest(streamResponse.body);
  
  // 4. Start video playback simulation
  simulateVideoPlayback(streamData, contentId);
}

function parseStreamManifest(manifestBody) {
  // Mock HLS manifest parsing
  return {
    qualities: qualityLevels,
    segments: generateVideoSegments(),
    duration: 300 + Math.random() * 1200, // 5-25 minutes
    type: 'hls'
  };
}

function generateVideoSegments() {
  const segments = [];
  const segmentCount = 60 + Math.floor(Math.random() * 240); // 1-5 minutes worth
  
  for (let i = 0; i < segmentCount; i++) {
    segments.push({
      url: `segment_${i}.ts`,
      duration: 6, // 6 second segments
      size: 500000 + Math.random() * 1000000 // 0.5-1.5MB
    });
  }
  
  return segments;
}

function simulateVideoPlayback(streamData, contentId) {
  let currentQuality = randomChoice(streamData.qualities);
  let bufferHealth = 30; // seconds of buffer
  let playbackPosition = 0;
  
  const watchDuration = Math.min(
    streamData.duration,
    60 + Math.random() * 600 // Watch 1-11 minutes
  );
  
  console.log(`Starting video playback: ${watchDuration}s at ${currentQuality.name}`);
  
  const playbackStart = Date.now();
  let lastSegmentTime = playbackStart;
  
  while (playbackPosition < watchDuration) {
    // Download video segment
    const segmentStart = Date.now();
    downloadVideoSegment(currentQuality, playbackPosition);
    const segmentTime = Date.now() - segmentStart;
    
    // Update buffer health
    const segmentDuration = 6; // 6 second segments
    bufferHealth += segmentDuration - (segmentTime / 1000);
    bufferHealth = Math.max(0, Math.min(60, bufferHealth)); // 0-60s buffer
    
    videoBufferHealth.add(bufferHealth);
    videoBitrate.add(currentQuality.bitrate);
    
    // Check for rebuffering
    if (bufferHealth < 2) {
      videoRebufferEvents.add(1);
      customMetrics.rebufferRate.add(1);
      
      // Pause playback for rebuffering
      sleep(2, 5);
      console.log('Rebuffering event occurred');
    }
    
    // Adaptive bitrate logic
    const networkCondition = simulateNetworkCondition();
    const optimalQuality = selectOptimalQuality(networkCondition, bufferHealth);
    
    if (optimalQuality.name !== currentQuality.name) {
      currentQuality = optimalQuality;
      videoQualityChanges.add(1);
      console.log(`Quality changed to ${currentQuality.name}`);
    }
    
    // Advance playback position
    playbackPosition += segmentDuration;
    
    // Simulate real-time playback
    const targetTime = lastSegmentTime + (segmentDuration * 1000);
    const currentTime = Date.now();
    
    if (currentTime < targetTime) {
      sleep((targetTime - currentTime) / 1000);
    }
    
    lastSegmentTime = Date.now();
  }
  
  const totalPlaybackTime = Date.now() - playbackStart;
  console.log(`Video playback completed: ${totalPlaybackTime}ms`);
}

function downloadVideoSegment(quality, position) {
  const segmentUrl = `${config.apiUrl}/api/v1/video/segment/${quality.name}/${Math.floor(position / 6)}`;
  
  const segmentStart = Date.now();
  const segmentResponse = http.get(segmentUrl, {
    headers: {
      'Range': `bytes=0-${quality.bitrate * 6 / 8}`, // Approximate segment size
    }
  });
  
  const downloadTime = Date.now() - segmentStart;
  cdnResponseTime.add(downloadTime);
  
  check(segmentResponse, {
    'video segment downloaded': (r) => r.status === 200 || r.status === 206,
    'segment download time < 6s': (r) => r.timings.duration < 6000,
  });
  
  if (segmentResponse.status !== 200 && segmentResponse.status !== 206) {
    throw new Error(`Segment download failed: ${segmentResponse.status}`);
  }
}

function simulateNetworkCondition() {
  // Simulate varying network conditions
  const conditions = [
    { name: 'excellent', bandwidth: 10000, latency: 20 },
    { name: 'good', bandwidth: 5000, latency: 50 },
    { name: 'fair', bandwidth: 2000, latency: 100 },
    { name: 'poor', bandwidth: 500, latency: 200 }
  ];
  
  // Weight towards better conditions (80% good/excellent)
  const rand = Math.random();
  if (rand < 0.4) return conditions[0]; // excellent
  if (rand < 0.8) return conditions[1]; // good
  if (rand < 0.95) return conditions[2]; // fair
  return conditions[3]; // poor
}

function selectOptimalQuality(networkCondition, bufferHealth) {
  // Select quality based on network and buffer health
  let targetBitrate = networkCondition.bandwidth * 0.8; // Use 80% of bandwidth
  
  // Adjust for buffer health
  if (bufferHealth < 10) {
    targetBitrate *= 0.7; // Reduce quality if buffer is low
  } else if (bufferHealth > 30) {
    targetBitrate *= 1.2; // Increase quality if buffer is healthy
  }
  
  // Find best matching quality
  let bestQuality = qualityLevels[qualityLevels.length - 1]; // Start with lowest
  
  for (const quality of qualityLevels) {
    if (quality.bitrate <= targetBitrate) {
      bestQuality = quality;
    } else {
      break;
    }
  }
  
  return bestQuality;
}

// Test live streaming scenario
function simulateLiveStream(user) {
  console.log('Starting live stream simulation');
  
  // Connect to live stream
  const liveResponse = http.get(`${config.apiUrl}/api/v1/live/stream/test-live-stream`);
  
  check(liveResponse, {
    'live stream available': (r) => r.status === 200,
  });
  
  if (liveResponse.status !== 200) {
    throw new Error('Live stream not available');
  }
  
  // Simulate live viewing (shorter duration)
  const viewDuration = 30 + Math.random() * 300; // 30s to 5min
  let currentTime = 0;
  
  while (currentTime < viewDuration) {
    // Download live segment
    const liveSegmentResponse = http.get(
      `${config.apiUrl}/api/v1/live/segment/test-live-stream/${Math.floor(currentTime / 6)}`
    );
    
    check(liveSegmentResponse, {
      'live segment available': (r) => r.status === 200,
      'live segment latency < 3s': (r) => r.timings.duration < 3000,
    });
    
    currentTime += 6; // 6 second segments
    sleep(6); // Real-time playback
  }
  
  console.log(`Live stream viewing completed: ${viewDuration}s`);
}

// Setup function
export function setup() {
  console.log('Starting video streaming load test');
  
  // Verify streaming endpoints
  const streamHealthCheck = http.get(`${config.apiUrl}/api/v1/content/health`);
  if (streamHealthCheck.status !== 200) {
    console.warn('Streaming service health check failed');
  }
  
  return { startTime: Date.now() };
}

// Teardown function
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`Video streaming test completed in ${duration}ms`);
  
  // Log streaming metrics
  console.log('Video streaming metrics:');
  console.log(`- Concurrent viewers: ${concurrentViewers.count}`);
  console.log(`- Rebuffer events: ${videoRebufferEvents.count}`);
  console.log(`- Quality changes: ${videoQualityChanges.count}`);
  console.log(`- Streaming error rate: ${(streamingErrors.rate * 100).toFixed(2)}%`);
}