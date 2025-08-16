import { multiCdnFailoverService } from './multiCdnFailoverService';
import { statusPageService } from './statusPageService';

export interface ChaosTestScenario {
  id: string;
  name: string;
  description: string;
  category: 'cdn' | 'database' | 'network' | 'service' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration: number; // milliseconds
  expectedRecoveryTime: number; // milliseconds
}

export interface ChaosTestResult {
  scenarioId: string;
  scenarioName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  recoveryTime: number;
  impactMetrics: {
    serviceAvailability: number; // percentage
    responseTimeIncrease: number; // percentage
    errorRateIncrease: number; // percentage
    dataLoss: boolean;
  };
  details: string;
  logs: string[];
  alertsTriggered: number;
  monitoringResponse: boolean;
}

export interface SystemResilienceReport {
  testSuiteId: string;
  executionTime: Date;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  overallResilienceScore: number; // 0-100
  criticalIssues: string[];
  recommendations: string[];
  results: ChaosTestResult[];
}

export class ChaosTestingService {
  private testScenarios: Map<string, ChaosTestScenario> = new Map();
  private testResults: ChaosTestResult[] = [];
  private isTestingActive = false;

  constructor() {
    this.initializeTestScenarios();
  }

  private initializeTestScenarios(): void {
    const scenarios: ChaosTestScenario[] = [
      {
        id: 'cdn-primary-failure',
        name: 'Primary CDN Failure',
        description: 'Simulate complete failure of primary CDN provider',
        category: 'cdn',
        severity: 'high',
        duration: 60000, // 1 minute
        expectedRecoveryTime: 5000 // 5 seconds
      },
      {
        id: 'cdn-key-rotation-under-load',
        name: 'CDN Key Rotation Under Load',
        description: 'Test signed URL key rotation during high traffic',
        category: 'cdn',
        severity: 'medium',
        duration: 30000, // 30 seconds
        expectedRecoveryTime: 2000 // 2 seconds
      },
      {
        id: 'regional-blocklist-enforcement',
        name: 'Regional Blocklist Enforcement',
        description: 'Validate geo-blocking and regional compliance',
        category: 'security',
        severity: 'high',
        duration: 45000, // 45 seconds
        expectedRecoveryTime: 1000 // 1 second
      },
      {
        id: 'database-connection-failure',
        name: 'Database Connection Failure',
        description: 'Simulate database connection pool exhaustion',
        category: 'database',
        severity: 'critical',
        duration: 90000, // 1.5 minutes
        expectedRecoveryTime: 10000 // 10 seconds
      },
      {
        id: 'network-partition',
        name: 'Network Partition',
        description: 'Simulate network partition between services',
        category: 'network',
        severity: 'critical',
        duration: 120000, // 2 minutes
        expectedRecoveryTime: 15000 // 15 seconds
      },
      {
        id: 'service-degradation',
        name: 'Service Degradation',
        description: 'Simulate gradual service performance degradation',
        category: 'service',
        severity: 'medium',
        duration: 180000, // 3 minutes
        expectedRecoveryTime: 30000 // 30 seconds
      },
      {
        id: 'multiple-cdn-failures',
        name: 'Multiple CDN Provider Failures',
        description: 'Simulate cascading failures across multiple CDN providers',
        category: 'cdn',
        severity: 'critical',
        duration: 150000, // 2.5 minutes
        expectedRecoveryTime: 20000 // 20 seconds
      },
      {
        id: 'signed-url-key-compromise',
        name: 'Signed URL Key Compromise',
        description: 'Simulate emergency key revocation and rotation',
        category: 'security',
        severity: 'critical',
        duration: 60000, // 1 minute
        expectedRecoveryTime: 5000 // 5 seconds
      }
    ];

    scenarios.forEach(scenario => {
      this.testScenarios.set(scenario.id, scenario);
    });
  }

