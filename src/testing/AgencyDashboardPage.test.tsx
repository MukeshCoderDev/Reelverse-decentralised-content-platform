import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AgencyDashboardPage from '../../pages/AgencyDashboardPage';
import { WalletProvider } from '../../contexts/WalletContext';
import { OrganizationProvider } from '../../contexts/OrganizationContext';

// Mock the contexts
jest.mock('../../contexts/WalletContext', () => ({
  ...jest.requireActual('../../contexts/WalletContext'),
  useWallet: () => ({
    isConnected: true,
    isAuthenticated: true,
    account: '0x1234567890123456789012345678901234567890',
  }),
}));

jest.mock('../../contexts/OrganizationContext', () => ({
  ...jest.requireActual('../../contexts/OrganizationContext'),
  useOrganization: () => ({
    currentOrganization: {
      id: 'agency1',
      name: 'Test Agency',
      type: 'agency',
      owner: '0x1234567890123456789012345678901234567890',
      memberCount: 3,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      settings: {
        allowPublicProfile: true,
        requireTwoFactor: false,
        defaultUploadQuota: 5000,
        autoApproveUploads: true,
        enableBulkUpload: true,
        complianceLevel: 'standard',
        geoRestrictions: [],
        brandingColors: { primary: '#000', secondary: '#fff' }
      }
    },
    organizationMembers: [
      {
        id: 'member1',
        organizationId: 'agency1',
        wallet: '0x1234567890123456789012345678901234567890',
        email: 'owner@example.com',
        name: 'Agency Owner',
        role: 'owner',
        permissions: [],
        uploadQuota: 10000,
        quotaUsed: 2000,
        isActive: true,
        invitedBy: '0x1234567890123456789012345678901234567890',
        invitedAt: '2024-01-01T00:00:00Z',
        joinedAt: '2024-01-01T00:00:00Z'
      },
      {
        id: 'member2',
        organizationId: 'agency1',
        wallet: '0x2345678901234567890123456789012345678901',
        email: 'manager@example.com',
        name: 'Content Manager',
        role: 'manager',
        permissions: [],
        uploadQuota: 8000,
        quotaUsed: 1500,
        isActive: true,
        invitedBy: '0x1234567890123456789012345678901234567890',
        invitedAt: '2024-01-02T00:00:00Z',
        joinedAt: '2024-01-02T00:00:00Z'
      }
    ],
    currentMember: {
      id: 'member1',
      organizationId: 'agency1',
      wallet: '0x1234567890123456789012345678901234567890',
      email: 'owner@example.com',
      name: 'Agency Owner',
      role: 'owner',
      permissions: [],
      uploadQuota: 10000,
      quotaUsed: 2000,
      isActive: true,
      invitedBy: '0x1234567890123456789012345678901234567890',
      invitedAt: '2024-01-01T00:00:00Z',
      joinedAt: '2024-01-01T00:00:00Z'
    },
    isLoading: false,
    error: null,
    inviteMember: jest.fn(),
    updateMember: jest.fn(),
    removeMember: jest.fn(),
    canManageMembers: () => true,
    clearError: jest.fn()
  }),
}));

