/**
 * Organization Service
 * Handles agency/studio organization management and member operations
 */

export interface Organization {
  id: string;
  name: string;
  type: 'individual' | 'agency' | 'studio';
  owner: string; // wallet address
  description?: string;
  website?: string;
  logo?: string;
  settings: OrganizationSettings;
  memberCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  wallet: string;
  email?: string;
  name?: string;
  role: 'owner' | 'manager' | 'uploader' | 'analyst';
  permissions: Permission[];
  uploadQuota: number; // MB per month
  quotaUsed: number;
  isActive: boolean;
  invitedBy: string;
  invitedAt: string;
  joinedAt?: string;
  lastActive?: string;
}

export interface OrganizationInvite {
  id: string;
  organizationId: string;
  email: string;
  role: 'manager' | 'uploader' | 'analyst';
  permissions: Permission[];
  uploadQuota: number;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  magicLink: string;
}

export interface OrganizationSettings {
  allowPublicProfile: boolean;
  requireTwoFactor: boolean;
  defaultUploadQuota: number;
  autoApproveUploads: boolean;
  enableBulkUpload: boolean;
  complianceLevel: 'basic' | 'standard' | 'strict';
  geoRestrictions: string[];
  brandingColors: {
    primary: string;
    secondary: string;
  };
}

export interface Permission {
  resource: 'content' | 'members' | 'analytics' | 'settings' | 'compliance' | 'billing';
  actions: ('read' | 'write' | 'delete' | 'manage')[];
}

export interface OrganizationAnalytics {
  organizationId: string;
  period: string;
  totalUploads: number;
  totalViews: number;
  totalEarnings: number;
  activeMembers: number;
  topPerformers: Array<{
    wallet: string;
    name?: string;
    uploads: number;
    views: number;
    earnings: number;
  }>;
  uploadTrends: Array<{
    date: string;
    uploads: number;
    views: number;
  }>;
  quotaUsage: {
    total: number;
    used: number;
    percentage: number;
  };
}

export class OrganizationService {
  private static instance: OrganizationService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  public static getInstance(): OrganizationService {
    if (!OrganizationService.instance) {
      OrganizationService.instance = new OrganizationService();
    }
    return OrganizationService.instance;
  }

  /**
   * Get organizations for current user
   */
  async getUserOrganizations(wallet: string): Promise<Organization[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/organizations/user/${wallet}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to get organizations: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting user organizations:', error);
      throw new Error('Failed to load organizations');
    }
  }

  /**
   * Create new organization
   */
  async createOrganization(orgData: {
    name: string;
    type: 'agency' | 'studio';
    description?: string;
    website?: string;
  }): Promise<Organization> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orgData),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create organization: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error creating organization:', error);
      throw error;
    }
  }

  /**
   * Get organization details
   */
  async getOrganization(orgId: string): Promise<Organization> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/organizations/${orgId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to get organization: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting organization:', error);
      throw new Error('Failed to load organization');
    }
  }

  /**
   * Update organization
   */
  async updateOrganization(orgId: string, updates: Partial<Organization>): Promise<Organization> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/organizations/${orgId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update organization: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error updating organization:', error);
      throw error;
    }
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/organizations/${orgId}/members`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to get members: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting organization members:', error);
      throw new Error('Failed to load members');
    }
  }

  /**
   * Invite member to organization
   */
  async inviteMember(orgId: string, inviteData: {
    email: string;
    role: 'manager' | 'uploader' | 'analyst';
    uploadQuota?: number;
    permissions?: Permission[];
  }): Promise<OrganizationInvite> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/organizations/${orgId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inviteData),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to invite member: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error inviting member:', error);
      throw error;
    }
  }

  /**
   * Accept organization invite
   */
  async acceptInvite(inviteId: string, wallet: string): Promise<OrganizationMember> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/organizations/invite/${inviteId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wallet }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to accept invite: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error accepting invite:', error);
      throw error;
    }
  }

  /**
   * Update member role/permissions
   */
  async updateMember(orgId: string, memberWallet: string, updates: {
    role?: 'manager' | 'uploader' | 'analyst';
    permissions?: Permission[];
    uploadQuota?: number;
    isActive?: boolean;
  }): Promise<OrganizationMember> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/organizations/${orgId}/members/${memberWallet}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update member: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error updating member:', error);
      throw error;
    }
  }

  /**
   * Remove member from organization
   */
  async removeMember(orgId: string, memberWallet: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/organizations/${orgId}/members/${memberWallet}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to remove member: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      throw error;
    }
  }

  /**
   * Get organization analytics
   */
  async getOrganizationAnalytics(orgId: string, period: '7d' | '30d' | '90d' = '30d'): Promise<OrganizationAnalytics> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/organizations/${orgId}/analytics?period=${period}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to get analytics: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting organization analytics:', error);
      throw new Error('Failed to load analytics');
    }
  }

  /**
   * Check user permissions in organization
   */
  hasPermission(member: OrganizationMember, resource: string, action: string): boolean {
    // Owner has all permissions
    if (member.role === 'owner') {
      return true;
    }

    // Check specific permissions
    const permission = member.permissions.find(p => p.resource === resource);
    return permission ? permission.actions.includes(action as any) : false;
  }

  /**
   * Get default permissions for role
   */
  getDefaultPermissions(role: 'manager' | 'uploader' | 'analyst'): Permission[] {
    const basePermissions: Record<string, Permission[]> = {
      manager: [
        { resource: 'content', actions: ['read', 'write', 'delete', 'manage'] },
        { resource: 'members', actions: ['read', 'write'] },
        { resource: 'analytics', actions: ['read'] },
        { resource: 'settings', actions: ['read'] },
        { resource: 'compliance', actions: ['read', 'write'] },
      ],
      uploader: [
        { resource: 'content', actions: ['read', 'write'] },
        { resource: 'analytics', actions: ['read'] },
        { resource: 'compliance', actions: ['read'] },
      ],
      analyst: [
        { resource: 'content', actions: ['read'] },
        { resource: 'analytics', actions: ['read'] },
        { resource: 'compliance', actions: ['read'] },
      ],
    };

    return basePermissions[role] || [];
  }

  /**
   * Get default upload quota for role (in MB)
   */
  getDefaultUploadQuota(role: 'manager' | 'uploader' | 'analyst'): number {
    const quotas = {
      manager: 10000, // 10GB
      uploader: 5000,  // 5GB
      analyst: 0,      // No upload access
    };

    return quotas[role] || 0;
  }
}