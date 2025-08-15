#!/usr/bin/env node

/**
 * Integration test script for vector search functionality
 * This script tests the complete semantic search pipeline
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';

async function testVectorSearch() {
  console.log('🔍 Testing Vector Search System...\n');

  try {
    // Test 1: Check AI service health
    console.log('1. Checking AI service health...');
    const healthResponse = await axios.get(`${API_BASE_URL}/api/v1/ai/health`);
    console.log(`   Status: ${healthResponse.data.status}`);
    
    if (healthResponse.data.status !== 'healthy') {
      console.log('   ⚠️  AI services not fully healthy, some tests may fail');
    }
    console.log();

    // Test 2: Test semantic search
    console.log('2. Testing semantic search...');
    try {
      const semanticResponse = await axios.get(`${API_BASE_URL}/api/v1/ai/search/semantic`, {
        params: {
          q: 'blonde woman bedroom',
          limit: 10,
        }
      });
      
      console.log(`   Query: "blonde woman bedroom"`);
      console.log(`   Results: ${semanticResponse.data.data.total}`);
      console.log(`   Search type: ${semanticResponse.data.data.searchType}`);
      
      if (semanticResponse.data.data.results.length > 0) {
        console.log(`   Top result: ${JSON.stringify(semanticResponse.data.data.results[0], null, 2)}`);
      }
    } catch (error) {
      console.log(`   ❌ Semantic search failed: ${error.response?.data?.message || error.message}`);
    }
    console.log();

    // Test 3: Test hybrid search
    console.log('3. Testing hybrid search...');
    try {
      const hybridResponse = await axios.get(`${API_BASE_URL}/api/v1/ai/search/hybrid`, {
        params: {
          q: 'romantic couple',
          limit: 10,
          category: 'adult',
        }
      });
      
      console.log(`   Query: "romantic couple" (category: adult)`);
      console.log(`   Results: ${hybridResponse.data.data.total}`);
      console.log(`   Search type: ${hybridResponse.data.data.searchType}`);
      
      if (hybridResponse.data.data.results.length > 0) {
        console.log(`   Top result relevance: ${hybridResponse.data.data.results[0].relevanceScore}`);
      }
    } catch (error) {
      console.log(`   ❌ Hybrid search failed: ${error.response?.data?.message || error.message}`);
    }
    console.log();

    // Test 4: Test similar content
    console.log('4. Testing similar content search...');
    try {
      const testContentId = `test-content-${Date.now()}`;
      const similarResponse = await axios.get(`${API_BASE_URL}/api/v1/ai/similar/${testContentId}`, {
        params: {
          limit: 5,
        }
      });
      
      console.log(`   Content ID: ${testContentId}`);
      console.log(`   Similar content found: ${similarResponse.data.data.total}`);
    } catch (error) {
      console.log(`   ❌ Similar content search failed: ${error.response?.data?.message || error.message}`);
    }
    console.log();

    // Test 5: Test search with filters
    console.log('5. Testing search with filters...');
    try {
      const filteredResponse = await axios.get(`${API_BASE_URL}/api/v1/ai/search/hybrid`, {
        params: {
          q: 'dance',
          limit: 10,
          minDuration: 60,
          maxDuration: 600,
        }
      });
      
      console.log(`   Query: "dance" (duration: 60-600 seconds)`);
      console.log(`   Filtered results: ${filteredResponse.data.data.total}`);
    } catch (error) {
      console.log(`   ❌ Filtered search failed: ${error.response?.data?.message || error.message}`);
    }
    console.log();

    console.log('✅ Vector search tests completed!');

  } catch (error) {
    console.error('❌ Vector search test failed:');
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    
    process.exit(1);
  }
}

// Performance test for search
async function performanceTest() {
  console.log('\n🚀 Running search performance test...\n');

  const queries = [
    'blonde woman',
    'romantic couple',
    'bedroom scene',
    'outdoor adventure',
    'dance performance',
  ];

  const startTime = Date.now();
  const promises = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const promise = axios.get(`${API_BASE_URL}/api/v1/ai/search/hybrid`, {
      params: { q: query, limit: 20 }
    }).then(response => ({
      query,
      results: response.data.data.total,
      time: Date.now() - startTime,
    })).catch(error => ({
      query,
      error: error.message,
      time: Date.now() - startTime,
    }));
    
    promises.push(promise);
  }

  try {
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log(`✅ Completed ${queries.length} searches in ${totalDuration}ms`);
    console.log(`   Average time per search: ${totalDuration / queries.length}ms`);
    console.log(`   Searches per second: ${(queries.length / totalDuration * 1000).toFixed(2)}`);

    results.forEach((result, index) => {
      if (result.error) {
        console.log(`   Query ${index + 1}: "${result.query}" - ERROR: ${result.error}`);
      } else {
        console.log(`   Query ${index + 1}: "${result.query}" - ${result.results} results`);
      }
    });

  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
  }
}

// Test search accuracy with known queries
async function accuracyTest() {
  console.log('\n🎯 Running search accuracy test...\n');

  const testCases = [
    {
      query: 'blonde hair',
      expectedTags: ['blonde', 'hair'],
      description: 'Should find content with blonde hair'
    },
    {
      query: 'bedroom romantic',
      expectedTags: ['bedroom', 'romantic'],
      description: 'Should find romantic bedroom content'
    },
    {
      query: 'dance performance',
      expectedTags: ['dance', 'performance'],
      description: 'Should find dance performances'
    },
  ];

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.description}`);
    console.log(`Query: "${testCase.query}"`);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/ai/search/semantic`, {
        params: { q: testCase.query, limit: 10 }
      });

      const results = response.data.data.results;
      console.log(`   Found ${results.length} results`);
      
      if (results.length > 0) {
        const topResult = results[0];
        const matchedTags = testCase.expectedTags.filter(tag => 
          topResult.matchedTags.some(matched => 
            matched.toLowerCase().includes(tag.toLowerCase())
          )
        );
        
        console.log(`   Relevance score: ${topResult.relevanceScore.toFixed(3)}`);
        console.log(`   Matched expected tags: ${matchedTags.join(', ') || 'none'}`);
        console.log(`   Accuracy: ${(matchedTags.length / testCase.expectedTags.length * 100).toFixed(1)}%`);
      }
    } catch (error) {
      console.log(`   ❌ Test failed: ${error.response?.data?.message || error.message}`);
    }
    
    console.log();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--performance') || args.includes('-p')) {
    await performanceTest();
  } else if (args.includes('--accuracy') || args.includes('-a')) {
    await accuracyTest();
  } else if (args.includes('--all')) {
    await testVectorSearch();
    await performanceTest();
    await accuracyTest();
  } else {
    await testVectorSearch();
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testVectorSearch, performanceTest, accuracyTest };