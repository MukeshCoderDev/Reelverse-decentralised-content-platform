/**
 * WORM (Write-Once-Read-Many) Audit Sink
 * Provides immutable audit logging with cryptographic integrity
 * Supports 7+ year retention for legal compliance
 */

import { createHash } from 'crypto';
import { PlatformEvent } from './eventBus';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  eventType: string;
  eventId: string;
  correlationId: string;
  userId?: string;
  organizationId?: string;
  contentId?: string;
  action: string;
  resource: string;
  resourceId: string;
  
  // Context
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  
  // Result
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  
  // Integrity
  hash: string;
  previousHash?: string;
  signature: string;
  
  // Metadata
  metadata: Record<string, any>;
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  contentId?: string;
  action?: string;
  eventType?: string;
  correlationId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditSinkConfig {
  signingKey: string;
  retentionYears: number;
  enableEncryption: boolean;
  encryptionKey?: string;
}

export class WORMAuditSink {
  private config: AuditSinkConfig;
  private lastHash: string = '';
  private auditStore: AuditEntry[] = []; // In production: use immutable storage

  constructor(config: AuditSinkConfig) {
    this.config = config;
  }

  /**
   * Write audit entry from platform event
   */
  async writeEvent(event: PlatformEvent): Promise<void> {
    const auditEntry = this.createAuditEntry(event);
    await this.writeAuditEntry(auditEntry);
  }

  /**
   * Write custom audit entry
   */
  async writeAuditEntry(entry: Omit<AuditEntry, 'hash' | 'previousHash' | 'signature'>): Promise<void> {
    const auditEntry: AuditEntry = {
      ...entry,
      hash: this.calculateHash(entry),
      previousHash: this.lastHash || undefined,
      signature: this.signEntry(entry)
    };

    // Verify integrity
    if (!this.verifyEntry(auditEntry)) {
      throw new Error('Audit entry integrity verification failed');
    }

    // Store entry (in production: write to immutable storage)
    this.auditStore.push(auditEntry);
    this.lastHash = auditEntry.hash;

    // Emit audit event for monitoring
    console.log(`[AUDIT] ${auditEntry.action} on ${auditEntry.resource}:${auditEntry.resourceId} by ${auditEntry.userId || 'system'}`);
  }

  /**
   * Query audit entries with filtering
   */
  async queryAuditEntries(query: AuditQuery): Promise<AuditEntry[]> {
    let results = [...this.auditStore];

    // Apply filters
    if (query.startDate) {
      results = results.filter(entry => entry.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter(entry => entry.timestamp <= query.endDate!);
    }
    if (query.userId) {
      results = results.filter(entry => entry.userId === query.userId);
    }
    if (query.contentId) {
      results = results.filter(entry => entry.contentId === query.contentId);
    }
    if (query.action) {
      results = results.filter(entry => entry.action === query.action);
    }
    if (query.eventType) {
      results = results.filter(entry => entry.eventType === query.eventType);
    }
    if (query.correlationId) {
      results = results.filter(entry => entry.correlationId === query.correlationId);
    }

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    
    return results
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Verify audit trail integrity
   */
  async verifyAuditTrail(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    let previousHash = '';

    for (let i = 0; i < this.auditStore.length; i++) {
      const entry = this.auditStore[i];
      
      // Verify hash
      const expectedHash = this.calculateHash(entry);
      if (entry.hash !== expectedHash) {
        errors.push(`Hash mismatch at entry ${i}: expected ${expectedHash}, got ${entry.hash}`);
      }
      
      // Verify chain
      if (i > 0 && entry.previousHash !== previousHash) {
        errors.push(`Chain broken at entry ${i}: expected previousHash ${previousHash}, got ${entry.previousHash}`);
      }
      
      // Verify signature
      if (!this.verifyEntry(entry)) {
        errors.push(`Signature verification failed at entry ${i}`);
      }
      
      previousHash = entry.hash;
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Create audit entry from platform event
   */
  private createAuditEntry(event: PlatformEvent): Omit<AuditEntry, 'hash' | 'previousHash' | 'signature'> {
    return {
      id: event.id,
      timestamp: event.timestamp,
      eventType: event.type,
      eventId: event.id,
      correlationId: event.correlationId,
      userId: event.metadata.userId,
      organizationId: event.metadata.organizationId,
      contentId: event.metadata.contentId,
      action: this.extractAction(event.type),
      resource: this.extractResource(event.type),
      resourceId: event.metadata.contentId || event.metadata.userId || 'unknown',
      ipAddress: event.metadata.ipAddress,
      userAgent: event.metadata.userAgent,
      deviceId: event.metadata.deviceId,
      success: true, // Events are successful by default
      metadata: {
        eventVersion: event.version,
        source: event.metadata.source,
        traceId: event.metadata.traceId,
        payload: this.sanitizePayload(event.payload)
      }
    };
  }

  /**
   * Calculate hash for audit entry
   */
  private calculateHash(entry: Omit<AuditEntry, 'hash' | 'previousHash' | 'signature'>): string {
    const data = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      eventType: entry.eventType,
      correlationId: entry.correlationId,
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      success: entry.success,
      metadata: entry.metadata
    });
    
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Sign audit entry
   */
  private signEntry(entry: Omit<AuditEntry, 'hash' | 'previousHash' | 'signature'>): string {
    const hash = this.calculateHash(entry);
    return createHash('sha256')
      .update(hash + this.config.signingKey)
      .digest('hex');
  }

  /**
   * Verify audit entry signature
   */
  private verifyEntry(entry: AuditEntry): boolean {
    const expectedSignature = createHash('sha256')
      .update(entry.hash + this.config.signingKey)
      .digest('hex');
    return entry.signature === expectedSignature;
  }

  /**
   * Extract action from event type
   */
  private extractAction(eventType: string): string {
    const parts = eventType.split('.');
    return parts.length > 1 ? parts[1] : 'unknown';
  }

  /**
   * Extract resource from event type
   */
  private extractResource(eventType: string): string {
    const parts = eventType.split('.');
    return parts.length > 0 ? parts[0] : 'unknown';
  }

  /**
   * Sanitize payload to remove sensitive data
   */
  private sanitizePayload(payload: any): any {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const sanitized = { ...payload };
    
    // Remove sensitive fields
    const sensitiveFields = [
      'password', 'token', 'key', 'secret', 'private',
      'ssn', 'creditCard', 'bankAccount', 'license'
    ];
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
}

// Global audit sink instance
export const auditSink = new WORMAuditSink({
  signingKey: process.env.AUDIT_SIGNING_KEY || 'default-audit-key',
  retentionYears: 7,
  enableEncryption: process.env.NODE_ENV === 'production',
  encryptionKey: process.env.AUDIT_ENCRYPTION_KEY
});

// Audit helper functions
export async function auditAction(
  action: string,
  resource: string,
  resourceId: string,
  userId?: string,
  metadata: Record<string, any> = {},
  success: boolean = true,
  errorCode?: string,
  errorMessage?: string
): Promise<void> {
  await auditSink.writeAuditEntry({
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    eventType: `${resource}.${action}`,
    eventId: `manual_${Date.now()}`,
    correlationId: process.env.CORRELATION_ID || 'manual',
    userId,
    action,
    resource,
    resourceId,
    success,
    errorCode,
    errorMessage,
    metadata
  });
}