import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface ZKAgeProof {
  id: string;
  proofData: string;
  publicSignals: string[];
  verificationKey: string;
  minAge: number;
  proofType: 'email' | 'government_id' | 'anon_aadhaar' | 'passport';
  createdAt: Date;
  expiresAt: Date;
  isValid: boolean;
}

export interface AgeVerificationRequest {
  id: string;
  userId: string;
  proofType: ZKAgeProof['proofType'];
  minAge: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  zkProof?: ZKAgeProof;
  createdAt: Date;
}

export interface EmailAgeProofInput {
  emailDomain: string; // e.g., "gmail.com"
  emailHash: string; // Hash of email for privacy
  birthYear: number;
  currentYear: number;
  dkimSignature: string; // DKIM signature from email provider
}

export interface GovernmentIdProofInput {
  documentType: 'drivers_license' | 'passport' | 'national_id';
  documentHash: string; // Hash of document for privacy
  birthDate: string; // Encrypted birth date
  issueDate: string;
  countryCode: string;
  documentSignature: string; // Government digital signature
}

export interface AnonAadhaarProofInput {
  aadhaarHash: string; // Hash of Aadhaar number
  birthYear: number;
  stateCode: string;
  nullifierHash: string; // Prevents double-spending
  uidaiSignature: string; // UIDAI signature
}

export interface ZKCircuitWitness {
  privateInputs: Record<string, any>;
  publicInputs: Record<string, any>;
}

export interface ZKVerificationResult {
  isValid: boolean;
  ageVerified: boolean;
  minAge: number;
  proofType: string;
  trustScore: number;
  issues: string[];
  metadata: {
    verifiedAt: Date;
    expiresAt: Date;
    proofId: string;
  };
}

export class ZKAgeProofService {
  private readonly verificationRequests = new Map<string, AgeVerificationRequest>();
  private readonly zkProofs = new Map<string, ZKAgeProof>();
  private readonly circuitWasm: string; // Path to compiled circuit WASM
  private readonly circuitZkey: string; // Path to proving key

  constructor() {
    // In production, these would point to actual compiled circuits
    this.circuitWasm = process.env.ZK_CIRCUIT_WASM || '/circuits/age_verification.wasm';
    this.circuitZkey = process.env.ZK_CIRCUIT_ZKEY || '/circuits/age_verification_final.zkey';
  }

  /**
   * Create age verification request
   */
  async createVerificationRequest(
    userId: string,
    proofType: ZKAgeProof['proofType'],
    minAge: number = 18
  ): Promise<AgeVerificationRequest> {
    const requestId = uuidv4();
    
    const request: AgeVerificationRequest = {
      id: requestId,
      userId,
      proofType,
      minAge,
      status: 'pending',
      createdAt: new Date()
    };
    
    this.verificationRequests.set(requestId, request);
    
    console.log(`Created ZK age verification request ${requestId} for user ${userId}`);
    return request;
  }

  /**
   * Generate ZK proof for email-based age verification (zkEmail style)
   */
  async generateEmailAgeProof(
    requestId: string,
    emailProofInput: EmailAgeProofInput
  ): Promise<ZKAgeProof> {
    const request = this.verificationRequests.get(requestId);
    if (!request) {
      throw new Error('Verification request not found');
    }

    // Update request status
    request.status = 'generating';
    
    try {
      // Create circuit witness
      const witness = this.createEmailCircuitWitness(emailProofInput, request.minAge);
      
      // Generate ZK proof (simulated - in production would use snarkjs)
      const proof = await this.generateZKProof(witness, 'email');
      
      // Store proof
      this.zkProofs.set(proof.id, proof);
      
      // Update request
      request.zkProof = proof;
      request.status = 'completed';
      
      console.log(`Generated email ZK age proof ${proof.id}`);
      return proof;
      
    } catch (error) {
      request.status = 'failed';
      throw new Error(`Failed to generate email age proof: ${error.message}`);
    }
  }

