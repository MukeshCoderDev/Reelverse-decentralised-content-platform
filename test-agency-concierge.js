/**
 * Test script for Agency Concierge AI Assistant functionality
 * Tests natural language processing, data retrieval, and multi-channel integration
 */

const API_BASE = 'http://localhost:3001/api/v1';

// Mock authentication token (in real implementation, get from login)
const AUTH_TOKEN = 'mock-jwt-token';

// Test data
const testAgencyId = 'agency-123';
const testUserId = 'user-456';

/**
 * Test natural language query processing
 */
async function testNaturalLanguageQueries() {
  console.log('\n🤖 Testing Natural Language Query Processing...');
  
  const testQueries = [
    'Show me my revenue for this month',
    'How are my creators performing?',
    'Which content is getting the most views?',
    'Generate a performance report for the last 30 days',
    'Export my analytics data as CSV',
    'Who are my top 5 creators by revenue?',
    'What is my conversion rate?',
    'How many pieces of content do I have?',
    'Show me trending content in my agency',
    'Help me onboard a new creator'
  ];

  for (const query of testQueries) {
    try {
      const response = await fetch(`${API_BASE}/agency-concierge/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({
          query,
          channel: 'web'
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`✅ Query: "${query}"`);
        console.log(`   Response: ${data.data.response.substring(0, 100)}...`);
        console.log(`   Actions: ${data.data.actions?.length || 0}`);
        console.log(`   Follow-up: ${data.data.followUp?.length || 0}`);
        console.log(`   Has data: ${!!data.data.data}`);
      } else {
        console.log(`❌ Query failed: "${query}" - ${data.error}`);
      }
    } catch (error) {
      console.log(`❌ Query error: "${query}" - ${error.message}`);
    }
  }
}

/**
 * Test secure analytics API endpoints
 */
async function testAnalyticsAPI() {
  console.log('\n📊 Testing Secure Analytics API...');
  
  const endpoints = [
    { path: `/analytics/${testAgencyId}`, name: 'Agency Analytics' },
    { path: `/analytics/${testAgencyId}?timeframe=7d&metric=revenue`, name: 'Revenue Analytics' },
    { path: `/analytics/${testAgencyId}?timeframe=30d&metric=creators`, name: 'Creator Analytics' },
    { path: `/analytics/${testAgencyId}?timeframe=90d&metric=content`, name: 'Content Analytics' }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_BASE}/agency-concierge${endpoint.path}`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`✅ ${endpoint.name} successful`);
        console.log(`   Revenue: $${data.data.data.revenue?.total?.toLocaleString() || 'N/A'}`);
        console.log(`   Creators: ${data.data.data.creators?.total || 'N/A'}`);
        console.log(`   Content: ${data.data.data.content?.total || 'N/A'}`);
      } else {
        console.log(`❌ ${endpoint.name} failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name} error: ${error.message}`);
    }
  }
}

/**
 * Test creator performance API
 */
async function testCreatorAPI() {
  console.log('\n👥 Testing Creator Performance API...');
  
  const tests = [
    { path: `/creators/${testAgencyId}`, name: 'All Creators' },
    { path: `/creators/${testAgencyId}?creatorId=creator-123`, name: 'Specific Creator' },
    { path: `/creators/${testAgencyId}?timeframe=7d&limit=5`, name: 'Top 5 Creators (7d)' }
  ];

  for (const test of tests) {
    try {
      const response = await fetch(`${API_BASE}/agency-concierge${test.path}`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`✅ ${test.name} successful`);
        console.log(`   Creators returned: ${data.data.creators?.length || 0}`);
        console.log(`   Total creators: ${data.data.summary?.totalCreators || 'N/A'}`);
        console.log(`   Total revenue: $${data.data.summary?.totalRevenue?.toLocaleString() || 'N/A'}`);
      } else {
        console.log(`❌ ${test.name} failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} error: ${error.message}`);
    }
  }
}

/**
 * Test content performance API
 */
