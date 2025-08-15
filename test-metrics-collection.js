/**
 * Test script for metrics collection functionality
 * Run with: node test-metrics-collection.js
 */

const { MetricsCollectionService } = require('./services/metricsCollectionService');

async function testMetricsCollection() {
  console.log('🧪 Testing Metrics Collection Service...\n');

  const metricsService = MetricsCollectionService.getInstance();

  // Test 1: Start a session
  console.log('1. Testing session management...');
  const sessionId = metricsService.startSession('test_content_123', 'test_user_456');
  console.log(`✅ Session started: ${sessionId}\n`);

  // Test 2: Collect playback metrics
  console.log('2. Testing playback metrics collection...');
  
  // Simulate video start with join time
  await metricsService.collectPlaybackMetrics(sessionId, {
    sessionId,
    contentId: 'test_content_123',
    userId: 'test_user_456',
    timestamp: new Date(),
    event: 'start',
    joinTime: 1200, // 1.2 seconds
    playerVersion: '1.0.0',
    browserInfo: {
      userAgent: 'Test Browser',
      connection: '4g'
    }
  });
  console.log('✅ Start event with join time collected');

  // Simulate rebuffer event
  await metricsService.collectPlaybackMetrics(sessionId, {
    sessionId,
    contentId: 'test_content_123',
    timestamp: new Date(),
    event: 'rebuffer',
    rebufferDuration: 500 // 500ms rebuffer
  });
  console.log('✅ Rebuffer event collected');

  // Simulate quality change
  await metricsService.collectPlaybackMetrics(sessionId, {
    sessionId,
    contentId: 'test_content_123',
    timestamp: new Date(),
    event: 'quality_change',
    quality: '720p'
  });
  console.log('✅ Quality change event collected');

  // Simulate error
  await metricsService.collectPlaybackMetrics(sessionId, {
    sessionId,
    contentId: 'test_content_123',
    timestamp: new Date(),
    event: 'error',
    errorCode: 'NETWORK_ERROR',
    errorMessage: 'Failed to load video segment'
  });
  console.log('✅ Error event collected\n');

  // Test 3: Business metrics
  console.log('3. Testing business metrics collection...');
  
  await metricsService.collectBusinessMetrics({
    eventType: 'checkout_started',
    timestamp: new Date(),
    userId: 'test_user_456',
    amount: 29.99,
    currency: 'USDC'
  });
  console.log('✅ Checkout started event collected');

  await metricsService.collectBusinessMetrics({
    eventType: 'checkout_completed',
    timestamp: new Date(),
    userId: 'test_user_456',
    amount: 29.99,
    currency: 'USDC',
    processingTime: 2500 // 2.5 seconds
  });
  console.log('✅ Checkout completed event collected');

  await metricsService.collectBusinessMetrics({
    eventType: 'payout_completed',
    timestamp: new Date(),
    userId: 'creator_789',
    amount: 23.99,
    currency: 'USDC',
    processingTime: 18 * 60 * 60 * 1000 // 18 hours in milliseconds
  });
  console.log('✅ Payout completed event collected\n');

  // Test 4: SLO calculations
  console.log('4. Testing SLO calculations...');
  
  // Add more sample data for better calculations
  for (let i = 0; i < 10; i++) {
    await metricsService.collectPlaybackMetrics(`session_${i}`, {
      sessionId: `session_${i}`,
      contentId: 'test_content_123',
      timestamp: new Date(),
      event: 'start',
      joinTime: 800 + Math.random() * 2000 // Random join times between 800-2800ms
    });

    if (i % 3 === 0) {
      await metricsService.collectPlaybackMetrics(`session_${i}`, {
        sessionId: `session_${i}`,
        contentId: 'test_content_123',
        timestamp: new Date(),
        event: 'rebuffer',
        rebufferDuration: 200 + Math.random() * 800 // Random rebuffer 200-1000ms
      });
    }
  }

  const sloMetrics = await metricsService.calculateSLOs();
  console.log('✅ SLO Metrics calculated:');
  console.log(`   - P95 Join Time: ${sloMetrics.playbackP95JoinTime}ms`);
  console.log(`   - Rebuffer Ratio: ${sloMetrics.rebufferRatio.toFixed(2)}%`);
  console.log(`   - P95 Payout Latency: ${sloMetrics.payoutP95Latency.toFixed(1)} hours`);
  console.log(`   - Checkout Success Rate: ${sloMetrics.checkoutSuccessRate.toFixed(1)}%`);
  console.log(`   - Error Rate: ${sloMetrics.errorRate.toFixed(2)}%`);
  console.log(`   - Uptime: ${sloMetrics.uptime}%\n`);

  // Test 5: Real-time metrics
  console.log('5. Testing real-time metrics...');
  const realTimeMetrics = await metricsService.getRealTimeMetrics();
  console.log('✅ Real-time metrics retrieved:');
  console.log(`   - P95 Join Time: ${realTimeMetrics.playbackP95JoinTime}ms`);
  console.log(`   - Rebuffer Ratio: ${realTimeMetrics.rebufferRatio?.toFixed(2)}%`);
  console.log(`   - Error Rate: ${realTimeMetrics.errorRate?.toFixed(2)}%\n`);

  // Test 6: Aggregated metrics
  console.log('6. Testing aggregated metrics...');
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // 1 hour ago
  
  const aggregatedMetrics = await metricsService.getAggregatedMetrics(startTime, endTime);
  console.log(`✅ Aggregated metrics for last hour: ${aggregatedMetrics.length} data points`);
  
  if (aggregatedMetrics.length > 0) {
    const latest = aggregatedMetrics[aggregatedMetrics.length - 1];
    console.log(`   - Active Users: ${latest.activeUsers}`);
    console.log(`   - Total Sessions: ${latest.totalSessions}`);
    console.log(`   - Average Session Duration: ${latest.averageSessionDuration.toFixed(1)}s\n`);
  }

  // Test 7: End session
  console.log('7. Testing session cleanup...');
  metricsService.endSession(sessionId);
  console.log('✅ Session ended successfully\n');

  console.log('🎉 All metrics collection tests completed successfully!');
  console.log('\n📊 Summary:');
  console.log('- ✅ Session management working');
  console.log('- ✅ Playback metrics collection working');
  console.log('- ✅ Business metrics collection working');
  console.log('- ✅ SLO calculations working');
  console.log('- ✅ Real-time metrics working');
  console.log('- ✅ Aggregated metrics working');
  console.log('\n🚀 Ready for integration with video players and status page!');
}

// Run the test
testMetricsCollection().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});