import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { RedisService } from '../config/redis';
import USDCPaymentService from './usdcPaymentService';

export interface FiatCheckoutRequest {
  contentId: string;
  userAddress: string;
  userEmail?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface FiatCheckoutResponse {
  success: boolean;
  hostedUrl?: string;
  sessionId?: string;
  error?: string;
}

export interface WebhookPayload {
  provider: 'ccbill' | 'segpay';
  transactionId: string;
  sessionId: string;
  status: 'approved' | 'declined' | 'pending';
  amount: number;
  currency: string;
  timestamp: string;
  signature?: string;
  [key: string]: any;
}

export interface PaymentSession {
  contentId: string;
  userAddress: string;
  userEmail?: string;
  priceUSD: number;
  provider: 'ccbill' | 'segpay';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  expiresAt: number;
  transactionId?: string;
  hostedUrl?: string;
}

export class FiatPaymentService {
  private redisService: RedisService;
  private usdcPaymentService: USDCPaymentService;

  // CCBill configuration
  private readonly CCBILL_CLIENT_ACCOUNT = process.env.CCBILL_CLIENT_ACCOUNT!;
  private readonly CCBILL_CLIENT_SUBACCOUNT = process.env.CCBILL_CLIENT_SUBACCOUNT!;
  private readonly CCBILL_FORM_NAME = process.env.CCBILL_FORM_NAME || 'cc_form';
  private readonly CCBILL_SALT = process.env.CCBILL_SALT!;
  private readonly CCBILL_WEBHOOK_SECRET = process.env.CCBILL_WEBHOOK_SECRET!;

  // Segpay configuration
  private readonly SEGPAY_PACKAGE_ID = process.env.SEGPAY_PACKAGE_ID!;
  private readonly SEGPAY_MERCHANT_ID = process.env.SEGPAY_MERCHANT_ID!;
  private readonly SEGPAY_API_KEY = process.env.SEGPAY_API_KEY!;
  private readonly SEGPAY_WEBHOOK_SECRET = process.env.SEGPAY_WEBHOOK_SECRET!;

  // Base URLs
  private readonly CCBILL_BASE_URL = process.env.CCBILL_BASE_URL || 'https://api.ccbill.com';
  private readonly SEGPAY_BASE_URL = process.env.SEGPAY_BASE_URL || 'https://secure2.segpay.com';

  constructor() {
    this.redisService = new RedisService();
    this.usdcPaymentService = new USDCPaymentService();
  }

