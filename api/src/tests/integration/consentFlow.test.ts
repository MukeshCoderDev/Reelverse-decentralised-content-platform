import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { ethers } from 'ethers';
import app from '../../index';
import { connectDatabase, getDatabase } from '../../config/database';
import { connectRedis } from '../../config/redis';

describe('Consent Management Integration Tests', () => {
  let testWallet: ethers.Wallet;
  let testWallet2: ethers.Wallet;
  let authToken: string;
  let authToken2: string;
  let sceneHash: string;

  beforeAll(async () => {
    // Connect to test database
    await connectDatabase();
    await connectRedis();
    
    // Create test wallets
    testWallet = ethers.Wallet.createRandom();
    testWallet2 = ethers.Wallet.createRandom();
  });

  afterAll(async () => {
    // Clean up test data
    const db = getDatabase();
    await db.query('DELETE FROM consent_signatures WHERE scene_hash LIKE $1', ['%test%']);
    await db.query('DELETE FROM scene_participants WHERE scene_hash LIKE $1', ['%test%']);
    await db.query('DELETE FROM scenes WHERE scene_hash LIKE $1', ['%test%']);
    await db.query('DELETE FROM consent_audit_log WHERE scene_hash LIKE $1', ['%test%']);
  });

  beforeEach(async () => {
    // Mock authentication for testing
    authToken = 'mock-jwt-token-' + testWallet.address;
    authToken2 = 'mock-jwt-token-' + testWallet2.address;
  });

  describe('Scene Creation Flow', () => {
    it('should create a new scene with participants', async () => {
      const sceneData = {
        title: 'Test Scene Integration',
        description: 'Integration test scene for consent management',
        participants: [
          { wallet: testWallet.address, role: 'performer' },
          { wallet: testWallet2.address, role: 'director' }
        ],
        createdAt: Date.now()
      };

      const response = await request(app)
        .post('/api/v1/consent/scene')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sceneData)
        .expect(200);

      expect(response.body).toHaveProperty('sceneHash');
      expect(response.body).toHaveProperty('participants');
      expect(response.body.participants).toHaveLength(2);
      expect(response.body.participants[0]).toHaveProperty('consented', false);

      sceneHash = response.body.sceneHash;
    });

    it('should reject scene creation without authentication', async () => {
      const sceneData = {
        title: 'Unauthorized Scene',
        description: 'Should fail',
        participants: [{ wallet: testWallet.address, role: 'performer' }]
      };

      await request(app)
        .post('/api/v1/consent/scene')
        .send(sceneData)
        .expect(401);
    });

    it('should reject scene creation with invalid data', async () => {
      const invalidData = {
        title: 'Missing participants'
        // Missing description and participants
      };

      await request(app)
        .post('/api/v1/consent/scene')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('Consent Message Generation', () => {
    beforeEach(async () => {
      // Create a scene first
      const sceneData = {
        title: 'Message Test Scene',
        description: 'Scene for message testing',
        participants: [
          { wallet: testWallet.address, role: 'performer' }
        ]
      };

      const response = await request(app)
        .post('/api/v1/consent/scene')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sceneData);

      sceneHash = response.body.sceneHash;
    });

    it('should generate EIP-712 consent message', async () => {
      const messageRequest = {
        sceneHash,
        role: 'performer',
        documentHashes: ['0x1234567890abcdef']
      };

      const response = await request(app)
        .post('/api/v1/consent/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageRequest)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('consentData');
      expect(response.body.message).toHaveProperty('domain');
      expect(response.body.message).toHaveProperty('types');
      expect(response.body.message).toHaveProperty('primaryType', 'SceneConsent');
      expect(response.body.message.domain.name).toBe('Reelverse18 Consent');
    });

    it('should reject message generation without required fields', async () => {
      const invalidRequest = {
        sceneHash
        // Missing role
      };

      await request(app)
        .post('/api/v1/consent/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(400);
    });
  });

  describe('Consent Submission Flow', () => {
    let consentMessage: any;
    let consentData: any;

    beforeEach(async () => {
      // Create scene and get consent message
      const sceneData = {
        title: 'Submission Test Scene',
        description: 'Scene for submission testing',
        participants: [
          { wallet: testWallet.address, role: 'performer' }
        ]
      };

      const sceneResponse = await request(app)
        .post('/api/v1/consent/scene')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sceneData);

      sceneHash = sceneResponse.body.sceneHash;

      const messageResponse = await request(app)
        .post('/api/v1/consent/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sceneHash,
          role: 'performer',
          documentHashes: []
        });

      consentMessage = messageResponse.body.message;
      consentData = messageResponse.body.consentData;
    });

    it('should accept valid signed consent', async () => {
      // Sign the consent message
      const signature = await testWallet.signTypedData(
        consentMessage.domain,
        consentMessage.types,
        consentMessage.message
      );

      const response = await request(app)
        .post('/api/v1/consent/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentData,
          signature
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('consentId');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should reject invalid signature', async () => {
      const invalidSignature = '0x1234567890abcdef';

      await request(app)
        .post('/api/v1/consent/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentData,
          signature: invalidSignature
        })
        .expect(400);
    });

    it('should reject consent from wrong wallet', async () => {
      // Sign with different wallet
      const wrongSignature = await testWallet2.signTypedData(
        consentMessage.domain,
        consentMessage.types,
        consentMessage.message
      );

      await request(app)
        .post('/api/v1/consent/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentData,
          signature: wrongSignature
        })
        .expect(400);
    });

    it('should reject consent submission with mismatched participant', async () => {
      const signature = await testWallet.signTypedData(
        consentMessage.domain,
        consentMessage.types,
        consentMessage.message
      );

      // Try to submit with different authenticated wallet
      await request(app)
        .post('/api/v1/consent/submit')
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          consentData,
          signature
        })
        .expect(403);
    });
  });

  describe('Consent Status Checking', () => {
    beforeEach(async () => {
      // Create scene with multiple participants
      const sceneData = {
        title: 'Status Test Scene',
        description: 'Scene for status testing',
        participants: [
          { wallet: testWallet.address, role: 'performer' },
          { wallet: testWallet2.address, role: 'director' }
        ]
      };

      const response = await request(app)
        .post('/api/v1/consent/scene')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sceneData);

      sceneHash = response.body.sceneHash;
    });

    it('should check consent status for scene', async () => {
      const participants = [
        { wallet: testWallet.address, role: 'performer', consented: false },
        { wallet: testWallet2.address, role: 'director', consented: false }
      ];

      const response = await request(app)
        .get(`/api/v1/consent/status/${sceneHash}`)
        .query({ participants: JSON.stringify(participants) })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('sceneHash', sceneHash);
      expect(response.body).toHaveProperty('complete', false);
      expect(response.body).toHaveProperty('totalRequired', 2);
      expect(response.body).toHaveProperty('totalConsented', 0);
      expect(response.body).toHaveProperty('missing');
      expect(response.body.missing).toContain(testWallet.address);
      expect(response.body.missing).toContain(testWallet2.address);
    });

    it('should require participants parameter', async () => {
      await request(app)
        .get(`/api/v1/consent/status/${sceneHash}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Consent Reporting', () => {
    beforeEach(async () => {
      // Create scene and submit one consent
      const sceneData = {
        title: 'Report Test Scene',
        description: 'Scene for report testing',
        participants: [
          { wallet: testWallet.address, role: 'performer' }
        ]
      };

      const sceneResponse = await request(app)
        .post('/api/v1/consent/scene')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sceneData);

      sceneHash = sceneResponse.body.sceneHash;

      // Submit consent
      const messageResponse = await request(app)
        .post('/api/v1/consent/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sceneHash,
          role: 'performer'
        });

      const signature = await testWallet.signTypedData(
        messageResponse.body.message.domain,
        messageResponse.body.message.types,
        messageResponse.body.message.message
      );

      await request(app)
        .post('/api/v1/consent/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentData: messageResponse.body.consentData,
          signature
        });
    });

    it('should generate consent report', async () => {
      const response = await request(app)
        .get(`/api/v1/consent/report/${sceneHash}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('sceneHash', sceneHash);
      expect(response.body).toHaveProperty('totalParticipants');
      expect(response.body).toHaveProperty('consentedParticipants');
      expect(response.body).toHaveProperty('completionRate');
      expect(response.body).toHaveProperty('consents');
      expect(Array.isArray(response.body.consents)).toBe(true);
    });
  });

  describe('Consent Revocation', () => {
    beforeEach(async () => {
      // Create scene and submit consent
      const sceneData = {
        title: 'Revocation Test Scene',
        description: 'Scene for revocation testing',
        participants: [
          { wallet: testWallet.address, role: 'performer' }
        ]
      };

      const sceneResponse = await request(app)
        .post('/api/v1/consent/scene')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sceneData);

      sceneHash = sceneResponse.body.sceneHash;

      // Submit consent first
      const messageResponse = await request(app)
        .post('/api/v1/consent/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sceneHash,
          role: 'performer'
        });

      const signature = await testWallet.signTypedData(
        messageResponse.body.message.domain,
        messageResponse.body.message.types,
        messageResponse.body.message.message
      );

      await request(app)
        .post('/api/v1/consent/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentData: messageResponse.body.consentData,
          signature
        });
    });

    it('should revoke consent successfully', async () => {
      const response = await request(app)
        .post('/api/v1/consent/revoke')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sceneHash,
          reason: 'Changed my mind'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('sceneHash', sceneHash);
      expect(response.body).toHaveProperty('participant', testWallet.address);
    });

    it('should require sceneHash for revocation', async () => {
      await request(app)
        .post('/api/v1/consent/revoke')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'No scene hash provided'
        })
        .expect(400);
    });
  });

  describe('Complete Consent Workflow', () => {
    it('should handle full multi-participant consent workflow', async () => {
      // 1. Create scene with multiple participants
      const sceneData = {
        title: 'Full Workflow Test Scene',
        description: 'Complete workflow integration test',
        participants: [
          { wallet: testWallet.address, role: 'performer' },
          { wallet: testWallet2.address, role: 'director' }
        ]
      };

      const sceneResponse = await request(app)
        .post('/api/v1/consent/scene')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sceneData);

      sceneHash = sceneResponse.body.sceneHash;
      expect(sceneResponse.body.participants).toHaveLength(2);

      // 2. Check initial status (no consents)
      const participants = [
        { wallet: testWallet.address, role: 'performer', consented: false },
        { wallet: testWallet2.address, role: 'director', consented: false }
      ];

      const initialStatus = await request(app)
        .get(`/api/v1/consent/status/${sceneHash}`)
        .query({ participants: JSON.stringify(participants) })
        .set('Authorization', `Bearer ${authToken}`);

      expect(initialStatus.body.complete).toBe(false);
      expect(initialStatus.body.totalConsented).toBe(0);

      // 3. First participant provides consent
      const message1Response = await request(app)
        .post('/api/v1/consent/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sceneHash,
          role: 'performer'
        });

      const signature1 = await testWallet.signTypedData(
        message1Response.body.message.domain,
        message1Response.body.message.types,
        message1Response.body.message.message
      );

      await request(app)
        .post('/api/v1/consent/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentData: message1Response.body.consentData,
          signature: signature1
        })
        .expect(200);

      // 4. Check partial consent status
      const partialStatus = await request(app)
        .get(`/api/v1/consent/status/${sceneHash}`)
        .query({ participants: JSON.stringify(participants) })
        .set('Authorization', `Bearer ${authToken}`);

      expect(partialStatus.body.complete).toBe(false);
      expect(partialStatus.body.totalConsented).toBe(1);
      expect(partialStatus.body.missing).toContain(testWallet2.address);

      // 5. Second participant provides consent
      const message2Response = await request(app)
        .post('/api/v1/consent/message')
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          sceneHash,
          role: 'director'
        });

      const signature2 = await testWallet2.signTypedData(
        message2Response.body.message.domain,
        message2Response.body.message.types,
        message2Response.body.message.message
      );

      await request(app)
        .post('/api/v1/consent/submit')
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          consentData: message2Response.body.consentData,
          signature: signature2
        })
        .expect(200);

      // 6. Check complete consent status
      const finalStatus = await request(app)
        .get(`/api/v1/consent/status/${sceneHash}`)
        .query({ participants: JSON.stringify(participants) })
        .set('Authorization', `Bearer ${authToken}`);

      expect(finalStatus.body.complete).toBe(true);
      expect(finalStatus.body.totalConsented).toBe(2);
      expect(finalStatus.body.missing).toHaveLength(0);

      // 7. Generate final report
      const report = await request(app)
        .get(`/api/v1/consent/report/${sceneHash}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(report.body.completionRate).toBe(1);
      expect(report.body.consents).toHaveLength(2);
      expect(report.body.consents.every((c: any) => c.verified)).toBe(true);

      // 8. Test revocation
      await request(app)
        .post('/api/v1/consent/revoke')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sceneHash,
          reason: 'Testing revocation'
        })
        .expect(200);

      // 9. Verify revocation affected status
      const revokedStatus = await request(app)
        .get(`/api/v1/consent/status/${sceneHash}`)
        .query({ participants: JSON.stringify(participants) })
        .set('Authorization', `Bearer ${authToken}`);

      expect(revokedStatus.body.complete).toBe(false);
      expect(revokedStatus.body.totalConsented).toBe(1);
    });
  });
});