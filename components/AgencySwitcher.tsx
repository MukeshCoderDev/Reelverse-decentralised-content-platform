import React, { useState } from 'react';
import Button from './Button';
import Icon from './Icon';
import { useWallet } from '../contexts/WalletContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { Organization } from '../services/organizationService';

interface AgencySwitcherProps {
  onOrganizationChange?: (org: Organization | null) => void;
}

const AgencySwitcher: React.FC<AgencySwitcherProps> = ({ onOrganizationChange }) => {
  const { isConnected, isAuthenticated } = useWallet();
  const {
    currentOrganization,
    userOrganizations,
    currentMember,
    isLoading,
    error,
    switchOrganization,
    createOrganization,
    clearError
  } = useOrganization();
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgType, setNewOrgType] = useState<'agency' | 'studio'>('agency');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleOrgSwitch = async (org: Organization) => {
    try {
      await switchOrganization(org.id);
      setShowDropdown(false);
      onOrganizationChange?.(org);
    } catch (error) {
      console.error('Failed to switch organization:', error);
    }
  };

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) return;

    try {
      setIsCreating(true);
      clearError();
      
      const newOrg = await createOrganization({
        name: newOrgName,
        type: newOrgType,
        description: newOrgDescription || undefined,
      });

      onOrganizationChange?.(newOrg);
      
      setShowCreateModal(false);
      setNewOrgName('');
      setNewOrgType('agency');
      setNewOrgDescription('');
    } catch (error) {
      console.error('Failed to create organization:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const getOrgIcon = (type: string) => {
    switch (type) {
      case 'agency': return 'users';
      case 'studio': return 'video';
      default: return 'user';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'text-blue-600';
      case 'manager': return 'text-green-600';
      case 'uploader': return 'text-yellow-600';
      case 'analyst': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getUserRole = (org: Organization): string => {
    if (org.owner === currentMember?.wallet) return 'owner';
    return currentMember?.role || 'member';
  };

  if (!isConnected || !isAuthenticated) {
    return null;
  }

  return (
    <div className="relative">
      {/* Agency Switcher Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={isLoading}
        className="flex items-center gap-2 min-w-[140px]"
      >
        {isLoading ? (
          <Icon name="loader" size={14} className="animate-spin" />
        ) : (
          <Icon name={getOrgIcon(currentOrg?.type || 'user')} size={14} />
        )}
        <span className="truncate">
          {currentOrganization?.name || 'Select Organization'}
        </span>
        <Icon name="chevron-down" size={12} />
      </Button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute top-full right-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Switch Organization</h3>
            <p className="text-sm text-gray-600">Choose which account to use</p>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {userOrganizations.map(org => {
              const userRole = getUserRole(org);
              return (
                <button
                  key={org.id}
                  onClick={() => handleOrgSwitch(org)}
                  className={`w-full p-3 text-left hover:bg-gray-50 flex items-center justify-between ${
                    currentOrganization?.id === org.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Icon name={getOrgIcon(org.type)} size={16} className="text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{org.name}</span>
                        {org.type !== 'individual' && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs capitalize">
                            {org.type}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`capitalize ${getRoleColor(userRole)}`}>
                          {userRole}
                        </span>
                        {org.memberCount > 1 && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600">{org.memberCount} members</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {currentOrganization?.id === org.id && (
                    <Icon name="check" size={16} className="text-blue-600" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-3 border-t border-gray-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="w-full"
            >
              <Icon name="plus" size={14} className="mr-2" />
              Create New Organization
            </Button>
          </div>
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Organization</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowCreateModal(false)}
              >
                <Icon name="x" size={20} />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Enter organization name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newOrgDescription}
                  onChange={(e) => setNewOrgDescription(e.target.value)}
                  placeholder="Brief description of your organization"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Type *
                </label>
                <select
                  value={newOrgType}
                  onChange={(e) => setNewOrgType(e.target.value as 'agency' | 'studio')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="agency">Agency (Multiple creators/studios)</option>
                  <option value="studio">Studio (Single production company)</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <Icon name="alert-circle" size={16} />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Icon name="info" size={16} className="text-blue-600 mt-0.5" />
                  <div className="text-blue-700 text-sm">
                    <p className="font-medium mb-1">Organization Benefits:</p>
                    <ul className="text-xs space-y-1">
                      <li>• Manage multiple creators from one dashboard</li>
                      <li>• Role-based permissions and upload quotas</li>
                      <li>• Aggregated analytics and reporting</li>
                      <li>• Bulk upload and migration tools</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateOrganization}
                disabled={isCreating || !newOrgName.trim()}
                className="flex-1"
              >
                {isCreating ? (
                  <>
                    <Icon name="loader" size={16} className="animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Icon name="plus" size={16} className="mr-2" />
                    Create
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

export default AgencySwitcher;