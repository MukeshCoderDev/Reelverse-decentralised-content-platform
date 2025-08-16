import { v4 as uuidv4 } from 'uuid';

export interface AccessPermission {
  id: string;
  userId: string;
  resourceType: 'evidence_package' | 'csam_case' | 'legal_document' | 'incident_data';
  resourceId: string;
  permissions: AccessLevel[];
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
  reason: string;
  conditions?: AccessCondition[];
  active: boolean;
}

export type AccessLevel = 'read' | 'write' | 'delete' | 'share' | 'audit' | 'admin';

export interface AccessCondition {
  type: 'ip_restriction' | 'time_restriction' | 'location_restriction' | 'two_factor_required';
  value: string;
  description: string;
}

export interface AccessAttempt {
  id: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  action: AccessLevel;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
  sessionId: string;
  metadata: Record<string, any>;
}

export interface AuditTrail {
  id: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'share' | 'download' | 'print' | 'export';
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  details: string;
  dataChanged?: Record<string, any>;
  digitalSignature: string;
  witnessUserId?: string;
}

export interface SecurityAlert {
  id: string;
  type: 'unauthorized_access' | 'suspicious_activity' | 'data_breach' | 'permission_escalation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  resourceId: string;
  description: string;
  timestamp: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  actions: string[];
}

export class EvidenceAccessControlService {
  private permissions: Map<string, AccessPermission> = new Map();
  private accessAttempts: AccessAttempt[] = [];
  private auditTrail: AuditTrail[] = [];
  private securityAlerts: SecurityAlert[] = [];
  
  // Authorized personnel with different clearance levels
  private readonly clearanceLevels = {
    'csam_officer': ['read', 'write', 'audit', 'admin'],
    'legal_counsel': ['read', 'write', 'share', 'audit'],
    'compliance_officer': ['read', 'audit'],
    'security_officer': ['read', 'audit'],
    'law_enforcement': ['read'], // Limited access for LEA
    'external_auditor': ['read', 'audit'] // Read-only for auditors
  };

  async grantAccess(
    userId: string,
    resourceType: AccessPermission['resourceType'],
    resourceId: string,
    permissions: AccessLevel[],
    grantedBy: string,
    reason: string,
    expiresAt?: Date,
    conditions?: AccessCondition[]
  ): Promise<AccessPermission> {
    // Verify grantor has permission to grant access
    const grantorPermissions = await this.getUserPermissions(grantedBy, resourceType, resourceId);
    if (!grantorPermissions.includes('admin')) {
      throw new Error('Insufficient permissions to grant access');
    }

    // Validate requested permissions against clearance level
    const userRole = await this.getUserRole(userId);
    const allowedPermissions = this.clearanceLevels[userRole] || [];
    const validPermissions = permissions.filter(p => allowedPermissions.includes(p));
    
    if (validPermissions.length !== permissions.length) {
      throw new Error(`User role ${userRole} not authorized for requested permissions`);
    }

    const permission: AccessPermission = {
      id: uuidv4(),
      userId,
      resourceType,
      resourceId,
      permissions: validPermissions,
      grantedBy,
      grantedAt: new Date(),
      expiresAt,
      reason,
      conditions,
      active: true
    };

    this.permissions.set(permission.id, permission);

    // Create audit trail entry
    await this.createAuditEntry(
      resourceType,
      resourceId,
      grantedBy,
      'create',
      `Access granted to ${userId}`,
      { permissions: validPermissions, reason, conditions }
    );

    return permission;
  }

  async revokeAccess(
    permissionId: string,
    revokedBy: string,
    reason: string
  ): Promise<void> {
    const permission = this.permissions.get(permissionId);
    if (!permission) {
      throw new Error('Permission not found');
    }

    // Verify revoker has admin permission
    const revokerPermissions = await this.getUserPermissions(
      revokedBy,
      permission.resourceType,
      permission.resourceId
    );
    if (!revokerPermissions.includes('admin')) {
      throw new Error('Insufficient permissions to revoke access');
    }

    permission.active = false;
    this.permissions.set(permissionId, permission);

    // Create audit trail entry
    await this.createAuditEntry(
      permission.resourceType,
      permission.resourceId,
      revokedBy,
      'update',
      `Access revoked for ${permission.userId}: ${reason}`,
      { originalPermissions: permission.permissions, reason }
    );
  }

