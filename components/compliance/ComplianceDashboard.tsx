import React, { useState, useEffect } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { ComplianceService, ComplianceRecord, ComplianceViolation, GeoRestriction } from '../../services/complianceService';

interface ComplianceDashboardProps {
  organizationId?: string;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({
  organizationId
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'violations' | 'geo' | 'audit'>('overview');
  const [complianceRecords, setComplianceRecords] = useState<ComplianceRecord[]>([]);
  const [violations, setViolations] = useState<ComplianceViolation[]>([]);
  const [geoRestrictions, setGeoRestrictions] = useState<GeoRestriction[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const complianceService = ComplianceService.getInstance();

  useEffect(() => {
    loadComplianceData();
  }, [organizationId]);

  const loadComplianceData = async () => {
    try {
      setIsLoading(true);
      const [records, violationsList, restrictions, status] = await Promise.all([
        complianceService.getComplianceRecords(organizationId),
        complianceService.getViolations(organizationId),
        complianceService.getGeoRestrictions(organizationId),
        complianceService.checkComplianceStatus(organizationId)
      ]);

      setComplianceRecords(records);
      setViolations(violationsList);
      setGeoRestrictions(restrictions);
      setComplianceStatus(status);
    } catch (error) {
      console.error('Error loading compliance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async (type: string) => {
    try {
      const dateRange = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      };
      
      const report = await complianceService.generateReport(type as any, dateRange, organizationId);
      alert(`Report generation started. Report ID: ${report.id}`);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'text-green-400 bg-green-500/20';
      case 'warning':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'violation':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 bg-red-500/20';
      case 'high':
        return 'text-orange-400 bg-orange-500/20';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'low':
        return 'text-blue-400 bg-blue-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderOverview = () => (
    <div className=\"space-y-6\">
      {/* Compliance Status */}
      {complianceStatus && (
        <Card className=\"p-6\">
          <div className=\"flex items-center justify-between mb-4\">
            <h2 className=\"text-xl font-semibold text-white\">Compliance Status</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(complianceStatus.overallStatus)}`}>
              {complianceStatus.overallStatus.toUpperCase()}
            </span>
          </div>
          
          <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4 mb-6\">
            <div>
              <p className=\"text-gray-400 text-sm\">Last Audit</p>
              <p className=\"text-white font-medium\">{formatDate(complianceStatus.lastAudit)}</p>
            </div>
            <div>
              <p className=\"text-gray-400 text-sm\">Next Audit</p>
              <p className=\"text-white font-medium\">{formatDate(complianceStatus.nextAudit)}</p>
            </div>
          </div>

          {complianceStatus.issues.length > 0 && (
            <div>
              <h3 className=\"text-lg font-semibold text-white mb-3\">Active Issues</h3>
              <div className=\"space-y-2\">
                {complianceStatus.issues.map((issue: any, index: number) => (
                  <div key={index} className=\"flex items-center justify-between p-3 bg-gray-800/50 rounded-lg\">
                    <div className=\"flex items-center space-x-3\">
                      <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(issue.severity)}`}>
                        {issue.severity}
                      </span>
                      <div>
                        <p className=\"text-white font-medium\">{issue.description}</p>
                        <p className=\"text-gray-400 text-sm\">{issue.count} items affected</p>
                      </div>
                    </div>
                    <Button variant=\"secondary\" size=\"sm\">
                      Resolve
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Quick Stats */}
      <div className=\"grid grid-cols-1 md:grid-cols-4 gap-4\">
        <Card className=\"p-4\">
          <div className=\"flex items-center\">
            <div className=\"w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mr-3\">
              <Icon name=\"file-text\" className=\"w-5 h-5 text-blue-400\" />
            </div>
            <div>
              <div className=\"text-2xl font-bold text-white\">{complianceRecords.length}</div>
              <div className=\"text-gray-400 text-sm\">2257 Records</div>
            </div>
          </div>
        </Card>

        <Card className=\"p-4\">
          <div className=\"flex items-center\">
            <div className=\"w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mr-3\">
              <Icon name=\"check\" className=\"w-5 h-5 text-green-400\" />
            </div>
            <div>
              <div className=\"text-2xl font-bold text-white\">
                {complianceRecords.filter(r => r.status === 'verified').length}
              </div>
              <div className=\"text-gray-400 text-sm\">Verified</div>
            </div>
          </div>
        </Card>

        <Card className=\"p-4\">
          <div className=\"flex items-center\">
            <div className=\"w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center mr-3\">
              <Icon name=\"alert-triangle\" className=\"w-5 h-5 text-red-400\" />
            </div>
            <div>
              <div className=\"text-2xl font-bold text-white\">
                {violations.filter(v => v.status === 'open').length}
              </div>
              <div className=\"text-gray-400 text-sm\">Open Violations</div>
            </div>
          </div>
        </Card>

        <Card className=\"p-4\">
          <div className=\"flex items-center\">
            <div className=\"w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mr-3\">
              <Icon name=\"globe\" className=\"w-5 h-5 text-purple-400\" />
            </div>
            <div>
              <div className=\"text-2xl font-bold text-white\">{geoRestrictions.length}</div>
              <div className=\"text-gray-400 text-sm\">Geo Rules</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className=\"p-6\">
        <h2 className=\"text-xl font-semibold text-white mb-4\">Quick Actions</h2>
        <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">
          <Button onClick={() => handleGenerateReport('2257_report')}>
            <Icon name=\"file-text\" className=\"w-4 h-4 mr-2\" />
            Generate 2257 Report
          </Button>
          <Button onClick={() => handleGenerateReport('audit_trail')}>
            <Icon name=\"list\" className=\"w-4 h-4 mr-2\" />
            Export Audit Trail
          </Button>
          <Button onClick={() => handleGenerateReport('violation_summary')}>
            <Icon name=\"alert-triangle\" className=\"w-4 h-4 mr-2\" />
            Violation Summary
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderRecords = () => (
    <div className=\"space-y-6\">
      <div className=\"flex items-center justify-between\">
        <h2 className=\"text-xl font-semibold text-white\">2257 Records</h2>
        <Button>
          <Icon name=\"plus\" className=\"w-4 h-4 mr-2\" />
          Add Record
        </Button>
      </div>

      <Card className=\"p-6\">
        <div className=\"space-y-4\">
          {complianceRecords.map((record) => (
            <div key={record.id} className=\"flex items-center justify-between p-4 bg-gray-800/50 rounded-lg\">
              <div className=\"flex items-center space-x-4\">
                <div className=\"w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center\">
                  <Icon name=\"user\" className=\"w-5 h-5 text-blue-400\" />
                </div>
                <div>
                  <h3 className=\"font-semibold text-white\">{record.performerName}</h3>
                  <p className=\"text-gray-400 text-sm\">
                    Age: {record.ageAtRecording} • Recorded: {formatDate(record.recordingDate)}
                  </p>
                  <p className=\"text-gray-400 text-sm\">
                    Verification: {record.verificationMethod.replace('_', ' ')} • {record.documentId}
                  </p>
                </div>
              </div>
              <div className=\"flex items-center space-x-3\">
                <span className={`px-2 py-1 rounded text-xs ${
                  record.status === 'verified' ? 'bg-green-500/20 text-green-400' :
                  record.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {record.status}
                </span>
                <Button variant=\"secondary\" size=\"sm\">
                  <Icon name=\"eye\" className=\"w-4 h-4 mr-2\" />
                  View
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderViolations = () => (
    <div className=\"space-y-6\">
      <div className=\"flex items-center justify-between\">
        <h2 className=\"text-xl font-semibold text-white\">Compliance Violations</h2>
        <Button>
          <Icon name=\"plus\" className=\"w-4 h-4 mr-2\" />
          Report Violation
        </Button>
      </div>

      <Card className=\"p-6\">
        <div className=\"space-y-4\">
          {violations.map((violation) => (
            <div key={violation.id} className=\"p-4 bg-gray-800/50 rounded-lg\">
              <div className=\"flex items-start justify-between mb-3\">
                <div className=\"flex items-center space-x-3\">
                  <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(violation.severity)}`}>
                    {violation.severity}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    violation.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                    violation.status === 'investigating' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {violation.status}
                  </span>
                </div>
                <p className=\"text-gray-400 text-sm\">{formatDate(violation.detectedAt)}</p>
              </div>
              
              <h3 className=\"font-semibold text-white mb-2\">{violation.type.replace('_', ' ').toUpperCase()}</h3>
              <p className=\"text-gray-300 mb-3\">{violation.description}</p>
              
              {violation.actions.length > 0 && (
                <div className=\"mb-3\">
                  <p className=\"text-gray-400 text-sm mb-2\">Actions Taken:</p>
                  <div className=\"space-y-1\">
                    {violation.actions.map((action) => (
                      <div key={action.id} className=\"text-sm text-gray-300\">
                        • {action.description} ({formatDate(action.executedAt)})
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className=\"flex space-x-2\">
                <Button variant=\"secondary\" size=\"sm\">
                  <Icon name=\"eye\" className=\"w-4 h-4 mr-2\" />
                  View Details
                </Button>
                {violation.status === 'open' && (
                  <Button size=\"sm\">
                    <Icon name=\"play\" className=\"w-4 h-4 mr-2\" />
                    Take Action
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderGeoRestrictions = () => (
    <div className=\"space-y-6\">
      <div className=\"flex items-center justify-between\">
        <h2 className=\"text-xl font-semibold text-white\">Geographic Restrictions</h2>
        <Button>
          <Icon name=\"plus\" className=\"w-4 h-4 mr-2\" />
          Add Restriction
        </Button>
      </div>

      <Card className=\"p-6\">
        <div className=\"space-y-4\">
          {geoRestrictions.map((restriction) => (
            <div key={restriction.id} className=\"flex items-center justify-between p-4 bg-gray-800/50 rounded-lg\">
              <div className=\"flex items-center space-x-4\">
                <div className=\"w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center\">
                  <Icon name=\"globe\" className=\"w-5 h-5 text-purple-400\" />
                </div>
                <div>
                  <h3 className=\"font-semibold text-white\">
                    {restriction.contentId ? `Content-Specific` : 'Global Restriction'}
                  </h3>
                  <p className=\"text-gray-400 text-sm\">
                    Countries: {restriction.restrictedCountries.join(', ') || 'None'}
                  </p>
                  <p className=\"text-gray-400 text-sm\">
                    Regions: {restriction.restrictedRegions.join(', ') || 'None'}
                  </p>
                  <div className=\"flex items-center space-x-4 mt-1\">
                    <span className=\"text-gray-400 text-sm\">
                      Reason: {restriction.reason.replace('_', ' ')}
                    </span>
                    {restriction.enableMosaic && (
                      <span className=\"px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded\">
                        Mosaic Enabled
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className=\"flex space-x-2\">
                <Button variant=\"secondary\" size=\"sm\">
                  <Icon name=\"edit\" className=\"w-4 h-4 mr-2\" />
                  Edit
                </Button>
                <Button variant=\"secondary\" size=\"sm\">
                  <Icon name=\"trash-2\" className=\"w-4 h-4 mr-2\" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  if (isLoading) {
    return (
      <div className=\"text-center py-8\">
        <div className=\"animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4\"></div>
        <p className=\"text-gray-400\">Loading compliance data...</p>
      </div>
    );
  }

  return (
    <div className=\"space-y-6\">
      {/* Header */}
      <div className=\"flex items-center justify-between\">
        <div>
          <h1 className=\"text-2xl font-bold text-white\">Compliance Center</h1>
          <p className=\"text-gray-400 mt-1\">
            Manage 2257 records, violations, and legal compliance
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className=\"border-b border-gray-700\">
        <nav className=\"flex space-x-8\">
          {[
            { id: 'overview', label: 'Overview', icon: 'home' },
            { id: 'records', label: '2257 Records', icon: 'file-text' },
            { id: 'violations', label: 'Violations', icon: 'alert-triangle' },
            { id: 'geo', label: 'Geo Restrictions', icon: 'globe' },
            { id: 'audit', label: 'Audit Trail', icon: 'list' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Icon name={tab.icon as any} className=\"w-4 h-4\" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'records' && renderRecords()}
      {activeTab === 'violations' && renderViolations()}
      {activeTab === 'geo' && renderGeoRestrictions()}
      {activeTab === 'audit' && (
        <div className=\"text-center py-8\">
          <Icon name=\"list\" className=\"w-12 h-12 text-gray-600 mx-auto mb-4\" />
          <p className=\"text-gray-400\">Audit trail functionality coming soon</p>
        </div>
      )}
    </div>
  );
};