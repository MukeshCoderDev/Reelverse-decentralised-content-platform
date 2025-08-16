import { v4 as uuidv4 } from 'uuid';

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userRole: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  success: boolean;
  errorMessage?: string;
  metadata: Record<string, any>;
  digitalSignature: string;
  chainHash: string; // Links to previous log entry for integrity
}

export type AuditAction = 
  | 'create' | 'read' | 'update' | 'delete'
  | 'login' | 'logout' | 'access_granted' | 'access_denied'
  | 'export' | 'download' | 'print' | 'share'
  | 'escalate' | 'resolve' | 'approve' | 'reject'
  | 'encrypt' | 'decrypt' | 'backup' | 'restore';

export interface ComplianceEvent {
  id: string;
  type: 'data_access' | 'data_export' | 'policy_violation' | 'security_incident' | 'legal_request';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  userId: string;
  description: string;
  affectedResources: string[];
  complianceFramework: string[]; // GDPR, CCPA, SOX, etc.
  requiresReporting: boolean;
  reportedAt?: Date;
  metadata: Record<string, any>;
}

export interface DataLineage {
  id: string;
  dataId: string;
  operation: 'created' | 'copied' | 'transformed' | 'deleted' | 'archived';
  sourceId?: string;
  destinationId?: string;
  timestamp: Date;
  userId: string;
  transformationDetails?: string;
  retentionPolicy?: string;
}

export class AuditLoggingService {
  private auditLogs: AuditLog[] = [];
  private complianceEvents: ComplianceEvent[] = [];
  private dataLineage: DataLineage[] = [];
  private lastChainHash: string = '0000000000000000000000000000000000000000000000000000000000000000';

  async logAction(
    userId: string,
    userRole: string,
    action: AuditAction,
    resourceType: string,
    resourceId: string,
    details: string,
    context: {
      ipAddress: string;
      userAgent: string;
      sessionId: string;
    },
    success: boolean = true,
    errorMessage?: string,
    metadata: Record<string, any> = {}
  ): Promise<AuditLog> {
    const logEntry: AuditLog = {
      id: uuidv4(),
      timestamp: new Date(),
      userId,
      userRole,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      success,
      errorMessage,
      metadata,
      digitalSignature: '',
      chainHash: ''
    };

    // Generate digital signature
    logEntry.digitalSignature = await this.generateDigitalSignature(logEntry);
    
    // Generate chain hash linking to previous entry
    logEntry.chainHash = await this.generateChainHash(logEntry, this.lastChainHash);
    this.lastChainHash = logEntry.chainHash;

    this.auditLogs.push(logEntry);

    // Check if this action requires compliance reporting
    await this.checkComplianceRequirements(logEntry);

    // Update data lineage if applicable
    if (this.isDataOperation(action)) {
      await this.updateDataLineage(logEntry);
    }

    return logEntry;
  }

  async logComplianceEvent(
    type: ComplianceEvent['type'],
    severity: ComplianceEvent['severity'],
    userId: string,
    description: string,
    affectedResources: string[],
    complianceFramework: string[],
    requiresReporting: boolean = false,
    metadata: Record<string, any> = {}
  ): Promise<ComplianceEvent> {
    const event: ComplianceEvent = {
      id: uuidv4(),
      type,
      severity,
      timestamp: new Date(),
      userId,
      description,
      affectedResources,
      complianceFramework,
      requiresReporting,
      metadata
    };

    this.complianceEvents.push(event);

    // Auto-report critical events
    if (severity === 'critical' && requiresReporting) {
      await this.reportComplianceEvent(event.id);
    }

    return event;
  }

  async logDataLineage(
    dataId: string,
    operation: DataLineage['operation'],
    userId: string,
    sourceId?: string,
    destinationId?: string,
    transformationDetails?: string,
    retentionPolicy?: string
  ): Promise<DataLineage> {
    const lineageEntry: DataLineage = {
      id: uuidv4(),
      dataId,
      operation,
      sourceId,
      destinationId,
      timestamp: new Date(),
      userId,
      transformationDetails,
      retentionPolicy
    };

    this.dataLineage.push(lineageEntry);
    return lineageEntry;
  }