async function testContentAPI() {
  console.log('\n🎬 Testing Content Performance API...');
  
  const tests = [
    { path: `/content/${testAgencyId}`, name: 'All Content' },
    { path: `/content/${testAgencyId}?contentId=content-123`, name: 'Specific Content' },
    { path: `/content/${testAgencyId}?category=premium&limit=10`, name: 'Premium Content' }
  ];

  for (const test of tests) {
    try {
      const response = await fetch(`${API_BASE}/agency-concierge${test.path}`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`✅ ${test.name} successful`);
        console.log(`   Content returned: ${data.data.content?.length || 0}`);
        console.log(`   Total content: ${data.data.summary?.totalContent || 'N/A'}`);
        console.log(`   Total views: ${data.data.summary?.totalViews?.toLocaleString() || 'N/A'}`);
        console.log(`   Pending moderation: ${data.data.summary?.pendingModeration || 0}`);
      } else {
        console.log(`❌ ${test.name} failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} error: ${error.message}`);
    }
  }
}

/**
 * Test data export functionality
 */
async function testDataExport() {
  console.log('\n📤 Testing Data Export...');
  
  const exportTests = [
    { dataType: 'analytics', format: 'csv', name: 'Analytics CSV Export' },
    { dataType: 'creators', format: 'json', name: 'Creators JSON Export' },
    { dataType: 'content', format: 'csv', name: 'Content CSV Export' },
    { dataType: 'revenue', format: 'pdf', name: 'Revenue PDF Export' }
  ];

  for (const test of exportTests) {
    try {
      const response = await fetch(`${API_BASE}/agency-concierge/export/${testAgencyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({
          dataType: test.dataType,
          format: test.format,
          timeframe: '30d'
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`✅ ${test.name} successful`);
        console.log(`   Export ID: ${data.data.exportId}`);
        console.log(`   Record count: ${data.data.recordCount}`);
        console.log(`   File size: ${data.data.fileSize}`);
        console.log(`   Download URL: ${data.data.downloadUrl}`);
        console.log(`   Expires: ${new Date(data.data.expiresAt).toLocaleString()}`);
      } else {
        console.log(`❌ ${test.name} failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} error: ${error.message}`);
    }
  }
}

/**
 * Test report generation
 */
async function testReportGeneration() {
  console.log('\n📋 Testing Report Generation...');
  
  const reportTests = [
    { reportType: 'performance', format: 'pdf', name: 'Performance Report' },
    { reportType: 'revenue', format: 'pdf', name: 'Revenue Report' },
    { reportType: 'creators', format: 'pdf', name: 'Creator Report' },
    { reportType: 'content', format: 'pdf', name: 'Content Report' }
  ];

  for (const test of reportTests) {
    try {
      const response = await fetch(`${API_BASE}/agency-concierge/report/${testAgencyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({
          reportType: test.reportType,
          format: test.format,
          timeframe: '30d',
          includeCharts: true
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`✅ ${test.name} successful`);
        console.log(`   Report ID: ${data.data.reportId}`);
        console.log(`   Pages: ${data.data.pageCount}`);
        console.log(`   File size: ${data.data.fileSize}`);
        console.log(`   Insights: ${data.data.insights?.length || 0}`);
        console.log(`   Recommendations: ${data.data.recommendations?.length || 0}`);
      } else {
        console.log(`❌ ${test.name} failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} error: ${error.message}`);
    }
  }
}

/**
 * Test FAQ system
 */
async function testFAQSystem() {
  console.log('\n❓ Testing FAQ System...');
  
  const faqTests = [
    { params: '', name: 'All FAQs' },
    { params: '?category=creator_management', name: 'Creator Management FAQs' },
    { params: '?category=analytics', name: 'Analytics FAQs' },
    { params: '?search=revenue', name: 'Revenue Search' },
    { params: '?search=creator&limit=5', name: 'Creator Search (Limited)' }
  ];

  for (const test of faqTests) {
    try {
      const response = await fetch(`${API_BASE}/agency-concierge/faq${test.params}`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`✅ ${test.name} successful`);
        console.log(`   FAQs returned: ${data.data.faqs?.length || 0}`);
        console.log(`   Categories: ${data.data.categories?.length || 0}`);
        console.log(`   Total count: ${data.data.totalCount}`);
        
        if (data.data.faqs?.length > 0) {
          console.log(`   Sample FAQ: "${data.data.faqs[0].question}"`);
        }
      } else {
        console.log(`❌ ${test.name} failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} error: ${error.message}`);
    }
  }
}

/**
 * Test Slack webhook integration
 */
async function testSlackWebhook() {
  console.log('\n💬 Testing Slack Webhook Integration...');
  
  // Test URL verification challenge
  try {
    const challengeResponse = await fetch(`${API_BASE}/agency-concierge/slack/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        challenge: 'test_challenge_string'
      })
    });

    const challengeData = await challengeResponse.json();
    
    if (challengeResponse.ok && challengeData.challenge === 'test_challenge_string') {
      console.log('✅ Slack URL verification successful');
    } else {
      console.log('❌ Slack URL verification failed');
    }
  } catch (error) {
    console.log('❌ Slack URL verification error:', error.message);
  }

  // Test message event
  try {
    const messageResponse = await fetch(`${API_BASE}/agency-concierge/slack/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: {
          type: 'message',
          user: 'U123456',
          text: 'Show me my revenue analytics',
          channel: 'C123456',
          ts: '1234567890.123456'
        }
      })
    });

    const messageData = await messageResponse.json();
    
    if (messageResponse.ok && messageData.ok) {
      console.log('✅ Slack message event processing successful');
    } else {
      console.log('❌ Slack message event processing failed');
    }
  } catch (error) {
    console.log('❌ Slack message event error:', error.message);
  }
}

