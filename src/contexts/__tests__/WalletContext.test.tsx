import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { WalletProvider, useWallet } from '../WalletContext';
import { WalletType } from '../../types/wallet';
import { WalletService } from '../../services/wallet/WalletService';

// Mock WalletService
jest.mock('../../services/wallet/WalletService');
const mockWalletService = WalletService as jest.MockedClass<typeof WalletService>;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Test component that uses the wallet context
const TestComponent: React.FC = () => {
  const {
    isConnected,
    isConnecting,
    account,
    chainId,
    networkName,
    balance,
    balanceLoading,
    walletType,
    error,
    connect,
    disconnect,
    switchNetwork,
    clearError
  } = useWallet();

  return (
    <div>
      <div data-testid="is-connected">{isConnected.toString()}</div>
      <div data-testid="is-connecting">{isConnecting.toString()}</div>
      <div data-testid="account">{account || 'null'}</div>
      <div data-testid="chain-id">{chainId || 'null'}</div>
      <div data-testid="network-name">{networkName || 'null'}</div>
      <div data-testid="balance">{balance || 'null'}</div>
      <div data-testid="balance-loading">{balanceLoading.toString()}</div>
      <div data-testid="wallet-type">{walletType || 'null'}</div>
      <div data-testid="error">{error || 'null'}</div>
      
      <button onClick={() => connect(WalletType.METAMASK)} data-testid="connect-btn">
        Connect
      </button>
      <button onClick={disconnect} data-testid="disconnect-btn">
        Disconnect
      </button>
      <button onClick={() => switchNetwork(137)} data-testid="switch-network-btn">
        Switch Network
      </button>
      <button onClick={clearError} data-testid="clear-error-btn">
        Clear Error
      </button>
    </div>
  );
};

