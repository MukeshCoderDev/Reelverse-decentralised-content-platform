import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { 
  ModelCard, 
  BiasAssessment, 
  RedTeamTest, 
  PIIDetectionResult,
  GovernanceReport,
  aiGovernanceService 
} from '../services/aiGovernanceService';

interface DashboardData {
  modelOverview: {
    total: number;
    production: number;
    underReview: number;
    nonCompliant: number;
  };
  riskSummary: {
    highRiskModels: number;
    openVulnerabilities: number;
    recentPIIIncidents: number;
    overdueReviews: number;
  };
  recentActivity: {
    biasAssessments: BiasAssessment[];
    redTeamTests: RedTeamTest[];
    piiDetections: PIIDetectionResult[];
  };
}

export const AIGovernanceDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [latestReport, setLatestReport] = useState<GovernanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'testing' | 'reports'>('overview');
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await aiGovernanceService.getGovernanceDashboard();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load governance dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      setGeneratingReport(true);
      const report = await aiGovernanceService.generateGovernanceReport('monthly');
      setLatestReport(report);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setGeneratingReport(false);
    }
  };

  const getComplianceColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-400';
      case 'needs_attention': return 'text-yellow-400';
      case 'non_compliant': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-blue-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-orange-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getRiskLevelIcon = (level: string) => {
    switch (level) {
      case 'low': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🟠';
      case 'critical': return '🔴';
      default: return '⚪';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
        <span className="ml-2">Loading AI governance dashboard...</span>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center p-8 text-gray-400">
        Failed to load dashboard data
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Governance Dashboard</h1>
          <p className="text-gray-400">Model safety, bias tracking, and compliance monitoring</p>
        </div>
        <Button onClick={generateReport} disabled={generatingReport}>
          {generatingReport ? <Spinner size="sm" /> : 'Generate Report'}
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg">
        {[
          { key: 'overview', label: 'Overview', icon: '📊' },
          { key: 'models', label: 'Models', icon: '🤖' },
          { key: 'testing', label: 'Testing', icon: '🔬' },
          { key: 'reports', label: 'Reports', icon: '📋' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Model Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{dashboardData.modelOverview.total}</div>
                <div className="text-sm text-gray-400">Total Models</div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{dashboardData.modelOverview.production}</div>
                <div className="text-sm text-gray-400">In Production</div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{dashboardData.modelOverview.underReview}</div>
                <div className="text-sm text-gray-400">Under Review</div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{dashboardData.modelOverview.nonCompliant}</div>
                <div className="text-sm text-gray-400">Non-Compliant</div>
              </div>
            </Card>
          </div>

          {/* Risk Summary */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">🚨 Risk Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-400">{dashboardData.riskSummary.highRiskModels}</div>
                <div className="text-sm text-red-300">High Risk Models</div>
              </div>
              
              <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-400">{dashboardData.riskSummary.openVulnerabilities}</div>
                <div className="text-sm text-orange-300">Open Vulnerabilities</div>
              </div>
              
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-400">{dashboardData.riskSummary.recentPIIIncidents}</div>
                <div className="text-sm text-yellow-300">PII Incidents (7d)</div>
              </div>
              
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-400">{dashboardData.riskSummary.overdueReviews}</div>
                <div className="text-sm text-purple-300">Overdue Reviews</div>
              </div>
            </div>
          </Card>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Bias Assessments */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">⚖️ Recent Bias Assessments</h3>
              <div className="space-y-3">
                {dashboardData.recentActivity.biasAssessments.length > 0 ? (
                  dashboardData.recentActivity.biasAssessments.map((assessment) => (
                    <div key={assessment.id} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                      <div>
                        <div className="text-white text-sm font-medium">Model Assessment</div>
                        <div className="text-gray-400 text-xs">
                          {assessment.assessmentDate.toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{getRiskLevelIcon(assessment.riskLevel)}</span>
                        <span className={`text-sm ${getSeverityColor(assessment.riskLevel)}`}>
                          {assessment.riskLevel}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-4">No recent assessments</div>
                )}
              </div>
            </Card>

            {/* Recent Red Team Tests */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">🔴 Red Team Tests</h3>
              <div className="space-y-3">
                {dashboardData.recentActivity.redTeamTests.length > 0 ? (
                  dashboardData.recentActivity.redTeamTests.map((test) => (
                    <div key={test.id} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                      <div>
                        <div className="text-white text-sm font-medium capitalize">
                          {test.testType.replace('_', ' ')}
                        </div>
                        <div className="text-gray-400 text-xs">
                          {test.executedAt.toLocaleDateString()}
                        </div>
                      </div>
                      <div className={`text-sm ${test.passed ? 'text-green-400' : 'text-red-400'}`}>
                        {test.passed ? '✅ PASS' : '❌ FAIL'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-4">No recent tests</div>
                )}
              </div>
            </Card>

            {/* Recent PII Detections */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">🔒 PII Detections</h3>
              <div className="space-y-3">
                {dashboardData.recentActivity.piiDetections.length > 0 ? (
                  dashboardData.recentActivity.piiDetections.map((detection) => (
                    <div key={detection.id} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                      <div>
                        <div className="text-white text-sm font-medium">
                          {detection.detectedPII.length} PII entities
                        </div>
                        <div className="text-gray-400 text-xs">
                          {detection.timestamp.toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`text-sm ${detection.blocked ? 'text-red-400' : 'text-yellow-400'}`}>
                          {detection.blocked ? '🚫 Blocked' : '⚠️ Flagged'}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-4">No recent detections</div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Models Tab */}
      {activeTab === 'models' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">🤖 Model Registry</h2>
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">🚧</div>
            <p>Model registry interface coming soon</p>
            <p className="text-sm">View and manage AI model cards, versions, and compliance status</p>
          </div>
        </Card>
      )}

      {/* Testing Tab */}
      {activeTab === 'testing' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">🔬 Safety Testing</h2>
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">🧪</div>
            <p>Testing interface coming soon</p>
            <p className="text-sm">Run bias assessments, red team tests, and safety evaluations</p>
          </div>
        </Card>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {latestReport ? (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">
                  📋 {latestReport.reportType.charAt(0).toUpperCase() + latestReport.reportType.slice(1)} Governance Report
                </h2>
                <div className={`px-3 py-1 rounded text-sm font-medium ${getComplianceColor(latestReport.complianceStatus)}`}>
                  {latestReport.complianceStatus.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              {/* Report Summary */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-400">{latestReport.summary.totalModels}</div>
                  <div className="text-xs text-gray-400">Total Models</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-400">{latestReport.summary.modelsInProduction}</div>
                  <div className="text-xs text-gray-400">In Production</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-400">{latestReport.summary.biasAssessments}</div>
                  <div className="text-xs text-gray-400">Bias Tests</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-400">{latestReport.summary.redTeamTests}</div>
                  <div className="text-xs text-gray-400">Red Team Tests</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-orange-400">{latestReport.summary.vulnerabilities}</div>
                  <div className="text-xs text-gray-400">Vulnerabilities</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-400">{latestReport.summary.piiIncidents}</div>
                  <div className="text-xs text-gray-400">PII Incidents</div>
                </div>
              </div>

              {/* Findings */}
              {latestReport.findings.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-md font-semibold text-white mb-3">Key Findings</h3>
                  <div className="space-y-3">
                    {latestReport.findings.map((finding, index) => (
                      <div key={index} className="p-4 bg-gray-800 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${getSeverityColor(finding.severity)}`}>
                              {finding.severity.toUpperCase()}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className="text-sm text-gray-300 capitalize">{finding.category}</span>
                          </div>
                          {finding.dueDate && (
                            <span className="text-xs text-red-400">
                              Due: {finding.dueDate.toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="text-white mb-2">{finding.description}</div>
                        <div className="text-sm text-gray-400 mb-2">{finding.recommendation}</div>
                        {finding.affectedModels.length > 0 && (
                          <div className="text-xs text-gray-500">
                            Affected models: {finding.affectedModels.length}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {latestReport.recommendations.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-white mb-3">Recommendations</h3>
                  <ul className="space-y-2">
                    {latestReport.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-blue-400 mt-1">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-6">
              <div className="text-center py-8">
                <div className="text-4xl mb-4">📋</div>
                <h2 className="text-lg font-semibold text-white mb-2">No Reports Generated</h2>
                <p className="text-gray-400 mb-4">Generate your first governance report to see compliance status and findings</p>
                <Button onClick={generateReport} disabled={generatingReport}>
                  {generatingReport ? <Spinner size="sm" /> : 'Generate Monthly Report'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Footer */}
      <Card className="p-4 bg-blue-900/20 border-blue-500/30">
        <div className="flex items-center gap-3">
          <span className="text-blue-400 text-xl">🛡️</span>
          <div>
            <h4 className="text-blue-300 font-medium">AI Safety & Governance</h4>
            <p className="text-sm text-blue-200">
              Comprehensive monitoring and governance for responsible AI deployment. 
              Ensuring fairness, safety, and compliance across all AI systems.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};