  /**
   * Create hosted checkout session for fiat payment
   */
  async createFiatCheckout(request: FiatCheckoutRequest): Promise<FiatCheckoutResponse> {
    try {
      const { contentId, userAddress, userEmail, returnUrl, cancelUrl } = request;

      // Get content information to determine price
      const content = await this.getContentInfo(contentId);
      if (!content) {
        throw new Error('Content not found');
      }

      if (content.moderationStatus !== 1) {
        throw new Error('Content not available for purchase');
      }

      // Convert USDC price to USD (assuming 1:1 for simplicity)
      const priceUSD = Number(content.priceUSDC) / 1000000; // Convert from 6 decimals

      // Create payment session
      const sessionId = this.generateSessionId();
      const session: PaymentSession = {
        contentId,
        userAddress,
        userEmail,
        priceUSD,
        provider: this.selectPaymentProvider(priceUSD),
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      };

      // Store session in Redis
      await this.redisService.set(`fiat_session:${sessionId}`, session, 86400); // 24 hours

      // Create hosted checkout URL based on provider
      let hostedUrl: string;
      if (session.provider === 'ccbill') {
        hostedUrl = await this.createCCBillCheckout(sessionId, session);
      } else {
        hostedUrl = await this.createSegpayCheckout(sessionId, session);
      }

      // Update session with hosted URL
      session.hostedUrl = hostedUrl;
      await this.redisService.set(`fiat_session:${sessionId}`, session, 86400);

      logger.info(`Fiat checkout created: ${sessionId} for content ${contentId}`);

      return {
        success: true,
        hostedUrl,
        sessionId
      };

    } catch (error) {
      logger.error('Error creating fiat checkout:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create CCBill hosted checkout URL
   */
  private async createCCBillCheckout(sessionId: string, session: PaymentSession): Promise<string> {
    const baseUrl = 'https://bill.ccbill.com/jpost/signup.cgi';
    
    const params = new URLSearchParams({
      clientAccnum: this.CCBILL_CLIENT_ACCOUNT,
      clientSubacc: this.CCBILL_CLIENT_SUBACCOUNT,
      formName: this.CCBILL_FORM_NAME,
      formPrice: session.priceUSD.toFixed(2),
      formPeriod: '2', // One-time payment (2 days to prevent auto-rebill)
      currencyCode: '840', // USD
      customer_fname: 'Customer',
      customer_lname: 'User',
      email: session.userEmail || 'noreply@reelverse.com',
      phone: '000-000-0000',
      address1: 'N/A',
      city: 'N/A',
      state: 'N/A',
      zipcode: '00000',
      country: 'US',
      // Custom fields for our tracking
      zc_orderNumber: sessionId,
      zc_contentId: session.contentId,
      zc_userAddress: session.userAddress,
      // Return URLs
      zc_approvalURL: process.env.FRONTEND_URL + '/payment/success',
      zc_declineURL: process.env.FRONTEND_URL + '/payment/failed',
      zc_cancelURL: process.env.FRONTEND_URL + '/payment/cancelled'
    });

    // Generate hash for security
    const hashString = `${session.priceUSD.toFixed(2)}2${this.CCBILL_SALT}`;
    const hash = crypto.createHash('md5').update(hashString).digest('hex');
    params.append('formDigest', hash);

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Create Segpay hosted checkout URL
   */
  private async createSegpayCheckout(sessionId: string, session: PaymentSession): Promise<string> {
    try {
      const requestData = {
        'package-id': this.SEGPAY_PACKAGE_ID,
        'merchant-id': this.SEGPAY_MERCHANT_ID,
        price: session.priceUSD.toFixed(2),
        currency: 'USD',
        'purchase-id': sessionId,
        'user-id': session.userAddress,
        email: session.userEmail || 'noreply@reelverse.com',
        'success-url': process.env.FRONTEND_URL + '/payment/success',
        'cancel-url': process.env.FRONTEND_URL + '/payment/cancelled',
        'decline-url': process.env.FRONTEND_URL + '/payment/failed',
        // Custom parameters
        'x-eticketid': session.contentId,
        'x-useraddress': session.userAddress
      };

      // Generate authentication hash
      const authString = Object.keys(requestData)
        .sort()
        .map(key => `${key}=${requestData[key as keyof typeof requestData]}`)
        .join('&');
      
      const auth = crypto
        .createHmac('sha256', this.SEGPAY_API_KEY)
        .update(authString)
        .digest('hex');

      const response = await axios.post(`${this.SEGPAY_BASE_URL}/api/create-session`, requestData, {
        headers: {
          'Authorization': `Bearer ${auth}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data.success && response.data.checkout_url) {
        return response.data.checkout_url;
      } else {
        throw new Error(`Segpay session creation failed: ${response.data.message || 'Unknown error'}`);
      }

    } catch (error) {
      logger.error('Error creating Segpay checkout:', error);
      throw new Error('Failed to create Segpay checkout session');
    }
  }

  /**
   * Handle webhook from payment providers
   */
  async handleWebhook(provider: 'ccbill' | 'segpay', payload: any): Promise<{ success: boolean; message: string }> {
    try {
      logger.info(`Received ${provider} webhook:`, payload);

      // Verify webhook signature
      if (!this.verifyWebhookSignature(provider, payload)) {
        logger.error(`Invalid webhook signature from ${provider}`);
        return { success: false, message: 'Invalid signature' };
      }

      // Parse webhook data based on provider
      let webhookData: WebhookPayload;
      if (provider === 'ccbill') {
        webhookData = this.parseCCBillWebhook(payload);
      } else {
        webhookData = this.parseSegpayWebhook(payload);
      }

      // Get payment session
      const session = await this.redisService.get(`fiat_session:${webhookData.sessionId}`);
      if (!session) {
        logger.error(`Payment session not found: ${webhookData.sessionId}`);
        return { success: false, message: 'Session not found' };
      }

      // Update session status
      session.status = webhookData.status === 'approved' ? 'completed' : 'failed';
      session.transactionId = webhookData.transactionId;
      await this.redisService.set(`fiat_session:${webhookData.sessionId}`, session, 86400);

      // If payment approved, mint NFT entitlement
      if (webhookData.status === 'approved') {
        await this.processSuccessfulPayment(session);
      }

      logger.info(`Webhook processed successfully for session ${webhookData.sessionId}`);
      return { success: true, message: 'Webhook processed' };

    } catch (error) {
      logger.error('Error processing webhook:', error);
      return { success: false, message: 'Webhook processing failed' };
    }
  }

  /**
   * Process successful fiat payment by minting NFT entitlement
   */
  private async processSuccessfulPayment(session: PaymentSession): Promise<void> {
    try {
      // Convert fiat payment to blockchain entitlement
      // This simulates the USDC payment flow but for fiat payments
      
      // For now, we'll use the USDC payment service's confirmation method
      // In a real implementation, this would involve:
      // 1. Minting NFT access token directly
      // 2. Recording the sale in content registry
      // 3. Handling revenue distribution (fiat to creator payouts)
      
      const entitlementId = await this.usdcPaymentService.confirmPayment(
        session.contentId,
        session.userAddress,
        session.transactionId || 'fiat-payment'
      );

      logger.info(`Fiat payment processed successfully: ${entitlementId}`);

    } catch (error) {
      logger.error('Error processing successful fiat payment:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(provider: 'ccbill' | 'segpay', payload: any): boolean {
    try {
      if (provider === 'ccbill') {
        // CCBill webhook verification
        const expectedHash = payload.responseDigest;
        if (!expectedHash) return false;

        const dataString = `${payload.subscription_id}${payload.account_number}${payload.subaccount_number}${this.CCBILL_WEBHOOK_SECRET}`;
        const calculatedHash = crypto.createHash('md5').update(dataString).digest('hex');
        
        return expectedHash.toLowerCase() === calculatedHash.toLowerCase();
      } else {
        // Segpay webhook verification
        const signature = payload.signature;
        if (!signature) return false;

        const dataString = JSON.stringify(payload);
        const calculatedSignature = crypto
          .createHmac('sha256', this.SEGPAY_WEBHOOK_SECRET)
          .update(dataString)
          .digest('hex');
        
        return signature === calculatedSignature;
      }
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Parse CCBill webhook payload
   */
  private parseCCBillWebhook(payload: any): WebhookPayload {
    return {
      provider: 'ccbill',
      transactionId: payload.subscription_id || payload.transaction_id,
      sessionId: payload.zc_orderNumber,
      status: payload.eventType === 'NewSaleSuccess' ? 'approved' : 'declined',
      amount: parseFloat(payload.billedInitialPrice || payload.accountingInitialPrice || '0'),
      currency: payload.billedCurrencyCode || 'USD',
      timestamp: payload.timestamp || new Date().toISOString(),
      signature: payload.responseDigest
    };
  }

  /**
   * Parse Segpay webhook payload
   */
  private parseSegpayWebhook(payload: any): WebhookPayload {
    return {
      provider: 'segpay',
      transactionId: payload.transaction_id || payload.purchase_id,
      sessionId: payload.purchase_id,
      status: payload.status === 'approved' ? 'approved' : 'declined',
      amount: parseFloat(payload.amount || '0'),
      currency: payload.currency || 'USD',
      timestamp: payload.timestamp || new Date().toISOString(),
      signature: payload.signature
    };
  }

  /**
   * Get payment session status
   */
  async getPaymentSession(sessionId: string): Promise<PaymentSession | null> {
    try {
      return await this.redisService.get(`fiat_session:${sessionId}`);
    } catch (error) {
      logger.error('Error getting payment session:', error);
      return null;
    }
  }

  /**
   * Cancel payment session
   */
  async cancelPaymentSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.redisService.get(`fiat_session:${sessionId}`);
      if (!session) {
        return false;
      }

      session.status = 'cancelled';
      await this.redisService.set(`fiat_session:${sessionId}`, session, 86400);
      
      logger.info(`Payment session cancelled: ${sessionId}`);
      return true;
    } catch (error) {
      logger.error('Error cancelling payment session:', error);
      return false;
    }
  }

  /**
   * Select payment provider based on amount and region
   */
  private selectPaymentProvider(amount: number): 'ccbill' | 'segpay' {
    // Simple logic - can be enhanced with geographic and amount-based rules
    // CCBill for higher amounts, Segpay for lower amounts
    return amount >= 10 ? 'ccbill' : 'segpay';
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `fiat_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get content information (reuse from USDC service)
   */
  private async getContentInfo(contentId: string): Promise<any> {
    // This should ideally be extracted to a shared service
    // For now, we'll create a simple version
    try {
      // In a real implementation, this would query the content registry
      // For now, return mock data or delegate to USDC service
      return {
        priceUSDC: BigInt('5000000'), // 5 USDC
        moderationStatus: 1, // Approved
        creator: '0x1234567890123456789012345678901234567890',
        splitter: '0x2345678901234567890123456789012345678901'
      };
    } catch (error) {
      logger.error('Error getting content info:', error);
      return null;
    }
  }

  /**
   * Get payment methods available for user
   */
  async getAvailablePaymentMethods(userAddress: string, contentId: string): Promise<{
    usdc: boolean;
    fiat: boolean;
    providers: string[];
  }> {
    try {
      // Check if content exists and is available
      const content = await this.getContentInfo(contentId);
      if (!content || content.moderationStatus !== 1) {
        return { usdc: false, fiat: false, providers: [] };
      }

      // Both USDC and fiat should be available for most content
      return {
        usdc: true,
        fiat: true,
        providers: ['ccbill', 'segpay']
      };
    } catch (error) {
      logger.error('Error getting available payment methods:', error);
      return { usdc: false, fiat: false, providers: [] };
    }
  }
}

export default FiatPaymentService;