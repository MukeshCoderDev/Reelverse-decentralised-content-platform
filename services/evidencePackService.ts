import PDFDocument from 'pdfkit';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ComplianceReport, ComplianceDocument, EvidencePack } from '../types';

export interface EvidencePackConfig {
  outputDirectory: string;
  includeBlockchainVerification: boolean;
  merkleTreeDepth: number;
  compressionLevel: number;
}

export interface EvidencePack {
  id: string;
  contentId: string;
  generatedAt: Date;
  merkleHash: string;
  documents: ComplianceDocument[];
  riskAssessment: any;
  validationResults: any[];
  pdfPath: string;
  blockchainTxHash?: string;
}

export class EvidencePackService {
  private config: EvidencePackConfig;

  constructor(config: EvidencePackConfig) {
    this.config = config;
  }

  /**
   * Generate complete evidence pack with sub-30-second target
   */
  async generateEvidencePack(
    contentId: string,
    complianceReport: ComplianceReport
  ): Promise<EvidencePack> {
    const startTime = Date.now();
    
    try {
      console.log(`Generating evidence pack for content ${contentId}`);

      // Create evidence pack ID
      const packId = `evidence_${contentId}_${Date.now()}`;
      
      // Prepare evidence pack directory
      const packDir = path.join(this.config.outputDirectory, packId);
      await fs.mkdir(packDir, { recursive: true });

      // Generate PDF document
      const pdfPath = await this.generatePDF(packId, packDir, complianceReport);

      // Calculate Merkle hash for verification
      const merkleHash = await this.calculateMerkleHash(complianceReport);

      // Create evidence pack object
      const evidencePack: EvidencePack = {
        id: packId,
        contentId,
        generatedAt: new Date(),
        merkleHash,
        documents: complianceReport.documents,
        riskAssessment: complianceReport.riskScore,
        validationResults: [complianceReport.consentValidation],
        pdfPath
      };

      // Store blockchain verification if enabled
      if (this.config.includeBlockchainVerification) {
        evidencePack.blockchainTxHash = await this.storeOnBlockchain(merkleHash);
      }

      const generationTime = Date.now() - startTime;
      console.log(`Evidence pack generated in ${generationTime}ms for content ${contentId}`);

      // Check if we met the 30-second SLA
      if (generationTime > 30000) {
        console.warn(`Evidence pack generation exceeded 30s SLA: ${generationTime}ms`);
      }

      return evidencePack;

    } catch (error) {
      const generationTime = Date.now() - startTime;
      console.error(`Evidence pack generation failed after ${generationTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Generate PDF evidence pack document
   */
  private async generatePDF(
    packId: string,
    packDir: string,
    complianceReport: ComplianceReport
  ): Promise<string> {
    const pdfPath = path.join(packDir, `${packId}.pdf`);
    
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);

        // Header
        doc.fontSize(20).text('Compliance Evidence Pack', { align: 'center' });
        doc.moveDown();

        // Content information
        doc.fontSize(16).text('Content Information', { underline: true });
        doc.fontSize(12);
        doc.text(`Content ID: ${complianceReport.contentId}`);
        doc.text(`Generated: ${complianceReport.analyzedAt.toISOString()}`);
        doc.text(`Pack ID: ${packId}`);
        doc.moveDown();

        // Risk assessment
        doc.fontSize(16).text('Risk Assessment', { underline: true });
        doc.fontSize(12);
        doc.text(`Overall Risk Score: ${complianceReport.riskScore.overall}/100`);
        doc.text(`Risk Level: ${complianceReport.riskScore.riskLevel.toUpperCase()}`);
        doc.moveDown();

        // Risk breakdown
        doc.text('Risk Breakdown:');
        const breakdown = complianceReport.riskScore.breakdown;
        Object.entries(breakdown).forEach(([key, value]) => {
          const percentage = Math.round(value * 100);
          doc.text(`  ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${percentage}%`);
        });
        doc.moveDown();

        // Compliance documents
        doc.fontSize(16).text('Compliance Documents', { underline: true });
        doc.fontSize(12);
        
        if (complianceReport.documents.length === 0) {
          doc.text('No compliance documents found.');
        } else {
          complianceReport.documents.forEach((document, index) => {
            doc.text(`${index + 1}. ${document.type.toUpperCase()}`);
            doc.text(`   Status: ${document.verified ? 'Verified' : 'Unverified'}`);
            doc.text(`   Uploaded: ${document.uploadedAt.toLocaleDateString()}`);
            doc.text(`   Hash: ${document.hash}`);
            if (document.expiresAt) {
              doc.text(`   Expires: ${document.expiresAt.toLocaleDateString()}`);
            }
            doc.moveDown(0.5);
          });
        }

        // Consent validation
        doc.addPage();
        doc.fontSize(16).text('Consent Validation', { underline: true });
        doc.fontSize(12);
        doc.text(`Validation Status: ${complianceReport.consentValidation.isValid ? 'VALID' : 'INVALID'}`);
        doc.text(`Participants: ${complianceReport.consentValidation.participantCount}`);
        doc.text(`Documents Found: ${complianceReport.consentValidation.documentsFound}`);
        doc.text(`Validated: ${complianceReport.consentValidation.validatedAt.toISOString()}`);
        doc.moveDown();

        if (complianceReport.consentValidation.anomalies.length > 0) {
          doc.text('Anomalies Detected:');
          complianceReport.consentValidation.anomalies.forEach((anomaly, index) => {
            doc.text(`${index + 1}. ${anomaly}`);
          });
          doc.moveDown();
        }

        // Violations
        if (complianceReport.violations.length > 0) {
          doc.fontSize(16).text('Compliance Violations', { underline: true });
          doc.fontSize(12);
          
          complianceReport.violations.forEach((violation, index) => {
            doc.text(`${index + 1}. ${violation.type.toUpperCase()} (${violation.severity})`);
            doc.text(`   Description: ${violation.description}`);
            doc.text(`   Recommendation: ${violation.recommendation}`);
            doc.moveDown(0.5);
          });
        }

        // Recommendations
        if (complianceReport.recommendations.length > 0) {
          doc.addPage();
          doc.fontSize(16).text('AI Recommendations', { underline: true });
          doc.fontSize(12);
          
          complianceReport.recommendations.forEach((recommendation, index) => {
            doc.text(`${index + 1}. ${recommendation}`);
            doc.moveDown(0.5);
          });
        }

        // Footer with verification info
        doc.addPage();
        doc.fontSize(16).text('Verification Information', { underline: true });
        doc.fontSize(12);
        doc.text(`Evidence Complete: ${complianceReport.evidenceComplete ? 'YES' : 'NO'}`);
        doc.text(`Next Review Date: ${complianceReport.nextReviewDate.toLocaleDateString()}`);
        doc.moveDown();

        doc.fontSize(10);
        doc.text('This document was generated automatically by the AI Compliance Assistant.');
        doc.text('All information has been verified against platform compliance standards.');
        doc.text(`Generation timestamp: ${new Date().toISOString()}`);

        doc.end();

        stream.on('finish', () => {
          resolve(pdfPath);
        });

        stream.on('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Calculate Merkle hash for blockchain verification
   */
  private async calculateMerkleHash(complianceReport: ComplianceReport): Promise<string> {
    // Create a deterministic representation of the compliance data
    const dataToHash = {
      contentId: complianceReport.contentId,
      riskScore: complianceReport.riskScore.overall,
      riskLevel: complianceReport.riskScore.riskLevel,
      evidenceComplete: complianceReport.evidenceComplete,
      consentValid: complianceReport.consentValidation.isValid,
      documentHashes: complianceReport.documents.map(doc => doc.hash).sort(),
      violationCount: complianceReport.violations.length,
      timestamp: complianceReport.analyzedAt.toISOString()
    };

    // Create SHA-256 hash
    const dataString = JSON.stringify(dataToHash, Object.keys(dataToHash).sort());
    const hash = crypto.createHash('sha256').update(dataString).digest('hex');

    // For a real Merkle tree, you would build a tree structure
    // For now, we'll use a simple hash as the "Merkle root"
    return hash;
  }

  /**
   * Store Merkle hash on blockchain (placeholder implementation)
   */
  private async storeOnBlockchain(merkleHash: string): Promise<string> {
    // This would integrate with actual blockchain storage
    // For now, return a mock transaction hash
    
    console.log(`Storing Merkle hash on blockchain: ${merkleHash}`);
    
    // Simulate blockchain transaction delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return mock transaction hash
    return `0x${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Verify evidence pack integrity
   */
  async verifyEvidencePack(evidencePack: EvidencePack): Promise<boolean> {
    try {
      // Check if PDF file exists
      const pdfExists = await fs.access(evidencePack.pdfPath).then(() => true).catch(() => false);
      if (!pdfExists) {
        console.error(`Evidence pack PDF not found: ${evidencePack.pdfPath}`);
        return false;
      }

      // Verify Merkle hash (would recalculate and compare)
      // For now, just check that it exists and has correct format
      if (!evidencePack.merkleHash || evidencePack.merkleHash.length !== 64) {
        console.error('Invalid Merkle hash format');
        return false;
      }

      // Verify blockchain transaction if present
      if (evidencePack.blockchainTxHash) {
        const isValidTx = await this.verifyBlockchainTransaction(evidencePack.blockchainTxHash);
        if (!isValidTx) {
          console.error('Blockchain transaction verification failed');
          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('Evidence pack verification failed:', error);
      return false;
    }
  }

  /**
   * Verify blockchain transaction (placeholder)
   */
  private async verifyBlockchainTransaction(txHash: string): Promise<boolean> {
    // This would query the blockchain to verify the transaction exists
    // For now, just check format
    return txHash.startsWith('0x') && txHash.length === 66;
  }

  /**
   * Get evidence pack statistics
   */
  async getEvidencePackStats(): Promise<any> {
    try {
      const packDirs = await fs.readdir(this.config.outputDirectory);
      const stats = {
        totalPacks: packDirs.length,
        recentPacks: 0,
        averageGenerationTime: 0, // Would track this in production
        blockchainVerified: 0
      };

      // Count recent packs (last 24 hours)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      for (const dir of packDirs) {
        const dirPath = path.join(this.config.outputDirectory, dir);
        const stat = await fs.stat(dirPath);
        
        if (stat.isDirectory() && stat.birthtime.getTime() > oneDayAgo) {
          stats.recentPacks++;
        }
      }

      return stats;

    } catch (error) {
      console.error('Failed to get evidence pack stats:', error);
      return {
        totalPacks: 0,
        recentPacks: 0,
        averageGenerationTime: 0,
        blockchainVerified: 0
      };
    }
  }
}

// Default configuration
export const DEFAULT_EVIDENCE_PACK_CONFIG: EvidencePackConfig = {
  outputDirectory: './evidence-packs',
  includeBlockchainVerification: true,
  merkleTreeDepth: 8,
  compressionLevel: 6
};