# k6 Load Testing Suite - Go-Live Sprint

This comprehensive load testing suite validates platform performance under various load conditions to ensure readiness for agency partnerships and high-traffic scenarios.

## Overview

The load testing suite covers 4 critical performance areas:

1. **Concurrent Users** - Platform capacity for simultaneous users
2. **Payment Processing** - Payment system throughput and reliability  
3. **Video Streaming** - Content delivery performance under load
4. **Database Stress** - Backend and database performance limits

## Quick Start

### Prerequisites

```bash
# Install k6
# macOS
brew install k6

# Windows
choco install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Running Load Tests

```bash
# Run all load tests
node tests/load/run-load-tests.js

# Run specific test
node tests/load/run-load-tests.js --single users
node tests/load/run-load-tests.js --single payments
node tests/load/run-load-tests.js --single streaming
node tests/load/run-load-tests.js --single database

# Run individual k6 script
k6 run tests/load/scenarios/concurrent-users.js
```

## Test Scenarios

### 1. Concurrent Users (concurrent-users.js)

Tests platform capacity for simultaneous user sessions.

**Load Patterns:**
- Baseline: 50 concurrent users for 5 minutes
- Peak: Ramp to 200 users over 9 minutes
- Stress: Ramp to 500 users (stress level)
- Spike: Sudden spike to 1000 users

**User Journey Simulation:**
- Landing page visits
- Content browsing (explore, trending, following)
- User authentication (30% of users)
- Premium content interaction (50% of authenticated)
- Creator dashboard visits (20% of authenticated)
- Video streaming (60% of all users)
- Random navigation patterns

**SLA Requirements:**
- Page load time: P95 < 3 seconds
- Navigation time: P95 < 2 seconds
- Authentication: P95 < 1 second
- Error rate: < 2%

### 2. Payment Processing (payment-processing.js)

Tests payment system capacity and performance.

**Load Pattern:**
- Constant arrival rate: 10 payments/second for 10 minutes
- Mixed payment methods: 50% fiat, 50% USDC
- Subscription payments included

**Payment Flow Testing:**
- User authentication
- Content selection
- Payment initiation (fiat/USDC)
- Payment processing simulation
- Payment confirmation
- Content access verification

**SLA Requirements:**
- Payment completion: P95 < 30 seconds
- Payment success rate: > 98%
- USDC payments: P95 < 10 seconds
- Fiat payments: P95 < 60 seconds

### 3. Video Streaming (video-streaming.js)

Tests video delivery and streaming performance.

**Load Pattern:**
- 300 concurrent viewers for 10 minutes
- Mixed content types (free/premium)
- Adaptive bitrate simulation

**Streaming Simulation:**
- Video stream requests
- HLS manifest parsing
- Segment downloading
- Buffer health monitoring
- Quality adaptation
- Rebuffering events
- CDN performance

**SLA Requirements:**
- Video join time: P95 < 2 seconds
- Rebuffer rate: < 1%
- CDN response time: P95 < 1 second
- Streaming error rate: < 1%

### 4. Database Stress (database-stress.js)

Tests backend and database performance under load.

**Load Pattern:**
- Mixed API endpoint testing
- Database query optimization
- Connection pool testing
- Cache performance validation

**Database Operations:**
- User authentication queries
- Content search and filtering
- Payment history queries
- Analytics aggregations
- Write operations (content creation)
- Cache hit/miss ratios

**SLA Requirements:**
- Database query time: P95 < 1 second
- API response time: P95 < 500ms
- Connection error rate: < 1%
- Cache hit rate: > 80%

## Performance Thresholds

### Critical SLA Requirements

```javascript
thresholds: {
  // HTTP Performance
  http_req_duration: ['p(95)<2000'],     // 95% under 2s
  http_req_failed: ['rate<0.02'],        // <2% failures
  
  // Payment Performance  
  payment_duration: ['p(95)<30000'],     // Payments under 30s
  payment_success_rate: ['rate>0.98'],   // >98% success
  
  // Video Performance
  video_join_time: ['p(95)<2000'],       // Join under 2s
  rebuffer_rate: ['rate<0.01'],          // <1% rebuffer
  
  // Database Performance
  db_query_time: ['p(95)<1000'],         // Queries under 1s
  api_response_time: ['p(95)<500'],      // API under 500ms
}
```

### Go/No-Go Criteria

All critical thresholds must pass for go-live approval:

- ✅ Concurrent user capacity: 200+ users
- ✅ Payment throughput: 10+ payments/second
- ✅ Video streaming: 300+ concurrent viewers
- ✅ Database performance: Sub-second queries
- ✅ Error rates: < 2% across all systems
- ✅ SLA compliance: All P95 targets met

## Configuration

### Environment Variables

```bash
# Test environment
export BASE_URL=http://localhost:5173
export API_URL=http://localhost:3001

