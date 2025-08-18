import { NetworkConfig, WalletInfo, WalletType, SupportedChainId } from '../types/wallet';

// Supported network configurations
export const NETWORK_CONFIGS: Record<number, NetworkConfig> = {
  [SupportedChainId.ETHEREUM]: {
    chainId: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    blockExplorerUrl: 'https://etherscan.io',
    iconUrl: '🔷',
    color: 'from-blue-400 to-blue-600'
  },
  [SupportedChainId.SEPOLIA]: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    blockExplorerUrl: 'https://sepolia.etherscan.io',
    iconUrl: '🧪',
    color: 'from-green-400 to-blue-500'
  },
  [SupportedChainId.LOCALHOST]: {
    chainId: 31337,
    name: 'Localhost',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'http://127.0.0.1:8545',
    blockExplorerUrl: 'http://localhost:8545',
    iconUrl: '🏠',
    color: 'from-gray-400 to-gray-600'
  },
  [SupportedChainId.POLYGON]: {
    chainId: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    decimals: 18,
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorerUrl: 'https://polygonscan.com',
    iconUrl: '🟣',
    color: 'from-purple-400 to-purple-600'
  },
  [SupportedChainId.BNB_CHAIN]: {
    chainId: 56,
    name: 'BNB Chain',
    symbol: 'BNB',
    decimals: 18,
    rpcUrl: 'https://bsc-dataseed1.binance.org',
    blockExplorerUrl: 'https://bscscan.com',
    iconUrl: '🟡',
    color: 'from-yellow-400 to-yellow-600'
  },
  [SupportedChainId.ARBITRUM]: {
    chainId: 42161,
    name: 'Arbitrum',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorerUrl: 'https://arbiscan.io',
    iconUrl: '🔵',
    color: 'from-blue-500 to-blue-700'
  },
  [SupportedChainId.OPTIMISM]: {
    chainId: 10,
    name: 'Optimism',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://mainnet.optimism.io',
    blockExplorerUrl: 'https://optimistic.etherscan.io',
    iconUrl: '🔴',
    color: 'from-red-400 to-red-600'
  },
  [SupportedChainId.AVALANCHE]: {
    chainId: 43114,
    name: 'Avalanche',
    symbol: 'AVAX',
    decimals: 18,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    blockExplorerUrl: 'https://snowtrace.io',
    iconUrl: '🔺',
    color: 'from-red-500 to-orange-500'
  }
};

// Wallet information for UI display
export const WALLET_INFO: Record<WalletType, WalletInfo> = {
  [WalletType.METAMASK]: {
    name: 'MetaMask',
    icon: '🦊',
    description: 'Connect using browser wallet',
    downloadUrl: 'https://metamask.io/download/',
    color: 'from-orange-500 to-yellow-500'
  },
  [WalletType.WALLET_CONNECT]: {
    name: 'WalletConnect',
    icon: 'WC',
    description: 'Connect using mobile wallet',
    downloadUrl: 'https://walletconnect.com/',
    color: 'from-blue-500 to-purple-600'
  },
  [WalletType.COINBASE]: {
    name: 'Coinbase Wallet',
    icon: 'CB',
    description: 'Connect using Coinbase',
    downloadUrl: 'https://www.coinbase.com/wallet',
    color: 'from-blue-600 to-blue-800'
  },
  [WalletType.PHANTOM]: {
    name: 'Phantom',
    icon: '👻',
    description: 'Leading Solana wallet',
    downloadUrl: 'https://phantom.app/',
    color: 'from-purple-500 to-pink-500'
  },
  [WalletType.TRUST]: {
    name: 'Trust Wallet',
    icon: '🛡️',
    description: 'Multi-chain mobile wallet',
    downloadUrl: 'https://trustwallet.com/',
    color: 'from-blue-500 to-teal-500'
  },
  [WalletType.RAINBOW]: {
    name: 'Rainbow',
    icon: '🌈',
    description: 'Beautiful Ethereum wallet',
    downloadUrl: 'https://rainbow.me/',
    color: 'from-pink-500 to-purple-500'
  }
};

// Storage keys for persistence
export const STORAGE_KEYS = {
  WALLET_TYPE: 'reelverse_wallet_type',
  WALLET_ACCOUNT: 'reelverse_wallet_account',
  WALLET_CHAIN_ID: 'reelverse_wallet_chain_id',
  AUTO_CONNECT: 'reelverse_auto_connect'
} as const;

// Default network based on environment
export const DEFAULT_CHAIN_ID = (() => {
  // Check if we're in development mode
  const isDevelopment = import.meta.env?.MODE === 'development' || 
                       typeof window !== 'undefined' && window.location.hostname === 'localhost';
  
  // For localhost development, default to localhost network
  if (isDevelopment && window?.location?.hostname === 'localhost') {
    return SupportedChainId.LOCALHOST;
  }
  
  // For other development, use Sepolia testnet
  if (isDevelopment) {
    return SupportedChainId.SEPOLIA;
  }
  
  // For production, use Ethereum mainnet
  return SupportedChainId.ETHEREUM;
})();

// Supported wallet types array for iteration
export const SUPPORTED_WALLETS = Object.values(WalletType);

// Supported chain IDs array for iteration
export const SUPPORTED_CHAIN_IDS = Object.values(SupportedChainId).filter(
  (value): value is number => typeof value === 'number'
);

// Development helper functions
export const isDevelopment = () => {
  return import.meta.env?.MODE === 'development' || 
         typeof window !== 'undefined' && window.location.hostname === 'localhost';
};

export const isLocalhost = () => {
  return typeof window !== 'undefined' && 
         (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
};

// Get recommended network for current environment
export const getRecommendedNetwork = (): SupportedChainId => {
  if (isLocalhost()) {
    return SupportedChainId.LOCALHOST;
  }
  if (isDevelopment()) {
    return SupportedChainId.SEPOLIA;
  }
  return SupportedChainId.ETHEREUM;
};