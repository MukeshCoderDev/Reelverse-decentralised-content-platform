import { PasskeyWalletService, DEFAULT_PASSKEY_CONFIG } from '../../services/passkeyWalletService';

// Mock WebAuthn API
const mockCredential = {
  id: 'mock-credential-id',
  rawId: new ArrayBuffer(32),
  response: {
    attestationObject: new ArrayBuffer(64),
    clientDataJSON: new ArrayBuffer(32)
  },
  type: 'public-key'
};

const mockAssertion = {
  id: 'mock-credential-id',
  rawId: new ArrayBuffer(32),
  response: {
    authenticatorData: new ArrayBuffer(32),
    clientDataJSON: new ArrayBuffer(32),
    signature: new ArrayBuffer(64)
  },
  type: 'public-key'
};

// Mock navigator.credentials
Object.defineProperty(global, 'navigator', {
  value: {
    credentials: {
      create: jest.fn(),
      get: jest.fn()
    }
  },
  writable: true
});

// Mock crypto
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    })
  },
  writable: true
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
    keccak256: jest.fn(() => '0x' + '1'.repeat(64)),
    toUtf8Bytes: jest.fn((str) => new Uint8Array(Buffer.from(str, 'utf8'))),
    getAddress: jest.fn((addr) => addr),
    AbiCoder: {
      defaultAbiCoder: {
        encode: jest.fn(() => '0x' + '2'.repeat(128))
      }
    },
    AES: {
      encrypt: jest.fn(() => 'encrypted_private_key')
    },
    Wallet: {
      createRandom: jest.fn(() => ({
        privateKey: '0x' + '3'.repeat(64)
      }))
    }
  }
}));