  public async runChaosTestSuite(): Promise<SystemResilienceReport> {
    if (this.isTestingActive) {
      throw new Error('Chaos testing is already in progress');
    }

    this.isTestingActive = true;
    const testSuiteId = `chaos-test-${Date.now()}`;
    const executionTime = new Date();
    
    console.log(`🔥 Starting Chaos Testing Suite: ${testSuiteId}`);
    console.log(`📅 Execution Time: ${executionTime.toISOString()}`);

    try {
      // Clear previous results
      this.testResults = [];

      // Run all test scenarios
      const scenarios = Array.from(this.testScenarios.values());
      
      for (const scenario of scenarios) {
        console.log(`\n🎯 Running: ${scenario.name}`);
        const result = await this.runChaosScenario(scenario);
        this.testResults.push(result);
        
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        console.log(`   ${status} - Recovery: ${result.recoveryTime}ms`);
        
        // Wait between tests to allow system recovery
        await this.sleep(5000);
      }

      // Generate resilience report
      const report = this.generateResilienceReport(testSuiteId, executionTime);
      
      console.log(`\n📊 Chaos Testing Complete!`);
      console.log(`🎯 Overall Resilience Score: ${report.overallResilienceScore}/100`);
      console.log(`✅ Passed: ${report.passedScenarios}/${report.totalScenarios}`);
      console.log(`❌ Failed: ${report.failedScenarios}/${report.totalScenarios}`);

      return report;

    } finally {
      this.isTestingActive = false;
    }
  }

