import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWeb3 } from './useWeb3';
import { useWallet } from '../../contexts/WalletContext';

export interface Web3QueryOptions {
  enabled?: boolean;
  refetchInterval?: number;
  staleTime?: number;
  cacheTime?: number;
}

// Query key factories
export const web3QueryKeys = {
  all: ['web3'] as const,
  blockchain: () => [...web3QueryKeys.all, 'blockchain'] as const,
  contract: (address: string) => [...web3QueryKeys.all, 'contract', address] as const,
  contractFunction: (address: string, functionName: string, args: any[]) => 
    [...web3QueryKeys.contract(address), functionName, args] as const,
  balance: (address: string, chainId: number) => 
    [...web3QueryKeys.all, 'balance', address, chainId] as const,
  transaction: (txHash: string) => [...web3QueryKeys.all, 'transaction', txHash] as const,
  block: (blockNumber: number) => [...web3QueryKeys.all, 'block', blockNumber] as const,
};

// Hook for blockchain state
export const useBlockchainState = (options: Web3QueryOptions = {}) => {
  const { blockchainState, refreshState } = useWeb3();
  const { isConnected } = useWallet();

  return useQuery({
    queryKey: web3QueryKeys.blockchain(),
    queryFn: async () => {
      await refreshState();
      return blockchainState;
    },
    enabled: isConnected && (options.enabled ?? true),
    refetchInterval: options.refetchInterval ?? 30000, // 30 seconds
    staleTime: options.staleTime ?? 10000, // 10 seconds
    gcTime: options.cacheTime ?? 300000, // 5 minutes
  });
};

// Hook for contract read operations
export const useContractRead = (
  address: string,
  abi: any[],
  functionName: string,
  args: any[] = [],
  options: Web3QueryOptions = {}
) => {
  const { readContract } = useWeb3();
  const { isConnected } = useWallet();

  return useQuery({
    queryKey: web3QueryKeys.contractFunction(address, functionName, args),
    queryFn: () => readContract(address, abi, functionName, args),
    enabled: isConnected && !!address && !!abi && (options.enabled ?? true),
    refetchInterval: options.refetchInterval,
    staleTime: options.staleTime ?? 30000, // 30 seconds
    gcTime: options.cacheTime ?? 300000, // 5 minutes
  });
};

// Hook for contract write operations
export const useContractWrite = (
  address: string,
  abi: any[],
  functionName: string
) => {
  const { writeContract, waitForTransaction } = useWeb3();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ args = [], options = {} }: { args?: any[]; options?: any }) => {
      const tx = await writeContract(address, abi, functionName, args, options);
      
      // Wait for transaction confirmation
      const receipt = await waitForTransaction(tx.hash);
      
      return { tx, receipt };
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: web3QueryKeys.contract(address) });
      queryClient.invalidateQueries({ queryKey: web3QueryKeys.blockchain() });
    },
  });
};

// Hook for balance queries
export const useBalance = (
  address?: string,
  options: Web3QueryOptions = {}
) => {
  const { blockchainState } = useWeb3();
  const { account, chainId, isConnected } = useWallet();
  
  const targetAddress = address || account;
  const targetChainId = chainId;

  return useQuery({
    queryKey: web3QueryKeys.balance(targetAddress || '', targetChainId || 0),
    queryFn: async () => {
      if (targetAddress === account) {
        return blockchainState.balance;
      }
      // For other addresses, would need to implement balance fetching
      return null;
    },
    enabled: isConnected && !!targetAddress && !!targetChainId && (options.enabled ?? true),
    refetchInterval: options.refetchInterval ?? 30000,
    staleTime: options.staleTime ?? 15000,
    gcTime: options.cacheTime ?? 300000,
  });
};

// Hook for transaction queries
export const useTransaction = (
  txHash?: string,
  options: Web3QueryOptions = {}
) => {
  const { getTransaction } = useWeb3();
  const { isConnected } = useWallet();

  return useQuery({
    queryKey: web3QueryKeys.transaction(txHash || ''),
    queryFn: () => getTransaction(txHash!),
    enabled: isConnected && !!txHash && (options.enabled ?? true),
    refetchInterval: options.refetchInterval,
    staleTime: options.staleTime ?? 60000, // 1 minute
    gcTime: options.cacheTime ?? 600000, // 10 minutes
  });
};

// Hook for block queries
export const useBlock = (
  blockNumber?: number,
  options: Web3QueryOptions = {}
) => {
  const { getBlock } = useWeb3();
  const { isConnected } = useWallet();

  return useQuery({
    queryKey: web3QueryKeys.block(blockNumber || 0),
    queryFn: () => getBlock(blockNumber!),
    enabled: isConnected && !!blockNumber && (options.enabled ?? true),
    refetchInterval: options.refetchInterval,
    staleTime: options.staleTime ?? 120000, // 2 minutes
    gcTime: options.cacheTime ?? 600000, // 10 minutes
  });
};

// Hook for multiple contract reads
export const useMultipleContractReads = (
  calls: Array<{
    address: string;
    abi: any[];
    functionName: string;
    args?: any[];
  }>,
  options: Web3QueryOptions = {}
) => {
  const { readContract } = useWeb3();
  const { isConnected } = useWallet();

  return useQuery({
    queryKey: ['web3', 'multipleReads', calls],
    queryFn: async () => {
      const results = await Promise.allSettled(
        calls.map(call => 
          readContract(call.address, call.abi, call.functionName, call.args || [])
        )
      );
      
      return results.map((result, index) => ({
        ...calls[index],
        status: result.status,
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null,
      }));
    },
    enabled: isConnected && calls.length > 0 && (options.enabled ?? true),
    refetchInterval: options.refetchInterval,
    staleTime: options.staleTime ?? 30000,
    gcTime: options.cacheTime ?? 300000,
  });
};

// Hook for gas price
export const useGasPrice = (options: Web3QueryOptions = {}) => {
  const { getGasPrice } = useWeb3();
  const { isConnected } = useWallet();

  return useQuery({
    queryKey: [...web3QueryKeys.all, 'gasPrice'],
    queryFn: getGasPrice,
    enabled: isConnected && (options.enabled ?? true),
    refetchInterval: options.refetchInterval ?? 15000, // 15 seconds
    staleTime: options.staleTime ?? 10000,
    gcTime: options.cacheTime ?? 60000,
  });
};

// Hook for block number
export const useBlockNumber = (options: Web3QueryOptions = {}) => {
  const { getBlockNumber } = useWeb3();
  const { isConnected } = useWallet();

  return useQuery({
    queryKey: [...web3QueryKeys.all, 'blockNumber'],
    queryFn: getBlockNumber,
    enabled: isConnected && (options.enabled ?? true),
    refetchInterval: options.refetchInterval ?? 12000, // 12 seconds (Polygon block time)
    staleTime: options.staleTime ?? 6000,
    gcTime: options.cacheTime ?? 60000,
  });
};