/**
 * Webhook Management Component
 * Admin interface for managing webhook endpoints and viewing delivery statistics
 */

import React, { useState, useEffect } from 'react';
import { WebhookAlertService, WebhookEndpoint, WebhookEventType } from '../services/webhookAlertService';

interface WebhookFormData {
  name: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
}

const WebhookManagement: React.FC = () => {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpoint | null>(null);
  const [testResults, setTestResults] = useState<Map<string, any>>(new Map());
  
  const webhookService = WebhookAlertService.getInstance();

  const [formData, setFormData] = useState<WebhookFormData>({
    name: '',
    url: '',
    secret: '',
    events: [],
    enabled: true,
    maxRetries: 3,
    retryDelay: 5000,
    backoffMultiplier: 2
  });

  const availableEvents: { value: WebhookEventType; label: string; description: string }[] = [
    { value: 'slo.breach.warning', label: 'SLO Breach Warning', description: 'SLO metrics approaching thresholds' },
    { value: 'slo.breach.critical', label: 'SLO Breach Critical', description: 'SLO metrics exceeding thresholds' },
    { value: 'incident.created', label: 'Incident Created', description: 'New incidents created' },
    { value: 'incident.updated', label: 'Incident Updated', description: 'Incident status changes' },
    { value: 'incident.resolved', label: 'Incident Resolved', description: 'Incidents marked as resolved' },
    { value: 'service.degraded', label: 'Service Degraded', description: 'Service performance degradation' },
    { value: 'service.outage', label: 'Service Outage', description: 'Service outages and failures' },
    { value: 'metric.anomaly', label: 'Metric Anomaly', description: 'Unusual metric patterns detected' }
  ];

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    setEndpoints(webhookService.getEndpoints());
    setStatistics(webhookService.getStatistics());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingEndpoint) {
      // Update existing endpoint
      webhookService.updateEndpoint(editingEndpoint.id, {
        name: formData.name,
        url: formData.url,
        secret: formData.secret || undefined,
        events: formData.events,
        enabled: formData.enabled,
        retryConfig: {
          maxRetries: formData.maxRetries,
          retryDelay: formData.retryDelay,
          backoffMultiplier: formData.backoffMultiplier
        }
      });
    } else {
      // Create new endpoint
      webhookService.addEndpoint({
        name: formData.name,
        url: formData.url,
        secret: formData.secret || undefined,
        events: formData.events,
        retryConfig: {
          maxRetries: formData.maxRetries,
          retryDelay: formData.retryDelay,
          backoffMultiplier: formData.backoffMultiplier
        }
      });
    }

    resetForm();
    loadData();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      secret: '',
      events: [],
      enabled: true,
      maxRetries: 3,
      retryDelay: 5000,
      backoffMultiplier: 2
    });
    setEditingEndpoint(null);
    setShowForm(false);
  };

  const handleEdit = (endpoint: WebhookEndpoint) => {
    setFormData({
      name: endpoint.name,
      url: endpoint.url,
      secret: endpoint.secret || '',
      events: endpoint.events,
      enabled: endpoint.enabled,
      maxRetries: endpoint.retryConfig.maxRetries,
      retryDelay: endpoint.retryConfig.retryDelay,
      backoffMultiplier: endpoint.retryConfig.backoffMultiplier
    });
    setEditingEndpoint(endpoint);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this webhook endpoint?')) {
      webhookService.removeEndpoint(id);
      loadData();
    }
  };

  const handleTest = async (id: string) => {
    setTestResults(prev => new Map(prev.set(id, { testing: true })));
    
    try {
      const result = await webhookService.testEndpoint(id);
      setTestResults(prev => new Map(prev.set(id, result)));
    } catch (error) {
      setTestResults(prev => new Map(prev.set(id, { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })));
    }
  };

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    webhookService.updateEndpoint(id, { enabled });
    loadData();
  };

  const handleEventToggle = (event: WebhookEventType) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event]
    }));
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhook Management</h1>
          <p className="text-gray-600">Configure webhook endpoints for real-time alerts</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Webhook
        </button>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-blue-600">{statistics.totalEndpoints}</div>
            <div className="text-sm text-gray-600">Total Endpoints</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">{statistics.enabledEndpoints}</div>
            <div className="text-sm text-gray-600">Enabled</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{statistics.totalDeliveries}</div>
            <div className="text-sm text-gray-600">Total Deliveries</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">{statistics.successfulDeliveries}</div>
            <div className="text-sm text-gray-600">Successful</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-red-600">{statistics.failedDeliveries}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
        </div>
      )}

      {/* Webhook Form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingEndpoint ? 'Edit Webhook' : 'Add Webhook'}
            </h2>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secret (optional)
              </label>
              <input
                type="password"
                value={formData.secret}
                onChange={(e) => setFormData(prev => ({ ...prev, secret: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Used for webhook signature verification"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Events
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {availableEvents.map(event => (
                  <label key={event.value} className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.events.includes(event.value)}
                      onChange={() => handleEventToggle(event.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{event.label}</div>
                      <div className="text-xs text-gray-500">{event.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Retries
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.maxRetries}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxRetries: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Retry Delay (ms)
                </label>
                <input
                  type="number"
                  min="1000"
                  max="60000"
                  step="1000"
                  value={formData.retryDelay}
                  onChange={(e) => setFormData(prev => ({ ...prev, retryDelay: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Backoff Multiplier
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  value={formData.backoffMultiplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, backoffMultiplier: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                Enabled
              </label>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingEndpoint ? 'Update' : 'Create'} Webhook
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Endpoints List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Webhook Endpoints</h2>
        </div>

        <div className="divide-y divide-gray-200">
          {endpoints.map(endpoint => {
            const testResult = testResults.get(endpoint.id);
            const successRate = endpoint.successCount + endpoint.failureCount > 0
              ? (endpoint.successCount / (endpoint.successCount + endpoint.failureCount) * 100).toFixed(1)
              : 'N/A';

            return (
              <div key={endpoint.id} className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${endpoint.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <h3 className="text-lg font-medium text-gray-900">{endpoint.name}</h3>
                    <span className="text-sm text-gray-500">({endpoint.id})</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleTest(endpoint.id)}
                      disabled={testResult?.testing}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
                    >
                      {testResult?.testing ? 'Testing...' : 'Test'}
                    </button>
                    <button
                      onClick={() => handleEdit(endpoint)}
                      className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(endpoint.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-2">
                  <strong>URL:</strong> {endpoint.url}
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {endpoint.events.map(event => (
                    <span
                      key={event}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {event}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Success Rate:</span>
                    <span className="ml-1 font-medium">{successRate}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Deliveries:</span>
                    <span className="ml-1 font-medium">{endpoint.successCount + endpoint.failureCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Last Triggered:</span>
                    <span className="ml-1 font-medium">
                      {endpoint.lastTriggered ? endpoint.lastTriggered.toLocaleString() : 'Never'}
                    </span>
                  </div>
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={endpoint.enabled}
                        onChange={(e) => handleToggleEnabled(endpoint.id, e.target.checked)}
                        className="mr-1"
                      />
                      <span className="text-gray-500">Enabled</span>
                    </label>
                  </div>
                </div>

                {testResult && !testResult.testing && (
                  <div className={`mt-3 p-3 rounded-lg text-sm ${
                    testResult.success 
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span>
                        {testResult.success ? '✅ Test successful' : '❌ Test failed'}
                      </span>
                      {testResult.responseTime && (
                        <span>{testResult.responseTime}ms</span>
                      )}
                    </div>
                    {testResult.error && (
                      <div className="mt-1 text-xs">{testResult.error}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {endpoints.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">🔗</div>
              <p>No webhook endpoints configured</p>
              <p className="text-sm mt-1">Add your first webhook to receive real-time alerts</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebhookManagement;