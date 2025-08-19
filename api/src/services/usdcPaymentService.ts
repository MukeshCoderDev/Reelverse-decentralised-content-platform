import { ethers } from 'ethers';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { logger } from '../utils/logger';
import { RedisService } from '../config/redis';
import { env } from '../config/env';
import { currentChainConfig } from '../config/chain';

// Contract ABIs (minimal required functions)
const USDC_ABI = [
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) returns (uint256)',
  'function allowance(address owner, address spender) returns (uint256)',
  'function decimals() returns (uint8)'
] as const;

const REVENUE_SPLITTER_ABI = [
  'function createSplitter(address[] calldata payees, uint32[] calldata basisPoints) returns (address)',
  'function release(address splitter, address token)',
  'function getSplitterInfo(address splitter) returns (address[] memory, uint32[] memory)'
] as const;

const NFT_ACCESS_ABI = [
  'function mintPPV(address to, uint256 contentId, uint256 quantity)',
  'function hasAccess(address user, uint256 contentId) returns (bool)'
] as const;

const CONTENT_REGISTRY_ABI = [
  'function getContent(uint256 contentId) returns (tuple(address creator, address splitter, string metaURI, bytes32 perceptualHash, uint32 geoMask, uint256 priceUSDC, uint8 storageClass, uint8 moderationStatus, uint256 createdAt, uint256 totalSales, uint256 viewCount))',
  'function recordSale(uint256 contentId, address buyer, uint256 price)'
] as const;

export interface PermitSignature {
  owner: string;
  spender: string;
  value: string;
  deadline: number;
  v: number;
  r: string;
  s: string;
}

export interface PaymentRequest {
  contentId: string;
  userAddress: string;
  priceUSDC: string;  
permitSignature?: PermitSignature;
}

export interface PaymentResponse {
  success: boolean;
  transactionHash?: string;
  entitlementId?: string;
  error?: string;
}

export interface CheckoutResponse {
  permitTx?: any;
  calldata?: string;
  requiresPermit: boolean;
  spenderAddress: string;
  amount: string;
}

export class USDCPaymentService {
  private publicClient;
  private walletClient;
  private redisService: RedisService;
  // Contract addresses
  private readonly USDC_ADDRESS = env.USDC_CONTRACT_ADDRESS;
  private readonly REVENUE_SPLITTER_ADDRESS = env.REVENUE_SPLITTER_ADDRESS;
  private readonly NFT_ACCESS_ADDRESS = env.NFT_ACCESS_ADDRESS;
  private readonly CONTENT_REGISTRY_ADDRESS = env.CONTENT_REGISTRY_ADDRESS;
  private readonly PLATFORM_WALLET = env.PLATFORM_WALLET_ADDRESS;
 
  constructor() {
    this.publicClient = createPublicClient({
      chain: polygon, // Assuming Polygon for USDC payments
      transport: http(currentChainConfig.rpcUrl)
    });
 
    // Initialize wallet client for backend transactions
    const account = privateKeyToAccount(env.PLATFORM_PRIVATE_KEY as `0x${string}`);
    this.walletClient = createWalletClient({
      chain: polygon, // Assuming Polygon for USDC payments
      transport: http(currentChainConfig.rpcUrl)
    });
    this.redisService = new RedisService();
  }

  /**
   * Prepare USDC checkout data for frontend
   */
  async prepareUSDCCheckout(contentId: string, userAddress: string): Promise<CheckoutResponse> {
    try {
      // Get content information
      const content = await this.getContentInfo(contentId);
      if (!content) {
        throw new Error('Content not found');
      }

      // Check if content is available for purchase
      if (content.moderationStatus !== 1) { // 1 = Approved
        throw new Error('Content not available for purchase');
      }

      const priceUSDC = content.priceUSDC;
      const spenderAddress = this.PLATFORM_WALLET;

      // Check current allowance
      const currentAllowance = await this.publicClient.readContract({
        address: this.USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'allowance',
        args: [userAddress as `0x${string}`, spenderAddress as `0x${string}`]
      });

      const requiresPermit = currentAllowance < BigInt(priceUSDC);

      // Store payment intent in Redis for later confirmation
      const paymentIntent = {
        contentId,
        userAddress,
        priceUSDC: priceUSDC.toString(),
        spenderAddress,
        timestamp: Date.now(),
        status: 'pending'
      };

      const intentId = `payment_intent_${userAddress}_${contentId}_${Date.now()}`;
      await this.redisService.set(intentId, paymentIntent, 3600); // 1 hour expiry

      return {
        requiresPermit,
        spenderAddress,
        amount: priceUSDC.toString(),
        calldata: requiresPermit ? this.generatePermitCalldata(userAddress, spenderAddress, priceUSDC.toString()) : undefined
      };

    } catch (error) {
      logger.error('Error preparing USDC checkout:', error);
      throw error;
    }
  }

  /**
   * Process USDC payment with permit signature
   */
  async processUSDCPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      const { contentId, userAddress, priceUSDC, permitSignature } = paymentRequest;

      // Get content information
      const content = await this.getContentInfo(contentId);
      if (!content) {
        throw new Error('Content not found');
      }

      // Verify price matches
      if (content.priceUSDC.toString() !== priceUSDC) {
        throw new Error('Price mismatch');
      }

      // Check if user already has access
      const hasAccess = await this.checkUserAccess(userAddress, contentId);
      if (hasAccess) {
        throw new Error('User already has access to this content');
      }

      let transactionHash: string;

