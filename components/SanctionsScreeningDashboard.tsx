/**
 * Sanctions Screening Dashboard
 * Admin interface for managing sanctions screening and compliance
 */

import React, { useState, useEffect } from 'react';
import { SanctionsScreeningService, CountryBlocklist, ComplianceAuditTrail } from '../services/sanctionsScreeningService';

interface ScreeningStats {
  totalScreenings: number;
  clearResults: number;
  flaggedResults: number;
  blockedResults: number;
  lastUpdate: Date;
  listsCount: number;
}

interface TestScreeningForm {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  email: string;
}

const SanctionsScreeningDashboard: React.FC = () => {
  const [stats, setStats] = useState<ScreeningStats | null>(null);
  const [blockedCountries, setBlockedCountries] = useState<CountryBlocklist[]>([]);
  const [auditTrail, setAuditTrail] = useState<ComplianceAuditTrail[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'countries' | 'audit' | 'test'>('overview');
  const [showAddCountry, setShowAddCountry] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const sanctionsService = SanctionsScreeningService.getInstance();

  const [countryForm, setCountryForm] = useState({
    countryCode: '',
    countryName: '',
    reason: ''
  });

  const [testForm, setTestForm] = useState<TestScreeningForm>({
    fullName: '',
    dateOfBirth: '',
    nationality: '',
    email: ''
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    setStats(sanctionsService.getScreeningStatistics());
    setBlockedCountries(sanctionsService.getBlockedCountries());
    setAuditTrail(sanctionsService.getAuditTrail(50));
  };

  const handleAddCountry = (e: React.FormEvent) => {
    e.preventDefault();
    
    sanctionsService.addCountryToBlocklist(
      countryForm.countryCode,
      countryForm.countryName,
      countryForm.reason
    );

    setCountryForm({ countryCode: '', countryName: '', reason: '' });
    setShowAddCountry(false);
    loadData();
  };

  const handleRemoveCountry = (countryCode: string) => {
    if (confirm(`Are you sure you want to unblock ${countryCode}?`)) {
      sanctionsService.removeCountryFromBlocklist(countryCode);
      loadData();
    }
  };

  const handleTestScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await sanctionsService.screenUser({
        userId: 'test-user',
        fullName: testForm.fullName,
        dateOfBirth: testForm.dateOfBirth || undefined,
        nationality: testForm.nationality || undefined,
        email: testForm.email || undefined
      });

      setTestResult(result);
    } catch (error) {
      console.error('Test screening failed:', error);
      setTestResult({ error: 'Screening failed' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'clear': return 'text-green-600 bg-green-50 border-green-200';
      case 'flagged': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'blocked': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('BLOCKED') || action.includes('FLAG')) {
      return 'text-red-600';
    }
    if (action.includes('SCREENING')) {
      return 'text-blue-600';
    }
    return 'text-gray-600';
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sanctions Screening</h1>
          <p className="text-gray-600">Monitor compliance and manage sanctions screening</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => sanctionsService.updateSanctionsList()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Update Lists
          </button>
          <button
            onClick={() => {
              const report = sanctionsService.generateComplianceReport();
              console.log('Compliance report generated:', report);
              alert('Compliance report generated. Check console for details.');
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Generate Report
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-2xl font-bold text-gray-900">{stats.totalScreenings}</div>
            <div className="text-sm text-gray-600">Total Screenings</div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-2xl font-bold text-green-600">{stats.clearResults}</div>
            <div className="text-sm text-gray-600">Clear Results</div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.flaggedResults}</div>
            <div className="text-sm text-gray-600">Flagged for Review</div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-2xl font-bold text-red-600">{stats.blockedResults}</div>
            <div className="text-sm text-gray-600">Blocked Users</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'countries', label: 'Country Blocklist' },
            { key: 'audit', label: 'Audit Trail' },
            { key: 'test', label: 'Test Screening' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Sanctions Lists</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Active Lists:</span>
                    <span className="font-medium">{stats.listsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Update:</span>
                    <span className="font-medium">{stats.lastUpdate.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Blocked Countries</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Blocked:</span>
                    <span className="font-medium">{blockedCountries.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate:</span>
                    <span className="font-medium">
                      {stats.totalScreenings > 0 
                        ? ((stats.clearResults / stats.totalScreenings) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {auditTrail.slice(0, 5).map(entry => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <span className={`font-medium ${getActionColor(entry.action)}`}>
                      {entry.action.replace(/_/g, ' ')}
                    </span>
                    {entry.userId && (
                      <span className="text-sm text-gray-500 ml-2">
                        User: {entry.userId}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {entry.timestamp.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Countries Tab */}
      {activeTab === 'countries' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Country Blocklist</h2>
            <button
              onClick={() => setShowAddCountry(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Country
            </button>
          </div>

          {showAddCountry && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Country to Blocklist</h3>
              <form onSubmit={handleAddCountry} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country Code
                    </label>
                    <input
                      type="text"
                      value={countryForm.countryCode}
                      onChange={(e) => setCountryForm(prev => ({ ...prev, countryCode: e.target.value.toUpperCase() }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="US, GB, FR..."
                      maxLength={2}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country Name
                    </label>
                    <input
                      type="text"
                      value={countryForm.countryName}
                      onChange={(e) => setCountryForm(prev => ({ ...prev, countryName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="United States"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={countryForm.reason}
                    onChange={(e) => setCountryForm(prev => ({ ...prev, reason: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Sanctions, legal restrictions, etc."
                    required
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Country
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddCountry(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Blocked Countries ({blockedCountries.length})</h3>
            </div>
            
            <div className="divide-y divide-gray-200">
              {blockedCountries.map(country => (
                <div key={country.countryCode} className="p-6 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      {country.country} ({country.countryCode})
                    </div>
                    <div className="text-sm text-gray-600">{country.reason}</div>
                    <div className="text-xs text-gray-500">
                      Added: {country.addedAt.toLocaleDateString()}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleRemoveCountry(country.countryCode)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
              
              {blockedCountries.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">🌍</div>
                  <p>No countries currently blocked</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Tab */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Audit Trail</h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {auditTrail.map(entry => (
              <div key={entry.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`font-medium ${getActionColor(entry.action)}`}>
                        {entry.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm text-gray-500">
                        {entry.timestamp.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      {entry.userId && <p><strong>User ID:</strong> {entry.userId}</p>}
                      {entry.contentId && <p><strong>Content ID:</strong> {entry.contentId}</p>}
                      <p><strong>IP Address:</strong> {entry.ipAddress}</p>
                      <p><strong>Result:</strong> {entry.result}</p>
                      {entry.data && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                            View Details
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                            {JSON.stringify(entry.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {auditTrail.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-2">📋</div>
                <p>No audit entries found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test Screening Tab */}
      {activeTab === 'test' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Sanctions Screening</h2>
            
            <form onSubmit={handleTestScreening} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={testForm.fullName}
                    onChange={(e) => setTestForm(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="John Doe"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={testForm.dateOfBirth}
                    onChange={(e) => setTestForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nationality
                  </label>
                  <input
                    type="text"
                    value={testForm.nationality}
                    onChange={(e) => setTestForm(prev => ({ ...prev, nationality: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="US, UK, etc."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={testForm.email}
                    onChange={(e) => setTestForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Run Test Screening
              </button>
            </form>
          </div>

          {testResult && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Screening Result</h3>
              
              {testResult.error ? (
                <div className="text-red-600">
                  Error: {testResult.error}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg border-2 ${getStatusColor(testResult.status)}`}>
                    <div className="font-medium text-lg">
                      Status: {testResult.status.toUpperCase()}
                    </div>
                    <div className="text-sm mt-1">
                      Risk Score: {testResult.riskScore}/100
                    </div>
                    {testResult.reviewRequired && (
                      <div className="text-sm mt-1 font-medium">
                        ⚠️ Manual review required
                      </div>
                    )}
                  </div>
                  
                  {testResult.matchedLists && testResult.matchedLists.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Matches Found:</h4>
                      <div className="space-y-2">
                        {testResult.matchedLists.map((match: any, index: number) => (
                          <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                            <div className="font-medium text-red-800">
                              {match.listName} - {match.matchType} match ({match.confidence}% confidence)
                            </div>
                            <div className="text-sm text-red-600">
                              Matched: {match.matchedFields.join(', ')}
                            </div>
                            <div className="text-sm text-red-600">
                              Entity: {match.sanctionedEntity.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500">
                    Screened at: {new Date(testResult.screenedAt).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SanctionsScreeningDashboard;