describe('WalletContext', () => {
  let mockWalletServiceInstance: any;

  beforeEach(() => {
    mockWalletServiceInstance = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      switchNetwork: jest.fn(),
      getBalance: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    };

    mockWalletService.getInstance.mockReturnValue(mockWalletServiceInstance);
    mockLocalStorage.getItem.mockReturnValue(null);
    jest.clearAllMocks();
  });

  const renderWithProvider = () => {
    return render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );
  };

  describe('Initial State', () => {
    it('should render with initial state', () => {
      renderWithProvider();

      expect(screen.getByTestId('is-connected')).toHaveTextContent('false');
      expect(screen.getByTestId('is-connecting')).toHaveTextContent('false');
      expect(screen.getByTestId('account')).toHaveTextContent('null');
      expect(screen.getByTestId('chain-id')).toHaveTextContent('null');
      expect(screen.getByTestId('network-name')).toHaveTextContent('null');
      expect(screen.getByTestId('balance')).toHaveTextContent('null');
      expect(screen.getByTestId('balance-loading')).toHaveTextContent('false');
      expect(screen.getByTestId('wallet-type')).toHaveTextContent('null');
      expect(screen.getByTestId('error')).toHaveTextContent('null');
    });
  });

  describe('Connect Wallet', () => {
    it('should successfully connect wallet', async () => {
      mockWalletServiceInstance.connect.mockResolvedValue({
        success: true,
        account: '0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c',
        chainId: 1
      });
      mockWalletServiceInstance.getBalance.mockResolvedValue('1.5');

      renderWithProvider();

      act(() => {
        screen.getByTestId('connect-btn').click();
      });

      // Should show connecting state
      expect(screen.getByTestId('is-connecting')).toHaveTextContent('true');

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });

      expect(screen.getByTestId('is-connecting')).toHaveTextContent('false');
      expect(screen.getByTestId('account')).toHaveTextContent('0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c');
      expect(screen.getByTestId('chain-id')).toHaveTextContent('1');
      expect(screen.getByTestId('wallet-type')).toHaveTextContent('metamask');
      expect(screen.getByTestId('balance')).toHaveTextContent('1.5');
    });

    it('should handle connection failure', async () => {
      mockWalletServiceInstance.connect.mockResolvedValue({
        success: false,
        error: 'Connection failed'
      });

      renderWithProvider();

      await act(async () => {
        screen.getByTestId('connect-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed');
      });

      expect(screen.getByTestId('is-connected')).toHaveTextContent('false');
      expect(screen.getByTestId('is-connecting')).toHaveTextContent('false');
    });

    it('should handle connection exception', async () => {
      mockWalletServiceInstance.connect.mockRejectedValue(new Error('Network error'));

      renderWithProvider();

      await act(async () => {
        try {
          screen.getByTestId('connect-btn').click();
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-connecting')).toHaveTextContent('false');
      });
    });
  });

  describe('Disconnect Wallet', () => {
    it('should successfully disconnect wallet', async () => {
      // First connect
      mockWalletServiceInstance.connect.mockResolvedValue({
        success: true,
        account: '0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c',
        chainId: 1
      });
      mockWalletServiceInstance.getBalance.mockResolvedValue('1.5');
      mockWalletServiceInstance.disconnect.mockResolvedValue(undefined);

      renderWithProvider();

      await act(async () => {
        screen.getByTestId('connect-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });

      // Then disconnect
      await act(async () => {
        screen.getByTestId('disconnect-btn').click();
      });

      expect(screen.getByTestId('is-connected')).toHaveTextContent('false');
      expect(screen.getByTestId('account')).toHaveTextContent('null');
      expect(screen.getByTestId('chain-id')).toHaveTextContent('null');
      expect(screen.getByTestId('wallet-type')).toHaveTextContent('null');
      expect(screen.getByTestId('balance')).toHaveTextContent('null');
    });
  });

  describe('Switch Network', () => {
    beforeEach(async () => {
      // Setup connected state
      mockWalletServiceInstance.connect.mockResolvedValue({
        success: true,
        account: '0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c',
        chainId: 1
      });
      mockWalletServiceInstance.getBalance.mockResolvedValue('1.5');
      mockWalletServiceInstance.switchNetwork.mockResolvedValue(undefined);

      renderWithProvider();

      await act(async () => {
        screen.getByTestId('connect-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });
    });

    it('should successfully switch network', async () => {
      await act(async () => {
        screen.getByTestId('switch-network-btn').click();
      });

      expect(mockWalletServiceInstance.switchNetwork).toHaveBeenCalledWith(137);
      
      await waitFor(() => {
        expect(screen.getByTestId('chain-id')).toHaveTextContent('137');
      });
    });

    it('should handle network switch failure', async () => {
      mockWalletServiceInstance.switchNetwork.mockRejectedValue(new Error('Switch failed'));

      await act(async () => {
        try {
          screen.getByTestId('switch-network-btn').click();
        } catch (error) {
          // Expected to throw
        }
      });

      // Error should be handled by the context
      expect(mockWalletServiceInstance.switchNetwork).toHaveBeenCalledWith(137);
    });
  });

  describe('Auto-connect', () => {
    it('should auto-connect on mount when enabled', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'reelverse_wallet_type') return 'metamask';
        if (key === 'reelverse_auto_connect') return 'true';
        return null;
      });

      mockWalletServiceInstance.connect.mockResolvedValue({
        success: true,
        account: '0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c',
        chainId: 1
      });
      mockWalletServiceInstance.getBalance.mockResolvedValue('1.5');

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });

      expect(mockWalletServiceInstance.connect).toHaveBeenCalledWith('metamask');
    });

    it('should not auto-connect when disabled', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'reelverse_wallet_type') return 'metamask';
        if (key === 'reelverse_auto_connect') return 'false';
        return null;
      });

      renderWithProvider();

      expect(mockWalletServiceInstance.connect).not.toHaveBeenCalled();
      expect(screen.getByTestId('is-connected')).toHaveTextContent('false');
    });
  });

  describe('Error Handling', () => {
    it('should clear error when clearError is called', async () => {
      mockWalletServiceInstance.connect.mockResolvedValue({
        success: false,
        error: 'Test error'
      });

      renderWithProvider();

      await act(async () => {
        screen.getByTestId('connect-btn').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Test error');
      });

      act(() => {
        screen.getByTestId('clear-error-btn').click();
      });

      expect(screen.getByTestId('error')).toHaveTextContent('null');
    });
  });

  describe('Hook Usage', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useWallet must be used within a WalletProvider');

      consoleSpy.mockRestore();
    });
  });
});