import React, { useState, useEffect } from 'react';
import { passkeyRecoveryService, PasskeyDevice, RecoveryMethod, DeviceBindingRequest } from '../services/passkeyRecoveryService';

interface DeviceManagementProps {
  userId: string;
  onDeviceRevoked?: (deviceId: string) => void;
  onRecoveryMethodAdded?: (method: RecoveryMethod) => void;
}

interface DeviceIconProps {
  deviceType: PasskeyDevice['deviceType'];
  platform: string;
}

const DeviceIcon: React.FC<DeviceIconProps> = ({ deviceType, platform }) => {
  const getIcon = () => {
    switch (deviceType) {
      case 'phone':
        return platform === 'iOS' ? '📱' : '📱';
      case 'tablet':
        return platform === 'iOS' ? '📱' : '📱';
      case 'laptop':
        return '💻';
      case 'desktop':
        return '🖥️';
      case 'security_key':
        return '🔑';
      default:
        return '📱';
    }
  };

  return <span className="text-2xl">{getIcon()}</span>;
};

const TrustLevelBadge: React.FC<{ level: PasskeyDevice['trustLevel'] }> = ({ level }) => {
  const getBadgeColor = () => {
    switch (level) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeColor()}`}>
      {level.toUpperCase()}
    </span>
  );
};

export const PasskeyDeviceManagement: React.FC<DeviceManagementProps> = ({
  userId,
  onDeviceRevoked,
  onRecoveryMethodAdded
}) => {
  const [devices, setDevices] = useState<PasskeyDevice[]>([]);
  const [recoveryMethods, setRecoveryMethods] = useState<RecoveryMethod[]>([]);
  const [bindingRequests, setBindingRequests] = useState<DeviceBindingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'devices' | 'recovery' | 'security'>('devices');
  const [showAddRecovery, setShowAddRecovery] = useState(false);
  const [showDeviceBinding, setShowDeviceBinding] = useState(false);
  const [securityAnalytics, setSecurityAnalytics] = useState<any>(null);

  // Form states
  const [newRecoveryMethod, setNewRecoveryMethod] = useState({
    type: 'email' as RecoveryMethod['type'],
    identifier: '',
    isPrimary: false
  });

  const [newDeviceInfo, setNewDeviceInfo] = useState({
    name: '',
    type: 'phone',
    platform: 'Unknown'
  });

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const [userDevices, userRecoveryMethods, analytics] = await Promise.all([
        passkeyRecoveryService.getUserDevices(userId),
        passkeyRecoveryService.getUserRecoveryMethods(userId),
        passkeyRecoveryService.getSecurityAnalytics(userId)
      ]);

      setDevices(userDevices);
      setRecoveryMethods(userRecoveryMethods);
      setSecurityAnalytics(analytics);
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to revoke this device? You will no longer be able to sign in from this device.')) {
      return;
    }

    try {
      await passkeyRecoveryService.revokeDevice(userId, deviceId, 'User requested revocation');
      setDevices(devices.filter(d => d.id !== deviceId));
      onDeviceRevoked?.(deviceId);
    } catch (error) {
      console.error('Failed to revoke device:', error);
      alert('Failed to revoke device. Please try again.');
    }
  };

  const handleAddRecoveryMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const method = await passkeyRecoveryService.addRecoveryMethod(userId, {
        type: newRecoveryMethod.type,
        identifier: newRecoveryMethod.identifier,
        isVerified: false, // Would need verification flow
        isPrimary: newRecoveryMethod.isPrimary,
        metadata: {}
      });

      setRecoveryMethods([...recoveryMethods, method]);
      setNewRecoveryMethod({ type: 'email', identifier: '', isPrimary: false });
      setShowAddRecovery(false);
      onRecoveryMethodAdded?.(method);
    } catch (error) {
      console.error('Failed to add recovery method:', error);
      alert('Failed to add recovery method. Please try again.');
    }
  };

  const handleRemoveRecoveryMethod = async (methodId: string) => {
    if (!confirm('Are you sure you want to remove this recovery method?')) {
      return;
    }

    try {
      await passkeyRecoveryService.removeRecoveryMethod(userId, methodId);
      setRecoveryMethods(recoveryMethods.filter(m => m.id !== methodId));
    } catch (error) {
      console.error('Failed to remove recovery method:', error);
      alert('Failed to remove recovery method. Please try again.');
    }
  };

  const handleRequestDeviceBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const request = await passkeyRecoveryService.requestDeviceBinding(userId, {
        name: newDeviceInfo.name,
        type: newDeviceInfo.type,
        platform: newDeviceInfo.platform,
        userAgent: navigator.userAgent
      });

      setBindingRequests([...bindingRequests, request]);
      setNewDeviceInfo({ name: '', type: 'phone', platform: 'Unknown' });
      setShowDeviceBinding(false);
      alert('Device binding request sent. Please approve from one of your existing devices.');
    } catch (error) {
      console.error('Failed to request device binding:', error);
      alert('Failed to request device binding. Please try again.');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading device management...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Passkey & Device Management</h1>
        <p className="text-gray-600">Manage your devices, recovery methods, and account security.</p>
      </div>

      {/* Security Score */}
      {securityAnalytics && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Security Score</h3>
              <p className="text-sm text-gray-600">Based on your devices and recovery methods</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">{securityAnalytics.securityScore}/100</div>
              <div className="text-sm text-gray-500">
                {securityAnalytics.deviceCount} devices, {securityAnalytics.recoveryMethodCount} recovery methods
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'devices', label: 'Devices', count: devices.length },
            { id: 'recovery', label: 'Recovery Methods', count: recoveryMethods.length },
            { id: 'security', label: 'Security', count: null }
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

      {/* Devices Tab */}
      {activeTab === 'devices' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Registered Devices</h2>
            <button
              onClick={() => setShowDeviceBinding(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add New Device
            </button>
          </div>

          <div className="grid gap-4">
            {devices.map((device) => (
              <div key={device.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <DeviceIcon deviceType={device.deviceType} platform={device.platform} />
                    <div>
                      <h3 className="font-medium text-gray-900">{device.deviceName}</h3>
                      <p className="text-sm text-gray-500">
                        {device.platform} • {device.browser || 'Unknown Browser'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Added {formatDate(device.createdAt)} • Last used {formatDate(device.lastUsed)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <TrustLevelBadge level={device.trustLevel} />
                    <button
                      onClick={() => handleRevokeDevice(device.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {devices.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No devices registered yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Recovery Methods Tab */}
      {activeTab === 'recovery' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recovery Methods</h2>
            <button
              onClick={() => setShowAddRecovery(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Recovery Method
            </button>
          </div>

          <div className="grid gap-4">
            {recoveryMethods.map((method) => (
              <div key={method.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">
                        {method.type === 'email' ? '📧' : 
                         method.type === 'sms' ? '📱' : 
                         method.type === 'backup_codes' ? '🔢' : '🔑'}
                      </span>
                      <h3 className="font-medium text-gray-900 capitalize">{method.type}</h3>
                      {method.isPrimary && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          Primary
                        </span>
                      )}
                      {method.isVerified ? (
                        <span className="text-green-600 text-sm">✓ Verified</span>
                      ) : (
                        <span className="text-yellow-600 text-sm">⚠ Unverified</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{method.identifier}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Added {formatDate(method.createdAt)}
                      {method.lastUsed && ` • Last used ${formatDate(method.lastUsed)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveRecoveryMethod(method.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {recoveryMethods.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No recovery methods configured.</p>
              <p className="text-sm mt-1">Add a recovery method to secure your account.</p>
            </div>
          )}
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && securityAnalytics && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Security Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Account Security</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Security Score</span>
                  <span className="text-sm font-medium">{securityAnalytics.securityScore}/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Active Devices</span>
                  <span className="text-sm font-medium">{securityAnalytics.deviceCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Recovery Methods</span>
                  <span className="text-sm font-medium">{securityAnalytics.recoveryMethodCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Recent Recovery Attempts</span>
                  <span className="text-sm font-medium">{securityAnalytics.recentRecoveryAttempts}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Recommendations</h3>
              <div className="space-y-2 text-sm">
                {securityAnalytics.deviceCount < 2 && (
                  <div className="flex items-start space-x-2">
                    <span className="text-yellow-500">⚠</span>
                    <span className="text-gray-600">Add a backup device for better security</span>
                  </div>
                )}
                {securityAnalytics.recoveryMethodCount < 2 && (
                  <div className="flex items-start space-x-2">
                    <span className="text-yellow-500">⚠</span>
                    <span className="text-gray-600">Add multiple recovery methods</span>
                  </div>
                )}
                {securityAnalytics.securityScore >= 80 && (
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-gray-600">Your account security is excellent</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Recovery Method Modal */}
      {showAddRecovery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Recovery Method</h3>
            <form onSubmit={handleAddRecoveryMethod}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={newRecoveryMethod.type}
                  onChange={(e) => setNewRecoveryMethod({
                    ...newRecoveryMethod,
                    type: e.target.value as RecoveryMethod['type']
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="backup_codes">Backup Codes</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {newRecoveryMethod.type === 'email' ? 'Email Address' : 
                   newRecoveryMethod.type === 'sms' ? 'Phone Number' : 'Identifier'}
                </label>
                <input
                  type={newRecoveryMethod.type === 'email' ? 'email' : 'text'}
                  value={newRecoveryMethod.identifier}
                  onChange={(e) => setNewRecoveryMethod({
                    ...newRecoveryMethod,
                    identifier: e.target.value
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newRecoveryMethod.isPrimary}
                    onChange={(e) => setNewRecoveryMethod({
                      ...newRecoveryMethod,
                      isPrimary: e.target.checked
                    })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Set as primary recovery method</span>
                </label>
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Method
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddRecovery(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Device Binding Modal */}
      {showDeviceBinding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Device</h3>
            <form onSubmit={handleRequestDeviceBinding}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Device Name</label>
                <input
                  type="text"
                  value={newDeviceInfo.name}
                  onChange={(e) => setNewDeviceInfo({
                    ...newDeviceInfo,
                    name: e.target.value
                  })}
                  placeholder="e.g., My iPhone, Work Laptop"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Device Type</label>
                <select
                  value={newDeviceInfo.type}
                  onChange={(e) => setNewDeviceInfo({
                    ...newDeviceInfo,
                    type: e.target.value
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="phone">Phone</option>
                  <option value="tablet">Tablet</option>
                  <option value="laptop">Laptop</option>
                  <option value="desktop">Desktop</option>
                  <option value="security_key">Security Key</option>
                </select>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600">
                  A binding request will be sent to your existing devices for approval.
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Request Binding
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeviceBinding(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};