describe('PasskeyWalletService', () => {
  let passkeyService: PasskeyWalletService;
  let mockNavigatorCredentials: any;

  beforeEach(() => {
    const config = {
      ...DEFAULT_PASSKEY_CONFIG,
      rpId: 'localhost',
      rpName: 'Test Platform'
    };

    passkeyService = new PasskeyWalletService(config);
    mockNavigatorCredentials = navigator.credentials as any;
    
    // Reset mocks
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('createPasskeyWallet', () => {
    it('should create a passkey wallet successfully', async () => {
      // Mock successful credential creation
      mockNavigatorCredentials.create.mockResolvedValue(mockCredential);

      const result = await passkeyService.createPasskeyWallet('test@example.com');

      expect(result.success).toBe(true);
      expect(result.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.credentialId).toBeDefined();
      expect(result.creationTime).toBeGreaterThan(0);
      expect(mockNavigatorCredentials.create).toHaveBeenCalled();
    });

    it('should handle WebAuthn creation failure', async () => {
      // Mock credential creation failure
      mockNavigatorCredentials.create.mockRejectedValue(new Error('User cancelled'));

      const result = await passkeyService.createPasskeyWallet('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('User cancelled');
      expect(result.walletAddress).toBeUndefined();
    });

    it('should track creation time and warn if exceeds SLA', async () => {
      // Mock slow credential creation
      mockNavigatorCredentials.create.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockCredential), 16000)) // 16 seconds
      );

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await passkeyService.createPasskeyWallet('test@example.com');

      expect(result.success).toBe(true);
      expect(result.creationTime).toBeGreaterThan(15000);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Wallet creation exceeded 15s SLA')
      );

      consoleSpy.mockRestore();
    });

    it('should store credential after successful creation', async () => {
      mockNavigatorCredentials.create.mockResolvedValue(mockCredential);

      await passkeyService.createPasskeyWallet('test@example.com');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'passkey_test@example.com',
        expect.stringContaining('"credentialId"')
      );
    });
  });

  describe('authenticateWithPasskey', () => {
    beforeEach(() => {
      // Mock stored credential
      const storedCredential = {
        credentialId: 'stored-credential-id',
        publicKey: '0x04' + '1'.repeat(128),
        walletAddress: '0x1234567890123456789012345678901234567890',
        encryptedPrivateKey: 'encrypted_key',
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString()
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedCredential));
    });

    it('should authenticate successfully with valid passkey', async () => {
      mockNavigatorCredentials.get.mockResolvedValue(mockAssertion);

      const result = await passkeyService.authenticateWithPasskey('test@example.com');

      expect(result.success).toBe(true);
      expect(result.walletAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(result.signature).toBeDefined();
      expect(mockNavigatorCredentials.get).toHaveBeenCalled();
    });

    it('should fail authentication if no stored credential', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = await passkeyService.authenticateWithPasskey('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No passkey credential found');
    });

    it('should handle WebAuthn authentication failure', async () => {
      mockNavigatorCredentials.get.mockRejectedValue(new Error('Authentication failed'));

      const result = await passkeyService.authenticateWithPasskey('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });

    it('should update last used timestamp after successful authentication', async () => {
      mockNavigatorCredentials.get.mockResolvedValue(mockAssertion);

      await passkeyService.authenticateWithPasskey('test@example.com');

      // Should call setItem to update the stored credential
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'passkey_test@example.com',
        expect.stringContaining('"lastUsedAt"')
      );
    });
  });

  describe('signTransactionWithPasskey', () => {
    const mockTransaction = {
      to: '0x9876543210987654321098765432109876543210',
      value: '1000000000000000000', // 1 ETH
      data: '0x'
    };

    beforeEach(() => {
      // Mock stored credential
      const storedCredential = {
        credentialId: 'stored-credential-id',
        publicKey: '0x04' + '1'.repeat(128),
        walletAddress: '0x1234567890123456789012345678901234567890',
        encryptedPrivateKey: 'encrypted_key',
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString()
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedCredential));
      mockNavigatorCredentials.get.mockResolvedValue(mockAssertion);
    });

    it('should sign transaction successfully', async () => {
      const result = await passkeyService.signTransactionWithPasskey('test@example.com', mockTransaction);

      expect(result.success).toBe(true);
      expect(result.signature).toBeDefined();
      expect(result.signature).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it('should fail if no stored credential', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = await passkeyService.signTransactionWithPasskey('test@example.com', mockTransaction);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No passkey credential found');
    });

    it('should fail if authentication fails', async () => {
      mockNavigatorCredentials.get.mockRejectedValue(new Error('User cancelled'));

      const result = await passkeyService.signTransactionWithPasskey('test@example.com', mockTransaction);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });
  });

  describe('listUserCredentials', () => {
    it('should return user credentials if they exist', async () => {
      const storedCredential = {
        credentialId: 'stored-credential-id',
        publicKey: '0x04' + '1'.repeat(128),
        walletAddress: '0x1234567890123456789012345678901234567890',
        encryptedPrivateKey: 'encrypted_key',
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString()
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedCredential));

      const credentials = await passkeyService.listUserCredentials('test@example.com');

      expect(credentials).toHaveLength(1);
      expect(credentials[0].credentialId).toBe('stored-credential-id');
      expect(credentials[0].walletAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(credentials[0].createdAt).toBeInstanceOf(Date);
      expect(credentials[0].lastUsedAt).toBeInstanceOf(Date);
    });

    it('should return empty array if no credentials exist', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const credentials = await passkeyService.listUserCredentials('test@example.com');

      expect(credentials).toHaveLength(0);
    });
  });

  describe('deletePasskeyCredential', () => {
    it('should delete credential successfully', async () => {
      const result = await passkeyService.deletePasskeyCredential('test@example.com');

      expect(result).toBe(true);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('passkey_test@example.com');
    });

    it('should handle deletion errors gracefully', async () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = await passkeyService.deletePasskeyCredential('test@example.com');

      expect(result).toBe(false);
    });
  });

  describe('getWalletStats', () => {
    it('should return wallet statistics', async () => {
      const stats = await passkeyService.getWalletStats();

      expect(stats).toBeDefined();
      expect(typeof stats.totalWallets).toBe('number');
      expect(typeof stats.activeWallets).toBe('number');
      expect(typeof stats.walletsCreated24h).toBe('number');
      expect(typeof stats.avgCreationTimeMs).toBe('number');
      expect(typeof stats.successRate).toBe('number');
      expect(typeof stats.passkeySupport).toBe('boolean');
    });
  });

  describe('utility methods', () => {
    it('should convert ArrayBuffer to Base64 correctly', async () => {
      // Test the private method indirectly through credential creation
      mockNavigatorCredentials.create.mockResolvedValue(mockCredential);

      const result = await passkeyService.createPasskeyWallet('test@example.com');

      expect(result.success).toBe(true);
      expect(result.credentialId).toBeDefined();
    });

    it('should handle invalid email formats', async () => {
      const result = await passkeyService.createPasskeyWallet('invalid-email');

      // The service doesn't validate email format, but the API should
      expect(result.success).toBe(true); // Service level doesn't validate
    });
  });
});