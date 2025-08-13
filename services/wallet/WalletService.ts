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
          return await this.getCoinbaseProvider();
        
        case WalletType.PHANTOM:
          return this.getPhantomProvider();
        
        case WalletType.TRUST:
          return this.getTrustProvider();
        
        case WalletType.RAINBOW:
          return this.getRainbowProvider();
        
        case WalletType.WALLET_CONNECT:
          return await this.getWalletConnectProvider();
        
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
      console.log(`Attempting to connect to ${walletType}...`);
      
      // Check if wallet is installed
      if (!WalletUtils.isWalletInstalled(walletType)) {
        console.error(`${walletType} wallet not detected`);
        throw {
          type: WalletErrorType.WALLET_NOT_FOUND,
          message: `${walletType} wallet not found. Please install the wallet extension and refresh the page.`
        };
      }

      console.log(`${walletType} wallet detected, getting provider...`);

      // Get provider
      const provider = await this.getProvider(walletType);
      this.currentProvider = provider;

      console.log('Provider obtained, requesting account access...');

      // Request account access with timeout
      const accounts = await Promise.race([
        provider.request({
          method: 'eth_requestAccounts'
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 30000)
        )
      ]) as string[];

      if (!accounts || accounts.length === 0) {
        throw {
          type: WalletErrorType.CONNECTION_FAILED,
          message: 'No accounts found. Please make sure your wallet is unlocked and has at least one account.'
        };
      }

      const account = accounts[0];
      console.log('Account access granted:', account);

      // Get current chain ID
      const chainId = await provider.request({
        method: 'eth_chainId'
      });

      const parsedChainId = this.networkService.parseChainId(chainId);
      console.log('Connected to chain ID:', parsedChainId);

      // Setup event listeners
      this.setupEventListeners(provider);

      return {
        success: true,
        account,
        chainId: parsedChainId
      };

    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      
      // Handle specific error cases
      if (error?.code === 4001) {
        return {
          success: false,
          error: 'Connection was cancelled. Please try again and approve the connection request.'
        };
      }
      
      if (error?.message?.includes('timeout')) {
        return {
          success: false,
          error: 'Connection timed out. Please try again and make sure your wallet is responsive.'
        };
      }

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
      console.log('WalletService: Disconnecting wallet...');
      if (this.currentProvider) {
        console.log('WalletService: Removing event listeners...');
        this.removeEventListeners();
        console.log('WalletService: Clearing current provider...');
        this.currentProvider = null;
        console.log('WalletService: Wallet disconnected successfully');
      } else {
        console.log('WalletService: No provider to disconnect');
      }
    } catch (error) {
      console.error('WalletService: Error disconnecting wallet:', error);
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
    // First try to get the provider using our utility
    let provider = WalletUtils.getWalletProvider(WalletType.METAMASK);
    
    // If not found, try alternative detection methods
    if (!provider && typeof window !== 'undefined') {
      const ethereum = (window as any).ethereum;
      
      if (ethereum) {
        // If there are multiple providers, find MetaMask
        if (ethereum.providers && Array.isArray(ethereum.providers)) {
          provider = ethereum.providers.find((p: any) => p.isMetaMask);
        }
        // If single provider and it's MetaMask
        else if (ethereum.isMetaMask) {
          provider = ethereum;
        }
        // Fallback: if ethereum exists but no specific identification, try it anyway
        else if (!provider) {
          console.warn('Ethereum provider found but MetaMask identification unclear, attempting connection...');
          provider = ethereum;
        }
      }
    }
    
    if (!provider) {
      throw {
        type: WalletErrorType.WALLET_NOT_FOUND,
        message: 'MetaMask not found. Please install MetaMask extension and refresh the page.'
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