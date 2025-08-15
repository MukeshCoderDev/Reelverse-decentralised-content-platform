import { useState, useEffect, useCallback } from 'react';
import { web3Service, BlockchainState } from '../../services/web3Service';
import { useWallet } from '../../contexts/WalletContext';

export interface UseWeb3Return {
  // State
  blockchainState: BlockchainState;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refreshState: () => Promise<void>;
  readContract: (address: string, abi: any[], functionName: string, args?: any[]) => Promise<any>;
  writeContract: (address: string, abi: any[], functionName: string, args?: any[], options?: any) => Promise<any>;
  waitForTransaction: (txHash: string, confirmations?: number) => Promise<any>;
  estimateGas: (to: string, data: string, value?: string) => Promise<bigint>;
  sendNativeToken: (to: string, amount: string) => Promise<any>;
  
  // Utilities
  formatTokenAmount: (amount: bigint | string, decimals?: number) => string;
  parseTokenAmount: (amount: string, decimals?: number) => bigint;
  isValidAddress: (address: string) => boolean;
  getTransactionUrl: (txHash: string) => string | null;
  getAddressUrl: (address: string) => string | null;
}

export const useWeb3 = (): UseWeb3Return => {
  const { isConnected, chainId } = useWallet();
  const [blockchainState, setBlockchainState] = useState<BlockchainState>({
    isConnected: false,
    chainId: null,
    account: null,
    balance: null,
    blockNumber: null,
    gasPrice: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Web3 service when wallet connects
  useEffect(() => {
    const initializeWeb3 = async () => {
      if (isConnected && window.ethereum) {
        try {
          setIsLoading(true);
          setError(null);
          
          await web3Service.initialize();
          await refreshState();
        } catch (err) {
          console.error('Failed to initialize Web3:', err);
          setError(err instanceof Error ? err.message : 'Failed to initialize Web3');
        } finally {
          setIsLoading(false);
        }
      } else {
        // Reset state when disconnected
        setBlockchainState({
          isConnected: false,
          chainId: null,
          account: null,
          balance: null,
          blockNumber: null,
          gasPrice: null
        });
        web3Service.cleanup();
      }
    };

    initializeWeb3();
  }, [isConnected]);

  // Refresh blockchain state
  const refreshState = useCallback(async () => {
    try {
      setError(null);
      const state = await web3Service.getBlockchainState();
      setBlockchainState(state);
    } catch (err) {
      console.error('Failed to refresh blockchain state:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh state');
    }
  }, []);

  // Contract read operation
  const readContract = useCallback(async (
    address: string,
    abi: any[],
    functionName: string,
    args: any[] = []
  ) => {
    try {
      setError(null);
      return await web3Service.readContract(address, abi, functionName, args);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Contract read failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Contract write operation
  const writeContract = useCallback(async (
    address: string,
    abi: any[],
    functionName: string,
    args: any[] = [],
    options: any = {}
  ) => {
    try {
      setError(null);
      return await web3Service.writeContract(address, abi, functionName, args, options);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Contract write failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Wait for transaction confirmation
  const waitForTransaction = useCallback(async (
    txHash: string,
    confirmations: number = 1
  ) => {
    try {
      setError(null);
      return await web3Service.waitForTransaction(txHash, confirmations);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transaction wait failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Estimate gas
  const estimateGas = useCallback(async (
    to: string,
    data: string,
    value?: string
  ) => {
    try {
      setError(null);
      return await web3Service.estimateGas(to, data, value);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gas estimation failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Send native token
  const sendNativeToken = useCallback(async (
    to: string,
    amount: string
  ) => {
    try {
      setError(null);
      return await web3Service.sendNativeToken(to, amount);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Token transfer failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Utility functions
  const formatTokenAmount = useCallback((amount: bigint | string, decimals: number = 18) => {
    return web3Service.formatTokenAmount(amount, decimals);
  }, []);

  const parseTokenAmount = useCallback((amount: string, decimals: number = 18) => {
    return web3Service.parseTokenAmount(amount, decimals);
  }, []);

  const isValidAddress = useCallback((address: string) => {
    return web3Service.isValidAddress(address);
  }, []);

  const getTransactionUrl = useCallback((txHash: string) => {
    return chainId ? web3Service.getTransactionUrl(txHash, chainId) : null;
  }, [chainId]);

  const getAddressUrl = useCallback((address: string) => {
    return chainId ? web3Service.getAddressUrl(address, chainId) : null;
  }, [chainId]);

  return {
    // State
    blockchainState,
    isLoading,
    error,
    
    // Actions
    refreshState,
    readContract,
    writeContract,
    waitForTransaction,
    estimateGas,
    sendNativeToken,
    
    // Utilities
    formatTokenAmount,
    parseTokenAmount,
    isValidAddress,
    getTransactionUrl,
    getAddressUrl
  };
};