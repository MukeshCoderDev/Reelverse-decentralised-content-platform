import React, { useState, useEffect } from 'react';
import { 
  aiTransparencyService, 
  AIFeature, 
  UserAIPreferences, 
  AIUsageRecord, 
  AIDisclosure,
  AITransparencyReport 
} from '../services/aiTransparencyService';

interface AITransparencyDashboardProps {
  userId: string;
}

export const AITransparencyDashboard: React.FC<AITransparencyDashboardProps> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'usage' | 'disclosures' | 'settings'>('overview');
  const [aiFeatures, setAiFeatures] = useState<AIFeature[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserAIPreferences | null>(null);
  const [usageRecords, setUsageRecords] = useState<AIUsageRecord[]>([]);
  const [disclosures, setDisclosures] = useState<AIDisclosure[]>([]);
  const [transparencyReport, setTransparencyReport] = useState<AITransparencyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAIData();
  }, [userId]);

  const loadAIData = async () => {
    try {
      setLoading(true);
      
      const [features, preferences, usage, userDisclosures, report] = await Promise.all([
        Promise.resolve(aiTransparencyService.getAIFeatures()),
        aiTransparencyService.getUserAIPreferences(userId),
        aiTransparencyService.getUserAIUsage(userId, 50),
        aiTransparencyService.getUserAIDisclosures(userId, 25),
        aiTransparencyService.generateTransparencyReport(userId)
      ]);

      setAiFeatures(features);
      setUserPreferences(preferences);
      setUsageRecords(usage);
      setDisclosures(userDisclosures);
      setTransparencyReport(report);
    } catch (error) {
      console.error('Failed to load AI data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFeatureToggle = async (featureId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await aiTransparencyService.optInToAIFeature(userId, featureId);
      } else {
        const reason = prompt('Please provide a reason for opting out (optional):');
        await aiTransparencyService.optOutOfAIFeature(userId, featureId, reason || undefined);
      }
      
      // Reload preferences
      const updatedPreferences = await aiTransparencyService.getUserAIPreferences(userId);
      setUserPreferences(updatedPreferences);
    } catch (error) {
      console.error('Failed to toggle feature:', error);
      alert('Failed to update preference. Please try again.');
    }
  };

  const handleGlobalOptOut = async (optOut: boolean) => {
    try {
      await aiTransparencyService.updateUserAIPreferences(userId, {
        globalOptOut: optOut
      });
      
      const updatedPreferences = await aiTransparencyService.getUserAIPreferences(userId);
      setUserPreferences(updatedPreferences);
    } catch (error) {
      console.error('Failed to update global opt-out:', error);
      alert('Failed to update preference. Please try again.');
    }
  };

  const handleTransparencyLevelChange = async (level: UserAIPreferences['transparencyLevel']) => {
    try {
      await aiTransparencyService.updateUserAIPreferences(userId, {
        transparencyLevel: level
      });
      
      const updatedPreferences = await aiTransparencyService.getUserAIPreferences(userId);
      setUserPreferences(updatedPreferences);
    } catch (error) {
      console.error('Failed to update transparency level:', error);
      alert('Failed to update preference. Please try again.');
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getCategoryIcon = (category: AIFeature['category']) => {
    const icons = {
      content_generation: '✨',
      content_analysis: '🔍',
      recommendation: '🎯',
      moderation: '🛡️',
      pricing: '💰',
      tagging: '🏷️'
    };
    return icons[category] || '🤖';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading AI transparency data...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">AI Transparency & Control</h1>
        <p className="text-gray-600">Understand and control how AI is used with your content and data.</p>
      </div>

      {/* Global AI Status */}
      {userPreferences?.globalOptOut && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <span className="text-yellow-400 text-xl mr-3">⚠️</span>
            <div>
              <h3 className="font-medium text-yellow-800">AI Features Disabled</h3>
              <p className="text-sm text-yellow-700">You have opted out of all AI features. You can re-enable them in settings.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', count: null },
            { id: 'features', label: 'AI Features', count: aiFeatures.length },
            { id: 'usage', label: 'Usage History', count: usageRecords.length },
            { id: 'disclosures', label: 'AI Disclosures', count: disclosures.length },
            { id: 'settings', label: 'Settings', count: null }
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
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && transparencyReport && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-2xl">🤖</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total AI Usage</p>
                  <p className="text-2xl font-bold text-gray-900">{transparencyReport.summary.totalAIUsage}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <span className="text-2xl">✨</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Content Generated</p>
                  <p className="text-2xl font-bold text-gray-900">{transparencyReport.summary.contentGenerated}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <span className="text-2xl">🎯</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Recommendations</p>
                  <p className="text-2xl font-bold text-gray-900">{transparencyReport.summary.recommendationsMade}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <span className="text-2xl">🔍</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Content Analyzed</p>
                  <p className="text-2xl font-bold text-gray-900">{transparencyReport.summary.contentAnalyzed}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ethics Metrics */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Ethics & Transparency Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {Math.round(transparencyReport.ethicsMetrics.transparencyScore * 100)}%
                </div>
                <div className="text-sm text-gray-600">Transparency Score</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {Math.round(transparencyReport.ethicsMetrics.userControlScore * 100)}%
                </div>
                <div className="text-sm text-gray-600">User Control Score</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-1">
                  {Math.round(transparencyReport.ethicsMetrics.fairnessScore * 100)}%
                </div>
                <div className="text-sm text-gray-600">Fairness Score</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {transparencyReport.ethicsMetrics.biasDetectionRuns}
                </div>
                <div className="text-sm text-gray-600">Bias Checks</div>
              </div>
            </div>
          </div>

          {/* Feature Usage Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Feature Usage</h3>
            <div className="space-y-4">
              {Array.from(transparencyReport.featureBreakdown.entries()).map(([featureId, stats]) => {
                const feature = aiFeatures.find(f => f.id === featureId);
                if (!feature) return null;

                return (
                  <div key={featureId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{getCategoryIcon(feature.category)}</span>
                      <div>
                        <h4 className="font-medium text-gray-900">{feature.name}</h4>
                        <p className="text-sm text-gray-500">{stats.usageCount} uses</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">
                        Avg. Confidence: {Math.round(stats.averageConfidence * 100)}%
                      </div>
                      <div className="text-sm text-gray-600">
                        Success Rate: {Math.round(stats.successRate * 100)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Features Tab */}
      {activeTab === 'features' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <span className="text-blue-400 text-xl mr-3">ℹ️</span>
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">About AI Features</p>
                <p>These AI features help improve your experience on the platform. You can control which features are enabled for your account and opt out at any time.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            {aiFeatures.map((feature) => {
              const isEnabled = userPreferences?.featurePreferences.get(feature.id)?.enabled !== false;
              const isGloballyDisabled = userPreferences?.globalOptOut;

              return (
                <div key={feature.id} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <span className="text-3xl mr-4">{getCategoryIcon(feature.category)}</span>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.name}</h3>
                        <p className="text-gray-600 mb-3">{feature.description}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Purpose:</span>
                            <p className="text-gray-600">{feature.purpose}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Data Used:</span>
                            <p className="text-gray-600">{feature.dataUsed.join(', ')}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Output:</span>
                            <p className="text-gray-600">{feature.outputType}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Accuracy:</span>
                            <p className="text-gray-600">
                              {feature.accuracy ? `${Math.round(feature.accuracy * 100)}%` : 'N/A'}
                            </p>
                          </div>
                        </div>

                        {feature.modelVersion && (
                          <div className="mt-3 text-xs text-gray-500">
                            Model Version: {feature.modelVersion} • Last Updated: {formatDate(feature.lastUpdated)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isEnabled && !isGloballyDisabled}
                          disabled={isGloballyDisabled}
                          onChange={(e) => handleFeatureToggle(feature.id, e.target.checked)}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                        />
                        <span className="text-sm text-gray-700">
                          {isGloballyDisabled ? 'Disabled (Global Opt-out)' : isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Usage History Tab */}
      {activeTab === 'usage' && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">AI Usage History</h3>
            <p className="text-sm text-gray-600">Recent AI interactions with your content and data</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Feature
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Content
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Processing Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usageRecords.map((record) => {
                  const feature = aiFeatures.find(f => f.id === record.featureId);
                  return (
                    <tr key={record.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">{getCategoryIcon(feature?.category || 'content_analysis')}</span>
                          <span className="font-medium text-gray-900">{feature?.name || record.featureId}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.contentId || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {record.confidence ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(record.confidence)}`}>
                            {Math.round(record.confidence * 100)}%
                          </span>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.processingTime}ms
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(record.timestamp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Disclosures Tab */}
      {activeTab === 'disclosures' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <span className="text-green-400 text-xl mr-3">✅</span>
              <div className="text-sm text-green-700">
                <p className="font-medium mb-1">AI Transparency Disclosures</p>
                <p>When AI is used to generate, modify, or analyze your content, we provide clear disclosures about what happened and how it affects you.</p>
              </div>
            </div>
          </div>

          {disclosures.map((disclosure) => {
            const feature = aiFeatures.find(f => f.id === disclosure.featureId);
            return (
              <div key={disclosure.id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">{getCategoryIcon(feature?.category || 'content_analysis')}</span>
                    <div>
                      <h3 className="font-medium text-gray-900 mb-1">{disclosure.description}</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Content ID: {disclosure.contentId || 'N/A'}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{formatDate(disclosure.createdAt)}</span>
                        {disclosure.confidence > 0 && (
                          <span className={`px-2 py-1 rounded-full ${getConfidenceColor(disclosure.confidence)}`}>
                            {Math.round(disclosure.confidence * 100)}% confidence
                          </span>
                        )}
                        {disclosure.humanReviewRequired && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                            Human Review Required
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      disclosure.userNotified ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {disclosure.userNotified ? 'Notified' : 'Not Notified'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {disclosures.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No AI disclosures yet.</p>
              <p className="text-sm mt-1">Disclosures will appear here when AI is used with your content.</p>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && userPreferences && (
        <div className="space-y-6">
          {/* Global AI Control */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Global AI Control</h3>
            <div className="space-y-4">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={userPreferences.globalOptOut}
                  onChange={(e) => handleGlobalOptOut(e.target.checked)}
                  className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div>
                  <span className="font-medium text-gray-900">Opt out of all AI features</span>
                  <p className="text-sm text-gray-600 mt-1">
                    Disable all AI processing of your content and data. This will limit some platform features but gives you complete control.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Transparency Level */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Transparency Level</h3>
            <div className="space-y-3">
              {[
                { value: 'minimal', label: 'Minimal', description: 'Only show essential AI disclosures' },
                { value: 'standard', label: 'Standard', description: 'Show important AI usage and disclosures' },
                { value: 'detailed', label: 'Detailed', description: 'Show all AI usage, confidence scores, and technical details' }
              ].map((option) => (
                <label key={option.value} className="flex items-start">
                  <input
                    type="radio"
                    name="transparencyLevel"
                    value={option.value}
                    checked={userPreferences.transparencyLevel === option.value}
                    onChange={(e) => handleTransparencyLevelChange(e.target.value as any)}
                    className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div>
                    <span className="font-medium text-gray-900">{option.label}</span>
                    <p className="text-sm text-gray-600">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
            <div className="space-y-4">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={userPreferences.notificationPreferences.aiUsageAlerts}
                  onChange={(e) => {
                    const updated = {
                      ...userPreferences.notificationPreferences,
                      aiUsageAlerts: e.target.checked
                    };
                    aiTransparencyService.updateUserAIPreferences(userId, {
                      notificationPreferences: updated
                    }).then(() => loadAIData());
                  }}
                  className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div>
                  <span className="font-medium text-gray-900">AI Usage Alerts</span>
                  <p className="text-sm text-gray-600">Get notified when AI is used with your content</p>
                </div>
              </label>

              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={userPreferences.notificationPreferences.modelUpdates}
                  onChange={(e) => {
                    const updated = {
                      ...userPreferences.notificationPreferences,
                      modelUpdates: e.target.checked
                    };
                    aiTransparencyService.updateUserAIPreferences(userId, {
                      notificationPreferences: updated
                    }).then(() => loadAIData());
                  }}
                  className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div>
                  <span className="font-medium text-gray-900">Model Updates</span>
                  <p className="text-sm text-gray-600">Get notified when AI models are updated or changed</p>
                </div>
              </label>

              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={userPreferences.notificationPreferences.accuracyReports}
                  onChange={(e) => {
                    const updated = {
                      ...userPreferences.notificationPreferences,
                      accuracyReports: e.target.checked
                    };
                    aiTransparencyService.updateUserAIPreferences(userId, {
                      notificationPreferences: updated
                    }).then(() => loadAIData());
                  }}
                  className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div>
                  <span className="font-medium text-gray-900">Accuracy Reports</span>
                  <p className="text-sm text-gray-600">Receive periodic reports on AI accuracy and performance</p>
                </div>
              </label>
            </div>
          </div>

          {/* Data Rights */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Data Rights</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <p>• You can request a copy of all AI usage data associated with your account</p>
              <p>• You can request deletion of AI training data derived from your content</p>
              <p>• You can opt out of having your content used for AI model training</p>
              <p>• You can request human review of any AI-generated decisions</p>
            </div>
            <div className="mt-4">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm">
                Request Data Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};