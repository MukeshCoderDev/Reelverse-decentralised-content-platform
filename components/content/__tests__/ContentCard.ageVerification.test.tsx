import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContentCard } from '../ContentCard';
import { useWallet } from '../../../contexts/WalletContext';
import { AgeVerificationService } from '../../../services/ageVerificationService';

// Mock the wallet context
jest.mock('../../../contexts/WalletContext');
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

// Mock the age verification service
jest.mock('../../../services/ageVerificationService');
const mockAgeVerificationService = {
  getVerificationStatus: jest.fn(),
  getInstance: jest.fn()
};
(AgeVerificationService.getInstance as jest.Mock).mockReturnValue(mockAgeVerificationService);

// Mock the AgeVerificationModal
jest.mock('../../AgeVerificationModal', () => ({
  AgeVerificationModal: ({ isOpen, onClose, onVerified }: any) => 
    isOpen ? (
      <div data-testid="age-verification-modal">
        <button onClick={() => onVerified({ status: 'verified' })}>Verify</button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
}));

// Mock the YouTubeStyleVideoPlayer
jest.mock('../YouTubeStyleVideoPlayer', () => ({
  YouTubeStyleVideoPlayer: ({ onClose }: any) => (
    <div data-testid="video-player">
      <button onClick={onClose}>Close Player</button>
    </div>
  )
}));

describe('ContentCard with Age Verification', () => {
  const mockContent = {
    title: 'Test Video',
    creator: 'Test Creator',
    views: '1.2K views',
    ago: '2 hours ago',
    thumbnail: '/test-thumbnail.jpg',
    likes: 150,
    comments: 25,
    trending: false
  };

  const mockWalletState = {
    isConnected: false,
    account: null,
    isAuthenticated: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWallet.mockReturnValue(mockWalletState as any);
  });

  it('renders regular content without age restrictions', () => {
    render(<ContentCard {...mockContent} isAdultContent={false} />);
    
    expect(screen.getByText('Test Video')).toBeInTheDocument();
    expect(screen.queryByText('18+')).not.toBeInTheDocument();
  });

  it('shows age rating badge for adult content', () => {
    render(<ContentCard {...mockContent} isAdultContent={true} ageRating="18+" />);
    
    expect(screen.getByText('18+')).toBeInTheDocument();
  });

  it('blurs adult content when wallet not connected', () => {
    render(<ContentCard {...mockContent} isAdultContent={true} />);
    
    const image = screen.getByAltText('Test Video');
    expect(image).toHaveClass('blur-lg');
    expect(screen.getByText('18+ Content')).toBeInTheDocument();
    expect(screen.getByText('Connect your wallet and verify your age to view this content')).toBeInTheDocument();
  });

  it('shows age verification prompt when wallet connected but not age verified', async () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x123'
    } as any);

    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      status: 'none',
      address: '0x123',
      provider: 'persona'
    });

    render(<ContentCard {...mockContent} isAdultContent={true} />);

    await waitFor(() => {
      expect(screen.getByText('Age verification required to view this content')).toBeInTheDocument();
    });

    expect(screen.getByText('Verify Age')).toBeInTheDocument();
  });

  it('shows content normally when age verified', async () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x123'
    } as any);

    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      status: 'verified',
      address: '0x123',
      provider: 'persona'
    });

    render(<ContentCard {...mockContent} isAdultContent={true} />);

    await waitFor(() => {
      const image = screen.getByAltText('Test Video');
      expect(image).not.toHaveClass('blur-lg');
    });

    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('opens age verification modal when verify button clicked', async () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x123'
    } as any);

    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      status: 'none',
      address: '0x123',
      provider: 'persona'
    });

    render(<ContentCard {...mockContent} isAdultContent={true} />);

    await waitFor(() => {
      expect(screen.getByText('Verify Age')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Verify Age'));

    expect(screen.getByTestId('age-verification-modal')).toBeInTheDocument();
  });

  it('plays video after successful age verification', async () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x123'
    } as any);

    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      status: 'none',
      address: '0x123',
      provider: 'persona'
    });

    render(<ContentCard {...mockContent} isAdultContent={true} />);

    await waitFor(() => {
      expect(screen.getByText('Verify Age')).toBeInTheDocument();
    });

    // Click verify age button
    fireEvent.click(screen.getByText('Verify Age'));

    // Complete verification in modal
    fireEvent.click(screen.getByText('Verify'));

    // Should open video player
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toBeInTheDocument();
    });
  });

  it('prevents video playback for unverified adult content', async () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x123'
    } as any);

    mockAgeVerificationService.getVerificationStatus.mockResolvedValue({
      status: 'none',
      address: '0x123',
      provider: 'persona'
    });

    render(<ContentCard {...mockContent} isAdultContent={true} />);

    // Try to click play button (should be blocked)
    const thumbnail = screen.getByAltText('Test Video');
    fireEvent.click(thumbnail);

    // Should show age verification modal instead of video player
    await waitFor(() => {
      expect(screen.getByTestId('age-verification-modal')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('video-player')).not.toBeInTheDocument();
  });
});