import { NetworkConfig, SupportedChainId } from '../../types/wallet';
import { NETWORK_CONFIGS, DEFAULT_CHAIN_ID } from '../../constants/wallet';
import { WalletUtils } from '../../utils/walletUtils';

export class NetworkService {
  private static instance: NetworkService;
  private networkConfigs: Record<number, NetworkConfig>;

  private constructor() {
    this.networkConfigs = { ...NETWORK_CONFIGS };
  }

  static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  /**
   * Get all supported network configurations
   */
  getSupportedNetworks(): NetworkConfig[] {
    return Object.values(this.networkConfigs);
  }

  /**
   * Get network configuration by chain ID
   */
  getNetworkConfig(chainId: number): NetworkConfig | null {
    return this.networkConfigs[chainId] || null;
  }

  /**
   * Check if a chain ID is supported
   */
  isSupportedNetwork(chainId: number): boolean {
    return chainId in this.networkConfigs;
  }

  /**
   * Get RPC URL for a specific network
   */
  getRpcUrl(chainId: number): string {
    const config = this.getNetworkConfig(chainId);
    return config?.rpcUrl || this.networkConfigs[DEFAULT_CHAIN_ID].rpcUrl;
  }

  /**
   * Get block explorer URL for a specific network
   */
  getExplorerUrl(chainId: number): string {
    const config = this.getNetworkConfig(chainId);
    return config?.blockExplorerUrl || this.networkConfigs[DEFAULT_CHAIN_ID].blockExplorerUrl;
  }

  /**
   * Get network name by chain ID
   */
  getNetworkName(chainId: number): string {
    return WalletUtils.getNetworkName(chainId);
  }

  /**
   * Get network symbol by chain ID
   */
  getNetworkSymbol(chainId: number): string {
    return WalletUtils.getNetworkSymbol(chainId);
  }

  /**
   * Get network icon by chain ID
   */
  getNetworkIcon(chainId: number): string {
    return WalletUtils.getNetworkIcon(chainId);
  }

  /**
   * Get network color by chain ID
   */
  getNetworkColor(chainId: number): string {
    return WalletUtils.getNetworkColor(chainId);
  }

  /**
   * Format chain ID for wallet requests (hex format)
   */
  formatChainId(chainId: number): string {
    return WalletUtils.formatChainId(chainId);
  }

  /**
   * Parse chain ID from hex string
   */
  parseChainId(hexChainId: string): number {
    return WalletUtils.parseChainId(hexChainId);
  }

  /**
   * Get network configuration for wallet addition
   */
  getNetworkAddParams(chainId: number): any {
    const config = this.getNetworkConfig(chainId);
    if (!config) {
      throw new Error(`Unsupported network: ${chainId}`);
    }

    return {
      chainId: this.formatChainId(chainId),
      chainName: config.name,
      nativeCurrency: {
        name: config.name,
        symbol: config.symbol,
        decimals: config.decimals
      },
      rpcUrls: [config.rpcUrl],
      blockExplorerUrls: [config.blockExplorerUrl]
    };
  }

  /**
   * Validate network configuration
   */
  validateNetworkConfig(config: NetworkConfig): boolean {
    return !!(
      config.chainId &&
      config.name &&
      config.symbol &&
      config.rpcUrl &&
      config.blockExplorerUrl &&
      typeof config.decimals === 'number' &&
      config.decimals > 0
    );
  }

  /**
   * Get default network configuration
   */
  getDefaultNetwork(): NetworkConfig {
    return this.networkConfigs[DEFAULT_CHAIN_ID];
  }

  /**
   * Get network configuration for switch network request
   */
  getSwitchNetworkParams(chainId: number): any {
    return {
      chainId: this.formatChainId(chainId)
    };
  }

  /**
   * Check if network requires adding before switching
   */
  requiresNetworkAddition(chainId: number): boolean {
    // Most wallets have Ethereum mainnet by default
    // Other networks typically need to be added
    return chainId !== SupportedChainId.ETHEREUM;
  }

  /**
   * Get network status information
   */
  getNetworkStatus(chainId: number): {
    isSupported: boolean;
    isMainnet: boolean;
    isTestnet: boolean;
    requiresAddition: boolean;
  } {
    const isSupported = this.isSupportedNetwork(chainId);
    const isMainnet = [
      SupportedChainId.ETHEREUM,
      SupportedChainId.POLYGON,
      SupportedChainId.BNB_CHAIN,
      SupportedChainId.ARBITRUM,
      SupportedChainId.OPTIMISM,
      SupportedChainId.AVALANCHE
    ].includes(chainId as SupportedChainId);

    return {
      isSupported,
      isMainnet,
      isTestnet: !isMainnet && isSupported,
      requiresAddition: this.requiresNetworkAddition(chainId)
    };
  }
}