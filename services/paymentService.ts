/**
 * Payment Service
 * Handles USDC and fiat payment processing for content purchases
 */

export type PaymentMethod = 'usdc' | 'fiat';
export type EntitlementType = 'ppv' | 'subscription';

export interface PaymentRequest {
  contentId: string;
  userAddress: string;
  amount: number; // USDC in 6 decimals or USD in cents
  entitlementType: EntitlementType;
  subscriptionDuration?: number; // Days for subscription
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  entitlementId?: string;
  expiresAt?: string;
  error?: string;
}

export interface USDCPaymentData {
  permitTx?: any;
  calldata?: string;
  contractAddress: string;
  gasEstimate: string;
}

export interface FiatPaymentData {
  hostedUrl: string;
  sessionId: string;
  provider: 'ccbill' | 'segpay';
}

export class PaymentService {
  private static instance: PaymentService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Process USDC payment using permit functionality
   */
  async processUSDCPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // Step 1: Get payment data from backend
      const paymentData = await this.getUSDCPaymentData(request);
      
      // Step 2: Execute blockchain transaction
      const txResult = await this.executeUSDCTransaction(paymentData, request);
      
      // Step 3: Confirm payment with backend
      const result = await this.confirmPayment(txResult.transactionHash, 'usdc', request);
      
