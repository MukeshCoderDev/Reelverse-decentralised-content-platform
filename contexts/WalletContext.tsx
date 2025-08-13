import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { WalletContextType, WalletState, WalletType } from '../types/wallet';
import { WalletService } from '../services/wallet/WalletService';
import { NetworkService } from '../services/wallet/NetworkService';
import { SiweService } from '../services/siweService';
import { STORAGE_KEYS, DEFAULT_CHAIN_ID } from '../constants/wallet';
import { WalletErrorHandler } from '../utils/walletErrors';
import { BrowserProvider } from 'ethers';

// Initial state
const initialState: WalletState = {
  isConnected: false,
  isConnecting: false,
  account: null,
  chainId: null,
  balance: null,
  balanceLoading: false,
  walletType: null,
  error: null,
  // SIWE Authentication State
  isAuthenticated: false,
  isAuthenticating: false,
  session: null,
  authError: null
};

// Action types
type WalletAction =
  | { type: 'SET_CONNECTING'; payload: boolean }
  | { type: 'SET_CONNECTED'; payload: { account: string; chainId: number; walletType: WalletType } }
  | { type: 'SET_DISCONNECTED' }
  | { type: 'SET_ACCOUNT'; payload: string }
  | { type: 'SET_CHAIN_ID'; payload: number }
  | { type: 'SET_BALANCE'; payload: string | null }
  | { type: 'SET_BALANCE_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' }
  // SIWE Authentication Actions
  | { type: 'SET_AUTHENTICATING'; payload: boolean }
  | { type: 'SET_AUTHENTICATED'; payload: { session: string } }
  | { type: 'SET_UNAUTHENTICATED' }
  | { type: 'SET_AUTH_ERROR'; payload: string | null }
  | { type: 'CLEAR_AUTH_ERROR' };

// Reducer
function walletReducer(state: WalletState, action: WalletAction): WalletState {
  switch (action.type) {
    case 'SET_CONNECTING':
      return {
        ...state,
        isConnecting: action.payload,
        error: action.payload ? null : state.error
      };

    case 'SET_CONNECTED':
      return {
        ...state,
        isConnected: true,
        isConnecting: false,
        account: action.payload.account,
        chainId: action.payload.chainId,
        walletType: action.payload.walletType,
        error: null
      };

    case 'SET_DISCONNECTED':
      return {
        ...initialState
      };

    case 'SET_ACCOUNT':
      return {
        ...state,
        account: action.payload
      };

    case 'SET_CHAIN_ID':
      return {
        ...state,
        chainId: action.payload
      };

    case 'SET_BALANCE':
      return {
        ...state,
        balance: action.payload,
        balanceLoading: false
      };

    case 'SET_BALANCE_LOADING':
      return {
        ...state,
        balanceLoading: action.payload
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isConnecting: false
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };

    // SIWE Authentication Cases
    case 'SET_AUTHENTICATING':
      return {
        ...state,
        isAuthenticating: action.payload,
        authError: action.payload ? null : state.authError
      };

    case 'SET_AUTHENTICATED':
      return {
        ...state,
        isAuthenticated: true,
        isAuthenticating: false,
        session: action.payload.session,
        authError: null
      };

    case 'SET_UNAUTHENTICATED':
      return {
        ...state,
        isAuthenticated: false,
        isAuthenticating: false,
        session: null,
        authError: null
      };

    case 'SET_AUTH_ERROR':
      return {
        ...state,
        authError: action.payload,
        isAuthenticating: false
      };

    case 'CLEAR_AUTH_ERROR':
      return {
        ...state,
        authError: null
      };

    default:
      return state;
  }
}

