import { C2PAProvenanceService } from '../../services/c2paProvenanceService';

describe('C2PAProvenanceService', () => {
  let service: C2PAProvenanceService;

  beforeEach(() => {
    service = new C2PAProvenanceService();
  });

  describe('captureProvenance', () => {
    it('should capture basic provenance data', async () => {
      const contentId = 'content123';
      const fileBuffer = Buffer.from('test video content');
      const uploadMetadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        originalFilename: 'test-video.mp4'
      };

      const record = await service.captureProvenance(contentId, fileBuffer, uploadMetadata);

      expect(record.id).toBeDefined();
      expect(record.contentId).toBe(contentId);
      expect(record.c2paManifest).toBeDefined();
      expect(record.deviceAttestation).toBeDefined();
      expect(record.uploadMetadata.fileHash).toBeDefined();
      expect(record.trustScore).toBeGreaterThan(0);
      expect(record.verificationStatus).toBeDefined();
    });

    it('should create C2PA manifest with required assertions', async () => {
      const contentId = 'content123';
      const fileBuffer = Buffer.from('test video content');
      const uploadMetadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        originalFilename: 'test-video.mp4'
      };

      const record = await service.captureProvenance(contentId, fileBuffer, uploadMetadata);
      const manifest = record.c2paManifest;

      expect(manifest.id).toBeDefined();
      expect(manifest.contentId).toBe(contentId);
      expect(manifest.claimGenerator).toBe('DecentralizedAdultPlatform/1.0');
      expect(manifest.assertions).toHaveLength(4);
      expect(manifest.signature).toBeDefined();

      // Check required assertion types
      const assertionTypes = manifest.assertions.map(a => a.kind);
      expect(assertionTypes).toContain('c2pa.actions');
      expect(assertionTypes).toContain('c2pa.creative_work');
      expect(assertionTypes).toContain('c2pa.hash.data');
      expect(assertionTypes).toContain('c2pa.metadata');
    });

    it('should create device attestation from user agent', async () => {
      const contentId = 'content123';
      const fileBuffer = Buffer.from('test video content');
      const uploadMetadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        originalFilename: 'test-video.mp4'
      };

      const record = await service.captureProvenance(contentId, fileBuffer, uploadMetadata);
      const attestation = record.deviceAttestation;

      expect(attestation.deviceId).toBeDefined();
      expect(attestation.deviceType).toBe('mobile');
      expect(attestation.manufacturer).toBe('Apple');
      expect(attestation.attestationSignature).toBeDefined();
      expect(attestation.trustedEnvironment).toBe(false); // Basic attestation
      expect(attestation.biometricAuth).toBe(false);
    });

    it('should calculate higher trust score for mobile attestation', async () => {
      const contentId = 'content123';
      const fileBuffer = Buffer.from('test video content');
      const uploadMetadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'DecentralizedAdultPlatform/1.0 (iPhone)',
        originalFilename: 'test-video.mp4'
      };

      const mobileAttestation = await service.createMobileAttestation(
        {
          deviceId: 'device123',
          manufacturer: 'Apple',
          model: 'iPhone 13',
          osVersion: '15.0',
          appVersion: '1.0.0'
        },
        {
          trustedEnvironment: true,
          biometricAuth: true,
          locationData: {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 10
          }
        }
      );

      const record = await service.captureProvenance(
        contentId,
        fileBuffer,
        uploadMetadata,
        mobileAttestation
      );

      expect(record.trustScore).toBeGreaterThan(80);
      expect(record.verificationStatus).toBe('verified');
    });
  });

  describe('verifyProvenance', () => {
    it('should verify valid provenance record', async () => {
      const contentId = 'content123';
      const fileBuffer = Buffer.from('test video content');
      const uploadMetadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        originalFilename: 'test-video.mp4'
      };

      const record = await service.captureProvenance(contentId, fileBuffer, uploadMetadata);
      const verification = await service.verifyProvenance(record.id);

      expect(verification.isValid).toBe(true);
      expect(verification.trustScore).toBeGreaterThan(0);
      expect(verification.issues).toHaveLength(0);
      expect(verification.badge).toBeDefined();
      expect(verification.badge.level).toBeDefined();
    });

    it('should detect invalid provenance record', async () => {
      const verification = await service.verifyProvenance('nonexistent-id');

      expect(verification.isValid).toBe(false);
      expect(verification.trustScore).toBe(0);
      expect(verification.issues).toContain('Provenance record not found');
      expect(verification.badge.level).toBe('none');
    });

    it('should return appropriate badge levels', async () => {
      const contentId = 'content123';
      const fileBuffer = Buffer.from('test video content');
      const uploadMetadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'DecentralizedAdultPlatform/1.0',
        originalFilename: 'test-video.mp4'
      };

      // Test high trust score (verified)
      const highTrustAttestation = await service.createMobileAttestation(
        {
          deviceId: 'device123',
          manufacturer: 'Apple',
          model: 'iPhone 13',
          osVersion: '15.0',
          appVersion: '1.0.0'
        },
        {
          trustedEnvironment: true,
          biometricAuth: true
        }
      );

      const highTrustRecord = await service.captureProvenance(
        contentId,
        fileBuffer,
        uploadMetadata,
        highTrustAttestation
      );

      const highTrustVerification = await service.verifyProvenance(highTrustRecord.id);
      expect(highTrustVerification.badge.level).toBe('verified');
      expect(highTrustVerification.badge.icon).toBe('🛡️');

      // Test basic attestation
      const basicRecord = await service.captureProvenance(
        'content456',
        fileBuffer,
        uploadMetadata
      );

      const basicVerification = await service.verifyProvenance(basicRecord.id);
      expect(['basic', 'attested']).toContain(basicVerification.badge.level);
    });
  });

  describe('createMobileAttestation', () => {
    it('should create enhanced mobile attestation', async () => {
      const deviceInfo = {
        deviceId: 'device123',
        manufacturer: 'Apple',
        model: 'iPhone 13 Pro',
        osVersion: '15.0',
        appVersion: '1.0.0'
      };

      const securityFeatures = {
        trustedEnvironment: true,
        biometricAuth: true,
        locationData: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5
        }
      };

      const attestation = await service.createMobileAttestation(deviceInfo, securityFeatures);

      expect(attestation.deviceId).toBe(deviceInfo.deviceId);
      expect(attestation.deviceType).toBe('mobile');
      expect(attestation.manufacturer).toBe(deviceInfo.manufacturer);
      expect(attestation.model).toBe(deviceInfo.model);
      expect(attestation.trustedEnvironment).toBe(true);
      expect(attestation.biometricAuth).toBe(true);
      expect(attestation.locationData).toBeDefined();
      expect(attestation.locationData!.latitude).toBe(37.7749);
      expect(attestation.attestationSignature).toBeDefined();
    });
  });

  describe('getProvenanceByContentId', () => {
    it('should retrieve provenance record by content ID', async () => {
      const contentId = 'content123';
      const fileBuffer = Buffer.from('test video content');
      const uploadMetadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        originalFilename: 'test-video.mp4'
      };

      const originalRecord = await service.captureProvenance(contentId, fileBuffer, uploadMetadata);
      const retrievedRecord = await service.getProvenanceByContentId(contentId);

      expect(retrievedRecord).toBeTruthy();
      expect(retrievedRecord!.id).toBe(originalRecord.id);
      expect(retrievedRecord!.contentId).toBe(contentId);
    });

    it('should return null for non-existent content', async () => {
      const record = await service.getProvenanceByContentId('nonexistent-content');
      expect(record).toBeNull();
    });
  });

  describe('listProvenanceRecords', () => {
    it('should list provenance records with pagination', async () => {
      // Create multiple records
      const fileBuffer = Buffer.from('test video content');
      const uploadMetadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        originalFilename: 'test-video.mp4'
      };

      await service.captureProvenance('content1', fileBuffer, uploadMetadata);
      await service.captureProvenance('content2', fileBuffer, uploadMetadata);
      await service.captureProvenance('content3', fileBuffer, uploadMetadata);

      const result = await service.listProvenanceRecords(0, 2);

      expect(result.records).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.records[0].contentId).toBeDefined();
    });

    it('should handle empty results', async () => {
      const result = await service.listProvenanceRecords(0, 10);

      expect(result.records).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});

