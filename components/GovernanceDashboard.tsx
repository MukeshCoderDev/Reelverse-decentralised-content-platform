import React, { useState, useEffect } from 'react';
import { modelGovernanceService, ModelCard, GovernanceReport, PIIDetectionResult } from '../services/modelGovernanceService';

export const GovernanceDashboard: React.FC = () => {
  const [report, setReport] = useState<GovernanceReport | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelCard | null>(null);
  const [piiTestContent, setPiiTestContent] = useState('');
  const [piiResult, setPiiResult] = useState<PIIDetectionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGovernanceReport();
  }, []);

  const loadGovernanceReport = async () => {
    try {
      const reportData = await modelGovernanceService.generateMonthlyGovernanceReport();
      setReport(reportData);
    } catch (error) {
      console.error('Failed to load governance report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePIITest = async () => {
    if (!piiTestContent.trim()) return;
    
    try {
      const result = await modelGovernanceService.detectPII(piiTestContent);
      setPiiResult(result);
    } catch (error) {
      console.error('Failed to test PII detection:', error);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-green-600 bg-green-100';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load governance report</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold">AI Model Governance Dashboard</h1>
        <p className="text-muted-foreground">
          Monthly report for {report.reportPeriod.start.toLocaleDateString()} - {report.reportPeriod.end.toLocaleDateString()}
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-muted-foreground">Total Models</h3>
          <p className="text-2xl font-bold">{report.summary.totalModels}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-muted-foreground">Overall Bias Score</h3>
          <p className={`text-2xl font-bold ${getScoreColor(1 - report.summary.overallBiasScore)}`}>
            {((1 - report.summary.overallBiasScore) * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-muted-foreground">Safety Score</h3>
          <p className={`text-2xl font-bold ${getScoreColor(report.summary.overallSafetyScore)}`}>
            {(report.summary.overallSafetyScore * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-muted-foreground">Compliance Rate</h3>
          <p className={`text-2xl font-bold ${getScoreColor(report.summary.complianceRate)}`}>
            {(report.summary.complianceRate * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Model Performance Table */}
      <div className="bg-card p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Model Performance Overview</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Model</th>
                <th className="text-left py-2">Version</th>
                <th className="text-left py-2">Bias Score</th>
                <th className="text-left py-2">Safety Score</th>
                <th className="text-left py-2">Performance</th>
                <th className="text-left py-2">Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {report.modelPerformance.map((model, index) => (
                <tr key={index} className="border-b hover:bg-muted/50">
                  <td className="py-2 font-medium">{model.modelName}</td>
                  <td className="py-2">{model.version}</td>
                  <td className={`py-2 ${getScoreColor(1 - model.biasScore)}`}>
                    {((1 - model.biasScore) * 100).toFixed(1)}%
                  </td>
                  <td className={`py-2 ${getScoreColor(model.safetyScore)}`}>
                    {(model.safetyScore * 100).toFixed(1)}%
                  </td>
                  <td className={`py-2 ${getScoreColor(model.performanceScore)}`}>
                    {(model.performanceScore * 100).toFixed(1)}%
                  </td>
                  <td className="py-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(model.riskLevel)}`}>
                      {model.riskLevel.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PII Detection Testing */}
      <div className="bg-card p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">PII Detection Testing</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Test Content</label>
            <textarea
              value={piiTestContent}
              onChange={(e) => setPiiTestContent(e.target.value)}
              placeholder="Enter content to test for PII detection..."
              className="w-full p-3 border rounded-lg bg-background"
              rows={4}
            />
          </div>
          <button
            onClick={handlePIITest}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Test PII Detection
          </button>
          
          {piiResult && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h3 className="font-medium mb-2">Detection Results</h3>
              <div className="space-y-2">
                <p>
                  <span className="font-medium">PII Detected:</span>{' '}
                  <span className={piiResult.hasPII ? 'text-red-600' : 'text-green-600'}>
                    {piiResult.hasPII ? 'Yes' : 'No'}
                  </span>
                </p>
                {piiResult.hasPII && (
                  <>
                    <p>
                      <span className="font-medium">Types Found:</span> {piiResult.piiTypes.join(', ')}
                    </p>
                    <p>
                      <span className="font-medium">Confidence:</span> {(piiResult.confidence * 100).toFixed(1)}%
                    </p>
                    <p>
                      <span className="font-medium">Locations:</span> {piiResult.locations.length} found
                    </p>
                    {piiResult.sanitizedContent && (
                      <div>
                        <p className="font-medium">Sanitized Content:</p>
                        <div className="p-2 bg-background rounded border text-sm">
                          {piiResult.sanitizedContent}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audit Summary */}
      <div className="bg-card p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Audit Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{report.auditSummary.totalAudits}</p>
            <p className="text-sm text-muted-foreground">Total Audits</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{report.auditSummary.criticalFindings}</p>
            <p className="text-sm text-muted-foreground">Critical Findings</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">{report.auditSummary.openFindings}</p>
            <p className="text-sm text-muted-foreground">Open Findings</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm">
            <span className="font-medium">Compliance Status:</span>{' '}
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              report.auditSummary.complianceStatus === 'compliant' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {report.auditSummary.complianceStatus.replace('_', ' ').toUpperCase()}
            </span>
          </p>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-card p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Recommendations</h2>
        <div className="space-y-2">
          {report.recommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm">{recommendation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-card p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Action Items</h2>
        <div className="space-y-3">
          {report.actionItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  item.priority === 'critical' ? 'bg-red-500' :
                  item.priority === 'high' ? 'bg-orange-500' :
                  item.priority === 'medium' ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}></div>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{item.assignee}</p>
                <p className="text-xs text-muted-foreground">
                  Due: {item.dueDate.toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next Review */}
      <div className="bg-card p-4 rounded-lg border text-center">
        <p className="text-sm text-muted-foreground">
          Next governance review scheduled for: {report.nextReviewDate.toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};