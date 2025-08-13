import { WalletType, SupportedChainId } from '../types/wallet';
import { NETWORK_CONFIGS } from '../constants/wallet';

export class WalletUtils {
  /**
   * Format wallet address for display (shortened version)
   */
  static formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Format balance for display
   */
  static formatBalance(balance: string, decimals: number = 18): string {
    try {
      const balanceNum = parseFloat(balance);
      if (balanceNum === 0) return '0';
      if (balanceNum < 0.0001) return '< 0.0001';
      if (balanceNum < 1) return balanceNum.toFixed(4);
      if (balanceNum < 1000) return balanceNum.toFixed(3);
      return balanceNum.toFixed(2);
    } catch {
      return '0';
    }
  }

  /**
   * Convert wei to ether
   */
  static weiToEther(wei: string): string {
    try {
      const weiNum = BigInt(wei);
      const etherNum = Number(weiNum) / Math.pow(10, 18);
      return etherNum.toString();
    } catch {
      return '0';
    }
  }

  /**
   * Convert ether to wei
   */
  static etherToWei(ether: string): string {
    try {
      const etherNum = parseFloat(ether);
      const weiNum = BigInt(Math.floor(etherNum * Math.pow(10, 18)));
      return weiNum.toString();
    } catch {
      return '0';
    }
  }

  /**
   * Check if chain ID is supported
   */
  static isSupportedChain(chainId: number): boolean {
    return Object.values(SupportedChainId).includes(chainId as SupportedChainId);
  }

  /**
   * Get network name from chain ID
   */
  static getNetworkName(chainId: number): string {
    const config = NETWORK_CONFIGS[chainId];
    return config?.name || 'Unknown Network';
  }

  /**
   * Get network symbol from chain ID
   */
  static getNetworkSymbol(chainId: number): string {
    const config = NETWORK_CONFIGS[chainId];
    return config?.symbol || 'ETH';
  }

  /**
   * Get network icon from chain ID
   */
  static getNetworkIcon(chainId: number): string {
    const config = NETWORK_CONFIGS[chainId];
    return config?.iconUrl || '🔷';
  }

  /**
   * Get network color from chain ID
   */
  static getNetworkColor(chainId: number): string {
    const config = NETWORK_CONFIGS[chainId];
    return config?.color || 'from-blue-400 to-blue-600';
  }

  /**
   * Format chain ID for wallet requests
   */
  static formatChainId(chainId: number): string {
    return `0x${chainId.toString(16)}`;
  }

  /**
   * Parse chain ID from hex string
   */
  static parseChainId(hexChainId: string): number {
    return parseInt(hexChainId, 16);
  }

  /**
   * Check if wallet is installed
   */
  static isWalletInstalled(walletType: WalletType): boolean {
    if (typeof window === 'undefined') return false;

    switch (walletType) {
      case WalletType.METAMASK:
        return !!(window as any).ethereum?.isMetaMask;
      
      case WalletType.COINBASE:
        return !!(window as any).ethereum?.isCoinbaseWallet;
      
      case WalletType.PHANTOM:
        return !!(window as any).phantom?.ethereum;
      
      case WalletType.TRUST:
        return !!(window as any).ethereum?.isTrust;
      
      case WalletType.RAINBOW:
        return !!(window as any).ethereum?.isRainbow;
      
      case WalletType.WALLET_CONNECT:
        // WalletConnect doesn't require installation
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Get wallet provider from window
   */
  static getWalletProvider(walletType: WalletType): any {
    if (typeof window === 'undefined') return null;

    switch (walletType) {
      case WalletType.METAMASK:
        return (window as any).ethereum?.isMetaMask ? (window as any).ethereum : null;
      
      case WalletType.COINBASE:
        return (window as any).ethereum?.isCoinbaseWallet ? (window as any).ethereum : null;
      
      case WalletType.PHANTOM:
        return (window as any).phantom?.ethereum;
      
      case WalletType.TRUST:
        return (window as any).ethereum?.isTrust ? (window as any).ethereum : null;
      
      case WalletType.RAINBOW:
        return (window as any).ethereum?.isRainbow ? (window as any).ethereum : null;
      
      default:
        return null;
    }
  }

  /**
   * Copy text to clipboard
   */
  static async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const result = document.execCommand('copy');
        textArea.remove();
        return result;
      }
    } catch {
      return false;
    }
  }

  /**
   * Validate Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Generate a unique request ID for wallet operations
   */
  static generateRequestId(): string {
    return `reelverse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}