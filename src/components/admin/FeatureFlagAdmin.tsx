import React, { useState, useEffect } from 'react';
import { 
  FeatureFlag, 
  FeatureFlagConfig, 
  DEFAULT_FLAG_CONFIG 
} from '../../lib/featureFlags/FeatureFlags';
import { LocalFeatureFlagProvider } from '../../lib/featureFlags/providers/LocalProvider';
import { 
  Settings, 
  Toggle, 
  Save, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Globe,
  Percent
} from 'lucide-react';

interface FeatureFlagAdminProps {
  provider?: LocalFeatureFlagProvider;
  onSave?: (flags: Record<FeatureFlag, FeatureFlagConfig>) => void;
}

export const FeatureFlagAdmin: React.FC<FeatureFlagAdminProps> = ({
  provider,
  onSave
}) => {
  const [flags, setFlags] = useState<Record<FeatureFlag, FeatureFlagConfig>>(DEFAULT_FLAG_CONFIG);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (provider) {
      // Load flags from provider
      const loadedFlags: Record<FeatureFlag, FeatureFlagConfig> = {} as any;
      Object.values(FeatureFlag).forEach(flag => {
        const config = provider.getFlagConfig(flag);
        if (config) {
          loadedFlags[flag] = config;
        }
      });
      setFlags(loadedFlags);
    }
  }, [provider]);

  const categories = [
    'all',
    'Content & Access',
    'Verification',
    'Organization',
    'Content Processing',
    'Storage',
    'Compliance',
    'UI/UX',
    'Performance',
    'Experimental'
  ];

  const getCategoryForFlag = (flag: FeatureFlag): string => {
    const config = DEFAULT_FLAG_CONFIG[flag];
    return config?.metadata?.category || 'Other';
  };

  const filteredFlags = Object.entries(flags).filter(([flag, config]) => {
    const matchesSearch = flag.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         config.metadata?.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || 
                           getCategoryForFlag(flag as FeatureFlag).includes(categoryFilter);
    
    return matchesSearch && matchesCategory;
  });

  const updateFlag = (flag: FeatureFlag, updates: Partial<FeatureFlagConfig>) => {
    setFlags(prev => ({
      ...prev,
      [flag]: { ...prev[flag], ...updates }
    }));
    setHasChanges(true);
  };

  const saveChanges = () => {
    if (provider) {
      provider.setFlags(flags);
    }
    if (onSave) {
      onSave(flags);
    }
    setHasChanges(false);
  };

  const resetToDefaults = () => {
    setFlags(DEFAULT_FLAG_CONFIG);
    if (provider) {
      provider.resetToDefaults();
    }
    setHasChanges(false);
  };

  const getFlagStatus = (config: FeatureFlagConfig): {
    status: 'enabled' | 'disabled' | 'partial';
    color: string;
    icon: React.ReactNode;
  } => {
    if (!config.enabled) {
      return {
        status: 'disabled',
        color: 'text-red-600 bg-red-50',
        icon: <AlertTriangle className="h-4 w-4" />
      };
    }

    if (config.rolloutPercentage && config.rolloutPercentage < 100) {
      return {
        status: 'partial',
        color: 'text-yellow-600 bg-yellow-50',
        icon: <Percent className="h-4 w-4" />
      };
    }

    return {
      status: 'enabled',
      color: 'text-green-600 bg-green-50',
      icon: <CheckCircle className="h-4 w-4" />
    };
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Settings className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Feature Flag Administration</h1>
              <p className="text-gray-600">Manage platform feature flags and configurations</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {hasChanges && (
              <span className="text-sm text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full">
                Unsaved changes
              </span>
            )}
            <button
              onClick={resetToDefaults}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2 inline" />
              Reset to Defaults
            </button>
            <button
              onClick={saveChanges}
              disabled={!hasChanges}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4 mr-2 inline" />
              Save Changes
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search flags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Flag List */}
      <div className="space-y-4">
        {filteredFlags.map(([flag, config]) => {
          const flagEnum = flag as FeatureFlag;
          const status = getFlagStatus(config);
          const isEditing = editingFlag === flagEnum;

          return (
            <div
              key={flag}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {flag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </h3>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      {status.icon}
                      <span className="ml-1">{status.status}</span>
                    </span>
                  </div>
                  
                  <p className="text-gray-600 mb-4">
                    {config.metadata?.description || 'No description available'}
                  </p>

                  {/* Flag Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Toggle className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">Enabled:</span>
                      <span className={config.enabled ? 'text-green-600' : 'text-red-600'}>
                        {config.enabled ? 'Yes' : 'No'}
                      </span>
                    </div>

                    {config.rolloutPercentage !== undefined && (
                      <div className="flex items-center space-x-2">
                        <Percent className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">Rollout:</span>
                        <span className="text-gray-900">{config.rolloutPercentage}%</span>
                      </div>
                    )}

                    {config.userSegments && (
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">Segments:</span>
                        <span className="text-gray-900">{config.userSegments.join(', ')}</span>
                      </div>
                    )}

                    {config.geoTargeting && (
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">Geo:</span>
                        <span className="text-gray-900">
                          {config.geoTargeting.includedCountries ? 
                            `Include: ${config.geoTargeting.includedCountries.join(', ')}` :
                            config.geoTargeting.excludedCountries ?
                            `Exclude: ${config.geoTargeting.excludedCountries.join(', ')}` :
                            'Global'
                          }
                        </span>
                      </div>
                    )}

                    {(config.startDate || config.endDate) && (
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">Schedule:</span>
                        <span className="text-gray-900">
                          {config.startDate && new Date(config.startDate).toLocaleDateString()} - 
                          {config.endDate ? new Date(config.endDate).toLocaleDateString() : 'Ongoing'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setEditingFlag(isEditing ? null : flagEnum)}
                    className="px-3 py-1 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
                  >
                    {isEditing ? 'Cancel' : 'Edit'}
                  </button>
                  
                  <button
                    onClick={() => updateFlag(flagEnum, { enabled: !config.enabled })}
                    className={`px-3 py-1 text-sm rounded ${
                      config.enabled 
                        ? 'text-red-600 border border-red-300 hover:bg-red-50'
                        : 'text-green-600 border border-green-300 hover:bg-green-50'
                    }`}
                  >
                    {config.enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>

              {/* Edit Form */}
              {isEditing && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <FlagEditForm
                    flag={flagEnum}
                    config={config}
                    onUpdate={(updates) => updateFlag(flagEnum, updates)}
                    onClose={() => setEditingFlag(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredFlags.length === 0 && (
        <div className="text-center py-12">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No flags found</h3>
          <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
        </div>
      )}
    </div>
  );
};

interface FlagEditFormProps {
  flag: FeatureFlag;
  config: FeatureFlagConfig;
  onUpdate: (updates: Partial<FeatureFlagConfig>) => void;
  onClose: () => void;
}

const FlagEditForm: React.FC<FlagEditFormProps> = ({
  flag,
  config,
  onUpdate,
  onClose
}) => {
  const [formData, setFormData] = useState(config);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Enabled Toggle */}
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Enabled</span>
          </label>
        </div>

        {/* Rollout Percentage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rollout Percentage
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={formData.rolloutPercentage || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              rolloutPercentage: e.target.value ? parseInt(e.target.value) : undefined 
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="100"
          />
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="datetime-local"
            value={formData.startDate ? new Date(formData.startDate).toISOString().slice(0, 16) : ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined 
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="datetime-local"
            value={formData.endDate ? new Date(formData.endDate).toISOString().slice(0, 16) : ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined 
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* User Segments */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          User Segments (comma-separated)
        </label>
        <input
          type="text"
          value={formData.userSegments?.join(', ') || ''}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            userSegments: e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined 
          }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="agency, studio, beta_testers"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
};