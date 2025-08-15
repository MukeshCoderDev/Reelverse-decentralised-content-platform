import React, { useState, useEffect } from 'react';
import { featureFlags, FeatureFlag, FeatureFlagCondition } from '../../lib/featureFlags';

interface FeatureFlagManagerProps {
  onClose?: () => void;
}

export function FeatureFlagManager({ onClose }: FeatureFlagManagerProps) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFlags();
  }, []);

  const loadFlags = () => {
    setFlags(featureFlags.getAllFlags());
  };

  const filteredFlags = flags.filter(flag =>
    flag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    flag.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    flag.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleFlag = (flagKey: string) => {
    const flag = flags.find(f => f.key === flagKey);
    if (flag) {
      featureFlags.updateFlag(flagKey, { enabled: !flag.enabled });
      loadFlags();
    }
  };

  const handleEditFlag = (flag: FeatureFlag) => {
    setSelectedFlag(flag);
    setIsEditing(true);
  };

  const handleSaveFlag = (updatedFlag: FeatureFlag) => {
    if (selectedFlag) {
      featureFlags.updateFlag(selectedFlag.key, updatedFlag);
    } else {
      featureFlags.createFlag(updatedFlag);
    }
    loadFlags();
    setIsEditing(false);
    setSelectedFlag(null);
  };

  const handleDeleteFlag = (flagKey: string) => {
    if (confirm('Are you sure you want to delete this feature flag?')) {
      featureFlags.deleteFlag(flagKey);
      loadFlags();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Feature Flag Manager</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search feature flags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => {
                setSelectedFlag(null);
                setIsEditing(true);
              }}
              className="ml-4 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              Create Flag
            </button>
          </div>

          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-gray-900">Name</th>
                  <th className="text-left p-3 font-medium text-gray-900">Key</th>
                  <th className="text-left p-3 font-medium text-gray-900">Type</th>
                  <th className="text-left p-3 font-medium text-gray-900">Value</th>
                  <th className="text-left p-3 font-medium text-gray-900">Status</th>
                  <th className="text-left p-3 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlags.map(flag => (
                  <tr key={flag.key} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <div>
                        <div className="font-medium text-gray-900">{flag.name}</div>
                        <div className="text-sm text-gray-500">{flag.description}</div>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-sm text-gray-600">{flag.key}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {flag.type}
                      </span>
                    </td>
                    <td className="p-3">
                      {flag.type === 'boolean' ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          flag.value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {flag.value ? 'True' : 'False'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-900">{String(flag.value)}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleToggleFlag(flag.key)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          flag.enabled ? 'bg-purple-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            flag.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditFlag(flag)}
                          className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteFlag(flag.key)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isEditing && (
        <FeatureFlagEditor
          flag={selectedFlag}
          onSave={handleSaveFlag}
          onCancel={() => {
            setIsEditing(false);
            setSelectedFlag(null);
          }}
        />
      )}
    </div>
  );
}

interface FeatureFlagEditorProps {
  flag: FeatureFlag | null;
  onSave: (flag: FeatureFlag) => void;
  onCancel: () => void;
}

function FeatureFlagEditor({ flag, onSave, onCancel }: FeatureFlagEditorProps) {
  const [formData, setFormData] = useState<Partial<FeatureFlag>>({
    key: flag?.key || '',
    name: flag?.name || '',
    description: flag?.description || '',
    enabled: flag?.enabled ?? true,
    type: flag?.type || 'boolean',
    value: flag?.value ?? true,
    rolloutPercentage: flag?.rolloutPercentage,
    geoRestrictions: flag?.geoRestrictions || [],
    conditions: flag?.conditions || []
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newFlag: FeatureFlag = {
      key: formData.key!,
      name: formData.name!,
      description: formData.description!,
      enabled: formData.enabled!,
      type: formData.type!,
      value: formData.value,
      rolloutPercentage: formData.rolloutPercentage,
      geoRestrictions: formData.geoRestrictions,
      conditions: formData.conditions,
      createdAt: flag?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    onSave(newFlag);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {flag ? 'Edit Feature Flag' : 'Create Feature Flag'}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Key
            </label>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
              disabled={!!flag} // Don't allow editing key for existing flags
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="boolean">Boolean</option>
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="json">JSON</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value
              </label>
              {formData.type === 'boolean' ? (
                <select
                  value={String(formData.value)}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value === 'true' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : (
                <input
                  type={formData.type === 'number' ? 'number' : 'text'}
                  value={String(formData.value || '')}
                  onChange={(e) => {
                    const value = formData.type === 'number' ? Number(e.target.value) : e.target.value;
                    setFormData({ ...formData, value });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              )}
            </div>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="ml-2 text-sm text-gray-700">Enabled</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rollout Percentage (optional)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.rolloutPercentage || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                rolloutPercentage: e.target.value ? Number(e.target.value) : undefined 
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="0-100"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              {flag ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}