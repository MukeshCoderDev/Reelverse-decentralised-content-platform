// Import all test modules
const { runMultiCDNFailoverTests } = require('./test-multi-cdn-failover');
const { runChaosTestingAndValidation } = require('./test-chaos-validation');
const { runPasskeyRecoveryTests } = require('./test-passkey-recovery');
const { runFinancialOperationsTests } = require('./test-financial-operations');
const { runAITransparencyTests } = require('./test-ai-transparency');
const { runSoftLaunchTests } = require('./test-soft-launch');

async function runGoLiveValidation() {
  console.log('🎯 Starting Complete Go-Live Validation Suite...\n');
  console.log('This comprehensive test validates all systems for agency-ready launch.\n');

  const startTime = Date.now();
  const testSuites = [];
  let overallSuccess = true;

  try {
    // 1. Multi-CDN Failover Testing (Task 16)
    console.log('🌐 Running Multi-CDN Failover Tests...');
    console.log('=' .repeat(60));
    const cdnResults = await runMultiCDNFailoverTests();
    testSuites.push({
      name: 'Multi-CDN Failover',
      task: 'Task 16',
      success: cdnResults.success,
      results: cdnResults
    });
    if (!cdnResults.success) overallSuccess = false;
    console.log('\n');

    // 2. Chaos Testing and Validation (Task 17)
    console.log('🔥 Running Chaos Testing and Validation...');
    console.log('=' .repeat(60));
    const chaosResults = await runChaosTestingAndValidation();
    testSuites.push({
      name: 'Chaos Testing & Validation',
      task: 'Task 17',
      success: chaosResults.success,
      results: chaosResults
    });
    if (!chaosResults.success) overallSuccess = false;
    console.log('\n');

    // 3. Passkey Recovery and Device Management (Task 18)
    console.log('🔑 Running Passkey Recovery Tests...');
    console.log('=' .repeat(60));
    const passkeyResults = await runPasskeyRecoveryTests();
    testSuites.push({
      name: 'Passkey Recovery & Device Management',
      task: 'Task 18',
      success: passkeyResults.success,
      results: passkeyResults
    });
    if (!passkeyResults.success) overallSuccess = false;
    console.log('\n');

    // 4. Financial Operations (Task 19)
    console.log('💰 Running Financial Operations Tests...');
    console.log('=' .repeat(60));
    const financialResults = await runFinancialOperationsTests();
    testSuites.push({
      name: 'Financial Operations',
      task: 'Task 19',
      success: financialResults.success,
      results: financialResults
    });
    if (!financialResults.success) overallSuccess = false;
    console.log('\n');

    // 5. AI Transparency and Opt-out Controls (Task 20)
    console.log('🤖 Running AI Transparency Tests...');
    console.log('=' .repeat(60));
    const aiResults = await runAITransparencyTests();
    testSuites.push({
      name: 'AI Transparency & Opt-out Controls',
      task: 'Task 20',
      success: aiResults.success,
      results: aiResults
    });
    if (!aiResults.success) overallSuccess = false;
    console.log('\n');

    // 6. Soft Launch with Pilot Agencies (Task 21)
    console.log('🚀 Running Soft Launch Tests...');
    console.log('=' .repeat(60));
    const softLaunchResults = await runSoftLaunchTests();
    testSuites.push({
      name: 'Soft Launch with Pilot Agencies',
      task: 'Task 21',
      success: softLaunchResults.success,
      results: softLaunchResults
    });
    if (!softLaunchResults.success) overallSuccess = false;
    console.log('\n');

    // Generate comprehensive report
    const totalDuration = Date.now() - startTime;
    const report = generateGoLiveReport(testSuites, totalDuration, overallSuccess);
    
    console.log('📊 GO-LIVE VALIDATION COMPLETE');
    console.log('=' .repeat(80));
    console.log(report);

    // Save detailed report
    const fs = require('fs').promises;
    const reportPath = './go-live-validation-report.md';
    await fs.writeFile(reportPath, report);
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    return {
      success: overallSuccess,
      testSuites,
      duration: totalDuration,
      report
    };

  } catch (error) {
    console.error('💥 Go-Live validation failed:', error);
    return {
      success: false,
      error: error.message,
      testSuites,
      duration: Date.now() - startTime
    };
  }
}

