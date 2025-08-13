import { 
  WalletType, 
  WalletProvider, 
  ConnectionResult, 
  WalletError,
  WalletErrorType 
} from '../../types/wallet';
import { WalletUtils } from '../../utils/walletUtils';
import { WalletErrorHandler } from '../../utils/walletErrors';
import { NetworkService } from './NetworkService';

export class WalletService {
  private static instance: WalletService;
  private networkService: NetworkService;
  private currentProvider: WalletProvider | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  private constructor() {
    this.networkService = NetworkService.getInstance();
  }

  static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  /**
   * Get wallet provider for specific wallet type
   */
  async getProvider(walletType: WalletType): Promise<WalletProvider> {
    try {
      switch (walletType) {
        case WalletType.METAMASK:
          return this.getMetaMaskProvider();
        
        case WalletType.COINBASE:
          return this.getCoinbaseProvider();
        
        case WalletType.PHANTOM:
          return this.getPhantomProvider();
        
        case WalletType.TRUST:
          return this.getTrustProvider();
        
        case WalletType.RAINBOW:
          return this.getRainbowProvider();
        
        case WalletType.WALLET_CONNECT:
          return this.getWalletConnectProvider();
        
        default:
          throw new Error(`Unsupported wallet type: ${walletType}`);
      }
    } catch (error) {
      throw WalletErrorHandler.handleError(error);
    }
  }

