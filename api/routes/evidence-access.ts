import express from 'express';
import { evidenceAccessControlService } from '../../services/evidenceAccessControlService';
import { auditLoggingService } from '../../services/auditLoggingService';
import { legalDocumentService } from '../../services/legalDocumentService';

const router = express.Router();

// Middleware for authentication and authorization
const requireAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Mock user extraction - would integrate with actual auth system
  req.user = { 
    id: 'user123', 
    email: 'user@company.com', 
    role: 'compliance_officer',
    sessionId: req.headers['x-session-id'] || 'session-123'
  };
  next();
};

const requireEvidenceAccess = (req: any, res: any, next: any) => {
  const authorizedRoles = ['csam_officer', 'legal_counsel', 'compliance_officer', 'security_officer'];
  if (!authorizedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions for evidence access' });
  }
  next();
};

// Grant access to evidence or legal documents
router.post('/grant-access', requireAuth, requireEvidenceAccess, async (req, res) => {
  try {
    const {
      userId,
      resourceType,
      resourceId,
      permissions,
      reason,
      expiresAt,
      conditions
    } = req.body;

    if (!userId || !resourceType || !resourceId || !permissions || !reason) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, resourceType, resourceId, permissions, reason' 
      });
    }

    const permission = await evidenceAccessControlService.grantAccess(
      userId,
      resourceType,
      resourceId,
      permissions,
      req.user.email,
      reason,
      expiresAt ? new Date(expiresAt) : undefined,
      conditions
    );

    // Log the access grant
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'create',
      'access_permission',
      permission.id,
      `Access granted to ${userId} for ${resourceType}:${resourceId}`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      { grantedPermissions: permissions, reason, targetUser: userId }
    );

    res.status(201).json(permission);
  } catch (error) {
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'create',
      'access_permission',
      'failed',
      `Failed to grant access: ${error.message}`,
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

// Revoke access
router.post('/revoke-access/:permissionId', requireAuth, requireEvidenceAccess, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Reason for revocation is required' });
    }

    await evidenceAccessControlService.revokeAccess(
      req.params.permissionId,
      req.user.email,
      reason
    );

    // Log the access revocation
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'delete',
      'access_permission',
      req.params.permissionId,
      `Access revoked: ${reason}`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      { reason }
    );

    res.json({ success: true, message: 'Access revoked successfully' });
  } catch (error) {
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'delete',
      'access_permission',
      req.params.permissionId,
      `Failed to revoke access: ${error.message}`,
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

// Access evidence package with full audit trail
router.get('/evidence-packages/:id', requireAuth, requireEvidenceAccess, async (req, res) => {
  try {
    // Check access permissions
    const hasAccess = await evidenceAccessControlService.checkAccess(
      req.user.email,
      'evidence_package',
      req.params.id,
      'read',
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      }
    );

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to evidence package' });
    }

    // Get the evidence package
    const evidencePackage = await legalDocumentService.accessEvidencePackage(
      req.params.id,
      req.user.email,
      req.ip,
      req.get('User-Agent') || 'unknown'
    );

    // Log successful access
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'read',
      'evidence_package',
      req.params.id,
      'Evidence package accessed',
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      { packageSize: evidencePackage.contents.length }
    );

    res.json(evidencePackage);
  } catch (error) {
    // Log failed access attempt
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'read',
      'evidence_package',
      req.params.id,
      `Failed to access evidence package: ${error.message}`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      false,
      error.message
    );

    res.status(403).json({ error: error.message });
  }
});

