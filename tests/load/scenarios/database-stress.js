/**
 * k6 Load Test - Database and API Stress Testing
 * Tests backend performance under load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { config, customMetrics, generateTestUser, randomChoice } from '../k6-config.js';

// Database and API metrics
const dbQueryTime = new Trend('db_query_time');
const apiResponseTime = new Trend('api_response_time');
const dbConnectionErrors = new Rate('db_connection_errors');
const apiErrorRate = new Rate('api_error_rate');
const cacheHitRate = new Rate('cache_hit_rate');
const cacheMissRate = new Rate('cache_miss_rate');
const dbTransactionTime = new Trend('db_transaction_time');
const concurrentConnections = new Counter('concurrent_connections');

// API endpoints to stress test
const apiEndpoints = [
  { path: '/api/v1/content/trending', method: 'GET', weight: 30 },
  { path: '/api/v1/content/search', method: 'GET', weight: 25 },
  { path: '/api/v1/users/profile', method: 'GET', weight: 20 },
  { path: '/api/v1/payments/history', method: 'GET', weight: 10 },
  { path: '/api/v1/analytics/metrics', method: 'GET', weight: 8 },
  { path: '/api/v1/content/upload', method: 'POST', weight: 5 },
  { path: '/api/v1/users/update', method: 'PUT', weight: 2 }
];

export default function() {
  const user = generateTestUser();
  concurrentConnections.add(1);
  
  try {
    // Simulate mixed API usage patterns
    performDatabaseStressTest(user);
    
  } catch (error) {
    apiErrorRate.add(1);
    console.error(`Database stress test failed: ${error}`);
  }
}

function performDatabaseStressTest(user) {
  // 1. Authentication (database lookup)
  testUserAuthentication(user);
  
  // 2. Content queries (heavy database reads)
  testContentQueries(user);
  
  // 3. User profile operations
  testUserProfileOperations(user);
  
  // 4. Payment history queries
  testPaymentQueries(user);
  
  // 5. Analytics queries (complex aggregations)
  testAnalyticsQueries(user);
  
  // 6. Write operations (database stress)
  testWriteOperations(user);
  
  // 7. Cache performance testing
  testCachePerformance(user);
}

function testUserAuthentication(user) {
  const authStart = Date.now();
  
  // Simulate user lookup
  const userLookupResponse = http.get(
    `${config.apiUrl}/api/v1/users/${user.walletAddress}`,
    {
      headers: { 'Authorization': `Bearer mock-token-${user.userId}` }
    }
  );
  
  const authTime = Date.now() - authStart;
  dbQueryTime.add(authTime);
  customMetrics.apiResponseTime.add(authTime);
  
  check(userLookupResponse, {
    'user lookup successful': (r) => r.status === 200,
    'user lookup time < 500ms': (r) => r.timings.duration < 500,
  });
  
  if (userLookupResponse.status !== 200) {
    dbConnectionErrors.add(1);
  }
  
  // Simulate session creation
  const sessionResponse = http.post(
    `${config.apiUrl}/api/v1/auth/session`,
    JSON.stringify({ userId: user.userId, walletAddress: user.walletAddress }),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );
  
  check(sessionResponse, {
    'session creation successful': (r) => r.status === 200,
  });
}

function testContentQueries(user) {
  // Test various content query patterns
  const queryTypes = [
    { endpoint: '/api/v1/content/trending', params: '?limit=20&offset=0' },
    { endpoint: '/api/v1/content/search', params: '?q=test&category=video&limit=10' },
    { endpoint: '/api/v1/content/recommendations', params: `?userId=${user.userId}&limit=15` },
    { endpoint: '/api/v1/content/category/adult', params: '?limit=25&sort=recent' }
  ];
  
  for (const query of queryTypes) {
    const queryStart = Date.now();
    
    const response = http.get(`${config.apiUrl}${query.endpoint}${query.params}`);
    
    const queryTime = Date.now() - queryStart;
    dbQueryTime.add(queryTime);
    
    check(response, {
      [`${query.endpoint} query successful`]: (r) => r.status === 200,
      [`${query.endpoint} query time < 1s`]: (r) => r.timings.duration < 1000,
    });
    
    // Check for cache headers
    if (response.headers['X-Cache-Status']) {
      if (response.headers['X-Cache-Status'] === 'HIT') {
        cacheHitRate.add(1);
      } else {
        cacheMissRate.add(1);
      }
    }
    
    sleep(0.1, 0.5); // Brief pause between queries
  }
}

function testUserProfileOperations(user) {
  // Read user profile
  const profileStart = Date.now();
  const profileResponse = http.get(`${config.apiUrl}/api/v1/users/profile/${user.userId}`);
  
  dbQueryTime.add(Date.now() - profileStart);
  
  check(profileResponse, {
    'profile read successful': (r) => r.status === 200,
    'profile read time < 300ms': (r) => r.timings.duration < 300,
  });
  
  // Update user preferences (write operation)
  const updateStart = Date.now();
  const updateResponse = http.put(
    `${config.apiUrl}/api/v1/users/profile/${user.userId}`,
    JSON.stringify({
      preferences: {
        notifications: Math.random() > 0.5,
        privacy: randomChoice(['public', 'private', 'friends']),
        language: randomChoice(['en', 'es', 'fr', 'de'])
      }
    }),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );
  
  const updateTime = Date.now() - updateStart;
  dbTransactionTime.add(updateTime);
  
  check(updateResponse, {
    'profile update successful': (r) => r.status === 200,
    'profile update time < 1s': (r) => r.timings.duration < 1000,
  });
}

function testPaymentQueries(user) {
  // Payment history query (potentially large dataset)
  const historyStart = Date.now();
  const historyResponse = http.get(
    `${config.apiUrl}/api/v1/payments/history/${user.walletAddress}?limit=50&offset=0`
  );
  
  dbQueryTime.add(Date.now() - historyStart);
  
  check(historyResponse, {
    'payment history query successful': (r) => r.status === 200,
    'payment history time < 2s': (r) => r.timings.duration < 2000,
  });
  
  // Payment analytics query
  const analyticsStart = Date.now();
  const analyticsResponse = http.get(
    `${config.apiUrl}/api/v1/payments/analytics/${user.walletAddress}?period=30d`
  );
  
  dbQueryTime.add(Date.now() - analyticsStart);
  
  check(analyticsResponse, {
    'payment analytics successful': (r) => r.status === 200,
    'payment analytics time < 3s': (r) => r.timings.duration < 3000,
  });
}

function testAnalyticsQueries(user) {
  // Complex aggregation queries
  const analyticsQueries = [
    '/api/v1/analytics/revenue/daily?days=30',
    '/api/v1/analytics/users/active?period=7d',
    '/api/v1/analytics/content/performance?limit=100',
    '/api/v1/analytics/payments/conversion?period=30d'
  ];
  
  for (const query of analyticsQueries) {
    const queryStart = Date.now();
    
    const response = http.get(`${config.apiUrl}${query}`);
    
    const queryTime = Date.now() - queryStart;
    dbQueryTime.add(queryTime);
    
    check(response, {
      [`analytics query ${query} successful`]: (r) => r.status === 200,
      [`analytics query ${query} time < 5s`]: (r) => r.timings.duration < 5000,
    });
    
    sleep(0.5, 1); // Analytics queries are expensive
  }
}

function testWriteOperations(user) {
  // Simulate content creation (write-heavy operation)
  const contentData = {
    title: `Load Test Content ${Date.now()}`,
    description: 'Generated content for load testing',
    category: 'test',
    tags: ['load-test', 'performance'],
    creatorId: user.userId,
    price: Math.random() * 50
  };
  
  const createStart = Date.now();
  const createResponse = http.post(
    `${config.apiUrl}/api/v1/content/create`,
    JSON.stringify(contentData),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );
  
  const createTime = Date.now() - createStart;
  dbTransactionTime.add(createTime);
  
  check(createResponse, {
    'content creation successful': (r) => r.status === 201,
    'content creation time < 2s': (r) => r.timings.duration < 2000,
  });
  
  if (createResponse.status === 201) {
    const contentId = JSON.parse(createResponse.body).data.id;
    
    // Update content metadata
    const updateStart = Date.now();
    const updateResponse = http.put(
      `${config.apiUrl}/api/v1/content/${contentId}`,
      JSON.stringify({
        description: 'Updated description for load test',
        tags: ['load-test', 'performance', 'updated']
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    dbTransactionTime.add(Date.now() - updateStart);
    
    check(updateResponse, {
      'content update successful': (r) => r.status === 200,
    });
  }
}

function testCachePerformance(user) {
  // Test cache performance with repeated requests
  const cacheTestEndpoint = `${config.apiUrl}/api/v1/content/trending?limit=20`;
  
  // First request (should be cache miss)
  const firstResponse = http.get(cacheTestEndpoint);
  check(firstResponse, {
    'first cache request successful': (r) => r.status === 200,
  });
  
  // Immediate second request (should be cache hit)
  const secondResponse = http.get(cacheTestEndpoint);
  check(secondResponse, {
    'second cache request successful': (r) => r.status === 200,
    'cached response faster': (r) => r.timings.duration < firstResponse.timings.duration,
  });
  
  // Check cache headers
  if (secondResponse.headers['X-Cache-Status'] === 'HIT') {
    cacheHitRate.add(1);
  } else {
    cacheMissRate.add(1);
  }
}

// Test database connection pooling
function testConnectionPooling() {
  // Simulate multiple concurrent database operations
  const operations = [];
  
  for (let i = 0; i < 10; i++) {
    operations.push(
      http.asyncRequest('GET', `${config.apiUrl}/api/v1/content/random`)
    );
  }
  
  // Wait for all operations to complete
  const responses = http.batch(operations);
  
  let successCount = 0;
  responses.forEach((response, index) => {
    if (response.status === 200) {
      successCount++;
    } else {
      dbConnectionErrors.add(1);
    }
  });
  
  check(responses, {
    'connection pool handles concurrent requests': () => successCount >= 8, // 80% success rate
  });
}

// Setup function
export function setup() {
  console.log('Starting database stress test');
  
  // Verify database connectivity
  const dbHealthCheck = http.get(`${config.apiUrl}/api/v1/health/database`);
  if (dbHealthCheck.status !== 200) {
    console.warn('Database health check failed');
  }
  
  return { startTime: Date.now() };
}

// Teardown function
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`Database stress test completed in ${duration}ms`);
  
  // Log database metrics
  console.log('Database performance metrics:');
  console.log(`- Concurrent connections: ${concurrentConnections.count}`);
  console.log(`- DB connection error rate: ${(dbConnectionErrors.rate * 100).toFixed(2)}%`);
  console.log(`- API error rate: ${(apiErrorRate.rate * 100).toFixed(2)}%`);
  console.log(`- Cache hit rate: ${(cacheHitRate.rate * 100).toFixed(2)}%`);
}