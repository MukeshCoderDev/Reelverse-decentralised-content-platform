import { ethers } from 'ethers';
import { UserOperationStruct } from '@account-abstraction/contracts';

export interface PaymasterConfig {
  paymasterAddress: string;
  privateKey: string;
  rpcUrl: string;
  chainId: number;
  usdcAddress: string;
  entryPointAddress: string;
  maxGasPerUserOp: string;
  dailySpendingLimit: string;
  monthlySpendingLimit: string;
}

export interface UserOperation {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

export interface PaymasterResult {
  paymasterAndData: string;
  preVerificationGas: string;
  verificationGasLimit: string;
  callGasLimit: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}

export interface SpendingLimits {
  dailySpent: string;
  monthlySpent: string;
  dailyLimit: string;
  monthlyLimit: string;
  lastResetDate: Date;
}

export class PaymasterService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private config: PaymasterConfig;
  private paymasterContract: ethers.Contract;

  constructor(config: PaymasterConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    
    // Initialize paymaster contract
    this.paymasterContract = new ethers.Contract(
      config.paymasterAddress,
      PAYMASTER_ABI,
      this.wallet
    );
  }

  /**
   * Sponsor a user operation by providing paymaster data
   */
  async sponsorUserOperation(userOp: Partial<UserOperation>): Promise<PaymasterResult> {
    try {
      console.log(`Sponsoring user operation for sender: ${userOp.sender}`);

      // Validate spending limits
      await this.validateSpendingLimits(userOp.sender!);

      // Estimate gas costs
      const gasEstimate = await this.estimateGasCosts(userOp);

      // Check if we can afford to sponsor this operation
      const canSponsor = await this.canSponsorOperation(gasEstimate.totalCost);
      if (!canSponsor) {
        throw new Error('Paymaster cannot sponsor operation: insufficient funds or limits exceeded');
      }

      // Generate paymaster data
      const paymasterAndData = await this.generatePaymasterData(userOp, gasEstimate);

      // Update spending tracking
      await this.updateSpendingLimits(userOp.sender!, gasEstimate.totalCost);

      const result: PaymasterResult = {
        paymasterAndData,
        preVerificationGas: gasEstimate.preVerificationGas,
        verificationGasLimit: gasEstimate.verificationGasLimit,
        callGasLimit: gasEstimate.callGasLimit,
        maxFeePerGas: gasEstimate.maxFeePerGas,
        maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas
      };

      console.log(`User operation sponsored successfully for ${userOp.sender}`);
      return result;

    } catch (error) {
      console.error(`Failed to sponsor user operation:`, error);
      throw error;
    }
  }

  /**
   * Estimate gas costs for a user operation
   */
  private async estimateGasCosts(userOp: Partial<UserOperation>): Promise<any> {
    try {
      // Get current gas prices
      const feeData = await this.provider.getFeeData();
      
      const gasEstimate = {
        preVerificationGas: '21000', // Base transaction cost
        verificationGasLimit: '100000', // Gas for signature verification
        callGasLimit: '200000', // Gas for the actual call
        maxFeePerGas: feeData.maxFeePerGas?.toString() || '20000000000', // 20 gwei
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || '2000000000', // 2 gwei
        totalCost: '0'
      };

      // Calculate total cost in wei
      const totalGas = BigInt(gasEstimate.preVerificationGas) + 
                      BigInt(gasEstimate.verificationGasLimit) + 
                      BigInt(gasEstimate.callGasLimit);
      
      const totalCost = totalGas * BigInt(gasEstimate.maxFeePerGas);
      gasEstimate.totalCost = totalCost.toString();

      return gasEstimate;

    } catch (error) {
      console.error('Gas estimation failed:', error);
      throw new Error('Failed to estimate gas costs');
    }
  }

  /**
   * Generate paymaster data for the user operation
   */
  private async generatePaymasterData(
    userOp: Partial<UserOperation>, 
    gasEstimate: any
  ): Promise<string> {
    try {
      // Create paymaster data structure
      // Format: paymaster_address + paymaster_verification_gas_limit + paymaster_post_op_gas_limit + paymaster_data
      
      const paymasterAddress = this.config.paymasterAddress.slice(2); // Remove 0x
      const verificationGasLimit = ethers.zeroPadValue(
        ethers.toBeHex(gasEstimate.verificationGasLimit), 
        16
      ).slice(2);
      const postOpGasLimit = ethers.zeroPadValue(
        ethers.toBeHex('50000'), // Gas for post-operation cleanup
        16
      ).slice(2);

      // Generate signature for paymaster validation
      const paymasterData = await this.signPaymasterData(userOp, gasEstimate);

      return '0x' + paymasterAddress + verificationGasLimit + postOpGasLimit + paymasterData.slice(2);

    } catch (error) {
      console.error('Failed to generate paymaster data:', error);
      throw error;
    }
  }

