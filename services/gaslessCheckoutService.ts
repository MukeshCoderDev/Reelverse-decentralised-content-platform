import { GaslessPaymentService, GaslessPaymentRequest, GaslessPaymentResult } from './gaslessPaymentService';

export interface CheckoutRequest {
  userId: string;
  contentId: string;
  amount: string; // USDC amount in wei
  userWalletAddress: string;
  paymentMethod: 'gasless' | 'traditional' | 'auto';
}

export interface CheckoutResult {
  success: boolean;
  checkoutId: string;
  paymentResult?: GaslessPaymentResult;
  gasSavings?: any;
  error?: string;
  paymentMethod: 'gasless' | 'traditional';
}

export interface CheckoutSession {
  id: string;
  userId: string;
  contentId: string;
  amount: string;
  userWalletAddress: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  paymentMethod?: 'gasless' | 'traditional';
  permitSignatureData?: any;
}

export class GaslessCheckoutService {
  private gaslessPaymentService: GaslessPaymentService;
  private platformWalletAddress: string;

  constructor(
    gaslessPaymentService: GaslessPaymentService,
    platformWalletAddress: string
  ) {
    this.gaslessPaymentService = gaslessPaymentService;
    this.platformWalletAddress = platformWalletAddress;
  }

  /**
   * Initialize checkout session
   */
  async initializeCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    try {
      console.log(`Initializing checkout for user ${request.userId}, content ${request.contentId}`);

      // Generate checkout session ID
      const checkoutId = `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create checkout session
      const session: CheckoutSession = {
        id: checkoutId,
        userId: request.userId,
        contentId: request.contentId,
        amount: request.amount,
        userWalletAddress: request.userWalletAddress,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes expiry
        status: 'pending'
      };

      // Validate payment preconditions
      const validation = await this.gaslessPaymentService.validatePaymentPreconditions(
        request.userWalletAddress,
        request.amount
      );

      if (!validation.valid) {
        throw new Error(`Payment validation failed: ${validation.error}`);
      }

      // Generate permit signature data for gasless payment
      if (request.paymentMethod === 'gasless' || request.paymentMethod === 'auto') {
        try {
          const permitData = await this.gaslessPaymentService.generatePermitSignatureData(
            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC address
            this.platformWalletAddress,
            request.amount,
            Math.floor(Date.now() / 1000) + 3600 // 1 hour deadline
          );

          session.permitSignatureData = permitData;
          console.log(`Permit signature data generated for checkout ${checkoutId}`);
        } catch (error) {
          console.warn('Failed to generate permit data, will use traditional payment:', error.message);
          if (request.paymentMethod === 'gasless') {
            throw new Error('Gasless payment not available, permit generation failed');
          }
        }
      }

      // Store session (in production, this would be stored in database)
      await this.storeCheckoutSession(session);

      console.log(`Checkout session initialized: ${checkoutId}`);
      return session;

    } catch (error) {
      console.error('Checkout initialization failed:', error);
      throw error;
    }
  }

  /**
   * Complete checkout with signed permit
   */
  async completeCheckout(
    checkoutId: string,
    permitSignature: string
  ): Promise<CheckoutResult> {
    try {
      console.log(`Completing checkout ${checkoutId}`);

      // Get checkout session
      const session = await this.getCheckoutSession(checkoutId);
      if (!session) {
        throw new Error('Checkout session not found');
      }

      // Validate session
      if (session.status !== 'pending') {
        throw new Error(`Checkout session is ${session.status}`);
      }

      if (new Date() > session.expiresAt) {
        await this.updateCheckoutStatus(checkoutId, 'expired');
        throw new Error('Checkout session has expired');
      }

      // Determine payment method
      const useGasless = session.permitSignatureData && permitSignature;
      const paymentMethod = useGasless ? 'gasless' : 'traditional';

      let paymentResult: GaslessPaymentResult;
      let gasSavings: any;

      if (useGasless) {
        // Execute gasless payment
        const gaslessRequest: GaslessPaymentRequest = {
          from: session.userWalletAddress,
          to: this.platformWalletAddress,
          amount: session.amount,
          permit: {
            token: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            spender: this.platformWalletAddress,
            amount: session.amount,
            deadline: session.permitSignatureData.value.deadline,
            nonce: session.permitSignatureData.value.nonce,
            signature: permitSignature
          },
          metadata: {
            contentId: session.contentId,
            purchaseType: 'content_purchase'
          }
        };

        paymentResult = await this.gaslessPaymentService.executeGaslessPayment(gaslessRequest);
        
        // Calculate gas savings
        gasSavings = await this.gaslessPaymentService.estimateGasSavings(session.amount);

      } else {
        // Execute traditional payment (fallback)
        paymentResult = await this.executeTraditionalPayment(session);
      }

      // Update session status
      const finalStatus = paymentResult.success ? 'completed' : 'failed';
      await this.updateCheckoutStatus(checkoutId, finalStatus);

      // Record purchase if successful
      if (paymentResult.success) {
        await this.recordPurchase(session, paymentResult, paymentMethod);
      }

      const result: CheckoutResult = {
        success: paymentResult.success,
        checkoutId,
        paymentResult,
        gasSavings,
        paymentMethod,
        error: paymentResult.error
      };

      console.log(`Checkout ${checkoutId} completed: ${paymentResult.success ? 'success' : 'failed'}`);
      return result;

    } catch (error) {
      console.error(`Checkout completion failed for ${checkoutId}:`, error);
      
      // Update session status to failed
      try {
        await this.updateCheckoutStatus(checkoutId, 'failed');
      } catch (updateError) {
        console.error('Failed to update checkout status:', updateError);
      }

      return {
        success: false,
        checkoutId,
        paymentMethod: 'traditional', // Default
        error: error.message
      };
    }
  }

  /**
   * Execute traditional payment (fallback)
   */
  private async executeTraditionalPayment(session: CheckoutSession): Promise<GaslessPaymentResult> {
    try {
      console.log(`Executing traditional payment for checkout ${session.id}`);

      // This would integrate with existing payment processing
      // For now, return a mock successful result
      return {
        success: true,
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
        gasSponsored: false,
        fallbackUsed: true
      };

    } catch (error) {
      console.error('Traditional payment failed:', error);
      return {
        success: false,
        gasSponsored: false,
        error: error.message
      };
    }
  }

  /**
   * Get checkout session
   */
  private async getCheckoutSession(checkoutId: string): Promise<CheckoutSession | null> {
    try {
      // In production, this would query the database
      // For now, return mock session data
      return {
        id: checkoutId,
        userId: 'user123',
        contentId: 'content456',
        amount: '1000000', // 1 USDC
        userWalletAddress: '0x1234567890123456789012345678901234567890',
        createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        status: 'pending',
        permitSignatureData: {
          domain: {},
          types: {},
          value: {
            deadline: Math.floor(Date.now() / 1000) + 3600,
            nonce: 123456
          }
        }
      };
    } catch (error) {
      console.error('Failed to get checkout session:', error);
      return null;
    }
  }

  /**
   * Store checkout session
   */
  private async storeCheckoutSession(session: CheckoutSession): Promise<void> {
    try {
      // In production, this would store in database
      console.log(`Storing checkout session ${session.id}`);
    } catch (error) {
      console.error('Failed to store checkout session:', error);
      throw error;
    }
  }

  /**
   * Update checkout session status
   */
  private async updateCheckoutStatus(
    checkoutId: string,
    status: CheckoutSession['status']
  ): Promise<void> {
    try {
      // In production, this would update the database
      console.log(`Updating checkout ${checkoutId} status to ${status}`);
    } catch (error) {
      console.error('Failed to update checkout status:', error);
    }
  }

  /**
   * Record successful purchase
   */
  private async recordPurchase(
    session: CheckoutSession,
    paymentResult: GaslessPaymentResult,
    paymentMethod: 'gasless' | 'traditional'
  ): Promise<void> {
    try {
      const purchase = {
        id: `purchase_${Date.now()}`,
        userId: session.userId,
        contentId: session.contentId,
        amount: session.amount,
        paymentMethod,
        gasSponsored: paymentResult.gasSponsored,
        transactionHash: paymentResult.transactionHash || paymentResult.userOpHash,
        completedAt: new Date()
      };

      // In production, this would store in database and trigger content access
      console.log(`Purchase recorded:`, purchase);

    } catch (error) {
      console.error('Failed to record purchase:', error);
      // Don't throw - purchase was successful even if recording failed
    }
  }

  /**
   * Get checkout statistics
   */
  async getCheckoutStats(): Promise<any> {
    try {
      // In production, this would query the database
      return {
        totalCheckouts: 2500,
        completedCheckouts: 2200,
        failedCheckouts: 200,
        expiredCheckouts: 100,
        gaslessCheckouts: 1980,
        traditionalCheckouts: 220,
        gaslessSuccessRate: 90.0, // 90% success rate for gasless
        avgCompletionTimeMs: 3500,
        totalVolumeUSDC: '250000.75',
        last24hCheckouts: 125,
        last24hGasless: 115
      };
    } catch (error) {
      console.error('Failed to get checkout stats:', error);
      return {
        totalCheckouts: 0,
        completedCheckouts: 0,
        failedCheckouts: 0,
        expiredCheckouts: 0,
        gaslessCheckouts: 0,
        traditionalCheckouts: 0,
        gaslessSuccessRate: 0,
        avgCompletionTimeMs: 0,
        totalVolumeUSDC: '0',
        last24hCheckouts: 0,
        last24hGasless: 0
      };
    }
  }

  /**
   * Cancel checkout session
   */
  async cancelCheckout(checkoutId: string): Promise<void> {
    try {
      console.log(`Cancelling checkout ${checkoutId}`);
      await this.updateCheckoutStatus(checkoutId, 'failed');
    } catch (error) {
      console.error('Failed to cancel checkout:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired checkout sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      // In production, this would query and update expired sessions in database
      console.log('Cleaning up expired checkout sessions');
      
      // Mock cleanup - return number of cleaned sessions
      return 5;
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * Get user's checkout history
   */
  async getUserCheckoutHistory(userId: string, limit: number = 10): Promise<CheckoutSession[]> {
    try {
      // In production, this would query the database
      console.log(`Getting checkout history for user ${userId}`);
      
      // Return mock history
      return [];
    } catch (error) {
      console.error('Failed to get user checkout history:', error);
      return [];
    }
  }

  /**
   * Estimate checkout completion rate
   */
  async estimateCompletionRate(paymentMethod: 'gasless' | 'traditional'): Promise<number> {
    try {
      // In production, this would analyze historical data
      const rates = {
        gasless: 92.5, // 92.5% completion rate for gasless
        traditional: 78.0 // 78% completion rate for traditional
      };

      return rates[paymentMethod];
    } catch (error) {
      console.error('Failed to estimate completion rate:', error);
      return 0;
    }
  }
}