import { v4 as uuidv4 } from 'uuid';

export interface LegalDocument {
  id: string;
  type: 'evidence_package' | 'lea_response' | 'takedown_notice' | 'court_order' | 'compliance_report';
  title: string;
  description: string;
  classification: 'public' | 'confidential' | 'restricted' | 'top_secret';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  metadata: Record<string, any>;
  accessLog: AccessLogEntry[];
  encryptionKeyId?: string;
  storageLocation: string;
  checksum: string;
}

export interface AccessLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  action: 'view' | 'download' | 'edit' | 'delete' | 'share';
  ipAddress: string;
  userAgent: string;
  success: boolean;
  reason?: string;
}

export interface EvidencePackage {
  id: string;
  incidentId: string;
  caseNumber: string;
  createdBy: string;
  createdAt: Date;
  contents: EvidenceItem[];
  chainOfCustody: ChainOfCustodyEntry[];
  legalHold: boolean;
  retentionPeriod: number; // days
  accessRestrictions: string[];
  merkleRoot?: string;
  blockchainAnchor?: string;
}

export interface EvidenceItem {
  id: string;
  type: 'user_data' | 'content' | 'transaction' | 'log' | 'communication' | 'metadata';
  description: string;
  originalLocation: string;
  preservedAt: Date;
  checksum: string;
  encryptionKeyId: string;
  size: number;
  metadata: Record<string, any>;
}

export interface ChainOfCustodyEntry {
  id: string;
  timestamp: Date;
  action: 'created' | 'accessed' | 'transferred' | 'modified' | 'verified';
  performedBy: string;
  details: string;
  digitalSignature: string;
}

export class LegalDocumentService {
  private documents: Map<string, LegalDocument> = new Map();
  private evidencePackages: Map<string, EvidencePackage> = new Map();
  private authorizedPersonnel: Set<string> = new Set([
    'legal@company.com',
    'compliance@company.com',
    'security@company.com'
  ]);

  async createLegalDocument(
    type: LegalDocument['type'],
    title: string,
    description: string,
    classification: LegalDocument['classification'],
    createdBy: string,
    content: Buffer,
    metadata: Record<string, any> = {}
  ): Promise<LegalDocument> {
    const documentId = uuidv4();
    const checksum = this.calculateChecksum(content);
    
    // Encrypt sensitive documents
    let encryptionKeyId: string | undefined;
    if (classification !== 'public') {
      encryptionKeyId = await this.encryptDocument(documentId, content);
    }

    const document: LegalDocument = {
      id: documentId,
      type,
      title,
      description,
      classification,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
      accessLog: [],
      encryptionKeyId,
      storageLocation: `legal-docs/${documentId}`,
      checksum
    };

    // Set retention period based on document type
    if (type === 'evidence_package') {
      document.expiresAt = new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000); // 7 years
    }

    this.documents.set(documentId, document);
    
    await this.logAccess(documentId, createdBy, 'view', '127.0.0.1', 'system', true);
    
