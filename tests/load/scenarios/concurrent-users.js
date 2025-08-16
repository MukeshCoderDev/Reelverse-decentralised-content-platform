/**
 * k6 Load Test - Concurrent Users Scenario
 * Tests platform capacity for simultaneous users
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { config, customMetrics, generateTestUser, randomChoice } from '../k6-config.js';

// Custom metrics for concurrent user testing
const userSessionDuration = new Trend('user_session_duration');
const pageLoadTime = new Trend('page_load_time');
const navigationTime = new Trend('navigation_time');
const concurrentSessions = new Counter('concurrent_sessions');

export default function() {
  const user = generateTestUser();
  const sessionStart = Date.now();
  
  // Track concurrent session
  concurrentSessions.add(1);
  
  try {
    // Simulate realistic user journey
    simulateUserSession(user);
  } catch (error) {
    customMetrics.errorRate.add(1);
    console.error(`User session failed: ${error}`);
  } finally {
    // Track session duration
    const sessionDuration = Date.now() - sessionStart;
    userSessionDuration.add(sessionDuration);
  }
}

function simulateUserSession(user) {
  // 1. Landing page visit
  const landingStart = Date.now();
  const landingResponse = http.get(`${config.baseUrl}/`);
  
  check(landingResponse, {
    'landing page loads': (r) => r.status === 200,
    'landing page load time < 3s': (r) => r.timings.duration < 3000,
  });
  
  pageLoadTime.add(Date.now() - landingStart);
  sleep(1, 3); // User reads content
  
  // 2. Browse content
  browseContent(user);
  
  // 3. User authentication (30% of users)
  if (Math.random() < 0.3) {
    authenticateUser(user);
    
    // 4. Premium content interaction (50% of authenticated users)
    if (Math.random() < 0.5) {
      interactWithPremiumContent(user);
    }
    
    // 5. Creator dashboard (20% of authenticated users)
    if (Math.random() < 0.2) {
      visitCreatorDashboard(user);
    }
  }
  
  // 6. Video streaming (60% of all users)
  if (Math.random() < 0.6) {
    streamVideo(user);
  }
  
  // 7. Random navigation
  randomNavigation(user);
}

function browseContent(user) {
  const pages = ['/explore', '/trending', '/following'];
  
  for (let i = 0; i < 3; i++) {
    const page = randomChoice(pages);
    const navStart = Date.now();
    
    const response = http.get(`${config.baseUrl}${page}`);
    
    check(response, {
      [`${page} loads successfully`]: (r) => r.status === 200,
      [`${page} loads quickly`]: (r) => r.timings.duration < 2000,
    });
    
    navigationTime.add(Date.now() - navStart);
    sleep(2, 5); // User browses content
  }
}

function authenticateUser(user) {
  // Mock wallet connection
  const authStart = Date.now();
  
  const authResponse = http.post(`${config.apiUrl}/api/v1/auth/siwe/nonce`, 
    JSON.stringify({ address: user.walletAddress }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(authResponse, {
    'auth nonce generated': (r) => r.status === 200,
    'auth response time < 1s': (r) => r.timings.duration < 1000,
  });
  
  if (authResponse.status === 200) {
    // Mock SIWE verification
    const verifyResponse = http.post(`${config.apiUrl}/api/v1/auth/siwe/verify`,
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
  
  customMetrics.apiResponseTime.add(Date.now() - authStart);
  sleep(1, 2);
}

function interactWithPremiumContent(user) {
  // Visit premium content
  const contentResponse = http.get(`${config.baseUrl}/content/${config.testContent.premiumVideo}`);
  
  check(contentResponse, {
    'premium content page loads': (r) => r.status === 200,
  });
  
  sleep(2, 4); // User considers purchase
  
  // Check entitlement
  const entitlementResponse = http.get(
    `${config.apiUrl}/api/v1/payments/entitlement/${config.testContent.premiumVideo}/${user.walletAddress}`
  );
  
  check(entitlementResponse, {
    'entitlement check responds': (r) => r.status === 200,
  });
  
  sleep(1, 2);
}

function visitCreatorDashboard(user) {
  const dashboardPages = ['/studio', '/studio/content', '/studio/analytics', '/earnings'];
  
  for (const page of dashboardPages) {
    const response = http.get(`${config.baseUrl}${page}`);
    
    check(response, {
      [`creator ${page} loads`]: (r) => r.status === 200,
    });
    
    sleep(3, 6); // Creator reviews dashboard
  }
}

function streamVideo(user) {
  const videoStart = Date.now();
  
  // Request video stream
  const streamResponse = http.get(`${config.apiUrl}/api/v1/content/${config.testContent.freeVideo}/stream`);
  
  check(streamResponse, {
    'video stream available': (r) => r.status === 200,
    'video stream starts quickly': (r) => r.timings.duration < 2000,
  });
  
  const joinTime = Date.now() - videoStart;
  customMetrics.videoJoinTime.add(joinTime);
  
  // Simulate video watching (30s to 5min)
  const watchDuration = 30 + Math.random() * 270; // 30s to 5min
  sleep(watchDuration);
  
  // Simulate occasional rebuffering (5% chance)
  if (Math.random() < 0.05) {
    customMetrics.rebufferRate.add(1);
    sleep(2, 5); // Rebuffer delay
  }
}

function randomNavigation(user) {
  const pages = [
    '/', '/explore', '/trending', '/communities', 
    '/help', '/settings', '/wallet'
  ];
  
  // Visit 2-4 random pages
  const pageCount = 2 + Math.floor(Math.random() * 3);
  
  for (let i = 0; i < pageCount; i++) {
    const page = randomChoice(pages);
    const response = http.get(`${config.baseUrl}${page}`);
    
    check(response, {
      [`random page ${page} loads`]: (r) => r.status === 200,
    });
    
    sleep(1, 3);
  }
}

// Setup function - runs once per VU
export function setup() {
  console.log('Starting concurrent users load test');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`API URL: ${config.apiUrl}`);
  
  // Verify endpoints are accessible
  const healthCheck = http.get(`${config.baseUrl}/`);
  if (healthCheck.status !== 200) {
    throw new Error(`Application not accessible: ${healthCheck.status}`);
  }
  
  return { startTime: Date.now() };
}

// Teardown function - runs once after all VUs finish
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`Concurrent users test completed in ${duration}ms`);
}