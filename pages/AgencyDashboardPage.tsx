import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/shared/EmptyState';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { useWallet } from '../contexts/WalletContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { OrganizationMember, OrganizationAnalytics, OrganizationService } from '../services/organizationService';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: 'manager' | 'uploader' | 'analyst', quota: number) => Promise<void>;
}

const InviteMemberModal: React.FC<InviteMemberModalProps> = ({ isOpen, onClose, onInvite }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'manager' | 'uploader' | 'analyst'>('uploader');
  const [quota, setQuota] = useState(5000);
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const organizationService = OrganizationService.getInstance();

  const handleInvite = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setIsInviting(true);
      setError(null);
      await onInvite(email, role, quota);
      
      // Reset form
      setEmail('');
      setRole('uploader');
      setQuota(5000);
      onClose();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = (newRole: 'manager' | 'uploader' | 'analyst') => {
    setRole(newRole);
    setQuota(organizationService.getDefaultUploadQuota(newRole));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Invite Team Member</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <Icon name="x" size={20} />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role *
            </label>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="manager">Manager - Full content & member management</option>
              <option value="uploader">Uploader - Content creation & upload</option>
              <option value="analyst">Analyst - Analytics & reporting only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Upload Quota (MB)
            </label>
            <input
              type="number"
              value={quota}
              onChange={(e) => setQuota(parseInt(e.target.value) || 0)}
              min="0"
              max="50000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {quota === 0 ? 'No upload access' : `${(quota / 1000).toFixed(1)} GB per month`}
            </p>
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
                <p className="font-medium mb-1">Invitation Process:</p>
                <ul className="text-xs space-y-1">
                  <li>• Member will receive a magic link via email</li>
                  <li>• They must connect their wallet to join</li>
                  <li>• Permissions can be updated after joining</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleInvite}
            disabled={isInviting || !email.trim()}
            className="flex-1"
          >
            {isInviting ? (
              <>
                <Icon name="loader" size={16} className="animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Icon name="mail" size={16} className="mr-2" />
                Send Invite
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

const AgencyDashboardPage: React.FC = () => {
  const { isConnected, isAuthenticated } = useWallet();
  const {
    currentOrganization,
    organizationMembers,
    currentMember,
    isLoading,
    error,
    inviteMember,
    updateMember,
    removeMember,
    canManageMembers,
    clearError
  } = useOrganization();

  const [analytics, setAnalytics] = useState<OrganizationAnalytics | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  const organizationService = OrganizationService.getInstance();

  // Load analytics when organization changes
  useEffect(() => {
    if (currentOrganization && currentOrganization.type !== 'individual') {
      loadAnalytics();
    }
  }, [currentOrganization]);

  const loadAnalytics = async () => {
    if (!currentOrganization) return;

    try {
      setIsLoadingAnalytics(true);
      const analyticsData = await organizationService.getOrganizationAnalytics(currentOrganization.id);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const handleInviteMember = async (email: string, role: 'manager' | 'uploader' | 'analyst', quota: number) => {
    await inviteMember(email, role, quota);
  };

  const handleUpdateMemberRole = async (memberWallet: string, newRole: 'manager' | 'uploader' | 'analyst') => {
    try {
      const newQuota = organizationService.getDefaultUploadQuota(newRole);
      const newPermissions = organizationService.getDefaultPermissions(newRole);
      
      await updateMember(memberWallet, {
        role: newRole,
        uploadQuota: newQuota,
        permissions: newPermissions,
      });
    } catch (error) {
      console.error('Failed to update member role:', error);
    }
  };

  const handleRemoveMember = async (memberWallet: string, memberName?: string) => {
    const confirmMessage = `Are you sure you want to remove ${memberName || memberWallet} from the organization?`;
    if (confirm(confirmMessage)) {
      try {
        await removeMember(memberWallet);
      } catch (error) {
        console.error('Failed to remove member:', error);
      }
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-blue-100 text-blue-700';
      case 'manager': return 'bg-green-100 text-green-700';
      case 'uploader': return 'bg-yellow-100 text-yellow-700';
      case 'analyst': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const formatQuota = (quota: number, used: number) => {
    const quotaGB = quota / 1000;
    const usedGB = used / 1000;
    const percentage = quota > 0 ? (used / quota) * 100 : 0;
    
    return {
      display: `${usedGB.toFixed(1)} / ${quotaGB.toFixed(1)} GB`,
      percentage: Math.min(percentage, 100),
      isOverQuota: used > quota
    };
  };

  if (!isConnected || !isAuthenticated) {
    return (
      <div className="p-6">
        <PageHeader id="agencyDashboard" title="Agency Dashboard" />
        <EmptyState 
          icon="wallet"
          title="Connect Your Wallet" 
          subtitle="Connect and authenticate your wallet to access the agency dashboard." 
        />
      </div>
    );
  }

  if (!currentOrganization || currentOrganization.type === 'individual') {
    return (
      <div className="p-6">
        <PageHeader id="agencyDashboard" title="Agency Dashboard" />
        <EmptyState 
          icon="users"
          title="No Organization Selected" 
          subtitle="Select an agency or studio organization to view the dashboard." 
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader 
        id="agencyDashboard" 
        title={`${currentOrganization.name} Dashboard`}
        actions={
          canManageMembers() ? (
            <Button onClick={() => setShowInviteModal(true)}>
              <Icon name="user-plus" size={16} className="mr-2" />
              Invite Member
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700">
              <Icon name="alert-circle" size={20} />
              <span className="font-medium">Error</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearError}>
              <Icon name="x" size={16} />
            </Button>
          </div>
          <p className="text-red-600 mt-1">{error}</p>
        </div>
      )}

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Icon name="users" size={20} className="text-blue-600" />
              </div>
              <h3 className="font-medium text-gray-900">Active Members</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.activeMembers}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Icon name="upload" size={20} className="text-green-600" />
              </div>
              <h3 className="font-medium text-gray-900">Total Uploads</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.totalUploads.toLocaleString()}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Icon name="eye" size={20} className="text-purple-600" />
              </div>
              <h3 className="font-medium text-gray-900">Total Views</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.totalViews.toLocaleString()}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Icon name="dollar-sign" size={20} className="text-yellow-600" />
              </div>
              <h3 className="font-medium text-gray-900">Total Earnings</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">${analytics.totalEarnings.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Team Roster */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Team Roster</h3>
          <span className="text-sm text-gray-600">{organizationMembers.length} members</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Icon name="loader" size={32} className="animate-spin text-gray-400" />
          </div>
        ) : organizationMembers.length === 0 ? (
          <EmptyState 
            icon="users"
            title="No Team Members" 
            subtitle="Invite team members to start collaborating on content creation." 
          />
        ) : (
          <div className="space-y-3">
            {organizationMembers.map(member => {
              const quotaInfo = formatQuota(member.uploadQuota, member.quotaUsed);
              const isCurrentUser = member.wallet.toLowerCase() === currentMember?.wallet.toLowerCase();
              
              return (
                <div key={member.wallet} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white rounded-lg">
                      <Icon name="user" size={20} className="text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {member.name || member.wallet}
                          {isCurrentUser && <span className="text-gray-500">(You)</span>}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getRoleColor(member.role)}`}>
                          {member.role}
                        </span>
                        {!member.isActive && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{member.email}</span>
                        {member.uploadQuota > 0 && (
                          <span className={quotaInfo.isOverQuota ? 'text-red-600' : ''}>
                            Quota: {quotaInfo.display}
                          </span>
                        )}
                        {member.lastActive && (
                          <span>Last active: {new Date(member.lastActive).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {canManageMembers() && !isCurrentUser && (
                    <div className="flex items-center gap-2">
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateMemberRole(member.wallet, e.target.value as any)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="manager">Manager</option>
                        <option value="uploader">Uploader</option>
                        <option value="analyst">Analyst</option>
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveMember(member.wallet, member.name)}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Icon name="trash-2" size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInviteMember}
      />
    </div>
  );
};

export default AgencyDashboardPage;