import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import StudioVerifyPage from '../../pages/studio/StudioVerifyPage';
import { WalletProvider } from '../../contexts/WalletContext';
import { AgeVerificationService } from '../../services/ageVerificationService';

// Mock the services
jest.mock('../../services/ageVerificationService');
jest.mock('../../contexts/WalletContext', () => ({
  ...jest.requireActual('../../contexts/WalletContext'),
  useWallet: () => ({
    isConnected: true,
    account: '0x1234567890123456789012345678901234567890',
    isAuthenticated: true,
  }),
}));

const MockedAgeVerificationService = AgeVerificationService as jest.Mocked<typeof AgeVerificationService>;

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <WalletProvider>
        {component}
      </WalletProvider>
    </BrowserRouter>
  );
};

describe('StudioVerifyPage', () => {
  let mockAgeVerificationService: jest.Mocked<AgeVerificationService>;

  beforeEach(() => {
    mockAgeVerificationService = {
      getVerificationStatus: jest.fn(),
      completeVerification: jest.fn(),
    } as any;

    MockedAgeVerificationService.getInstance.mockReturnValue(mockAgeVerificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render verification page with both age and talent sections', async () => {
    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'none',
      provider: 'persona',
    });

    renderWithProviders(<StudioVerifyPage />);

    expect(screen.getByText('Creator Verification')).toBeInTheDocument();
    expect(screen.getByText('Age Verification')).toBeInTheDocument();
    expect(screen.getByText('Talent Verification')).toBeInTheDocument();
    expect(screen.getByText('Verification Benefits')).toBeInTheDocument();
  });

  it('should show age verification as not started initially', async () => {
    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'none',
      provider: 'persona',
    });

    renderWithProviders(<StudioVerifyPage />);

    await waitFor(() => {
      expect(screen.getByText('Start Age Verification')).toBeInTheDocument();
    });
  });

  it('should show age verification as verified when completed', async () => {
    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'verified',
      provider: 'persona',
      verifiedAt: '2024-01-15T10:00:00Z',
      sbTokenId: 'sbt_123',
    });

    renderWithProviders(<StudioVerifyPage />);

    await waitFor(() => {
      expect(screen.getByText('Age Verification Complete')).toBeInTheDocument();
      expect(screen.getByText('SBT Token ID: sbt_123')).toBeInTheDocument();
    });
  });

  it('should show age verification as pending when in progress', async () => {
    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'pending',
      provider: 'persona',
    });

    renderWithProviders(<StudioVerifyPage />);

    await waitFor(() => {
      expect(screen.getByText('Age Verification In Progress')).toBeInTheDocument();
    });
  });

  it('should show age verification as failed with reason', async () => {
    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'failed',
      provider: 'persona',
      failureReason: 'Document not clear',
    });

    renderWithProviders(<StudioVerifyPage />);

    await waitFor(() => {
      expect(screen.getByText('Age Verification Failed')).toBeInTheDocument();
      expect(screen.getByText('Document not clear')).toBeInTheDocument();
    });
  });

  it('should disable talent verification when age verification is not complete', async () => {
    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'none',
      provider: 'persona',
    });

    renderWithProviders(<StudioVerifyPage />);

    await waitFor(() => {
      expect(screen.getByText('Age Verification Required')).toBeInTheDocument();
      expect(screen.getByText('Complete age verification first to unlock talent verification.')).toBeInTheDocument();
    });
  });

  it('should enable talent verification when age verification is complete', async () => {
    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'verified',
      provider: 'persona',
      verifiedAt: '2024-01-15T10:00:00Z',
    });

    renderWithProviders(<StudioVerifyPage />);

    await waitFor(() => {
      expect(screen.getByText('Start Talent Verification')).toBeInTheDocument();
    });
  });

  it('should start age verification when button is clicked', async () => {
    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'none',
      provider: 'persona',
    });

    mockAgeVerificationService.completeVerification.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'verified',
      provider: 'persona',
      verifiedAt: '2024-01-15T10:00:00Z',
    });

    renderWithProviders(<StudioVerifyPage />);

    await waitFor(() => {
      const startButton = screen.getByText('Start Age Verification');
      expect(startButton).toBeInTheDocument();
    });

    const startButton = screen.getByText('Start Age Verification');
    fireEvent.click(startButton);

    expect(mockAgeVerificationService.completeVerification).toHaveBeenCalledWith(
      '0x1234567890123456789012345678901234567890',
      expect.any(Function)
    );
  });

  it('should show error message when verification fails', async () => {
    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'none',
      provider: 'persona',
    });

    mockAgeVerificationService.completeVerification.mockRejectedValue(
      new Error('Verification service unavailable')
    );

    renderWithProviders(<StudioVerifyPage />);

    await waitFor(() => {
      const startButton = screen.getByText('Start Age Verification');
      fireEvent.click(startButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Verification service unavailable')).toBeInTheDocument();
    });
  });

  it('should show loading state during verification', async () => {
    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'none',
      provider: 'persona',
    });

    // Mock a delayed response
    mockAgeVerificationService.completeVerification.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    renderWithProviders(<StudioVerifyPage />);

    await waitFor(() => {
      const startButton = screen.getByText('Start Age Verification');
      fireEvent.click(startButton);
    });

    expect(screen.getByText('Starting Verification...')).toBeInTheDocument();
  });

  it('should display verification benefits section', async () => {
    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      status: 'none',
      provider: 'persona',
    });

    renderWithProviders(<StudioVerifyPage />);

    await waitFor(() => {
      expect(screen.getByText('Verification Benefits')).toBeInTheDocument();
      expect(screen.getByText('Required to publish content and access platform features')).toBeInTheDocument();
      expect(screen.getByText('Verified badge, priority support, and premium features')).toBeInTheDocument();
      expect(screen.getByText('Build trust with your audience through verified identity')).toBeInTheDocument();
      expect(screen.getByText('Verified creators get better discoverability')).toBeInTheDocument();
    });
  });
});