  async getAuditLogs(filters: {
    userId?: string;
    action?: AuditAction;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
  } = {}): Promise<AuditLog[]> {
    let filtered = this.auditLogs;

    if (filters.userId) {
      filtered = filtered.filter(log => log.userId === filters.userId);
    }

    if (filters.action) {
      filtered = filtered.filter(log => log.action === filters.action);
    }

    if (filters.resourceType) {
      filtered = filtered.filter(log => log.resourceType === filters.resourceType);
    }

    if (filters.resourceId) {
      filtered = filtered.filter(log => log.resourceId === filters.resourceId);
    }

    if (filters.startDate) {
      filtered = filtered.filter(log => log.timestamp >= filters.startDate!);
    }

    if (filters.endDate) {
      filtered = filtered.filter(log => log.timestamp <= filters.endDate!);
    }

    if (filters.success !== undefined) {
      filtered = filtered.filter(log => log.success === filters.success);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getComplianceEvents(filters: {
    type?: ComplianceEvent['type'];
    severity?: ComplianceEvent['severity'];
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    requiresReporting?: boolean;
  } = {}): Promise<ComplianceEvent[]> {
    let filtered = this.complianceEvents;

    if (filters.type) {
      filtered = filtered.filter(event => event.type === filters.type);
    }

    if (filters.severity) {
      filtered = filtered.filter(event => event.severity === filters.severity);
    }

    if (filters.userId) {
      filtered = filtered.filter(event => event.userId === filters.userId);
    }

    if (filters.startDate) {
      filtered = filtered.filter(event => event.timestamp >= filters.startDate!);
    }

    if (filters.endDate) {
      filtered = filtered.filter(event => event.timestamp <= filters.endDate!);
    }

    if (filters.requiresReporting !== undefined) {
      filtered = filtered.filter(event => event.requiresReporting === filters.requiresReporting);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getDataLineage(dataId: string): Promise<DataLineage[]> {
    return this.dataLineage
      .filter(entry => entry.dataId === dataId || entry.sourceId === dataId || entry.destinationId === dataId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async verifyAuditIntegrity(startDate?: Date, endDate?: Date): Promise<{
    valid: boolean;
    totalEntries: number;
    invalidEntries: string[];
    brokenChain: boolean;
  }> {
    let logsToVerify = this.auditLogs;
    
    if (startDate || endDate) {
      logsToVerify = logsToVerify.filter(log => {
        if (startDate && log.timestamp < startDate) return false;
        if (endDate && log.timestamp > endDate) return false;
        return true;
      });
    }

    const invalidEntries: string[] = [];
    let brokenChain = false;
    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';

    for (const log of logsToVerify.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
      // Verify digital signature
      const expectedSignature = await this.generateDigitalSignature(log);
      if (log.digitalSignature !== expectedSignature) {
        invalidEntries.push(`${log.id}: Invalid digital signature`);
      }

      // Verify chain hash
      const expectedChainHash = await this.generateChainHash(log, previousHash);
      if (log.chainHash !== expectedChainHash) {
        invalidEntries.push(`${log.id}: Broken chain hash`);
        brokenChain = true;
      }

      previousHash = log.chainHash;
    }

    return {
      valid: invalidEntries.length === 0 && !brokenChain,
      totalEntries: logsToVerify.length,
      invalidEntries,
      brokenChain
    };
  }

  async exportAuditLogs(
    format: 'json' | 'csv' | 'xml',
    filters: Parameters<typeof this.getAuditLogs>[0] = {},
    requestedBy: string
  ): Promise<string> {
    const logs = await this.getAuditLogs(filters);
    
    // Log the export action
    await this.logAction(
      requestedBy,
      'auditor',
      'export',
      'audit_logs',
      'bulk_export',
      `Exported ${logs.length} audit logs in ${format} format`,
      { ipAddress: '127.0.0.1', userAgent: 'system', sessionId: 'export-session' },
      true,
      undefined,
      { format, filters, exportedCount: logs.length }
    );

    switch (format) {
      case 'json':
        return JSON.stringify(logs, null, 2);
      
      case 'csv':
        return this.convertToCSV(logs);
      
      case 'xml':
        return this.convertToXML(logs);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  async reportComplianceEvent(eventId: string): Promise<void> {
    const event = this.complianceEvents.find(e => e.id === eventId);
    if (!event) {
      throw new Error('Compliance event not found');
    }

    event.reportedAt = new Date();
    
    // Mock reporting to regulatory bodies
    console.log(`Compliance event ${eventId} reported to regulatory authorities`);
    
    // Log the reporting action
    await this.logAction(
      'system',
      'compliance_system',
      'escalate',
      'compliance_event',
      eventId,
      `Compliance event reported to authorities: ${event.description}`,
      { ipAddress: '127.0.0.1', userAgent: 'system', sessionId: 'compliance-reporting' },
      true,
      undefined,
      { eventType: event.type, severity: event.severity, frameworks: event.complianceFramework }
    );
  }

  async generateComplianceReport(
    framework: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const relevantEvents = await this.getComplianceEvents({
      startDate,
      endDate
    });

    const frameworkEvents = relevantEvents.filter(event =>
      event.complianceFramework.includes(framework)
    );

    const relevantLogs = await this.getAuditLogs({
      startDate,
      endDate
    });

    return {
      framework,
      period: { startDate, endDate },
      summary: {
        totalEvents: frameworkEvents.length,
        criticalEvents: frameworkEvents.filter(e => e.severity === 'critical').length,
        reportedEvents: frameworkEvents.filter(e => e.reportedAt).length,
        totalAuditLogs: relevantLogs.length,
        failedActions: relevantLogs.filter(l => !l.success).length
      },
      events: frameworkEvents.map(event => ({
        id: event.id,
        type: event.type,
        severity: event.severity,
        timestamp: event.timestamp,
        description: event.description,
        reported: !!event.reportedAt,
        reportedAt: event.reportedAt
      })),
      dataAccess: {
        totalAccesses: relevantLogs.filter(l => l.action === 'read').length,
        dataExports: relevantLogs.filter(l => l.action === 'export').length,
        unauthorizedAttempts: relevantLogs.filter(l => l.action === 'access_denied').length
      },
      integrityCheck: await this.verifyAuditIntegrity(startDate, endDate)
    };
  }

  private async checkComplianceRequirements(log: AuditLog): Promise<void> {
    // Check for GDPR compliance events
    if (this.isGDPRRelevant(log)) {
      await this.logComplianceEvent(
        'data_access',
        'medium',
        log.userId,
        `GDPR-relevant data access: ${log.details}`,
        [log.resourceId],
        ['GDPR'],
        false,
        { originalLogId: log.id }
      );
    }

    // Check for CCPA compliance events
    if (this.isCCPARelevant(log)) {
      await this.logComplianceEvent(
        'data_access',
        'medium',
        log.userId,
        `CCPA-relevant data access: ${log.details}`,
        [log.resourceId],
        ['CCPA'],
        false,
        { originalLogId: log.id }
      );
    }

    // Check for security incidents
    if (!log.success && this.isSecurityRelevant(log)) {
      await this.logComplianceEvent(
        'security_incident',
        'high',
        log.userId,
        `Security incident: ${log.errorMessage}`,
        [log.resourceId],
        ['SOX', 'ISO27001'],
        true,
        { originalLogId: log.id, failedAction: log.action }
      );
    }
  }

  private async updateDataLineage(log: AuditLog): Promise<void> {
    let operation: DataLineage['operation'];
    
    switch (log.action) {
      case 'create':
        operation = 'created';
        break;
      case 'update':
        operation = 'transformed';
        break;
      case 'delete':
        operation = 'deleted';
        break;
      default:
        return; // Not a data operation
    }

    await this.logDataLineage(
      log.resourceId,
      operation,
      log.userId,
      log.metadata.sourceId,
      log.metadata.destinationId,
      log.details
    );
  }

  private isDataOperation(action: AuditAction): boolean {
    return ['create', 'update', 'delete', 'export', 'download'].includes(action);
  }

  private isGDPRRelevant(log: AuditLog): boolean {
    // Check if the action involves personal data under GDPR
    const gdprResourceTypes = ['user_data', 'personal_info', 'evidence_package'];
    const gdprActions = ['read', 'export', 'download', 'share'];
    
    return gdprResourceTypes.includes(log.resourceType) && gdprActions.includes(log.action);
  }

  private isCCPARelevant(log: AuditLog): boolean {
    // Check if the action involves personal information under CCPA
    const ccpaResourceTypes = ['user_data', 'personal_info', 'consumer_data'];
    const ccpaActions = ['read', 'export', 'download', 'share', 'delete'];
    
    return ccpaResourceTypes.includes(log.resourceType) && ccpaActions.includes(log.action);
  }

  private isSecurityRelevant(log: AuditLog): boolean {
    const securityActions = ['access_denied', 'login', 'decrypt', 'escalate'];
    return securityActions.includes(log.action) || log.resourceType.includes('security');
  }

  private async generateDigitalSignature(log: AuditLog): string {
    // Mock implementation - would use actual cryptographic signing
    const data = `${log.id}-${log.timestamp.toISOString()}-${log.userId}-${log.action}-${log.resourceId}`;
    return `sig-${Buffer.from(data).toString('base64').slice(0, 32)}`;
  }

  private async generateChainHash(log: AuditLog, previousHash: string): string {
    // Mock implementation - would use actual hash function like SHA-256
    const data = `${previousHash}-${log.id}-${log.timestamp.toISOString()}-${log.digitalSignature}`;
    return Buffer.from(data).toString('base64').slice(0, 64);
  }

  private convertToCSV(logs: AuditLog[]): string {
    const headers = [
      'ID', 'Timestamp', 'User ID', 'User Role', 'Action', 'Resource Type',
      'Resource ID', 'Details', 'IP Address', 'Success', 'Error Message'
    ];
    
    const rows = logs.map(log => [
      log.id,
      log.timestamp.toISOString(),
      log.userId,
      log.userRole,
      log.action,
      log.resourceType,
      log.resourceId,
      `"${log.details.replace(/"/g, '""')}"`,
      log.ipAddress,
      log.success.toString(),
      log.errorMessage || ''
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private convertToXML(logs: AuditLog[]): string {
    const xmlLogs = logs.map(log => `
    <log>
      <id>${log.id}</id>
      <timestamp>${log.timestamp.toISOString()}</timestamp>
      <userId>${log.userId}</userId>
      <userRole>${log.userRole}</userRole>
      <action>${log.action}</action>
      <resourceType>${log.resourceType}</resourceType>
      <resourceId>${log.resourceId}</resourceId>
      <details><![CDATA[${log.details}]]></details>
      <ipAddress>${log.ipAddress}</ipAddress>
      <success>${log.success}</success>
      ${log.errorMessage ? `<errorMessage><![CDATA[${log.errorMessage}]]></errorMessage>` : ''}
    </log>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<auditLogs>
  <exportTimestamp>${new Date().toISOString()}</exportTimestamp>
  <totalLogs>${logs.length}</totalLogs>
  <logs>${xmlLogs}
  </logs>
</auditLogs>`;
  }
}

export const auditLoggingService = new AuditLoggingService();