      return {
        success: true,
        transactionId: txResult.transactionHash,
        amount: (request.amount / 1000000).toFixed(2),
        currency: 'USDC',
        method: 'usdc',
        entitlementId: result.entitlementId,
        expiresAt: result.expiresAt
      };
    } catch (error: any) {
      console.error('USDC payment failed:', error);
      return {
        success: false,
        transactionId: '',
        amount: (request.amount / 1000000).toFixed(2),
        currency: 'USDC',
        method: 'usdc',
        error: error.message || 'USDC payment failed'
      };
    }
  }

  /**
   * Process fiat payment using hosted checkout
   */
  async processFiatPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // Step 1: Get hosted checkout URL
      const paymentData = await this.getFiatPaymentData(request);
      
      // Step 2: Open hosted checkout
      const paymentResult = await this.openHostedCheckout(paymentData);
      
      // Step 3: Confirm payment
      const result = await this.confirmPayment(paymentResult.sessionId, 'fiat', request);
      
      return {
        success: true,
        transactionId: paymentResult.sessionId,
        amount: request.amount.toFixed(2),
        currency: 'USD',
        method: 'fiat',
        entitlementId: result.entitlementId,
        expiresAt: result.expiresAt
      };
    } catch (error: any) {
      console.error('Fiat payment failed:', error);
      return {
        success: false,
        transactionId: '',
        amount: request.amount.toFixed(2),
        currency: 'USD',
        method: 'fiat',
        error: error.message || 'Fiat payment failed'
      };
    }
  }

  /**
   * Get USDC payment transaction data
   */
  private async getUSDCPaymentData(request: PaymentRequest): Promise<USDCPaymentData> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/payments/usdc/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to prepare USDC payment');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error preparing USDC payment:', error);
      
      // Return mock data for development
      if (import.meta.env.DEV) {
        return this.getMockUSDCPaymentData(request);
      }
      
      throw error;
    }
  }

  /**
   * Get fiat payment hosted checkout data
   */
  private async getFiatPaymentData(request: PaymentRequest): Promise<FiatPaymentData> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/payments/fiat/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to prepare fiat payment');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error preparing fiat payment:', error);
      
      // Return mock data for development
      if (import.meta.env.DEV) {
        return this.getMockFiatPaymentData(request);
      }
      
      throw error;
    }
  }

  /**
   * Execute USDC blockchain transaction
   */
  private async executeUSDCTransaction(paymentData: USDCPaymentData, request: PaymentRequest): Promise<{ transactionHash: string }> {
    // In a real implementation, this would interact with the user's wallet
    // For now, we'll simulate the transaction
    
    if (import.meta.env.DEV) {
      // Simulate transaction delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`
      };
    }

    // Real implementation would use ethers.js or similar
    throw new Error('USDC transaction execution not implemented');
  }

  /**
   * Open hosted checkout for fiat payments
   */
  private async openHostedCheckout(paymentData: FiatPaymentData): Promise<{ sessionId: string }> {
    return new Promise((resolve, reject) => {
      // Open hosted checkout in popup
      const popup = window.open(
        paymentData.hostedUrl,
        'payment-checkout',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        reject(new Error('Failed to open payment popup. Please allow popups for this site.'));
        return;
      }

      // Poll for popup closure or success
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          
          // In development, simulate successful payment
          if (import.meta.env.DEV) {
            resolve({ sessionId: paymentData.sessionId });
          } else {
            reject(new Error('Payment was cancelled or failed'));
          }
        }
      }, 1000);

      // Timeout after 10 minutes
      setTimeout(() => {
        if (!popup.closed) {
          popup.close();
          clearInterval(checkClosed);
          reject(new Error('Payment timeout'));
        }
      }, 10 * 60 * 1000);
    });
  }

  /**
   * Confirm payment with backend
   */
  private async confirmPayment(
    transactionId: string, 
    method: PaymentMethod, 
    request: PaymentRequest
  ): Promise<{ entitlementId: string; expiresAt?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/payments/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          method,
          contentId: request.contentId,
          userAddress: request.userAddress,
          entitlementType: request.entitlementType
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to confirm payment');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error confirming payment:', error);
      
      // Return mock data for development
      if (import.meta.env.DEV) {
        return this.getMockConfirmationData(request);
      }
      
      throw error;
    }
  }

  /**
   * Get user's payment history
   */
  async getPaymentHistory(userAddress: string): Promise<PaymentResult[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/payments/history/${userAddress}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to get payment history');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting payment history:', error);
      return [];
    }
  }

  /**
   * Check if user has valid entitlement for content
   */
  async checkEntitlement(contentId: string, userAddress: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/payments/entitlement/${contentId}/${userAddress}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.data.hasEntitlement;
    } catch (error) {
      console.error('Error checking entitlement:', error);
      return false;
    }
  }

  /**
   * Mock USDC payment data for development
   */
  private getMockUSDCPaymentData(request: PaymentRequest): USDCPaymentData {
    return {
      contractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
      calldata: '0x' + Math.random().toString(16).substr(2, 128),
      gasEstimate: '150000'
    };
  }

  /**
   * Mock fiat payment data for development
   */
  private getMockFiatPaymentData(request: PaymentRequest): FiatPaymentData {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hostedUrl: `https://checkout.example.com/session/${sessionId}`,
      sessionId,
      provider: 'ccbill'
    };
  }

  /**
   * Mock confirmation data for development
   */
  private getMockConfirmationData(request: PaymentRequest): { entitlementId: string; expiresAt?: string } {
    const entitlementId = `ent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let expiresAt: string | undefined;
    if (request.entitlementType === 'subscription' && request.subscriptionDuration) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + request.subscriptionDuration);
      expiresAt = expiry.toISOString();
    }
    
    return {
      entitlementId,
      expiresAt
    };
  }

  /**
   * Format payment amount for display
   */
  formatAmount(amount: number, currency: 'USDC' | 'USD'): string {
    if (currency === 'USDC') {
      return `${(amount / 1000000).toFixed(2)} USDC`;
    }
    return `$${amount.toFixed(2)} USD`;
  }

  /**
   * Validate payment request
   */
  validatePaymentRequest(request: PaymentRequest): { valid: boolean; error?: string } {
    if (!request.contentId) {
      return { valid: false, error: 'Content ID is required' };
    }
    
    if (!request.userAddress || !request.userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return { valid: false, error: 'Valid user address is required' };
    }
    
    if (!request.amount || request.amount <= 0) {
      return { valid: false, error: 'Valid amount is required' };
    }
    
    if (!['ppv', 'subscription'].includes(request.entitlementType)) {
      return { valid: false, error: 'Valid entitlement type is required' };
    }
    
    if (request.entitlementType === 'subscription' && (!request.subscriptionDuration || request.subscriptionDuration <= 0)) {
      return { valid: false, error: 'Valid subscription duration is required' };
    }
    
    return { valid: true };
  }
}