  /**
   * Sign paymaster data for validation
   */
  private async signPaymasterData(userOp: Partial<UserOperation>, gasEstimate: any): Promise<string> {
    try {
      // Create hash of the user operation for signing
      const userOpHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
          [
            userOp.sender,
            userOp.nonce || '0',
            ethers.keccak256(userOp.initCode || '0x'),
            ethers.keccak256(userOp.callData || '0x'),
            gasEstimate.callGasLimit,
            gasEstimate.verificationGasLimit,
            gasEstimate.preVerificationGas,
            gasEstimate.maxFeePerGas,
            gasEstimate.maxPriorityFeePerGas
          ]
        )
      );

      // Sign the hash
      const signature = await this.wallet.signMessage(ethers.getBytes(userOpHash));
      
      return signature;

    } catch (error) {
      console.error('Failed to sign paymaster data:', error);
      throw error;
    }
  }

  /**
   * Check if paymaster can sponsor the operation
   */
  private async canSponsorOperation(gasCost: string): Promise<boolean> {
    try {
      // Check paymaster balance
      const balance = await this.provider.getBalance(this.config.paymasterAddress);
      const requiredBalance = BigInt(gasCost) * BigInt(2); // 2x buffer
      
      if (balance < requiredBalance) {
        console.warn(`Insufficient paymaster balance: ${balance} < ${requiredBalance}`);
        return false;
      }

      // Check if gas cost exceeds per-operation limit
      const maxGasPerOp = BigInt(this.config.maxGasPerUserOp);
      if (BigInt(gasCost) > maxGasPerOp) {
        console.warn(`Gas cost exceeds per-operation limit: ${gasCost} > ${maxGasPerOp}`);
        return false;
      }

      return true;

    } catch (error) {
      console.error('Error checking sponsorship capability:', error);
      return false;
    }
  }

  /**
   * Validate spending limits for a user
   */
  private async validateSpendingLimits(sender: string): Promise<void> {
    try {
      const limits = await this.getSpendingLimits(sender);
      
      // Check daily limit
      if (BigInt(limits.dailySpent) >= BigInt(limits.dailyLimit)) {
        throw new Error(`Daily spending limit exceeded for ${sender}`);
      }

      // Check monthly limit
      if (BigInt(limits.monthlySpent) >= BigInt(limits.monthlyLimit)) {
        throw new Error(`Monthly spending limit exceeded for ${sender}`);
      }

    } catch (error) {
      console.error('Spending limit validation failed:', error);
      throw error;
    }
  }

  /**
   * Get spending limits for a user
   */
  async getSpendingLimits(sender: string): Promise<SpendingLimits> {
    try {
      // This would typically be stored in a database
      // For now, return default limits
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      return {
        dailySpent: '0',
        monthlySpent: '0',
        dailyLimit: this.config.dailySpendingLimit,
        monthlyLimit: this.config.monthlySpendingLimit,
        lastResetDate: startOfDay
      };

    } catch (error) {
      console.error('Error getting spending limits:', error);
      throw error;
    }
  }

  /**
   * Update spending limits after sponsoring an operation
   */
  private async updateSpendingLimits(sender: string, gasCost: string): Promise<void> {
    try {
      // This would update the database with new spending amounts
      console.log(`Updated spending for ${sender}: +${gasCost} wei`);
      
      // In a real implementation, this would:
      // 1. Get current spending from database
      // 2. Add the new gas cost
      // 3. Update the database
      // 4. Reset daily/monthly counters if needed

    } catch (error) {
      console.error('Error updating spending limits:', error);
      // Don't throw - this shouldn't break the sponsorship
    }
  }

  /**
   * Fund the paymaster with ETH
   */
  async fundPaymaster(amountEth: string): Promise<string> {
    try {
      console.log(`Funding paymaster with ${amountEth} ETH`);

      const tx = await this.wallet.sendTransaction({
        to: this.config.paymasterAddress,
        value: ethers.parseEther(amountEth)
      });

      await tx.wait();
      console.log(`Paymaster funded successfully: ${tx.hash}`);
      
      return tx.hash;

    } catch (error) {
      console.error('Failed to fund paymaster:', error);
      throw error;
    }
  }

  /**
   * Withdraw funds from paymaster (admin only)
   */
  async withdrawFromPaymaster(amountEth: string, recipient: string): Promise<string> {
    try {
      console.log(`Withdrawing ${amountEth} ETH from paymaster to ${recipient}`);

      // Call withdraw function on paymaster contract
      const tx = await this.paymasterContract.withdraw(
        recipient,
        ethers.parseEther(amountEth)
      );

      await tx.wait();
      console.log(`Withdrawal successful: ${tx.hash}`);
      
      return tx.hash;

    } catch (error) {
      console.error('Failed to withdraw from paymaster:', error);
      throw error;
    }
  }

  /**
   * Get paymaster balance and statistics
   */
  async getPaymasterStats(): Promise<any> {
    try {
      const balance = await this.provider.getBalance(this.config.paymasterAddress);
      const balanceEth = ethers.formatEther(balance);

      // Get recent transaction count (would query from database in real implementation)
      const stats = {
        balance: balanceEth,
        balanceWei: balance.toString(),
        address: this.config.paymasterAddress,
        chainId: this.config.chainId,
        dailySpendingLimit: ethers.formatEther(this.config.dailySpendingLimit),
        monthlySpendingLimit: ethers.formatEther(this.config.monthlySpendingLimit),
        operationsSponsored24h: 0, // Would get from database
        totalGasSponsored24h: '0', // Would get from database
        lastUpdated: new Date().toISOString()
      };

      return stats;

    } catch (error) {
      console.error('Error getting paymaster stats:', error);
      throw error;
    }
  }

  /**
   * Batch process multiple user operations
   */
  async batchSponsorOperations(userOps: Partial<UserOperation>[]): Promise<PaymasterResult[]> {
    console.log(`Batch sponsoring ${userOps.length} user operations`);

    const results: PaymasterResult[] = [];
    
    for (const userOp of userOps) {
      try {
        const result = await this.sponsorUserOperation(userOp);
        results.push(result);
      } catch (error) {
        console.error(`Failed to sponsor operation for ${userOp.sender}:`, error);
        // Continue with other operations
      }
    }

    console.log(`Batch sponsoring completed: ${results.length}/${userOps.length} successful`);
    return results;
  }

  /**
   * Validate paymaster configuration
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      // Check if paymaster contract exists
      const code = await this.provider.getCode(this.config.paymasterAddress);
      if (code === '0x') {
        throw new Error('Paymaster contract not found');
      }

      // Check if we have sufficient balance
      const balance = await this.provider.getBalance(this.config.paymasterAddress);
      const minBalance = ethers.parseEther('0.1'); // Minimum 0.1 ETH
      
      if (balance < minBalance) {
        console.warn(`Paymaster balance is low: ${ethers.formatEther(balance)} ETH`);
      }

      // Validate spending limits
      if (BigInt(this.config.dailySpendingLimit) <= 0 || BigInt(this.config.monthlySpendingLimit) <= 0) {
        throw new Error('Invalid spending limits configuration');
      }

      console.log('Paymaster configuration validated successfully');
      return true;

    } catch (error) {
      console.error('Paymaster configuration validation failed:', error);
      return false;
    }
  }
}

// ERC-4337 Paymaster ABI (simplified)
const PAYMASTER_ABI = [
  'function withdraw(address to, uint256 amount) external',
  'function getBalance() external view returns (uint256)',
  'function validatePaymasterUserOp(bytes32 userOpHash, uint256 maxCost) external returns (bytes memory context, uint256 validationData)',
  'function postOp(uint8 mode, bytes calldata context, uint256 actualGasCost) external'
];

// Default configuration for Polygon
export const DEFAULT_PAYMASTER_CONFIG: PaymasterConfig = {
  paymasterAddress: process.env.PAYMASTER_ADDRESS || '',
  privateKey: process.env.PAYMASTER_PRIVATE_KEY || '',
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  chainId: 137, // Polygon Mainnet
  usdcAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
  entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // ERC-4337 EntryPoint
  maxGasPerUserOp: ethers.parseEther('0.01').toString(), // 0.01 ETH max per operation
  dailySpendingLimit: ethers.parseEther('1').toString(), // 1 ETH per day per user
  monthlySpendingLimit: ethers.parseEther('10').toString() // 10 ETH per month per user
};