  /**
   * Generate ZK proof for government ID-based age verification
   */
  async generateGovernmentIdProof(
    requestId: string,
    idProofInput: GovernmentIdProofInput
  ): Promise<ZKAgeProof> {
    const request = this.verificationRequests.get(requestId);
    if (!request) {
      throw new Error('Verification request not found');
    }

    request.status = 'generating';
    
    try {
      // Verify government signature first
      const signatureValid = await this.verifyGovernmentSignature(
        idProofInput.documentSignature,
        idProofInput.documentHash,
        idProofInput.countryCode
      );
      
      if (!signatureValid) {
        throw new Error('Invalid government document signature');
      }
      
      // Create circuit witness
      const witness = this.createGovernmentIdCircuitWitness(idProofInput, request.minAge);
      
      // Generate ZK proof
      const proof = await this.generateZKProof(witness, 'government_id');
      
      // Store proof
      this.zkProofs.set(proof.id, proof);
      
      // Update request
      request.zkProof = proof;
      request.status = 'completed';
      
      console.log(`Generated government ID ZK age proof ${proof.id}`);
      return proof;
      
    } catch (error) {
      request.status = 'failed';
      throw new Error(`Failed to generate government ID proof: ${error.message}`);
    }
  }

  /**
   * Generate ZK proof using Anon Aadhaar style system
   */
  async generateAnonAadhaarProof(
    requestId: string,
    aadhaarInput: AnonAadhaarProofInput
  ): Promise<ZKAgeProof> {
    const request = this.verificationRequests.get(requestId);
    if (!request) {
      throw new Error('Verification request not found');
    }

    request.status = 'generating';
    
    try {
      // Verify UIDAI signature
      const signatureValid = await this.verifyUidaiSignature(
        aadhaarInput.uidaiSignature,
        aadhaarInput.aadhaarHash
      );
      
      if (!signatureValid) {
        throw new Error('Invalid UIDAI signature');
      }
      
      // Check nullifier to prevent double-spending
      const nullifierUsed = await this.checkNullifierUsed(aadhaarInput.nullifierHash);
      if (nullifierUsed) {
        throw new Error('Nullifier already used - proof already generated for this identity');
      }
      
      // Create circuit witness
      const witness = this.createAnonAadhaarCircuitWitness(aadhaarInput, request.minAge);
      
      // Generate ZK proof
      const proof = await this.generateZKProof(witness, 'anon_aadhaar');
      
      // Store nullifier to prevent reuse
      await this.storeNullifier(aadhaarInput.nullifierHash, proof.id);
      
      // Store proof
      this.zkProofs.set(proof.id, proof);
      
      // Update request
      request.zkProof = proof;
      request.status = 'completed';
      
      console.log(`Generated Anon Aadhaar ZK age proof ${proof.id}`);
      return proof;
      
    } catch (error) {
      request.status = 'failed';
      throw new Error(`Failed to generate Anon Aadhaar proof: ${error.message}`);
    }
  }

