/**
 * Frontend Age Verification Service
 * Handles communication with the backend age verification API
 */

export interface AgeVerificationStatus {
  address: string;
  status: 'none' | 'pending' | 'verified' | 'failed' | 'expired';
  provider: 'persona';
  inquiryId?: string;
  verifiedAt?: string;
  expiresAt?: string;
  sbTokenId?: string;
  failureReason?: string;
}

export interface VerificationStartResponse {
  inquiryId: string;
  verificationUrl: string;
  provider: string;
}

export interface SBTEligibilityResponse {
  eligible: boolean;
  address: string;
}

export class AgeVerificationService {
  private static instance: AgeVerificationService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  public static getInstance(): AgeVerificationService {
    if (!AgeVerificationService.instance) {
      AgeVerificationService.instance = new AgeVerificationService();
    }
    return AgeVerificationService.instance;
  }

  /**
   * Get age verification status for an address
   */
  async getVerificationStatus(address: string): Promise<AgeVerificationStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/age-verification/status/${address}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to get verification status: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting verification status:', error);
      throw new Error('Failed to get age verification status');
    }
  }

  /**
   * Start age verification process
   */
  async startVerification(address: string, referenceId?: string): Promise<VerificationStartResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/age-verification/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address, referenceId }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to start verification: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error starting verification:', error);
      throw error;
    }
  }

  /**
   * Check if address is eligible for SBT minting
   */
  async checkSBTEligibility(address: string): Promise<SBTEligibilityResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/age-verification/sbt-eligible/${address}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to check SBT eligibility: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error checking SBT eligibility:', error);
      throw new Error('Failed to check SBT eligibility');
    }
  }

  /**
   * Open Persona verification in a popup window
   */
  async openVerificationPopup(verificationUrl: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const popup = window.open(
        verificationUrl,
        'persona-verification',
        'width=500,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        reject(new Error('Failed to open verification popup. Please allow popups for this site.'));
        return;
      }

      // Poll for popup closure
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          resolve(true);
        }
      }, 1000);

      // Handle popup blocked or closed immediately
      setTimeout(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          reject(new Error('Verification popup was closed'));
        }
      }, 1000);
    });
  }

  /**
   * Poll verification status until completion
   */
  async pollVerificationStatus(
    address: string, 
    onStatusChange?: (status: AgeVerificationStatus) => void,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<AgeVerificationStatus> {
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          const status = await this.getVerificationStatus(address);

          if (onStatusChange) {
            onStatusChange(status);
          }

          // Check if verification is complete
          if (status.status === 'verified' || status.status === 'failed') {
            resolve(status);
            return;
          }

          // Check if we've exceeded max attempts
          if (attempts >= maxAttempts) {
            reject(new Error('Verification polling timeout'));
            return;
          }

          // Continue polling
          setTimeout(poll, intervalMs);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  /**
   * Complete verification flow with popup and polling
   */
  async completeVerification(
    address: string,
    onStatusChange?: (status: AgeVerificationStatus) => void
  ): Promise<AgeVerificationStatus> {
    try {
      // Start verification process
      const startResult = await this.startVerification(address);

      // Open verification popup
      const popupPromise = this.openVerificationPopup(startResult.verificationUrl);

      // Start polling for status changes
      const pollPromise = this.pollVerificationStatus(address, onStatusChange);

      // Wait for either popup to close or verification to complete
      await Promise.race([popupPromise, pollPromise]);

      // Get final status
      const finalStatus = await this.getVerificationStatus(address);
      return finalStatus;
    } catch (error) {
      console.error('Error completing verification:', error);
      throw error;
    }
  }

  /**
   * Check if user needs age verification
   */
  async needsVerification(address: string): Promise<boolean> {
    try {
      const status = await this.getVerificationStatus(address);
      return status.status !== 'verified';
    } catch (error) {
      console.error('Error checking verification need:', error);
      return true; // Assume verification needed on error
    }
  }

  /**
   * Get user-friendly status message
   */
  getStatusMessage(status: AgeVerificationStatus): string {
    switch (status.status) {
      case 'none':
        return 'Age verification required';
      case 'pending':
        return 'Age verification in progress';
      case 'verified':
        return 'Age verified';
      case 'failed':
        return `Age verification failed: ${status.failureReason || 'Unknown reason'}`;
      case 'expired':
        return 'Age verification expired - please verify again';
      default:
        return 'Unknown verification status';
    }
  }

  /**
   * Get status color for UI
   */
  getStatusColor(status: AgeVerificationStatus): string {
    switch (status.status) {
      case 'verified':
        return '#28a745'; // Green
      case 'pending':
        return '#ffc107'; // Yellow
      case 'failed':
      case 'expired':
        return '#dc3545'; // Red
      default:
        return '#6c757d'; // Gray
    }
  }
}