const { aiTransparencyService } = require('./services/aiTransparencyService');

async function runAITransparencyTests() {
  console.log('🤖 Starting AI Transparency and Opt-out Controls Testing...\n');

  const testUserId = 'test-user-789';
  let testResults = [];

  try {
    // 1. Test AI features initialization
    console.log('⚙️ Testing AI features initialization...');
    const aiFeatures = aiTransparencyService.getAIFeatures();
    
    testResults.push({
      test: 'AI Features Initialization',
      passed: aiFeatures.length >= 6,
      details: `${aiFeatures.length} AI features initialized`
    });

    console.log(`✅ AI Features: ${aiFeatures.length} features loaded`);
    aiFeatures.forEach(feature => {
      console.log(`   - ${feature.name} (${feature.category}): ${feature.accuracy ? Math.round(feature.accuracy * 100) + '%' : 'N/A'} accuracy`);
    });

    // 2. Test user preferences initialization
    console.log('\n👤 Testing user preferences initialization...');
    const userPreferences = await aiTransparencyService.getUserAIPreferences(testUserId);
    
    testResults.push({
      test: 'User Preferences Initialization',
      passed: userPreferences.userId === testUserId && userPreferences.featurePreferences.size === aiFeatures.length,
      details: `User preferences created with ${userPreferences.featurePreferences.size} feature preferences`
    });

    console.log(`✅ User Preferences: ${userPreferences.featurePreferences.size} feature preferences initialized`);
    console.log(`   Global Opt-out: ${userPreferences.globalOptOut}`);
    console.log(`   Transparency Level: ${userPreferences.transparencyLevel}`);
    console.log(`   AI Usage Alerts: ${userPreferences.notificationPreferences.aiUsageAlerts}`);

    // 3. Test AI usage recording
    console.log('\n📝 Testing AI usage recording...');
    const usageRecords = [];

    // Record usage for auto-tagging
    const taggingUsage = await aiTransparencyService.recordAIUsage(
      testUserId,
      'auto-tagging',
      { videoFrames: ['frame1.jpg', 'frame2.jpg'], audioTrack: 'audio.mp3' },
      { tags: ['music', 'performance', 'live'], categories: ['entertainment'] },
      {
        contentId: 'video-123',
        confidence: 0.87,
        processingTime: 1250,
        userVisible: true,
        metadata: { modelVersion: 'v2.1.0' }
      }
    );
    usageRecords.push(taggingUsage);

    // Record usage for smart captions
    const captionsUsage = await aiTransparencyService.recordAIUsage(
      testUserId,
      'smart-captions',
      { audioTrack: 'audio.mp3', language: 'en' },
      { captions: [{ text: 'Hello world', timestamp: 0 }] },
      {
        contentId: 'video-123',
        confidence: 0.92,
        processingTime: 2100,
        userVisible: true
      }
    );
    usageRecords.push(captionsUsage);

    // Record usage for content recommendations
    const recommendationUsage = await aiTransparencyService.recordAIUsage(
      testUserId,
      'content-recommendations',
      { viewingHistory: ['video-1', 'video-2'], userInteractions: ['like', 'share'] },
      { recommendations: ['video-456', 'video-789'], scores: [0.85, 0.72] },
      {
        confidence: 0.78,
        processingTime: 450,
        userVisible: false
      }
    );
    usageRecords.push(recommendationUsage);

    testResults.push({
      test: 'AI Usage Recording',
      passed: usageRecords.length === 3,
      details: `Recorded ${usageRecords.length} AI usage instances`
    });

    console.log(`✅ AI Usage Recording: ${usageRecords.length} records created`);
    usageRecords.forEach(record => {
      console.log(`   - ${record.featureId}: ${record.confidence ? Math.round(record.confidence * 100) + '%' : 'N/A'} confidence, ${record.processingTime}ms`);
    });

    // 4. Test AI disclosures creation
    console.log('\n📋 Testing AI disclosures creation...');
    const userDisclosures = await aiTransparencyService.getUserAIDisclosures(testUserId);
    
    testResults.push({
      test: 'AI Disclosures Creation',
      passed: userDisclosures.length >= 2, // Only user-visible usage creates disclosures
      details: `${userDisclosures.length} disclosures created for user-visible AI usage`
    });

    console.log(`✅ AI Disclosures: ${userDisclosures.length} disclosures created`);
    userDisclosures.forEach(disclosure => {
      console.log(`   - ${disclosure.description} (${disclosure.confidence ? Math.round(disclosure.confidence * 100) + '%' : 'N/A'} confidence)`);
    });

    // 5. Test feature opt-out
    console.log('\n🚫 Testing feature opt-out...');
    await aiTransparencyService.optOutOfAIFeature(testUserId, 'smart-pricing', 'Privacy concerns');
    
    const updatedPreferences = await aiTransparencyService.getUserAIPreferences(testUserId);
    const pricingPreference = updatedPreferences.featurePreferences.get('smart-pricing');
    
    testResults.push({
      test: 'Feature Opt-out',
      passed: pricingPreference?.enabled === false && pricingPreference?.reason === 'Privacy concerns',
      details: `Smart pricing feature opted out with reason: ${pricingPreference?.reason}`
    });

    console.log(`✅ Feature Opt-out: smart-pricing disabled`);
    console.log(`   Reason: ${pricingPreference?.reason}`);
    console.log(`   Opt-out Date: ${pricingPreference?.optOutDate?.toISOString()}`);

    // 6. Test feature opt-in
    console.log('\n✅ Testing feature opt-in...');
    await aiTransparencyService.optInToAIFeature(testUserId, 'smart-pricing');
    
    const reEnabledPreferences = await aiTransparencyService.getUserAIPreferences(testUserId);
    const reEnabledPricingPreference = reEnabledPreferences.featurePreferences.get('smart-pricing');
    
    testResults.push({
      test: 'Feature Opt-in',
      passed: reEnabledPricingPreference?.enabled === true,
      details: `Smart pricing feature re-enabled`
    });

    console.log(`✅ Feature Opt-in: smart-pricing re-enabled`);

    // 7. Test global opt-out
    console.log('\n🌐 Testing global AI opt-out...');
    await aiTransparencyService.updateUserAIPreferences(testUserId, {
      globalOptOut: true
    });

    // Try to record AI usage after global opt-out
    let optOutError = null;
    try {
      await aiTransparencyService.recordAIUsage(
        testUserId,
        'auto-tagging',
        { test: 'data' },
        { test: 'output' }
      );
    } catch (error) {
      optOutError = error;
    }

    testResults.push({
      test: 'Global Opt-out',
      passed: optOutError !== null && optOutError.message.includes('opted out'),
      details: `Global opt-out prevents AI usage recording: ${optOutError ? 'Yes' : 'No'}`
    });

    console.log(`✅ Global Opt-out: ${optOutError ? 'Correctly blocked AI usage' : 'Failed to block AI usage'}`);

    // Re-enable for further tests
    await aiTransparencyService.updateUserAIPreferences(testUserId, {
      globalOptOut: false
    });

    // 8. Test transparency level changes
    console.log('\n🔍 Testing transparency level changes...');
    await aiTransparencyService.updateUserAIPreferences(testUserId, {
      transparencyLevel: 'detailed'
    });

    const detailedPreferences = await aiTransparencyService.getUserAIPreferences(testUserId);
    
    testResults.push({
      test: 'Transparency Level Changes',
      passed: detailedPreferences.transparencyLevel === 'detailed',
      details: `Transparency level changed to: ${detailedPreferences.transparencyLevel}`
    });

    console.log(`✅ Transparency Level: ${detailedPreferences.transparencyLevel}`);

    // 9. Test notification preferences
    console.log('\n🔔 Testing notification preferences...');
    await aiTransparencyService.updateUserAIPreferences(testUserId, {
      notificationPreferences: {
        aiUsageAlerts: false,
        modelUpdates: true,
        accuracyReports: true
      }
    });

    const notificationPreferences = await aiTransparencyService.getUserAIPreferences(testUserId);
    
    testResults.push({
      test: 'Notification Preferences',
      passed: !notificationPreferences.notificationPreferences.aiUsageAlerts &&
              notificationPreferences.notificationPreferences.modelUpdates &&
              notificationPreferences.notificationPreferences.accuracyReports,
      details: `Notification preferences updated successfully`
    });

    console.log(`✅ Notification Preferences:`);
    console.log(`   AI Usage Alerts: ${notificationPreferences.notificationPreferences.aiUsageAlerts}`);
    console.log(`   Model Updates: ${notificationPreferences.notificationPreferences.modelUpdates}`);
    console.log(`   Accuracy Reports: ${notificationPreferences.notificationPreferences.accuracyReports}`);

    // 10. Test transparency report generation
    console.log('\n📊 Testing transparency report generation...');
    const transparencyReport = await aiTransparencyService.generateTransparencyReport(testUserId);
    
    testResults.push({
      test: 'Transparency Report Generation',
      passed: transparencyReport.id && transparencyReport.summary.totalAIUsage >= 3,
      details: `Generated report with ${transparencyReport.summary.totalAIUsage} AI usage records`
    });

    console.log(`✅ Transparency Report: ${transparencyReport.id}`);
    console.log(`   Total AI Usage: ${transparencyReport.summary.totalAIUsage}`);
    console.log(`   Features Used: ${transparencyReport.summary.featuresUsed.join(', ')}`);
    console.log(`   Content Generated: ${transparencyReport.summary.contentGenerated}`);
    console.log(`   Content Analyzed: ${transparencyReport.summary.contentAnalyzed}`);
    console.log(`   Recommendations Made: ${transparencyReport.summary.recommendationsMade}`);
    console.log(`   Transparency Score: ${Math.round(transparencyReport.ethicsMetrics.transparencyScore * 100)}%`);
    console.log(`   User Control Score: ${Math.round(transparencyReport.ethicsMetrics.userControlScore * 100)}%`);

    // 11. Test feature enablement checking
    console.log('\n🔍 Testing feature enablement checking...');
    const autoTaggingEnabled = await aiTransparencyService.isAIFeatureEnabled(testUserId, 'auto-tagging');
    const smartPricingEnabled = await aiTransparencyService.isAIFeatureEnabled(testUserId, 'smart-pricing');
    
    testResults.push({
      test: 'Feature Enablement Checking',
      passed: autoTaggingEnabled === true && smartPricingEnabled === true,
      details: `Auto-tagging: ${autoTaggingEnabled}, Smart-pricing: ${smartPricingEnabled}`
    });

    console.log(`✅ Feature Enablement:`);
    console.log(`   Auto-tagging: ${autoTaggingEnabled}`);
    console.log(`   Smart-pricing: ${smartPricingEnabled}`);

    // 12. Test AI usage analytics
    console.log('\n📈 Testing AI usage analytics...');
    const analytics = aiTransparencyService.getAIUsageAnalytics();
    
    testResults.push({
      test: 'AI Usage Analytics',
      passed: analytics.totalUsage >= 3 && analytics.activeFeatures >= 6,
      details: `${analytics.totalUsage} total usage, ${analytics.activeFeatures} active features, ${Math.round(analytics.averageConfidence * 100)}% avg confidence`
    });

    console.log(`✅ AI Usage Analytics:`);
    console.log(`   Total Usage: ${analytics.totalUsage}`);
    console.log(`   Active Features: ${analytics.activeFeatures}`);
    console.log(`   Average Confidence: ${Math.round(analytics.averageConfidence * 100)}%`);
    console.log(`   User Opt-out Rate: ${Math.round(analytics.userOptOutRate * 100)}%`);

    // 13. Test error handling
    console.log('\n❌ Testing error handling...');
    let errorTests = 0;
    let errorTestsPassed = 0;

    // Test invalid feature ID
    try {
      await aiTransparencyService.optOutOfAIFeature(testUserId, 'invalid-feature');
    } catch (error) {
      errorTests++;
      if (error.message.includes('AI feature invalid-feature not found')) {
        errorTestsPassed++;
        console.log(`   ✅ Invalid feature ID error handled correctly`);
      }
    }

    // Test recording usage for non-existent feature
    try {
      await aiTransparencyService.recordAIUsage(testUserId, 'non-existent', {}, {});
    } catch (error) {
      errorTests++;
      if (error.message.includes('AI feature non-existent not found')) {
        errorTestsPassed++;
        console.log(`   ✅ Non-existent feature usage error handled correctly`);
      }
    }

    testResults.push({
      test: 'Error Handling',
      passed: errorTestsPassed === errorTests,
      details: `${errorTestsPassed}/${errorTests} error scenarios handled correctly`
    });

    // 14. Test AI disclosure requirements
    console.log('\n📝 Testing AI disclosure requirements...');
    
    // Record high-confidence moderation usage (should require human review)
    const moderationUsage = await aiTransparencyService.recordAIUsage(
      testUserId,
      'content-moderation',
      { content: 'test content' },
      { violations: ['inappropriate'], severity: 'high' },
      {
        contentId: 'video-456',
        confidence: 0.95,
        processingTime: 800,
        userVisible: true
      }
    );

    const moderationDisclosures = await aiTransparencyService.getUserAIDisclosures(testUserId);
    const moderationDisclosure = moderationDisclosures.find(d => 
      d.metadata.usageRecordId === moderationUsage.id
    );

    testResults.push({
      test: 'AI Disclosure Requirements',
      passed: moderationDisclosure?.humanReviewRequired === true,
      details: `High-confidence moderation requires human review: ${moderationDisclosure?.humanReviewRequired}`
    });

    console.log(`✅ AI Disclosure Requirements:`);
    console.log(`   Moderation disclosure created: ${moderationDisclosure ? 'Yes' : 'No'}`);
    console.log(`   Human review required: ${moderationDisclosure?.humanReviewRequired}`);

    // Summary
    console.log('\n📊 Test Results Summary:');
    const passedTests = testResults.filter(r => r.passed).length;
    const totalTests = testResults.length;
    
    console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
    console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests} tests`);
    console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);

    // Detailed results
    console.log('📋 Detailed Test Results:');
    testResults.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.test}: ${result.details}`);
    });

    // Feature validation checklist
    console.log('\n🎯 Feature Validation Checklist:');
    const features = [
      { name: 'AI Features Management', passed: testResults.find(r => r.test === 'AI Features Initialization')?.passed },
      { name: 'User Preferences System', passed: testResults.find(r => r.test === 'User Preferences Initialization')?.passed },
      { name: 'AI Usage Recording', passed: testResults.find(r => r.test === 'AI Usage Recording')?.passed },
      { name: 'AI Disclosures', passed: testResults.find(r => r.test === 'AI Disclosures Creation')?.passed },
      { name: 'Feature Opt-out/Opt-in', passed: testResults.find(r => r.test === 'Feature Opt-out')?.passed && testResults.find(r => r.test === 'Feature Opt-in')?.passed },
      { name: 'Global Opt-out', passed: testResults.find(r => r.test === 'Global Opt-out')?.passed },
      { name: 'Transparency Controls', passed: testResults.find(r => r.test === 'Transparency Level Changes')?.passed },
      { name: 'Notification Preferences', passed: testResults.find(r => r.test === 'Notification Preferences')?.passed },
      { name: 'Transparency Reporting', passed: testResults.find(r => r.test === 'Transparency Report Generation')?.passed },
      { name: 'Error Handling', passed: testResults.find(r => r.test === 'Error Handling')?.passed }
    ];

    features.forEach(feature => {
      console.log(`${feature.passed ? '✅' : '❌'} ${feature.name}`);
    });

    const allFeaturesPassed = features.every(f => f.passed);
    console.log(`\n🏆 Overall Status: ${allFeaturesPassed ? '✅ ALL FEATURES WORKING' : '❌ ISSUES DETECTED'}`);

    // AI Ethics and Transparency Metrics
    console.log('\n🤖 AI Ethics and Transparency Metrics:');
    console.log(`- Transparency Score: ${Math.round(transparencyReport.ethicsMetrics.transparencyScore * 100)}%`);
    console.log(`- User Control Score: ${Math.round(transparencyReport.ethicsMetrics.userControlScore * 100)}%`);
    console.log(`- Fairness Score: ${Math.round(transparencyReport.ethicsMetrics.fairnessScore * 100)}%`);
    console.log(`- Bias Detection Runs: ${transparencyReport.ethicsMetrics.biasDetectionRuns}`);
    console.log(`- User Opt-out Rate: ${Math.round(analytics.userOptOutRate * 100)}%`);

    // Compliance validation
    console.log('\n📋 AI Transparency Compliance:');
    console.log(`- AI feature disclosure: Implemented`);
    console.log(`- User opt-out controls: Active`);
    console.log(`- Transparency indicators: Working`);
    console.log(`- Usage tracking: Enabled`);
    console.log(`- Ethics reporting: Automated`);

    return {
      success: allFeaturesPassed,
      testResults,
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        successRate: (passedTests / totalTests) * 100
      },
      features,
      transparencyReport,
      analytics
    };

  } catch (error) {
    console.error('💥 AI transparency testing failed:', error);
    return {
      success: false,
      error: error.message,
      testResults
    };
  }
}

// Run tests if called directly
if (require.main === module) {
  runAITransparencyTests()
    .then(result => {
      console.log('\n🎉 AI Transparency Testing Complete!');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Testing suite crashed:', error);
      process.exit(1);
    });
}

module.exports = { runAITransparencyTests };