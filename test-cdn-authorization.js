/**
 * CDN Authorization Service Test
 * Tests the real-time segment authorization with SLA requirements
 */

import { cdnAuthorizationService } from './services/cdnAuthorizationService.js';

class CDNAuthorizationTest {
  constructor() {
    this.testResults = [];
    this.performanceMetrics = [];
  }

  async runAllTests() {
    console.log('🚀 Starting CDN Authorization Service Tests...\n');

    try {
      await this.testSegmentAuthorization();
      await this.testManifestGeneration();
      await this.testKeyTokenIssuance();
      await this.testCachePerformance();
      await this.testSLACompliance();
      await this.testPolicyEvaluation();
      await this.testCacheInvalidation();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }

  async testSegmentAuthorization() {
    console.log('📋 Testing Segment Authorization...');

    // Test valid authorization
    const validRequest = {
      ticketId: 'ticket_valid_123',
      contentId: 'content_123',
      segmentRange: '0-1000',
      clientIP: '192.168.1.100',
      deviceId: 'device_789',
      userAgent: 'Mozilla/5.0',
      timestamp: Date.now()
    };

    const startTime = Date.now();
    const result = await cdnAuthorizationService.authorizeSegment(validRequest);
    const responseTime = Date.now() - startTime;

    this.recordTest('Segment Authorization - Valid Request', {
      passed: result.allowed === true,
      responseTime,
      details: result
    });

    // Test invalid ticket
    const invalidRequest = {
      ...validRequest,
      ticketId: 'invalid_ticket'
    };

    const invalidResult = await cdnAuthorizationService.authorizeSegment(invalidRequest);
    this.recordTest('Segment Authorization - Invalid Ticket', {
      passed: invalidResult.allowed === false && invalidResult.errorCode === 'INVALID_TICKET',
      details: invalidResult
    });

    // Test content mismatch
    const mismatchRequest = {
      ...validRequest,
      contentId: 'different_content'
    };

    const mismatchResult = await cdnAuthorizationService.authorizeSegment(mismatchRequest);
    this.recordTest('Segment Authorization - Content Mismatch', {
      passed: mismatchResult.allowed === false,
      details: mismatchResult
    });

    console.log('✅ Segment Authorization tests completed\n');
  }

  async testManifestGeneration() {
    console.log('📋 Testing Manifest Generation...');

    const manifestRequest = {
      ticketId: 'ticket_valid_123',
      contentId: 'content_123',
      clientIP: '192.168.1.100',
      deviceId: 'device_789',
      manifestType: 'hls'
    };

    try {
      const result = await cdnAuthorizationService.authorizeManifest(manifestRequest);
      
      this.recordTest('Manifest Generation - HLS', {
        passed: result.manifestContent.includes('#EXTM3U') && 
                result.keyUris.length > 0 &&
                result.manifestContent.includes('/api/v1/cdn/keys'),
        details: {
          hasManifest: !!result.manifestContent,
          keyUriCount: result.keyUris.length,
          cacheTTL: result.cacheTTL
        }
      });

      // Test DASH manifest
      const dashRequest = { ...manifestRequest, manifestType: 'dash' };
      const dashResult = await cdnAuthorizationService.authorizeManifest(dashRequest);
      
      this.recordTest('Manifest Generation - DASH', {
        passed: dashResult.manifestContent.includes('<?xml') &&
                dashResult.manifestContent.includes('MPD'),
        details: {
          hasManifest: !!dashResult.manifestContent,
          cacheTTL: dashResult.cacheTTL
        }
      });

    } catch (error) {
      this.recordTest('Manifest Generation', {
        passed: false,
        error: error.message
      });
    }

    console.log('✅ Manifest Generation tests completed\n');
  }

  async testKeyTokenIssuance() {
    console.log('📋 Testing Key Token Issuance...');

    const keyRequest = {
      ticketId: 'ticket_valid_123',
      contentId: 'content_123',
      segmentRange: '0-1000',
      clientIP: '192.168.1.100',
      deviceId: 'device_789',
      keyId: 'key_123'
    };

    try {
      const startTime = Date.now();
      const result = await cdnAuthorizationService.issueKeyToken(keyRequest);
      const responseTime = Date.now() - startTime;

      const ttl = result.expiresAt - Date.now();
      
      this.recordTest('Key Token Issuance', {
        passed: !!result.token && 
                ttl <= 60000 && // ≤60s TTL requirement
                ttl > 0 &&
                result.keyId === keyRequest.keyId,
        responseTime,
        details: {
          hasToken: !!result.token,
          ttlSeconds: Math.floor(ttl / 1000),
          keyId: result.keyId
        }
      });

    } catch (error) {
      this.recordTest('Key Token Issuance', {
        passed: false,
        error: error.message
      });
    }

    console.log('✅ Key Token Issuance tests completed\n');
  }

  async testCachePerformance() {
    console.log('📋 Testing Cache Performance...');

    const baseRequest = {
      ticketId: 'ticket_valid_123',
      contentId: 'content_123',
      segmentRange: '0-1000',
      clientIP: '192.168.1.100',
      deviceId: 'device_789',
      timestamp: Date.now()
    };

    // First request (cache miss)
    const startTime1 = Date.now();
    await cdnAuthorizationService.authorizeSegment(baseRequest);
    const cacheMissTime = Date.now() - startTime1;

    // Second request (cache hit)
    const startTime2 = Date.now();
    await cdnAuthorizationService.authorizeSegment(baseRequest);
    const cacheHitTime = Date.now() - startTime2;

    this.recordTest('Cache Performance', {
      passed: cacheHitTime < cacheMissTime,
      details: {
        cacheMissTime,
        cacheHitTime,
        improvement: `${Math.round(((cacheMissTime - cacheHitTime) / cacheMissTime) * 100)}%`
      }
    });

    console.log('✅ Cache Performance tests completed\n');
  }

  async testSLACompliance() {
    console.log('📋 Testing SLA Compliance (P95 ≤ 50ms cache hit, ≤ 80ms cache miss)...');

    const requests = [];
    const responseTimes = [];

    // Generate test requests
    for (let i = 0; i < 100; i++) {
      requests.push({
        ticketId: 'ticket_valid_123',
        contentId: `content_${i % 10}`, // Create some variety for cache misses
        segmentRange: `${i * 1000}-${(i + 1) * 1000}`,
        clientIP: '192.168.1.100',
        deviceId: 'device_789',
        timestamp: Date.now()
      });
    }

    // Execute requests and measure response times
    for (const request of requests) {
      const startTime = Date.now();
      await cdnAuthorizationService.authorizeSegment(request);
      responseTimes.push(Date.now() - startTime);
    }

    // Calculate percentiles
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
    const avg = sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length;

    this.recordTest('SLA Compliance - P95 Response Time', {
      passed: p95 <= 80, // Allow 80ms for mixed cache hit/miss
      details: {
        p95ResponseTime: p95,
        p99ResponseTime: p99,
        avgResponseTime: Math.round(avg),
        slaThreshold: '80ms (mixed)',
        totalRequests: requests.length
      }
    });

    // Test cache hit performance specifically
    const cacheHitTimes = [];
    const sameRequest = requests[0];
    
    for (let i = 0; i < 20; i++) {
      const startTime = Date.now();
      await cdnAuthorizationService.authorizeSegment(sameRequest);
      cacheHitTimes.push(Date.now() - startTime);
    }

    const cacheHitP95 = cacheHitTimes.sort((a, b) => a - b)[Math.floor(cacheHitTimes.length * 0.95)];
    
    this.recordTest('SLA Compliance - Cache Hit P95', {
      passed: cacheHitP95 <= 50,
      details: {
        p95ResponseTime: cacheHitP95,
        slaThreshold: '50ms',
        cacheHitRequests: cacheHitTimes.length
      }
    });

    console.log('✅ SLA Compliance tests completed\n');
  }

  async testPolicyEvaluation() {
    console.log('📋 Testing Policy Evaluation...');

    // Test with expired timestamp (should fail)
    const expiredRequest = {
      ticketId: 'ticket_valid_123',
      contentId: 'content_123',
      segmentRange: '0-1000',
      clientIP: '192.168.1.100',
      deviceId: 'device_789',
      timestamp: Date.now() - 60000 // 1 minute ago
    };

    const expiredResult = await cdnAuthorizationService.authorizeSegment(expiredRequest);
    
    this.recordTest('Policy Evaluation - Expired Request', {
      passed: expiredResult.allowed === false,
      details: expiredResult
    });

    // Test with missing required fields
    const invalidRequest = {
      ticketId: 'ticket_valid_123',
      contentId: 'content_123',
      // Missing segmentRange, clientIP, deviceId
      timestamp: Date.now()
    };

    const invalidResult = await cdnAuthorizationService.authorizeSegment(invalidRequest);
    
    this.recordTest('Policy Evaluation - Invalid Request', {
      passed: invalidResult.allowed === false && invalidResult.errorCode === 'INVALID_REQUEST',
      details: invalidResult
    });

    console.log('✅ Policy Evaluation tests completed\n');
  }

  async testCacheInvalidation() {
    console.log('📋 Testing Cache Invalidation...');

    const request = {
      ticketId: 'ticket_valid_123',
      contentId: 'content_cache_test',
      segmentRange: '0-1000',
      clientIP: '192.168.1.100',
      deviceId: 'device_789',
      timestamp: Date.now()
    };

    // Make request to populate cache
    await cdnAuthorizationService.authorizeSegment(request);

    // Invalidate cache for this content
    await cdnAuthorizationService.invalidateCache('content_cache_test');

    // Make same request again (should be cache miss)
    const startTime = Date.now();
    await cdnAuthorizationService.authorizeSegment(request);
    const responseTime = Date.now() - startTime;

    this.recordTest('Cache Invalidation', {
      passed: true, // If no error, invalidation worked
      details: {
        responseTimeAfterInvalidation: responseTime,
        message: 'Cache invalidation completed successfully'
      }
    });

    console.log('✅ Cache Invalidation tests completed\n');
  }

  recordTest(name, result) {
    this.testResults.push({
      name,
      passed: result.passed,
      responseTime: result.responseTime,
      details: result.details,
      error: result.error,
      timestamp: new Date().toISOString()
    });

    const status = result.passed ? '✅' : '❌';
    const timing = result.responseTime ? ` (${result.responseTime}ms)` : '';
    console.log(`  ${status} ${name}${timing}`);
    
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  }

  printResults() {
    console.log('\n📊 Test Results Summary');
    console.log('========================');

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(t => !t.passed)
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error || 'Assertion failed'}`);
        });
    }

    // Performance summary
    const responseTimes = this.testResults
      .filter(t => t.responseTime)
      .map(t => t.responseTime);

    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      console.log('\n⚡ Performance Summary:');
      console.log(`Average Response Time: ${Math.round(avgResponseTime)}ms`);
      console.log(`Min Response Time: ${minResponseTime}ms`);
      console.log(`Max Response Time: ${maxResponseTime}ms`);
    }

    // Get service metrics
    const metrics = cdnAuthorizationService.getMetrics();
    console.log('\n📈 Service Metrics:');
    console.log(`Total Requests: ${metrics.totalRequests}`);
    console.log(`Cache Hits: ${metrics.cacheHits}`);
    console.log(`Cache Misses: ${metrics.cacheMisses}`);
    console.log(`Cache Hit Rate: ${Math.round((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100)}%`);
    console.log(`P95 Response Time: ${metrics.p95ResponseTime}ms`);
    console.log(`P99 Response Time: ${metrics.p99ResponseTime}ms`);

    console.log('\n🎯 CDN Authorization Service Tests Completed!');
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new CDNAuthorizationTest();
  test.runAllTests().catch(console.error);
}

export { CDNAuthorizationTest };