/**
 * Test email webhook integration
 */
async function testEmailWebhook() {
  console.log('\n📧 Testing Email Webhook Integration...');
  
  try {
    const response = await fetch(`${API_BASE}/agency-concierge/email/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'agency@example.com',
        subject: 'Revenue Report Request',
        text: 'Can you generate a revenue report for the last 30 days?'
      })
    });

    const data = await response.json();
    
    if (response.ok && data.ok) {
      console.log('✅ Email webhook processing successful');
    } else {
      console.log('❌ Email webhook processing failed');
    }
  } catch (error) {
    console.log('❌ Email webhook error:', error.message);
  }
}

/**
 * Test complex multi-step queries
 */
async function testComplexQueries() {
  console.log('\n🧠 Testing Complex Multi-Step Queries...');
  
  const complexQueries = [
    'Show me my top 3 creators by revenue and then generate a performance report for them',
    'What is my conversion rate and how does it compare to last month?',
    'Export my content analytics as CSV and also show me which categories are performing best',
    'I want to see trending content and get recommendations for improving my agency performance',
    'Help me understand why my revenue dropped last week and what I can do about it'
  ];

  for (const query of complexQueries) {
    try {
      const response = await fetch(`${API_BASE}/agency-concierge/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({
          query,
          channel: 'web'
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`✅ Complex query processed: "${query.substring(0, 50)}..."`);
        console.log(`   Response length: ${data.data.response.length} chars`);
        console.log(`   Actions provided: ${data.data.actions?.length || 0}`);
        console.log(`   Follow-up suggestions: ${data.data.followUp?.length || 0}`);
        console.log(`   Data included: ${!!data.data.data}`);
      } else {
        console.log(`❌ Complex query failed: "${query.substring(0, 50)}..." - ${data.error}`);
      }
    } catch (error) {
      console.log(`❌ Complex query error: "${query.substring(0, 50)}..." - ${error.message}`);
    }
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Agency Concierge AI Assistant Tests...');
  console.log('Testing against:', API_BASE);
  
  await testNaturalLanguageQueries();
  await testAnalyticsAPI();
  await testCreatorAPI();
  await testContentAPI();
  await testDataExport();
  await testReportGeneration();
  await testFAQSystem();
  await testSlackWebhook();
  await testEmailWebhook();
  await testComplexQueries();
  
  console.log('\n✨ All Agency Concierge tests completed!');
  console.log('\n📋 Summary:');
  console.log('- Natural language processing: AI-powered query understanding');
  console.log('- Secure analytics API: Read-only access with proper authentication');
  console.log('- Creator management: Performance tracking and insights');
  console.log('- Content analytics: Views, revenue, and engagement metrics');
  console.log('- Data export: CSV, JSON, and PDF export capabilities');
  console.log('- Report generation: Automated insights and recommendations');
  console.log('- FAQ system: Intelligent question matching and responses');
  console.log('- Slack integration: Real-time chat bot functionality');
  console.log('- Email integration: Email-based query processing');
  console.log('- Complex queries: Multi-step request handling');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testNaturalLanguageQueries,
  testAnalyticsAPI,
  testCreatorAPI,
  testContentAPI,
  testDataExport,
  testReportGeneration,
  testFAQSystem,
  testSlackWebhook,
  testEmailWebhook,
  testComplexQueries,
  runAllTests
};