    return document;
  }

  async createEvidencePackage(
    incidentId: string,
    caseNumber: string,
    createdBy: string,
    evidenceItems: Omit<EvidenceItem, 'id' | 'encryptionKeyId'>[],
    accessRestrictions: string[] = []
  ): Promise<EvidencePackage> {
    if (!this.authorizedPersonnel.has(createdBy)) {
      throw new Error('Unauthorized: Only authorized personnel can create evidence packages');
    }

    const packageId = uuidv4();
    
    // Process and encrypt evidence items
    const processedItems: EvidenceItem[] = [];
    for (const item of evidenceItems) {
      const itemId = uuidv4();
      const encryptionKeyId = await this.encryptEvidenceItem(itemId, item);
      
      processedItems.push({
        ...item,
        id: itemId,
        encryptionKeyId
      });
    }

    const evidencePackage: EvidencePackage = {
      id: packageId,
      incidentId,
      caseNumber,
      createdBy,
      createdAt: new Date(),
      contents: processedItems,
      chainOfCustody: [],
      legalHold: true,
      retentionPeriod: 2555, // 7 years in days
      accessRestrictions: [...accessRestrictions, ...Array.from(this.authorizedPersonnel)]
    };

    // Add initial chain of custody entry
    await this.addChainOfCustodyEntry(
      packageId,
      'created',
      createdBy,
      `Evidence package created for incident ${incidentId}`
    );

    // Generate Merkle root for integrity verification
    evidencePackage.merkleRoot = await this.generateMerkleRoot(processedItems);
    
    // Anchor to blockchain (mock implementation)
    evidencePackage.blockchainAnchor = await this.anchorToBlockchain(evidencePackage.merkleRoot);

    this.evidencePackages.set(packageId, evidencePackage);

    // Create associated legal document
    await this.createLegalDocument(
      'evidence_package',
      `Evidence Package - Case ${caseNumber}`,
      `Evidence package for incident ${incidentId}`,
      'restricted',
      createdBy,
      Buffer.from(JSON.stringify(evidencePackage)),
      { incidentId, caseNumber, packageId }
    );

    return evidencePackage;
  }

  async accessDocument(
    documentId: string,
    userId: string,
    action: AccessLogEntry['action'],
    ipAddress: string,
    userAgent: string
  ): Promise<LegalDocument> {
    const document = this.documents.get(documentId);
    if (!document) {
      await this.logAccess(documentId, userId, action, ipAddress, userAgent, false, 'Document not found');
      throw new Error('Document not found');
    }

    // Check access permissions
    const hasAccess = await this.checkAccess(document, userId);
    if (!hasAccess) {
      await this.logAccess(documentId, userId, action, ipAddress, userAgent, false, 'Access denied');
      throw new Error('Access denied');
    }

    await this.logAccess(documentId, userId, action, ipAddress, userAgent, true);
    
    return document;
  }

  async accessEvidencePackage(
    packageId: string,
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<EvidencePackage> {
    const evidencePackage = this.evidencePackages.get(packageId);
    if (!evidencePackage) {
      throw new Error('Evidence package not found');
    }

    // Strict access control for evidence packages
    if (!evidencePackage.accessRestrictions.includes(userId)) {
      throw new Error('Access denied: Insufficient permissions for evidence package');
    }

    // Add chain of custody entry
    await this.addChainOfCustodyEntry(
      packageId,
      'accessed',
      userId,
      `Evidence package accessed from ${ipAddress}`
    );

    return evidencePackage;
  }

  async transferEvidencePackage(
    packageId: string,
    fromUserId: string,
    toUserId: string,
    reason: string
  ): Promise<void> {
    const evidencePackage = this.evidencePackages.get(packageId);
    if (!evidencePackage) {
      throw new Error('Evidence package not found');
    }

    if (!evidencePackage.accessRestrictions.includes(fromUserId)) {
      throw new Error('Access denied: Cannot transfer evidence package');
    }

    // Add recipient to access restrictions
    if (!evidencePackage.accessRestrictions.includes(toUserId)) {
      evidencePackage.accessRestrictions.push(toUserId);
    }

    await this.addChainOfCustodyEntry(
      packageId,
      'transferred',
      fromUserId,
      `Evidence package transferred to ${toUserId}: ${reason}`
    );

    this.evidencePackages.set(packageId, evidencePackage);
  }

  async verifyEvidenceIntegrity(packageId: string): Promise<boolean> {
    const evidencePackage = this.evidencePackages.get(packageId);
    if (!evidencePackage) {
      throw new Error('Evidence package not found');
    }

    // Recalculate Merkle root
    const currentMerkleRoot = await this.generateMerkleRoot(evidencePackage.contents);
    
    // Verify against stored Merkle root
    const integrityValid = currentMerkleRoot === evidencePackage.merkleRoot;

    await this.addChainOfCustodyEntry(
      packageId,
      'verified',
      'system',
      `Integrity verification: ${integrityValid ? 'PASSED' : 'FAILED'}`
    );

    return integrityValid;
  }

  async generateLEAResponse(
    leaRequestId: string,
    responseData: any,
    createdBy: string
  ): Promise<LegalDocument> {
    const responseContent = {
      leaRequestId,
      responseDate: new Date(),
      responseData,
      legalDisclaimer: 'This response is provided in compliance with applicable laws and regulations.',
      contactInfo: {
        legalDepartment: 'legal@company.com',
        phone: '+1-555-0123'
      }
    };

    return await this.createLegalDocument(
      'lea_response',
      `LEA Response - ${leaRequestId}`,
      'Response to law enforcement agency request',
      'confidential',
      createdBy,
      Buffer.from(JSON.stringify(responseContent)),
      { leaRequestId }
    );
  }

  private async checkAccess(document: LegalDocument, userId: string): Promise<boolean> {
    // Public documents are accessible to all
    if (document.classification === 'public') {
      return true;
    }

    // Restricted and top secret documents require authorization
    if (document.classification === 'restricted' || document.classification === 'top_secret') {
      return this.authorizedPersonnel.has(userId);
    }

    // Confidential documents have additional checks
    if (document.classification === 'confidential') {
      return this.authorizedPersonnel.has(userId) || document.createdBy === userId;
    }

    return false;
  }

  private async logAccess(
    documentId: string,
    userId: string,
    action: AccessLogEntry['action'],
    ipAddress: string,
    userAgent: string,
    success: boolean,
    reason?: string
  ): Promise<void> {
    const document = this.documents.get(documentId);
    if (!document) return;

    const logEntry: AccessLogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      userId,
      action,
      ipAddress,
      userAgent,
      success,
      reason
    };

    document.accessLog.push(logEntry);
    document.updatedAt = new Date();
    this.documents.set(documentId, document);
  }

  private async addChainOfCustodyEntry(
    packageId: string,
    action: ChainOfCustodyEntry['action'],
    performedBy: string,
    details: string
  ): Promise<void> {
    const evidencePackage = this.evidencePackages.get(packageId);
    if (!evidencePackage) return;

    const entry: ChainOfCustodyEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      action,
      performedBy,
      details,
      digitalSignature: this.generateDigitalSignature(packageId, action, performedBy, details)
    };

    evidencePackage.chainOfCustody.push(entry);
    this.evidencePackages.set(packageId, evidencePackage);
  }

  private calculateChecksum(content: Buffer): string {
    // Mock implementation - would use crypto.createHash in real implementation
    return `sha256-${content.length}-${Date.now()}`;
  }

  private async encryptDocument(documentId: string, content: Buffer): Promise<string> {
    // Mock implementation - would integrate with KMS
    const keyId = `doc-key-${documentId}`;
    console.log(`Document ${documentId} encrypted with key ${keyId}`);
    return keyId;
  }

  private async encryptEvidenceItem(itemId: string, item: Omit<EvidenceItem, 'id' | 'encryptionKeyId'>): Promise<string> {
    // Mock implementation - would integrate with KMS
    const keyId = `evidence-key-${itemId}`;
    console.log(`Evidence item ${itemId} encrypted with key ${keyId}`);
    return keyId;
  }

  private async generateMerkleRoot(items: EvidenceItem[]): Promise<string> {
    // Mock implementation - would calculate actual Merkle root
    const itemHashes = items.map(item => item.checksum);
    return `merkle-${itemHashes.join('-').slice(0, 32)}`;
  }

  private async anchorToBlockchain(merkleRoot: string): Promise<string> {
    // Mock implementation - would anchor to actual blockchain
    const txHash = `0x${merkleRoot.slice(0, 64)}`;
    console.log(`Merkle root ${merkleRoot} anchored to blockchain: ${txHash}`);
    return txHash;
  }

  private generateDigitalSignature(packageId: string, action: string, performedBy: string, details: string): string {
    // Mock implementation - would use actual digital signature
    const data = `${packageId}-${action}-${performedBy}-${details}-${Date.now()}`;
    return `sig-${data.slice(0, 32)}`;
  }

  // Query methods
  async getDocument(documentId: string): Promise<LegalDocument | undefined> {
    return this.documents.get(documentId);
  }

  async getEvidencePackage(packageId: string): Promise<EvidencePackage | undefined> {
    return this.evidencePackages.get(packageId);
  }

  async getDocumentsByType(type: LegalDocument['type']): Promise<LegalDocument[]> {
    return Array.from(this.documents.values()).filter(doc => doc.type === type);
  }

  async getEvidencePackagesByIncident(incidentId: string): Promise<EvidencePackage[]> {
    return Array.from(this.evidencePackages.values()).filter(pkg => pkg.incidentId === incidentId);
  }
}

export const legalDocumentService = new LegalDocumentService();