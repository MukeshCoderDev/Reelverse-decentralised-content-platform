import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Header from '../../components/Header';
import { AgeVerificationService } from '../../services/ageVerificationService';

// Mock the services and contexts
jest.mock('../../services/ageVerificationService');
jest.mock('../../contexts/WalletContext', () => ({
  useWallet: jest.fn(),
}));

const MockedAgeVerificationService = AgeVerificationService as jest.Mocked<typeof AgeVerificationService>;
const { useWallet } = require('../../contexts/WalletContext');

describe('Header Component', () => {
  let mockAgeVerificationService: jest.Mocked<AgeVerificationService>;

  beforeEach(() => {
    mockAgeVerificationService = {
      getVerificationStatus: jest.fn(),
    } as any;

    MockedAgeVerificationService.getInstance.mockReturnValue(mockAgeVerificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render header with title', () => {
    useWallet.mockReturnValue({
      isConnected: false,
      isAuthenticated: false,
      account: null,
    });

    render(<Header title="Test Page" />);
    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('should show authentication badge when wallet is authenticated', () => {
    useWallet.mockReturnValue({
      isConnected: true,
      isAuthenticated: true,
      account: '0x1234567890123456789012345678901234567890',
    });

    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'none',
      provider: 'persona',
    });

    render(<Header title="Test Page" />);
    expect(screen.getByText('Authenticated')).toBeInTheDocument();
  });

  it('should show age verified badge when age verification is complete', async () => {
    useWallet.mockReturnValue({
      isConnected: true,
      isAuthenticated: true,
      account: '0x1234567890123456789012345678901234567890',
    });

    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'verified',
      provider: 'persona',
      verifiedAt: '2024-01-15T10:00:00Z',
    });

    render(<Header title="Test Page" />);

    await waitFor(() => {
      expect(screen.getByText('Age Verified')).toBeInTheDocument();
    });
  });

  it('should show verify age badge when age verification is not complete', async () => {
    useWallet.mockReturnValue({
      isConnected: true,
      isAuthenticated: true,
      account: '0x1234567890123456789012345678901234567890',
    });

    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'none',
      provider: 'persona',
    });

    render(<Header title="Test Page" />);

    await waitFor(() => {
      expect(screen.getByText('Verify Age')).toBeInTheDocument();
    });
  });

  it('should show unverified talent badge when age is verified but talent is not', async () => {
    useWallet.mockReturnValue({
      isConnected: true,
      isAuthenticated: true,
      account: '0x1234567890123456789012345678901234567890',
    });

    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'verified',
      provider: 'persona',
      verifiedAt: '2024-01-15T10:00:00Z',
    });

    render(<Header title="Test Page" />);

    await waitFor(() => {
      expect(screen.getByText('Age Verified')).toBeInTheDocument();
      expect(screen.getByText('Unverified')).toBeInTheDocument();
    });
  });

  it('should show loading state while checking verification status', async () => {
    useWallet.mockReturnValue({
      isConnected: true,
      isAuthenticated: true,
      account: '0x1234567890123456789012345678901234567890',
    });

    // Mock a delayed response
    mockAgeVerificationService.getVerificationStatus.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        address: '0x1234567890123456789012345678901234567890',
        status: 'verified',
        provider: 'persona',
        verifiedAt: '2024-01-15T10:00:00Z',
      }), 100))
    );

    render(<Header title="Test Page" />);

    // Should show loading state initially
    expect(screen.getByText('Checking...')).toBeInTheDocument();

    // Should show verified state after loading
    await waitFor(() => {
      expect(screen.getByText('Age Verified')).toBeInTheDocument();
    });
  });

  it('should not show verification badges when wallet is not connected', () => {
    useWallet.mockReturnValue({
      isConnected: false,
      isAuthenticated: false,
      account: null,
    });

    render(<Header title="Test Page" />);

    expect(screen.queryByText('Authenticated')).not.toBeInTheDocument();
    expect(screen.queryByText('Age Verified')).not.toBeInTheDocument();
    expect(screen.queryByText('Verify Age')).not.toBeInTheDocument();
  });

  it('should handle verification status loading error gracefully', async () => {
    useWallet.mockReturnValue({
      isConnected: true,
      isAuthenticated: true,
      account: '0x1234567890123456789012345678901234567890',
    });

    mockAgeVerificationService.getVerificationStatus.mockRejectedValue(
      new Error('Service unavailable')
    );

    render(<Header title="Test Page" />);

    await waitFor(() => {
      // Should show verify age badge as fallback when loading fails
      expect(screen.getByText('Verify Age')).toBeInTheDocument();
    });
  });

  it('should reload verification status when account changes', async () => {
    const { rerender } = render(<Header title="Test Page" />);

    // Initially not connected
    useWallet.mockReturnValue({
      isConnected: false,
      isAuthenticated: false,
      account: null,
    });

    rerender(<Header title="Test Page" />);

    // Connect wallet
    useWallet.mockReturnValue({
      isConnected: true,
      isAuthenticated: true,
      account: '0x1234567890123456789012345678901234567890',
    });

    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'verified',
      provider: 'persona',
      verifiedAt: '2024-01-15T10:00:00Z',
    });

    rerender(<Header title="Test Page" />);

    await waitFor(() => {
      expect(mockAgeVerificationService.getVerificationStatus).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890'
      );
    });
  });
});