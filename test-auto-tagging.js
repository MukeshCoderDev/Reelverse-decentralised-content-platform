#!/usr/bin/env node

/**
 * Integration test script for auto-tagging functionality
 * This script tests the complete auto-tagging pipeline
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4';

async function testAutoTagging() {
  console.log('🧪 Testing Auto-Tagging Service...\n');

  try {
    // Test 1: Check AI service health
    console.log('1. Checking AI service health...');
    const healthResponse = await axios.get(`${API_BASE_URL}/api/v1/ai/health`);
    console.log(`   Status: ${healthResponse.data.status}`);
    console.log(`   Services: ${JSON.stringify(healthResponse.data.services, null, 2)}\n`);

    // Test 2: Check queue status
    console.log('2. Checking queue status...');
    const queueResponse = await axios.get(`${API_BASE_URL}/api/v1/ai/queues/stats`);
    console.log(`   Queue health: ${JSON.stringify(queueResponse.data.data, null, 2)}\n`);

    // Test 3: Trigger auto-tagging
    console.log('3. Triggering auto-tagging job...');
    const autoTagResponse = await axios.post(`${API_BASE_URL}/api/v1/ai/auto-tag`, {
      contentId: `test-content-${Date.now()}`,
      mediaUrl: TEST_VIDEO_URL,
      existingTags: ['test', 'sample']
    });
    
    console.log(`   Job queued: ${autoTagResponse.data.status}`);
    console.log(`   Job ID: ${autoTagResponse.data.data.jobId}`);
    console.log(`   Content ID: ${autoTagResponse.data.data.contentId}\n`);

    // Test 4: Wait and check results
    console.log('4. Waiting for job completion (30 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Test 5: Check AI tags (placeholder for now)
    console.log('5. Checking AI tags...');
    const tagsResponse = await axios.get(`${API_BASE_URL}/api/v1/ai/tags/${autoTagResponse.data.data.contentId}`);
    console.log(`   Tags retrieved: ${JSON.stringify(tagsResponse.data, null, 2)}\n`);

    console.log('✅ Auto-tagging test completed successfully!');

  } catch (error) {
    console.error('❌ Auto-tagging test failed:');
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    
    process.exit(1);
  }
}

// Performance test
async function performanceTest() {
  console.log('\n🚀 Running performance test...\n');

  const startTime = Date.now();
  const concurrentJobs = 5;
  const promises = [];

  for (let i = 0; i < concurrentJobs; i++) {
    const promise = axios.post(`${API_BASE_URL}/api/v1/ai/auto-tag`, {
      contentId: `perf-test-${i}-${Date.now()}`,
      mediaUrl: TEST_VIDEO_URL,
      existingTags: [`perf-tag-${i}`]
    });
    promises.push(promise);
  }

  try {
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ Queued ${concurrentJobs} jobs in ${duration}ms`);
    console.log(`   Average time per job: ${duration / concurrentJobs}ms`);
    console.log(`   Jobs per second: ${(concurrentJobs / duration * 1000).toFixed(2)}`);

    results.forEach((result, index) => {
      console.log(`   Job ${index + 1}: ${result.data.data.jobId}`);
    });

  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--performance') || args.includes('-p')) {
    await performanceTest();
  } else {
    await testAutoTagging();
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testAutoTagging, performanceTest };