import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletInfo } from '../WalletInfo';
import { useWallet } from '../../../contexts/WalletContext';
import { WalletUtils } from '../../../utils/walletUtils';
import { WalletType, SupportedChainId } from '../../../types/wallet';

// Mock the wallet context
jest.mock('../../../contexts/WalletContext');
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

// Mock WalletUtils
jest.mock('../../../utils/walletUtils');
const mockWalletUtils = WalletUtils as jest.Mocked<typeof WalletUtils>;

// Mock NetworkSelector
jest.mock('../NetworkSelector', () => ({
  NetworkSelector: ({ variant, size, showLabel }: any) => (
    <div data-testid="network-selector">
      NetworkSelector - {variant} - {size} - {showLabel?.toString()}
    </div>
  )
}));

describe('WalletInfo', () => {
  const mockDisconnect = jest.fn();

  const defaultWalletContext = {
    isConnected: true,
    isConnecting: false,
    account: '0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c',
    chainId: SupportedChainId.ETHEREUM,
    networkName: 'Ethereum',
    balance: '1.5',
    balanceLoading: false,
    walletType: WalletType.METAMASK,
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
    mockWalletUtils.getNetworkSymbol.mockReturnValue('ETH');
    mockWalletUtils.copyToClipboard.mockResolvedValue(true);
    
    // Mock window.location
    delete (window as any).location;
    (window as any).location = { hash: '', reload: jest.fn() };
    
    jest.clearAllMocks();
  });

  describe('Visibility', () => {
    it('should not render when wallet is not connected', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletContext,
        isConnected: false,
        account: null
      });

      render(<WalletInfo />);
      
      expect(screen.queryByText('Ethereum')).not.toBeInTheDocument();
    });

    it('should render when wallet is connected', () => {
      render(<WalletInfo />);
      
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
      expect(screen.getByText('Metamask Wallet')).toBeInTheDocument();
    });
  });

  describe('Default Variant', () => {
    beforeEach(() => {
      render(<WalletInfo />);
    });

    it('should display network information', () => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
      expect(screen.getByText('Metamask Wallet')).toBeInTheDocument();
      expect(screen.getByText('🔷')).toBeInTheDocument();
    });

    it('should display wallet address', () => {
      expect(screen.getByText('Wallet Address')).toBeInTheDocument();
      expect(screen.getByText('0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c')).toBeInTheDocument();
    });

    it('should display balance', () => {
      expect(screen.getByText('Balance')).toBeInTheDocument();
      expect(screen.getByText('1.5 ETH')).toBeInTheDocument();
    });

    it('should show network selector by default', () => {
      expect(screen.getByTestId('network-selector')).toBeInTheDocument();
    });

    it('should show disconnect button by default', () => {
      expect(screen.getByText('Disconnect Wallet')).toBeInTheDocument();
    });
  });

  describe('Compact Variant', () => {
    it('should render minimal display', () => {
      render(<WalletInfo variant="compact" />);
      
      expect(screen.getByText('🔷')).toBeInTheDocument();
      expect(screen.getByText('0x742d...5b8c')).toBeInTheDocument();
      
      // Should not show full address or balance
      expect(screen.queryByText('Wallet Address')).not.toBeInTheDocument();
      expect(screen.queryByText('Balance')).not.toBeInTheDocument();
    });

    it('should have copy button', () => {
      render(<WalletInfo variant="compact" />);
      
      const copyButton = screen.getByTitle('Copy address');
      expect(copyButton).toBeInTheDocument();
    });
  });

  describe('Card Variant', () => {
    beforeEach(() => {
      render(<WalletInfo variant="card" />);
    });

    it('should display card header', () => {
      expect(screen.getByText('Wallet Info')).toBeInTheDocument();
    });

    it('should display network info with larger icons', () => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
      expect(screen.getByText('Metamask Wallet')).toBeInTheDocument();
    });

    it('should display formatted address and balance in cards', () => {
      expect(screen.getByText('0x742d...5b8c')).toBeInTheDocument();
      expect(screen.getByText('1.5 ETH')).toBeInTheDocument();
    });

    it('should show action buttons', () => {
      expect(screen.getByText('View Wallet')).toBeInTheDocument();
      expect(screen.getByText('Buy Crypto')).toBeInTheDocument();
    });

    it('should show disconnect button in header', () => {
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });
  });

  describe('Copy Address Functionality', () => {
    it('should copy address when copy button is clicked', async () => {
      render(<WalletInfo />);
      
      const copyButton = screen.getByText('Copy');
      fireEvent.click(copyButton);
      
      expect(mockWalletUtils.copyToClipboard).toHaveBeenCalledWith('0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c');
    });

    it('should show success state after copying', async () => {
      render(<WalletInfo />);
      
      const copyButton = screen.getByText('Copy');
      fireEvent.click(copyButton);
      
      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    it('should reset copy state after timeout', async () => {
      jest.useFakeTimers();
      
      render(<WalletInfo />);
      
      const copyButton = screen.getByText('Copy');
      fireEvent.click(copyButton);
      
      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
      
      // Fast forward time
      jest.advanceTimersByTime(2000);
      
      await waitFor(() => {
        expect(screen.getByText('Copy')).toBeInTheDocument();
      });
      
      jest.useRealTimers();
    });
  });

  describe('Balance Display', () => {
    it('should show loading state when balance is loading', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletContext,
        balanceLoading: true
      });

      render(<WalletInfo />);
      
      expect(screen.getByText('Loading balance...')).toBeInTheDocument();
    });

    it('should show error message when balance is null', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletContext,
        balance: null
      });

      render(<WalletInfo />);
      
      expect(screen.getByText('Unable to fetch balance')).toBeInTheDocument();
    });

    it('should refresh balance when refresh button is clicked', () => {
      render(<WalletInfo />);
      
      const refreshButton = screen.getByTitle('Refresh balance');
      fireEvent.click(refreshButton);
      
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  describe('Disconnect Functionality', () => {
    it('should call disconnect when disconnect button is clicked', async () => {
      mockDisconnect.mockResolvedValue(undefined);

      render(<WalletInfo />);
      
      const disconnectButton = screen.getByText('Disconnect Wallet');
      fireEvent.click(disconnectButton);
      
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should handle disconnect error gracefully', async () => {
      mockDisconnect.mockRejectedValue(new Error('Disconnect failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<WalletInfo />);
      
      const disconnectButton = screen.getByText('Disconnect Wallet');
      fireEvent.click(disconnectButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Disconnect failed:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('should not show disconnect button when showDisconnect is false', () => {
      render(<WalletInfo showDisconnect={false} />);
      
      expect(screen.queryByText('Disconnect Wallet')).not.toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to wallet page when View Wallet is clicked', () => {
      render(<WalletInfo variant="card" />);
      
      const viewWalletButton = screen.getByText('View Wallet');
      fireEvent.click(viewWalletButton);
      
      expect(window.location.hash).toBe('#/wallet');
    });

    it('should navigate to buy crypto page when Buy Crypto is clicked', () => {
      render(<WalletInfo variant="card" />);
      
      const buyCryptoButton = screen.getByText('Buy Crypto');
      fireEvent.click(buyCryptoButton);
      
      expect(window.location.hash).toBe('#/buy-crypto');
    });
  });

  describe('Network Selector Integration', () => {
    it('should show network selector by default', () => {
      render(<WalletInfo />);
      
      expect(screen.getByTestId('network-selector')).toBeInTheDocument();
    });

    it('should hide network selector when showNetworkSelector is false', () => {
      render(<WalletInfo showNetworkSelector={false} />);
      
      expect(screen.queryByTestId('network-selector')).not.toBeInTheDocument();
    });

    it('should pass correct props to NetworkSelector in card variant', () => {
      render(<WalletInfo variant="card" />);
      
      const networkSelector = screen.getByTestId('network-selector');
      expect(networkSelector).toHaveTextContent('outline - sm - false');
    });
  });

  describe('Custom Props', () => {
    it('should apply custom className', () => {
      const { container } = render(<WalletInfo className="custom-class" />);
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown wallet type', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletContext,
        walletType: null
      });

      render(<WalletInfo />);
      
      expect(screen.getByText('Unknown Wallet')).toBeInTheDocument();
    });

    it('should handle unknown network', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletContext,
        networkName: null,
        chainId: null
      });

      render(<WalletInfo />);
      
      expect(screen.getByText('Unknown Network')).toBeInTheDocument();
    });

    it('should handle copy failure gracefully', async () => {
      mockWalletUtils.copyToClipboard.mockResolvedValue(false);

      render(<WalletInfo />);
      
      const copyButton = screen.getByText('Copy');
      fireEvent.click(copyButton);
      
      // Should not show success state
      expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
    });
  });
});