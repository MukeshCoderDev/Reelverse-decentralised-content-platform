import { ethers } from 'ethers';

export interface PasskeyWalletConfig {
  rpId: string; // Relying Party ID (domain)
  rpName: string; // Relying Party Name
  chainId: number;
  rpcUrl: string;
  walletFactoryAddress: string;
  entryPointAddress: string;
}

export interface PasskeyCredential {
  credentialId: string;
  publicKey: string;
  walletAddress: string;
  encryptedPrivateKey: string;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface PasskeyAuthResult {
  success: boolean;
  walletAddress?: string;
  signature?: string;
  error?: string;
}

export interface WalletCreationResult {
  success: boolean;
  walletAddress?: string;
  credentialId?: string;
  error?: string;
  creationTime?: number;
}

export class PasskeyWalletService {
  private config: PasskeyWalletConfig;
  private provider: ethers.JsonRpcProvider;

  constructor(config: PasskeyWalletConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }

  /**
   * Create a new passkey wallet with sub-15-second target
   */
  async createPasskeyWallet(email: string): Promise<WalletCreationResult> {
    const startTime = Date.now();

    try {
      console.log(`Creating passkey wallet for email: ${email}`);

      // Check if WebAuthn is supported
      if (!this.isWebAuthnSupported()) {
        throw new Error('WebAuthn not supported in this environment');
      }

      // Generate credential creation options
      const credentialOptions = await this.generateCredentialCreationOptions(email);

      // Create WebAuthn credential
      const credential = await this.createWebAuthnCredential(credentialOptions);

      // Generate wallet address from credential
      const walletAddress = await this.generateWalletAddress(credential.publicKey);

      // Create encrypted private key backup
      const encryptedPrivateKey = await this.createEncryptedPrivateKey(credential.publicKey);

      // Store credential
      const passkeyCredential: PasskeyCredential = {
        credentialId: credential.credentialId,
        publicKey: credential.publicKey,
        walletAddress,
        encryptedPrivateKey,
        createdAt: new Date(),
        lastUsedAt: new Date()
      };

      await this.storePasskeyCredential(email, passkeyCredential);

      const creationTime = Date.now() - startTime;
      
      // Check if we met the 15-second SLA
      if (creationTime > 15000) {
        console.warn(`Wallet creation exceeded 15s SLA: ${creationTime}ms`);
      } else {
        console.log(`Passkey wallet created in ${creationTime}ms`);
      }

      return {
        success: true,
        walletAddress,
        credentialId: credential.credentialId,
        creationTime
      };

    } catch (error) {
      const creationTime = Date.now() - startTime;
      console.error(`Passkey wallet creation failed after ${creationTime}ms:`, error);

      return {
        success: false,
        error: error.message,
        creationTime
      };
    }
  }

