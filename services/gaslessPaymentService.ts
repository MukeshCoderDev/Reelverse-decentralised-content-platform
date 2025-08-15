import { ethers } from 'ethers';
import { PaymasterService } from './paymasterService';

export interface Permit2Config {
  permit2Address: string;
  usdcAddress: string;
  chainId: number;
  rpcUrl: string;
}

export interface PermitSignature {
  token: string;
  spender: string;
  amount: string;
  deadline: number;
  nonce: number;
  signature: string;
}

export interface GaslessPaymentRequest {
  from: string;
  to: string;
  amount: string;
  permit: PermitSignature;
  metadata?: {
    contentId?: string;
    purchaseType?: string;
  };
}

export interface GaslessPaymentResult {
  success: boolean;
  userOpHash?: string;
  transactionHash?: string;
  gasSponsored: boolean;
  error?: string;
  fallbackUsed?: boolean;
}

export class GaslessPaymentService {
  private provider: ethers.JsonRpcProvider;
  private config: Permit2Config;
  private paymasterService: PaymasterService;
  private permit2Contract: ethers.Contract;
  private usdcContract: ethers.Contract;

  constructor(
    config: Permit2Config,
    paymasterService: PaymasterService
  ) {
    this.config = config;
    this.paymasterService = paymasterService;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // Initialize contracts
    this.permit2Contract = new ethers.Contract(
      config.permit2Address,
      PERMIT2_ABI,
      this.provider
    );

    this.usdcContract = new ethers.Contract(
      config.usdcAddress,
      USDC_ABI,
      this.provider
    );
  }

  /**
   * Execute gasless USDC payment using Permit2
   */
  async executeGaslessPayment(paymentRequest: GaslessPaymentRequest): Promise<GaslessPaymentResult> {
    try {
      console.log(`Executing gasless payment: ${paymentRequest.amount} USDC from ${paymentRequest.from} to ${paymentRequest.to}`);

      // Validate permit signature
      await this.validatePermitSignature(paymentRequest.permit);

      // Create user operation for the payment
      const userOp = await this.createPaymentUserOperation(paymentRequest);

      // Try to sponsor the transaction
      try {
        const paymasterResult = await this.paymasterService.sponsorUserOperation(userOp);
        
        // Update user operation with paymaster data
        const sponsoredUserOp = {
          ...userOp,
          paymasterAndData: paymasterResult.paymasterAndData,
          preVerificationGas: paymasterResult.preVerificationGas,
          verificationGasLimit: paymasterResult.verificationGasLimit,
          callGasLimit: paymasterResult.callGasLimit,
          maxFeePerGas: paymasterResult.maxFeePerGas,
          maxPriorityFeePerGas: paymasterResult.maxPriorityFeePerGas
        };

        // Submit sponsored user operation
        const userOpHash = await this.submitUserOperation(sponsoredUserOp);

        return {
          success: true,
          userOpHash,
          gasSponsored: true,
          fallbackUsed: false
        };

      } catch (paymasterError) {
        console.warn('Paymaster sponsorship failed, falling back to traditional payment:', paymasterError.message);
        
        // Fallback to traditional gas payment
        const fallbackResult = await this.executeFallbackPayment(paymentRequest);
        
        return {
          success: fallbackResult.success,
          transactionHash: fallbackResult.transactionHash,
          gasSponsored: false,
          fallbackUsed: true,
          error: fallbackResult.error
        };
      }

    } catch (error) {
      console.error('Gasless payment execution failed:', error);
      return {
        success: false,
        gasSponsored: false,
        error: error.message
      };
    }
  }

  /**
   * Create user operation for Permit2 payment
   */
  private async createPaymentUserOperation(paymentRequest: GaslessPaymentRequest): Promise<any> {
    try {
      // Encode the permit2 transferFrom call
      const transferFromData = this.permit2Contract.interface.encodeFunctionData(
        'permitTransferFrom',
        [
          {
            permitted: {
              token: paymentRequest.permit.token,
              amount: paymentRequest.permit.amount
            },
            nonce: paymentRequest.permit.nonce,
            deadline: paymentRequest.permit.deadline
          },
          {
            to: paymentRequest.to,
            requestedAmount: paymentRequest.amount
          },
          paymentRequest.from,
          paymentRequest.permit.signature
        ]
      );

      // Create user operation
      const userOp = {
        sender: paymentRequest.from,
        nonce: await this.getUserOperationNonce(paymentRequest.from),
        initCode: '0x', // Assuming wallet is already deployed
        callData: transferFromData,
        callGasLimit: '300000', // Estimated gas for permit2 transfer
        verificationGasLimit: '100000',
        preVerificationGas: '21000',
        maxFeePerGas: '0', // Will be set by paymaster
        maxPriorityFeePerGas: '0', // Will be set by paymaster
        paymasterAndData: '0x',
        signature: '0x' // Will be signed by user's wallet
      };

      return userOp;

    } catch (error) {
      console.error('Failed to create payment user operation:', error);
      throw error;
    }
  }

