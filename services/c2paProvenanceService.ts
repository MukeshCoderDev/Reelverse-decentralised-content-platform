import { createHash, createSign, createVerify } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface C2PAManifest {
  id: string;
  contentId: string;
  title: string;
  format: string;
  instanceId: string;
  claimGenerator: string;
  claimGeneratorInfo: ClaimGeneratorInfo;
  assertions: C2PAAssertion[];
  signature: string;
  createdAt: Date;
}

export interface ClaimGeneratorInfo {
  name: string;
  version: string;
  icon?: string;
}

export interface C2PAAssertion {
  label: string;
  data: any;
  kind: 'c2pa.actions' | 'c2pa.creative_work' | 'c2pa.hash.data' | 'c2pa.metadata' | 'stds.exif';
}

export interface DeviceAttestation {
  deviceId: string;
  deviceType: 'mobile' | 'desktop' | 'camera' | 'unknown';
  manufacturer?: string;
  model?: string;
  osVersion?: string;
  appVersion?: string;
  attestationSignature: string;
  trustedEnvironment: boolean;
  biometricAuth: boolean;
  locationData?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: Date;
  };
}

export interface ProvenanceRecord {
  id: string;
  contentId: string;
  c2paManifest: C2PAManifest;
  deviceAttestation: DeviceAttestation;
  uploadMetadata: {
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
    fileHash: string;
    originalFilename: string;
  };
  verificationStatus: 'verified' | 'unverified' | 'tampered' | 'unknown';
  trustScore: number; // 0-100
}

export interface ProvenanceBadge {
  level: 'verified' | 'attested' | 'basic' | 'none';
  icon: string;
  description: string;
  trustIndicators: string[];
}

export class C2PAProvenanceService {
  private readonly provenanceDatabase = new Map<string, ProvenanceRecord>();
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor() {
    // In production, these would be loaded from secure key management
    this.privateKey = process.env.C2PA_PRIVATE_KEY || 'mock_private_key';
    this.publicKey = process.env.C2PA_PUBLIC_KEY || 'mock_public_key';
  }

  /**
   * Capture C2PA metadata during content upload
   */
  async captureProvenance(
    contentId: string,
    fileBuffer: Buffer,
    uploadMetadata: {
      ipAddress: string;
      userAgent: string;
      originalFilename: string;
    },
    deviceAttestation?: DeviceAttestation
  ): Promise<ProvenanceRecord> {
    const recordId = uuidv4();
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
    
    // Create C2PA manifest
    const manifest = await this.createC2PAManifest(contentId, fileBuffer, uploadMetadata);
    
    // Create device attestation if not provided
    const attestation = deviceAttestation || await this.createBasicAttestation(uploadMetadata.userAgent);
    
    // Calculate trust score
    const trustScore = this.calculateTrustScore(manifest, attestation, uploadMetadata);
    
    // Determine verification status
    const verificationStatus = this.determineVerificationStatus(manifest, attestation);
    
    const provenanceRecord: ProvenanceRecord = {
      id: recordId,
      contentId,
      c2paManifest: manifest,
      deviceAttestation: attestation,
      uploadMetadata: {
        ...uploadMetadata,
        timestamp: new Date(),
        fileHash
      },
      verificationStatus,
      trustScore
    };
    
    // Store provenance record
    this.provenanceDatabase.set(recordId, provenanceRecord);
    
    console.log(`Captured C2PA provenance for content ${contentId} with trust score ${trustScore}`);
    return provenanceRecord;
  }

  /**
   * Create C2PA manifest with assertions
   */
  private async createC2PAManifest(
    contentId: string,
    fileBuffer: Buffer,
    uploadMetadata: any
  ): Promise<C2PAManifest> {
    const manifestId = uuidv4();
    const instanceId = uuidv4();
    
    // Create assertions
    const assertions: C2PAAssertion[] = [
      // Actions assertion - what was done to the content
      {
        label: 'c2pa.actions',
        kind: 'c2pa.actions',
        data: {
          actions: [
            {
              action: 'c2pa.created',
              when: new Date().toISOString(),
              softwareAgent: 'DecentralizedAdultPlatform/1.0',
              digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia'
            }
          ]
        }
      },
      
      // Creative work assertion - metadata about the content
      {
        label: 'c2pa.creative_work',
        kind: 'c2pa.creative_work',
        data: {
          author: [
            {
              name: 'Content Creator',
              identifier: contentId
            }
          ],
          dateCreated: new Date().toISOString(),
          license: 'https://platform.example.com/license'
        }
      },
      
      // Hash assertion - integrity verification
      {
        label: 'c2pa.hash.data',
        kind: 'c2pa.hash.data',
        data: {
          exclusions: [],
          hash: createHash('sha256').update(fileBuffer).digest('hex'),
          alg: 'sha256'
        }
      },
      
      // Metadata assertion - technical details
      {
        label: 'c2pa.metadata',
        kind: 'c2pa.metadata',
        data: {
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          name: uploadMetadata.originalFilename,
          uploadDate: new Date().toISOString(),
          contentSize: fileBuffer.length,
          encodingFormat: this.detectMimeType(uploadMetadata.originalFilename)
        }
      }
    ];
    
    // Create manifest data for signing
    const manifestData = {
      id: manifestId,
      contentId,
      title: uploadMetadata.originalFilename,
      format: 'application/c2pa',
      instanceId,
      claimGenerator: 'DecentralizedAdultPlatform/1.0',
      claimGeneratorInfo: {
        name: 'Decentralized Adult Platform',
        version: '1.0.0',
        icon: 'https://platform.example.com/icon.png'
      },
      assertions,
      createdAt: new Date()
    };
    
    // Sign the manifest
    const signature = this.signManifest(manifestData);
    
    return {
      ...manifestData,
      signature
    };
  }

