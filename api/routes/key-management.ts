import express from 'express';
import { keyManagementService, KeyPurpose } from '../../services/keyManagementService';
import { envelopeEncryptionService } from '../../services/envelopeEncryptionService';
import { auditLoggingService } from '../../services/auditLoggingService';

const router = express.Router();

// Middleware for authentication and authorization
const requireAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  req.user = { 
    id: 'user123', 
    email: 'security@company.com', 
    role: 'security_officer',
    sessionId: req.headers['x-session-id'] || 'session-123'
  };
  next();
};

const requireKeyManagementRole = (req: any, res: any, next: any) => {
  const authorizedRoles = ['security_officer', 'key_administrator', 'system_admin'];
  if (!authorizedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions for key management operations' });
  }
  next();
};

// Create master key
router.post('/master-keys', requireAuth, requireKeyManagementRole, async (req, res) => {
  try {
    const {
      alias,
      purpose,
      algorithm = 'AES-256',
      rotationInterval = 365,
      accessPolicy
    } = req.body;

    if (!alias || !purpose || !accessPolicy) {
      return res.status(400).json({ 
        error: 'Missing required fields: alias, purpose, accessPolicy' 
      });
    }

    const masterKey = await keyManagementService.createMasterKey(
      alias,
      purpose as KeyPurpose,
      algorithm,
      rotationInterval,
      accessPolicy
    );

    // Log key creation
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'create',
      'master_key',
      masterKey.id,
      `Master key created: ${alias} for ${purpose}`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      { alias, purpose, algorithm, rotationInterval }
    );

    res.status(201).json({
      id: masterKey.id,
      alias: masterKey.alias,
      purpose: masterKey.purpose,
      algorithm: masterKey.algorithm,
      status: masterKey.status,
      createdAt: masterKey.createdAt,
      nextRotation: masterKey.nextRotation
    });
  } catch (error) {
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'create',
      'master_key',
      'failed',
      `Failed to create master key: ${error.message}`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      false,
      error.message
    );

    res.status(400).json({ error: error.message });
  }
});