# k6 Cloud (optional)
export K6_CLOUD_TOKEN=your-token
export K6_PROJECT_ID=go-live-sprint
```

### Test Data Configuration

```javascript
// tests/load/k6-config.js
export const config = {
  baseUrl: 'http://localhost:5173',
  apiUrl: 'http://localhost:3001',
  
  testUsers: {
    creator: { /* test user data */ },
    consumer: { /* test user data */ }
  },
  
  payments: {
    usdcAmount: 10000000,  // 10 USDC
    fiatAmount: 9.99,      // $9.99 USD
  }
};
```

## Results and Reporting

### Output Formats

Load test results are generated in multiple formats:

- **JSON**: Detailed metrics for analysis
- **Summary**: Human-readable test summary
- **Console**: Real-time progress and results

### Results Location

```
tests/load/results/
├── concurrent-users-2024-01-15.json
├── payment-processing-2024-01-15.json
├── video-streaming-2024-01-15.json
├── database-stress-2024-01-15.json
└── load-test-summary.json
```

### Key Metrics Tracked

**Performance Metrics:**
- Response times (avg, p95, p99)
- Throughput (requests/second)
- Error rates and types
- Resource utilization

**Business Metrics:**
- Payment success rates
- Video join times
- User session durations
- Content access patterns

**System Metrics:**
- Database query performance
- Cache hit rates
- CDN performance
- Connection pool utilization

## Monitoring and Alerting

### Real-time Monitoring

During load tests, monitor:

- Server CPU and memory usage
- Database connection counts
- CDN cache hit rates
- Payment processor response times
- Video streaming quality metrics

### Alert Thresholds

Set up alerts for:
- Response time > P95 thresholds
- Error rate > 2%
- Database connection pool exhaustion
- Payment failure rate > 2%
- Video rebuffer rate > 1%

## Troubleshooting

### Common Issues

1. **High Response Times**
   - Check database query optimization
   - Verify CDN configuration
   - Review connection pool settings

2. **Payment Failures**
   - Validate payment processor endpoints
   - Check blockchain node connectivity
   - Review transaction timeout settings

3. **Video Streaming Issues**
   - Verify CDN health
   - Check HLS segment generation
   - Review adaptive bitrate logic

4. **Database Bottlenecks**
   - Analyze slow query logs
   - Check connection pool limits
   - Review index usage

### Debug Commands

```bash
# Run with verbose output
k6 run --verbose tests/load/scenarios/concurrent-users.js

# Run with custom duration
k6 run --duration 30s tests/load/scenarios/payment-processing.js

# Run with specific VU count
k6 run --vus 100 tests/load/scenarios/video-streaming.js

# Generate detailed HTML report
k6 run --out json=results.json tests/load/scenarios/database-stress.js
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Load Tests
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      - name: Run Load Tests
        run: node tests/load/run-load-tests.js
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: tests/load/results/
```

### Performance Regression Detection

Set up automated performance regression detection:

1. Store baseline performance metrics
2. Compare current results to baseline
3. Alert on significant performance degradation
4. Block deployments if critical thresholds fail

## Best Practices

### Test Design

1. **Realistic Load Patterns**: Model actual user behavior
2. **Gradual Ramp-up**: Avoid sudden load spikes in tests
3. **Mixed Scenarios**: Combine different user types and actions
4. **Data Cleanup**: Clean up test data after runs

### Performance Optimization

1. **Database Indexing**: Ensure proper indexes for queries
2. **Connection Pooling**: Configure appropriate pool sizes
3. **Caching Strategy**: Implement effective caching layers
4. **CDN Configuration**: Optimize content delivery

### Monitoring

1. **Baseline Establishment**: Record performance baselines
2. **Trend Analysis**: Track performance over time
3. **Alerting**: Set up proactive performance alerts
4. **Capacity Planning**: Use results for scaling decisions

## Support

For load testing issues:

1. Check k6 documentation: https://k6.io/docs/
2. Review test results in `tests/load/results/`
3. Analyze server logs during test execution
4. Monitor system resources during tests
5. Validate test configuration and thresholds

## Contributing

When adding new load tests:

1. Follow existing test structure and patterns
2. Include appropriate SLA thresholds
3. Add comprehensive error handling
4. Document test scenarios and expected behavior
5. Update this README with new test information