  /**
   * Create device attestation from user agent and other signals
   */
  private async createBasicAttestation(userAgent: string): Promise<DeviceAttestation> {
    const deviceId = createHash('sha256').update(userAgent).digest('hex').slice(0, 16);
    
    // Parse device info from user agent
    const deviceInfo = this.parseUserAgent(userAgent);
    
    // Create attestation signature
    const attestationData = {
      deviceId,
      userAgent,
      timestamp: new Date().toISOString()
    };
    
    const attestationSignature = createHash('sha256')
      .update(JSON.stringify(attestationData))
      .digest('hex');
    
    return {
      deviceId,
      deviceType: deviceInfo.deviceType,
      manufacturer: deviceInfo.manufacturer,
      model: deviceInfo.model,
      osVersion: deviceInfo.osVersion,
      appVersion: deviceInfo.appVersion,
      attestationSignature,
      trustedEnvironment: false, // Basic attestation is not from trusted environment
      biometricAuth: false
    };
  }

  /**
   * Create enhanced device attestation for mobile uploads
   */
  async createMobileAttestation(
    deviceInfo: {
      deviceId: string;
      manufacturer: string;
      model: string;
      osVersion: string;
      appVersion: string;
    },
    securityFeatures: {
      trustedEnvironment: boolean;
      biometricAuth: boolean;
      locationData?: {
        latitude: number;
        longitude: number;
        accuracy: number;
      };
    }
  ): Promise<DeviceAttestation> {
    // Create attestation signature with device-specific data
    const attestationData = {
      ...deviceInfo,
      ...securityFeatures,
      timestamp: new Date().toISOString()
    };
    
    const attestationSignature = createHash('sha256')
      .update(JSON.stringify(attestationData) + this.privateKey)
      .digest('hex');
    
    return {
      deviceId: deviceInfo.deviceId,
      deviceType: 'mobile',
      manufacturer: deviceInfo.manufacturer,
      model: deviceInfo.model,
      osVersion: deviceInfo.osVersion,
      appVersion: deviceInfo.appVersion,
      attestationSignature,
      trustedEnvironment: securityFeatures.trustedEnvironment,
      biometricAuth: securityFeatures.biometricAuth,
      locationData: securityFeatures.locationData ? {
        ...securityFeatures.locationData,
        timestamp: new Date()
      } : undefined
    };
  }

  /**
   * Verify C2PA manifest and provenance
   */
  async verifyProvenance(provenanceId: string): Promise<{
    isValid: boolean;
    trustScore: number;
    issues: string[];
    badge: ProvenanceBadge;
  }> {
    const record = this.provenanceDatabase.get(provenanceId);
    
    if (!record) {
      return {
        isValid: false,
        trustScore: 0,
        issues: ['Provenance record not found'],
        badge: this.getProvenanceBadge('none')
      };
    }
    
    const issues: string[] = [];
    let isValid = true;
    
    // Verify C2PA manifest signature
    if (!this.verifyManifestSignature(record.c2paManifest)) {
      issues.push('Invalid C2PA manifest signature');
      isValid = false;
    }
    
    // Verify device attestation
    if (!this.verifyDeviceAttestation(record.deviceAttestation)) {
      issues.push('Invalid device attestation');
      isValid = false;
    }
    
    // Check for tampering indicators
    const tamperingCheck = await this.checkForTampering(record);
    if (!tamperingCheck.isClean) {
      issues.push(...tamperingCheck.issues);
      isValid = false;
    }
    
    // Recalculate trust score
    const trustScore = isValid ? record.trustScore : Math.max(0, record.trustScore - 50);
    
    // Determine badge level
    const badge = this.getProvenanceBadge(
      isValid && trustScore >= 80 ? 'verified' :
      isValid && trustScore >= 60 ? 'attested' :
      isValid ? 'basic' : 'none'
    );
    
    return {
      isValid,
      trustScore,
      issues,
      badge
    };
  }

  /**
   * Get provenance badge for display
   */
  private getProvenanceBadge(level: ProvenanceBadge['level']): ProvenanceBadge {
    switch (level) {
      case 'verified':
        return {
          level: 'verified',
          icon: '🛡️',
          description: 'Provenance Verified',
          trustIndicators: [
            'C2PA manifest verified',
            'Device attestation confirmed',
            'No tampering detected',
            'High trust score'
          ]
        };
      
      case 'attested':
        return {
          level: 'attested',
          icon: '✅',
          description: 'Device Attested',
          trustIndicators: [
            'Device attestation present',
            'Basic provenance data',
            'Medium trust score'
          ]
        };
      
      case 'basic':
        return {
          level: 'basic',
          icon: '📋',
          description: 'Basic Metadata',
          trustIndicators: [
            'Upload metadata captured',
            'Basic integrity checks'
          ]
        };
      
      default:
        return {
          level: 'none',
          icon: '❓',
          description: 'No Provenance Data',
          trustIndicators: []
        };
    }
  }

