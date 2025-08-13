import { SiweMessage } from 'siwe';
import { BrowserProvider } from 'ethers';

export interface SiweAuthState {
  isAuthenticated: boolean;
  address: string | null;
  session: string | null;
  nonce: string | null;
}

export interface SiweNonceResponse {
  nonce: string;
}

export interface SiweVerifyResponse {
  success: boolean;
  address: string;
  session: string;
  error?: string;
}

export class SiweService {
  private static instance: SiweService;
  private baseUrl: string;

  private constructor() {
    // Use environment variable or default to localhost for development
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  public static getInstance(): SiweService {
    if (!SiweService.instance) {
      SiweService.instance = new SiweService();
    }
    return SiweService.instance;
  }

  /**
   * Generate a nonce for SIWE authentication
   */
  async generateNonce(address: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/siwe/nonce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
        credentials: 'include', // Include cookies for session management
      });

      if (!response.ok) {
        throw new Error(`Failed to generate nonce: ${response.statusText}`);
      }

      const data: SiweNonceResponse = await response.json();
      return data.nonce;
    } catch (error) {
      console.error('Error generating nonce:', error);
      throw new Error('Failed to generate authentication nonce');
    }
  }

  /**
   * Create and sign SIWE message
   */
  async createAndSignMessage(
    provider: BrowserProvider,
    address: string,
    nonce: string
  ): Promise<{ message: string; signature: string }> {
    try {
      const signer = await provider.getSigner();
      const chainId = (await provider.getNetwork()).chainId;

      // Create SIWE message
      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address: address,
        statement: 'Sign in to Reelverse with your Ethereum account.',
        uri: window.location.origin,
        version: '1',
        chainId: Number(chainId),
        nonce: nonce,
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      });

      const message = siweMessage.prepareMessage();
      const signature = await signer.signMessage(message);

      return { message, signature };
    } catch (error) {
      console.error('Error creating/signing SIWE message:', error);
      throw new Error('Failed to sign authentication message');
    }
  }

  /**
   * Verify SIWE signature with backend
   */
  async verifySignature(message: string, signature: string): Promise<SiweVerifyResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/siwe/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, signature }),
        credentials: 'include', // Include cookies for session management
      });

      if (!response.ok) {
        throw new Error(`Verification failed: ${response.statusText}`);
      }

      const data: SiweVerifyResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error verifying signature:', error);
      throw new Error('Failed to verify authentication signature');
    }
  }

  /**
   * Complete SIWE authentication flow
   */
  async authenticate(provider: BrowserProvider, address: string): Promise<SiweVerifyResponse> {
    try {
      // Step 1: Generate nonce
      const nonce = await this.generateNonce(address);

      // Step 2: Create and sign message
      const { message, signature } = await this.createAndSignMessage(provider, address, nonce);

      // Step 3: Verify signature
      const result = await this.verifySignature(message, signature);

      return result;
    } catch (error) {
      console.error('SIWE authentication failed:', error);
      throw error;
    }
  }

  /**
   * Check current session status
   */
  async getSession(): Promise<{ isAuthenticated: boolean; address?: string; session?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/session`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return { isAuthenticated: false };
      }

      const data = await response.json();
      return {
        isAuthenticated: true,
        address: data.address,
        session: data.session,
      };
    } catch (error) {
      console.error('Error checking session:', error);
      return { isAuthenticated: false };
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error during logout:', error);
      // Don't throw error for logout - we want to clear local state regardless
    }
  }
}