function generateGoLiveReport(testSuites, duration, overallSuccess) {
  const report = [];
  
  // Header
  report.push('# Go-Live Validation Report');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push(`Duration: ${(duration / 1000).toFixed(1)} seconds`);
  report.push(`Overall Status: ${overallSuccess ? '✅ READY FOR GO-LIVE' : '❌ ISSUES DETECTED'}`);
  report.push('');

  // Executive Summary
  report.push('## Executive Summary');
  report.push('');
  const totalTests = testSuites.reduce((sum, suite) => sum + (suite.results.summary?.totalTests || 0), 0);
  const passedTests = testSuites.reduce((sum, suite) => sum + (suite.results.summary?.passedTests || 0), 0);
  const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
  
  report.push(`- **Total Test Suites**: ${testSuites.length}`);
  report.push(`- **Successful Suites**: ${testSuites.filter(s => s.success).length}`);
  report.push(`- **Total Individual Tests**: ${totalTests}`);
  report.push(`- **Passed Individual Tests**: ${passedTests}`);
  report.push(`- **Overall Success Rate**: ${successRate.toFixed(1)}%`);
  report.push('');

  // Test Suite Results
  report.push('## Test Suite Results');
  report.push('');
  
  testSuites.forEach((suite, index) => {
    const status = suite.success ? '✅ PASSED' : '❌ FAILED';
    report.push(`### ${index + 1}. ${suite.name} (${suite.task}) ${status}`);
    
    if (suite.results.summary) {
      report.push(`- Tests: ${suite.results.summary.passedTests}/${suite.results.summary.totalTests} passed`);
      report.push(`- Success Rate: ${suite.results.summary.successRate.toFixed(1)}%`);
    }
    
    if (suite.results.error) {
      report.push(`- Error: ${suite.results.error}`);
    }
    
    report.push('');
  });

  // Critical Systems Validation
  report.push('## Critical Systems Validation');
  report.push('');
  
  const criticalSystems = [
    { name: 'CDN Failover & Resilience', suite: testSuites.find(s => s.name === 'Multi-CDN Failover') },
    { name: 'System Chaos Recovery', suite: testSuites.find(s => s.name === 'Chaos Testing & Validation') },
    { name: 'User Authentication & Recovery', suite: testSuites.find(s => s.name === 'Passkey Recovery & Device Management') },
    { name: 'Financial Operations', suite: testSuites.find(s => s.name === 'Financial Operations') },
    { name: 'AI Transparency & Ethics', suite: testSuites.find(s => s.name === 'AI Transparency & Opt-out Controls') },
    { name: 'Agency Onboarding & Support', suite: testSuites.find(s => s.name === 'Soft Launch with Pilot Agencies') }
  ];

  criticalSystems.forEach(system => {
    const status = system.suite?.success ? '✅' : '❌';
    report.push(`${status} **${system.name}**`);
    if (system.suite?.results.summary) {
      report.push(`  - ${system.suite.results.summary.passedTests}/${system.suite.results.summary.totalTests} tests passed`);
    }
  });
  report.push('');

  // Go/No-Go Decision Matrix
  report.push('## Go/No-Go Decision Matrix');
  report.push('');
  
  const goNoGoChecks = [
    { 
      criteria: 'CDN Failover Working', 
      status: testSuites.find(s => s.name === 'Multi-CDN Failover')?.success,
      weight: 'Critical'
    },
    { 
      criteria: 'System Resilience Validated', 
      status: testSuites.find(s => s.name === 'Chaos Testing & Validation')?.success,
      weight: 'Critical'
    },
    { 
      criteria: 'User Recovery Systems Active', 
      status: testSuites.find(s => s.name === 'Passkey Recovery & Device Management')?.success,
      weight: 'High'
    },
    { 
      criteria: 'Financial Operations Complete', 
      status: testSuites.find(s => s.name === 'Financial Operations')?.success,
      weight: 'Critical'
    },
    { 
      criteria: 'AI Transparency Implemented', 
      status: testSuites.find(s => s.name === 'AI Transparency & Opt-out Controls')?.success,
      weight: 'High'
    },
    { 
      criteria: 'Agency Onboarding Ready', 
      status: testSuites.find(s => s.name === 'Soft Launch with Pilot Agencies')?.success,
      weight: 'Critical'
    }
  ];

  goNoGoChecks.forEach(check => {
    const status = check.status ? '✅ GO' : '❌ NO-GO';
    report.push(`- **${check.criteria}** (${check.weight}): ${status}`);
  });

  const criticalFailures = goNoGoChecks.filter(c => c.weight === 'Critical' && !c.status).length;
  const highFailures = goNoGoChecks.filter(c => c.weight === 'High' && !c.status).length;
  
  report.push('');
  report.push(`**Critical Failures**: ${criticalFailures}`);
  report.push(`**High Priority Failures**: ${highFailures}`);
  report.push('');

  // Performance Metrics Summary
  report.push('## Performance Metrics Summary');
  report.push('');
  
  // Extract key metrics from test results
  const cdnSuite = testSuites.find(s => s.name === 'Multi-CDN Failover');
  const chaosSuite = testSuites.find(s => s.name === 'Chaos Testing & Validation');
  const financialSuite = testSuites.find(s => s.name === 'Financial Operations');
  const softLaunchSuite = testSuites.find(s => s.name === 'Soft Launch with Pilot Agencies');

  if (cdnSuite?.results.healthStatuses) {
    report.push('### CDN Performance');
    cdnSuite.results.healthStatuses.forEach(([providerId, status]) => {
      report.push(`- ${providerId}: ${status.responseTime}ms response time, ${status.isHealthy ? 'Healthy' : 'Unhealthy'}`);
    });
    report.push('');
  }

  if (chaosSuite?.results.resilienceReport) {
    report.push('### System Resilience');
    report.push(`- Overall Resilience Score: ${chaosSuite.results.resilienceReport.overallResilienceScore}/100`);
    report.push(`- Passed Scenarios: ${chaosSuite.results.resilienceReport.passedScenarios}/${chaosSuite.results.resilienceReport.totalScenarios}`);
    report.push('');
  }

  if (softLaunchSuite?.results.softLaunchMetrics) {
    const metrics = softLaunchSuite.results.softLaunchMetrics;
    report.push('### Agency Metrics');
    report.push(`- Active Agencies: ${metrics.activeAgencies}/${metrics.totalAgencies}`);
    report.push(`- Onboarding Success Rate: ${metrics.onboardingCompletionRate.toFixed(1)}%`);
    report.push(`- Average Satisfaction: ${metrics.overallSatisfaction.toFixed(1)}/5`);
    report.push(`- System Uptime: ${metrics.performanceMetrics.averageUptime.toFixed(1)}%`);
    report.push('');
  }

  // Recommendations
  report.push('## Recommendations');
  report.push('');
  
  if (overallSuccess) {
    report.push('### ✅ Ready for Go-Live');
    report.push('');
    report.push('All critical systems have passed validation testing. The platform is ready for agency launch with the following strengths:');
    report.push('');
    report.push('- Robust CDN failover and content delivery');
    report.push('- Proven system resilience under chaos conditions');
    report.push('- Complete user authentication and recovery systems');
    report.push('- Full financial operations with compliance');
    report.push('- Transparent AI usage with user controls');
    report.push('- Successful pilot agency onboarding');
    report.push('');
    report.push('**Next Steps:**');
    report.push('1. Begin full agency outreach and onboarding');
    report.push('2. Monitor system performance during initial launch');
    report.push('3. Collect and act on agency feedback');
    report.push('4. Scale infrastructure based on adoption metrics');
  } else {
    report.push('### ❌ Issues Require Resolution');
    report.push('');
    report.push('The following issues must be addressed before go-live:');
    report.push('');
    
    testSuites.filter(s => !s.success).forEach(suite => {
      report.push(`- **${suite.name}**: ${suite.results.error || 'Multiple test failures'}`);
    });
    
    report.push('');
    report.push('**Required Actions:**');
    report.push('1. Address all critical system failures');
    report.push('2. Re-run validation tests after fixes');
    report.push('3. Ensure all go/no-go criteria are met');
    report.push('4. Obtain stakeholder approval before launch');
  }

  // Technical Details
  report.push('');
  report.push('## Technical Implementation Details');
  report.push('');
  report.push('### Systems Implemented');
  report.push('- Multi-CDN failover with automatic health monitoring');
  report.push('- Chaos engineering validation and resilience testing');
  report.push('- Passkey-based authentication with device management');
  report.push('- Complete financial operations with regional compliance');
  report.push('- AI transparency dashboard with granular opt-out controls');
  report.push('- Agency onboarding system with dedicated support channels');
  report.push('');
  
  report.push('### Key Features Validated');
  report.push('- Real-time CDN health monitoring and failover');
  report.push('- Signed URL key rotation with zero downtime');
  report.push('- Regional content blocking and compliance enforcement');
  report.push('- System recovery under various failure scenarios');
  report.push('- User device management and account recovery flows');
  report.push('- Multi-currency financial operations with audit trails');
  report.push('- AI usage tracking and transparency reporting');
  report.push('- Agency-specific onboarding kits and support systems');
  report.push('');

  // Appendix
  report.push('## Appendix: Detailed Test Results');
  report.push('');
  
  testSuites.forEach((suite, index) => {
    report.push(`### ${index + 1}. ${suite.name} Detailed Results`);
    
    if (suite.results.testResults) {
      suite.results.testResults.forEach((test, testIndex) => {
        const status = test.passed ? '✅' : '❌';
        report.push(`${testIndex + 1}. ${status} ${test.test}: ${test.details}`);
      });
    }
    
    report.push('');
  });

  return report.join('\n');
}

// Run validation if called directly
if (require.main === module) {
  runGoLiveValidation()
    .then(result => {
      console.log('\n🎉 Go-Live Validation Complete!');
      console.log(`\n🎯 Final Status: ${result.success ? '✅ READY FOR GO-LIVE' : '❌ ISSUES DETECTED'}`);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Go-Live validation crashed:', error);
      process.exit(1);
    });
}

module.exports = { runGoLiveValidation };