// Create context
const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Provider component
interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(walletReducer, initialState);
  const walletService = WalletService.getInstance();
  const networkService = NetworkService.getInstance();
  const siweService = SiweService.getInstance();

  // Auto-connect and check session on mount
  useEffect(() => {
    const autoConnect = async () => {
      try {
        // Check for existing SIWE session first
        const sessionStatus = await siweService.getSession();
        if (sessionStatus.isAuthenticated && sessionStatus.session) {
          dispatch({ 
            type: 'SET_AUTHENTICATED', 
            payload: { session: sessionStatus.session } 
          });
        }

        // Then check for wallet auto-connect
        const savedWalletType = localStorage.getItem(STORAGE_KEYS.WALLET_TYPE) as WalletType;
        const autoConnectEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_CONNECT) === 'true';

        if (savedWalletType && autoConnectEnabled) {
          dispatch({ type: 'SET_CONNECTING', payload: true });
          await connect(savedWalletType);
        }
      } catch (error) {
        console.error('Auto-connect failed:', error);
        clearStoredConnection();
      }
    };

    autoConnect();
  }, []);

  // Setup wallet event listeners
  useEffect(() => {
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== state.account) {
        dispatch({ type: 'SET_ACCOUNT', payload: accounts[0] });
        // Fetch balance for new account
        if (accounts[0]) {
          fetchBalance(accounts[0]);
        }
      }
    };

    const handleChainChanged = (chainId: number) => {
      dispatch({ type: 'SET_CHAIN_ID', payload: chainId });
      // Fetch balance for new network
      if (state.account) {
        fetchBalance(state.account);
      }
    };

    const handleDisconnect = () => {
      disconnect();
    };

    // Add event listeners
    walletService.on('accountsChanged', handleAccountsChanged);
    walletService.on('chainChanged', handleChainChanged);
    walletService.on('disconnect', handleDisconnect);

    // Cleanup
    return () => {
      walletService.off('accountsChanged', handleAccountsChanged);
      walletService.off('chainChanged', handleChainChanged);
      walletService.off('disconnect', handleDisconnect);
    };
  }, [state.account]);

  // Fetch balance when account or chain changes
  useEffect(() => {
    if (state.account && state.chainId && state.isConnected) {
      fetchBalance(state.account);
    }
  }, [state.account, state.chainId, state.isConnected]);

  // Helper function to store connection data
  const storeConnection = (walletType: WalletType, account: string, chainId: number) => {
    localStorage.setItem(STORAGE_KEYS.WALLET_TYPE, walletType);
    localStorage.setItem(STORAGE_KEYS.WALLET_ACCOUNT, account);
    localStorage.setItem(STORAGE_KEYS.WALLET_CHAIN_ID, chainId.toString());
    localStorage.setItem(STORAGE_KEYS.AUTO_CONNECT, 'true');
  };

  // Helper function to clear stored connection data
  const clearStoredConnection = () => {
    localStorage.removeItem(STORAGE_KEYS.WALLET_TYPE);
    localStorage.removeItem(STORAGE_KEYS.WALLET_ACCOUNT);
    localStorage.removeItem(STORAGE_KEYS.WALLET_CHAIN_ID);
    localStorage.removeItem(STORAGE_KEYS.AUTO_CONNECT);
  };

  // Fetch balance function
  const fetchBalance = async (account: string) => {
    try {
      dispatch({ type: 'SET_BALANCE_LOADING', payload: true });
      const balance = await walletService.getBalance(account);
      dispatch({ type: 'SET_BALANCE', payload: balance });
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      dispatch({ type: 'SET_BALANCE', payload: null });
    }
  };

  // Connect function
  const connect = async (walletType: WalletType): Promise<void> => {
    try {
      dispatch({ type: 'SET_CONNECTING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const result = await walletService.connect(walletType);

      if (result.success && result.account && result.chainId !== undefined) {
        dispatch({
          type: 'SET_CONNECTED',
          payload: {
            account: result.account,
            chainId: result.chainId,
            walletType
          }
        });

        // Store connection data for auto-reconnect
        storeConnection(walletType, result.account, result.chainId);

        // Fetch initial balance
        fetchBalance(result.account);
      } else {
        throw new Error(result.error || 'Connection failed');
      }
    } catch (error: any) {
      const walletError = WalletErrorHandler.handleError(error);
      dispatch({ type: 'SET_ERROR', payload: walletError.message });
      dispatch({ type: 'SET_CONNECTING', payload: false });
      throw error;
    }
  };

  // Disconnect function
  const disconnect = async (): Promise<void> => {
    try {
      console.log('Disconnecting wallet...');
      
      // Clear SIWE session first
      if (state.isAuthenticated) {
        await siweService.logout();
      }
      
      await walletService.disconnect();
      dispatch({ type: 'SET_DISCONNECTED' });
      clearStoredConnection();
      console.log('Wallet disconnected successfully');
    } catch (error) {
      console.error('Disconnect error:', error);
      // Still clear state even if disconnect fails
      dispatch({ type: 'SET_DISCONNECTED' });
      clearStoredConnection();
      console.log('Wallet state cleared despite disconnect error');
    }
  };

  // Switch network function
  const switchNetwork = async (chainId: number): Promise<void> => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      await walletService.switchNetwork(chainId);
      dispatch({ type: 'SET_CHAIN_ID', payload: chainId });
      
      // Update stored chain ID
      localStorage.setItem(STORAGE_KEYS.WALLET_CHAIN_ID, chainId.toString());
      
      // Fetch balance for new network
      if (state.account) {
        fetchBalance(state.account);
      }
    } catch (error: any) {
      const walletError = WalletErrorHandler.handleError(error);
      dispatch({ type: 'SET_ERROR', payload: walletError.message });
      throw error;
    }
  };

  // Clear error function
  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Clear auth error function
  const clearAuthError = (): void => {
    dispatch({ type: 'CLEAR_AUTH_ERROR' });
  };

  // SIWE Authentication function
  const authenticate = async (): Promise<void> => {
    if (!state.isConnected || !state.account) {
      throw new Error('Wallet must be connected before authentication');
    }

    try {
      dispatch({ type: 'SET_AUTHENTICATING', payload: true });
      dispatch({ type: 'CLEAR_AUTH_ERROR' });

      // Get the provider from the wallet service
      const provider = new BrowserProvider(window.ethereum);
      
      // Perform SIWE authentication
      const result = await siweService.authenticate(provider, state.account);

      if (result.success && result.session) {
        dispatch({ 
          type: 'SET_AUTHENTICATED', 
          payload: { session: result.session } 
        });
      } else {
        throw new Error(result.error || 'Authentication failed');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Authentication failed';
      dispatch({ type: 'SET_AUTH_ERROR', payload: errorMessage });
      throw error;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      await siweService.logout();
      dispatch({ type: 'SET_UNAUTHENTICATED' });
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear state even if logout fails
      dispatch({ type: 'SET_UNAUTHENTICATED' });
    }
  };

  // Get network name
  const networkName = state.chainId ? networkService.getNetworkName(state.chainId) : null;

  // Context value
  const contextValue: WalletContextType = {
    // State
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    account: state.account,
    chainId: state.chainId,
    networkName,
    balance: state.balance,
    balanceLoading: state.balanceLoading,
    walletType: state.walletType,
    error: state.error,

    // SIWE Authentication State
    isAuthenticated: state.isAuthenticated,
    isAuthenticating: state.isAuthenticating,
    session: state.session,
    authError: state.authError,

    // Actions
    connect,
    disconnect,
    switchNetwork,
    clearError,

    // SIWE Authentication Actions
    authenticate,
    logout,
    clearAuthError
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

// Hook to use wallet context
export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};