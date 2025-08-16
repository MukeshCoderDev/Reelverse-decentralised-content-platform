#!/usr/bin/env node

/**
 * E2E Test Runner for Go-Live Sprint
 * Runs comprehensive test suite for critical user journeys
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

interface TestSuite {
  name: string;
  file: string;
  critical: boolean;
  timeout: number;
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'Fiat Payment Flow',
    file: '01-fiat-payment-flow.spec.ts',
    critical: true,
    timeout: 120000
  },
  {
    name: 'Gasless Payment Flow',
    file: '02-gasless-payment-flow.spec.ts',
    critical: true,
    timeout: 120000
  },
  {
    name: 'Passkey Onboarding',
    file: '03-passkey-onboarding.spec.ts',
    critical: true,
    timeout: 90000
  },
  {
    name: 'Video Playback Flow',
    file: '04-video-playback-flow.spec.ts',
    critical: true,
    timeout: 90000
  },
  {
    name: 'Consent Management',
    file: '05-consent-management-flow.spec.ts',
    critical: true,
    timeout: 120000
  },
  {
    name: 'DMCA Takedown Flow',
    file: '06-dmca-takedown-flow.spec.ts',
    critical: true,
    timeout: 120000
  },
  {
    name: 'Payout Processing',
    file: '07-payout-processing-flow.spec.ts',
    critical: true,
    timeout: 120000
  }
];

class E2ETestRunner {
  private resultsDir: string;
  private startTime: number;

  constructor() {
    this.resultsDir = path.join(process.cwd(), 'test-results');
    this.startTime = Date.now();
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!existsSync(this.resultsDir)) {
      mkdirSync(this.resultsDir, { recursive: true });
    }

    const screenshotsDir = path.join(this.resultsDir, 'screenshots');
    if (!existsSync(screenshotsDir)) {
      mkdirSync(screenshotsDir, { recursive: true });
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Go-Live Sprint E2E Test Suite');
    console.log('=' .repeat(60));

    const results = {
      total: TEST_SUITES.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      critical_failures: 0
    };

    for (const suite of TEST_SUITES) {
      console.log(`\n📋 Running: ${suite.name}`);
      console.log('-'.repeat(40));

      try {
        await this.runTestSuite(suite);
        results.passed++;
        console.log(`✅ ${suite.name} - PASSED`);
      } catch (error) {
        results.failed++;
        if (suite.critical) {
          results.critical_failures++;
        }
        console.log(`❌ ${suite.name} - FAILED`);
        console.error(error);
      }
    }

    this.printSummary(results);
    
    if (results.critical_failures > 0) {
      console.log('\n🚨 CRITICAL FAILURES DETECTED - GO-LIVE BLOCKED');
      process.exit(1);
    } else if (results.failed > 0) {
      console.log('\n⚠️  Some tests failed but no critical failures');
      process.exit(1);
    } else {
      console.log('\n🎉 ALL TESTS PASSED - GO-LIVE READY');
      process.exit(0);
    }
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    const command = `npx playwright test tests/e2e/${suite.file} --timeout=${suite.timeout}`;
    
    try {
      execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd(),
        timeout: suite.timeout + 30000 // Add buffer for setup/teardown
      });
    } catch (error) {
      throw new Error(`Test suite ${suite.name} failed: ${error}`);
    }
  }

  private printSummary(results: any): void {
    const duration = Date.now() - this.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST EXECUTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${results.total}`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Critical Failures: ${results.critical_failures}`);
    console.log(`Duration: ${minutes}m ${seconds}s`);
    console.log('='.repeat(60));
  }

  async runCriticalOnly(): Promise<void> {
    console.log('🎯 Running Critical Tests Only');
    
    const criticalSuites = TEST_SUITES.filter(suite => suite.critical);
    
    for (const suite of criticalSuites) {
      console.log(`\n📋 Running Critical: ${suite.name}`);
      try {
        await this.runTestSuite(suite);
        console.log(`✅ ${suite.name} - PASSED`);
      } catch (error) {
        console.log(`❌ ${suite.name} - FAILED`);
        console.error(error);
        process.exit(1);
      }
    }
    
    console.log('\n🎉 ALL CRITICAL TESTS PASSED');
  }

  async runSingle(testName: string): Promise<void> {
    const suite = TEST_SUITES.find(s => 
      s.name.toLowerCase().includes(testName.toLowerCase()) ||
      s.file.includes(testName)
    );

    if (!suite) {
      console.error(`❌ Test suite not found: ${testName}`);
      console.log('Available test suites:');
      TEST_SUITES.forEach(s => console.log(`  - ${s.name} (${s.file})`));
      process.exit(1);
    }

    console.log(`🎯 Running Single Test: ${suite.name}`);
    
    try {
      await this.runTestSuite(suite);
      console.log(`✅ ${suite.name} - PASSED`);
    } catch (error) {
      console.log(`❌ ${suite.name} - FAILED`);
      console.error(error);
      process.exit(1);
    }
  }
}

// CLI Interface
async function main() {
  const runner = new E2ETestRunner();
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Go-Live Sprint E2E Test Runner

Usage:
  npm run test:e2e                 # Run all tests
  npm run test:e2e -- --critical   # Run critical tests only
  npm run test:e2e -- --single <name>  # Run single test suite

Options:
  --critical    Run only critical tests
  --single      Run a specific test suite
  --help, -h    Show this help message

Examples:
  npm run test:e2e -- --critical
  npm run test:e2e -- --single "fiat payment"
  npm run test:e2e -- --single "passkey"
`);
    process.exit(0);
  }

  if (args.includes('--critical')) {
    await runner.runCriticalOnly();
  } else if (args.includes('--single')) {
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
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { E2ETestRunner, TEST_SUITES };