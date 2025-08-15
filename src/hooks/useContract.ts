import { useState, useCallback, useEffect } from 'react';
import { useWeb3 } from './useWeb3';
import { ethers } from 'ethers';

export interface UseContractReturn {
  // State
  isLoading: boolean;
  error: string | null;
  
  // Actions
  read: (functionName: string, args?: any[]) => Promise<any>;
  write: (functionName: string, args?: any[], options?: any) => Promise<ethers.ContractTransactionResponse>;
  estimateGas: (functionName: string, args?: any[], options?: any) => Promise<bigint>;
  
  // Event handling
  watchEvent: (eventName: string, callback: (log: any) => void, fromBlock?: number) => Promise<() => void>;
  getPastEvents: (eventName: string, fromBlock?: number, toBlock?: number) => Promise<any[]>;
  
  // Utilities
  clearError: () => void;
}

export const useContract = (
  address: string,
  abi: any[]
): UseContractReturn => {
  const { readContract, writeContract, estimateGas: estimateGasWeb3 } = useWeb3();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate inputs
  useEffect(() => {
    if (!address || !abi) {
      setError('Contract address and ABI are required');
    } else if (!ethers.isAddress(address)) {
      setError('Invalid contract address');
    } else {
      setError(null);
    }
  }, [address, abi]);

  // Read contract function
  const read = useCallback(async (
    functionName: string,
    args: any[] = []
  ) => {
    if (error) {
      throw new Error(error);
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const result = await readContract(address, abi, functionName, args);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Contract read failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, abi, readContract, error]);

  // Write contract function
  const write = useCallback(async (
    functionName: string,
    args: any[] = [],
    options: any = {}
  ) => {
    if (error) {
      throw new Error(error);
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const tx = await writeContract(address, abi, functionName, args, options);
      return tx;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Contract write failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, abi, writeContract, error]);

  // Estimate gas for contract function
  const estimateGas = useCallback(async (
    functionName: string,
    args: any[] = [],
    options: any = {}
  ) => {
    if (error) {
      throw new Error(error);
    }

    try {
      setError(null);
      
      // Create contract interface to encode function data
      const contractInterface = new ethers.Interface(abi);
      const data = contractInterface.encodeFunctionData(functionName, args);
      
      const gasEstimate = await estimateGasWeb3(address, data, options.value);
      return gasEstimate;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gas estimation failed';
      setError(errorMessage);
      throw err;
    }
  }, [address, abi, estimateGasWeb3, error]);

  // Watch contract events (placeholder - would need Web3Service enhancement)
  const watchEvent = useCallback(async (
    eventName: string,
    callback: (log: any) => void,
    fromBlock?: number
  ) => {
    if (error) {
      throw new Error(error);
    }

    try {
      setError(null);
      
      // This would need to be implemented in Web3Service
      // For now, return a no-op unsubscribe function
      console.log(`Watching event ${eventName} on contract ${address}`);
      
      return () => {
        console.log(`Stopped watching event ${eventName}`);
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Event watching failed';
      setError(errorMessage);
      throw err;
    }
  }, [address, error]);

  // Get past events (placeholder - would need Web3Service enhancement)
  const getPastEvents = useCallback(async (
    eventName: string,
    fromBlock?: number,
    toBlock?: number
  ) => {
    if (error) {
      throw new Error(error);
    }

    try {
      setError(null);
      
      // This would need to be implemented in Web3Service
      console.log(`Getting past events ${eventName} from contract ${address}`);
      
      return [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get past events';
      setError(errorMessage);
      throw err;
    }
  }, [address, error]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    isLoading,
    error,
    
    // Actions
    read,
    write,
    estimateGas,
    
    // Event handling
    watchEvent,
    getPastEvents,
    
    // Utilities
    clearError
  };
};