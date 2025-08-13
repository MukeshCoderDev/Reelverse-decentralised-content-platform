import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NetworkSelector } from '../NetworkSelector';
import { useWallet } from '../../../contexts/WalletContext';
import { NetworkService } from '../../../services/wallet/NetworkService';
import { SupportedChainId } from '../../../types/wallet';

// Mock the wallet context
jest.mock('../../../contexts/WalletContext');
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

// Mock NetworkService
jest.mock('../../../services/wallet/NetworkService');
const mockNetworkService = NetworkService as jest.MockedClass<typeof NetworkService>;

describe('NetworkSelector', () => {
  const mockSwitchNetwork = jest.fn();
  const mockNetworkServiceInstance = {
    getNetworkConfig: jest.fn(),
    getSupportedNetworks: jest.fn(),
    getNetworkStatus: jest.fn()
  };

  const defaultWalletContext = {
    isConnected: true,
    isConnecting: false,
    account: '0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c',
    chainId: SupportedChainId.ETHEREUM,
    networkName: 'Ethereum',
    balance: '1.5',
    balanceLoading: false,
    walletType: null,
    error: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    switchNetwork: mockSwitchNetwork,
    clearError: jest.fn()
  };

  const mockNetworks = [
    {
      chainId: SupportedChainId.ETHEREUM,
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      rpcUrl: 'https://mainnet.infura.io/v3/test',
      blockExplorerUrl: 'https://etherscan.io',
      iconUrl: '🔷',
      color: 'from-blue-400 to-blue-600'
    },
    {
      chainId: SupportedChainId.POLYGON,
      name: 'Polygon',
      symbol: 'MATIC',
      decimals: 18,
      rpcUrl: 'https://polygon-rpc.com',
      blockExplorerUrl: 'https://polygonscan.com',
      iconUrl: '🟣',
      color: 'from-purple-400 to-purple-600'
    },
    {
      chainId: SupportedChainId.BNB_CHAIN,
      name: 'BNB Chain',
      symbol: 'BNB',
      decimals: 18,
      rpcUrl: 'https://bsc-dataseed1.binance.org',
      blockExplorerUrl: 'https://bscscan.com',
      iconUrl: '🟡',
      color: 'from-yellow-400 to-yellow-600'
    }
  ];

  beforeEach(() => {
    mockUseWallet.mockReturnValue(defaultWalletContext);
    mockNetworkService.getInstance.mockReturnValue(mockNetworkServiceInstance as any);
    
    mockNetworkServiceInstance.getNetworkConfig.mockImplementation((chainId) => 
      mockNetworks.find(n => n.chainId === chainId) || null
    );
    mockNetworkServiceInstance.getSupportedNetworks.mockReturnValue(mockNetworks);
    mockNetworkServiceInstance.getNetworkStatus.mockImplementation((chainId) => ({
      isSupported: true,
      isMainnet: true,
      isTestnet: false,
      requiresAddition: chainId !== SupportedChainId.ETHEREUM
    }));

    jest.clearAllMocks();
  });

  describe('Visibility', () => {
    it('should not render when wallet is not connected', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletContext,
        isConnected: false
      });

      render(<NetworkSelector />);
      
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should render when wallet is connected', () => {
      render(<NetworkSelector />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
    });
  });

  describe('Current Network Display', () => {
    it('should display current network name and icon', () => {
      render(<NetworkSelector />);
      
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
      expect(screen.getByText('🔷')).toBeInTheDocument();
    });

    it('should display unknown network when chainId is not recognized', () => {
      mockNetworkServiceInstance.getNetworkConfig.mockReturnValue(null);
      
      render(<NetworkSelector />);
      
      expect(screen.getByText('Unknown Network')).toBeInTheDocument();
    });

    it('should hide label when showLabel is false', () => {
      render(<NetworkSelector showLabel={false} />);
      
      expect(screen.queryByText('Ethereum')).not.toBeInTheDocument();
      expect(screen.getByText('🔷')).toBeInTheDocument(); // Icon should still be visible
    });
  });

  describe('Dropdown Functionality', () => {
    beforeEach(() => {
      render(<NetworkSelector />);
    });

    it('should open dropdown when button is clicked', () => {
      fireEvent.click(screen.getByRole('button'));
      
      expect(screen.getByText('Select Network')).toBeInTheDocument();
      expect(screen.getByText('Choose a blockchain network to interact with')).toBeInTheDocument();
    });

    it('should display all supported networks in dropdown', () => {
      fireEvent.click(screen.getByRole('button'));
      
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
      expect(screen.getByText('Polygon')).toBeInTheDocument();
      expect(screen.getByText('BNB Chain')).toBeInTheDocument();
    });

    it('should show active network with check icon', () => {
      fireEvent.click(screen.getByRole('button'));
      
      // Find the Ethereum network button in the dropdown
      const ethereumButton = screen.getAllByText('Ethereum')[1]; // Second instance is in dropdown
      const ethereumContainer = ethereumButton.closest('button');
      
      expect(ethereumContainer).toHaveClass('bg-primary/10');
    });

    it('should show mainnet badges for mainnet networks', () => {
      fireEvent.click(screen.getByRole('button'));
      
      expect(screen.getAllByText('Mainnet')).toHaveLength(3); // All test networks are mainnet
    });

    it('should show "Add Network" badge for networks that require addition', () => {
      fireEvent.click(screen.getByRole('button'));
      
      expect(screen.getAllByText('Add Network')).toHaveLength(2); // Polygon and BNB Chain
    });

    it('should close dropdown when backdrop is clicked', () => {
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('Select Network')).toBeInTheDocument();
      
      const backdrop = document.querySelector('.fixed.inset-0');
      if (backdrop) {
        fireEvent.click(backdrop);
      }
      
      expect(screen.queryByText('Select Network')).not.toBeInTheDocument();
    });
  });

  describe('Network Switching', () => {
    beforeEach(() => {
      render(<NetworkSelector />);
      fireEvent.click(screen.getByRole('button')); // Open dropdown
    });

    it('should call switchNetwork when different network is selected', async () => {
      mockSwitchNetwork.mockResolvedValue(undefined);
      
      const polygonButton = screen.getAllByText('Polygon')[0].closest('button');
      if (polygonButton) {
        fireEvent.click(polygonButton);
      }
      
      expect(mockSwitchNetwork).toHaveBeenCalledWith(SupportedChainId.POLYGON);
    });

    it('should close dropdown after successful network switch', async () => {
      mockSwitchNetwork.mockResolvedValue(undefined);
      
      const polygonButton = screen.getAllByText('Polygon')[0].closest('button');
      if (polygonButton) {
        fireEvent.click(polygonButton);
      }
      
      await waitFor(() => {
        expect(screen.queryByText('Select Network')).not.toBeInTheDocument();
      });
    });

    it('should not call switchNetwork when current network is selected', () => {
      const ethereumButton = screen.getAllByText('Ethereum')[1].closest('button');
      if (ethereumButton) {
        fireEvent.click(ethereumButton);
      }
      
      expect(mockSwitchNetwork).not.toHaveBeenCalled();
    });

    it('should handle network switch failure', async () => {
      mockSwitchNetwork.mockRejectedValue(new Error('Switch failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const polygonButton = screen.getAllByText('Polygon')[0].closest('button');
      if (polygonButton) {
        fireEvent.click(polygonButton);
      }
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Network switch failed:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Loading States', () => {
    it('should show loading spinner when switching networks', async () => {
      mockSwitchNetwork.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(<NetworkSelector />);
      fireEvent.click(screen.getByRole('button'));
      
      const polygonButton = screen.getAllByText('Polygon')[0].closest('button');
      if (polygonButton) {
        fireEvent.click(polygonButton);
      }
      
      // Should show loading spinner
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should disable all network buttons when switching', async () => {
      mockSwitchNetwork.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(<NetworkSelector />);
      fireEvent.click(screen.getByRole('button'));
      
      const polygonButton = screen.getAllByText('Polygon')[0].closest('button');
      if (polygonButton) {
        fireEvent.click(polygonButton);
      }
      
      // All network buttons should be disabled
      const networkButtons = screen.getAllByRole('button').filter(btn => 
        btn.textContent?.includes('Ethereum') || 
        btn.textContent?.includes('Polygon') || 
        btn.textContent?.includes('BNB Chain')
      );
      
      networkButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Custom Props', () => {
    it('should apply custom variant', () => {
      render(<NetworkSelector variant="secondary" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-secondary');
    });

    it('should apply custom size', () => {
      render(<NetworkSelector size="lg" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-11');
    });

    it('should apply custom className', () => {
      render(<NetworkSelector className="custom-class" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', () => {
      render(<NetworkSelector />);
      
      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);
      
      // Should open dropdown on Enter
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(screen.getByText('Select Network')).toBeInTheDocument();
    });

    it('should have proper button attributes', () => {
      render(<NetworkSelector />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).not.toHaveAttribute('aria-disabled', 'true');
    });
  });
});