  /**
   * Connect to wallet
   */
  async connect(walletType: WalletType): Promise<ConnectionResult> {
    try {
      // Check if wallet is installed
      if (!WalletUtils.isWalletInstalled(walletType)) {
        throw {
          type: WalletErrorType.WALLET_NOT_FOUND,
          message: `${walletType} wallet not found. Please install the wallet extension.`
        };
      }

      // Get provider
      const provider = await this.getProvider(walletType);
      this.currentProvider = provider;

      // Request account access
      const accounts = await provider.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        throw {
          type: WalletErrorType.CONNECTION_FAILED,
          message: 'No accounts found'
        };
      }

      const account = accounts[0];

      // Get current chain ID
      const chainId = await provider.request({
        method: 'eth_chainId'
      });

      const parsedChainId = this.networkService.parseChainId(chainId);

      // Setup event listeners
      this.setupEventListeners(provider);

      return {
        success: true,
        account,
        chainId: parsedChainId
      };

    } catch (error) {
      const walletError = WalletErrorHandler.handleError(error);
      return {
        success: false,
        error: walletError.message
      };
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnect(): Promise<void> {
    try {
      if (this.currentProvider) {
        this.removeEventListeners();
        this.currentProvider = null;
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  }

  /**
   * Get current account
   */
  async getAccount(): Promise<string> {
    if (!this.currentProvider) {
      throw new Error('No wallet connected');
    }

    try {
      const accounts = await this.currentProvider.request({
        method: 'eth_accounts'
      });

      return accounts[0] || '';
    } catch (error) {
      throw WalletErrorHandler.handleError(error);
    }
  }

  /**
   * Get account balance
   */
  async getBalance(account: string): Promise<string> {
    if (!this.currentProvider) {
      throw new Error('No wallet connected');
    }

    if (!WalletUtils.isValidAddress(account)) {
      throw new Error('Invalid account address');
    }

    try {
      const balance = await this.currentProvider.request({
        method: 'eth_getBalance',
        params: [account, 'latest']
      });

      return WalletUtils.weiToEther(balance);
    } catch (error) {
      throw WalletErrorHandler.handleError(error);
    }
  }

  /**
   * Get current chain ID
   */
  async getChainId(): Promise<number> {
    if (!this.currentProvider) {
      throw new Error('No wallet connected');
    }

    try {
      const chainId = await this.currentProvider.request({
        method: 'eth_chainId'
      });

      return this.networkService.parseChainId(chainId);
    } catch (error) {
      throw WalletErrorHandler.handleError(error);
    }
  }

  /**
   * Switch network
   */
  async switchNetwork(chainId: number): Promise<void> {
    if (!this.currentProvider) {
      throw new Error('No wallet connected');
    }

    if (!this.networkService.isSupportedNetwork(chainId)) {
      throw new Error(`Unsupported network: ${chainId}`);
    }

    try {
      // Try to switch to the network
      await this.currentProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: this.networkService.formatChainId(chainId) }]
      });
    } catch (error: any) {
      // If network is not added to wallet, add it first
      if (error.code === 4902) {
        await this.addNetwork(chainId);
        // Try switching again after adding
        await this.currentProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: this.networkService.formatChainId(chainId) }]
        });
      } else {
        throw WalletErrorHandler.handleError(error);
      }
    }
  }

  /**
   * Add network to wallet
   */
  async addNetwork(chainId: number): Promise<void> {
    if (!this.currentProvider) {
      throw new Error('No wallet connected');
    }

    try {
      const networkParams = this.networkService.getNetworkAddParams(chainId);
      
      await this.currentProvider.request({
        method: 'wallet_addEthereumChain',
        params: [networkParams]
      });
    } catch (error) {
      throw WalletErrorHandler.handleError(error);
    }
  }

  /**
   * Setup event listeners for wallet events
   */
  setupEventListeners(provider?: WalletProvider): void {
    const walletProvider = provider || this.currentProvider;
    if (!walletProvider) return;

    // Account changed event
    const handleAccountsChanged = (accounts: string[]) => {
      this.emit('accountsChanged', accounts);
    };

    // Chain changed event
    const handleChainChanged = (chainId: string) => {
      const parsedChainId = this.networkService.parseChainId(chainId);
      this.emit('chainChanged', parsedChainId);
    };

    // Connection event
    const handleConnect = (connectInfo: { chainId: string }) => {
      const parsedChainId = this.networkService.parseChainId(connectInfo.chainId);
      this.emit('connect', parsedChainId);
    };

    // Disconnection event
    const handleDisconnect = (error: { code: number; message: string }) => {
      this.emit('disconnect', error);
    };

    // Add event listeners
    walletProvider.on('accountsChanged', handleAccountsChanged);
    walletProvider.on('chainChanged', handleChainChanged);
    walletProvider.on('connect', handleConnect);
    walletProvider.on('disconnect', handleDisconnect);

    // Store listeners for cleanup
    this.eventListeners.set('accountsChanged', [handleAccountsChanged]);
    this.eventListeners.set('chainChanged', [handleChainChanged]);
    this.eventListeners.set('connect', [handleConnect]);
    this.eventListeners.set('disconnect', [handleDisconnect]);
  }

  /**
   * Remove event listeners
   */
  removeEventListeners(): void {
    if (!this.currentProvider) return;

    this.eventListeners.forEach((listeners, event) => {
      listeners.forEach(listener => {
        this.currentProvider?.removeListener(event, listener);
      });
    });

    this.eventListeners.clear();
  }

  /**
   * Add event listener
   */
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  }

  // Private methods for getting specific wallet providers

  private getMetaMaskProvider(): WalletProvider {
    const provider = WalletUtils.getWalletProvider(WalletType.METAMASK);
    if (!provider) {
      throw {
        type: WalletErrorType.WALLET_NOT_FOUND,
        message: 'MetaMask not found'
      };
    }
    return provider;
  }

  private async getCoinbaseProvider(): Promise<WalletProvider> {
    // First try to get injected Coinbase Wallet
    const injectedProvider = WalletUtils.getWalletProvider(WalletType.COINBASE);
    if (injectedProvider) {
      return injectedProvider;
    }

    // If not found, try to initialize Coinbase Wallet SDK
    try {
      const { CoinbaseWalletSDK } = await import('@coinbase/wallet-sdk');
      
      const coinbaseWallet = new CoinbaseWalletSDK({
        appName: 'Reelverse',
        appLogoUrl: 'https://reelverse.com/logo.png',
        darkMode: false
      });

      const provider = coinbaseWallet.makeWeb3Provider('https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', 1);
      
      return provider as any;
    } catch (error) {
      throw {
        type: WalletErrorType.WALLET_NOT_FOUND,
        message: 'Coinbase Wallet not found and SDK initialization failed'
      };
    }
  }

  private getPhantomProvider(): WalletProvider {
    const provider = WalletUtils.getWalletProvider(WalletType.PHANTOM);
    if (!provider) {
      throw {
        type: WalletErrorType.WALLET_NOT_FOUND,
        message: 'Phantom Wallet not found'
      };
    }
    return provider;
  }

  private getTrustProvider(): WalletProvider {
    const provider = WalletUtils.getWalletProvider(WalletType.TRUST);
    if (!provider) {
      throw {
        type: WalletErrorType.WALLET_NOT_FOUND,
        message: 'Trust Wallet not found'
      };
    }
    return provider;
  }

  private getRainbowProvider(): WalletProvider {
    const provider = WalletUtils.getWalletProvider(WalletType.RAINBOW);
    if (!provider) {
      throw {
        type: WalletErrorType.WALLET_NOT_FOUND,
        message: 'Rainbow Wallet not found'
      };
    }
    return provider;
  }

  private async getWalletConnectProvider(): Promise<WalletProvider> {
    try {
      // Dynamic import for WalletConnect
      const WalletConnectProvider = (await import('@walletconnect/web3-provider')).default;
      
      const provider = new WalletConnectProvider({
        infuraId: "9aa3d95b3bc440fa88ea12eaa4456161", // Replace with your Infura ID
        rpc: {
          1: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
          137: "https://polygon-rpc.com",
          56: "https://bsc-dataseed1.binance.org",
          42161: "https://arb1.arbitrum.io/rpc",
          10: "https://mainnet.optimism.io",
          43114: "https://api.avax.network/ext/bc/C/rpc"
        },
        chainId: 1,
        qrcode: true,
        qrcodeModalOptions: {
          mobileLinks: [
            "rainbow",
            "metamask",
            "argent",
            "trust",
            "imtoken",
            "pillar"
          ]
        }
      });

      // Enable the provider
      await provider.enable();
      
      return provider as any;
    } catch (error) {
      throw {
        type: WalletErrorType.WALLET_NOT_FOUND,
        message: 'WalletConnect initialization failed'
      };
    }
  }
}