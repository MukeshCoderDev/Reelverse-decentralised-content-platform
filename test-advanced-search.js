/**
 * Test script for Advanced Search and Feed Ranking v2 functionality
 * Tests the hybrid ranking, personalization, and bandit optimization features
 */

const API_BASE = 'http://localhost:3001/api/v1';

// Mock authentication token (in real implementation, get from login)
const AUTH_TOKEN = 'mock-jwt-token';

// Test data
const testUserId = 'test-user-123';
const testSessionId = 'session-' + Date.now();

/**
 * Test hybrid search functionality
 */
async function testHybridSearch() {
  console.log('\n🔍 Testing Hybrid Search...');
  
  const searchQueries = [
    'premium exclusive content',
    'behind the scenes',
    'verified creators',
    'high quality videos'
  ];

  for (const query of searchQueries) {
    try {
      const response = await fetch(`${API_BASE}/advanced-search/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({
          query,
          filters: {
            verified: true,
            duration: { min: 5, max: 30 }
          },
          limit: 10,
          personalizeResults: true
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`✅ Search for "${query}" successful`);
        console.log(`   Results: ${data.data.results.length}`);
        console.log(`   Algorithm: ${data.data.algorithmUsed}`);
        console.log(`   Personalized: ${data.data.personalizedResults}`);
        console.log(`   Total count: ${data.data.totalCount}`);
        
        if (data.data.results.length > 0) {
          const topResult = data.data.results[0];
          console.log(`   Top result: "${topResult.title}" (score: ${topResult.relevanceScore.toFixed(3)})`);
        }
      } else {
        console.log(`❌ Search for "${query}" failed:`, data.error);
      }
    } catch (error) {
      console.log(`❌ Search for "${query}" error:`, error.message);
    }
  }
}

/**
 * Test personalized recommendations
 */
async function testPersonalizedRecommendations() {
  console.log('\n🎯 Testing Personalized Recommendations...');
  
  try {
    const response = await fetch(`${API_BASE}/advanced-search/recommendations?limit=8`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Personalized recommendations successful');
      console.log(`   Recommendations: ${data.data.recommendations.length}`);
      console.log(`   User ID: ${data.data.userId}`);
      
      if (data.data.recommendations.length > 0) {
        const topRec = data.data.recommendations[0];
        console.log(`   Top recommendation: "${topRec.title}"`);
        console.log(`   Personalized score: ${topRec.personalizedScore?.toFixed(3) || 'N/A'}`);
      }
    } else {
      console.log('❌ Personalized recommendations failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Personalized recommendations error:', error.message);
  }
}

/**
 * Test trending content
 */
async function testTrendingContent() {
  console.log('\n📈 Testing Trending Content...');
  
  const timeframes = ['1h', '24h', '7d'];
  
  for (const timeframe of timeframes) {
    try {
      const response = await fetch(`${API_BASE}/advanced-search/trending?timeframe=${timeframe}&limit=5`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`✅ Trending content (${timeframe}) successful`);
        console.log(`   Trending items: ${data.data.trending.length}`);
        console.log(`   Timeframe: ${data.data.timeframe}`);
        
        if (data.data.trending.length > 0) {
          const topTrending = data.data.trending[0];
          console.log(`   Top trending: "${topTrending.title}"`);
        }
      } else {
        console.log(`❌ Trending content (${timeframe}) failed:`, data.error);
      }
    } catch (error) {
      console.log(`❌ Trending content (${timeframe}) error:`, error.message);
    }
  }
}

/**
 * Test interaction tracking
 */
async function testInteractionTracking() {
  console.log('\n📊 Testing Interaction Tracking...');
  
  const interactions = [
    { contentId: 'content-123', interactionType: 'view', dwellTime: 5000 },
    { contentId: 'content-456', interactionType: 'click', dwellTime: 2000 },
    { contentId: 'content-789', interactionType: 'like' },
    { contentId: 'content-123', interactionType: 'dwell', dwellTime: 15000 },
    { contentId: 'content-456', interactionType: 'purchase' }
  ];

  for (const interaction of interactions) {
    try {
      const response = await fetch(`${API_BASE}/advanced-search/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({
          ...interaction,
          sessionId: testSessionId,
          metadata: {
            source: 'test',
            timestamp: new Date().toISOString()
          }
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`✅ Tracked ${interaction.interactionType} interaction for ${interaction.contentId}`);
      } else {
        console.log(`❌ Failed to track ${interaction.interactionType} interaction:`, data.error);
      }
    } catch (error) {
      console.log(`❌ Interaction tracking error:`, error.message);
    }
  }
}

/**
 * Test search transparency
 */
async function testSearchTransparency() {
  console.log('\n🔍 Testing Search Transparency...');
  
  try {
    const response = await fetch(`${API_BASE}/advanced-search/transparency`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Search transparency successful');
      console.log(`   Algorithms available: ${Object.keys(data.data.algorithms).length}`);
      console.log(`   Exploration rate: ${data.data.banditOptimization.explorationRate}`);
      console.log(`   Personalization enabled: ${!!data.data.personalization}`);
      console.log(`   Quality signals: ${data.data.qualitySignals.signals.length}`);
    } else {
      console.log('❌ Search transparency failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Search transparency error:', error.message);
  }
}

/**
 * Test A/B testing functionality
 */
async function testABTesting() {
  console.log('\n🧪 Testing A/B Testing...');
  
  try {
    const response = await fetch(`${API_BASE}/advanced-search/ab-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        query: 'premium content',
        algorithmA: 'hybrid',
        algorithmB: 'vector',
        filters: {
          category: ['premium'],
          verified: true
        }
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ A/B testing successful');
      console.log(`   Test ID: ${data.data.testId}`);
      console.log(`   Algorithm A (${data.data.algorithmA.name}): ${data.data.algorithmA.results.length} results`);
      console.log(`   Algorithm B (${data.data.algorithmB.name}): ${data.data.algorithmB.results.length} results`);
      
      // Compare top results
      if (data.data.algorithmA.results.length > 0 && data.data.algorithmB.results.length > 0) {
        const topA = data.data.algorithmA.results[0];
        const topB = data.data.algorithmB.results[0];
        console.log(`   Top A: "${topA.title}" (score: ${topA.relevanceScore.toFixed(3)})`);
        console.log(`   Top B: "${topB.title}" (score: ${topB.relevanceScore.toFixed(3)})`);
      }
    } else {
      console.log('❌ A/B testing failed:', data.error);
    }
  } catch (error) {
    console.log('❌ A/B testing error:', error.message);
  }
}

/**
 * Test search analytics
 */
async function testSearchAnalytics() {
  console.log('\n📈 Testing Search Analytics...');
  
  try {
    const response = await fetch(`${API_BASE}/advanced-search/analytics?timeframe=30d`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Search analytics successful');
      console.log(`   Total searches: ${data.data.searchMetrics.totalSearches}`);
      console.log(`   Average CTR: ${(data.data.searchMetrics.conversionRate * 100).toFixed(2)}%`);
      console.log(`   Profile completeness: ${(data.data.personalizationMetrics.profileCompleteness * 100).toFixed(1)}%`);
      console.log(`   Personalization improvement: ${(data.data.personalizationMetrics.improvementRate * 100).toFixed(1)}%`);
      
      // Show algorithm performance
      console.log('   Algorithm performance:');
      Object.entries(data.data.algorithmPerformance).forEach(([algo, perf]) => {
        console.log(`     ${algo}: ${(perf.usage * 100).toFixed(1)}% usage, ${(perf.ctr * 100).toFixed(2)}% CTR`);
      });
    } else {
      console.log('❌ Search analytics failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Search analytics error:', error.message);
  }
}

/**
 * Test advanced filtering
 */
async function testAdvancedFiltering() {
  console.log('\n🔧 Testing Advanced Filtering...');
  
  const filterTests = [
    {
      name: 'Category and price filter',
      filters: {
        category: ['premium', 'exclusive'],
        priceRange: { min: 5, max: 50 }
      }
    },
    {
      name: 'Duration and verification filter',
      filters: {
        duration: { min: 10, max: 25 },
        verified: true,
        premium: true
      }
    },
    {
      name: 'Tag-based filter',
      filters: {
        tags: ['hd', 'exclusive', 'behind-scenes']
      }
    }
  ];

  for (const test of filterTests) {
    try {
      const response = await fetch(`${API_BASE}/advanced-search/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({
          query: '',
          filters: test.filters,
          limit: 5,
          personalizeResults: false
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`✅ ${test.name} successful`);
        console.log(`   Filtered results: ${data.data.results.length}`);
        console.log(`   Facets available: ${Object.keys(data.data.facets).length}`);
      } else {
        console.log(`❌ ${test.name} failed:`, data.error);
      }
    } catch (error) {
      console.log(`❌ ${test.name} error:`, error.message);
    }
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Advanced Search and Feed Ranking v2 Tests...');
  console.log('Testing against:', API_BASE);
  
  await testHybridSearch();
  await testPersonalizedRecommendations();
  await testTrendingContent();
  await testInteractionTracking();
  await testSearchTransparency();
  await testABTesting();
  await testSearchAnalytics();
  await testAdvancedFiltering();
  
  console.log('\n✨ All Advanced Search tests completed!');
  console.log('\n📋 Summary:');
  console.log('- Hybrid search: BM25 + vector embeddings + popularity signals');
  console.log('- Personalization: User behavior and preference-based ranking');
  console.log('- Multi-armed bandit: Automatic algorithm optimization');
  console.log('- Trending content: Real-time engagement-based ranking');
  console.log('- Interaction tracking: Dwell time and engagement analytics');
  console.log('- Search transparency: Algorithm explanation and factors');
  console.log('- A/B testing: Algorithm comparison and optimization');
  console.log('- Advanced filtering: Multi-dimensional content filtering');
  console.log('- Analytics dashboard: Performance metrics and insights');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testHybridSearch,
  testPersonalizedRecommendations,
  testTrendingContent,
  testInteractionTracking,
  testSearchTransparency,
  testABTesting,
  testSearchAnalytics,
  testAdvancedFiltering,
  runAllTests
};