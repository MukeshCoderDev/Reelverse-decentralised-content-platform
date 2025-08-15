import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlayerGuard } from '../PlayerGuard';
import { useWallet } from '../../../contexts/WalletContext';
import { ContentAccessService } from '../../../services/contentAccessService';
import { AgeVerificationService } from '../../../services/ageVerificationService';

// Mock the wallet context
jest.mock('../../../contexts/WalletContext');
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

// Mock the services
jest.mock('../../../services/contentAccessService');
jest.mock('../../../services/ageVerificationService');

const mockContentAccessService = {
  checkAccess: jest.fn(),
  getInstance: jest.fn()
};
const mockAgeVerificationService = {
  getVerificationStatus: jest.fn(),
  getInstance: jest.fn()
};

(ContentAccessService.getInstance as jest.Mock).mockReturnValue(mockContentAccessService);
(AgeVerificationService.getInstance as jest.Mock).mockReturnValue(mockAgeVerificationService);

// Mock the AgeVerificationModal
jest.mock('../../AgeVerificationModal', () => ({
  AgeVerificationModal: ({ isOpen, onClose, onVerified }: any) => 
    isOpen ? (
      <div data-testid="age-verification-modal">
        <button onClick={() => onVerified({ status: 'verified' })}>Complete Verification</button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
}));

describe('PlayerGuard', () => {
  const mockWalletState = {
    isConnected: false,
    account: null,
    isAuthenticated: false
  };

  const TestContent = () => <div data-testid="protected-content">Protected Video Content</div>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWallet.mockReturnValue(mockWalletState as any);
  });

  it('renders content without restrictions for free, non-adult content', async () => {
    mockContentAccessService.checkAccess.mockResolvedValue({
      contentId: 'test-content',
      ageOk: true,
      geoOk: true,
      hasEntitlement: true,
      moderationStatus: 'approved'
    });

    render(
      <PlayerGuard contentId="test-content" isAdultContent={false} requiresEntitlement={false}>
        <TestContent />
      </PlayerGuard>
    );

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  it('shows wallet connection prompt when wallet not connected', async () => {
    render(
      <PlayerGuard contentId="test-content" isAdultContent={true}>
        <TestContent />
      </PlayerGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Wallet Required')).toBeInTheDocument();
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    });
  });

  it('shows authentication prompt when wallet connected but not authenticated', async () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x123'
    } as any);

    mockContentAccessService.checkAccess.mockResolvedValue({
      contentId: 'test-content',
      ageOk: true,
      geoOk: true,
      hasEntitlement: true,
      moderationStatus: 'approved'
    });

    render(
      <PlayerGuard contentId="test-content" isAdultContent={true}>
        <TestContent />
      </PlayerGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Authentication Required')).toBeInTheDocument();
      expect(screen.getByText('Authenticate with Ethereum')).toBeInTheDocument();
    });
  });

  it('shows age verification prompt for adult content', async () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x123',
      isAuthenticated: true
    } as any);

    mockContentAccessService.checkAccess.mockResolvedValue({
      contentId: 'test-content',
      ageOk: true,
      geoOk: true,
      hasEntitlement: true,
      moderationStatus: 'approved'
    });

    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      status: 'none',
      address: '0x123',
      provider: 'persona'
    });

    render(
      <PlayerGuard contentId="test-content" isAdultContent={true} ageRating="18+">
        <TestContent />
      </PlayerGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('18+ Content')).toBeInTheDocument();
      expect(screen.getByText('Verify Age (18+)')).toBeInTheDocument();
    });
  });

  it('shows geographic restriction message', async () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x123',
      isAuthenticated: true
    } as any);

    mockContentAccessService.checkAccess.mockResolvedValue({
      contentId: 'test-content',
      ageOk: true,
      geoOk: false,
      hasEntitlement: true,
      moderationStatus: 'approved'
    });

    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      status: 'verified',
      address: '0x123',
      provider: 'persona'
    });

    render(
      <PlayerGuard contentId="test-content" isAdultContent={true}>
        <TestContent />
      </PlayerGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Not Available in Your Region')).toBeInTheDocument();
    });
  });

  it('shows payment prompt for premium content', async () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x123',
      isAuthenticated: true
    } as any);

    mockContentAccessService.checkAccess.mockResolvedValue({
      contentId: 'test-content',
      ageOk: true,
      geoOk: true,
      hasEntitlement: false,
      moderationStatus: 'approved'
    });

    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      status: 'verified',
      address: '0x123',
      provider: 'persona'
    });

    render(
      <PlayerGuard 
        contentId="test-content" 
        requiresEntitlement={true}
        priceUSDC={5000000}
        priceFiat={4.99}
      >
        <TestContent />
      </PlayerGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Premium Content')).toBeInTheDocument();
      expect(screen.getByText('Pay with USDC ($5.00)')).toBeInTheDocument();
      expect(screen.getByText('Pay with Card ($4.99)')).toBeInTheDocument();
    });
  });

  it('shows moderated content message', async () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x123',
      isAuthenticated: true
    } as any);

    mockContentAccessService.checkAccess.mockResolvedValue({
      contentId: 'test-content',
      ageOk: true,
      geoOk: true,
      hasEntitlement: true,
      moderationStatus: 'blocked'
    });

    render(
      <PlayerGuard contentId="test-content">
        <TestContent />
      </PlayerGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Content Unavailable')).toBeInTheDocument();
    });
  });

  it('opens age verification modal when verify button clicked', async () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x123',
      isAuthenticated: true
    } as any);

    mockContentAccessService.checkAccess.mockResolvedValue({
      contentId: 'test-content',
      ageOk: true,
      geoOk: true,
      hasEntitlement: true,
      moderationStatus: 'approved'
    });

    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      status: 'none',
      address: '0x123',
      provider: 'persona'
    });

    render(
      <PlayerGuard contentId="test-content" isAdultContent={true}>
        <TestContent />
      </PlayerGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Verify Age (18+)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Verify Age (18+)'));

    expect(screen.getByTestId('age-verification-modal')).toBeInTheDocument();
  });

  it('renders content after successful age verification', async () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x123',
      isAuthenticated: true
    } as any);

    // First call returns unverified, second call (after verification) returns verified
    mockContentAccessService.checkAccess
      .mockResolvedValueOnce({
        contentId: 'test-content',
        ageOk: true,
        geoOk: true,
        hasEntitlement: true,
        moderationStatus: 'approved'
      })
      .mockResolvedValueOnce({
        contentId: 'test-content',
        ageOk: true,
        geoOk: true,
        hasEntitlement: true,
        moderationStatus: 'approved'
      });

    mockAgeVerificationService.getVerificationStatus
      .mockResolvedValueOnce({
        status: 'none',
        address: '0x123',
        provider: 'persona'
      });

    render(
      <PlayerGuard contentId="test-content" isAdultContent={true}>
        <TestContent />
      </PlayerGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Verify Age (18+)')).toBeInTheDocument();
    });

    // Open and complete verification
    fireEvent.click(screen.getByText('Verify Age (18+)'));
    fireEvent.click(screen.getByText('Complete Verification'));

    // Should reload access and show content
    await waitFor(() => {
      expect(mockContentAccessService.checkAccess).toHaveBeenCalledTimes(2);
    });
  });

  it('shows loading state while checking access', () => {
    mockContentAccessService.checkAccess.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <PlayerGuard contentId="test-content">
        <TestContent />
      </PlayerGuard>
    );

    expect(screen.getByText('Checking access permissions...')).toBeInTheDocument();
  });
});