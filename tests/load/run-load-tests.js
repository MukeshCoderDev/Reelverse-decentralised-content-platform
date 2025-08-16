#!/usr/bin/env node

/**
 * k6 Load Test Runner
 * Orchestrates different load testing scenarios
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

class LoadTestRunner {
  constructor() {
    this.resultsDir = path.join(process.cwd(), 'tests/load/results');
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!existsSync(this.resultsDir)) {
      mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Go-Live Sprint Load Testing Suite');
    console.log('=' .repeat(60));

    const testSuites = [
      {
        name: 'Concurrent Users',
        script: 'scenarios/concurrent-users.js',
        duration: '10m',
        critical: true
      },
      {
        name: 'Payment Processing',
        script: 'scenarios/payment-processing.js',
        duration: '15m',
        critical: true
      },
      {
        name: 'Video Streaming',
        script: 'scenarios/video-streaming.js',
        duration: '20m',
        critical: true
      },
      {
        name: 'Database Stress',
        script: 'scenarios/database-stress.js',
        duration: '12m',
        critical: false
      }
    ];

    const results = {
      total: testSuites.length,
      passed: 0,
      failed: 0,
      critical_failures: 0
    };

    for (const suite of testSuites) {
      console.log(`\n📊 Running: ${suite.name}`);
      console.log('-'.repeat(40));

      try {
        await this.runLoadTest(suite);
        results.passed++;
        console.log(`✅ ${suite.name} - PASSED`);
      } catch (error) {
        results.failed++;
        if (suite.critical) {
          results.critical_failures++;
        }
        console.log(`❌ ${suite.name} - FAILED`);
        console.error(error.message);
      }
    }

    this.generateSummaryReport(results);

    if (results.critical_failures > 0) {
      console.log('\n🚨 CRITICAL LOAD TEST FAILURES - PERFORMANCE ISSUES DETECTED');
      process.exit(1);
    } else if (results.failed > 0) {
      console.log('\n⚠️  Some load tests failed but no critical issues');
      process.exit(1);
    } else {
      console.log('\n🎉 ALL LOAD TESTS PASSED - PERFORMANCE TARGETS MET');
      process.exit(0);
    }
  }

  async runLoadTest(suite) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(this.resultsDir, `${suite.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.json`);
    
    const command = [
      'k6 run',
      `--out json=${outputFile}`,
      `--duration ${suite.duration}`,
      `tests/load/${suite.script}`
    ].join(' ');

    console.log(`Running: ${command}`);

    try {
      const output = execSync(command, {
        stdio: 'pipe',
        cwd: process.cwd(),
        timeout: this.parseDuration(suite.duration) + 60000 // Add 1 minute buffer
      });

      console.log(output.toString());
      
      // Validate results
      this.validateTestResults(outputFile, suite);
      
    } catch (error) {
      throw new Error(`Load test failed: ${error.message}`);
    }
  }

  validateTestResults(outputFile, suite) {
    if (!existsSync(outputFile)) {
      throw new Error('Test results file not found');
    }

    // Parse k6 results and validate against thresholds
    const results = this.parseK6Results(outputFile);
    
    // Check critical SLA requirements
    const slaChecks = this.checkSLACompliance(results, suite);
    
    if (!slaChecks.passed) {
      throw new Error(`SLA violations detected: ${slaChecks.violations.join(', ')}`);
    }
  }

  parseK6Results(outputFile) {
    // Parse k6 JSON output
    const fs = require('fs');
    const lines = fs.readFileSync(outputFile, 'utf8').split('\n').filter(line => line.trim());
    
    const metrics = {};
    
    lines.forEach(line => {
      try {
        const data = JSON.parse(line);
        if (data.type === 'Point' && data.metric) {
          if (!metrics[data.metric]) {
            metrics[data.metric] = [];
          }
          metrics[data.metric].push(data.data.value);
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    });

    return metrics;
  }

  checkSLACompliance(results, suite) {
    const violations = [];
    
    // Define SLA thresholds by test type
    const slaThresholds = {
      'Concurrent Users': {
        'http_req_duration': { p95: 2000 }, // 95% under 2s
        'http_req_failed': { rate: 0.02 }    // <2% failure rate
      },
      'Payment Processing': {
        'payment_duration': { p95: 30000 },  // 95% under 30s
        'payment_success_rate': { min: 0.98 } // >98% success
      },
      'Video Streaming': {
        'video_join_time': { p95: 2000 },    // 95% under 2s
        'rebuffer_rate': { max: 0.01 }       // <1% rebuffer rate
      },
      'Database Stress': {
        'db_query_time': { p95: 1000 },      // 95% under 1s
        'db_connection_errors': { rate: 0.01 } // <1% connection errors
      }
    };

    const thresholds = slaThresholds[suite.name];
    if (!thresholds) {
      return { passed: true, violations: [] };
    }

    // Check each threshold
    Object.entries(thresholds).forEach(([metric, limits]) => {
      const values = results[metric];
      if (!values || values.length === 0) {
        violations.push(`Missing metric: ${metric}`);
        return;
      }

      // Calculate percentiles and rates
      const sorted = values.sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);

      // Check limits
      if (limits.p95 && p95 > limits.p95) {
        violations.push(`${metric} P95 (${p95}) exceeds limit (${limits.p95})`);
      }
      if (limits.rate && avg > limits.rate) {
        violations.push(`${metric} rate (${avg}) exceeds limit (${limits.rate})`);
      }
      if (limits.max && max > limits.max) {
        violations.push(`${metric} max (${max}) exceeds limit (${limits.max})`);
      }
      if (limits.min && min < limits.min) {
        violations.push(`${metric} min (${min}) below limit (${limits.min})`);
      }
    });

    return {
      passed: violations.length === 0,
      violations
    };
  }

  parseDuration(duration) {
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) return 300000; // Default 5 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 300000;
    }
  }

  generateSummaryReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: results,
      sla_compliance: results.critical_failures === 0,
      go_live_ready: results.critical_failures === 0 && results.failed === 0
    };

    const reportPath = path.join(this.resultsDir, 'load-test-summary.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('📊 LOAD TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${results.total}`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Critical Failures: ${results.critical_failures}`);
    console.log(`SLA Compliance: ${report.sla_compliance ? 'PASS' : 'FAIL'}`);
    console.log(`Go-Live Ready: ${report.go_live_ready ? 'YES' : 'NO'}`);
    console.log('='.repeat(60));
  }

  async runSingle(testName) {
    const testMap = {
      'users': 'scenarios/concurrent-users.js',
      'payments': 'scenarios/payment-processing.js',
      'streaming': 'scenarios/video-streaming.js',
      'database': 'scenarios/database-stress.js'
    };

    const script = testMap[testName.toLowerCase()];
    if (!script) {
      console.error(`❌ Unknown test: ${testName}`);
      console.log('Available tests: users, payments, streaming, database');
      process.exit(1);
    }

    const suite = {
      name: testName,
      script: script,
      duration: '5m',
      critical: true
    };

    console.log(`🎯 Running Single Load Test: ${testName}`);
    
    try {
      await this.runLoadTest(suite);
      console.log(`✅ ${testName} - PASSED`);
    } catch (error) {
      console.log(`❌ ${testName} - FAILED`);
      console.error(error.message);
      process.exit(1);
    }
  }
}

// CLI Interface
async function main() {
  const runner = new LoadTestRunner();
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Go-Live Sprint Load Test Runner

Usage:
  node tests/load/run-load-tests.js           # Run all load tests
  node tests/load/run-load-tests.js --single <test>  # Run single test

Options:
  --single      Run a specific load test
  --help, -h    Show this help message

Available Tests:
  users         Concurrent users load test
  payments      Payment processing load test
  streaming     Video streaming load test
  database      Database stress test

Examples:
  node tests/load/run-load-tests.js --single users
  node tests/load/run-load-tests.js --single payments
`);
    process.exit(0);
  }

  if (args.includes('--single')) {
    const testIndex = args.indexOf('--single');
    const testName = args[testIndex + 1];
    
    if (!testName) {
      console.error('❌ Please specify a test name after --single');
      process.exit(1);
    }
    
    await runner.runSingle(testName);
  } else {
    await runner.runAllTests();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Load test runner failed:', error);
    process.exit(1);
  });
}

export { LoadTestRunner };