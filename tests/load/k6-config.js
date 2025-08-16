/**
 * k6 Load Testing Configuration
 * Go-Live Sprint - Concurrent Users and Payments
 */

export const options = {
  // Test scenarios for different load patterns
  scenarios: {
    // Baseline load - normal traffic
    baseline_load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      tags: { test_type: 'baseline' },
    },
    
    // Peak load - high traffic periods
    peak_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },  // Ramp up
        { duration: '5m', target: 200 },  // Peak load
        { duration: '2m', target: 0 },    // Ramp down
      ],
      tags: { test_type: 'peak' },
    },
    
    // Stress test - beyond normal capacity
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '5m', target: 500 },  // Stress level
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'stress' },
    },
    
    // Spike test - sudden traffic spikes
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '30s', target: 1000 }, // Sudden spike
        { duration: '1m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      tags: { test_type: 'spike' },
    },
    
    // Payment load test - focused on payment processing
    payment_load: {
      executor: 'constant-arrival-rate',
      rate: 10, // 10 payments per second
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 50,
      maxVUs: 200,
      tags: { test_type: 'payment' },
    },
    
    // Video streaming load
    streaming_load: {
      executor: 'constant-vus',
      vus: 300,
      duration: '10m',
      tags: { test_type: 'streaming' },
    }
  },
  
  // Performance thresholds - SLA requirements
  thresholds: {
    // HTTP request duration
    http_req_duration: [
      'p(95)<2000',    // 95% of requests under 2s
      'p(99)<5000',    // 99% of requests under 5s
    ],
    
    // HTTP request failure rate
    http_req_failed: ['rate<0.02'], // Less than 2% failures
    
    // Custom metrics thresholds
    payment_duration: ['p(95)<30000'], // Payment completion under 30s
    video_join_time: ['p(95)<2000'],   // Video join under 2s
    api_response_time: ['p(95)<1000'], // API responses under 1s
    
    // Concurrent user thresholds
    concurrent_users: ['value>100'],   // Support 100+ concurrent users
    payment_throughput: ['rate>5'],    // 5+ payments per second
  },
  
  // Test configuration
  noConnectionReuse: false,
  userAgent: 'k6-load-test/1.0 (Go-Live Sprint)',
  
  // Output configuration
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  
  // Environment-specific settings
  ext: {
    loadimpact: {
      projectID: process.env.K6_PROJECT_ID || 'go-live-sprint',
      name: 'Go-Live Sprint Load Test',
    }
  }
};

// Base URLs for different environments
export const config = {
  baseUrl: __ENV.BASE_URL || 'http://localhost:5173',
  apiUrl: __ENV.API_URL || 'http://localhost:3001',
  
  // Test user credentials
  testUsers: {
    creator: {
      email: 'load-test-creator@test.com',
      walletAddress: '0x1234567890123456789012345678901234567890'
    },
    consumer: {
      email: 'load-test-consumer@test.com', 
      walletAddress: '0x2345678901234567890123456789012345678901'
    }
  },
  
  // Test content IDs
  testContent: {
    freeVideo: 'load-test-free-video',
    premiumVideo: 'load-test-premium-video',
    subscription: 'load-test-subscription'
  },
  
  // Payment test data
  payments: {
    usdcAmount: 10000000, // 10 USDC (6 decimals)
    fiatAmount: 9.99,     // $9.99 USD
    subscriptionAmount: 29.99 // $29.99 USD
  }
};

// Custom metrics
export const customMetrics = {
  paymentDuration: new Trend('payment_duration'),
  videoJoinTime: new Trend('video_join_time'),
  apiResponseTime: new Trend('api_response_time'),
  concurrentUsers: new Counter('concurrent_users'),
  paymentThroughput: new Rate('payment_throughput'),
  errorRate: new Rate('error_rate'),
  rebufferRate: new Rate('rebuffer_rate')
};

// Test data generators
export function generateTestUser() {
  const userId = Math.random().toString(36).substr(2, 9);
  return {
    email: `load-test-${userId}@test.com`,
    walletAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
    userId: userId
  };
}

export function generatePaymentData() {
  return {
    contentId: config.testContent.premiumVideo,
    amount: config.payments.fiatAmount,
    currency: 'USD',
    method: Math.random() > 0.5 ? 'fiat' : 'usdc',
    timestamp: Date.now()
  };
}

// Utility functions
export function sleep(min, max) {
  const duration = min + Math.random() * (max - min);
  return new Promise(resolve => setTimeout(resolve, duration * 1000));
}

export function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function logMetric(name, value, tags = {}) {
  console.log(`METRIC: ${name}=${value} ${JSON.stringify(tags)}`);
}