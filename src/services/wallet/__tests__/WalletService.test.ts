import { WalletService } from '../WalletService';
import { WalletType, WalletErrorType } from '../../../types/wallet';
import { WalletUtils } from '../../../utils/walletUtils';

// Mock WalletUtils
jest.mock('../../../utils/walletUtils');
const mockWalletUtils = WalletUtils as jest.Mocked<typeof WalletUtils>;

// Mock provider
const mockProvider = {
  request: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
  isMetaMask: true
};

// Mock window.ethereum
Object.defineProperty(window, 'ethereum', {
  value: mockProvider,
  writable: true
});

describe('WalletService', () => {
  let walletService: WalletService;

  beforeEach(() => {
    walletService = WalletService.getInstance();
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = WalletService.getInstance();
      const instance2 = WalletService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('connect', () => {
    beforeEach(() => {
      mockWalletUtils.isWalletInstalled.mockReturnValue(true);
      mockWalletUtils.getWalletProvider.mockReturnValue(mockProvider);
      mockProvider.request.mockImplementation((args) => {
        if (args.method === 'eth_requestAccounts') {
          return Promise.resolve(['0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c']);
        }
        if (args.method === 'eth_chainId') {
          return Promise.resolve('0x1');
        }
        return Promise.resolve();
      });
    });

    it('should successfully connect to MetaMask', async () => {
      const result = await walletService.connect(WalletType.METAMASK);
      
      expect(result.success).toBe(true);
      expect(result.account).toBe('0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c');
      expect(result.chainId).toBe(1);
    });

    it('should fail when wallet is not installed', async () => {
      mockWalletUtils.isWalletInstalled.mockReturnValue(false);
      
      const result = await walletService.connect(WalletType.METAMASK);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('wallet not found');
    });

    it('should fail when no accounts are returned', async () => {
      mockProvider.request.mockImplementation((args) => {
        if (args.method === 'eth_requestAccounts') {
          return Promise.resolve([]);
        }
        return Promise.resolve();
      });
      
      const result = await walletService.connect(WalletType.METAMASK);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No accounts found');
    });

    it('should handle user rejection', async () => {
      mockProvider.request.mockRejectedValue({
        code: 4001,
        message: 'User rejected the request'
      });
      
      const result = await walletService.connect(WalletType.METAMASK);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getAccount', () => {
    it('should return current account when connected', async () => {
      // First connect
      mockWalletUtils.isWalletInstalled.mockReturnValue(true);
      mockWalletUtils.getWalletProvider.mockReturnValue(mockProvider);
      mockProvider.request.mockImplementation((args) => {
        if (args.method === 'eth_requestAccounts' || args.method === 'eth_accounts') {
          return Promise.resolve(['0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c']);
        }
        if (args.method === 'eth_chainId') {
          return Promise.resolve('0x1');
        }
        return Promise.resolve();
      });

      await walletService.connect(WalletType.METAMASK);
      
      const account = await walletService.getAccount();
      expect(account).toBe('0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c');
    });

    it('should throw error when not connected', async () => {
      await expect(walletService.getAccount()).rejects.toThrow('No wallet connected');
    });
  });

  describe('getBalance', () => {
    beforeEach(async () => {
      // Setup connection
      mockWalletUtils.isWalletInstalled.mockReturnValue(true);
      mockWalletUtils.getWalletProvider.mockReturnValue(mockProvider);
      mockWalletUtils.isValidAddress.mockReturnValue(true);
      mockWalletUtils.weiToEther.mockReturnValue('1.5');
      
      mockProvider.request.mockImplementation((args) => {
        if (args.method === 'eth_requestAccounts') {
          return Promise.resolve(['0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c']);
        }
        if (args.method === 'eth_chainId') {
          return Promise.resolve('0x1');
        }
        if (args.method === 'eth_getBalance') {
          return Promise.resolve('0x14d1120d7b160000'); // 1.5 ETH in wei
        }
        return Promise.resolve();
      });

      await walletService.connect(WalletType.METAMASK);
    });

    it('should return balance for valid address', async () => {
      const balance = await walletService.getBalance('0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c');
      expect(balance).toBe('1.5');
    });

    it('should throw error for invalid address', async () => {
      mockWalletUtils.isValidAddress.mockReturnValue(false);
      
      await expect(
        walletService.getBalance('invalid-address')
      ).rejects.toThrow('Invalid account address');
    });

    it('should throw error when not connected', async () => {
      await walletService.disconnect();
      
      await expect(
        walletService.getBalance('0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c')
      ).rejects.toThrow('No wallet connected');
    });
  });

  describe('switchNetwork', () => {
    beforeEach(async () => {
      // Setup connection
      mockWalletUtils.isWalletInstalled.mockReturnValue(true);
      mockWalletUtils.getWalletProvider.mockReturnValue(mockProvider);
      
      mockProvider.request.mockImplementation((args) => {
        if (args.method === 'eth_requestAccounts') {
          return Promise.resolve(['0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c']);
        }
        if (args.method === 'eth_chainId') {
          return Promise.resolve('0x1');
        }
        if (args.method === 'wallet_switchEthereumChain') {
          return Promise.resolve();
        }
        return Promise.resolve();
      });

      await walletService.connect(WalletType.METAMASK);
    });

    it('should successfully switch network', async () => {
      await expect(walletService.switchNetwork(137)).resolves.not.toThrow();
      
      expect(mockProvider.request).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }]
      });
    });

    it('should add network if not present and then switch', async () => {
      mockProvider.request.mockImplementation((args) => {
        if (args.method === 'wallet_switchEthereumChain') {
          // First call fails with 4902 (network not added)
          if (!mockProvider.request.mock.calls.find(call => 
            call[0].method === 'wallet_addEthereumChain'
          )) {
            return Promise.reject({ code: 4902 });
          }
          // Second call succeeds
          return Promise.resolve();
        }
        if (args.method === 'wallet_addEthereumChain') {
          return Promise.resolve();
        }
        return Promise.resolve(['0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c']);
      });

      await expect(walletService.switchNetwork(137)).resolves.not.toThrow();
      
      expect(mockProvider.request).toHaveBeenCalledWith({
        method: 'wallet_addEthereumChain',
        params: [expect.any(Object)]
      });
    });

    it('should throw error for unsupported network', async () => {
      await expect(walletService.switchNetwork(999999)).rejects.toThrow('Unsupported network');
    });

    it('should throw error when not connected', async () => {
      await walletService.disconnect();
      
      await expect(walletService.switchNetwork(137)).rejects.toThrow('No wallet connected');
    });
  });

  describe('disconnect', () => {
    it('should successfully disconnect', async () => {
      // First connect
      mockWalletUtils.isWalletInstalled.mockReturnValue(true);
      mockWalletUtils.getWalletProvider.mockReturnValue(mockProvider);
      mockProvider.request.mockResolvedValue(['0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c']);

      await walletService.connect(WalletType.METAMASK);
      await walletService.disconnect();

      // Should throw error when trying to get account after disconnect
      await expect(walletService.getAccount()).rejects.toThrow('No wallet connected');
    });
  });

  describe('event handling', () => {
    it('should setup event listeners on connect', async () => {
      mockWalletUtils.isWalletInstalled.mockReturnValue(true);
      mockWalletUtils.getWalletProvider.mockReturnValue(mockProvider);
      mockProvider.request.mockResolvedValue(['0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c']);

      await walletService.connect(WalletType.METAMASK);

      expect(mockProvider.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
      expect(mockProvider.on).toHaveBeenCalledWith('chainChanged', expect.any(Function));
      expect(mockProvider.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockProvider.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should remove event listeners on disconnect', async () => {
      mockWalletUtils.isWalletInstalled.mockReturnValue(true);
      mockWalletUtils.getWalletProvider.mockReturnValue(mockProvider);
      mockProvider.request.mockResolvedValue(['0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c']);

      await walletService.connect(WalletType.METAMASK);
      await walletService.disconnect();

      expect(mockProvider.removeListener).toHaveBeenCalled();
    });
  });
});