/**
 * Policy Management Admin Component
 * Admin interface for managing legal policies and tracking acceptances
 */

import React, { useState, useEffect } from 'react';
import { PolicyManagementService, PolicyDocument, PolicyType, PolicyAcceptance } from '../services/policyManagementService';

interface PolicyFormData {
  type: PolicyType;
  title: string;
  content: string;
  requiresAcceptance: boolean;
  jurisdiction: string;
  language: string;
  category: string;
  tags: string[];
  effectiveDate: string;
  expiryDate: string;
}

const PolicyManagement: React.FC = () => {
  const [policies, setPolicies] = useState<PolicyDocument[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyDocument | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyDocument | null>(null);
  const [acceptances, setAcceptances] = useState<PolicyAcceptance[]>([]);
  const [activeTab, setActiveTab] = useState<'policies' | 'acceptances'>('policies');

  const policyService = PolicyManagementService.getInstance();

  const [formData, setFormData] = useState<PolicyFormData>({
    type: 'terms_of_service',
    title: '',
    content: '',
    requiresAcceptance: true,
    jurisdiction: 'US',
    language: 'en',
    category: 'legal',
    tags: [],
    effectiveDate: new Date().toISOString().split('T')[0],
    expiryDate: ''
  });

  const policyTypes: { value: PolicyType; label: string }[] = [
    { value: 'terms_of_service', label: 'Terms of Service' },
    { value: 'privacy_policy', label: 'Privacy Policy' },
    { value: 'acceptable_use_policy', label: 'Acceptable Use Policy' },
    { value: 'dmca_policy', label: 'DMCA Policy' },
    { value: '2257_compliance_policy', label: '2257 Compliance Policy' },
    { value: 'cookie_policy', label: 'Cookie Policy' },
    { value: 'data_processing_agreement', label: 'Data Processing Agreement' },
    { value: 'creator_agreement', label: 'Creator Agreement' },
    { value: 'payment_terms', label: 'Payment Terms' }
  ];

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = () => {
    setPolicies(policyService.getAllPolicies());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const config = {
      type: formData.type,
      title: formData.title,
      content: formData.content,
      requiresAcceptance: formData.requiresAcceptance,
      jurisdiction: formData.jurisdiction,
      language: formData.language,
      category: formData.category,
      tags: formData.tags,
      effectiveDate: formData.effectiveDate ? new Date(formData.effectiveDate) : undefined,
      expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : undefined
    };

    policyService.createPolicy(config);
    resetForm();
    loadPolicies();
  };

  const resetForm = () => {
    setFormData({
      type: 'terms_of_service',
      title: '',
      content: '',
      requiresAcceptance: true,
      jurisdiction: 'US',
      language: 'en',
      category: 'legal',
      tags: [],
      effectiveDate: new Date().toISOString().split('T')[0],
      expiryDate: ''
    });
    setEditingPolicy(null);
    setShowForm(false);
  };

  const handleEdit = (policy: PolicyDocument) => {
    setFormData({
      type: policy.type,
      title: policy.title,
      content: policy.content,
      requiresAcceptance: policy.requiresAcceptance,
      jurisdiction: policy.metadata.jurisdiction || 'US',
      language: policy.metadata.language,
      category: policy.metadata.category,
      tags: policy.metadata.tags,
      effectiveDate: policy.effectiveDate.toISOString().split('T')[0],
      expiryDate: policy.expiryDate ? policy.expiryDate.toISOString().split('T')[0] : ''
    });
    setEditingPolicy(policy);
    setShowForm(true);
  };

  const handleViewAcceptances = (policy: PolicyDocument) => {
    setSelectedPolicy(policy);
    // In a real implementation, this would fetch acceptances from the service
    setAcceptances([]);
    setActiveTab('acceptances');
  };

  const handleTagInput = (value: string) => {
    const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    setFormData(prev => ({ ...prev, tags }));
  };

  const getStatusBadge = (policy: PolicyDocument) => {
    if (!policy.isActive) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">Inactive</span>;
    }
    
    const now = new Date();
    if (policy.expiryDate && policy.expiryDate < now) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Expired</span>;
    }
    
    return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Active</span>;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Policy Management</h1>
          <p className="text-gray-600">Manage legal policies and track user acceptances</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Policy
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('policies')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'policies'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Policies ({policies.length})
          </button>
          <button
            onClick={() => setActiveTab('acceptances')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'acceptances'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Acceptances
          </button>
        </nav>
      </div>

      {/* Policy Form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingPolicy ? 'Edit Policy' : 'Create Policy'}
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
                  Policy Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as PolicyType }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {policyTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter policy content in Markdown format..."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jurisdiction
                </label>
                <input
                  type="text"
                  value={formData.jurisdiction}
                  onChange={(e) => setFormData(prev => ({ ...prev, jurisdiction: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Language
                </label>
                <input
                  type="text"
                  value={formData.language}
                  onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={formData.tags.join(', ')}
                onChange={(e) => handleTagInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="legal, terms, agreement"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, effectiveDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date (optional)
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="requiresAcceptance"
                checked={formData.requiresAcceptance}
                onChange={(e) => setFormData(prev => ({ ...prev, requiresAcceptance: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="requiresAcceptance" className="text-sm font-medium text-gray-700">
                Requires User Acceptance
              </label>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingPolicy ? 'Update' : 'Create'} Policy
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

      {/* Policies Tab */}
      {activeTab === 'policies' && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Policy Documents</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {policies.map(policy => (
              <div key={policy.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">{policy.title}</h3>
                      {getStatusBadge(policy)}
                      {policy.requiresAcceptance && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          Requires Acceptance
                        </span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Type:</strong> {policy.type.replace('_', ' ')}</p>
                      <p><strong>Version:</strong> {policy.version}</p>
                      <p><strong>Effective:</strong> {policy.effectiveDate.toLocaleDateString()}</p>
                      {policy.expiryDate && (
                        <p><strong>Expires:</strong> {policy.expiryDate.toLocaleDateString()}</p>
                      )}
                      <p><strong>Category:</strong> {policy.metadata.category}</p>
                      <p><strong>Tags:</strong> {policy.metadata.tags.join(', ')}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleViewAcceptances(policy)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View Acceptances
                    </button>
                    <button
                      onClick={() => handleEdit(policy)}
                      className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {policies.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-2">📄</div>
                <p>No policies created yet</p>
                <p className="text-sm mt-1">Create your first policy to get started</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Acceptances Tab */}
      {activeTab === 'acceptances' && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Policy Acceptances
              {selectedPolicy && ` - ${selectedPolicy.title}`}
            </h2>
          </div>

          <div className="p-6">
            {selectedPolicy ? (
              <div>
                <p className="text-gray-600 mb-4">
                  Showing acceptances for {selectedPolicy.title} (Version {selectedPolicy.version})
                </p>
                
                {acceptances.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📋</div>
                    <p>No acceptances recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {acceptances.map(acceptance => (
                      <div key={acceptance.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <strong>User ID:</strong> {acceptance.userId}
                          </div>
                          <div>
                            <strong>Accepted:</strong> {acceptance.acceptedAt.toLocaleString()}
                          </div>
                          <div>
                            <strong>Method:</strong> {acceptance.acceptanceMethod}
                          </div>
                          <div>
                            <strong>IP Address:</strong> {acceptance.ipAddress}
                          </div>
                          <div>
                            <strong>User Agent:</strong> {acceptance.userAgent.substring(0, 50)}...
                          </div>
                          <div>
                            <strong>Status:</strong> 
                            <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                              acceptance.isActive 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {acceptance.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">👆</div>
                <p>Select a policy to view its acceptances</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyManagement;