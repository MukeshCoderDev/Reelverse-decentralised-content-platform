import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ethers } from 'ethers';
import { ConsentService, ConsentData, SceneParticipant } from '../services/consentService';

describe('ConsentService', () => {
  let consentService: ConsentService;
  let testWallet: ethers.Wallet;
  let testWallet2: ethers.Wallet;
  let testSceneHash: string;
  let testConsentData: ConsentData;

  beforeEach(() => {
    consentService = new ConsentService();
    testWallet = ethers.Wallet.createRandom();
    testWallet2 = ethers.Wallet.createRandom();
    
    // Generate test scene hash
    testSceneHash = consentService.generateSceneHash({
      title: 'Test Scene',
      description: 'Test scene for consent management',
      participants: [
        { wallet: testWallet.address, role: 'performer' },
        { wallet: testWallet2.address, role: 'director' }
      ],
      createdAt: Date.now()
    });

    testConsentData = {
      sceneHash: testSceneHash,
      participant: testWallet.address,
      role: 'performer',
      consentDate: Math.floor(Date.now() / 1000),
      termsVersion: '1.0',
      documentHashes: ['0x1234567890abcdef']
    };
  });

  describe('generateSceneHash', () => {
    it('should generate consistent hash for same content', () => {
      const contentMetadata = {
        title: 'Test Scene',
        description: 'Test description',
        participants: [
          { wallet: testWallet.address, role: 'performer' },
          { wallet: testWallet2.address, role: 'director' }
        ],
        createdAt: 1234567890
      };

      const hash1 = consentService.generateSceneHash(contentMetadata);
      const hash2 = consentService.generateSceneHash(contentMetadata);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should generate different hashes for different content', () => {
      const content1 = {
        title: 'Scene 1',
        description: 'First scene',
        participants: [{ wallet: testWallet.address, role: 'performer' }],
        createdAt: 1234567890
      };

      const content2 = {
        title: 'Scene 2',
        description: 'Second scene',
        participants: [{ wallet: testWallet.address, role: 'performer' }],
        createdAt: 1234567890
      };

      const hash1 = consentService.generateSceneHash(content1);
      const hash2 = consentService.generateSceneHash(content2);

      expect(hash1).not.toBe(hash2);
    });

    it('should sort participants consistently', () => {
      const content1 = {
        title: 'Test Scene',
        description: 'Test',
        participants: [
          { wallet: testWallet.address, role: 'performer' },
          { wallet: testWallet2.address, role: 'director' }
        ],
        createdAt: 1234567890
      };

      const content2 = {
        title: 'Test Scene',
        description: 'Test',
        participants: [
          { wallet: testWallet2.address, role: 'director' },
          { wallet: testWallet.address, role: 'performer' }
        ],
        createdAt: 1234567890
      };

      const hash1 = consentService.generateSceneHash(content1);
      const hash2 = consentService.generateSceneHash(content2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('createConsentMessage', () => {
    it('should create valid EIP-712 message structure', () => {
      const message = consentService.createConsentMessage(testConsentData);

      expect(message).toHaveProperty('domain');
      expect(message).toHaveProperty('types');
      expect(message).toHaveProperty('primaryType', 'SceneConsent');
      expect(message).toHaveProperty('message');

      expect(message.domain).toHaveProperty('name', 'Reelverse18 Consent');
      expect(message.domain).toHaveProperty('version', '1');
      expect(message.domain).toHaveProperty('chainId', 137);

      expect(message.types).toHaveProperty('SceneConsent');
      expect(message.message).toEqual(testConsentData);
    });
  });

  describe('verifyConsentSignature', () => {
    it('should verify valid signature', async () => {
      const message = consentService.createConsentMessage(testConsentData);
      const signature = await testWallet.signTypedData(
        message.domain,
        message.types,
        message.message
      );

      const result = await consentService.verifyConsentSignature(testConsentData, signature);

      expect(result.valid).toBe(true);
      expect(result.signer?.toLowerCase()).toBe(testWallet.address.toLowerCase());
    });

    it('should reject invalid signature', async () => {
      const invalidSignature = '0x1234567890abcdef';

      const result = await consentService.verifyConsentSignature(testConsentData, invalidSignature);

      expect(result.valid).toBe(false);
      expect(result.signer).toBeUndefined();
    });

    it('should reject signature from wrong participant', async () => {
      const message = consentService.createConsentMessage(testConsentData);
      const signature = await testWallet2.signTypedData(
        message.domain,
        message.types,
        message.message
      );

      const result = await consentService.verifyConsentSignature(testConsentData, signature);

      expect(result.valid).toBe(false);
    });
  });

  describe('encryptConsentData and decryptConsentData', () => {
    it('should encrypt and decrypt consent data correctly', () => {
      const encrypted = consentService.encryptConsentData(testConsentData);
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');

      const decrypted = consentService.decryptConsentData(encrypted);
      expect(decrypted).toEqual(testConsentData);
    });

    it('should produce different encrypted output for same data', () => {
      const encrypted1 = consentService.encryptConsentData(testConsentData);
      const encrypted2 = consentService.encryptConsentData(testConsentData);

      // Due to random IV, encrypted data should be different
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to same data
      const decrypted1 = consentService.decryptConsentData(encrypted1);
      const decrypted2 = consentService.decryptConsentData(encrypted2);
      expect(decrypted1).toEqual(decrypted2);
      expect(decrypted1).toEqual(testConsentData);
    });
  });

  describe('validateSceneConsent', () => {
    it('should identify missing consents', async () => {
      const participants: SceneParticipant[] = [
        { wallet: testWallet.address, role: 'performer', consented: false },
        { wallet: testWallet2.address, role: 'director', consented: false }
      ];

      const result = await consentService.validateSceneConsent(testSceneHash, participants);

      expect(result.complete).toBe(false);
      expect(result.missing).toContain(testWallet.address);
      expect(result.missing).toContain(testWallet2.address);
      expect(result.consents).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid consent data gracefully', async () => {
      const invalidConsentData = {
        ...testConsentData,
        participant: 'invalid-address'
      };

      await expect(
        consentService.verifyConsentSignature(invalidConsentData, '0x123')
      ).resolves.toEqual({ valid: false });
    });

    it('should handle encryption errors gracefully', () => {
      const invalidData = { invalid: 'data' } as any;
      
      expect(() => {
        consentService.encryptConsentData(invalidData);
      }).not.toThrow();
    });
  });

  describe('consent workflow integration', () => {
    it('should handle complete consent workflow', async () => {
      // 1. Generate scene hash
      const sceneHash = consentService.generateSceneHash({
        title: 'Integration Test Scene',
        description: 'Full workflow test',
        participants: [
          { wallet: testWallet.address, role: 'performer' }
        ],
        createdAt: Date.now()
      });

      // 2. Create consent message
      const consentData: ConsentData = {
        sceneHash,
        participant: testWallet.address,
        role: 'performer',
        consentDate: Math.floor(Date.now() / 1000),
        termsVersion: '1.0',
        documentHashes: []
      };

      const message = consentService.createConsentMessage(consentData);

      // 3. Sign consent
      const signature = await testWallet.signTypedData(
        message.domain,
        message.types,
        message.message
      );

      // 4. Verify signature
      const verification = await consentService.verifyConsentSignature(consentData, signature);
      expect(verification.valid).toBe(true);

      // 5. Encrypt data
      const encrypted = consentService.encryptConsentData(consentData);
      expect(encrypted).toBeTruthy();

      // 6. Decrypt and verify
      const decrypted = consentService.decryptConsentData(encrypted);
      expect(decrypted).toEqual(consentData);
    });
  });

  describe('edge cases', () => {
    it('should handle empty participant list', () => {
      const sceneHash = consentService.generateSceneHash({
        title: 'Empty Scene',
        description: 'No participants',
        participants: [],
        createdAt: Date.now()
      });

      expect(sceneHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should handle very long content descriptions', () => {
      const longDescription = 'A'.repeat(10000);
      const sceneHash = consentService.generateSceneHash({
        title: 'Long Description Scene',
        description: longDescription,
        participants: [{ wallet: testWallet.address, role: 'performer' }],
        createdAt: Date.now()
      });

      expect(sceneHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should handle special characters in content', () => {
      const specialContent = {
        title: 'Special Characters: 🎬🔞💰',
        description: 'Content with émojis and spëcial chars',
        participants: [{ wallet: testWallet.address, role: 'performer' }],
        createdAt: Date.now()
      };

      const sceneHash = consentService.generateSceneHash(specialContent);
      expect(sceneHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });
});