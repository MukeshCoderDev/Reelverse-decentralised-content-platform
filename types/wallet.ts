// Core wallet type definitions for multi-chain Web3 integration

export enum WalletType {
  METAMASK = 'metamask',
  WALLET_CONNECT = 'walletconnect',
  COINBASE = 'coinbase',
  PHANTOM = 'phantom',
  TRUST = 'trust',
  RAINBOW = 'rainbow'
}

export enum SupportedChainId {
  ETHEREUM = 1,
  SEPOLIA = 11155111,
  LOCALHOST = 31337,
  POLYGON = 137,
  BNB_CHAIN = 56,
  ARBITRUM = 42161,
  OPTIMISM = 10,
  AVALANCHE = 43114
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  rpcUrl: string;
  blockExplorerUrl: string;
  iconUrl: string;
  color: string;
}

export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  account: string | null;
  chainId: number | null;
  balance: string | null;
  balanceLoading: boolean;
  walletType: WalletType | null;
  error: string | null;
  // SIWE Authentication State
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  session: string | null;
  authError: string | null;
}

export interface ConnectionResult {
  success: boolean;
  account?: string;
  chainId?: number;
  error?: string;
}

export interface WalletContextType {
  // Connection State
  isConnected: boolean;
  isConnecting: boolean;
  account: string | null;
  
  // Network State
  chainId: number | null;
  networkName: string | null;
  
  // Balance Information
  balance: string | null;
  balanceLoading: boolean;
  
  // Wallet Information
  walletType: WalletType | null;
  
  // SIWE Authentication State
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  session: string | null;
  authError: string | null;
  
  // Actions
  connect: (walletType: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  switchNetwork: (chainId: number) => Promise<void>;
  
  // SIWE Authentication Actions
  authenticate: () => Promise<void>;
  logout: () => Promise<void>;
  
  // Error Handling
  error: string | null;
  clearError: () => void;
  clearAuthError: () => void;
}

export interface WalletProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isPhantom?: boolean;
  isTrust?: boolean;
  isRainbow?: boolean;
}

export interface WalletInfo {
  name: string;
  icon: string;
  description: string;
  downloadUrl: string;
  color: string;
}

// Error types for better error handling
export enum WalletErrorType {
  USER_REJECTED = 'user_rejected',
  WALLET_NOT_FOUND = 'wallet_not_found',
  NETWORK_ERROR = 'network_error',
  UNSUPPORTED_NETWORK = 'unsupported_network',
  CONNECTION_FAILED = 'connection_failed',
  TRANSACTION_FAILED = 'transaction_failed'
}

export interface WalletError {
  type: WalletErrorType;
  message: string;
  originalError?: any;
}