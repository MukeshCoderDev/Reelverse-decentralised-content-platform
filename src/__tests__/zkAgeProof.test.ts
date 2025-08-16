import { ZKAgeProofService } from '../../services/zkAgeProofService';

describe('ZKAgeProofService', () => {
  let service: ZKAgeProofService;

  beforeEach(() => {
    service = new ZKAgeProofService();
  });

  describe('createVerificationRequest', () => {
    it('should create verification request', async () => {
      const userId = 'user123';
      const proofType = 'email';
      const minAge = 18;

      const request = await service.createVerificationRequest(userId, proofType, minAge);

      expect(request.id).toBeDefined();
      expect(request.userId).toBe(userId);
      expect(request.proofType).toBe(proofType);
      expect(request.minAge).toBe(minAge);
      expect(request.status).toBe('pending');
      expect(request.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('generateEmailAgeProof', () => {
    it('should generate valid email age proof for adult', async () => {
      const userId = 'user123';
      const request = await service.createVerificationRequest(userId, 'email', 18);

      const emailInput = {
        emailDomain: 'gmail.com',
        emailHash: 'hashed_email_123',
        birthYear: 1990,
        currentYear: 2024,
        dkimSignature: 'valid_dkim_signature'
      };

      const proof = await service.generateEmailAgeProof(request.id, emailInput);

      expect(proof.id).toBeDefined();
      expect(proof.proofType).toBe('email');
      expect(proof.minAge).toBe(18);
      expect(proof.isValid).toBe(true); // 1990 birth year makes them 34 in 2024
      expect(proof.proofData).toBeDefined();
      expect(proof.publicSignals).toBeDefined();
      expect(proof.verificationKey).toBeDefined();
      expect(proof.expiresAt).toBeInstanceOf(Date);
    });

    it('should generate invalid proof for underage user', async () => {
      const userId = 'user123';
      const request = await service.createVerificationRequest(userId, 'email', 18);

      const emailInput = {
        emailDomain: 'gmail.com',
        emailHash: 'hashed_email_123',
        birthYear: 2010, // Only 14 years old
        currentYear: 2024,
        dkimSignature: 'valid_dkim_signature'
      };

      const proof = await service.generateEmailAgeProof(request.id, emailInput);

      expect(proof.isValid).toBe(false);
      expect(proof.minAge).toBe(18);
    });

    it('should fail for non-existent request', async () => {
      const emailInput = {
        emailDomain: 'gmail.com',
        emailHash: 'hashed_email_123',
        birthYear: 1990,
        currentYear: 2024,
        dkimSignature: 'valid_dkim_signature'
      };

      await expect(
        service.generateEmailAgeProof('nonexistent-request', emailInput)
      ).rejects.toThrow('Verification request not found');
    });
  });

  describe('generateGovernmentIdProof', () => {
    it('should generate valid government ID proof', async () => {
      const userId = 'user123';
      const request = await service.createVerificationRequest(userId, 'government_id', 21);

      const idInput = {
        documentType: 'drivers_license' as const,
        documentHash: 'hashed_document_123',
        birthDate: '1995-06-15',
        issueDate: '2020-01-01',
        countryCode: 'US',
        documentSignature: 'valid_gov_signature'
      };

      const proof = await service.generateGovernmentIdProof(request.id, idInput);

      expect(proof.id).toBeDefined();
      expect(proof.proofType).toBe('government_id');
      expect(proof.minAge).toBe(21);
      expect(proof.isValid).toBe(true); // Born 1995, so over 21
      expect(proof.proofData).toBeDefined();
    });

    it('should handle different document types', async () => {
      const userId = 'user123';
      const request = await service.createVerificationRequest(userId, 'government_id', 18);

      const passportInput = {
        documentType: 'passport' as const,
        documentHash: 'hashed_passport_123',
        birthDate: '1985-03-20',
        issueDate: '2019-01-01',
        countryCode: 'CA',
        documentSignature: 'valid_gov_signature'
      };

      const proof = await service.generateGovernmentIdProof(request.id, passportInput);

      expect(proof.proofType).toBe('government_id');
      expect(proof.isValid).toBe(true);
    });
  });

  describe('generateAnonAadhaarProof', () => {
    it('should generate valid Anon Aadhaar proof', async () => {
      const userId = 'user123';
      const request = await service.createVerificationRequest(userId, 'anon_aadhaar', 18);

      const aadhaarInput = {
        aadhaarHash: 'hashed_aadhaar_123',
        birthYear: 1992,
        stateCode: 'MH',
        nullifierHash: 'unique_nullifier_123',
        uidaiSignature: 'valid_uidai_signature'
      };

      const proof = await service.generateAnonAadhaarProof(request.id, aadhaarInput);

      expect(proof.id).toBeDefined();
      expect(proof.proofType).toBe('anon_aadhaar');
      expect(proof.minAge).toBe(18);
      expect(proof.isValid).toBe(true);
    });

    it('should prevent nullifier reuse', async () => {
      const userId1 = 'user123';
      const userId2 = 'user456';
      
      const request1 = await service.createVerificationRequest(userId1, 'anon_aadhaar', 18);
      const request2 = await service.createVerificationRequest(userId2, 'anon_aadhaar', 18);

      const aadhaarInput = {
        aadhaarHash: 'hashed_aadhaar_123',
        birthYear: 1992,
        stateCode: 'MH',
        nullifierHash: 'same_nullifier_123', // Same nullifier
        uidaiSignature: 'valid_uidai_signature'
      };

      // First proof should succeed
      const proof1 = await service.generateAnonAadhaarProof(request1.id, aadhaarInput);
      expect(proof1.isValid).toBe(true);

      // Second proof with same nullifier should fail
      await expect(
        service.generateAnonAadhaarProof(request2.id, aadhaarInput)
      ).rejects.toThrow('Nullifier already used');
    });
  });

  describe('verifyAgeProof', () => {
    it('should verify valid proof', async () => {
      const userId = 'user123';
      const request = await service.createVerificationRequest(userId, 'email', 18);

      const emailInput = {
        emailDomain: 'gmail.com',
        emailHash: 'hashed_email_123',
        birthYear: 1990,
        currentYear: 2024,
        dkimSignature: 'valid_dkim_signature'
      };

      const proof = await service.generateEmailAgeProof(request.id, emailInput);
      const verification = await service.verifyAgeProof(proof.id);

      expect(verification.isValid).toBe(true);
      expect(verification.ageVerified).toBe(true);
      expect(verification.minAge).toBe(18);
      expect(verification.proofType).toBe('email');
      expect(verification.trustScore).toBeGreaterThan(0);
      expect(verification.issues).toHaveLength(0);
      expect(verification.metadata.proofId).toBe(proof.id);
    });

    it('should detect expired proofs', async () => {
      const userId = 'user123';
      const request = await service.createVerificationRequest(userId, 'email', 18);

      const emailInput = {
        emailDomain: 'gmail.com',
        emailHash: 'hashed_email_123',
        birthYear: 1990,
        currentYear: 2024,
        dkimSignature: 'valid_dkim_signature'
      };

      const proof = await service.generateEmailAgeProof(request.id, emailInput);
      
      // Manually expire the proof
      proof.expiresAt = new Date(Date.now() - 1000);

      const verification = await service.verifyAgeProof(proof.id);

      expect(verification.isValid).toBe(false);
      expect(verification.issues).toContain('Proof has expired');
      expect(verification.trustScore).toBeLessThan(100);
    });

    it('should return error for non-existent proof', async () => {
      const verification = await service.verifyAgeProof('nonexistent-proof');

      expect(verification.isValid).toBe(false);
      expect(verification.ageVerified).toBe(false);
      expect(verification.trustScore).toBe(0);
      expect(verification.issues).toContain('Proof not found');
    });
  });

  describe('getUserAgeProofs', () => {
    it('should return user proofs sorted by creation date', async () => {
      const userId = 'user123';
      
      // Create multiple proofs
      const request1 = await service.createVerificationRequest(userId, 'email', 18);
      const request2 = await service.createVerificationRequest(userId, 'government_id', 21);

      const emailInput = {
        emailDomain: 'gmail.com',
        emailHash: 'hashed_email_123',
        birthYear: 1990,
        currentYear: 2024,
        dkimSignature: 'valid_dkim_signature'
      };

      const idInput = {
        documentType: 'drivers_license' as const,
        documentHash: 'hashed_document_123',
        birthDate: '1990-06-15',
        issueDate: '2020-01-01',
        countryCode: 'US',
        documentSignature: 'valid_gov_signature'
      };

      await service.generateEmailAgeProof(request1.id, emailInput);
      await service.generateGovernmentIdProof(request2.id, idInput);

      const userProofs = await service.getUserAgeProofs(userId);

      expect(userProofs).toHaveLength(2);
      expect(userProofs[0].createdAt.getTime()).toBeGreaterThanOrEqual(userProofs[1].createdAt.getTime());
    });

    it('should return empty array for user with no proofs', async () => {
      const userProofs = await service.getUserAgeProofs('user-with-no-proofs');
      expect(userProofs).toHaveLength(0);
    });
  });

  describe('getSystemStats', () => {
    it('should return accurate system statistics', async () => {
      const userId1 = 'user123';
      const userId2 = 'user456';
      
      // Create proofs of different types
      const emailRequest = await service.createVerificationRequest(userId1, 'email', 18);
      const govIdRequest = await service.createVerificationRequest(userId2, 'government_id', 21);

      const emailInput = {
        emailDomain: 'gmail.com',
        emailHash: 'hashed_email_123',
        birthYear: 1990,
        currentYear: 2024,
        dkimSignature: 'valid_dkim_signature'
      };

      const idInput = {
        documentType: 'drivers_license' as const,
        documentHash: 'hashed_document_123',
        birthDate: '1990-06-15',
        issueDate: '2020-01-01',
        countryCode: 'US',
        documentSignature: 'valid_gov_signature'
      };

      await service.generateEmailAgeProof(emailRequest.id, emailInput);
      await service.generateGovernmentIdProof(govIdRequest.id, idInput);

      const stats = await service.getSystemStats();

      expect(stats.totalProofs).toBe(2);
      expect(stats.proofsByType.email).toBe(1);
      expect(stats.proofsByType.government_id).toBe(1);
      expect(stats.activeProofs).toBe(2); // Both should be active
      expect(stats.expiredProofs).toBe(0);
      expect(stats.verificationRate).toBe(1); // Both valid
    });
  });
});

describe('ZK Age Proof Integration', () => {
  let service: ZKAgeProofService;

  beforeEach(() => {
    service = new ZKAgeProofService();
  });

  it('should handle complete age verification workflow', async () => {
    const userId = 'user123';
    const minAge = 21;

    // 1. Create verification request
    const request = await service.createVerificationRequest(userId, 'email', minAge);
    expect(request.status).toBe('pending');

    // 2. Generate ZK proof
    const emailInput = {
      emailDomain: 'gmail.com',
      emailHash: 'hashed_email_user123',
      birthYear: 1995, // 29 years old, meets 21+ requirement
      currentYear: 2024,
      dkimSignature: 'dkim_signature_from_gmail'
    };

    const proof = await service.generateEmailAgeProof(request.id, emailInput);
    expect(proof.isValid).toBe(true);
    expect(proof.minAge).toBe(minAge);

    // 3. Verify the proof
    const verification = await service.verifyAgeProof(proof.id);
    expect(verification.isValid).toBe(true);
    expect(verification.ageVerified).toBe(true);
    expect(verification.trustScore).toBeGreaterThan(50);

    // 4. Check request was updated
    const updatedRequest = await service.getVerificationRequest(request.id);
    expect(updatedRequest!.status).toBe('completed');
    expect(updatedRequest!.zkProof).toBeTruthy();

    // 5. Verify user can retrieve their proofs
    const userProofs = await service.getUserAgeProofs(userId);
    expect(userProofs).toHaveLength(1);
    expect(userProofs[0].id).toBe(proof.id);
  });

  it('should handle multiple proof types for same user', async () => {
    const userId = 'user123';

    // Email proof
    const emailRequest = await service.createVerificationRequest(userId, 'email', 18);
    const emailInput = {
      emailDomain: 'gmail.com',
      emailHash: 'hashed_email_123',
      birthYear: 1990,
      currentYear: 2024,
      dkimSignature: 'valid_dkim_signature'
    };
    const emailProof = await service.generateEmailAgeProof(emailRequest.id, emailInput);

    // Government ID proof
    const govIdRequest = await service.createVerificationRequest(userId, 'government_id', 21);
    const idInput = {
      documentType: 'passport' as const,
      documentHash: 'hashed_passport_123',
      birthDate: '1990-06-15',
      issueDate: '2020-01-01',
      countryCode: 'US',
      documentSignature: 'valid_gov_signature'
    };
    const govIdProof = await service.generateGovernmentIdProof(govIdRequest.id, idInput);

    // User should have both proofs
    const userProofs = await service.getUserAgeProofs(userId);
    expect(userProofs).toHaveLength(2);
    
    const proofTypes = userProofs.map(p => p.proofType);
    expect(proofTypes).toContain('email');
    expect(proofTypes).toContain('government_id');

    // Both proofs should be valid
    const emailVerification = await service.verifyAgeProof(emailProof.id);
    const govIdVerification = await service.verifyAgeProof(govIdProof.id);
    
    expect(emailVerification.isValid).toBe(true);
    expect(govIdVerification.isValid).toBe(true);
  });

  it('should handle privacy-preserving age verification', async () => {
    const userId = 'user123';
    const request = await service.createVerificationRequest(userId, 'anon_aadhaar', 18);

    const aadhaarInput = {
      aadhaarHash: 'privacy_preserving_hash_123',
      birthYear: 1992,
      stateCode: 'KA',
      nullifierHash: 'unique_nullifier_for_user123',
      uidaiSignature: 'valid_uidai_signature'
    };

    const proof = await service.generateAnonAadhaarProof(request.id, aadhaarInput);

    // Proof should be valid but not reveal personal information
    expect(proof.isValid).toBe(true);
    expect(proof.proofData).toBeDefined();
    expect(proof.publicSignals).toBeDefined();
    
    // Public signals should not contain sensitive data
    const publicSignalsStr = proof.publicSignals.join('');
    expect(publicSignalsStr).not.toContain(aadhaarInput.aadhaarHash);
    expect(publicSignalsStr).not.toContain(aadhaarInput.uidaiSignature);

    // Verification should confirm age without revealing it
    const verification = await service.verifyAgeProof(proof.id);
    expect(verification.ageVerified).toBe(true);
    expect(verification.minAge).toBe(18);
    // Exact age should not be revealed, only that they meet minimum
  });

  it('should prevent proof reuse and double-spending', async () => {
    const aadhaarInput = {
      aadhaarHash: 'same_aadhaar_hash',
      birthYear: 1990,
      stateCode: 'MH',
      nullifierHash: 'same_nullifier_hash',
      uidaiSignature: 'valid_uidai_signature'
    };

    // First user creates proof
    const user1Request = await service.createVerificationRequest('user1', 'anon_aadhaar', 18);
    const proof1 = await service.generateAnonAadhaarProof(user1Request.id, aadhaarInput);
    expect(proof1.isValid).toBe(true);

    // Second user tries to use same Aadhaar (same nullifier)
    const user2Request = await service.createVerificationRequest('user2', 'anon_aadhaar', 18);
    
    await expect(
      service.generateAnonAadhaarProof(user2Request.id, aadhaarInput)
    ).rejects.toThrow('Nullifier already used');
  });
});