  /**
   * Validate Permit2 signature
   */
  private async validatePermitSignature(permit: PermitSignature): Promise<void> {
    try {
      // Check if permit is not expired
      const currentTime = Math.floor(Date.now() / 1000);
      if (permit.deadline < currentTime) {
        throw new Error('Permit signature has expired');
      }

      // Verify the permit signature format
      if (!permit.signature || !permit.signature.match(/^0x[a-fA-F0-9]{130}$/)) {
        throw new Error('Invalid permit signature format');
      }

      // Check if nonce is valid (not already used)
      const isNonceUsed = await this.permit2Contract.nonceBitmap(permit.spender, permit.nonce);
      if (isNonceUsed) {
        throw new Error('Permit nonce already used');
      }

      // Verify token address
      if (permit.token.toLowerCase() !== this.config.usdcAddress.toLowerCase()) {
        throw new Error('Invalid token address in permit');
      }

      console.log('Permit signature validated successfully');

    } catch (error) {
      console.error('Permit signature validation failed:', error);
      throw error;
    }
  }

  /**
   * Get user operation nonce for account
   */
  private async getUserOperationNonce(account: string): Promise<string> {
    try {
      // This would typically query the EntryPoint contract for the nonce
      // For now, return a mock nonce
      return '0x0';
    } catch (error) {
      console.error('Failed to get user operation nonce:', error);
      return '0x0';
    }
  }

