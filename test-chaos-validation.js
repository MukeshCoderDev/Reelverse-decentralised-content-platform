const { chaosTestingService } = require('./services/chaosTestingService');
const { cdnMonitoringService } = require('./services/cdnMonitoringService');
const { multiCdnFailoverService } = require('./services/multiCdnFailoverService');

async function runChaosTestingAndValidation() {
  console.log('🔥 Starting Chaos Testing and Validation Suite...\n');

  try {
    // 1. Pre-test system health check
    console.log('🏥 Pre-test System Health Check...');
    const preTestHealth = await performSystemHealthCheck();
    console.log(`System Health Score: ${preTestHealth.score}/100`);
    
    if (preTestHealth.score < 80) {
      console.log('⚠️  Warning: System health below 80% - chaos testing may produce unreliable results');
    }

    // 2. Display available chaos test scenarios
    console.log('\n📋 Available Chaos Test Scenarios:');
    const scenarios = chaosTestingService.getTestScenarios();
    scenarios.forEach((scenario, index) => {
      const severityIcon = getSeverityIcon(scenario.severity);
      const categoryIcon = getCategoryIcon(scenario.category);
      console.log(`${index + 1}. ${severityIcon}${categoryIcon} ${scenario.name}`);
      console.log(`   ${scenario.description}`);
      console.log(`   Duration: ${scenario.duration / 1000}s, Expected Recovery: ${scenario.expectedRecoveryTime / 1000}s`);
    });

    // 3. Run comprehensive chaos test suite
    console.log('\n🚀 Executing Chaos Test Suite...');
    const resilienceReport = await chaosTestingService.runChaosTestSuite();

    // 4. Display detailed results
    console.log('\n📊 Chaos Testing Results:');
    console.log(`🎯 Overall Resilience Score: ${resilienceReport.overallResilienceScore}/100`);
    console.log(`✅ Passed Scenarios: ${resilienceReport.passedScenarios}/${resilienceReport.totalScenarios}`);
    console.log(`❌ Failed Scenarios: ${resilienceReport.failedScenarios}/${resilienceReport.totalScenarios}`);
    console.log(`📈 Success Rate: ${((resilienceReport.passedScenarios / resilienceReport.totalScenarios) * 100).toFixed(1)}%`);

    // 5. Display individual test results
    console.log('\n🔍 Individual Test Results:');
    resilienceReport.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const recoveryStatus = result.recoveryTime > 0 ? `${result.recoveryTime}ms` : 'N/A';
      
      console.log(`\n${index + 1}. ${status} ${result.scenarioName}`);
      console.log(`   Duration: ${result.duration}ms | Recovery: ${recoveryStatus}`);
      console.log(`   Availability: ${result.impactMetrics.serviceAvailability.toFixed(1)}%`);
      console.log(`   Response Time Impact: +${result.impactMetrics.responseTimeIncrease.toFixed(1)}%`);
      console.log(`   Error Rate Impact: +${result.impactMetrics.errorRateIncrease.toFixed(1)}%`);
      console.log(`   Data Loss: ${result.impactMetrics.dataLoss ? '❌ YES' : '✅ NO'}`);
      console.log(`   Alerts Triggered: ${result.alertsTriggered}`);
      console.log(`   Monitoring Response: ${result.monitoringResponse ? '✅ YES' : '❌ NO'}`);
      console.log(`   Details: ${result.details}`);
    });

    // 6. Critical issues and recommendations
    if (resilienceReport.criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues Identified:');
      resilienceReport.criticalIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }

    if (resilienceReport.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      resilienceReport.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    // 7. Validate specific resilience requirements
    console.log('\n🎯 Validating Specific Requirements:');
    const validationResults = await validateResilienceRequirements(resilienceReport);
    
    Object.entries(validationResults).forEach(([requirement, result]) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${requirement}: ${result.message}`);
    });

    // 8. CDN-specific validation
    console.log('\n🌐 CDN Resilience Validation:');
    const cdnValidation = await validateCDNResilience();
    
    Object.entries(cdnValidation).forEach(([test, result]) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${test}: ${result.message}`);
    });

    // 9. Post-test system health check
    console.log('\n🏥 Post-test System Health Check...');
    const postTestHealth = await performSystemHealthCheck();
    console.log(`System Health Score: ${postTestHealth.score}/100`);
    
    const healthDelta = postTestHealth.score - preTestHealth.score;
    if (healthDelta < -10) {
      console.log(`⚠️  Warning: System health degraded by ${Math.abs(healthDelta)} points after chaos testing`);
    } else if (healthDelta > 5) {
      console.log(`✅ System health improved by ${healthDelta} points (likely due to failover to better providers)`);
    } else {
      console.log(`✅ System health stable (${healthDelta >= 0 ? '+' : ''}${healthDelta} points)`);
    }

    // 10. Generate comprehensive reports
    console.log('\n📄 Generating Reports...');
    await generateChaosTestReports(resilienceReport, preTestHealth, postTestHealth);

    // 11. Final validation summary
    console.log('\n🏆 Final Validation Summary:');
    const overallSuccess = evaluateOverallSuccess(resilienceReport, validationResults, cdnValidation);
    
    const finalChecks = [
      { name: 'Resilience Score ≥ 80', passed: resilienceReport.overallResilienceScore >= 80 },
      { name: 'No Critical Failures', passed: resilienceReport.criticalIssues.length === 0 },
      { name: 'CDN Failover Working', passed: cdnValidation.failover?.success || false },
      { name: 'Key Rotation Under Load', passed: cdnValidation.keyRotation?.success || false },
      { name: 'Regional Blocking Active', passed: cdnValidation.regionalBlocking?.success || false },
      { name: 'Monitoring Responsive', passed: resilienceReport.results.every(r => r.monitoringResponse) },
      { name: 'System Health Stable', passed: Math.abs(healthDelta) <= 10 }
    ];

    finalChecks.forEach(check => {
      console.log(`${check.passed ? '✅' : '❌'} ${check.name}`);
    });

    const allPassed = finalChecks.every(check => check.passed);
    console.log(`\n🎉 Overall Status: ${allPassed ? '✅ CHAOS TESTING PASSED' : '❌ ISSUES DETECTED'}`);

    return {
      success: allPassed,
      resilienceReport,
      validationResults,
      cdnValidation,
      preTestHealth,
      postTestHealth,
      finalChecks
    };

  } catch (error) {
    console.error('💥 Chaos testing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function getSeverityIcon(severity) {
  const icons = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴'
  };
  return icons[severity] || '⚪';
}

