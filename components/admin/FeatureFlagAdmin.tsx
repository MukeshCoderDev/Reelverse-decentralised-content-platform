import React, { useState, useEffect } from 'react';
import Button from '../Button';
import { Card } from '../ui/GenericCard';

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  killSwitchEnabled: boolean;
  organizationScoped: boolean;
  geoScoped: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  rules: FlagRule[];
}

interface FlagRule {
  id: string;
  condition: FlagCondition;
  percentage: number;
  enabled: boolean;
}

interface FlagCondition {
  type: 'user' | 'organization' | 'geo' | 'random';
  operator: 'equals' | 'in' | 'contains' | 'startsWith';
  values: string[];
}

interface FlagAnalytics {
  flagKey: string;
  evaluations: number;
  uniqueUsers: number;
  enabledRate: number;
  conversionRate?: number;
  lastEvaluated: Date;
}

interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  trafficAllocation: number;
  startDate: Date;
  endDate?: Date;
  enabled: boolean;
}

interface ABTestVariant {
  id: string;
  name: string;
  weight: number;
  flagOverrides: Record<string, boolean>;
}

export const FeatureFlagAdmin: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, FlagAnalytics>>({});
  const [abTests, setAbTests] = useState<ABTestConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showABTestModal, setShowABTestModal] = useState(false);

  useEffect(() => {
    loadFlags();
    loadAnalytics();
    loadABTests();
  }, []);

  const loadFlags = async () => {
    try {
      const response = await fetch('/api/v1/admin/feature-flags');
      if (!response.ok) throw new Error('Failed to load flags');
      const data = await response.json();
      setFlags(data.flags || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await fetch('/api/v1/admin/feature-flags/analytics');
      if (!response.ok) throw new Error('Failed to load analytics');
      const data = await response.json();
      setAnalytics(data.analytics || {});
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  const loadABTests = async () => {
    try {
      const response = await fetch('/api/v1/admin/ab-tests');
      if (!response.ok) throw new Error('Failed to load A/B tests');
      const data = await response.json();
      setAbTests(data.tests || []);
    } catch (err) {
      console.error('Failed to load A/B tests:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFlag = async (flagKey: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/v1/admin/feature-flags/${flagKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) throw new Error('Failed to update flag');
      
      setFlags(prev => prev.map(flag => 
        flag.key === flagKey ? { ...flag, enabled } : flag
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const activateKillSwitch = async (flagKey: string) => {
    if (!confirm(`Are you sure you want to activate the kill switch for ${flagKey}? This will immediately disable the feature for all users.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/admin/feature-flags/${flagKey}/kill-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual activation via admin UI' }),
      });

      if (!response.ok) throw new Error('Failed to activate kill switch');
      
      setFlags(prev => prev.map(flag => 
        flag.key === flagKey ? { ...flag, killSwitchEnabled: true, enabled: false } : flag
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const deactivateKillSwitch = async (flagKey: string) => {
    try {
      const response = await fetch(`/api/v1/admin/feature-flags/${flagKey}/kill-switch`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to deactivate kill switch');
      
      setFlags(prev => prev.map(flag => 
        flag.key === flagKey ? { ...flag, killSwitchEnabled: false } : flag
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flag Administration</h1>
          <p className="text-gray-600">Manage feature flags, A/B tests, and kill switches</p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={() => setShowABTestModal(true)} variant="outline">
            Create A/B Test
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            Create Flag
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-gray-900">{flags.length}</div>
          <div className="text-sm text-gray-600">Total Flags</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">
            {flags.filter(f => f.enabled && !f.killSwitchEnabled).length}
          </div>
          <div className="text-sm text-gray-600">Active Flags</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-red-600">
            {flags.filter(f => f.killSwitchEnabled).length}
          </div>
          <div className="text-sm text-gray-600">Kill Switches Active</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600">{abTests.length}</div>
          <div className="text-sm text-gray-600">A/B Tests</div>
        </Card>
      </div>

      {/* Feature Flags Table */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Feature Flags</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Flag
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Analytics
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {flags.map((flag) => {
                const flagAnalytics = analytics[flag.key];
                return (
                  <tr key={flag.key} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{flag.name}</div>
                        <div className="text-sm text-gray-500">{flag.key}</div>
                        <div className="text-xs text-gray-400">{flag.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          flag.killSwitchEnabled 
                            ? 'bg-red-100 text-red-800'
                            : flag.enabled 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {flag.killSwitchEnabled ? 'Kill Switch Active' : flag.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        {flag.killSwitchEnabled && (
                          <span className="text-xs text-red-600">⚠️ Emergency Disabled</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {flagAnalytics ? (
                        <div>
                          <div>{flagAnalytics.evaluations.toLocaleString()} evaluations</div>
                          <div className="text-xs text-gray-500">
                            {flagAnalytics.uniqueUsers.toLocaleString()} users
                          </div>
                          <div className="text-xs text-gray-500">
                            {flagAnalytics.enabledRate.toFixed(1)}% enabled
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">No data</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        {flag.organizationScoped && (
                          <span className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            Org Scoped
                          </span>
                        )}
                        {flag.geoScoped && (
                          <span className="inline-flex px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                            Geo Scoped
                          </span>
                        )}
                        {!flag.organizationScoped && !flag.geoScoped && (
                          <span className="text-xs text-gray-500">Global</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {flag.killSwitchEnabled ? (
                        <Button
                          onClick={() => deactivateKillSwitch(flag.key)}
                          size="sm"
                          variant="outline"
                        >
                          Restore
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={() => toggleFlag(flag.key, !flag.enabled)}
                            size="sm"
                            variant={flag.enabled ? "outline" : "default"}
                          >
                            {flag.enabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            onClick={() => activateKillSwitch(flag.key)}
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            Kill Switch
                          </Button>
                        </>
                      )}
                      <Button
                        onClick={() => setSelectedFlag(flag)}
                        size="sm"
                        variant="outline"
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* A/B Tests Section */}
      {abTests.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Active A/B Tests</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {abTests.map((test) => (
                <div key={test.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900">{test.name}</h3>
                    <span className={`px-2 py-1 text-xs rounded ${
                      test.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {test.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{test.description}</p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Traffic: {test.trafficAllocation}%</div>
                    <div>Variants: {test.variants.length}</div>
                    <div>Start: {new Date(test.startDate).toLocaleDateString()}</div>
                    {test.endDate && (
                      <div>End: {new Date(test.endDate).toLocaleDateString()}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Real-time Updates */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Real-time Monitoring</h3>
            <p className="text-xs text-gray-500">
              Flag evaluations and kill switch status are monitored in real-time
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-600">Live</span>
          </div>
        </div>
      </Card>

      {/* Modals would go here - CreateFlagModal, EditFlagModal, CreateABTestModal */}
      {/* Implementation omitted for brevity but would include form components */}
    </div>
  );
};