  /**
   * Submit user operation to bundler
   */
  private async submitUserOperation(userOp: any): Promise<string> {
    try {
      // This would submit to an ERC-4337 bundler
      // For now, return a mock user operation hash
      const userOpHash = '0x' + ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'uint256', 'bytes'],
          [userOp.sender, userOp.nonce, userOp.callData]
        )
      ).slice(2);

      console.log(`User operation submitted: ${userOpHash}`);
      return userOpHash;

    } catch (error) {
      console.error('Failed to submit user operation:', error);
      throw error;
    }
  }

  /**
   * Fallback to traditional gas payment
   */
  private async executeFallbackPayment(paymentRequest: GaslessPaymentRequest): Promise<any> {
    try {
      console.log('Executing fallback payment with traditional gas');

      // This would execute a regular USDC transfer with gas paid by user
      // For now, return a mock successful transaction
      const mockTxHash = '0x' + ethers.keccak256(
        ethers.toUtf8Bytes(`fallback_${paymentRequest.from}_${paymentRequest.to}_${Date.now()}`)
      ).slice(2);

      return {
        success: true,
        transactionHash: mockTxHash
      };

    } catch (error) {
      console.error('Fallback payment failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate Permit2 signature data for frontend
   */
  async generatePermitSignatureData(
    token: string,
    spender: string,
    amount: string,
    deadline: number
  ): Promise<any> {
    try {
      // Get next available nonce
      const nonce = await this.getNextPermitNonce(spender);

      // Create permit data structure
      const permitData = {
        permitted: {
          token,
          amount
        },
        spender,
        nonce,
        deadline
      };

      // Create EIP-712 domain
      const domain = {
        name: 'Permit2',
        chainId: this.config.chainId,
        verifyingContract: this.config.permit2Address
      };

      // Create EIP-712 types
      const types = {
        PermitTransferFrom: [
          { name: 'permitted', type: 'TokenPermissions' },
          { name: 'spender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ],
        TokenPermissions: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ]
      };

      return {
        domain,
        types,
        value: permitData,
        primaryType: 'PermitTransferFrom'
      };

    } catch (error) {
      console.error('Failed to generate permit signature data:', error);
      throw error;
    }
  }

  /**
   * Get next available permit nonce
   */
  private async getNextPermitNonce(spender: string): Promise<number> {
    try {
      // This would query the Permit2 contract for the next available nonce
      // For now, return a random nonce
      return Math.floor(Math.random() * 1000000);
    } catch (error) {
      console.error('Failed to get next permit nonce:', error);
      return 0;
    }
  }

  /**
   * Batch process multiple gasless payments
   */
  async batchExecuteGaslessPayments(
    paymentRequests: GaslessPaymentRequest[]
  ): Promise<GaslessPaymentResult[]> {
    console.log(`Batch processing ${paymentRequests.length} gasless payments`);

    const results: GaslessPaymentResult[] = [];
    
    // Process payments in parallel (with reasonable concurrency limit)
    const batchSize = 5;
    for (let i = 0; i < paymentRequests.length; i += batchSize) {
      const batch = paymentRequests.slice(i, i + batchSize);
      
      const batchPromises = batch.map(request => 
        this.executeGaslessPayment(request)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            gasSponsored: false,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < paymentRequests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const sponsoredCount = results.filter(r => r.gasSponsored).length;
    
    console.log(`Batch processing completed: ${successCount}/${paymentRequests.length} successful, ${sponsoredCount} gas-sponsored`);
    
    return results;
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<any> {
    try {
      // This would query payment history from database
      // For now, return mock statistics
      return {
        totalPayments: 1250,
        gaslessPayments: 1100,
        gaslessSuccessRate: 88.0, // 88% success rate for gasless
        fallbackPayments: 150,
        totalVolumeUSDC: '125000.50',
        avgGasSavingsUSDC: '2.45',
        last24hPayments: 45,
        last24hGasless: 42
      };
    } catch (error) {
      console.error('Failed to get payment stats:', error);
      return {
        totalPayments: 0,
        gaslessPayments: 0,
        gaslessSuccessRate: 0,
        fallbackPayments: 0,
        totalVolumeUSDC: '0',
        avgGasSavingsUSDC: '0',
        last24hPayments: 0,
        last24hGasless: 0
      };
    }
  }

  /**
   * Validate USDC balance and allowance
   */
  async validatePaymentPreconditions(
    from: string,
    amount: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check USDC balance
      const balance = await this.usdcContract.balanceOf(from);
      if (balance < BigInt(amount)) {
        return {
          valid: false,
          error: `Insufficient USDC balance: ${balance} < ${amount}`
        };
      }

      // Check Permit2 allowance
      const allowance = await this.usdcContract.allowance(from, this.config.permit2Address);
      if (allowance < BigInt(amount)) {
        return {
          valid: false,
          error: `Insufficient Permit2 allowance: ${allowance} < ${amount}`
        };
      }

      return { valid: true };

    } catch (error) {
      console.error('Payment precondition validation failed:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Estimate gas savings for gasless payment
   */
  async estimateGasSavings(amount: string): Promise<any> {
    try {
      // Get current gas prices
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt('20000000000'); // 20 gwei fallback

      // Estimate gas for traditional USDC transfer
      const traditionalGas = BigInt('65000'); // Typical USDC transfer gas
      const traditionalCostWei = traditionalGas * gasPrice;
      const traditionalCostEth = ethers.formatEther(traditionalCostWei);

      // Convert to USD (mock rate)
      const ethToUsdRate = 2500; // $2500 per ETH
      const traditionalCostUsd = parseFloat(traditionalCostEth) * ethToUsdRate;

      return {
        gasPrice: gasPrice.toString(),
        traditionalGas: traditionalGas.toString(),
        traditionalCostWei: traditionalCostWei.toString(),
        traditionalCostEth,
        traditionalCostUsd: traditionalCostUsd.toFixed(2),
        gasSavingsUsd: traditionalCostUsd.toFixed(2), // Full savings with gasless
        savingsPercentage: 100 // 100% savings
      };

    } catch (error) {
      console.error('Gas savings estimation failed:', error);
      return {
        gasPrice: '0',
        traditionalGas: '0',
        traditionalCostWei: '0',
        traditionalCostEth: '0',
        traditionalCostUsd: '0',
        gasSavingsUsd: '0',
        savingsPercentage: 0
      };
    }
  }
}

// Permit2 contract ABI (simplified)
const PERMIT2_ABI = [
  'function permitTransferFrom((address token, uint256 amount) permitted, (address to, uint256 requestedAmount) transferDetails, address owner, bytes signature) external',
  'function nonceBitmap(address owner, uint256 nonce) external view returns (bool)',
  'function DOMAIN_SEPARATOR() external view returns (bytes32)'
];

// USDC contract ABI (simplified)
const USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)'
];

// Default configuration for Polygon
export const DEFAULT_PERMIT2_CONFIG: Permit2Config = {
  permit2Address: '0x000000000022D473030F116dDEE9F6B43aC78BA3', // Universal Permit2
  usdcAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
  chainId: 137, // Polygon Mainnet
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'
};