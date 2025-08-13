import axios from 'axios';
import { logger } from '../utils/logger';
import { RedisService } from '../config/redis';

export interface PersonaInquiry {
  id: string;
  type: string;
  status: string;
  created_at: string;
  completed_at?: string;
  failed_at?: string;
  attributes?: {
    name_first?: string;
    name_last?: string;
    birthdate?: string;
    address_street_1?: string;
    address_city?: string;
    address_subdivision?: string;
    address_postal_code?: string;
    address_country_code?: string;
  };
}

export interface AgeVerificationStatus {
  address: string;
  status: 'none' | 'pending' | 'verified' | 'failed' | 'expired';
  provider: 'persona';
  inquiryId?: string;
  verifiedAt?: Date;
  expiresAt?: Date;
  sbTokenId?: string;
  failureReason?: string;
}

export interface PersonaWebhookEvent {
  type: string;
  id: string;
  created_at: string;
  data: {
    object: PersonaInquiry;
  };
}

export class AgeVerificationService {
  private static instance: AgeVerificationService;
  private personaApiKey: string;
  private personaTemplateId: string;
  private personaEnvironment: string;
  private redisService: RedisService;

  private constructor() {
    this.personaApiKey = process.env.PERSONA_API_KEY || '';
    this.personaTemplateId = process.env.PERSONA_TEMPLATE_ID || '';
    this.personaEnvironment = process.env.PERSONA_ENVIRONMENT || 'sandbox';
    this.redisService = RedisService.getInstance();

    if (!this.personaApiKey) {
      logger.warn('PERSONA_API_KEY not configured - age verification will not work');
    }
  }

  public static getInstance(): AgeVerificationService {
    if (!AgeVerificationService.instance) {
      AgeVerificationService.instance = new AgeVerificationService();
    }
    return AgeVerificationService.instance;
  }

  /**
   * Start age verification process for a user
   */
  async startVerification(address: string, referenceId?: string): Promise<{
    inquiryId: string;
    sessionToken: string;
    url: string;
  }> {
    try {
      logger.info(`Starting age verification for address: ${address}`);

      // Check if user already has a pending verification
      const existingStatus = await this.getVerificationStatus(address);
      if (existingStatus.status === 'pending' && existingStatus.inquiryId) {
        // Return existing inquiry if still pending
        const sessionToken = await this.getInquirySessionToken(existingStatus.inquiryId);
        return {
          inquiryId: existingStatus.inquiryId,
          sessionToken,
          url: this.buildPersonaUrl(existingStatus.inquiryId, sessionToken)
        };
      }

      // Create new Persona inquiry
      const inquiry = await this.createPersonaInquiry(address, referenceId);
      
      // Store verification status
      await this.updateVerificationStatus(address, {
        address,
        status: 'pending',
        provider: 'persona',
        inquiryId: inquiry.id,
      });

      // Get session token for the inquiry
      const sessionToken = await this.getInquirySessionToken(inquiry.id);

      logger.info(`Age verification started for ${address}, inquiry: ${inquiry.id}`);

      return {
        inquiryId: inquiry.id,
        sessionToken,
        url: this.buildPersonaUrl(inquiry.id, sessionToken)
      };
    } catch (error) {
      logger.error('Failed to start age verification:', error);
      throw new Error('Failed to start age verification process');
    }
  }

  /**
   * Get verification status for an address
   */
  async getVerificationStatus(address: string): Promise<AgeVerificationStatus> {
    try {
      const statusKey = `age_verification:${address.toLowerCase()}`;
      const statusData = await this.redisService.get(statusKey);

      if (!statusData) {
        return {
          address,
          status: 'none',
          provider: 'persona'
        };
      }

      const status: AgeVerificationStatus = JSON.parse(statusData);
      
      // Check if verification has expired (1 year validity)
      if (status.status === 'verified' && status.expiresAt && new Date() > new Date(status.expiresAt)) {
        status.status = 'expired';
        await this.updateVerificationStatus(address, status);
      }

      return status;
    } catch (error) {
      logger.error('Failed to get verification status:', error);
      return {
        address,
        status: 'none',
        provider: 'persona'
      };
    }
  }

