/**
 * Test script for Creator AI Toolkit functionality
 * Tests the AI-powered content generation features
 */

const API_BASE = 'http://localhost:3001/api/v1';

// Mock authentication token (in real implementation, get from login)
const AUTH_TOKEN = 'mock-jwt-token';

// Test data
const testContentMetadata = {
  title: "Premium Exclusive Content",
  tags: ["premium", "exclusive", "hd", "behind-scenes"],
  category: "premium",
  performers: ["TestCreator"],
  duration: 15
};

const testVideoUrl = "https://example.com/test-video.mp4";
const testCreatorId = "test-creator-123";

/**
 * Test title generation
 */
async function testTitleGeneration() {
  console.log('\n🎯 Testing AI Title Generation...');
  
  try {
    const response = await fetch(`${API_BASE}/creator-ai/titles/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        contentId: 'test-content-123',
        contentMetadata: testContentMetadata,
        options: {
          count: 5,
          style: 'descriptive',
          targetAudience: 'general'
        }
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Title generation successful');
      console.log(`Generated ${data.data.suggestions?.length || 0} title suggestions`);
      
      if (data.data.suggestions?.length > 0) {
        console.log('Sample title:', data.data.suggestions[0].title);
        console.log('Estimated CTR:', (data.data.suggestions[0].estimatedCTR * 100).toFixed(2) + '%');
      }
    } else {
      console.log('❌ Title generation failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Title generation error:', error.message);
  }
}

/**
 * Test thumbnail generation
 */
async function testThumbnailGeneration() {
  console.log('\n🖼️ Testing AI Thumbnail Generation...');
  
  try {
    const response = await fetch(`${API_BASE}/creator-ai/thumbnails/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        contentId: 'test-content-123',
        videoUrl: testVideoUrl,
        options: {
          count: 6,
          styles: ['close_up', 'wide_shot', 'action', 'artistic'],
          brandSafeOnly: false
        }
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Thumbnail generation successful');
      console.log(`Generated ${data.data.variations?.length || 0} thumbnail variations`);
      
      if (data.data.variations?.length > 0) {
        const bestThumbnail = data.data.variations[0];
        console.log('Best thumbnail style:', bestThumbnail.style);
        console.log('Estimated CTR:', (bestThumbnail.estimatedCTR * 100).toFixed(2) + '%');
      }
    } else {
      console.log('❌ Thumbnail generation failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Thumbnail generation error:', error.message);
  }
}

/**
 * Test caption generation
 */
async function testCaptionGeneration() {
  console.log('\n💬 Testing AI Caption Generation...');
  
  const platforms = ['twitter', 'reddit', 'telegram', 'onlyfans'];
  
  for (const platform of platforms) {
    try {
      const response = await fetch(`${API_BASE}/creator-ai/captions/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify({
          contentId: 'test-content-123',
          contentMetadata: testContentMetadata,
          platform: platform
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${platform} caption generation successful`);
        console.log(`Generated ${data.data.suggestions?.length || 0} caption suggestions`);
      } else {
        console.log(`❌ ${platform} caption generation failed:`, data.error);
      }
    } catch (error) {
      console.log(`❌ ${platform} caption generation error:`, error.message);
    }
  }
}

/**
 * Test SFW preview generation
 */
async function testSFWPreviewGeneration() {
  console.log('\n🎬 Testing SFW Preview Generation...');
  
  try {
    const response = await fetch(`${API_BASE}/creator-ai/sfw-preview/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        contentId: 'test-content-123',
        videoUrl: testVideoUrl,
        options: {
          duration: 15,
          style: 'teaser',
          includeText: true
        }
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SFW preview generation successful');
      console.log('Preview URL:', data.data.preview?.previewUrl);
      console.log('Suggested platforms:', data.data.preview?.suggestedPlatforms?.join(', '));
    } else {
      console.log('❌ SFW preview generation failed:', data.error);
    }
  } catch (error) {
    console.log('❌ SFW preview generation error:', error.message);
  }
}

/**
 * Test content calendar recommendations
 */
async function testContentCalendar() {
  console.log('\n📅 Testing Content Calendar Recommendations...');
  
  try {
    const response = await fetch(`${API_BASE}/creator-ai/calendar/${testCreatorId}?timeframe=week`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Content calendar generation successful');
      console.log(`Generated ${data.data.recommendations?.length || 0} daily recommendations`);
      
      if (data.data.recommendations?.length > 0) {
        const todayRec = data.data.recommendations[0];
        console.log('Today\'s optimal time:', todayRec.optimalPostTime);
        console.log('Audience activity:', todayRec.audienceActivity + '%');
      }
    } else {
      console.log('❌ Content calendar generation failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Content calendar generation error:', error.message);
  }
}

/**
 * Test CTR tracking
 */
async function testCTRTracking() {
  console.log('\n📊 Testing CTR Improvement Tracking...');
  
  try {
    const response = await fetch(`${API_BASE}/creator-ai/analytics/ctr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        creatorId: testCreatorId,
        assetId: 'test-title-123',
        assetType: 'title',
        metrics: {
          impressions: 1000,
          clicks: 87,
          conversions: 12,
          revenue: 156.50
        }
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ CTR tracking successful');
      console.log('CTR:', (data.data.analytics.ctr * 100).toFixed(2) + '%');
      console.log('Conversion rate:', (data.data.analytics.conversionRate * 100).toFixed(2) + '%');
      console.log('Revenue:', '$' + data.data.analytics.revenue.toFixed(2));
    } else {
      console.log('❌ CTR tracking failed:', data.error);
    }
  } catch (error) {
    console.log('❌ CTR tracking error:', error.message);
  }
}

/**
 * Test analytics dashboard
 */
async function testAnalyticsDashboard() {
  console.log('\n📈 Testing Analytics Dashboard...');
  
  try {
    const response = await fetch(`${API_BASE}/creator-ai/analytics/${testCreatorId}?timeframe=30d`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Analytics dashboard successful');
      console.log('Total assets generated:', data.data.summary.totalAssetsGenerated);
      console.log('Average CTR improvement:', data.data.summary.averageCTRImprovement + '%');
      console.log('Total revenue lift:', '$' + data.data.summary.totalRevenueLift);
      console.log('Top performing asset type:', data.data.summary.topPerformingAssetType);
    } else {
      console.log('❌ Analytics dashboard failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Analytics dashboard error:', error.message);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Creator AI Toolkit Tests...');
  console.log('Testing against:', API_BASE);
  
  await testTitleGeneration();
  await testThumbnailGeneration();
  await testCaptionGeneration();
  await testSFWPreviewGeneration();
  await testContentCalendar();
  await testCTRTracking();
  await testAnalyticsDashboard();
  
  console.log('\n✨ All Creator AI Toolkit tests completed!');
  console.log('\n📋 Summary:');
  console.log('- Title generation: AI-powered title suggestions with CTR estimates');
  console.log('- Thumbnail variations: Multiple styles with performance predictions');
  console.log('- Caption generation: Platform-specific social media captions');
  console.log('- SFW preview: Brand-safe content for mainstream promotion');
  console.log('- Content calendar: Optimal posting time recommendations');
  console.log('- CTR tracking: Performance analytics and improvement metrics');
  console.log('- Analytics dashboard: Comprehensive performance insights');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testTitleGeneration,
  testThumbnailGeneration,
  testCaptionGeneration,
  testSFWPreviewGeneration,
  testContentCalendar,
  testCTRTracking,
  testAnalyticsDashboard,
  runAllTests
};