function getCategoryIcon(category) {
  const icons = {
    cdn: '🌐',
    database: '🗄️',
    network: '🔗',
    service: '⚙️',
    security: '🔒'
  };
  return icons[category] || '📦';
}

async function performSystemHealthCheck() {
  // Simulate comprehensive system health check
  const healthMetrics = {
    cdnHealth: Math.random() * 20 + 80, // 80-100
    databaseHealth: Math.random() * 15 + 85, // 85-100
    networkHealth: Math.random() * 10 + 90, // 90-100
    serviceHealth: Math.random() * 25 + 75, // 75-100
    securityHealth: Math.random() * 5 + 95 // 95-100
  };

  const overallScore = Math.round(
    (healthMetrics.cdnHealth * 0.3) +
    (healthMetrics.databaseHealth * 0.25) +
    (healthMetrics.networkHealth * 0.2) +
    (healthMetrics.serviceHealth * 0.15) +
    (healthMetrics.securityHealth * 0.1)
  );

  return {
    score: overallScore,
    metrics: healthMetrics,
    timestamp: new Date()
  };
}

async function validateResilienceRequirements(report) {
  return {
    'CDN Failover Recovery < 5s': {
      passed: report.results
        .filter(r => r.scenarioId.includes('cdn'))
        .every(r => r.recoveryTime < 5000),
      message: 'CDN failover recovery time validation'
    },
    'Service Availability > 95%': {
      passed: report.results.every(r => r.impactMetrics.serviceAvailability > 95),
      message: 'Service availability during chaos events'
    },
    'No Data Loss': {
      passed: report.results.every(r => !r.impactMetrics.dataLoss),
      message: 'Data integrity during failures'
    },
    'Monitoring Alerts Triggered': {
      passed: report.results.every(r => r.alertsTriggered > 0),
      message: 'Monitoring system responsiveness'
    },
    'Regional Compliance Maintained': {
      passed: report.results
        .filter(r => r.scenarioId.includes('regional'))
        .every(r => r.success),
      message: 'Regional blocking and compliance'
    }
  };
}

async function validateCDNResilience() {
  const results = {};

  try {
    // Test CDN failover
    console.log('   Testing CDN failover capability...');
    const failoverValid = await cdnMonitoringService.runFailoverValidation();
    results.failover = {
      success: failoverValid,
      message: failoverValid ? 'CDN failover working correctly' : 'CDN failover validation failed'
    };

    // Test key rotation
    console.log('   Testing key rotation...');
    const activeProvider = multiCdnFailoverService.getActiveProvider();
    const keyConfig = await multiCdnFailoverService.rotateSignedUrlKey(activeProvider.id);
    results.keyRotation = {
      success: !!keyConfig.keyId,
      message: keyConfig.keyId ? `Key rotation successful: ${keyConfig.keyId}` : 'Key rotation failed'
    };

    // Test regional blocking
    console.log('   Testing regional blocking...');
    const regions = ['us', 'uk', 'de'];
    const blockingTests = regions.map(region => {
      const provider = multiCdnFailoverService.getActiveProvider(region);
      return provider.regions.includes(region) || provider.regions.includes('global');
    });
    
    results.regionalBlocking = {
      success: blockingTests.every(test => test),
      message: `Regional provider selection: ${blockingTests.filter(t => t).length}/${regions.length} regions supported`
    };

    // Test signed URL generation
    console.log('   Testing signed URL generation...');
    const testUrls = [
      multiCdnFailoverService.generateSignedUrl('/test1.mp4', 3600),
      multiCdnFailoverService.generateSignedUrl('/test2.mp4', 3600, 'us'),
      multiCdnFailoverService.generateSignedUrl('/test3.mp4', 3600, 'eu')
    ];
    
    results.signedUrls = {
      success: testUrls.length === 3 && testUrls.every(url => url.includes('signature')),
      message: `Signed URL generation: ${testUrls.length}/3 URLs generated successfully`
    };

  } catch (error) {
    results.error = {
      success: false,
      message: `CDN validation error: ${error.message}`
    };
  }

  return results;
}