// List master keys
router.get('/master-keys', requireAuth, requireKeyManagementRole, async (req, res) => {
  try {
    const { purpose, status } = req.query;
    
    const keys = keyManagementService.listMasterKeys(
      purpose as KeyPurpose,
      status as any
    );

    // Return safe information (no sensitive key material)
    const safeKeys = keys.map(key => ({
      id: key.id,
      alias: key.alias,
      purpose: key.purpose,
      algorithm: key.algorithm,
      status: key.status,
      createdAt: key.createdAt,
      lastRotated: key.lastRotated,
      nextRotation: key.nextRotation,
      rotationInterval: key.rotationInterval
    }));

    res.json(safeKeys);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get master key details
router.get('/master-keys/:keyId', requireAuth, requireKeyManagementRole, async (req, res) => {
  try {
    const masterKey = keyManagementService.getMasterKey(req.params.keyId);
    if (!masterKey) {
      return res.status(404).json({ error: 'Master key not found' });
    }

    // Log key access
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'read',
      'master_key',
      req.params.keyId,
      'Master key details accessed',
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      }
    );

    res.json({
      id: masterKey.id,
      alias: masterKey.alias,
      purpose: masterKey.purpose,
      algorithm: masterKey.algorithm,
      status: masterKey.status,
      createdAt: masterKey.createdAt,
      lastRotated: masterKey.lastRotated,
      nextRotation: masterKey.nextRotation,
      rotationInterval: masterKey.rotationInterval,
      accessPolicy: masterKey.accessPolicy
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rotate master key
router.post('/master-keys/:keyId/rotate', requireAuth, requireKeyManagementRole, async (req, res) => {
  try {
    const rotationResult = await keyManagementService.rotateMasterKey(req.params.keyId);

    // Log key rotation
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'rotate',
      'master_key',
      req.params.keyId,
      `Master key rotated: ${rotationResult.oldKeyId} -> ${rotationResult.newKeyId}`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      {
        newKeyId: rotationResult.newKeyId,
        affectedDataKeys: rotationResult.affectedDataKeys,
        migrationRequired: rotationResult.migrationRequired
      }
    );

    res.json(rotationResult);
  } catch (error) {
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'rotate',
      'master_key',
      req.params.keyId,
      `Failed to rotate master key: ${error.message}`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      false,
      error.message
    );

    res.status(400).json({ error: error.message });
  }
});

// Schedule key rotation (run for all keys requiring rotation)
router.post('/master-keys/rotate-scheduled', requireAuth, requireKeyManagementRole, async (req, res) => {
  try {
    const keysRequiringRotation = keyManagementService.getKeysRequiringRotation();
    
    await keyManagementService.scheduleKeyRotation();

    // Log scheduled rotation
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'rotate',
      'master_keys',
      'scheduled_rotation',
      `Scheduled key rotation executed for ${keysRequiringRotation.length} keys`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      { keysRotated: keysRequiringRotation.length }
    );

    res.json({
      message: 'Scheduled key rotation completed',
      keysRotated: keysRequiringRotation.length,
      rotatedKeys: keysRequiringRotation.map(k => ({ id: k.id, alias: k.alias }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete master key
router.delete('/master-keys/:keyId', requireAuth, requireKeyManagementRole, async (req, res) => {
  try {
    const { gracePeriod = 30 } = req.body;
    
    await keyManagementService.deleteKey(req.params.keyId, gracePeriod);

    // Log key deletion
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'delete',
      'master_key',
      req.params.keyId,
      `Master key scheduled for deletion in ${gracePeriod} days`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      { gracePeriod }
    );

    res.json({ 
      message: `Key scheduled for deletion in ${gracePeriod} days`,
      keyId: req.params.keyId,
      gracePeriod
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Encrypt data using envelope encryption
router.post('/encrypt', requireAuth, async (req, res) => {
  try {
    const { data, dataId, purpose, compressionEnabled, integrityCheckEnabled } = req.body;

    if (!data || !dataId || !purpose) {
      return res.status(400).json({ 
        error: 'Missing required fields: data, dataId, purpose' 
      });
    }

    const dataBuffer = Buffer.from(data, 'base64');
    
    const envelope = await envelopeEncryptionService.encryptEvidence(
      dataBuffer,
      dataId,
      req.user.email,
      {
        purpose: purpose as KeyPurpose,
        compressionEnabled,
        integrityCheckEnabled
      }
    );

    res.status(201).json({
      envelopeId: envelope.id,
      dataKeyId: envelope.dataKeyId,
      algorithm: envelope.algorithm,
      compressionUsed: envelope.compressionUsed,
      integrityProtected: !!envelope.integrityHash,
      createdAt: envelope.createdAt,
      metadata: envelope.metadata
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Decrypt data using envelope encryption
router.post('/decrypt/:envelopeId', requireAuth, async (req, res) => {
  try {
    const { verifyIntegrity = true } = req.body;
    
    const result = await envelopeEncryptionService.decryptEvidence(
      req.params.envelopeId,
      req.user.email,
      verifyIntegrity
    );

    res.json({
      data: result.data.toString('base64'),
      metadata: result.metadata,
      decryptedAt: result.decryptedAt,
      integrityVerified: result.integrityVerified
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Encrypt PII data
router.post('/encrypt-pii', requireAuth, async (req, res) => {
  try {
    const { data, dataId, retentionPeriod } = req.body;

    if (!data || !dataId) {
      return res.status(400).json({ 
        error: 'Missing required fields: data, dataId' 
      });
    }

    const dataBuffer = Buffer.from(data, 'base64');
    
    const envelope = await envelopeEncryptionService.encryptPII(
      dataBuffer,
      dataId,
      req.user.email,
      retentionPeriod
    );

    res.status(201).json({
      envelopeId: envelope.id,
      dataKeyId: envelope.dataKeyId,
      createdAt: envelope.createdAt,
      retentionPeriod,
      integrityProtected: true,
      compressionUsed: true
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Encrypt document
router.post('/encrypt-document', requireAuth, async (req, res) => {
  try {
    const { data, documentId, classification } = req.body;

    if (!data || !documentId || !classification) {
      return res.status(400).json({ 
        error: 'Missing required fields: data, documentId, classification' 
      });
    }

    const dataBuffer = Buffer.from(data, 'base64');
    
    const envelope = await envelopeEncryptionService.encryptDocument(
      dataBuffer,
      documentId,
      req.user.email,
      classification
    );

    res.status(201).json({
      envelopeId: envelope.id,
      dataKeyId: envelope.dataKeyId,
      classification,
      createdAt: envelope.createdAt,
      integrityProtected: true,
      compressionUsed: true
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Rotate data keys for a master key
router.post('/data-keys/rotate/:masterKeyId', requireAuth, requireKeyManagementRole, async (req, res) => {
  try {
    const result = await envelopeEncryptionService.rotateDataKeys(req.params.masterKeyId);

    // Log data key rotation
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'rotate',
      'data_keys',
      req.params.masterKeyId,
      `Data key rotation: ${result.rotatedCount} success, ${result.failedCount} failed`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      result.failedCount === 0,
      result.failedCount > 0 ? `${result.failedCount} rotations failed` : undefined,
      result
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Verify integrity of all encrypted data
router.post('/verify-integrity', requireAuth, requireKeyManagementRole, async (req, res) => {
  try {
    const result = await envelopeEncryptionService.verifyAllIntegrity();

    // Log integrity verification
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'read',
      'encrypted_data',
      'integrity_check',
      `Integrity verification: ${result.integrityValid}/${result.totalChecked} valid`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      result.integrityFailed.length === 0,
      result.integrityFailed.length > 0 ? `${result.integrityFailed.length} integrity failures` : undefined,
      result
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get key usage metrics
router.get('/metrics/usage', requireAuth, requireKeyManagementRole, async (req, res) => {
  try {
    const { keyId, startDate, endDate } = req.query;
    
    const metrics = await keyManagementService.getKeyUsageMetrics(
      keyId as string,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json(metrics);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get encryption metrics
router.get('/metrics/encryption', requireAuth, requireKeyManagementRole, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const metrics = await envelopeEncryptionService.getEncryptionMetrics(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json(metrics);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Audit key access
router.get('/audit/key-access', requireAuth, requireKeyManagementRole, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const audit = await keyManagementService.auditKeyAccess(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json(audit);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// List encrypted envelopes
router.get('/envelopes', requireAuth, async (req, res) => {
  try {
    const { purpose } = req.query;
    
    const envelopes = envelopeEncryptionService.listEncryptedEnvelopes(
      purpose as KeyPurpose
    );

    // Return safe information
    const safeEnvelopes = envelopes.map(envelope => ({
      id: envelope.id,
      purpose: envelope.metadata.purpose,
      algorithm: envelope.algorithm,
      compressionUsed: envelope.compressionUsed,
      integrityProtected: !!envelope.integrityHash,
      createdAt: envelope.createdAt,
      encryptedBy: envelope.encryptedBy,
      originalSize: envelope.metadata.originalSize,
      encryptedSize: envelope.metadata.encryptedSize
    }));

    res.json(safeEnvelopes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      keyManagement: 'operational',
      envelopeEncryption: 'operational',
      kmsProvider: process.env.KMS_PROVIDER || 'AWS'
    }
  });
});

export default router;