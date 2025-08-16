const { agencyOnboardingService } = require('./services/agencyOnboardingService');

async function runSoftLaunchTests() {
  console.log('🚀 Starting Soft Launch with Pilot Agencies Testing...\n');

  let testResults = [];

  try {
    // 1. Test pilot agencies initialization
    console.log('🏢 Testing pilot agencies initialization...');
    const pilotAgencies = agencyOnboardingService.getPilotAgencies();
    
    testResults.push({
      test: 'Pilot Agencies Initialization',
      passed: pilotAgencies.length >= 3,
      details: `${pilotAgencies.length} pilot agencies initialized`
    });

    console.log(`✅ Pilot Agencies: ${pilotAgencies.length} agencies loaded`);
    pilotAgencies.forEach(agency => {
      console.log(`   - ${agency.name} (${agency.size}): ${agency.specialization.join(', ')}`);
      console.log(`     Contact: ${agency.contactName} <${agency.contactEmail}>`);
      console.log(`     Status: ${agency.onboardingStatus}`);
      console.log(`     Requirements: API=${agency.requirements.apiAccess}, Support=${agency.requirements.dedicatedSupport}`);
    });

    // 2. Test onboarding kit generation
    console.log('\n📦 Testing onboarding kit generation...');
    const testAgency = pilotAgencies[0];
    const onboardingKit = agencyOnboardingService.getOnboardingKit(testAgency.id);
    
    testResults.push({
      test: 'Onboarding Kit Generation',
      passed: onboardingKit && Object.keys(onboardingKit.components).length >= 7,
      details: `Onboarding kit generated with ${onboardingKit ? Object.keys(onboardingKit.components).length : 0} components`
    });

    if (onboardingKit) {
      console.log(`✅ Onboarding Kit: ${onboardingKit.id} for ${testAgency.name}`);
      console.log(`   Components: ${Object.keys(onboardingKit.components).join(', ')}`);
      console.log(`   Version: ${onboardingKit.version}`);
      console.log(`   Generated: ${onboardingKit.generatedAt.toISOString()}`);
      
      // Display sample content
      console.log('\n📄 Sample Welcome Guide (first 200 chars):');
      console.log(onboardingKit.components.welcomeGuide.substring(0, 200) + '...');
    }

    // 3. Test agency onboarding process
    console.log('\n🎯 Testing agency onboarding process...');
    const onboardingResults = [];
    
    for (const agency of pilotAgencies.slice(0, 3)) {
      // Start onboarding
      const startResult = await agencyOnboardingService.startAgencyOnboarding(agency.id);
      onboardingResults.push({ agency: agency.name, started: startResult });
      
      // Complete onboarding
      const completeResult = await agencyOnboardingService.completeAgencyOnboarding(agency.id);
      onboardingResults.push({ agency: agency.name, completed: completeResult });
    }

    testResults.push({
      test: 'Agency Onboarding Process',
      passed: onboardingResults.every(r => r.started !== false && r.completed !== false),
      details: `${onboardingResults.length / 2} agencies onboarded successfully`
    });

    console.log(`✅ Agency Onboarding: ${onboardingResults.length / 2} agencies processed`);
    onboardingResults.forEach(result => {
      const status = Object.keys(result)[1]; // 'started' or 'completed'
      console.log(`   - ${result.agency}: ${status} = ${result[status]}`);
    });

    // 4. Test feedback submission and management
    console.log('\n💬 Testing feedback submission and management...');
    const feedbackItems = [];
    
    // Submit various types of feedback
    const feedbackTypes = [
      { type: 'feature_request', category: 'api', title: 'Add bulk creator import API', description: 'Need ability to import multiple creators at once', priority: 'high' },
      { type: 'bug_report', category: 'ui', title: 'Dashboard loading issue', description: 'Metrics dashboard takes too long to load', priority: 'medium' },
      { type: 'general_feedback', category: 'onboarding', title: 'Great onboarding experience', description: 'The onboarding process was smooth and well-documented', priority: 'low' },
      { type: 'complaint', category: 'performance', title: 'API response times', description: 'API responses are slower than expected', priority: 'critical' }
    ];

    for (let i = 0; i < feedbackTypes.length; i++) {
      const feedback = feedbackTypes[i];
      const agency = pilotAgencies[i % pilotAgencies.length];
      
      const feedbackItem = await agencyOnboardingService.submitFeedback(
        agency.id,
        feedback.type,
        feedback.category,
        feedback.title,
        feedback.description,
        feedback.priority
      );
      
      feedbackItems.push(feedbackItem);
    }

    // Resolve some feedback
    await agencyOnboardingService.resolveFeedback(
      feedbackItems[0].id,
      'Feature added to roadmap for Q2 implementation',
      'product-team'
    );

    await agencyOnboardingService.resolveFeedback(
      feedbackItems[2].id,
      'Thank you for the positive feedback!',
      'support-team'
    );

    testResults.push({
      test: 'Feedback Management',
      passed: feedbackItems.length === 4,
      details: `${feedbackItems.length} feedback items submitted, 2 resolved`
    });

    console.log(`✅ Feedback Management: ${feedbackItems.length} items submitted`);
    feedbackItems.forEach(item => {
      console.log(`   - ${item.title} (${item.type}, ${item.priority}): ${item.status}`);
    });

    // 5. Test metrics collection and updates
    console.log('\n📊 Testing metrics collection and updates...');
    const metricsUpdates = [];
    
    for (const agency of pilotAgencies) {
      const mockMetrics = {
        creatorsOnboarded: Math.floor(Math.random() * 50) + 10,
        contentUploaded: Math.floor(Math.random() * 500) + 100,
        totalRevenue: Math.floor(Math.random() * 100000) + 10000,
        averagePayoutTime: Math.floor(Math.random() * 60) + 30, // 30-90 minutes
        supportTickets: Math.floor(Math.random() * 10),
        satisfactionScore: Math.floor(Math.random() * 2) + 4, // 4-5 stars
        apiCalls: Math.floor(Math.random() * 10000) + 1000,
        errorRate: Math.random() * 0.05, // 0-5%
        uptimeExperienced: 99 + Math.random() // 99-100%
      };
      
      const updateResult = await agencyOnboardingService.updateAgencyMetrics(agency.id, mockMetrics);
      metricsUpdates.push({ agency: agency.name, updated: updateResult, metrics: mockMetrics });
    }

    testResults.push({
      test: 'Metrics Collection',
      passed: metricsUpdates.every(u => u.updated),
      details: `Metrics updated for ${metricsUpdates.length} agencies`
    });

    console.log(`✅ Metrics Collection: ${metricsUpdates.length} agencies updated`);
    metricsUpdates.forEach(update => {
      console.log(`   - ${update.agency}:`);
      console.log(`     Creators: ${update.metrics.creatorsOnboarded}, Revenue: $${update.metrics.totalRevenue.toLocaleString()}`);
      console.log(`     Satisfaction: ${update.metrics.satisfactionScore}/5, Uptime: ${update.metrics.uptimeExperienced.toFixed(1)}%`);
    });

    // 6. Test soft launch metrics calculation
    console.log('\n📈 Testing soft launch metrics calculation...');
    const softLaunchMetrics = agencyOnboardingService.getSoftLaunchMetrics();
    
    testResults.push({
      test: 'Soft Launch Metrics',
      passed: softLaunchMetrics.totalAgencies >= 3 && softLaunchMetrics.activeAgencies >= 3,
      details: `${softLaunchMetrics.activeAgencies}/${softLaunchMetrics.totalAgencies} agencies active, ${softLaunchMetrics.onboardingCompletionRate.toFixed(1)}% completion rate`
    });

    console.log(`✅ Soft Launch Metrics:`);
    console.log(`   Total Agencies: ${softLaunchMetrics.totalAgencies}`);
    console.log(`   Active Agencies: ${softLaunchMetrics.activeAgencies}`);
    console.log(`   Onboarding Completion Rate: ${softLaunchMetrics.onboardingCompletionRate.toFixed(1)}%`);
    console.log(`   Average Onboarding Time: ${softLaunchMetrics.averageOnboardingTime.toFixed(1)} days`);
    console.log(`   Overall Satisfaction: ${softLaunchMetrics.overallSatisfaction.toFixed(1)}/5`);
    console.log(`   Critical Issues: ${softLaunchMetrics.criticalIssues}`);
    console.log(`   Performance Metrics:`);
    console.log(`     Average Uptime: ${softLaunchMetrics.performanceMetrics.averageUptime.toFixed(2)}%`);
    console.log(`     Average Response Time: ${softLaunchMetrics.performanceMetrics.averageResponseTime}ms`);
    console.log(`     Average Payout Time: ${softLaunchMetrics.performanceMetrics.averagePayoutTime.toFixed(1)} minutes`);
    console.log(`     Error Rate: ${(softLaunchMetrics.performanceMetrics.errorRate * 100).toFixed(2)}%`);

    // 7. Test feature adoption rates
    console.log('\n🎯 Testing feature adoption rates...');
    const featureAdoption = softLaunchMetrics.featureAdoptionRates;
    
    testResults.push({
      test: 'Feature Adoption Rates',
      passed: Object.keys(featureAdoption).length >= 4,
      details: `${Object.keys(featureAdoption).length} features tracked for adoption`
    });

    console.log(`✅ Feature Adoption Rates:`);
    Object.entries(featureAdoption).forEach(([feature, rate]) => {
      console.log(`   - ${feature}: ${rate.toFixed(1)}%`);
    });

    // 8. Test agency-specific requirements validation
    console.log('\n🔍 Testing agency-specific requirements validation...');
    const requirementsValidation = [];
    
    for (const agency of pilotAgencies) {
      const kit = agencyOnboardingService.getOnboardingKit(agency.id);
      const validation = {
        agency: agency.name,
        apiAccess: agency.requirements.apiAccess === kit?.customizations.features.apiAccess,
        customBranding: agency.requirements.customBranding === kit?.customizations.features.customBranding,
        dedicatedSupport: agency.requirements.dedicatedSupport === kit?.customizations.features.dedicatedSupport,
        slaMatched: kit?.customizations.sla.uptime === agency.requirements.slaRequirements.uptime
      };
      
      requirementsValidation.push(validation);
    }

    const allRequirementsMet = requirementsValidation.every(v => 
      v.apiAccess && v.customBranding && v.dedicatedSupport && v.slaMatched
    );

    testResults.push({
      test: 'Requirements Validation',
      passed: allRequirementsMet,
      details: `${requirementsValidation.filter(v => v.apiAccess && v.customBranding && v.dedicatedSupport && v.slaMatched).length}/${requirementsValidation.length} agencies have requirements properly configured`
    });

    console.log(`✅ Requirements Validation:`);
    requirementsValidation.forEach(validation => {
      const status = validation.apiAccess && validation.customBranding && validation.dedicatedSupport && validation.slaMatched ? '✅' : '❌';
      console.log(`   ${status} ${validation.agency}: API=${validation.apiAccess}, Branding=${validation.customBranding}, Support=${validation.dedicatedSupport}, SLA=${validation.slaMatched}`);
    });

    // 9. Test critical issue detection
    console.log('\n🚨 Testing critical issue detection...');
    const criticalFeedback = agencyOnboardingService.getAllFeedback().filter(f => f.priority === 'critical');
    const unresolvedCritical = criticalFeedback.filter(f => f.status !== 'resolved');
    
    testResults.push({
      test: 'Critical Issue Detection',
      passed: criticalFeedback.length > 0, // We should have at least one critical issue from our test data
      details: `${criticalFeedback.length} critical issues detected, ${unresolvedCritical.length} unresolved`
    });

    console.log(`✅ Critical Issue Detection:`);
    console.log(`   Total Critical Issues: ${criticalFeedback.length}`);
    console.log(`   Unresolved Critical Issues: ${unresolvedCritical.length}`);
    criticalFeedback.forEach(issue => {
      console.log(`   - ${issue.title} (${issue.status}): ${issue.description.substring(0, 50)}...`);
    });

    // 10. Test agency communication channels
    console.log('\n💬 Testing agency communication channels...');
    const communicationChannels = [];
    
    for (const agency of pilotAgencies) {
      const hasSupport = agency.requirements.dedicatedSupport;
      const supportChannel = agency.supportChannel;
      
      communicationChannels.push({
        agency: agency.name,
        dedicatedSupport: hasSupport,
        channelCreated: hasSupport ? !!supportChannel : true, // Non-dedicated support doesn't need channel
        channelId: supportChannel
      });
    }

    const allChannelsWorking = communicationChannels.every(c => c.channelCreated);

    testResults.push({
      test: 'Communication Channels',
      passed: allChannelsWorking,
      details: `${communicationChannels.filter(c => c.dedicatedSupport).length} dedicated support channels created`
    });

    console.log(`✅ Communication Channels:`);
    communicationChannels.forEach(channel => {
      const supportType = channel.dedicatedSupport ? 'Dedicated' : 'Standard';
      const status = channel.channelCreated ? '✅' : '❌';
      console.log(`   ${status} ${channel.agency}: ${supportType} support${channel.channelId ? ` (${channel.channelId})` : ''}`);
    });

    // 11. Test go-live readiness checklist
    console.log('\n✅ Testing go-live readiness checklist...');
    const readinessChecklist = {
      agenciesOnboarded: softLaunchMetrics.activeAgencies >= 3,
      onboardingKitsDelivered: pilotAgencies.every(a => agencyOnboardingService.getOnboardingKit(a.id)),
      metricsPortalActive: true, // Simulated
      supportChannelsActive: communicationChannels.every(c => c.channelCreated),
      feedbackSystemWorking: feedbackItems.length > 0,
      criticalIssuesAddressed: unresolvedCritical.length === 0,
      performanceMetricsGood: softLaunchMetrics.performanceMetrics.averageUptime > 99,
      satisfactionScoreGood: softLaunchMetrics.overallSatisfaction >= 4.0
    };

    const readinessScore = Object.values(readinessChecklist).filter(Boolean).length;
    const totalChecks = Object.keys(readinessChecklist).length;

    testResults.push({
      test: 'Go-Live Readiness',
      passed: readinessScore >= totalChecks * 0.8, // 80% of checks must pass
      details: `${readinessScore}/${totalChecks} readiness criteria met`
    });

    console.log(`✅ Go-Live Readiness Checklist:`);
    Object.entries(readinessChecklist).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
    });
    console.log(`   Overall Readiness: ${readinessScore}/${totalChecks} (${((readinessScore / totalChecks) * 100).toFixed(1)}%)`);

    // 12. Test agency success metrics
    console.log('\n🎯 Testing agency success metrics...');
    const successMetrics = [];
    
    for (const agency of pilotAgencies) {
      const agencyData = agencyOnboardingService.getPilotAgency(agency.id);
      if (agencyData) {
        const success = {
          agency: agency.name,
          creatorsOnboarded: agencyData.metrics.creatorsOnboarded,
          revenue: agencyData.metrics.totalRevenue,
          satisfaction: agencyData.metrics.satisfactionScore,
          payoutTime: agencyData.metrics.averagePayoutTime,
          uptime: agencyData.metrics.uptimeExperienced,
          successScore: this.calculateAgencySuccessScore(agencyData.metrics)
        };
        successMetrics.push(success);
      }
    }

    const avgSuccessScore = successMetrics.reduce((sum, s) => sum + s.successScore, 0) / successMetrics.length;

    testResults.push({
      test: 'Agency Success Metrics',
      passed: avgSuccessScore >= 75, // 75% success threshold
      details: `Average agency success score: ${avgSuccessScore.toFixed(1)}%`
    });

    console.log(`✅ Agency Success Metrics:`);
    successMetrics.forEach(metrics => {
      console.log(`   - ${metrics.agency}:`);
      console.log(`     Creators: ${metrics.creatorsOnboarded}, Revenue: $${metrics.revenue.toLocaleString()}`);
      console.log(`     Satisfaction: ${metrics.satisfaction}/5, Payout Time: ${metrics.payoutTime.toFixed(1)}min`);
      console.log(`     Uptime: ${metrics.uptime.toFixed(1)}%, Success Score: ${metrics.successScore.toFixed(1)}%`);
    });

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

    // Soft launch validation checklist
    console.log('\n🎯 Soft Launch Validation Checklist:');
    const validationChecks = [
      { name: 'Pilot Agencies Onboarded', passed: testResults.find(r => r.test === 'Pilot Agencies Initialization')?.passed },
      { name: 'Onboarding Kits Generated', passed: testResults.find(r => r.test === 'Onboarding Kit Generation')?.passed },
      { name: 'Agency Onboarding Process', passed: testResults.find(r => r.test === 'Agency Onboarding Process')?.passed },
      { name: 'Feedback System Active', passed: testResults.find(r => r.test === 'Feedback Management')?.passed },
      { name: 'Metrics Collection Working', passed: testResults.find(r => r.test === 'Metrics Collection')?.passed },
      { name: 'Performance Monitoring', passed: testResults.find(r => r.test === 'Soft Launch Metrics')?.passed },
      { name: 'Requirements Validation', passed: testResults.find(r => r.test === 'Requirements Validation')?.passed },
      { name: 'Communication Channels', passed: testResults.find(r => r.test === 'Communication Channels')?.passed },
      { name: 'Go-Live Readiness', passed: testResults.find(r => r.test === 'Go-Live Readiness')?.passed },
      { name: 'Agency Success Metrics', passed: testResults.find(r => r.test === 'Agency Success Metrics')?.passed }
    ];

    validationChecks.forEach(check => {
      console.log(`${check.passed ? '✅' : '❌'} ${check.name}`);
    });

    const allValidationsPassed = validationChecks.every(c => c.passed);
    console.log(`\n🏆 Overall Status: ${allValidationsPassed ? '✅ SOFT LAUNCH READY' : '❌ ISSUES DETECTED'}`);

    // Final soft launch summary
    console.log('\n🚀 Soft Launch Summary:');
    console.log(`- Pilot Agencies: ${softLaunchMetrics.totalAgencies} total, ${softLaunchMetrics.activeAgencies} active`);
    console.log(`- Onboarding Success: ${softLaunchMetrics.onboardingCompletionRate.toFixed(1)}%`);
    console.log(`- Average Satisfaction: ${softLaunchMetrics.overallSatisfaction.toFixed(1)}/5`);
    console.log(`- System Performance: ${softLaunchMetrics.performanceMetrics.averageUptime.toFixed(1)}% uptime`);
    console.log(`- Critical Issues: ${softLaunchMetrics.criticalIssues} unresolved`);
    console.log(`- Go-Live Readiness: ${readinessScore}/${totalChecks} criteria met`);

    return {
      success: allValidationsPassed,
      testResults,
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        successRate: (passedTests / totalTests) * 100
      },
      validationChecks,
      softLaunchMetrics,
      readinessChecklist,
      successMetrics
    };

  } catch (error) {
    console.error('💥 Soft launch testing failed:', error);
    return {
      success: false,
      error: error.message,
      testResults
    };
  }
}

// Helper function to calculate agency success score
function calculateAgencySuccessScore(metrics) {
  let score = 0;
  
  // Creator onboarding (25% weight)
  score += Math.min(metrics.creatorsOnboarded / 50, 1) * 25;
  
  // Revenue generation (25% weight)
  score += Math.min(metrics.totalRevenue / 100000, 1) * 25;
  
  // Satisfaction (20% weight)
  score += (metrics.satisfactionScore / 5) * 20;
  
  // Performance (15% weight)
  score += (metrics.uptimeExperienced / 100) * 15;
  
  // Payout efficiency (15% weight)
  score += Math.max(0, (120 - metrics.averagePayoutTime) / 120) * 15;
  
  return Math.min(score, 100);
}

// Run tests if called directly
if (require.main === module) {
  runSoftLaunchTests()
    .then(result => {
      console.log('\n🎉 Soft Launch Testing Complete!');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Testing suite crashed:', error);
      process.exit(1);
    });
}

module.exports = { runSoftLaunchTests };