  /**
   * Handle Persona webhook events
   */
  async handleWebhook(event: PersonaWebhookEvent): Promise<void> {
    try {
      logger.info(`Processing Persona webhook: ${event.type} for inquiry ${event.data.object.id}`);

      const inquiry = event.data.object;
      const address = await this.getAddressForInquiry(inquiry.id);

      if (!address) {
        logger.warn(`No address found for inquiry ${inquiry.id}`);
        return;
      }

      switch (event.type) {
        case 'inquiry.completed':
          await this.handleInquiryCompleted(address, inquiry);
          break;
        case 'inquiry.failed':
          await this.handleInquiryFailed(address, inquiry);
          break;
        case 'inquiry.expired':
          await this.handleInquiryExpired(address, inquiry);
          break;
        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      logger.error('Failed to handle Persona webhook:', error);
      throw error;
    }
  }

  /**
   * Check if address is age verified and eligible for SBT minting
   */
  async isEligibleForSBT(address: string): Promise<boolean> {
    const status = await this.getVerificationStatus(address);
    return status.status === 'verified' && !status.sbTokenId;
  }

  /**
   * Mark SBT as minted for verified address
   */
  async markSBTMinted(address: string, tokenId: string): Promise<void> {
    const status = await this.getVerificationStatus(address);
    if (status.status === 'verified') {
      status.sbTokenId = tokenId;
      await this.updateVerificationStatus(address, status);
      logger.info(`SBT marked as minted for ${address}, token ID: ${tokenId}`);
    }
  }

  // Private helper methods

  private async createPersonaInquiry(address: string, referenceId?: string): Promise<PersonaInquiry> {
    const response = await axios.post(
      'https://withpersona.com/api/v1/inquiries',
      {
        data: {
          type: 'inquiry',
          attributes: {
            'inquiry-template-id': this.personaTemplateId,
            'reference-id': referenceId || address,
            'note': `Age verification for wallet address: ${address}`,
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.personaApiKey}`,
          'Content-Type': 'application/json',
          'Persona-Version': '2023-01-05'
        }
      }
    );

    return response.data.data;
  }

  private async getInquirySessionToken(inquiryId: string): Promise<string> {
    const response = await axios.post(
      `https://withpersona.com/api/v1/inquiries/${inquiryId}/session-token`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${this.personaApiKey}`,
          'Content-Type': 'application/json',
          'Persona-Version': '2023-01-05'
        }
      }
    );

    return response.data.data.attributes['session-token'];
  }

  private buildPersonaUrl(inquiryId: string, sessionToken: string): string {
    const baseUrl = this.personaEnvironment === 'production' 
      ? 'https://withpersona.com/verify'
      : 'https://withpersona.com/verify';
    
    return `${baseUrl}?inquiry-id=${inquiryId}&session-token=${sessionToken}`;
  }

  private async updateVerificationStatus(address: string, status: AgeVerificationStatus): Promise<void> {
    const statusKey = `age_verification:${address.toLowerCase()}`;
    await this.redisService.set(statusKey, JSON.stringify(status), 31536000); // 1 year TTL
    
    // Also store inquiry -> address mapping
    if (status.inquiryId) {
      const inquiryKey = `inquiry_address:${status.inquiryId}`;
      await this.redisService.set(inquiryKey, address.toLowerCase(), 86400); // 24 hour TTL
    }
  }

  private async getAddressForInquiry(inquiryId: string): Promise<string | null> {
    const inquiryKey = `inquiry_address:${inquiryId}`;
    return await this.redisService.get(inquiryKey);
  }

  private async handleInquiryCompleted(address: string, inquiry: PersonaInquiry): Promise<void> {
    try {
      // Verify the person is 18+ based on birthdate
      const birthdate = inquiry.attributes?.birthdate;
      if (!birthdate) {
        await this.handleInquiryFailed(address, inquiry, 'No birthdate provided');
        return;
      }

      const age = this.calculateAge(new Date(birthdate));
      if (age < 18) {
        await this.handleInquiryFailed(address, inquiry, 'Under 18 years old');
        return;
      }

      // Mark as verified
      const status: AgeVerificationStatus = {
        address,
        status: 'verified',
        provider: 'persona',
        inquiryId: inquiry.id,
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      };

      await this.updateVerificationStatus(address, status);
      logger.info(`Age verification completed for ${address}, age: ${age}`);

      // TODO: Trigger SBT minting process here
      // This would integrate with the smart contract service
      
    } catch (error) {
      logger.error('Failed to handle inquiry completion:', error);
      await this.handleInquiryFailed(address, inquiry, 'Processing error');
    }
  }

  private async handleInquiryFailed(address: string, inquiry: PersonaInquiry, reason?: string): Promise<void> {
    const status: AgeVerificationStatus = {
      address,
      status: 'failed',
      provider: 'persona',
      inquiryId: inquiry.id,
      failureReason: reason || 'Verification failed'
    };

    await this.updateVerificationStatus(address, status);
    logger.info(`Age verification failed for ${address}: ${reason || 'Unknown reason'}`);
  }

  private async handleInquiryExpired(address: string, inquiry: PersonaInquiry): Promise<void> {
    const status: AgeVerificationStatus = {
      address,
      status: 'failed',
      provider: 'persona',
      inquiryId: inquiry.id,
      failureReason: 'Verification expired'
    };

    await this.updateVerificationStatus(address, status);
    logger.info(`Age verification expired for ${address}`);
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
}