// Download evidence item with audit trail
router.get('/evidence-packages/:packageId/items/:itemId/download', requireAuth, requireEvidenceAccess, async (req, res) => {
  try {
    // Check download permissions
    const hasAccess = await evidenceAccessControlService.checkAccess(
      req.user.email,
      'evidence_package',
      req.params.packageId,
      'read',
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      }
    );

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied for evidence download' });
    }

    // Mock evidence item download - would retrieve actual encrypted file
    const mockFileContent = Buffer.from(`Evidence item ${req.params.itemId} content`);

    // Log the download
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'download',
      'evidence_item',
      req.params.itemId,
      `Evidence item downloaded from package ${req.params.packageId}`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      { packageId: req.params.packageId, fileSize: mockFileContent.length }
    );

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="evidence-${req.params.itemId}.dat"`);
    res.send(mockFileContent);
  } catch (error) {
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'download',
      'evidence_item',
      req.params.itemId,
      `Failed to download evidence item: ${error.message}`,
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

// Transfer evidence package to another user
router.post('/evidence-packages/:id/transfer', requireAuth, requireEvidenceAccess, async (req, res) => {
  try {
    const { toUserId, reason } = req.body;

    if (!toUserId || !reason) {
      return res.status(400).json({ error: 'Target user ID and reason are required' });
    }

    await legalDocumentService.transferEvidencePackage(
      req.params.id,
      req.user.email,
      toUserId,
      reason
    );

    // Log the transfer
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'share',
      'evidence_package',
      req.params.id,
      `Evidence package transferred to ${toUserId}: ${reason}`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      { transferredTo: toUserId, reason }
    );

    res.json({ success: true, message: 'Evidence package transferred successfully' });
  } catch (error) {
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'share',
      'evidence_package',
      req.params.id,
      `Failed to transfer evidence package: ${error.message}`,
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

// Verify evidence package integrity
router.post('/evidence-packages/:id/verify', requireAuth, requireEvidenceAccess, async (req, res) => {
  try {
    const isValid = await legalDocumentService.verifyEvidenceIntegrity(req.params.id);

    // Log the integrity check
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'read',
      'evidence_package',
      req.params.id,
      `Evidence integrity verification: ${isValid ? 'PASSED' : 'FAILED'}`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      { integrityValid: isValid }
    );

    if (!isValid) {
      // Create compliance event for integrity failure
      await auditLoggingService.logComplianceEvent(
        'security_incident',
        'critical',
        req.user.email,
        `Evidence package integrity verification failed: ${req.params.id}`,
        [req.params.id],
        ['SOX', 'ISO27001'],
        true,
        { packageId: req.params.id, verifiedBy: req.user.email }
      );
    }

    res.json({ valid: isValid });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get audit trail for specific resource
router.get('/audit-trail/:resourceType/:resourceId', requireAuth, requireEvidenceAccess, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const auditTrail = await auditLoggingService.getAuditLogs({
      resourceType: req.params.resourceType,
      resourceId: req.params.resourceId,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    // Log audit trail access
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'read',
      'audit_trail',
      `${req.params.resourceType}:${req.params.resourceId}`,
      'Audit trail accessed',
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      { entriesReturned: auditTrail.length }
    );

    res.json(auditTrail);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get access attempts for monitoring
router.get('/access-attempts', requireAuth, requireEvidenceAccess, async (req, res) => {
  try {
    const { userId, resourceId, success, startDate, endDate } = req.query;
    
    const attempts = await evidenceAccessControlService.getAccessAttempts(
      userId as string,
      resourceId as string,
      success ? success === 'true' : undefined,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json(attempts);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get security alerts
router.get('/security-alerts', requireAuth, requireEvidenceAccess, async (req, res) => {
  try {
    const { resolved } = req.query;
    
    const alerts = await evidenceAccessControlService.getSecurityAlerts(
      resolved ? resolved === 'true' : undefined
    );

    res.json(alerts);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Resolve security alert
router.post('/security-alerts/:alertId/resolve', requireAuth, requireEvidenceAccess, async (req, res) => {
  try {
    const { resolution } = req.body;

    if (!resolution) {
      return res.status(400).json({ error: 'Resolution description is required' });
    }

    await evidenceAccessControlService.resolveSecurityAlert(
      req.params.alertId,
      req.user.email,
      resolution
    );

    // Log alert resolution
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'resolve',
      'security_alert',
      req.params.alertId,
      `Security alert resolved: ${resolution}`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      { resolution }
    );

    res.json({ success: true, message: 'Security alert resolved' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Export audit logs
router.post('/export-audit-logs', requireAuth, requireEvidenceAccess, async (req, res) => {
  try {
    const { format, filters } = req.body;

    if (!['json', 'csv', 'xml'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Must be json, csv, or xml' });
    }

    const exportData = await auditLoggingService.exportAuditLogs(
      format,
      filters,
      req.user.email
    );

    const contentTypes = {
      json: 'application/json',
      csv: 'text/csv',
      xml: 'application/xml'
    };

    const fileExtensions = {
      json: 'json',
      csv: 'csv',
      xml: 'xml'
    };

    res.setHeader('Content-Type', contentTypes[format]);
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.${fileExtensions[format]}"`);
    res.send(exportData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generate access control report
router.get('/reports/access-control', requireAuth, requireEvidenceAccess, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const report = await evidenceAccessControlService.generateAccessReport(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json(report);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generate compliance report
router.get('/reports/compliance/:framework', requireAuth, requireEvidenceAccess, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const report = await auditLoggingService.generateComplianceReport(
      req.params.framework,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json(report);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      accessControl: 'operational',
      auditLogging: 'operational',
      evidenceManagement: 'operational'
    }
  });
});

export default router;