describe('C2PA Integration', () => {
  let service: C2PAProvenanceService;

  beforeEach(() => {
    service = new C2PAProvenanceService();
  });

  it('should handle complete C2PA workflow', async () => {
    const contentId = 'premium-content-123';
    const fileBuffer = Buffer.from('premium video content with high quality');
    
    // Simulate mobile upload with full attestation
    const uploadMetadata = {
      ipAddress: '203.0.113.1',
      userAgent: 'DecentralizedAdultPlatform/1.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
      originalFilename: 'premium-content.mp4'
    };

    const mobileAttestation = await service.createMobileAttestation(
      {
        deviceId: 'secure-device-123',
        manufacturer: 'Apple',
        model: 'iPhone 13 Pro',
        osVersion: '15.0',
        appVersion: '1.0.0'
      },
      {
        trustedEnvironment: true,
        biometricAuth: true,
        locationData: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 3
        }
      }
    );

    // 1. Capture provenance during upload
    const provenanceRecord = await service.captureProvenance(
      contentId,
      fileBuffer,
      uploadMetadata,
      mobileAttestation
    );

    expect(provenanceRecord.trustScore).toBeGreaterThan(80);
    expect(provenanceRecord.verificationStatus).toBe('verified');

    // 2. Verify provenance for display
    const verification = await service.verifyProvenance(provenanceRecord.id);
    
    expect(verification.isValid).toBe(true);
    expect(verification.badge.level).toBe('verified');
    expect(verification.badge.trustIndicators).toContain('C2PA manifest verified');
    expect(verification.badge.trustIndicators).toContain('Device attestation confirmed');

    // 3. Retrieve by content ID
    const retrievedRecord = await service.getProvenanceByContentId(contentId);
    expect(retrievedRecord).toBeTruthy();
    expect(retrievedRecord!.id).toBe(provenanceRecord.id);

    // 4. Verify C2PA manifest structure
    const manifest = retrievedRecord!.c2paManifest;
    expect(manifest.assertions).toHaveLength(4);
    
    const hashAssertion = manifest.assertions.find(a => a.kind === 'c2pa.hash.data');
    expect(hashAssertion).toBeTruthy();
    expect(hashAssertion!.data.hash).toBeDefined();
    
    const actionsAssertion = manifest.assertions.find(a => a.kind === 'c2pa.actions');
    expect(actionsAssertion).toBeTruthy();
    expect(actionsAssertion!.data.actions[0].action).toBe('c2pa.created');

    // 5. Verify device attestation
    const attestation = retrievedRecord!.deviceAttestation;
    expect(attestation.trustedEnvironment).toBe(true);
    expect(attestation.biometricAuth).toBe(true);
    expect(attestation.locationData).toBeTruthy();
    expect(attestation.deviceType).toBe('mobile');
  });

  it('should handle degraded trust scenarios', async () => {
    const contentId = 'basic-content-123';
    const fileBuffer = Buffer.from('basic video content');
    
    // Simulate desktop upload with basic attestation
    const uploadMetadata = {
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      originalFilename: 'basic-content.mp4'
    };

    const provenanceRecord = await service.captureProvenance(
      contentId,
      fileBuffer,
      uploadMetadata
    );

    // Should have lower trust score due to basic attestation
    expect(provenanceRecord.trustScore).toBeLessThan(80);
    expect(provenanceRecord.verificationStatus).toBe('unverified');

    const verification = await service.verifyProvenance(provenanceRecord.id);
    expect(verification.badge.level).toMatch(/basic|attested/);
    expect(verification.badge.icon).toMatch(/📋|✅/);
  });
});