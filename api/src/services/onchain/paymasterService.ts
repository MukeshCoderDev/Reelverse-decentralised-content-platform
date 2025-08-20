import { logger } from '../../utils/logger';
import { ethers } from 'ethers';
import { UserOperationStruct } from '@account-abstraction/contracts';
import { env } from '../../config/env';
import { currentChainConfig } from '../../config/chain';

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
  private paymasterContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(currentChainConfig.rpcUrl);
    this.wallet = new ethers.Wallet(env.PAYMASTER_PRIVATE_KEY, this.provider);
    
    // Initialize paymaster contract
    this.paymasterContract = new ethers.Contract(
      env.PAYMASTER_ADDRESS,
      PAYMASTER_ABI,
      this.wallet
    );
  }

  /**
   * Sponsor a user operation by providing paymaster data
   */
  async sponsorUserOperation(userOp: Partial<UserOperation> & { requestId?: string }): Promise<PaymasterResult> {
    try {
      logger.info(`Sponsoring user operation for sender: ${userOp.sender}`, { requestId: userOp.requestId });

      // Validate spending limits
      await this.validateSpendingLimits(userOp.sender!, userOp.requestId);

      // Estimate gas costs
      const gasEstimate = await this.estimateGasCosts(userOp, userOp.requestId);

      // Check if we can afford to sponsor this operation
      const canSponsor = await this.canSponsorOperation(gasEstimate.totalCost, userOp.requestId);
      if (!canSponsor) {
        throw new Error('Paymaster cannot sponsor operation: insufficient funds or limits exceeded');
      }

      // Generate paymaster data
      const paymasterAndData = await this.generatePaymasterData(userOp, gasEstimate, userOp.requestId);

      // Update spending tracking
      await this.updateSpendingLimits(userOp.sender!, gasEstimate.totalCost, userOp.requestId);

      const result: PaymasterResult = {
        paymasterAndData,
        preVerificationGas: gasEstimate.preVerificationGas,
        verificationGasLimit: gasEstimate.verificationGasLimit,
        callGasLimit: gasEstimate.callGasLimit,
        maxFeePerGas: gasEstimate.maxFeePerGas,
        maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas
      };

      logger.info(`User operation sponsored successfully for ${userOp.sender}`, { requestId: userOp.requestId });
      return result;

    } catch (error: any) {
      logger.error(`Failed to sponsor user operation for ${userOp.sender}: ${error.message}`, { requestId: userOp.requestId, error });
      throw error;
    }
  }

  /**
   * Estimate gas costs for a user operation
   */
  private async estimateGasCosts(userOp: Partial<UserOperation>, requestId?: string): Promise<any> {
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

    } catch (error: any) {
      logger.error(`Gas estimation failed: ${error.message}`, { requestId, error });
      throw new Error('Failed to estimate gas costs');
    }
  }

  /**
   * Generate paymaster data for the user operation
   */
  private async generatePaymasterData(
    userOp: Partial<UserOperation>, 
    gasEstimate: any,
    requestId?: string
  ): Promise<string> {
    try {
      // Create paymaster data structure
      // Format: paymaster_address + paymaster_verification_gas_limit + paymaster_post_op_gas_limit + paymaster_data
      
      const paymasterAddress = env.PAYMASTER_ADDRESS.slice(2); // Remove 0x
      const verificationGasLimit = ethers.zeroPadValue(
        ethers.toBeHex(gasEstimate.verificationGasLimit), 
        16
      ).slice(2);
      const postOpGasLimit = ethers.zeroPadValue(
        ethers.toBeHex('50000'), // Gas for post-operation cleanup
        16
      ).slice(2);

      // Generate signature for paymaster validation
      const paymasterData = await this.signPaymasterData(userOp, gasEstimate, requestId);

      return '0x' + paymasterAddress + verificationGasLimit + postOpGasLimit + paymasterData.slice(2);

    } catch (error: any) {
      logger.error(`Failed to generate paymaster data: ${error.message}`, { requestId, error });
      throw error;
    }
  }

  /**
   * Sign paymaster data for validation
   */
  private async signPaymasterData(userOp: Partial<UserOperation>, gasEstimate: any, requestId?: string): Promise<string> {
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

    } catch (error: any) {
      logger.error(`Failed to sign paymaster data: ${error.message}`, { requestId, error });
      throw error;
    }
  }

  /**
   * Check if paymaster can sponsor the operation
   */
  private async canSponsorOperation(gasCost: string, requestId?: string): Promise<boolean> {
    try {
      // Check paymaster balance
      const balance = await this.provider.getBalance(env.PAYMASTER_ADDRESS);
      const requiredBalance = BigInt(gasCost) * BigInt(2); // 2x buffer
      
      if (balance < requiredBalance) {
        logger.warn(`Insufficient paymaster balance: ${balance} < ${requiredBalance}`, { requestId, balance: balance.toString(), requiredBalance: requiredBalance.toString() });
        return false;
      }

      // Check if gas cost exceeds per-operation limit
      const maxGasPerOp = BigInt(env.MAX_GAS_PER_USER_OP);
      if (BigInt(gasCost) > maxGasPerOp) {
        logger.warn(`Gas cost exceeds per-operation limit: ${gasCost} > ${maxGasPerOp}`, { requestId, gasCost, maxGasPerOp: maxGasPerOp.toString() });
        return false;
      }

      return true;

    } catch (error: any) {
      logger.error(`Error checking sponsorship capability: ${error.message}`, { requestId, error });
      return false;
    }
  }

  /**
   * Validate spending limits for a user
   */
  private async validateSpendingLimits(sender: string, requestId?: string): Promise<void> {
    try {
      const limits = await this.getSpendingLimits(sender, requestId);
      
      // Check daily limit
      if (BigInt(limits.dailySpent) >= BigInt(limits.dailyLimit)) {
        throw new Error(`Daily spending limit exceeded for ${sender}`);
      }

      // Check monthly limit
      if (BigInt(limits.monthlySpent) >= BigInt(limits.monthlyLimit)) {
        throw new Error(`Monthly spending limit exceeded for ${sender}`);
      }

    } catch (error: any) {
      logger.error(`Spending limit validation failed for ${sender}: ${error.message}`, { requestId, sender, error });
      throw error;
    }
  }

  /**
   * Get spending limits for a user
   */
  async getSpendingLimits(sender: string, requestId?: string): Promise<SpendingLimits> {
    try {
      // This would typically be stored in a database
      // For now, return default limits
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      return {
        dailySpent: '0',
        monthlySpent: '0',
        dailyLimit: env.DAILY_SPENDING_LIMIT,
        monthlyLimit: env.MONTHLY_SPENDING_LIMIT,
        lastResetDate: startOfDay
      };

    } catch (error: any) {
      logger.error(`Error getting spending limits for ${sender}: ${error.message}`, { requestId, sender, error });
      throw error;
    }
  }

  /**
   * Update spending limits after sponsoring an operation
   */
  private async updateSpendingLimits(sender: string, gasCost: string, requestId?: string): Promise<void> {
    try {
      // This would update the database with new spending amounts
      logger.info(`Updated spending for ${sender}: +${gasCost} wei`, { requestId, sender, gasCost });
      
      // In a real implementation, this would:
      // 1. Get current spending from database
      // 2. Add the new gas cost
      // 3. Update the database
      // 4. Reset daily/monthly counters if needed
    } catch (error: any) {
      logger.error(`Error updating spending limits for ${sender}: ${error.message}`, { requestId, sender, error });
      // Don't throw - this shouldn't break the sponsorship
    }
  }

  /**
   * Fund the paymaster with ETH
   */
  async fundPaymaster(amountEth: string, requestId?: string): Promise<string> {
    try {
      logger.info(`Funding paymaster with ${amountEth} ETH`, { requestId });

      const tx = await this.wallet.sendTransaction({
        to: env.PAYMASTER_ADDRESS,
        value: ethers.parseEther(amountEth)
      });

      await tx.wait();
      logger.info(`Paymaster funded successfully: ${tx.hash}`, { requestId, txHash: tx.hash });
      
      return tx.hash;

    } catch (error: any) {
      logger.error(`Failed to fund paymaster with ${amountEth} ETH: ${error.message}`, { requestId, error });
      throw error;
    }
  }

  /**
   * Withdraw funds from paymaster (admin only)
   */
  async withdrawFromPaymaster(amountEth: string, recipient: string, requestId?: string): Promise<string> {
    try {
      logger.info(`Withdrawing ${amountEth} ETH from paymaster to ${recipient}`, { requestId });

      // Call withdraw function on paymaster contract
      const tx = await this.paymasterContract.withdraw(
        recipient,
        ethers.parseEther(amountEth)
      );

      await tx.wait();
      logger.info(`Withdrawal successful: ${tx.hash}`, { requestId, txHash: tx.hash });
      
      return tx.hash;

    } catch (error: any) {
      logger.error(`Failed to withdraw ${amountEth} ETH from paymaster to ${recipient}: ${error.message}`, { requestId, error });
      throw error;
    }
  }

  /**
   * Get paymaster balance and statistics
   */
  async getPaymasterStats(requestId?: string): Promise<any> {
    try {
      const balance = await this.provider.getBalance(env.PAYMASTER_ADDRESS);
      const balanceEth = ethers.formatEther(balance);

      // Get recent transaction count (would query from database in real implementation)
      const stats = {
        balance: balanceEth,
        balanceWei: balance.toString(),
        address: env.PAYMASTER_ADDRESS,
        chainId: currentChainConfig.chainId,
        dailySpendingLimit: ethers.formatEther(env.DAILY_SPENDING_LIMIT),
        monthlySpendingLimit: ethers.formatEther(env.MONTHLY_SPENDING_LIMIT),
        operationsSponsored24h: 0, // Would get from database
        totalGasSponsored24h: '0', // Would get from database
        lastUpdated: new Date().toISOString()
      };

      return stats;

    } catch (error: any) {
      logger.error(`Error getting paymaster stats: ${error.message}`, { requestId, error });
      throw error;
    }
  }

  /**
   * Batch process multiple user operations
   */
  async batchSponsorOperations(userOps: (Partial<UserOperation> & { requestId?: string })[]): Promise<PaymasterResult[]> {
    logger.info(`Batch sponsoring ${userOps.length} user operations`);

    const results: PaymasterResult[] = [];
    
    for (const userOp of userOps) {
      try {
        const result = await this.sponsorUserOperation(userOp);
        results.push(result);
      } catch (error: any) {
        logger.error(`Failed to sponsor operation for ${userOp.sender}: ${error.message}`, { requestId: userOp.requestId, sender: userOp.sender, error });
        // Continue with other operations
      }
    }

    logger.info(`Batch sponsoring completed: ${results.length}/${userOps.length} successful`);
    return results;
  }

  /**
   * Validate paymaster configuration
   */
  async validateConfiguration(requestId?: string): Promise<boolean> {
    try {
      // Check if paymaster contract exists
      const code = await this.provider.getCode(env.PAYMASTER_ADDRESS);
      if (code === '0x') {
        throw new Error('Paymaster contract not found');
      }

      // Check if we have sufficient balance
      const balance = await this.provider.getBalance(env.PAYMASTER_ADDRESS);
      const minBalance = ethers.parseEther('0.1'); // Minimum 0.1 ETH
      
      if (balance < minBalance) {
        logger.warn(`Paymaster balance is low: ${ethers.formatEther(balance)} ETH`, { requestId, balance: ethers.formatEther(balance) });
      }

      // Validate spending limits
      if (BigInt(env.DAILY_SPENDING_LIMIT) <= 0 || BigInt(env.MONTHLY_SPENDING_LIMIT) <= 0) {
        throw new Error('Invalid spending limits configuration');
      }

      logger.info('Paymaster configuration validated successfully', { requestId });
      return true;

    } catch (error: any) {
      logger.error(`Paymaster configuration validation failed: ${error.message}`, { requestId, error });
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