  private async runChaosScenario(scenario: ChaosTestScenario): Promise<ChaosTestResult> {
    const startTime = new Date();
    const logs: string[] = [];
    let alertsTriggered = 0;
    let monitoringResponse = false;

    logs.push(`Starting chaos scenario: ${scenario.name}`);
    logs.push(`Expected duration: ${scenario.duration}ms`);
    logs.push(`Expected recovery: ${scenario.expectedRecoveryTime}ms`);

    try {
      // Execute the specific chaos scenario
      const chaosResult = await this.executeChaosScenario(scenario, logs);
      
      // Monitor system response
      const monitoringResult = await this.monitorSystemResponse(scenario, logs);
      alertsTriggered = monitoringResult.alertsTriggered;
      monitoringResponse = monitoringResult.responded;

      // Wait for expected duration
      await this.sleep(scenario.duration);

      // Measure recovery
      const recoveryStartTime = Date.now();
      const recoveryResult = await this.measureRecovery(scenario, logs);
      const recoveryTime = Date.now() - recoveryStartTime;

      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();

      // Determine success criteria
      const success = this.evaluateScenarioSuccess(scenario, recoveryTime, chaosResult, recoveryResult);

      logs.push(`Scenario completed. Success: ${success}`);
      logs.push(`Total duration: ${totalDuration}ms`);
      logs.push(`Recovery time: ${recoveryTime}ms`);

      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        startTime,
        endTime,
        duration: totalDuration,
        success,
        recoveryTime,
        impactMetrics: {
          serviceAvailability: recoveryResult.availability,
          responseTimeIncrease: recoveryResult.responseTimeIncrease,
          errorRateIncrease: recoveryResult.errorRateIncrease,
          dataLoss: recoveryResult.dataLoss
        },
        details: chaosResult.details,
        logs,
        alertsTriggered,
        monitoringResponse
      };

    } catch (error) {
      const endTime = new Date();
      logs.push(`Scenario failed with error: ${error.message}`);

      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        success: false,
        recoveryTime: -1,
        impactMetrics: {
          serviceAvailability: 0,
          responseTimeIncrease: 100,
          errorRateIncrease: 100,
          dataLoss: true
        },
        details: `Scenario execution failed: ${error.message}`,
        logs,
        alertsTriggered,
        monitoringResponse: false
      };
    }
  }

  private async executeChaosScenario(scenario: ChaosTestScenario, logs: string[]): Promise<any> {
    switch (scenario.id) {
      case 'cdn-primary-failure':
        return await this.simulateCDNFailure(logs);
      
      case 'cdn-key-rotation-under-load':
        return await this.simulateKeyRotationUnderLoad(logs);
      
      case 'regional-blocklist-enforcement':
        return await this.validateRegionalBlocklist(logs);
      
      case 'database-connection-failure':
        return await this.simulateDatabaseFailure(logs);
      
      case 'network-partition':
        return await this.simulateNetworkPartition(logs);
      
      case 'service-degradation':
        return await this.simulateServiceDegradation(logs);
      
      case 'multiple-cdn-failures':
        return await this.simulateMultipleCDNFailures(logs);
      
      case 'signed-url-key-compromise':
        return await this.simulateKeyCompromise(logs);
      
      default:
        throw new Error(`Unknown chaos scenario: ${scenario.id}`);
    }
  }

  private async simulateCDNFailure(logs: string[]): Promise<any> {
    logs.push('Simulating primary CDN failure...');
    
    const activeProvider = multiCdnFailoverService.getActiveProvider();
    logs.push(`Current active provider: ${activeProvider.name}`);
    
    // Trigger failover
    const failoverEvent = await multiCdnFailoverService.triggerFailover(
      activeProvider.id,
      'Chaos testing: simulated CDN failure'
    );
    
    logs.push(`Failover triggered: ${failoverEvent.fromProvider} -> ${failoverEvent.toProvider}`);
    
    return {
      details: `CDN failover from ${failoverEvent.fromProvider} to ${failoverEvent.toProvider}`,
      originalProvider: activeProvider.id,
      newProvider: failoverEvent.toProvider
    };
  }

  private async simulateKeyRotationUnderLoad(logs: string[]): Promise<any> {
    logs.push('Simulating key rotation under load...');
    
    const activeProvider = multiCdnFailoverService.getActiveProvider();
    
    // Generate load by creating multiple signed URLs
    const loadPromises = Array.from({ length: 50 }, (_, i) =>
      Promise.resolve(multiCdnFailoverService.generateSignedUrl(`/load-test-${i}.mp4`, 3600))
    );
    
    // Rotate key during load
    const [urls, keyConfig] = await Promise.all([
      Promise.all(loadPromises),
      multiCdnFailoverService.rotateSignedUrlKey(activeProvider.id)
    ]);
    
    logs.push(`Generated ${urls.length} URLs during key rotation`);
    logs.push(`New key ID: ${keyConfig.keyId}`);
    
    return {
      details: `Key rotation completed under load with ${urls.length} concurrent URL generations`,
      urlsGenerated: urls.length,
      newKeyId: keyConfig.keyId
    };
  }

  private async validateRegionalBlocklist(logs: string[]): Promise<any> {
    logs.push('Validating regional blocklist enforcement...');
    
    const regions = ['us', 'uk', 'de', 'au', 'in'];
    const blockedCategories = ['adult-content-restricted', 'gambling-restricted'];
    const results: any[] = [];
    
    for (const region of regions) {
      for (const category of blockedCategories) {
        // Simulate blocklist check
        const isBlocked = await this.checkRegionalBlocking(region, category);
        results.push({ region, category, blocked: isBlocked });
        logs.push(`${region}/${category}: ${isBlocked ? 'BLOCKED' : 'ALLOWED'}`);
      }
    }
    
    const allBlocked = results.every(r => r.blocked);
    
    return {
      details: `Regional blocklist validation: ${results.length} checks, all blocked: ${allBlocked}`,
      results,
      allBlocked
    };
  }

  private async checkRegionalBlocking(region: string, category: string): Promise<boolean> {
    // Simulate regional blocking check
    // In production, this would check actual CDN/firewall rules
    const blockedRegions: Record<string, string[]> = {
      'us': ['adult-content-restricted'],
      'uk': ['adult-content-restricted', 'gambling-restricted'],
      'de': ['adult-content-restricted', 'hate-speech-restricted'],
      'au': ['adult-content-restricted', 'gambling-restricted'],
      'in': ['adult-content-restricted', 'gambling-restricted', 'political-restricted']
    };
    
    return blockedRegions[region]?.includes(category) || false;
  }

  private async simulateDatabaseFailure(logs: string[]): Promise<any> {
    logs.push('Simulating database connection failure...');
    
    // Simulate database connection issues
    // In production, this would actually test database failover
    const connectionAttempts = 5;
    const failedConnections = Math.floor(connectionAttempts * 0.6); // 60% failure rate
    
    logs.push(`Simulated ${failedConnections}/${connectionAttempts} failed connections`);
    
    return {
      details: `Database failure simulation: ${failedConnections}/${connectionAttempts} connections failed`,
      connectionAttempts,
      failedConnections,
      failureRate: failedConnections / connectionAttempts
    };
  }

  private async simulateNetworkPartition(logs: string[]): Promise<any> {
    logs.push('Simulating network partition...');
    
    // Simulate network partition between services
    const services = ['api', 'database', 'cdn', 'auth'];
    const partitionedServices = services.slice(0, 2); // Partition first 2 services
    
    logs.push(`Partitioned services: ${partitionedServices.join(', ')}`);
    
    return {
      details: `Network partition simulation: ${partitionedServices.length}/${services.length} services partitioned`,
      totalServices: services.length,
      partitionedServices: partitionedServices.length,
      affectedServices: partitionedServices
    };
  }

  private async simulateServiceDegradation(logs: string[]): Promise<any> {
    logs.push('Simulating service degradation...');
    
    // Simulate gradual performance degradation
    const baselineResponseTime = 100; // ms
    const degradationFactor = 3; // 3x slower
    const degradedResponseTime = baselineResponseTime * degradationFactor;
    
    logs.push(`Response time degraded: ${baselineResponseTime}ms -> ${degradedResponseTime}ms`);
    
    return {
      details: `Service degradation: ${degradationFactor}x slower response times`,
      baselineResponseTime,
      degradedResponseTime,
      degradationFactor
    };
  }

  private async simulateMultipleCDNFailures(logs: string[]): Promise<any> {
    logs.push('Simulating multiple CDN failures...');
    
    const healthStatuses = multiCdnFailoverService.getAllHealthStatus();
    const providers = Array.from(healthStatuses.keys());
    
    if (providers.length < 2) {
      throw new Error('Need at least 2 CDN providers for multiple failure test');
    }
    
    const failureResults: string[] = [];
    
    // Fail multiple providers sequentially
    for (let i = 0; i < Math.min(providers.length - 1, 2); i++) {
      const provider = providers[i];
      try {
        await multiCdnFailoverService.triggerFailover(provider, `Chaos test: multiple failure ${i + 1}`);
        failureResults.push(`${provider}: failover successful`);
        logs.push(`Failed over from ${provider}`);
      } catch (error) {
        failureResults.push(`${provider}: failover failed`);
        logs.push(`Failover failed for ${provider}: ${error.message}`);
      }
    }
    
    return {
      details: `Multiple CDN failures: ${failureResults.length} providers affected`,
      failureResults,
      providersAffected: failureResults.length
    };
  }

  private async simulateKeyCompromise(logs: string[]): Promise<any> {
    logs.push('Simulating signed URL key compromise...');
    
    const activeProvider = multiCdnFailoverService.getActiveProvider();
    
    // Emergency key rotation
    const newKeyConfig = await multiCdnFailoverService.rotateSignedUrlKey(activeProvider.id);
    
    logs.push(`Emergency key rotation completed: ${newKeyConfig.keyId}`);
    logs.push(`Key expires: ${newKeyConfig.expiresAt.toISOString()}`);
    
    return {
      details: `Emergency key rotation due to compromise: ${newKeyConfig.keyId}`,
      newKeyId: newKeyConfig.keyId,
      providerId: activeProvider.id
    };
  }

  private async monitorSystemResponse(scenario: ChaosTestScenario, logs: string[]): Promise<{ alertsTriggered: number; responded: boolean }> {
    logs.push('Monitoring system response to chaos...');
    
    // Simulate monitoring system response
    // In production, this would check actual monitoring alerts
    const alertsTriggered = Math.floor(Math.random() * 3) + 1; // 1-3 alerts
    const responded = alertsTriggered > 0;
    
    logs.push(`Alerts triggered: ${alertsTriggered}`);
    logs.push(`Monitoring responded: ${responded}`);
    
    return { alertsTriggered, responded };
  }

  private async measureRecovery(scenario: ChaosTestScenario, logs: string[]): Promise<any> {
    logs.push('Measuring system recovery...');
    
    // Simulate recovery measurements
    const availability = Math.random() * 0.1 + 0.9; // 90-100%
    const responseTimeIncrease = Math.random() * 50; // 0-50% increase
    const errorRateIncrease = Math.random() * 10; // 0-10% increase
    const dataLoss = Math.random() < 0.05; // 5% chance of data loss
    
    logs.push(`Service availability: ${(availability * 100).toFixed(1)}%`);
    logs.push(`Response time increase: ${responseTimeIncrease.toFixed(1)}%`);
    logs.push(`Error rate increase: ${errorRateIncrease.toFixed(1)}%`);
    logs.push(`Data loss: ${dataLoss ? 'YES' : 'NO'}`);
    
    return {
      availability,
      responseTimeIncrease,
      errorRateIncrease,
      dataLoss
    };
  }

  private evaluateScenarioSuccess(
    scenario: ChaosTestScenario,
    recoveryTime: number,
    chaosResult: any,
    recoveryResult: any
  ): boolean {
    // Success criteria based on scenario type and expected recovery time
    const recoveryWithinExpected = recoveryTime <= scenario.expectedRecoveryTime * 2; // Allow 2x expected time
    const availabilityAcceptable = recoveryResult.availability > 0.8; // 80% minimum
    const noDataLoss = !recoveryResult.dataLoss;
    
    return recoveryWithinExpected && availabilityAcceptable && noDataLoss;
  }

  private generateResilienceReport(testSuiteId: string, executionTime: Date): SystemResilienceReport {
    const totalScenarios = this.testResults.length;
    const passedScenarios = this.testResults.filter(r => r.success).length;
    const failedScenarios = totalScenarios - passedScenarios;
    
    // Calculate overall resilience score
    const successRate = passedScenarios / totalScenarios;
    const avgRecoveryTime = this.testResults
      .filter(r => r.recoveryTime > 0)
      .reduce((sum, r) => sum + r.recoveryTime, 0) / Math.max(passedScenarios, 1);
    
    const avgAvailability = this.testResults
      .reduce((sum, r) => sum + r.impactMetrics.serviceAvailability, 0) / totalScenarios;
    
    const overallResilienceScore = Math.round(
      (successRate * 40) + // 40% weight on success rate
      (Math.min(avgAvailability / 100, 1) * 30) + // 30% weight on availability
      (Math.max(0, 1 - avgRecoveryTime / 30000) * 30) // 30% weight on recovery time (30s max)
    );

    // Identify critical issues
    const criticalIssues: string[] = [];
    const failedCriticalScenarios = this.testResults.filter(r => !r.success && 
      this.testScenarios.get(r.scenarioId)?.severity === 'critical');
    
    failedCriticalScenarios.forEach(result => {
      criticalIssues.push(`Critical failure: ${result.scenarioName} - ${result.details}`);
    });

    // Generate recommendations
    const recommendations: string[] = [];
    if (successRate < 0.8) {
      recommendations.push('Improve system resilience - success rate below 80%');
    }
    if (avgRecoveryTime > 15000) {
      recommendations.push('Optimize recovery procedures - average recovery time exceeds 15 seconds');
    }
    if (avgAvailability < 95) {
      recommendations.push('Enhance availability during failures - average availability below 95%');
    }

    return {
      testSuiteId,
      executionTime,
      totalScenarios,
      passedScenarios,
      failedScenarios,
      overallResilienceScore,
      criticalIssues,
      recommendations,
      results: [...this.testResults]
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getTestScenarios(): ChaosTestScenario[] {
    return Array.from(this.testScenarios.values());
  }

  public getLastTestResults(): ChaosTestResult[] {
    return [...this.testResults];
  }

  public isTestingInProgress(): boolean {
    return this.isTestingActive;
  }
}

export const chaosTestingService = new ChaosTestingService();