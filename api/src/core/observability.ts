/**
 * Observability and Structured Logging
 * Provides correlation IDs, security event correlation, and compliance reporting
 */

import { createHash } from 'crypto';
import { eventBus } from './eventBus';
import { auditSink } from './auditSink';
import { metrics } from './metrics';

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: Date;
  correlationId: string;
  traceId?: string;
  userId?: string;
  organizationId?: string;
  contentId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, any>;
  redacted: boolean;
}

export interface SecurityEvent {
  type: 'authentication_failure' | 'authorization_failure' | 'suspicious_activity' | 'data_breach' | 'policy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface ComplianceReport {
  reportId: string;
  type: 'gdpr' | '2257' | 'audit_trail' | 'data_retention';
  requestedBy: string;
  dateRange: { start: Date; end: Date };
  filters: Record<string, any>;
  generatedAt: Date;
  entries: any[];
  redacted: boolean;
}

export class ObservabilityManager {
  private logs: LogEntry[] = [];
  private securityEvents: SecurityEvent[] = [];
  private sensitiveFields = [
    'password', 'token', 'key', 'secret', 'private', 'ssn', 
    'creditCard', 'bankAccount', 'license', 'email', 'phone'
  ];

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for automatic logging
   */
  private setupEventListeners(): void {
    // Listen to all events for automatic audit logging
    eventBus.on('*', async (event) => {
      await this.logEvent('info', `Event: ${event.type}`, {
        eventId: event.id,
        eventType: event.type,
        correlationId: event.correlationId,
        userId: event.metadata.userId,
        organizationId: event.metadata.organizationId,
        contentId: event.metadata.contentId
      });
    });

    // Listen to metrics for performance logging
    metrics.on('metric', (metric) => {
      if (metric.type === 'timer' && metric.tags.success === 'false') {
        this.logEvent('error', `Operation failed: ${metric.name}`, {
          metricName: metric.name,
          duration: metric.value,
          error: metric.tags.error,
          correlationId: this.getCurrentCorrelationId()
        });
      }
    });

    // Listen to SLA violations
    metrics.on('health_metrics', (healthMetrics) => {
      // Log performance metrics
      this.logEvent('info', 'Health metrics collected', {
        correlationId: this.getCurrentCorrelationId(),
        metrics: healthMetrics
      });
    });
  }

  /**
   * Log structured message with automatic redaction
   */
  async logEvent(
    level: LogEntry['level'],
    message: string,
    metadata: Record<string, any> = {},
    correlationId?: string
  ): Promise<void> {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      correlationId: correlationId || this.getCurrentCorrelationId(),
      traceId: metadata.traceId,
      userId: metadata.userId,
      organizationId: metadata.organizationId,
      contentId: metadata.contentId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: this.redactSensitiveData(metadata),
      redacted: this.containsSensitiveData(metadata)
    };

    // Store log entry
    this.logs.push(logEntry);

    // Keep only last 10000 log entries to prevent memory issues
    if (this.logs.length > 10000) {
      this.logs.splice(0, this.logs.length - 10000);
    }

    // Output to console with proper formatting
    const logMessage = this.formatLogMessage(logEntry);
    
    switch (level) {
      case 'debug':
        console.debug(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
      case 'fatal':
        console.error(logMessage);
        break;
    }

    // Create audit entry for important events
    if (level === 'error' || level === 'fatal' || this.isAuditableEvent(message)) {
      await auditSink.writeAuditEntry({
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: logEntry.timestamp,
        eventType: 'system.log',
        eventId: `log_${Date.now()}`,
        correlationId: logEntry.correlationId,
        userId: logEntry.userId,
        organizationId: logEntry.organizationId,
        contentId: logEntry.contentId,
        action: 'log',
        resource: 'system',
        resourceId: 'log',
        ipAddress: logEntry.ipAddress,
        userAgent: logEntry.userAgent,
        success: level !== 'error' && level !== 'fatal',
        errorCode: level === 'error' || level === 'fatal' ? 'LOG_ERROR' : undefined,
        errorMessage: level === 'error' || level === 'fatal' ? message : undefined,
        metadata: {
          level,
          message: logEntry.redacted ? '[REDACTED]' : message,
          ...logEntry.metadata
        }
      });
    }
  }

  /**
   * Record security event
   */
  async recordSecurityEvent(event: Omit<SecurityEvent, 'timestamp' | 'correlationId'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
      correlationId: this.getCurrentCorrelationId()
    };

    this.securityEvents.push(securityEvent);

    // Keep only last 1000 security events
    if (this.securityEvents.length > 1000) {
      this.securityEvents.splice(0, this.securityEvents.length - 1000);
    }

    // Log security event
    await this.logEvent('warn', `Security event: ${event.type}`, {
      securityEventType: event.type,
      severity: event.severity,
      description: event.description,
      userId: event.userId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      correlationId: securityEvent.correlationId,
      ...event.metadata
    });

    // Emit security event for alerting
    await eventBus.publish({
      type: 'security.event',
      version: '1.0',
      correlationId: securityEvent.correlationId,
      payload: securityEvent,
      metadata: {
        source: 'observability-manager',
        userId: event.userId
      }
    });

