import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletButton } from '../WalletButton';
import { useWallet } from '../../../contexts/WalletContext';
import { WalletUtils } from '../../../utils/walletUtils';
import { WalletType } from '../../../types/wallet';

// Mock the wallet context
jest.mock('../../../contexts/WalletContext');
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

// Mock WalletUtils
jest.mock('../../../utils/walletUtils');
const mockWalletUtils = WalletUtils as jest.Mocked<typeof WalletUtils>;

// Mock WalletConnectModal
jest.mock('../WalletConnectModal', () => ({
  WalletConnectModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => 
    isOpen ? <div data-testid="wallet-modal">Modal Content</div> : null
}));

describe('WalletButton', () => {
  const mockDisconnect = jest.fn();

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
    connect: jest.fn(),
    disconnect: mockDisconnect,
    switchNetwork: jest.fn(),
    clearError: jest.fn()
  };

  beforeEach(() => {
    mockUseWallet.mockReturnValue(defaultWalletContext);
    mockWalletUtils.formatAddress.mockReturnValue('0x742d...5b8c');
    mockWalletUtils.formatBalance.mockReturnValue('1.5');
    mockWalletUtils.getNetworkIcon.mockReturnValue('🔷');
    mockWalletUtils.getNetworkColor.mockReturnValue('from-blue-400 to-blue-600');
    mockWalletUtils.getNetworkName.mockReturnValue('Ethereum');
    mockWalletUtils.getNetworkSymbol.mockReturnValue('ETH');
    mockWalletUtils.copyToClipboard.mockResolvedValue(true);
    jest.clearAllMocks();
  });

  describe('Disconnected State', () => {
    it('should render connect wallet button when disconnected', () => {
      render(<WalletButton />);
      
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveTextContent('Connect Wallet');
    });

    it('should open modal when connect button is clicked', () => {
      render(<WalletButton />);
      
      fireEvent.click(screen.getByText('Connect Wallet'));
      
      expect(screen.getByTestId('wallet-modal')).toBeInTheDocument();
    });

    it('should apply custom variant and size', () => {
      render(<WalletButton variant="outline" size="lg" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('border'); // outline variant class
      expect(button).toHaveClass('h-11'); // lg size class
    });
  });

  describe('Connecting State', () => {
    it('should show loading state when connecting', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletContext,
        isConnecting: true
      });

      render(<WalletButton />);
      
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('Connected State', () => {
    const connectedContext = {
      ...defaultWalletContext,
      isConnected: true,
      account: '0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c',
      chainId: 1,
      balance: '1.5',
      walletType: WalletType.METAMASK
    };

    beforeEach(() => {
      mockUseWallet.mockReturnValue(connectedContext);
    });

    it('should display wallet info when connected', () => {
      render(<WalletButton />);
      
      expect(screen.getByText('0x742d...5b8c')).toBeInTheDocument();
      expect(screen.getByText('1.5 ETH')).toBeInTheDocument();
    });

    it('should show network indicator', () => {
      render(<WalletButton />);
      
      expect(mockWalletUtils.getNetworkIcon).toHaveBeenCalledWith(1);
      expect(mockWalletUtils.getNetworkColor).toHaveBeenCalledWith(1);
    });

    it('should open dropdown when clicked', () => {
      render(<WalletButton />);
      
      fireEvent.click(screen.getByRole('button'));
      
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
      expect(screen.getByText('Metamask Wallet')).toBeInTheDocument();
      expect(screen.getByText('View Wallet')).toBeInTheDocument();
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    it('should close dropdown when backdrop is clicked', () => {
      render(<WalletButton />);
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('View Wallet')).toBeInTheDocument();
      
      // Click backdrop
      const backdrop = screen.getByRole('button').parentElement?.querySelector('div[class*="fixed inset-0"]');
      if (backdrop) {
        fireEvent.click(backdrop);
      }
      
      expect(screen.queryByText('View Wallet')).not.toBeInTheDocument();
    });

    it('should copy address when copy button is clicked', async () => {
      render(<WalletButton />);
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'));
      
      // Click copy button
      const copyButton = screen.getByText('0x742d...5b8c').closest('button');
      if (copyButton) {
        fireEvent.click(copyButton);
      }
      
      expect(mockWalletUtils.copyToClipboard).toHaveBeenCalledWith('0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c');
    });

    it('should navigate to wallet page when View Wallet is clicked', () => {
      // Mock window.location.hash
      delete (window as any).location;
      (window as any).location = { hash: '' };

      render(<WalletButton />);
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'));
      
      // Click View Wallet
      fireEvent.click(screen.getByText('View Wallet'));
      
      expect(window.location.hash).toBe('#/wallet');
    });

    it('should disconnect when disconnect button is clicked', async () => {
      mockDisconnect.mockResolvedValue(undefined);

      render(<WalletButton />);
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'));
      
      // Click disconnect
      fireEvent.click(screen.getByText('Disconnect'));
      
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should handle disconnect error gracefully', async () => {
      mockDisconnect.mockRejectedValue(new Error('Disconnect failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<WalletButton />);
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'));
      
      // Click disconnect
      fireEvent.click(screen.getByText('Disconnect'));
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Disconnect failed:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Responsive Behavior', () => {
    it('should hide balance on small screens', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletContext,
        isConnected: true,
        account: '0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c',
        chainId: 1,
        balance: '1.5',
        walletType: WalletType.METAMASK
      });

      render(<WalletButton />);
      
      const balanceElement = screen.getByText('1.5 ETH');
      expect(balanceElement).toHaveClass('hidden', 'sm:inline');
    });
  });

  describe('Accessibility', () => {
    it('should have proper button attributes', () => {
      render(<WalletButton />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('should be keyboard accessible', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletContext,
        isConnected: true,
        account: '0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c',
        chainId: 1,
        walletType: WalletType.METAMASK
      });

      render(<WalletButton />);
      
      const button = screen.getByRole('button');
      
      // Should be focusable
      button.focus();
      expect(document.activeElement).toBe(button);
      
      // Should open dropdown on Enter
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(screen.getByText('View Wallet')).toBeInTheDocument();
    });
  });

  describe('Custom Props', () => {
    it('should apply custom className', () => {
      render(<WalletButton className="custom-class" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('should use different variants', () => {
      const { rerender } = render(<WalletButton variant="outline" />);
      expect(screen.getByRole('button')).toHaveClass('border');
      
      rerender(<WalletButton variant="ghost" />);
      expect(screen.getByRole('button')).toHaveClass('hover:bg-accent');
    });

    it('should use different sizes', () => {
      const { rerender } = render(<WalletButton size="sm" />);
      expect(screen.getByRole('button')).toHaveClass('h-9');
      
      rerender(<WalletButton size="lg" />);
      expect(screen.getByRole('button')).toHaveClass('h-11');
    });
  });
});