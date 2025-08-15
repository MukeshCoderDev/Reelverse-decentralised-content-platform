import { ethers } from 'ethers';
import { createPublicClient, createWalletClient, custom, http, PublicClient, WalletClient } from 'viem';
import { polygon, polygonMumbai } from 'viem/chains';

export interface Web3Config {
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface ContractConfig {
  address: string;
  abi: any[];
}

export interface BlockchainState {
  isConnected: boolean;
  chainId: number | null;
  account: string | null;
  balance: string | null;
  blockNumber: number | null;
  gasPrice: string | null;
}

export class Web3Service {
  private static instance: Web3Service;
  private publicClient: PublicClient | null = null;
  private walletClient: WalletClient | null = null;
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  
  private readonly configs: Record<number, Web3Config> = {
    137: { // Polygon Mainnet
      chainId: 137,
      rpcUrl: 'https://polygon-rpc.com',
      blockExplorer: 'https://polygonscan.com',
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      }
    },
    80001: { // Polygon Mumbai Testnet
      chainId: 80001,
      rpcUrl: 'https://rpc-mumbai.maticvigil.com',
      blockExplorer: 'https://mumbai.polygonscan.com',
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      }
    }
  };

  private constructor() {}

  public static getInstance(): Web3Service {
    if (!Web3Service.instance) {
      Web3Service.instance = new Web3Service();
    }
    return Web3Service.instance;
  }

  /**
   * Initialize Web3 clients with the current provider
   */
  async initialize(provider?: any): Promise<void> {
    try {
      if (provider || window.ethereum) {
        const ethProvider = provider || window.ethereum;
        
        // Initialize ethers provider and signer
        this.provider = new ethers.BrowserProvider(ethProvider);
        this.signer = await this.provider.getSigner();
        
        // Get current network
        const network = await this.provider.getNetwork();
        const chainId = Number(network.chainId);
        
        // Initialize viem clients
        this.publicClient = createPublicClient({
          chain: chainId === 137 ? polygon : polygonMumbai,
          transport: custom(ethProvider)
        });
        
        this.walletClient = createWalletClient({
          chain: chainId === 137 ? polygon : polygonMumbai,
          transport: custom(ethProvider)
        });
        
        console.log('Web3Service initialized for chain:', chainId);
      }
    } catch (error) {
      console.error('Failed to initialize Web3Service:', error);
      throw error;
    }
  }

  /**
   * Get current blockchain state
   */
  async getBlockchainState(): Promise<BlockchainState> {
    try {
      if (!this.provider || !this.publicClient) {
        return {
          isConnected: false,
          chainId: null,
          account: null,
          balance: null,
          blockNumber: null,
          gasPrice: null
        };
      }

      const network = await this.provider.getNetwork();
      const accounts = await this.provider.listAccounts();
      const account = accounts[0]?.address || null;
      
      let balance = null;
      if (account) {
        const balanceWei = await this.provider.getBalance(account);
        balance = ethers.formatEther(balanceWei);
      }

      const blockNumber = await this.publicClient.getBlockNumber();
      const gasPrice = await this.publicClient.getGasPrice();

      return {
        isConnected: true,
        chainId: Number(network.chainId),
        account,
        balance,
        blockNumber: Number(blockNumber),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei')
      };
    } catch (error) {
      console.error('Failed to get blockchain state:', error);
      throw error;
    }
  }

  /**
   * Get contract instance using ethers
   */
  getContract(address: string, abi: any[]): ethers.Contract {
    if (!this.signer) {
      throw new Error('Signer not available. Initialize Web3Service first.');
    }
    return new ethers.Contract(address, abi, this.signer);
  }

  /**
   * Get read-only contract instance
   */
  getReadOnlyContract(address: string, abi: any[]): ethers.Contract {
    if (!this.provider) {
      throw new Error('Provider not available. Initialize Web3Service first.');
    }
    return new ethers.Contract(address, abi, this.provider);
  }

  /**
   * Execute a contract read operation
   */
  async readContract(
    address: string,
    abi: any[],
    functionName: string,
    args: any[] = []
  ): Promise<any> {
    try {
      const contract = this.getReadOnlyContract(address, abi);
      const result = await contract[functionName](...args);
      return result;
    } catch (error) {
      console.error(`Failed to read contract ${address}.${functionName}:`, error);
      throw error;
    }
  }

  /**
   * Execute a contract write operation
   */
  async writeContract(
    address: string,
    abi: any[],
    functionName: string,
    args: any[] = [],
    options: { value?: string; gasLimit?: number } = {}
  ): Promise<ethers.ContractTransactionResponse> {
    try {
      const contract = this.getContract(address, abi);
      
      const txOptions: any = {};
      if (options.value) {
        txOptions.value = ethers.parseEther(options.value);
      }
      if (options.gasLimit) {
        txOptions.gasLimit = options.gasLimit;
      }

      const tx = await contract[functionName](...args, txOptions);
      return tx;
    } catch (error) {
      console.error(`Failed to write contract ${address}.${functionName}:`, error);
      throw error;
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    txHash: string,
    confirmations: number = 1
  ): Promise<ethers.TransactionReceipt | null> {
    try {
      if (!this.provider) {
        throw new Error('Provider not available');
      }
      
      const receipt = await this.provider.waitForTransaction(txHash, confirmations);
      return receipt;
    } catch (error) {
      console.error('Failed to wait for transaction:', error);
      throw error;
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(
    to: string,
    data: string,
    value?: string
  ): Promise<bigint> {
    try {
      if (!this.publicClient) {
        throw new Error('Public client not available');
      }

      const gasEstimate = await this.publicClient.estimateGas({
        to: to as `0x${string}`,
        data: data as `0x${string}`,
        value: value ? ethers.parseEther(value) : undefined
      });

      return gasEstimate;
    } catch (error) {
      console.error('Failed to estimate gas:', error);
      throw error;
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    try {
      if (!this.publicClient) {
        throw new Error('Public client not available');
      }
      
      return await this.publicClient.getGasPrice();
    } catch (error) {
      console.error('Failed to get gas price:', error);
      throw error;
    }
  }

  /**
   * Send native token (MATIC)
   */
  async sendNativeToken(
    to: string,
    amount: string
  ): Promise<ethers.TransactionResponse> {
    try {
      if (!this.signer) {
        throw new Error('Signer not available');
      }

      const tx = await this.signer.sendTransaction({
        to,
        value: ethers.parseEther(amount)
      });

      return tx;
    } catch (error) {
      console.error('Failed to send native token:', error);
      throw error;
    }
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
    try {
      if (!this.provider) {
        throw new Error('Provider not available');
      }
      
      return await this.provider.getTransaction(txHash);
    } catch (error) {
      console.error('Failed to get transaction:', error);
      throw error;
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    try {
      if (!this.provider) {
        throw new Error('Provider not available');
      }
      
      return await this.provider.getTransactionReceipt(txHash);
    } catch (error) {
      console.error('Failed to get transaction receipt:', error);
      throw error;
    }
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      if (!this.publicClient) {
        throw new Error('Public client not available');
      }
      
      const blockNumber = await this.publicClient.getBlockNumber();
      return Number(blockNumber);
    } catch (error) {
      console.error('Failed to get block number:', error);
      throw error;
    }
  }

  /**
   * Get block by number
   */
  async getBlock(blockNumber: number): Promise<any> {
    try {
      if (!this.publicClient) {
        throw new Error('Public client not available');
      }
      
      return await this.publicClient.getBlock({
        blockNumber: BigInt(blockNumber)
      });
    } catch (error) {
      console.error('Failed to get block:', error);
      throw error;
    }
  }

  /**
   * Listen for contract events
   */
  async watchContractEvent(
    address: string,
    abi: any[],
    eventName: string,
    callback: (log: any) => void,
    fromBlock?: number
  ): Promise<() => void> {
    try {
      if (!this.publicClient) {
        throw new Error('Public client not available');
      }

      const unwatch = this.publicClient.watchContractEvent({
        address: address as `0x${string}`,
        abi,
        eventName,
        onLogs: callback,
        fromBlock: fromBlock ? BigInt(fromBlock) : undefined
      });

      return unwatch;
    } catch (error) {
      console.error('Failed to watch contract event:', error);
      throw error;
    }
  }

  /**
   * Get past contract events
   */
  async getPastEvents(
    address: string,
    abi: any[],
    eventName: string,
    fromBlock?: number,
    toBlock?: number
  ): Promise<any[]> {
    try {
      if (!this.publicClient) {
        throw new Error('Public client not available');
      }

      const logs = await this.publicClient.getContractEvents({
        address: address as `0x${string}`,
        abi,
        eventName,
        fromBlock: fromBlock ? BigInt(fromBlock) : undefined,
        toBlock: toBlock ? BigInt(toBlock) : undefined
      });

      return logs;
    } catch (error) {
      console.error('Failed to get past events:', error);
      throw error;
    }
  }

  /**
   * Format token amount
   */
  formatTokenAmount(amount: bigint | string, decimals: number = 18): string {
    return ethers.formatUnits(amount, decimals);
  }

  /**
   * Parse token amount
   */
  parseTokenAmount(amount: string, decimals: number = 18): bigint {
    return ethers.parseUnits(amount, decimals);
  }

  /**
   * Check if address is valid
   */
  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Get network configuration
   */
  getNetworkConfig(chainId: number): Web3Config | null {
    return this.configs[chainId] || null;
  }

  /**
   * Get supported chain IDs
   */
  getSupportedChains(): number[] {
    return Object.keys(this.configs).map(Number);
  }

  /**
   * Check if chain is supported
   */
  isChainSupported(chainId: number): boolean {
    return chainId in this.configs;
  }

  /**
   * Get block explorer URL for transaction
   */
  getTransactionUrl(txHash: string, chainId: number): string | null {
    const config = this.getNetworkConfig(chainId);
    if (!config) return null;
    return `${config.blockExplorer}/tx/${txHash}`;
  }

  /**
   * Get block explorer URL for address
   */
  getAddressUrl(address: string, chainId: number): string | null {
    const config = this.getNetworkConfig(chainId);
    if (!config) return null;
    return `${config.blockExplorer}/address/${address}`;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.publicClient = null;
    this.walletClient = null;
    this.provider = null;
    this.signer = null;
  }
}

// Export singleton instance
export const web3Service = Web3Service.getInstance();