    // Record metrics
    metrics.counter('security_events_total', 1, {
      type: event.type,
      severity: event.severity
    });

    console.warn(`[SECURITY] ${event.type} (${event.severity}): ${event.description}`);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    type: ComplianceReport['type'],
    requestedBy: string,
    dateRange: { start: Date; end: Date },
    filters: Record<string, any> = {}
  ): Promise<ComplianceReport> {
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let entries: any[] = [];
    
    switch (type) {
      case 'audit_trail':
        entries = await this.getAuditTrailEntries(dateRange, filters);
        break;
      case 'gdpr':
        entries = await this.getGDPREntries(dateRange, filters);
        break;
      case '2257':
        entries = await this.get2257Entries(dateRange, filters);
        break;
      case 'data_retention':
        entries = await this.getDataRetentionEntries(dateRange, filters);
        break;
    }

    const report: ComplianceReport = {
      reportId,
      type,
      requestedBy,
      dateRange,
      filters,
      generatedAt: new Date(),
      entries: entries.map(entry => this.redactSensitiveData(entry)),
      redacted: true
    };

    // Log report generation
    await this.logEvent('info', `Compliance report generated: ${type}`, {
      reportId,
      requestedBy,
      entryCount: entries.length,
      correlationId: this.getCurrentCorrelationId()
    });

    return report;
  }

  /**
   * Get correlation ID from current context
   */
  private getCurrentCorrelationId(): string {
    // In production, use AsyncLocalStorage to track correlation IDs
    return process.env.CORRELATION_ID || `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if message indicates auditable event
   */
  private isAuditableEvent(message: string): boolean {
    const auditablePatterns = [
      /license.*issued/i,
      /key.*rotated/i,
      /takedown.*initiated/i,
      /payment.*processed/i,
      /content.*uploaded/i,
      /user.*authenticated/i,
      /permission.*denied/i
    ];

    return auditablePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Check if data contains sensitive information
   */
  private containsSensitiveData(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const dataStr = JSON.stringify(data).toLowerCase();
    return this.sensitiveFields.some(field => dataStr.includes(field));
  }

  /**
   * Redact sensitive data from object
   */
  private redactSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const redacted = { ...data };

    for (const key in redacted) {
      if (this.sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof redacted[key] === 'object') {
        redacted[key] = this.redactSensitiveData(redacted[key]);
      }
    }

    return redacted;
  }

  /**
   * Format log message for console output
   */
  private formatLogMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const correlationId = entry.correlationId.substr(0, 8);
    
    let message = `[${timestamp}] ${level} [${correlationId}] ${entry.message}`;
    
    if (entry.userId) {
      message += ` | user:${entry.userId}`;
    }
    
    if (entry.contentId) {
      message += ` | content:${entry.contentId}`;
    }
    
    if (Object.keys(entry.metadata).length > 0) {
      message += ` | ${JSON.stringify(entry.metadata)}`;
    }
    
    return message;
  }

  /**
   * Get audit trail entries for compliance report
   */
  private async getAuditTrailEntries(
    dateRange: { start: Date; end: Date },
    filters: Record<string, any>
  ): Promise<any[]> {
    const entries = await auditSink.queryAuditEntries({
      startDate: dateRange.start,
      endDate: dateRange.end,
      userId: filters.userId,
      contentId: filters.contentId,
      action: filters.action,
      limit: 10000
    });

    return entries;
  }

  /**
   * Get GDPR-related entries
   */
  private async getGDPREntries(
    dateRange: { start: Date; end: Date },
    filters: Record<string, any>
  ): Promise<any[]> {
    // Filter for GDPR-relevant events
    const entries = await auditSink.queryAuditEntries({
      startDate: dateRange.start,
      endDate: dateRange.end,
      userId: filters.userId,
      limit: 10000
    });

    return entries.filter(entry => 
      entry.action.includes('access') ||
      entry.action.includes('delete') ||
      entry.action.includes('export') ||
      entry.action.includes('consent')
    );
  }

  /**
   * Get 2257 compliance entries
   */
  private async get2257Entries(
    dateRange: { start: Date; end: Date },
    filters: Record<string, any>
  ): Promise<any[]> {
    const entries = await auditSink.queryAuditEntries({
      startDate: dateRange.start,
      endDate: dateRange.end,
      limit: 10000
    });

    return entries.filter(entry => 
      entry.action.includes('consent') ||
      entry.action.includes('verification') ||
      entry.action.includes('document')
    );
  }

  /**
   * Get data retention entries
   */
  private async getDataRetentionEntries(
    dateRange: { start: Date; end: Date },
    filters: Record<string, any>
  ): Promise<any[]> {
    const entries = await auditSink.queryAuditEntries({
      startDate: dateRange.start,
      endDate: dateRange.end,
      limit: 10000
    });

    return entries.filter(entry => 
      entry.action.includes('delete') ||
      entry.action.includes('purge') ||
      entry.action.includes('archive')
    );
  }
}

// Global observability manager
export const observability = new ObservabilityManager();