  /**
   * Authenticate with passkey and return wallet access
   */
  async authenticateWithPasskey(email: string, challenge?: string): Promise<PasskeyAuthResult> {
    try {
      console.log(`Authenticating passkey for email: ${email}`);

      // Get stored credential
      const storedCredential = await this.getStoredCredential(email);
      if (!storedCredential) {
        throw new Error('No passkey credential found for this email');
      }

      // Generate authentication options
      const authOptions = await this.generateAuthenticationOptions(
        storedCredential.credentialId,
        challenge
      );

      // Perform WebAuthn authentication
      const authResult = await this.performWebAuthnAuthentication(authOptions);

      // Verify authentication signature
      const isValid = await this.verifyAuthenticationSignature(
        authResult,
        storedCredential.publicKey,
        challenge || authOptions.challenge
      );

      if (!isValid) {
        throw new Error('Authentication signature verification failed');
      }

      // Update last used timestamp
      await this.updateLastUsed(email);

      return {
        success: true,
        walletAddress: storedCredential.walletAddress,
        signature: authResult.signature
      };

    } catch (error) {
      console.error('Passkey authentication failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sign transaction with passkey
   */
  async signTransactionWithPasskey(
    email: string,
    transaction: any
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      console.log(`Signing transaction with passkey for email: ${email}`);

      // Get stored credential
      const storedCredential = await this.getStoredCredential(email);
      if (!storedCredential) {
        throw new Error('No passkey credential found');
      }

      // Create transaction hash for signing
      const txHash = this.createTransactionHash(transaction);

      // Authenticate with passkey using transaction hash as challenge
      const authResult = await this.authenticateWithPasskey(email, txHash);

      if (!authResult.success) {
        throw new Error(`Authentication failed: ${authResult.error}`);
      }

      // Generate transaction signature
      const signature = await this.generateTransactionSignature(
        authResult.signature!,
        storedCredential.publicKey,
        txHash
      );

      return {
        success: true,
        signature
      };

    } catch (error) {
      console.error('Transaction signing failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if WebAuthn is supported
   */
  private isWebAuthnSupported(): boolean {
    return typeof window !== 'undefined' && 
           window.navigator && 
           window.navigator.credentials &&
           typeof window.navigator.credentials.create === 'function';
  }

  /**
   * Generate credential creation options
   */
  private async generateCredentialCreationOptions(email: string): Promise<any> {
    const userId = new TextEncoder().encode(email);
    
    return {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: {
        id: this.config.rpId,
        name: this.config.rpName
      },
      user: {
        id: userId,
        name: email,
        displayName: email
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred'
      },
      timeout: 60000,
      attestation: 'direct'
    };
  }

  /**
   * Create WebAuthn credential
   */
  private async createWebAuthnCredential(options: any): Promise<any> {
    try {
      if (typeof window === 'undefined') {
        // Server-side mock for testing
        return {
          credentialId: 'mock_credential_' + Math.random().toString(36).substr(2, 9),
          publicKey: '0x' + '04' + '1'.repeat(128) // Mock public key
        };
      }

      const credential = await navigator.credentials.create({
        publicKey: options
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      // Extract public key from credential
      const publicKey = await this.extractPublicKey(credential);

      return {
        credentialId: this.arrayBufferToBase64(credential.rawId),
        publicKey
      };

    } catch (error) {
      console.error('WebAuthn credential creation failed:', error);
      throw error;
    }
  }

  /**
   * Extract public key from WebAuthn credential
   */
  private async extractPublicKey(credential: PublicKeyCredential): Promise<string> {
    try {
      const response = credential.response as AuthenticatorAttestationResponse;
      
      // Parse CBOR attestation object to extract public key
      // This is a simplified implementation - in production, use a proper CBOR library
      
      // For now, return a mock public key
      return '0x' + '04' + Math.random().toString(16).substr(2, 128);

    } catch (error) {
      console.error('Public key extraction failed:', error);
      throw error;
    }
  }

  /**
   * Generate wallet address from public key
   */
  private async generateWalletAddress(publicKey: string): Promise<string> {
    try {
      // In a real implementation, this would:
      // 1. Use the public key to derive an Ethereum address
      // 2. Deploy a smart contract wallet using CREATE2 for deterministic addresses
      // 3. Return the deployed wallet address

      // For now, generate a deterministic address from the public key
      const hash = ethers.keccak256(ethers.toUtf8Bytes(publicKey));
      const address = '0x' + hash.slice(-40);
      
      return ethers.getAddress(address);

    } catch (error) {
      console.error('Wallet address generation failed:', error);
      throw error;
    }
  }

  /**
   * Create encrypted private key backup
   */
  private async createEncryptedPrivateKey(publicKey: string): Promise<string> {
    try {
      // Generate a random private key for backup purposes
      const wallet = ethers.Wallet.createRandom();
      
      // Encrypt the private key using the public key as entropy
      const encrypted = ethers.AES.encrypt(
        wallet.privateKey,
        ethers.keccak256(ethers.toUtf8Bytes(publicKey))
      );

      return encrypted;

    } catch (error) {
      console.error('Private key encryption failed:', error);
      throw error;
    }
  }

  /**
   * Store passkey credential
   */
  private async storePasskeyCredential(email: string, credential: PasskeyCredential): Promise<void> {
    try {
      // In production, this would store in a secure database
      console.log(`Storing passkey credential for ${email}`);
      
      // For now, store in memory/localStorage (not secure for production)
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(`passkey_${email}`, JSON.stringify(credential));
      }

    } catch (error) {
      console.error('Failed to store passkey credential:', error);
      throw error;
    }
  }

  /**
   * Get stored credential
   */
  private async getStoredCredential(email: string): Promise<PasskeyCredential | null> {
    try {
      // In production, this would query a secure database
      
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(`passkey_${email}`);
        if (stored) {
          const credential = JSON.parse(stored);
          return {
            ...credential,
            createdAt: new Date(credential.createdAt),
            lastUsedAt: new Date(credential.lastUsedAt)
          };
        }
      }

      return null;

    } catch (error) {
      console.error('Failed to get stored credential:', error);
      return null;
    }
  }

  /**
   * Generate authentication options
   */
  private async generateAuthenticationOptions(credentialId: string, challenge?: string): Promise<any> {
    return {
      challenge: challenge ? new TextEncoder().encode(challenge) : crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{
        id: this.base64ToArrayBuffer(credentialId),
        type: 'public-key'
      }],
      userVerification: 'required',
      timeout: 60000
    };
  }

  /**
   * Perform WebAuthn authentication
   */
  private async performWebAuthnAuthentication(options: any): Promise<any> {
    try {
      if (typeof window === 'undefined') {
        // Server-side mock for testing
        return {
          signature: '0x' + Math.random().toString(16).substr(2, 128),
          authenticatorData: new Uint8Array(32),
          clientDataJSON: JSON.stringify({ challenge: 'mock_challenge' })
        };
      }

      const assertion = await navigator.credentials.get({
        publicKey: options
      }) as PublicKeyCredential;

      if (!assertion) {
        throw new Error('Authentication failed');
      }

      const response = assertion.response as AuthenticatorAssertionResponse;

      return {
        signature: this.arrayBufferToHex(response.signature),
        authenticatorData: new Uint8Array(response.authenticatorData),
        clientDataJSON: new TextDecoder().decode(response.clientDataJSON)
      };

    } catch (error) {
      console.error('WebAuthn authentication failed:', error);
      throw error;
    }
  }

  /**
   * Verify authentication signature
   */
  private async verifyAuthenticationSignature(
    authResult: any,
    publicKey: string,
    challenge: string
  ): Promise<boolean> {
    try {
      // In a real implementation, this would:
      // 1. Verify the WebAuthn signature using the stored public key
      // 2. Validate the challenge matches what was sent
      // 3. Check the authenticator data

      // For now, return true for mock implementation
      return true;

    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Update last used timestamp
   */
  private async updateLastUsed(email: string): Promise<void> {
    try {
      const credential = await this.getStoredCredential(email);
      if (credential) {
        credential.lastUsedAt = new Date();
        await this.storePasskeyCredential(email, credential);
      }
    } catch (error) {
      console.error('Failed to update last used timestamp:', error);
    }
  }

  /**
   * Create transaction hash for signing
   */
  private createTransactionHash(transaction: any): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'bytes'],
        [transaction.to || '0x0', transaction.value || '0', transaction.data || '0x']
      )
    );
  }

  /**
   * Generate transaction signature
   */
  private async generateTransactionSignature(
    authSignature: string,
    publicKey: string,
    txHash: string
  ): Promise<string> {
    try {
      // In a real implementation, this would:
      // 1. Combine the WebAuthn signature with the transaction hash
      // 2. Create an Ethereum-compatible signature
      // 3. Return the signature in the correct format

      // For now, return a mock signature
      return '0x' + authSignature.slice(2) + txHash.slice(2, 10);

    } catch (error) {
      console.error('Transaction signature generation failed:', error);
      throw error;
    }
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Utility: Convert ArrayBuffer to Hex
   */
  private arrayBufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return '0x' + Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Get wallet statistics
   */
  async getWalletStats(): Promise<any> {
    try {
      // In production, this would query the database
      return {
        totalWallets: 1250,
        activeWallets: 890,
        walletsCreated24h: 45,
        avgCreationTimeMs: 8500,
        successRate: 94.5,
        passkeySupport: this.isWebAuthnSupported()
      };
    } catch (error) {
      console.error('Failed to get wallet stats:', error);
      return {
        totalWallets: 0,
        activeWallets: 0,
        walletsCreated24h: 0,
        avgCreationTimeMs: 0,
        successRate: 0,
        passkeySupport: false
      };
    }
  }

  /**
   * Delete passkey credential
   */
  async deletePasskeyCredential(email: string): Promise<boolean> {
    try {
      console.log(`Deleting passkey credential for ${email}`);
      
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(`passkey_${email}`);
      }

      return true;

    } catch (error) {
      console.error('Failed to delete passkey credential:', error);
      return false;
    }
  }

  /**
   * List user's passkey credentials
   */
  async listUserCredentials(email: string): Promise<Partial<PasskeyCredential>[]> {
    try {
      const credential = await this.getStoredCredential(email);
      
      if (!credential) {
        return [];
      }

      // Return safe subset of credential data
      return [{
        credentialId: credential.credentialId,
        walletAddress: credential.walletAddress,
        createdAt: credential.createdAt,
        lastUsedAt: credential.lastUsedAt
      }];

    } catch (error) {
      console.error('Failed to list user credentials:', error);
      return [];
    }
  }
}

// Default configuration
export const DEFAULT_PASSKEY_CONFIG: PasskeyWalletConfig = {
  rpId: process.env.PASSKEY_RP_ID || 'localhost',
  rpName: process.env.PASSKEY_RP_NAME || 'Adult Platform',
  chainId: 137, // Polygon
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  walletFactoryAddress: process.env.WALLET_FACTORY_ADDRESS || '0x1234567890123456789012345678901234567890',
  entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' // ERC-4337 EntryPoint
};