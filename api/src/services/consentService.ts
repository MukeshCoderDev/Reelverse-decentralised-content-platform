import { ethers } from 'ethers';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';

// EIP-712 Domain for consent signatures
const CONSENT_DOMAIN = {
  name: 'Reelverse18 Consent',
  version: '1',
  chainId: 137, // Polygon mainnet
  verifyingContract: '0x0000000000000000000000000000000000000000' // Will be updated with actual contract
};

// EIP-712 Types for consent data
const CONSENT_TYPES = {
  SceneConsent: [
    { name: 'sceneHash', type: 'bytes32' },
    { name: 'participant', type: 'address' },
    { name: 'role', type: 'string' },
    { name: 'consentDate', type: 'uint256' },
    { name: 'termsVersion', type: 'string' },
    { name: 'documentHashes', type: 'bytes32[]' }
  ]
};

export interface ConsentData {
  sceneHash: string;
  participant: string;
  role: 'performer' | 'director' | 'producer';
  consentDate: number;
  termsVersion: string;
  documentHashes: string[];
}

export interface ConsentSignature {
  signature: string;
  encryptedData: string;
  timestamp: number;
}

export interface SceneParticipant {
  wallet: string;
  role: 'performer' | 'director' | 'producer';
  consented: boolean;
  consentTimestamp?: number;
}

export class ConsentService {
  private encryptionKey: Buffer;

  constructor() {
    // In production, this should come from secure key management
    this.encryptionKey = Buffer.from(process.env.CONSENT_ENCRYPTION_KEY || crypto.randomBytes(32));
  }

  /**
   * Generate a unique scene hash from content metadata and participants
   */
  generateSceneHash(contentMetadata: {
    title: string;
    description: string;
    participants: Array<{ wallet: string; role: string }>;
    createdAt: number;
  }): string {
    const hashInput = JSON.stringify({
      title: contentMetadata.title,
      description: contentMetadata.description,
      participants: contentMetadata.participants.sort((a, b) => a.wallet.localeCompare(b.wallet)),
      createdAt: contentMetadata.createdAt
    });
    
    return ethers.keccak256(ethers.toUtf8Bytes(hashInput));
  }

  /**
   * Create EIP-712 consent message for signing
   */
  createConsentMessage(consentData: ConsentData): any {
    return {
      domain: CONSENT_DOMAIN,
      types: CONSENT_TYPES,
      primaryType: 'SceneConsent',
      message: consentData
    };
  }

  /**
   * Verify EIP-712 consent signature
   */
  async verifyConsentSignature(
    consentData: ConsentData,
    signature: string
  ): Promise<{ valid: boolean; signer?: string }> {
    try {
      const message = this.createConsentMessage(consentData);
      
      // Recover signer address from signature
      const signer = ethers.verifyTypedData(
        message.domain,
        message.types,
        message.message,
        signature
      );

      // Verify signer matches participant
      const valid = signer.toLowerCase() === consentData.participant.toLowerCase();
      
      return { valid, signer };
    } catch (error) {
      console.error('Consent signature verification failed:', error);
      return { valid: false };
    }
  }

