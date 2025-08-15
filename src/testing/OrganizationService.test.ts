import { OrganizationService, Organization, OrganizationMember } from '../../services/organizationService';

// Mock fetch globally
global.fetch = jest.fn();

describe('OrganizationService', () => {
  let organizationService: OrganizationService;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    organizationService = OrganizationService.getInstance();
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getUserOrganizations', () => {
    it('should fetch user organizations successfully', async () => {
      const mockOrganizations: Organization[] = [
        {
          id: 'org1',
          name: 'Test Agency',
          type: 'agency',
          owner: '0x123',
          settings: {
            allowPublicProfile: true,
            requireTwoFactor: false,
            defaultUploadQuota: 5000,
            autoApproveUploads: true,
            enableBulkUpload: true,
            complianceLevel: 'standard',
            geoRestrictions: [],
            brandingColors: { primary: '#000', secondary: '#fff' }
          },
          memberCount: 5,
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockOrganizations })
      } as Response);

      const result = await organizationService.getUserOrganizations('0x123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/organizations/user/0x123',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        })
      );
      expect(result).toEqual(mockOrganizations);
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      } as Response);

      await expect(organizationService.getUserOrganizations('0x123'))
        .rejects.toThrow('Failed to load organizations');
    });
  });

  describe('createOrganization', () => {
    it('should create organization successfully', async () => {
      const orgData = {
        name: 'New Agency',
        type: 'agency' as const,
        description: 'Test description'
      };

      const mockOrganization: Organization = {
        id: 'org2',
        name: 'New Agency',
        type: 'agency',
        owner: '0x123',
        description: 'Test description',
        settings: {
          allowPublicProfile: true,
          requireTwoFactor: false,
          defaultUploadQuota: 5000,
          autoApproveUploads: true,
          enableBulkUpload: true,
          complianceLevel: 'standard',
          geoRestrictions: [],
          brandingColors: { primary: '#000', secondary: '#fff' }
        },
        memberCount: 1,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockOrganization })
      } as Response);

      const result = await organizationService.createOrganization(orgData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/organizations',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orgData),
          credentials: 'include'
        })
      );
      expect(result).toEqual(mockOrganization);
    });

    it('should throw error when creation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Organization name already exists' })
      } as Response);

      await expect(organizationService.createOrganization({
        name: 'Existing Agency',
        type: 'agency'
      })).rejects.toThrow('Organization name already exists');
    });
  });

  describe('inviteMember', () => {
    it('should invite member successfully', async () => {
      const inviteData = {
        email: 'test@example.com',
        role: 'uploader' as const,
        uploadQuota: 5000
      };

      const mockInvite = {
        id: 'invite1',
        organizationId: 'org1',
        email: 'test@example.com',
        role: 'uploader',
        permissions: [],
        uploadQuota: 5000,
        invitedBy: '0x123',
        invitedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-08T00:00:00Z',
        status: 'pending',
        magicLink: 'https://example.com/invite/123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockInvite })
      } as Response);

      const result = await organizationService.inviteMember('org1', inviteData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/organizations/org1/invite',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inviteData),
          credentials: 'include'
        })
      );
      expect(result).toEqual(mockInvite);
    });
  });

  describe('getOrganizationMembers', () => {
    it('should fetch organization members successfully', async () => {
      const mockMembers: OrganizationMember[] = [
        {
          id: 'member1',
          organizationId: 'org1',
          wallet: '0x123',
          email: 'owner@example.com',
          name: 'Owner',
          role: 'owner',
          permissions: [],
          uploadQuota: 10000,
          quotaUsed: 2000,
          isActive: true,
          invitedBy: '0x123',
          invitedAt: '2024-01-01T00:00:00Z',
          joinedAt: '2024-01-01T00:00:00Z'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockMembers })
      } as Response);

      const result = await organizationService.getOrganizationMembers('org1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/organizations/org1/members',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        })
      );
      expect(result).toEqual(mockMembers);
    });
  });

  describe('hasPermission', () => {
    it('should return true for owner role', () => {
      const member: OrganizationMember = {
        id: 'member1',
        organizationId: 'org1',
        wallet: '0x123',
        role: 'owner',
        permissions: [],
        uploadQuota: 10000,
        quotaUsed: 0,
        isActive: true,
        invitedBy: '0x123',
        invitedAt: '2024-01-01T00:00:00Z'
      };

      const result = organizationService.hasPermission(member, 'content', 'write');
      expect(result).toBe(true);
    });

    it('should check specific permissions for non-owner roles', () => {
      const member: OrganizationMember = {
        id: 'member1',
        organizationId: 'org1',
        wallet: '0x456',
        role: 'uploader',
        permissions: [
          { resource: 'content', actions: ['read', 'write'] }
        ],
        uploadQuota: 5000,
        quotaUsed: 0,
        isActive: true,
        invitedBy: '0x123',
        invitedAt: '2024-01-01T00:00:00Z'
      };

      expect(organizationService.hasPermission(member, 'content', 'write')).toBe(true);
      expect(organizationService.hasPermission(member, 'content', 'delete')).toBe(false);
      expect(organizationService.hasPermission(member, 'members', 'write')).toBe(false);
    });
  });

  describe('getDefaultPermissions', () => {
    it('should return correct permissions for manager role', () => {
      const permissions = organizationService.getDefaultPermissions('manager');
      
      expect(permissions).toContainEqual({
        resource: 'content',
        actions: ['read', 'write', 'delete', 'manage']
      });
      expect(permissions).toContainEqual({
        resource: 'members',
        actions: ['read', 'write']
      });
    });

    it('should return correct permissions for uploader role', () => {
      const permissions = organizationService.getDefaultPermissions('uploader');
      
      expect(permissions).toContainEqual({
        resource: 'content',
        actions: ['read', 'write']
      });
      expect(permissions.find(p => p.resource === 'members')).toBeUndefined();
    });

    it('should return correct permissions for analyst role', () => {
      const permissions = organizationService.getDefaultPermissions('analyst');
      
      expect(permissions).toContainEqual({
        resource: 'content',
        actions: ['read']
      });
      expect(permissions).toContainEqual({
        resource: 'analytics',
        actions: ['read']
      });
    });
  });

  describe('getDefaultUploadQuota', () => {
    it('should return correct quotas for different roles', () => {
      expect(organizationService.getDefaultUploadQuota('manager')).toBe(10000);
      expect(organizationService.getDefaultUploadQuota('uploader')).toBe(5000);
      expect(organizationService.getDefaultUploadQuota('analyst')).toBe(0);
    });
  });
});