      // Execute permit if provided
      if (permitSignature) {
        const permitTx = await this.walletClient.writeContract({
          address: this.USDC_ADDRESS as `0x${string}`,
          abi: USDC_ABI,
          functionName: 'permit',
          args: [
            permitSignature.owner as `0x${string}`,
            permitSignature.spender as `0x${string}`,
            BigInt(permitSignature.value),
            BigInt(permitSignature.deadline),
            permitSignature.v,
            permitSignature.r as `0x${string}`,
            permitSignature.s as `0x${string}`
          ]
        });

        // Wait for permit confirmation
        await this.publicClient.waitForTransactionReceipt({ hash: permitTx });
      }

      // Transfer USDC from user to revenue splitter
      const transferTx = await this.walletClient.writeContract({
        address: this.USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'transferFrom',
        args: [
          userAddress as `0x${string}`,
          content.splitter as `0x${string}`,
          BigInt(priceUSDC)
        ]
      });

      transactionHash = transferTx;

      // Wait for transfer confirmation
      await this.publicClient.waitForTransactionReceipt({ hash: transferTx });

      // Mint NFT access token
      const mintTx = await this.walletClient.writeContract({
        address: this.NFT_ACCESS_ADDRESS as `0x${string}`,
        abi: NFT_ACCESS_ABI,
        functionName: 'mintPPV',
        args: [
          userAddress as `0x${string}`,
          BigInt(contentId),
          BigInt(1)
        ]
      });

      // Wait for mint confirmation
      const mintReceipt = await this.publicClient.waitForTransactionReceipt({ hash: mintTx });

      // Record sale in content registry
      await this.walletClient.writeContract({
        address: this.CONTENT_REGISTRY_ADDRESS as `0x${string}`,
        abi: CONTENT_REGISTRY_ABI,
        functionName: 'recordSale',
        args: [
          BigInt(contentId),
          userAddress as `0x${string}`,
          BigInt(priceUSDC)
        ]
      });

      // Trigger revenue split release
      await this.releaseRevenue(content.splitter);

      // Generate entitlement ID from mint transaction
      const entitlementId = `${contentId}_${userAddress}_${mintReceipt.blockNumber}`;

      logger.info(`USDC payment processed successfully: ${transactionHash}`);

      return {
        success: true,
        transactionHash,
        entitlementId
      };

    } catch (error) {
      logger.error('Error processing USDC payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Confirm payment completion and mint entitlement
   */
  async confirmPayment(contentId: string, userAddress: string, providerRef: string): Promise<string> {
    try {
      // For USDC payments, this is handled in processUSDCPayment
      // For fiat payments, this would handle the webhook confirmation
      
      // Check if user has access (payment was successful)
      const hasAccess = await this.checkUserAccess(userAddress, contentId);
      if (!hasAccess) {
        throw new Error('Payment not confirmed on blockchain');
      }

      return `${contentId}_${userAddress}_confirmed`;

    } catch (error) {
      logger.error('Error confirming payment:', error);
      throw error;
    }
  }

  /**
   * Release revenue to splitter participants
   */
  private async releaseRevenue(splitterAddress: string): Promise<void> {
    try {
      await this.walletClient.writeContract({
        address: this.REVENUE_SPLITTER_ADDRESS as `0x${string}`,
        abi: REVENUE_SPLITTER_ABI,
        functionName: 'release',
        args: [
          splitterAddress as `0x${string}`,
          this.USDC_ADDRESS as `0x${string}`
        ]
      });

      logger.info(`Revenue released for splitter: ${splitterAddress}`);
    } catch (error) {
      logger.error('Error releasing revenue:', error);
      // Don't throw - payment was successful even if revenue release fails
    }
  }

  /**
   * Get content information from registry
   */
  private async getContentInfo(contentId: string): Promise<any> {
    try {
      const content = await this.publicClient.readContract({
        address: this.CONTENT_REGISTRY_ADDRESS as `0x${string}`,
        abi: CONTENT_REGISTRY_ABI,
        functionName: 'getContent',
        args: [BigInt(contentId)]
      });

      return {
        creator: content[0],
        splitter: content[1],
        metaURI: content[2],
        perceptualHash: content[3],
        geoMask: content[4],
        priceUSDC: content[5],
        storageClass: content[6],
        moderationStatus: content[7],
        createdAt: content[8],
        totalSales: content[9],
        viewCount: content[10]
      };
    } catch (error) {
      logger.error('Error getting content info:', error);
      return null;
    }
  }

  /**
   * Check if user has access to content
   */
  private async checkUserAccess(userAddress: string, contentId: string): Promise<boolean> {
    try {
      return await this.publicClient.readContract({
        address: this.NFT_ACCESS_ADDRESS as `0x${string}`,
        abi: NFT_ACCESS_ABI,
        functionName: 'hasAccess',
        args: [userAddress as `0x${string}`, BigInt(contentId)]
      });
    } catch (error) {
      logger.error('Error checking user access:', error);
      return false;
    }
  }

  /**
   * Generate permit calldata for frontend
   */
  private generatePermitCalldata(owner: string, spender: string, value: string): string {
    // This would generate the calldata for the permit function
    // The frontend would use this to construct the permit transaction
    const iface = new ethers.Interface(USDC_ABI);
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    
    return iface.encodeFunctionData('permit', [
      owner,
      spender,
      value,
      deadline,
      0, // v placeholder
      ethers.ZeroHash, // r placeholder
      ethers.ZeroHash  // s placeholder
    ]);
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(contentId: string, userAddress: string): Promise<{
    hasPaid: boolean;
    hasAccess: boolean;
    entitlementId?: string;
  }> {
    try {
      const hasAccess = await this.checkUserAccess(userAddress, contentId);
      
      return {
        hasPaid: hasAccess,
        hasAccess,
        entitlementId: hasAccess ? `${contentId}_${userAddress}` : undefined
      };
    } catch (error) {
      logger.error('Error getting payment status:', error);
      return {
        hasPaid: false,
        hasAccess: false
      };
    }
  }
}

export default USDCPaymentService;