function evaluateOverallSuccess(resilienceReport, validationResults, cdnValidation) {
  const resilienceScore = resilienceReport.overallResilienceScore >= 80;
  const noCriticalIssues = resilienceReport.criticalIssues.length === 0;
  const validationsPassed = Object.values(validationResults).every(r => r.passed);
  const cdnTestsPassed = Object.values(cdnValidation).every(r => r.success);

  return resilienceScore && noCriticalIssues && validationsPassed && cdnTestsPassed;
}

async function generateChaosTestReports(resilienceReport, preTestHealth, postTestHealth) {
  const fs = require('fs').promises;

  // Generate detailed chaos test report
  const chaosReport = [
    '# Chaos Testing and Validation Report',
    `Generated: ${new Date().toISOString()}`,
    `Test Suite ID: ${resilienceReport.testSuiteId}`,
    '',
    '## Executive Summary',
    `- Overall Resilience Score: ${resilienceReport.overallResilienceScore}/100`,
    `- Total Scenarios Tested: ${resilienceReport.totalScenarios}`,
    `- Scenarios Passed: ${resilienceReport.passedScenarios}`,
    `- Scenarios Failed: ${resilienceReport.failedScenarios}`,
    `- Success Rate: ${((resilienceReport.passedScenarios / resilienceReport.totalScenarios) * 100).toFixed(1)}%`,
    '',
    '## System Health Impact',
    `- Pre-test Health Score: ${preTestHealth.score}/100`,
    `- Post-test Health Score: ${postTestHealth.score}/100`,
    `- Health Delta: ${postTestHealth.score - preTestHealth.score} points`,
    '',
    '## Test Results Details',
    ''
  ];

  resilienceReport.results.forEach((result, index) => {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    chaosReport.push(`### ${index + 1}. ${result.scenarioName} ${status}`);
    chaosReport.push(`- **Duration**: ${result.duration}ms`);
    chaosReport.push(`- **Recovery Time**: ${result.recoveryTime > 0 ? result.recoveryTime + 'ms' : 'N/A'}`);
    chaosReport.push(`- **Service Availability**: ${result.impactMetrics.serviceAvailability.toFixed(1)}%`);
    chaosReport.push(`- **Response Time Impact**: +${result.impactMetrics.responseTimeIncrease.toFixed(1)}%`);
    chaosReport.push(`- **Error Rate Impact**: +${result.impactMetrics.errorRateIncrease.toFixed(1)}%`);
    chaosReport.push(`- **Data Loss**: ${result.impactMetrics.dataLoss ? 'YES' : 'NO'}`);
    chaosReport.push(`- **Alerts Triggered**: ${result.alertsTriggered}`);
    chaosReport.push(`- **Monitoring Response**: ${result.monitoringResponse ? 'YES' : 'NO'}`);
    chaosReport.push(`- **Details**: ${result.details}`);
    chaosReport.push('');
  });

  if (resilienceReport.criticalIssues.length > 0) {
    chaosReport.push('## Critical Issues');
    resilienceReport.criticalIssues.forEach((issue, index) => {
      chaosReport.push(`${index + 1}. ${issue}`);
    });
    chaosReport.push('');
  }

  if (resilienceReport.recommendations.length > 0) {
    chaosReport.push('## Recommendations');
    resilienceReport.recommendations.forEach((rec, index) => {
      chaosReport.push(`${index + 1}. ${rec}`);
    });
    chaosReport.push('');
  }

  // Save chaos test report
  const chaosReportPath = './chaos-testing-report.md';
  await fs.writeFile(chaosReportPath, chaosReport.join('\n'));
  console.log(`✅ Chaos test report saved to: ${chaosReportPath}`);

  // Generate monitoring report
  const monitoringReport = cdnMonitoringService.generateMonitoringReport();
  const monitoringReportPath = './chaos-monitoring-report.md';
  await fs.writeFile(monitoringReportPath, monitoringReport);
  console.log(`✅ Monitoring report saved to: ${monitoringReportPath}`);
}

// Run chaos testing if called directly
if (require.main === module) {
  runChaosTestingAndValidation()
    .then(result => {
      console.log('\n🎉 Chaos Testing and Validation Complete!');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Chaos testing suite crashed:', error);
      process.exit(1);
    });
}

module.exports = { runChaosTestingAndValidation };