  /**
   * Encrypt consent data for storage
   */
  encryptConsentData(data: ConsentData): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt consent data from storage
   */
  decryptConsentData(encryptedData: string): ConsentData {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  /**
   * Store consent signature with encryption
   */
  async storeConsentSignature(
    sceneHash: string,
    consentData: ConsentData,
    signature: string
  ): Promise<ConsentSignature> {
    // Verify signature before storing
    const verification = await this.verifyConsentSignature(consentData, signature);
    if (!verification.valid) {
      throw new Error('Invalid consent signature');
    }

    const encryptedData = this.encryptConsentData(consentData);
    const consentSignature: ConsentSignature = {
      signature,
      encryptedData,
      timestamp: Date.now()
    };

    await this.storeInDatabase(sceneHash, consentData, signature, encryptedData);

    return consentSignature;
  }

  /**
   * Check if all participants have provided consent for a scene
   */
  async validateSceneConsent(
    sceneHash: string,
    requiredParticipants: SceneParticipant[]
  ): Promise<{ complete: boolean; missing: string[]; consents: ConsentSignature[] }> {
    const consents: ConsentSignature[] = [];
    const missing: string[] = [];

    for (const participant of requiredParticipants) {
      const consent = await this.getConsentSignature(sceneHash, participant.wallet);
      if (consent) {
        consents.push(consent);
      } else {
        missing.push(participant.wallet);
      }
    }

    return {
      complete: missing.length === 0,
      missing,
      consents
    };
  }

  /**
   * Get consent signature for a specific participant and scene
   */
  private async getConsentSignature(
    sceneHash: string,
    participantWallet: string
  ): Promise<ConsentSignature | null> {
    return this.getFromDatabase(sceneHash, participantWallet);
  }

  /**
   * Store consent signature in database
   */
  private async storeInDatabase(
    sceneHash: string, 
    consentData: ConsentData, 
    signature: string, 
    encryptedData: string
  ): Promise<void> {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert or update scene record
      await client.query(`
        INSERT INTO scenes (scene_hash, content_title, content_description, creator_wallet, terms_version)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (scene_hash) DO UPDATE SET
          updated_at = NOW()
      `, [sceneHash, 'Scene Content', '', consentData.participant, consentData.termsVersion]);
      
      // Insert or update participant record
      await client.query(`
        INSERT INTO scene_participants (scene_hash, participant_wallet, participant_role, consent_provided, consent_timestamp)
        VALUES ($1, $2, $3, TRUE, $4)
        ON CONFLICT (scene_hash, participant_wallet) DO UPDATE SET
          consent_provided = TRUE,
          consent_timestamp = $4
      `, [sceneHash, consentData.participant, consentData.role, new Date(consentData.consentDate * 1000)]);
      
      // Insert consent signature
      await client.query(`
        INSERT INTO consent_signatures (
          scene_hash, participant_wallet, signature_data, encrypted_consent_data,
          consent_date, terms_version, document_hashes, verification_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'verified')
        ON CONFLICT (scene_hash, participant_wallet) DO UPDATE SET
          signature_data = $3,
          encrypted_consent_data = $4,
          consent_date = $5,
          terms_version = $6,
          document_hashes = $7,
          verification_status = 'verified'
      `, [
        sceneHash,
        consentData.participant,
        signature,
        encryptedData,
        new Date(consentData.consentDate * 1000),
        consentData.termsVersion,
        consentData.documentHashes
      ]);
      
      // Log audit trail
      await client.query(`
        INSERT INTO consent_audit_log (scene_hash, participant_wallet, action, details)
        VALUES ($1, $2, 'consent_provided', $3)
      `, [
        sceneHash,
        consentData.participant,
        JSON.stringify({
          terms_version: consentData.termsVersion,
          consent_date: consentData.consentDate,
          role: consentData.role
        })
      ]);
      
      await client.query('COMMIT');
      logger.info(`Consent stored for scene ${sceneHash}, participant ${consentData.participant}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to store consent signature:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async getFromDatabase(sceneHash: string, participant: string): Promise<ConsentSignature | null> {
    const db = getDatabase();
    
    try {
      const result = await db.query(`
        SELECT signature_data, encrypted_consent_data, created_at
        FROM consent_signatures
        WHERE scene_hash = $1 AND participant_wallet = $2 AND verification_status = 'verified'
      `, [sceneHash, participant.toLowerCase()]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        signature: row.signature_data,
        encryptedData: row.encrypted_consent_data,
        timestamp: new Date(row.created_at).getTime()
      };
    } catch (error) {
      logger.error('Failed to retrieve consent signature:', error);
      return null;
    }
  }

  /**
   * Generate consent completion report for legal compliance
   */
  async generateConsentReport(sceneHash: string): Promise<{
    sceneHash: string;
    totalParticipants: number;
    consentedParticipants: number;
    completionRate: number;
    consents: Array<{
      participant: string;
      role: string;
      consentDate: number;
      verified: boolean;
    }>;
  }> {
    const db = getDatabase();
    
    try {
      const result = await db.query(`
        SELECT 
          cs.participant_wallet,
          cs.encrypted_consent_data,
          cs.consent_date,
          cs.verification_status,
          sp.participant_role
        FROM consent_signatures cs
        JOIN scene_participants sp ON cs.scene_hash = sp.scene_hash 
          AND cs.participant_wallet = sp.participant_wallet
        WHERE cs.scene_hash = $1
        ORDER BY cs.created_at
      `, [sceneHash]);
      
      const consents = result.rows.map(row => {
        const decryptedData = this.decryptConsentData(row.encrypted_consent_data);
        return {
          participant: row.participant_wallet,
          role: decryptedData.role,
          consentDate: Math.floor(new Date(row.consent_date).getTime() / 1000),
          verified: row.verification_status === 'verified'
        };
      });
      
      // Get total participants count
      const totalResult = await db.query(`
        SELECT COUNT(*) as total
        FROM scene_participants
        WHERE scene_hash = $1
      `, [sceneHash]);
      
      const totalParticipants = parseInt(totalResult.rows[0]?.total || '0');
      const consentedParticipants = consents.filter(c => c.verified).length;
      
      return {
        sceneHash,
        totalParticipants,
        consentedParticipants,
        completionRate: totalParticipants > 0 ? consentedParticipants / totalParticipants : 0,
        consents
      };
    } catch (error) {
      logger.error('Failed to generate consent report:', error);
      throw error;
    }
  }

  /**
   * Create a new scene with participants
   */
  async createScene(
    sceneHash: string,
    contentTitle: string,
    contentDescription: string,
    creatorWallet: string,
    participants: Array<{ wallet: string; role: string }>,
    termsVersion: string = '1.0'
  ): Promise<void> {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert scene
      await client.query(`
        INSERT INTO scenes (scene_hash, content_title, content_description, creator_wallet, total_participants, terms_version)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (scene_hash) DO UPDATE SET
          content_title = $2,
          content_description = $3,
          total_participants = $5,
          updated_at = NOW()
      `, [sceneHash, contentTitle, contentDescription, creatorWallet, participants.length, termsVersion]);
      
      // Insert participants
      for (const participant of participants) {
        await client.query(`
          INSERT INTO scene_participants (scene_hash, participant_wallet, participant_role)
          VALUES ($1, $2, $3)
          ON CONFLICT (scene_hash, participant_wallet) DO UPDATE SET
            participant_role = $3
        `, [sceneHash, participant.wallet, participant.role]);
      }
      
      // Log audit trail
      await client.query(`
        INSERT INTO consent_audit_log (scene_hash, action, actor_wallet, details)
        VALUES ($1, 'scene_created', $2, $3)
      `, [
        sceneHash,
        creatorWallet,
        JSON.stringify({
          content_title: contentTitle,
          participants: participants,
          terms_version: termsVersion
        })
      ]);
      
      await client.query('COMMIT');
      logger.info(`Scene created: ${sceneHash} with ${participants.length} participants`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create scene:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Revoke consent for a participant
   */
  async revokeConsent(
    sceneHash: string,
    participantWallet: string,
    reason: string,
    actorWallet: string
  ): Promise<void> {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update consent signature status
      await client.query(`
        UPDATE consent_signatures
        SET verification_status = 'revoked',
            revoked_at = NOW(),
            revocation_reason = $3
        WHERE scene_hash = $1 AND participant_wallet = $2
      `, [sceneHash, participantWallet, reason]);
      
      // Update participant consent status
      await client.query(`
        UPDATE scene_participants
        SET consent_provided = FALSE,
            consent_timestamp = NULL
        WHERE scene_hash = $1 AND participant_wallet = $2
      `, [sceneHash, participantWallet]);
      
      // Log audit trail
      await client.query(`
        INSERT INTO consent_audit_log (scene_hash, participant_wallet, action, actor_wallet, details)
        VALUES ($1, $2, 'consent_revoked', $3, $4)
      `, [
        sceneHash,
        participantWallet,
        actorWallet,
        JSON.stringify({ revocation_reason: reason })
      ]);
      
      await client.query('COMMIT');
      logger.info(`Consent revoked for scene ${sceneHash}, participant ${participantWallet}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to revoke consent:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
export const consentService = new ConsentService();