  /**
   * Get provenance record by content ID
   */
  async getProvenanceByContentId(contentId: string): Promise<ProvenanceRecord | null> {
    for (const record of this.provenanceDatabase.values()) {
      if (record.contentId === contentId) {
        return record;
      }
    }
    return null;
  }

  /**
   * List all provenance records with pagination
   */
  async listProvenanceRecords(
    offset: number = 0,
    limit: number = 50
  ): Promise<{
    records: ProvenanceRecord[];
    total: number;
  }> {
    const allRecords = Array.from(this.provenanceDatabase.values())
      .sort((a, b) => b.uploadMetadata.timestamp.getTime() - a.uploadMetadata.timestamp.getTime());
    
    return {
      records: allRecords.slice(offset, offset + limit),
      total: allRecords.length
    };
  }

  // Private helper methods
  private signManifest(manifestData: any): string {
    const dataString = JSON.stringify(manifestData);
    return createHash('sha256').update(dataString + this.privateKey).digest('hex');
  }

  private verifyManifestSignature(manifest: C2PAManifest): boolean {
    const { signature, ...manifestData } = manifest;
    const expectedSignature = this.signManifest(manifestData);
    return signature === expectedSignature;
  }

  private verifyDeviceAttestation(attestation: DeviceAttestation): boolean {
    // In production, this would verify against device certificate chains
    return attestation.attestationSignature.length > 0;
  }

  private async checkForTampering(record: ProvenanceRecord): Promise<{
    isClean: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Check if hash assertion matches current content
    const hashAssertion = record.c2paManifest.assertions.find(a => a.kind === 'c2pa.hash.data');
    if (hashAssertion && hashAssertion.data.hash !== record.uploadMetadata.fileHash) {
      issues.push('Content hash mismatch - possible tampering');
    }
    
    // Check timestamp consistency
    const manifestTime = record.c2paManifest.createdAt.getTime();
    const uploadTime = record.uploadMetadata.timestamp.getTime();
    if (Math.abs(manifestTime - uploadTime) > 60000) { // 1 minute tolerance
      issues.push('Timestamp inconsistency detected');
    }
    
    return {
      isClean: issues.length === 0,
      issues
    };
  }

  private calculateTrustScore(
    manifest: C2PAManifest,
    attestation: DeviceAttestation,
    uploadMetadata: any
  ): number {
    let score = 50; // Base score
    
    // C2PA manifest quality
    if (manifest.assertions.length >= 4) score += 20;
    if (manifest.signature) score += 10;
    
    // Device attestation quality
    if (attestation.trustedEnvironment) score += 15;
    if (attestation.biometricAuth) score += 10;
    if (attestation.locationData) score += 5;
    
    // Upload metadata quality
    if (uploadMetadata.originalFilename) score += 5;
    
    return Math.min(100, Math.max(0, score));
  }

  private determineVerificationStatus(
    manifest: C2PAManifest,
    attestation: DeviceAttestation
  ): ProvenanceRecord['verificationStatus'] {
    if (attestation.trustedEnvironment && manifest.signature) {
      return 'verified';
    } else if (manifest.signature) {
      return 'unverified';
    } else {
      return 'unknown';
    }
  }

  private parseUserAgent(userAgent: string): {
    deviceType: DeviceAttestation['deviceType'];
    manufacturer?: string;
    model?: string;
    osVersion?: string;
    appVersion?: string;
  } {
    // Basic user agent parsing
    const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
    const isDesktop = /Windows|Mac|Linux/.test(userAgent);
    
    return {
      deviceType: isMobile ? 'mobile' : isDesktop ? 'desktop' : 'unknown',
      manufacturer: userAgent.includes('iPhone') ? 'Apple' : 
                   userAgent.includes('Samsung') ? 'Samsung' : undefined,
      osVersion: this.extractOSVersion(userAgent),
      appVersion: this.extractAppVersion(userAgent)
    };
  }

  private extractOSVersion(userAgent: string): string | undefined {
    const match = userAgent.match(/(?:Windows NT|Mac OS X|Android|iOS) ([\d._]+)/);
    return match ? match[1] : undefined;
  }

  private extractAppVersion(userAgent: string): string | undefined {
    const match = userAgent.match(/DecentralizedAdultPlatform\/([\d.]+)/);
    return match ? match[1] : undefined;
  }

  private detectMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'mp4': return 'video/mp4';
      case 'webm': return 'video/webm';
      case 'mov': return 'video/quicktime';
      case 'avi': return 'video/x-msvideo';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      default: return 'application/octet-stream';
    }
  }
}

export const c2paProvenanceService = new C2PAProvenanceService();