  /**
   * Verify ZK age proof
   */
  async verifyAgeProof(proofId: string): Promise<ZKVerificationResult> {
    const proof = this.zkProofs.get(proofId);
    
    if (!proof) {
      return {
        isValid: false,
        ageVerified: false,
        minAge: 0,
        proofType: 'unknown',
        trustScore: 0,
        issues: ['Proof not found'],
        metadata: {
          verifiedAt: new Date(),
          expiresAt: new Date(),
          proofId
        }
      };
    }
    
    const issues: string[] = [];
    let isValid = true;
    let trustScore = 100;
    
    // Check if proof has expired
    if (new Date() > proof.expiresAt) {
      issues.push('Proof has expired');
      isValid = false;
      trustScore -= 50;
    }
    
    // Verify ZK proof cryptographically (simulated)
    const cryptographicValid = await this.verifyCryptographicProof(proof);
    if (!cryptographicValid) {
      issues.push('Cryptographic verification failed');
      isValid = false;
      trustScore = 0;
    }
    
    // Verify public signals
    const publicSignalsValid = this.verifyPublicSignals(proof);
    if (!publicSignalsValid) {
      issues.push('Public signals verification failed');
      isValid = false;
      trustScore -= 30;
    }
    
    // Additional checks based on proof type
    if (proof.proofType === 'anon_aadhaar') {
      // Check nullifier hasn't been reused
      const nullifierValid = await this.verifyNullifierUniqueness(proof);
      if (!nullifierValid) {
        issues.push('Nullifier reuse detected');
        isValid = false;
        trustScore = 0;
      }
    }
    
    return {
      isValid,
      ageVerified: isValid && proof.isValid,
      minAge: proof.minAge,
      proofType: proof.proofType,
      trustScore: Math.max(0, trustScore),
      issues,
      metadata: {
        verifiedAt: new Date(),
        expiresAt: proof.expiresAt,
        proofId: proof.id
      }
    };
  }

  /**
   * Get verification request status
   */
  async getVerificationRequest(requestId: string): Promise<AgeVerificationRequest | null> {
    return this.verificationRequests.get(requestId) || null;
  }

