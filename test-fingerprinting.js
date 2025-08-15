#!/usr/bin/env node

/**
 * Integration test script for video fingerprinting functionality
 * This script tests the complete fingerprinting pipeline for leak detection
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4';

async function testVideoFingerprinting() {
  console.log('🔍 Testing Video Fingerprinting Service...\n');

  try {
    // Test 1: Check AI service health
    console.log('1. Checking AI service health...');
    const healthResponse = await axios.get(`${API_BASE_URL}/api/v1/ai/health`);
    console.log(`   Status: ${healthResponse.data.status}`);
    
    if (healthResponse.data.status !== 'healthy') {
      console.log('   ⚠️  AI services not fully healthy, some tests may fail');
    }
    console.log();

    // Test 2: Queue fingerprinting job
    console.log('2. Queueing video fingerprinting job...');
    const fingerprintResponse = await axios.post(`${API_BASE_URL}/api/v1/ai/fingerprint`, {
      contentId: `test-fingerprint-${Date.now()}`,
      videoUrl: TEST_VIDEO_URL,
    });
    
    console.log(`   Job queued: ${fingerprintResponse.data.status}`);
    console.log(`   Job ID: ${fingerprintResponse.data.data.jobId}`);
    console.log(`   Content ID: ${fingerprintResponse.data.data.contentId}`);
    console.log();

    // Test 3: Wait for processing
    console.log('3. Waiting for fingerprinting to complete (60 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Test 4: Check fingerprint metadata
    console.log('4. Checking fingerprint metadata...');
    try {
      const metadataResponse = await axios.get(
        `${API_BASE_URL}/api/v1/ai/fingerprint/${fingerprintResponse.data.data.contentId}`
      );
      console.log(`   Metadata retrieved: ${JSON.stringify(metadataResponse.data, null, 2)}`);
    } catch (error) {
      console.log(`   ❌ Failed to retrieve metadata: ${error.response?.data?.message || error.message}`);
    }
    console.log();

    // Test 5: Search for similar fingerprints
    console.log('5. Searching for similar fingerprints...');
    try {
      const searchResponse = await axios.post(`${API_BASE_URL}/api/v1/ai/fingerprint/search`, {
        contentId: fingerprintResponse.data.data.contentId,
        limit: 10,
      });
      
      console.log(`   Search completed: ${searchResponse.data.status}`);
      console.log(`   Similar fingerprints found: ${searchResponse.data.data.total}`);
      
      if (searchResponse.data.data.similarFingerprints.length > 0) {
        console.log(`   Top match similarity: ${searchResponse.data.data.similarFingerprints[0].similarity}`);
      }
    } catch (error) {
      console.log(`   ❌ Search failed: ${error.response?.data?.message || error.message}`);
    }
    console.log();

    // Test 6: Check queue statistics
    console.log('6. Checking fingerprinting queue statistics...');
    const queueResponse = await axios.get(`${API_BASE_URL}/api/v1/ai/queues/stats`);
    const fingerprintingQueue = queueResponse.data.data.find(q => q.name === 'fingerprinting');
    
    if (fingerprintingQueue) {
      console.log(`   Queue status: ${fingerprintingQueue.status}`);
      console.log(`   Jobs processed: ${JSON.stringify(fingerprintingQueue.counts, null, 2)}`);
    }
    console.log();

    console.log('✅ Video fingerprinting tests completed successfully!');

  } catch (error) {
    console.error('❌ Video fingerprinting test failed:');
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    
    process.exit(1);
  }
}

// Performance test for fingerprinting
async function performanceTest() {
  console.log('\n🚀 Running fingerprinting performance test...\n');

  const testVideos = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  ];

  const startTime = Date.now();
  const promises = [];

  for (let i = 0; i < testVideos.length; i++) {
    const videoUrl = testVideos[i];
    const promise = axios.post(`${API_BASE_URL}/api/v1/ai/fingerprint`, {
      contentId: `perf-test-${i}-${Date.now()}`,
      videoUrl: videoUrl,
    }).then(response => ({
      contentId: response.data.data.contentId,
      jobId: response.data.data.jobId,
      videoUrl: videoUrl,
      queueTime: Date.now() - startTime,
    })).catch(error => ({
      error: error.message,
      videoUrl: videoUrl,
      queueTime: Date.now() - startTime,
    }));
    
    promises.push(promise);
  }

  try {
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log(`✅ Queued ${testVideos.length} fingerprinting jobs in ${totalDuration}ms`);
    console.log(`   Average time per job: ${totalDuration / testVideos.length}ms`);
    console.log(`   Jobs per second: ${(testVideos.length / totalDuration * 1000).toFixed(2)}`);

    results.forEach((result, index) => {
      if (result.error) {
        console.log(`   Job ${index + 1}: ERROR - ${result.error}`);
      } else {
        console.log(`   Job ${index + 1}: ${result.jobId} (${result.queueTime}ms)`);
      }
    });

  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
  }
}

// Test fingerprint accuracy with known duplicates
async function accuracyTest() {
  console.log('\n🎯 Running fingerprint accuracy test...\n');

  const originalVideo = TEST_VIDEO_URL;
  const duplicateVideo = TEST_VIDEO_URL; // Same video for testing

  try {
    // Generate fingerprint for original
    console.log('Generating fingerprint for original video...');
    const originalResponse = await axios.post(`${API_BASE_URL}/api/v1/ai/fingerprint`, {
      contentId: `accuracy-original-${Date.now()}`,
      videoUrl: originalVideo,
    });

    // Generate fingerprint for "duplicate"
    console.log('Generating fingerprint for duplicate video...');
    const duplicateResponse = await axios.post(`${API_BASE_URL}/api/v1/ai/fingerprint`, {
      contentId: `accuracy-duplicate-${Date.now()}`,
      videoUrl: duplicateVideo,
    });

    console.log('Original job ID:', originalResponse.data.data.jobId);
    console.log('Duplicate job ID:', duplicateResponse.data.data.jobId);

    // Wait for processing
    console.log('Waiting for processing to complete...');
    await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes

    // Search for similar fingerprints
    console.log('Searching for similar fingerprints...');
    const searchResponse = await axios.post(`${API_BASE_URL}/api/v1/ai/fingerprint/search`, {
      contentId: originalResponse.data.data.contentId,
      limit: 10,
    });

    console.log(`Search results: ${searchResponse.data.data.total} matches found`);
    
    if (searchResponse.data.data.similarFingerprints.length > 0) {
      const topMatch = searchResponse.data.data.similarFingerprints[0];
      console.log(`Top match similarity: ${(topMatch.similarity * 100).toFixed(2)}%`);
      console.log(`Match confidence: ${(topMatch.matchResult.confidence * 100).toFixed(2)}%`);
      
      if (topMatch.similarity > 0.9) {
        console.log('✅ High accuracy: Duplicate correctly identified');
      } else if (topMatch.similarity > 0.7) {
        console.log('⚠️  Medium accuracy: Duplicate detected but with lower confidence');
      } else {
        console.log('❌ Low accuracy: Duplicate not properly detected');
      }
    } else {
      console.log('❌ No matches found - fingerprinting may have failed');
    }

  } catch (error) {
    console.error('❌ Accuracy test failed:', error.message);
  }
}

// Test leak detection workflow
async function leakDetectionTest() {
  console.log('\n🛡️  Running leak detection workflow test...\n');

  try {
    // Simulate original content upload
    console.log('1. Simulating original content upload...');
    const originalResponse = await axios.post(`${API_BASE_URL}/api/v1/ai/fingerprint`, {
      contentId: `original-content-${Date.now()}`,
      videoUrl: TEST_VIDEO_URL,
    });

    console.log(`   Original content fingerprinted: ${originalResponse.data.data.contentId}`);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Simulate leak detection scan
    console.log('2. Simulating leak detection scan...');
    const leakResponse = await axios.post(`${API_BASE_URL}/api/v1/ai/fingerprint`, {
      contentId: `potential-leak-${Date.now()}`,
      videoUrl: TEST_VIDEO_URL, // Same video simulating a leak
    });

    console.log(`   Potential leak fingerprinted: ${leakResponse.data.data.contentId}`);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Search for matches
    console.log('3. Searching for potential matches...');
    const matchResponse = await axios.post(`${API_BASE_URL}/api/v1/ai/fingerprint/search`, {
      contentId: leakResponse.data.data.contentId,
      limit: 10,
    });

    console.log(`   Matches found: ${matchResponse.data.data.total}`);

    if (matchResponse.data.data.similarFingerprints.length > 0) {
      const match = matchResponse.data.data.similarFingerprints[0];
      console.log(`   Match similarity: ${(match.similarity * 100).toFixed(2)}%`);
      
      if (match.similarity > 0.85) {
        console.log('🚨 LEAK DETECTED: High similarity match found!');
        console.log('   → Would trigger DMCA takedown process');
        console.log('   → Would notify content owner');
        console.log('   → Would log incident for tracking');
      } else {
        console.log('✅ No significant matches - content appears original');
      }
    } else {
      console.log('✅ No matches found - content appears original');
    }

    console.log('\n✅ Leak detection workflow test completed');

  } catch (error) {
    console.error('❌ Leak detection test failed:', error.message);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--performance') || args.includes('-p')) {
    await performanceTest();
  } else if (args.includes('--accuracy') || args.includes('-a')) {
    await accuracyTest();
  } else if (args.includes('--leak-detection') || args.includes('-l')) {
    await leakDetectionTest();
  } else if (args.includes('--all')) {
    await testVideoFingerprinting();
    await performanceTest();
    await accuracyTest();
    await leakDetectionTest();
  } else {
    await testVideoFingerprinting();
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  testVideoFingerprinting, 
  performanceTest, 
  accuracyTest, 
  leakDetectionTest 
};