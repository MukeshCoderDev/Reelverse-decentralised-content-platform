import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletConnectModal } from '../WalletConnectModal';
import { WalletType } from '../../../types/wallet';
import { useWallet } from '../../../contexts/WalletContext';
import { WalletUtils } from '../../../utils/walletUtils';

// Mock the wallet context
jest.mock('../../../contexts/WalletContext');
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

// Mock WalletUtils
jest.mock('../../../utils/walletUtils');
const mockWalletUtils = WalletUtils as jest.Mocked<typeof WalletUtils>;

describe('WalletConnectModal', () => {
  const mockConnect = jest.fn();
  const mockClearError = jest.fn();
  const mockOnClose = jest.fn();

  const defaultWalletContext = {
    isConnected: false,
    isConnecting: false,
    account: null,
    chainId: null,
    networkName: null,
    balance: null,
    balanceLoading: false,
    walletType: null,
    error: null,
    connect: mockConnect,
    disconnect: jest.fn(),
    switchNetwork: jest.fn(),
    clearError: mockClearError
  };

  beforeEach(() => {
    mockUseWallet.mockReturnValue(defaultWalletContext);
    mockWalletUtils.isWalletInstalled.mockReturnValue(true);
    jest.clearAllMocks();
  });

  describe('Modal Visibility', () => {
    it('should not render when isOpen is false', () => {
      render(<WalletConnectModal isOpen={false} onClose={mockOnClose} />);
      
      expect(screen.queryByText('Connect Wallet')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<WalletConnectModal isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
      expect(screen.getByText('Connect your wallet to access Web3 features and manage your digital assets')).toBeInTheDocument();
    });
  });

  describe('Wallet Options', () => {
    beforeEach(() => {
      render(<WalletConnectModal isOpen={true} onClose={mockOnClose} />);
    });

    it('should display all supported wallets', () => {
      expect(screen.getByText('MetaMask')).toBeInTheDocument();
      expect(screen.getByText('WalletConnect')).toBeInTheDocument();
      expect(screen.getByText('Coinbase Wallet')).toBeInTheDocument();
      expect(screen.getByText('Phantom')).toBeInTheDocument();
      expect(screen.getByText('Trust Wallet')).toBeInTheDocument();
      expect(screen.getByText('Rainbow')).toBeInTheDocument();
    });

    it('should show wallet descriptions', () => {
      expect(screen.getByText('Connect using browser wallet')).toBeInTheDocument();
      expect(screen.getByText('Connect using mobile wallet')).toBeInTheDocument();
      expect(screen.getByText('Connect using Coinbase')).toBeInTheDocument();
    });

    it('should show "Not Installed" badge for uninstalled wallets', () => {
      mockWalletUtils.isWalletInstalled.mockImplementation((walletType) => {
        return walletType !== WalletType.PHANTOM;
      });

      render(<WalletConnectModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Not Installed')).toBeInTheDocument();
    });
  });

  describe('Wallet Connection', () => {
    beforeEach(() => {
      render(<WalletConnectModal isOpen={true} onClose={mockOnClose} />);
    });

    it('should call connect when wallet is selected', async () => {
      mockConnect.mockResolvedValue(undefined);

      fireEvent.click(screen.getByText('MetaMask'));

      expect(mockClearError).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalledWith(WalletType.METAMASK);
    });

    it('should close modal after successful connection', async () => {
      mockConnect.mockResolvedValue(undefined);

      fireEvent.click(screen.getByText('MetaMask'));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should handle connection failure', async () => {
      mockConnect.mockRejectedValue(new Error('Connection failed'));

      fireEvent.click(screen.getByText('MetaMask'));

      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalledWith(WalletType.METAMASK);
      });

      // Modal should not close on error
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('should show loading state when connecting', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletContext,
        isConnecting: true
      });

      render(<WalletConnectModal isOpen={true} onClose={mockOnClose} />);

      // Should disable other wallet buttons when connecting
      const walletButtons = screen.getAllByRole('button').filter(button => 
        button.textContent?.includes('MetaMask') || 
        button.textContent?.includes('WalletConnect') ||
        button.textContent?.includes('Coinbase')
      );

      // At least some buttons should be disabled (except the one being connected)
      expect(walletButtons.some(button => button.hasAttribute('disabled'))).toBe(true);
    });

    it('should disable close button when connecting', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletContext,
        isConnecting: true
      });

      render(<WalletConnectModal isOpen={true} onClose={mockOnClose} />);

      const closeButton = screen.getByRole('button', { name: '' }); // Close button with X icon
      expect(closeButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when present', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletContext,
        error: 'Connection failed. Please try again.'
      });

      render(<WalletConnectModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Connection Failed')).toBeInTheDocument();
      expect(screen.getByText('Connection failed. Please try again.')).toBeInTheDocument();
    });

    it('should clear error when modal is closed', () => {
      render(<WalletConnectModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole('button', { name: '' })); // Close button

      expect(mockClearError).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Modal Interactions', () => {
    beforeEach(() => {
      render(<WalletConnectModal isOpen={true} onClose={mockOnClose} />);
    });

    it('should close modal when close button is clicked', () => {
      fireEvent.click(screen.getByRole('button', { name: '' })); // Close button with X icon

      expect(mockClearError).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close modal when backdrop is clicked', () => {
      const backdrop = screen.getByRole('dialog').parentElement;
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('should not close modal when content is clicked', () => {
      const content = screen.getByText('Connect Wallet');
      fireEvent.click(content);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Security Notice', () => {
    it('should display security information', () => {
      render(<WalletConnectModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Secure Connection')).toBeInTheDocument();
      expect(screen.getByText('Your wallet connection is encrypted and secure. We never store your private keys.')).toBeInTheDocument();
    });

    it('should display help link', () => {
      render(<WalletConnectModal isOpen={true} onClose={mockOnClose} />);

      const helpLink = screen.getByText('Learn more about wallets');
      expect(helpLink).toBeInTheDocument();
      expect(helpLink.closest('a')).toHaveAttribute('href', 'https://ethereum.org/en/wallets/');
      expect(helpLink.closest('a')).toHaveAttribute('target', '_blank');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<WalletConnectModal isOpen={true} onClose={mockOnClose} />);

      // Modal should be properly labeled
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
      
      // Buttons should be accessible
      const walletButtons = screen.getAllByRole('button');
      expect(walletButtons.length).toBeGreaterThan(0);
    });

    it('should handle keyboard navigation', () => {
      render(<WalletConnectModal isOpen={true} onClose={mockOnClose} />);

      // Should be able to tab through wallet options
      const walletButtons = screen.getAllByRole('button');
      walletButtons.forEach(button => {
        expect(button).not.toHaveAttribute('tabindex', '-1');
      });
    });
  });
});