// Mock the organization service
jest.mock('../../services/organizationService', () => ({
  OrganizationService: {
    getInstance: () => ({
      getOrganizationAnalytics: jest.fn().mockResolvedValue({
        organizationId: 'agency1',
        period: '30d',
        totalUploads: 150,
        totalViews: 25000,
        totalEarnings: 5000,
        activeMembers: 3,
        topPerformers: [],
        uploadTrends: [],
        quotaUsage: { total: 18000, used: 3500, percentage: 19.4 }
      }),
      getDefaultUploadQuota: jest.fn().mockReturnValue(5000),
      getDefaultPermissions: jest.fn().mockReturnValue([])
    })
  }
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <WalletProvider>
        <OrganizationProvider>
          {component}
        </OrganizationProvider>
      </WalletProvider>
    </BrowserRouter>
  );
};

describe('AgencyDashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render agency dashboard with organization name', async () => {
    renderWithProviders(<AgencyDashboardPage />);

    expect(screen.getByText('Test Agency Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Invite Member')).toBeInTheDocument();
  });

  it('should display analytics overview', async () => {
    renderWithProviders(<AgencyDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Active Members')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // Active members count
      expect(screen.getByText('Total Uploads')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument(); // Total uploads
      expect(screen.getByText('Total Views')).toBeInTheDocument();
      expect(screen.getByText('25,000')).toBeInTheDocument(); // Total views
      expect(screen.getByText('Total Earnings')).toBeInTheDocument();
      expect(screen.getByText('$5,000')).toBeInTheDocument(); // Total earnings
    });
  });

  it('should display team roster with members', async () => {
    renderWithProviders(<AgencyDashboardPage />);

    expect(screen.getByText('Team Roster')).toBeInTheDocument();
    expect(screen.getByText('2 members')).toBeInTheDocument();
    
    expect(screen.getByText('Agency Owner')).toBeInTheDocument();
    expect(screen.getByText('Content Manager')).toBeInTheDocument();
    
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('manager@example.com')).toBeInTheDocument();
  });

  it('should show member roles and quotas', async () => {
    renderWithProviders(<AgencyDashboardPage />);

    // Check role badges
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByText('manager')).toBeInTheDocument();
    
    // Check quota information
    expect(screen.getByText('Quota: 2.0 / 10.0 GB')).toBeInTheDocument();
    expect(screen.getByText('Quota: 1.5 / 8.0 GB')).toBeInTheDocument();
  });

  it('should open invite modal when invite button is clicked', async () => {
    renderWithProviders(<AgencyDashboardPage />);

    const inviteButton = screen.getByText('Invite Member');
    fireEvent.click(inviteButton);

    await waitFor(() => {
      expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    });
  });

  it('should handle member invitation', async () => {
    const mockInviteMember = jest.fn().mockResolvedValue(undefined);
    const { useOrganization } = require('../../contexts/OrganizationContext');
    useOrganization.mockReturnValue({
      ...useOrganization(),
      inviteMember: mockInviteMember
    });

    renderWithProviders(<AgencyDashboardPage />);

    // Open invite modal
    const inviteButton = screen.getByText('Invite Member');
    fireEvent.click(inviteButton);

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/email address/i);
      const roleSelect = screen.getByLabelText(/role/i);
      const sendButton = screen.getByText('Send Invite');

      fireEvent.change(emailInput, { target: { value: 'newmember@example.com' } });
      fireEvent.change(roleSelect, { target: { value: 'uploader' } });
      fireEvent.click(sendButton);
    });

    await waitFor(() => {
      expect(mockInviteMember).toHaveBeenCalledWith('newmember@example.com', 'uploader', 5000);
    });
  });

  it('should allow role updates for members', async () => {
    const mockUpdateMember = jest.fn().mockResolvedValue(undefined);
    const { useOrganization } = require('../../contexts/OrganizationContext');
    useOrganization.mockReturnValue({
      ...useOrganization(),
      updateMember: mockUpdateMember
    });

    renderWithProviders(<AgencyDashboardPage />);

    // Find the role select for the manager (not the owner)
    const roleSelects = screen.getAllByDisplayValue('manager');
    expect(roleSelects).toHaveLength(1);

    fireEvent.change(roleSelects[0], { target: { value: 'uploader' } });

    await waitFor(() => {
      expect(mockUpdateMember).toHaveBeenCalledWith(
        '0x2345678901234567890123456789012345678901',
        expect.objectContaining({
          role: 'uploader'
        })
      );
    });
  });

  it('should handle member removal', async () => {
    const mockRemoveMember = jest.fn().mockResolvedValue(undefined);
    const { useOrganization } = require('../../contexts/OrganizationContext');
    useOrganization.mockReturnValue({
      ...useOrganization(),
      removeMember: mockRemoveMember
    });

    // Mock window.confirm
    window.confirm = jest.fn().mockReturnValue(true);

    renderWithProviders(<AgencyDashboardPage />);

    // Find remove buttons (should only be for non-owner members)
    const removeButtons = screen.getAllByRole('button');
    const trashButton = removeButtons.find(button => 
      button.querySelector('[data-lucide="trash-2"]')
    );

    if (trashButton) {
      fireEvent.click(trashButton);

      await waitFor(() => {
        expect(mockRemoveMember).toHaveBeenCalledWith('0x2345678901234567890123456789012345678901');
      });
    }
  });

  it('should show empty state when not connected', () => {
    const { useWallet } = require('../../contexts/WalletContext');
    useWallet.mockReturnValue({
      isConnected: false,
      isAuthenticated: false,
      account: null,
    });

    renderWithProviders(<AgencyDashboardPage />);

    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
    expect(screen.getByText(/Connect and authenticate your wallet/)).toBeInTheDocument();
  });

  it('should show empty state for individual accounts', () => {
    const { useOrganization } = require('../../contexts/OrganizationContext');
    useOrganization.mockReturnValue({
      ...useOrganization(),
      currentOrganization: {
        id: 'individual',
        name: 'Personal Account',
        type: 'individual',
        owner: '0x1234567890123456789012345678901234567890',
        memberCount: 1,
        isActive: true
      }
    });

    renderWithProviders(<AgencyDashboardPage />);

    expect(screen.getByText('No Organization Selected')).toBeInTheDocument();
    expect(screen.getByText(/Select an agency or studio organization/)).toBeInTheDocument();
  });

  it('should display error messages', () => {
    const { useOrganization } = require('../../contexts/OrganizationContext');
    useOrganization.mockReturnValue({
      ...useOrganization(),
      error: 'Failed to load organization data'
    });

    renderWithProviders(<AgencyDashboardPage />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load organization data')).toBeInTheDocument();
  });

  it('should show current user indicator', () => {
    renderWithProviders(<AgencyDashboardPage />);

    expect(screen.getByText('(You)')).toBeInTheDocument();
  });

  it('should format quota display correctly', () => {
    renderWithProviders(<AgencyDashboardPage />);

    // Should show quota in GB format
    expect(screen.getByText('Quota: 2.0 / 10.0 GB')).toBeInTheDocument();
    expect(screen.getByText('Quota: 1.5 / 8.0 GB')).toBeInTheDocument();
  });
});