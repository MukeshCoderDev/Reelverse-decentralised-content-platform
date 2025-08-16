/**
 * k6 Load Test - Payment Processing Scenario
 * Tests payment system capacity and performance
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { config, customMetrics, generateTestUser, generatePaymentData } from '../k6-config.js';

// Payment-specific metrics
const paymentInitiationTime = new Trend('payment_initiation_time');
const paymentCompletionTime = new Trend('payment_completion_time');
const paymentSuccessRate = new Rate('payment_success_rate');
const paymentFailureRate = new Rate('payment_failure_rate');
const fiatPaymentTime = new Trend('fiat_payment_time');
const usdcPaymentTime = new Trend('usdc_payment_time');
const paymentThroughput = new Counter('payment_throughput');

export default function() {
  const user = generateTestUser();
  const paymentData = generatePaymentData();
  
  try {
    // Simulate complete payment flow
    if (paymentData.method === 'fiat') {
      processFiatPayment(user, paymentData);
    } else {
      processUSDCPayment(user, paymentData);
    }
    
    paymentThroughput.add(1);
    
  } catch (error) {
    paymentFailureRate.add(1);
    customMetrics.errorRate.add(1);
    console.error(`Payment failed: ${error}`);
  }
}

function processFiatPayment(user, paymentData) {
  const paymentStart = Date.now();
  
  // 1. User authentication
  authenticateUser(user);
  
  // 2. Navigate to content
  const contentResponse = http.get(`${config.baseUrl}/content/${paymentData.contentId}`);
  check(contentResponse, {
    'content page loads': (r) => r.status === 200,
  });
  
  // 3. Initiate payment
  const initiationStart = Date.now();
  const paymentRequest = {
    contentId: paymentData.contentId,
    userAddress: user.walletAddress,
    amount: paymentData.amount,
    entitlementType: 'ppv'
  };
  
  const prepareResponse = http.post(
    `${config.apiUrl}/api/v1/payments/fiat/prepare`,
    JSON.stringify(paymentRequest),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(prepareResponse, {
    'fiat payment preparation successful': (r) => r.status === 200,
    'payment prep time < 5s': (r) => r.timings.duration < 5000,
  });
  
  paymentInitiationTime.add(Date.now() - initiationStart);
  
  if (prepareResponse.status !== 200) {
    throw new Error('Payment preparation failed');
  }
  
  const paymentSession = JSON.parse(prepareResponse.body);
  
  // 4. Simulate hosted checkout (CCBill/Segpay)
  sleep(5, 15); // User fills payment form
  
  // 5. Mock payment completion webhook
  const completionStart = Date.now();
  const confirmResponse = http.post(
    `${config.apiUrl}/api/v1/payments/confirm`,
    JSON.stringify({
      transactionId: paymentSession.data.sessionId,
      method: 'fiat',
      contentId: paymentData.contentId,
      userAddress: user.walletAddress,
      entitlementType: 'ppv'
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(confirmResponse, {
    'fiat payment confirmation successful': (r) => r.status === 200,
    'payment confirmation time < 10s': (r) => r.timings.duration < 10000,
  });
  
  const completionTime = Date.now() - completionStart;
  paymentCompletionTime.add(completionTime);
  
  const totalPaymentTime = Date.now() - paymentStart;
  fiatPaymentTime.add(totalPaymentTime);
  
  if (confirmResponse.status === 200) {
    paymentSuccessRate.add(1);
    
    // 6. Verify content access
    verifyContentAccess(user, paymentData.contentId);
  } else {
    paymentFailureRate.add(1);
    throw new Error('Payment confirmation failed');
  }
}

function processUSDCPayment(user, paymentData) {
  const paymentStart = Date.now();
  
  // 1. User authentication
  authenticateUser(user);
  
  // 2. Navigate to content
  const contentResponse = http.get(`${config.baseUrl}/content/${paymentData.contentId}`);
  check(contentResponse, {
    'content page loads': (r) => r.status === 200,
  });
  
  // 3. Prepare USDC payment
  const initiationStart = Date.now();
  const paymentRequest = {
    contentId: paymentData.contentId,
    userAddress: user.walletAddress,
    amount: config.payments.usdcAmount,
    entitlementType: 'ppv'
  };
  
  const prepareResponse = http.post(
    `${config.apiUrl}/api/v1/payments/usdc/prepare`,
    JSON.stringify(paymentRequest),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(prepareResponse, {
    'usdc payment preparation successful': (r) => r.status === 200,
    'usdc prep time < 3s': (r) => r.timings.duration < 3000,
  });
  
  paymentInitiationTime.add(Date.now() - initiationStart);
  
  if (prepareResponse.status !== 200) {
    throw new Error('USDC payment preparation failed');
  }
  
  // 4. Simulate permit signing and transaction
  sleep(3, 8); // User signs permit and transaction
  
  // 5. Mock blockchain transaction confirmation
  const completionStart = Date.now();
  const mockTxHash = '0x' + Math.random().toString(16).substr(2, 64);
  
  const confirmResponse = http.post(
    `${config.apiUrl}/api/v1/payments/confirm`,
    JSON.stringify({
      transactionId: mockTxHash,
      method: 'usdc',
      contentId: paymentData.contentId,
      userAddress: user.walletAddress,
      entitlementType: 'ppv'
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(confirmResponse, {
    'usdc payment confirmation successful': (r) => r.status === 200,
    'usdc confirmation time < 30s': (r) => r.timings.duration < 30000,
  });
  
  const completionTime = Date.now() - completionStart;
  paymentCompletionTime.add(completionTime);
  
  const totalPaymentTime = Date.now() - paymentStart;
  usdcPaymentTime.add(totalPaymentTime);
  
  if (confirmResponse.status === 200) {
    paymentSuccessRate.add(1);
    
    // 6. Verify content access
    verifyContentAccess(user, paymentData.contentId);
  } else {
    paymentFailureRate.add(1);
    throw new Error('USDC payment confirmation failed');
  }
}

function authenticateUser(user) {
  // Mock authentication flow
  const authResponse = http.post(
    `${config.apiUrl}/api/v1/auth/siwe/nonce`,
    JSON.stringify({ address: user.walletAddress }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(authResponse, {
    'auth nonce generated': (r) => r.status === 200,
  });
  
  if (authResponse.status === 200) {
    const verifyResponse = http.post(
      `${config.apiUrl}/api/v1/auth/siwe/verify`,
      JSON.stringify({
        message: 'mock-siwe-message',
        signature: 'mock-signature'
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    
    check(verifyResponse, {
      'auth verification successful': (r) => r.status === 200,
    });
  }
  
  sleep(1, 2);
}

function verifyContentAccess(user, contentId) {
  const accessResponse = http.get(
    `${config.apiUrl}/api/v1/payments/entitlement/${contentId}/${user.walletAddress}`
  );
  
  check(accessResponse, {
    'content access verified': (r) => r.status === 200,
    'access check time < 1s': (r) => r.timings.duration < 1000,
  });
  
  if (accessResponse.status === 200) {
    const entitlement = JSON.parse(accessResponse.body);
    check(entitlement, {
      'user has content access': (e) => e.data.hasEntitlement === true,
    });
  }
}

// Test subscription payments
function processSubscriptionPayment(user) {
  const subscriptionStart = Date.now();
  
  authenticateUser(user);
  
  // Navigate to creator subscription page
  const creatorResponse = http.get(`${config.baseUrl}/creator/test-creator`);
  check(creatorResponse, {
    'creator page loads': (r) => r.status === 200,
  });
  
  // Initiate subscription
  const subRequest = {
    creatorId: 'test-creator',
    userAddress: user.walletAddress,
    amount: config.payments.subscriptionAmount,
    entitlementType: 'subscription',
    subscriptionDuration: 30 // 30 days
  };
  
  const subResponse = http.post(
    `${config.apiUrl}/api/v1/payments/fiat/prepare`,
    JSON.stringify(subRequest),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(subResponse, {
    'subscription payment prepared': (r) => r.status === 200,
  });
  
  // Simulate payment completion
  sleep(8, 20);
  
  const confirmResponse = http.post(
    `${config.apiUrl}/api/v1/payments/confirm`,
    JSON.stringify({
      transactionId: 'sub_' + Math.random().toString(36).substr(2, 9),
      method: 'fiat',
      creatorId: 'test-creator',
      userAddress: user.walletAddress,
      entitlementType: 'subscription'
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(confirmResponse, {
    'subscription confirmed': (r) => r.status === 200,
  });
  
  const subscriptionTime = Date.now() - subscriptionStart;
  customMetrics.paymentDuration.add(subscriptionTime);
}

// Setup function
export function setup() {
  console.log('Starting payment processing load test');
  
  // Verify payment endpoints
  const healthCheck = http.get(`${config.apiUrl}/health`);
  if (healthCheck.status !== 200) {
    console.warn('API health check failed, continuing with test');
  }
  
  return { startTime: Date.now() };
}

// Teardown function
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`Payment processing test completed in ${duration}ms`);
  
  // Log final metrics
  console.log('Payment processing metrics:');
  console.log(`- Total payments processed: ${paymentThroughput.count}`);
  console.log(`- Payment success rate: ${(paymentSuccessRate.rate * 100).toFixed(2)}%`);
  console.log(`- Payment failure rate: ${(paymentFailureRate.rate * 100).toFixed(2)}%`);
}