  /**
   * List user's age proofs
   */
  async getUserAgeProofs(userId: string): Promise<ZKAgeProof[]> {
    const userProofs: ZKAgeProof[] = [];
    
    for (const request of this.verificationRequests.values()) {
      if (request.userId === userId && request.zkProof) {
        userProofs.push(request.zkProof);
      }
    }
    
    return userProofs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<{
    totalProofs: number;
    proofsByType: Record<string, number>;
    activeProofs: number;
    expiredProofs: number;
    verificationRate: number;
  }> {
    const allProofs = Array.from(this.zkProofs.values());
    const now = new Date();
    
    const proofsByType = allProofs.reduce((acc, proof) => {
      acc[proof.proofType] = (acc[proof.proofType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const activeProofs = allProofs.filter(p => p.expiresAt > now).length;
    const expiredProofs = allProofs.filter(p => p.expiresAt <= now).length;
    const validProofs = allProofs.filter(p => p.isValid).length;
    
    return {
      totalProofs: allProofs.length,
      proofsByType,
      activeProofs,
      expiredProofs,
      verificationRate: allProofs.length > 0 ? validProofs / allProofs.length : 0
    };
  }

  // Private helper methods
  private createEmailCircuitWitness(
    input: EmailAgeProofInput,
    minAge: number
  ): ZKCircuitWitness {
    const age = input.currentYear - input.birthYear;
    
    return {
      privateInputs: {
        email_hash: input.emailHash,
        birth_year: input.birthYear,
        dkim_signature: input.dkimSignature
      },
      publicInputs: {
        email_domain_hash: createHash('sha256').update(input.emailDomain).digest('hex'),
        min_age: minAge,
        current_year: input.currentYear,
        age_verified: age >= minAge ? 1 : 0
      }
    };
  }

  private createGovernmentIdCircuitWitness(
    input: GovernmentIdProofInput,
    minAge: number
  ): ZKCircuitWitness {
    const birthDate = new Date(input.birthDate);
    const age = new Date().getFullYear() - birthDate.getFullYear();
    
    return {
      privateInputs: {
        document_hash: input.documentHash,
        birth_date: input.birthDate,
        document_signature: input.documentSignature
      },
      publicInputs: {
        document_type_hash: createHash('sha256').update(input.documentType).digest('hex'),
        country_code: input.countryCode,
        min_age: minAge,
        age_verified: age >= minAge ? 1 : 0,
        issue_date_hash: createHash('sha256').update(input.issueDate).digest('hex')
      }
    };
  }

  private createAnonAadhaarCircuitWitness(
    input: AnonAadhaarProofInput,
    minAge: number
  ): ZKCircuitWitness {
    const age = new Date().getFullYear() - input.birthYear;
    
    return {
      privateInputs: {
        aadhaar_hash: input.aadhaarHash,
        birth_year: input.birthYear,
        uidai_signature: input.uidaiSignature
      },
      publicInputs: {
        state_code: input.stateCode,
        min_age: minAge,
        age_verified: age >= minAge ? 1 : 0,
        nullifier_hash: input.nullifierHash
      }
    };
  }

  private async generateZKProof(
    witness: ZKCircuitWitness,
    proofType: ZKAgeProof['proofType']
  ): Promise<ZKAgeProof> {
    // In production, this would use snarkjs to generate actual ZK proofs
    // For now, we simulate the proof generation
    
    const proofId = uuidv4();
    const proofData = this.simulateProofGeneration(witness);
    const publicSignals = Object.values(witness.publicInputs).map(String);
    const verificationKey = this.getVerificationKey(proofType);
    
    return {
      id: proofId,
      proofData,
      publicSignals,
      verificationKey,
      minAge: witness.publicInputs.min_age,
      proofType,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      isValid: witness.publicInputs.age_verified === 1
    };
  }

  private simulateProofGeneration(witness: ZKCircuitWitness): string {
    // Simulate proof generation - in production would use actual ZK library
    const proofObject = {
      pi_a: [randomBytes(32).toString('hex'), randomBytes(32).toString('hex'), '1'],
      pi_b: [[randomBytes(32).toString('hex'), randomBytes(32).toString('hex')], 
             [randomBytes(32).toString('hex'), randomBytes(32).toString('hex')], 
             ['1', '0']],
      pi_c: [randomBytes(32).toString('hex'), randomBytes(32).toString('hex'), '1'],
      protocol: 'groth16',
      curve: 'bn128'
    };
    
    return JSON.stringify(proofObject);
  }

  private getVerificationKey(proofType: string): string {
    // In production, would return actual verification key for the circuit
    return `vk_${proofType}_${createHash('sha256').update(proofType).digest('hex').slice(0, 16)}`;
  }

  private async verifyCryptographicProof(proof: ZKAgeProof): Promise<boolean> {
    // In production, would use snarkjs to verify the proof
    // For simulation, we check if the proof data is well-formed
    try {
      const proofObject = JSON.parse(proof.proofData);
      return proofObject.protocol === 'groth16' && proofObject.curve === 'bn128';
    } catch {
      return false;
    }
  }

  private verifyPublicSignals(proof: ZKAgeProof): boolean {
    // Verify that public signals are consistent
    return proof.publicSignals.length > 0 && 
           proof.publicSignals.every(signal => signal !== undefined);
  }

  private async verifyGovernmentSignature(
    signature: string,
    documentHash: string,
    countryCode: string
  ): Promise<boolean> {
    // In production, would verify against government PKI
    return signature.length > 0 && documentHash.length > 0;
  }

  private async verifyUidaiSignature(
    signature: string,
    aadhaarHash: string
  ): Promise<boolean> {
    // In production, would verify against UIDAI public key
    return signature.length > 0 && aadhaarHash.length > 0;
  }

  private nullifierStore = new Set<string>();

  private async checkNullifierUsed(nullifierHash: string): Promise<boolean> {
    return this.nullifierStore.has(nullifierHash);
  }

  private async storeNullifier(nullifierHash: string, proofId: string): Promise<void> {
    this.nullifierStore.add(nullifierHash);
  }

  private async verifyNullifierUniqueness(proof: ZKAgeProof): Promise<boolean> {
    if (proof.proofType !== 'anon_aadhaar') return true;
    
    const nullifierHash = proof.publicSignals.find(signal => 
      signal.startsWith('nullifier_') || proof.publicSignals.indexOf(signal) === proof.publicSignals.length - 1
    );
    
    return nullifierHash ? !this.nullifierStore.has(nullifierHash) : false;
  }
}

export const zkAgeProofService = new ZKAgeProofService();