import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletButton } from '../WalletButton';
import { useWallet } from '../../../contexts/WalletContext';

// Mock the wallet context
jest.mock('../../../contexts/WalletContext');
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

// Mock the WalletConnectModal
jest.mock('../WalletConnectModal', () => ({
  WalletConnectModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => 
    isOpen ? <div data-testid="wallet-connect-modal">Modal</div> : null
}));

// Mock utils
jest.mock('../../../utils/walletUtils', () => ({
  WalletUtils: {
    formatAddress: (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`,
    formatBalance: (balance: string) => '1.234',
    getNetworkIcon: () => '🔷',
    getNetworkSymbol: () => 'ETH',
    copyToClipboard: jest.fn().mockResolvedValue(true)
  }
}));

describe('Enhanced WalletButton with SIWE', () => {
  const mockWalletState = {
    isConnected: false,
    isConnecting: false,
    account: null,
    balance: null,
    chainId: null,
    networkName: null,
    walletType: null,
    error: null,
    isAuthenticated: false,
    isAuthenticating: false,
    session: null,
    authError: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    switchNetwork: jest.fn(),
    clearError: jest.fn(),
    authenticate: jest.fn(),
    logout: jest.fn(),
    clearAuthError: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows connect wallet button when disconnected', () => {
    mockUseWallet.mockReturnValue(mockWalletState);
    
    render(<WalletButton />);
    
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('shows authentication status when connected but not authenticated', () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x1234567890123456789012345678901234567890'
    });
    
    render(<WalletButton />);
    
    // Click to open dropdown
    fireEvent.click(screen.getByRole('button'));
    
    expect(screen.getByText('Sign In with Ethereum')).toBeInTheDocument();
  });

  it('shows authenticated status when SIWE authenticated', () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x1234567890123456789012345678901234567890',
      isAuthenticated: true,
      session: 'mock-session-token'
    });
    
    render(<WalletButton />);
    
    // Click to open dropdown
    fireEvent.click(screen.getByRole('button'));
    
    expect(screen.getByText('Authenticated')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('calls authenticate when SIWE button is clicked', async () => {
    const mockAuthenticate = jest.fn();
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x1234567890123456789012345678901234567890',
      authenticate: mockAuthenticate
    });
    
    render(<WalletButton />);
    
    // Click to open dropdown
    fireEvent.click(screen.getByRole('button'));
    
    // Click authenticate button
    fireEvent.click(screen.getByText('Sign In with Ethereum'));
    
    expect(mockAuthenticate).toHaveBeenCalled();
  });

  it('calls logout when sign out button is clicked', async () => {
    const mockLogout = jest.fn();
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x1234567890123456789012345678901234567890',
      isAuthenticated: true,
      session: 'mock-session-token',
      logout: mockLogout
    });
    
    render(<WalletButton />);
    
    // Click to open dropdown
    fireEvent.click(screen.getByRole('button'));
    
    // Click sign out button
    fireEvent.click(screen.getByText('Sign Out'));
    
    expect(mockLogout).toHaveBeenCalled();
  });

  it('shows authentication error when present', () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x1234567890123456789012345678901234567890',
      authError: 'User rejected the request'
    });
    
    render(<WalletButton />);
    
    // Click to open dropdown
    fireEvent.click(screen.getByRole('button'));
    
    expect(screen.getByText('Authentication Error')).toBeInTheDocument();
    expect(screen.getByText('User rejected the request')).toBeInTheDocument();
  });

  it('shows authenticating state', () => {
    mockUseWallet.mockReturnValue({
      ...mockWalletState,
      isConnected: true,
      account: '0x1234567890123456789012345678901234567890',
      isAuthenticating: true
    });
    
    render(<WalletButton />);
    
    // Click to open dropdown
    fireEvent.click(screen.getByRole('button'));
    
    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
  });
});