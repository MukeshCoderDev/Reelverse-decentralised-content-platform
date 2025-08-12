import React, { useState, useEffect } from 'react';
import { ProductionOrchestrator, HealthCheckResult, PerformanceMetrics, DeploymentStatus, ProductionReadinessReport } from '../../services/integration/ProductionOrchestrator';

interface ProductionDashboardProps {
  orchestrator: ProductionOrchestrator;
}

export const ProductionDashboard: React.FC<ProductionDashboardProps> = ({ orchestrator }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'health' | 'performance' | 'deployment' | 'readiness'>('overview');
  const [healthStatus, setHealthStatus] = useState<Map<string, HealthCheckResult>>(new Map());
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null);
  const [readinessReport, setReadinessReport] = useState<ProductionReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    setupEventListeners();

    return () => {
      orchestrator.removeAllListeners();
    };
  }, [orchestrator]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [health, performance, deployment, readiness] = await Promise.all([
        orchestrator.getHealthStatus(),
        orchestrator.getPerformanceMetrics(),
        orchestrator.getDeploymentStatus(),
        orchestrator.getProductionReadinessReport()
      ]);

      setHealthStatus(health);
      setPerformanceMetrics(performance);
      setDeploymentStatus(deployment);
      setReadinessReport(readiness);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupEventListeners = () => {
    orchestrator.on('healthChecksCompleted', (results) => {
      setHealthStatus(results);
    });

    orchestrator.on('performanceMetricsCollected', (metrics) => {
      setPerformanceMetrics(metrics);
    });

    orchestrator.on('deploymentStatusChanged', (status) => {
      setDeploymentStatus(status);
    });

    orchestrator.on('deploymentCompleted', (deployment) => {
      setDeploymentStatus(deployment);
      loadDashboardData(); // Refresh all data
    });
  };

  const handleDeploy = async () => {
    try {
      await orchestrator.deployToProduction('v1.0.0', {
        runTests: true,
        checkAccessibility: true,
        checkPerformance: true,
        enableRollback: true
      });
    } catch (error) {
      console.error('Deployment failed:', error);
    }
  };

  const handleRollback = async () => {
    if (deploymentStatus?.id) {
      try {
        await orchestrator.rollbackDeployment(deploymentStatus.id);
      } catch (error) {
        console.error('Rollback failed:', error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'deployed':
      case 'passed': return 'text-green-600';
      case 'degraded':
      case 'deploying': return 'text-yellow-600';
      case 'unhealthy':
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'deployed':
      case 'passed': return '✅';
      case 'degraded':
      case 'deploying': return '⚠️';
      case 'unhealthy':
      case 'failed': return '❌';
      default: return '⏳';
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Production Dashboard</h1>
        <p className="text-gray-600">Monitor system health, performance, and deployments</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'health', label: 'Health', icon: '💚' },
            { id: 'performance', label: 'Performance', icon: '⚡' },
            { id: 'deployment', label: 'Deployment', icon: '🚀' },
            { id: 'readiness', label: 'Readiness', icon: '✅' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* System Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">System Health</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Array.from(healthStatus.values()).every(h => h.status === 'healthy') ? 'Healthy' : 'Issues'}
                  </p>
                </div>
                <div className="text-2xl">
                  {Array.from(healthStatus.values()).every(h => h.status === 'healthy') ? '💚' : '⚠️'}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Core Web Vitals</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {performanceMetrics && 
                     performanceMetrics.coreWebVitals.lcp <= 2500 &&
                     performanceMetrics.coreWebVitals.fid <= 100 &&
                     performanceMetrics.coreWebVitals.cls <= 0.1 ? 'Good' : 'Needs Work'}
                  </p>
                </div>
                <div className="text-2xl">⚡</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Deployment</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {deploymentStatus?.status || 'None'}
                  </p>
                </div>
                <div className="text-2xl">🚀</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Readiness Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {readinessReport?.score.toFixed(0)}%
                  </p>
                </div>
                <div className="text-2xl">📈</div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="flex space-x-4">
              <button
                onClick={handleDeploy}
                disabled={deploymentStatus?.status === 'deploying'}
                className={`px-6 py-2 rounded-lg font-medium ${
                  deploymentStatus?.status === 'deploying'
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {deploymentStatus?.status === 'deploying' ? 'Deploying...' : 'Deploy to Production'}
              </button>

              {deploymentStatus?.rollbackPlan?.enabled && (
                <button
                  onClick={handleRollback}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Rollback
                </button>
              )}

              <button
                onClick={loadDashboardData}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Refresh Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Health Tab */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Health Status</h3>
            <div className="space-y-4">
              {Array.from(healthStatus.entries()).map(([service, result]) => (
                <div key={service} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getStatusIcon(result.status)}</span>
                    <div>
                      <h4 className="font-medium text-gray-900 capitalize">{service}</h4>
                      <p className="text-sm text-gray-600">
                        Response time: {result.responseTime}ms
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`font-medium ${getStatusColor(result.status)}`}>
                      {result.status}
                    </span>
                    <p className="text-xs text-gray-500">
                      {result.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && performanceMetrics && (
        <div className="space-y-6">
          {/* Core Web Vitals */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Core Web Vitals</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {(performanceMetrics.coreWebVitals.lcp / 1000).toFixed(1)}s
                </div>
                <div className="text-sm text-gray-600">LCP (Largest Contentful Paint)</div>
                <div className={`text-xs mt-1 ${
                  performanceMetrics.coreWebVitals.lcp <= 2500 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Target: ≤ 2.5s
                </div>
              </div>

              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {performanceMetrics.coreWebVitals.fid.toFixed(0)}ms
                </div>
                <div className="text-sm text-gray-600">FID (First Input Delay)</div>
                <div className={`text-xs mt-1 ${
                  performanceMetrics.coreWebVitals.fid <= 100 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Target: ≤ 100ms
                </div>
              </div>

              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {performanceMetrics.coreWebVitals.cls.toFixed(3)}
                </div>
                <div className="text-sm text-gray-600">CLS (Cumulative Layout Shift)</div>
                <div className={`text-xs mt-1 ${
                  performanceMetrics.coreWebVitals.cls <= 0.1 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Target: ≤ 0.1
                </div>
              </div>
            </div>
          </div>

          {/* Resource Metrics */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-600">Memory Usage</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatBytes(performanceMetrics.resourceMetrics.memoryUsage * 1024 * 1024)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">CPU Usage</p>
                <p className="text-2xl font-bold text-gray-900">
                  {performanceMetrics.resourceMetrics.cpuUsage.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Network Latency</p>
                <p className="text-2xl font-bold text-gray-900">
                  {performanceMetrics.resourceMetrics.networkLatency.toFixed(0)}ms
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Bundle Size</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatBytes(performanceMetrics.resourceMetrics.bundleSize * 1024)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Tab */}
      {activeTab === 'deployment' && (
        <div className="space-y-6">
          {deploymentStatus ? (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Deployment</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Version {deploymentStatus.version}</h4>
                    <p className="text-sm text-gray-600">
                      Environment: {deploymentStatus.environment}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    deploymentStatus.status === 'deployed' ? 'bg-green-100 text-green-800' :
                    deploymentStatus.status === 'deploying' ? 'bg-yellow-100 text-yellow-800' :
                    deploymentStatus.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {deploymentStatus.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className={`text-lg ${getStatusColor(deploymentStatus.checks.tests ? 'passed' : 'failed')}`}>
                      {getStatusIcon(deploymentStatus.checks.tests ? 'passed' : 'failed')}
                    </div>
                    <div className="text-sm text-gray-600">Tests</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg ${getStatusColor(deploymentStatus.checks.accessibility ? 'passed' : 'failed')}`}>
                      {getStatusIcon(deploymentStatus.checks.accessibility ? 'passed' : 'failed')}
                    </div>
                    <div className="text-sm text-gray-600">Accessibility</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg ${getStatusColor(deploymentStatus.checks.performance ? 'passed' : 'failed')}`}>
                      {getStatusIcon(deploymentStatus.checks.performance ? 'passed' : 'failed')}
                    </div>
                    <div className="text-sm text-gray-600">Performance</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg ${getStatusColor(deploymentStatus.checks.security ? 'passed' : 'failed')}`}>
                      {getStatusIcon(deploymentStatus.checks.security ? 'passed' : 'failed')}
                    </div>
                    <div className="text-sm text-gray-600">Security</div>
                  </div>
                </div>

                {deploymentStatus.duration && (
                  <div className="text-sm text-gray-600">
                    Duration: {(deploymentStatus.duration / 1000).toFixed(1)}s
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">No Active Deployment</h3>
              <p className="text-gray-600">No deployment is currently in progress.</p>
            </div>
          )}
        </div>
      )}

      {/* Readiness Tab */}
      {activeTab === 'readiness' && readinessReport && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Readiness</h3>
            
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Overall Score</span>
                <span className="text-sm font-medium text-gray-900">{readinessReport.score.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    readinessReport.score >= 90 ? 'bg-green-500' :
                    readinessReport.score >= 70 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${readinessReport.score}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className={`text-2xl ${getStatusColor(readinessReport.checks.health ? 'passed' : 'failed')}`}>
                  {getStatusIcon(readinessReport.checks.health ? 'passed' : 'failed')}
                </div>
                <div className="text-sm text-gray-600">Health Checks</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl ${getStatusColor(readinessReport.checks.tests ? 'passed' : 'failed')}`}>
                  {getStatusIcon(readinessReport.checks.tests ? 'passed' : 'failed')}
                </div>
                <div className="text-sm text-gray-600">Tests</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl ${getStatusColor(readinessReport.checks.performance ? 'passed' : 'failed')}`}>
                  {getStatusIcon(readinessReport.checks.performance ? 'passed' : 'failed')}
                </div>
                <div className="text-sm text-gray-600">Performance</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl ${getStatusColor(readinessReport.checks.accessibility ? 'passed' : 'failed')}`}>
                  {getStatusIcon(readinessReport.checks.accessibility ? 'passed' : 'failed')}
                </div>
                <div className="text-sm text-gray-600">Accessibility</div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Recommendations</h4>
              <ul className="space-y-2">
                {readinessReport.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span className="text-sm text-gray-600">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};