  async checkAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: AccessLevel,
    context: {
      ipAddress: string;
      userAgent: string;
      sessionId: string;
    }
  ): Promise<boolean> {
    const attemptId = uuidv4();
    const attempt: AccessAttempt = {
      id: attemptId,
      userId,
      resourceType,
      resourceId,
      action,
      timestamp: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      success: false,
      metadata: {}
    };

    try {
      // Get user permissions
      const userPermissions = await this.getUserPermissions(userId, resourceType, resourceId);
      
      // Check if user has required permission
      if (!userPermissions.includes(action)) {
        attempt.failureReason = 'Insufficient permissions';
        this.accessAttempts.push(attempt);
        
        // Create security alert for unauthorized access
        await this.createSecurityAlert(
          'unauthorized_access',
          'medium',
          userId,
          resourceId,
          `Unauthorized ${action} attempt on ${resourceType}`
        );
        
        return false;
      }

      // Check access conditions
      const activePermissions = await this.getActivePermissions(userId, resourceType, resourceId);
      for (const permission of activePermissions) {
        if (permission.conditions) {
          const conditionsMet = await this.checkAccessConditions(permission.conditions, context);
          if (!conditionsMet) {
            attempt.failureReason = 'Access conditions not met';
            this.accessAttempts.push(attempt);
            return false;
          }
        }
      }

      // Check for suspicious activity patterns
      const isSuspicious = await this.detectSuspiciousActivity(userId, context);
      if (isSuspicious) {
        attempt.failureReason = 'Suspicious activity detected';
        this.accessAttempts.push(attempt);
        
        await this.createSecurityAlert(
          'suspicious_activity',
          'high',
          userId,
          resourceId,
          'Suspicious access pattern detected'
        );
        
        return false;
      }

      // Access granted
      attempt.success = true;
      this.accessAttempts.push(attempt);

      // Create audit trail entry for successful access
      await this.createAuditEntry(
        resourceType,
        resourceId,
        userId,
        action === 'read' ? 'read' : 'update',
        `${action} access granted`,
        { attemptId, ipAddress: context.ipAddress }
      );

      return true;

    } catch (error) {
      attempt.failureReason = error.message;
      this.accessAttempts.push(attempt);
      return false;
    }
  }

  async createAuditEntry(
    resourceType: string,
    resourceId: string,
    userId: string,
    action: AuditTrail['action'],
    details: string,
    dataChanged?: Record<string, any>,
    witnessUserId?: string
  ): Promise<AuditTrail> {
    const auditEntry: AuditTrail = {
      id: uuidv4(),
      resourceType,
      resourceId,
      userId,
      action,
      timestamp: new Date(),
      ipAddress: '127.0.0.1', // Would get from request context
      userAgent: 'system',
      details,
      dataChanged,
      digitalSignature: await this.generateDigitalSignature(resourceId, action, userId, details),
      witnessUserId
    };

    this.auditTrail.push(auditEntry);
    return auditEntry;
  }

  async getAuditTrail(
    resourceType?: string,
    resourceId?: string,
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditTrail[]> {
    let filtered = this.auditTrail;

    if (resourceType) {
      filtered = filtered.filter(entry => entry.resourceType === resourceType);
    }

    if (resourceId) {
      filtered = filtered.filter(entry => entry.resourceId === resourceId);
    }

    if (userId) {
      filtered = filtered.filter(entry => entry.userId === userId);
    }

    if (startDate) {
      filtered = filtered.filter(entry => entry.timestamp >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter(entry => entry.timestamp <= endDate);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getAccessAttempts(
    userId?: string,
    resourceId?: string,
    success?: boolean,
    startDate?: Date,
    endDate?: Date
  ): Promise<AccessAttempt[]> {
    let filtered = this.accessAttempts;

    if (userId) {
      filtered = filtered.filter(attempt => attempt.userId === userId);
    }

    if (resourceId) {
      filtered = filtered.filter(attempt => attempt.resourceId === resourceId);
    }

    if (success !== undefined) {
      filtered = filtered.filter(attempt => attempt.success === success);
    }

    if (startDate) {
      filtered = filtered.filter(attempt => attempt.timestamp >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter(attempt => attempt.timestamp <= endDate);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private async getUserPermissions(
    userId: string,
    resourceType: string,
    resourceId: string
  ): Promise<AccessLevel[]> {
    const activePermissions = await this.getActivePermissions(userId, resourceType, resourceId);
    const allPermissions = new Set<AccessLevel>();

    for (const permission of activePermissions) {
      permission.permissions.forEach(p => allPermissions.add(p));
    }

    return Array.from(allPermissions);
  }

  private async getActivePermissions(
    userId: string,
    resourceType: string,
    resourceId: string
  ): Promise<AccessPermission[]> {
    const now = new Date();
    
    return Array.from(this.permissions.values()).filter(permission =>
      permission.userId === userId &&
      permission.resourceType === resourceType &&
      permission.resourceId === resourceId &&
      permission.active &&
      (!permission.expiresAt || permission.expiresAt > now)
    );
  }

  private async getUserRole(userId: string): Promise<string> {
    // Mock implementation - would integrate with user management system
    const roleMap: Record<string, string> = {
      'csam-officer@company.com': 'csam_officer',
      'legal@company.com': 'legal_counsel',
      'compliance@company.com': 'compliance_officer',
      'security@company.com': 'security_officer'
    };
    
    return roleMap[userId] || 'user';
  }

  private async checkAccessConditions(
    conditions: AccessCondition[],
    context: { ipAddress: string; userAgent: string; sessionId: string }
  ): Promise<boolean> {
    for (const condition of conditions) {
      switch (condition.type) {
        case 'ip_restriction':
          if (!this.checkIPRestriction(condition.value, context.ipAddress)) {
            return false;
          }
          break;
        
        case 'time_restriction':
          if (!this.checkTimeRestriction(condition.value)) {
            return false;
          }
          break;
        
        case 'two_factor_required':
          // Would integrate with 2FA system
          if (!await this.checkTwoFactorAuth(context.sessionId)) {
            return false;
          }
          break;
      }
    }
    
    return true;
  }

  private checkIPRestriction(allowedIPs: string, userIP: string): boolean {
    // Simple IP check - would implement proper CIDR matching
    const allowed = allowedIPs.split(',').map(ip => ip.trim());
    return allowed.includes(userIP) || allowed.includes('*');
  }

  private checkTimeRestriction(timeRange: string): boolean {
    // Format: "09:00-17:00" for business hours
    const [start, end] = timeRange.split('-');
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const startTime = parseInt(start.replace(':', ''));
    const endTime = parseInt(end.replace(':', ''));
    
    return currentTime >= startTime && currentTime <= endTime;
  }

  private async checkTwoFactorAuth(sessionId: string): Promise<boolean> {
    // Mock implementation - would check 2FA status
    return Math.random() > 0.1; // 90% success rate for testing
  }

  private async detectSuspiciousActivity(
    userId: string,
    context: { ipAddress: string; userAgent: string; sessionId: string }
  ): Promise<boolean> {
    // Check for rapid successive access attempts
    const recentAttempts = this.accessAttempts.filter(attempt =>
      attempt.userId === userId &&
      attempt.timestamp > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    );

    if (recentAttempts.length > 10) {
      return true;
    }

    // Check for access from multiple IPs
    const uniqueIPs = new Set(recentAttempts.map(attempt => attempt.ipAddress));
    if (uniqueIPs.size > 3) {
      return true;
    }

    // Check for unusual access patterns (e.g., accessing many different resources)
    const uniqueResources = new Set(recentAttempts.map(attempt => attempt.resourceId));
    if (uniqueResources.size > 5) {
      return true;
    }

    return false;
  }

  private async createSecurityAlert(
    type: SecurityAlert['type'],
    severity: SecurityAlert['severity'],
    userId: string,
    resourceId: string,
    description: string
  ): Promise<SecurityAlert> {
    const alert: SecurityAlert = {
      id: uuidv4(),
      type,
      severity,
      userId,
      resourceId,
      description,
      timestamp: new Date(),
      resolved: false,
      actions: []
    };

    this.securityAlerts.push(alert);

    // Auto-escalate critical alerts
    if (severity === 'critical') {
      alert.actions.push('Incident escalated to security team');
      // Would integrate with incident response system
    }

    return alert;
  }

  private async generateDigitalSignature(
    resourceId: string,
    action: string,
    userId: string,
    details: string
  ): Promise<string> {
    // Mock implementation - would use actual cryptographic signing
    const data = `${resourceId}-${action}-${userId}-${details}-${Date.now()}`;
    return `sig-${Buffer.from(data).toString('base64').slice(0, 32)}`;
  }

  // Query methods
  async getSecurityAlerts(resolved?: boolean): Promise<SecurityAlert[]> {
    let filtered = this.securityAlerts;
    
    if (resolved !== undefined) {
      filtered = filtered.filter(alert => alert.resolved === resolved);
    }
    
    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async resolveSecurityAlert(
    alertId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<void> {
    const alert = this.securityAlerts.find(a => a.id === alertId);
    if (!alert) {
      throw new Error('Security alert not found');
    }

    alert.resolved = true;
    alert.resolvedBy = resolvedBy;
    alert.resolvedAt = new Date();
    alert.actions.push(`Resolved by ${resolvedBy}: ${resolution}`);
  }

  async generateAccessReport(startDate: Date, endDate: Date): Promise<any> {
    const attempts = await this.getAccessAttempts(undefined, undefined, undefined, startDate, endDate);
    const auditEntries = await this.getAuditTrail(undefined, undefined, undefined, startDate, endDate);
    const alerts = this.securityAlerts.filter(a => 
      a.timestamp >= startDate && a.timestamp <= endDate
    );

    return {
      period: { startDate, endDate },
      summary: {
        totalAccessAttempts: attempts.length,
        successfulAccesses: attempts.filter(a => a.success).length,
        failedAccesses: attempts.filter(a => !a.success).length,
        auditEntries: auditEntries.length,
        securityAlerts: alerts.length,
        unresolvedAlerts: alerts.filter(a => !a.resolved).length
      },
      topUsers: this.getTopUsers(attempts),
      topResources: this.getTopResources(attempts),
      failureReasons: this.getFailureReasons(attempts),
      securityAlerts: alerts.map(a => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        timestamp: a.timestamp,
        resolved: a.resolved
      }))
    };
  }

  private getTopUsers(attempts: AccessAttempt[]): any[] {
    const userCounts = attempts.reduce((acc, attempt) => {
      acc[attempt.userId] = (acc[attempt.userId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(userCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, accessCount: count }));
  }

  private getTopResources(attempts: AccessAttempt[]): any[] {
    const resourceCounts = attempts.reduce((acc, attempt) => {
      const key = `${attempt.resourceType}:${attempt.resourceId}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(resourceCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([resource, count]) => ({ resource, accessCount: count }));
  }

  private getFailureReasons(attempts: AccessAttempt[]): any[] {
    const failedAttempts = attempts.filter(a => !a.success);
    const reasonCounts = failedAttempts.reduce((acc, attempt) => {
      const reason = attempt.failureReason || 'Unknown';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(reasonCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([reason, count]) => ({ reason, count }));
  }
}

export const evidenceAccessControlService = new EvidenceAccessControlService();