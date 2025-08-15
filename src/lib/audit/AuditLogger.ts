/**
 * Comprehensive Audit Logging System for Reelverse18
 * Tracks all user actions, system events, and compliance activities
 */

export enum AuditEventType {
  // Authentication Events
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  WALLET_CONNECTED = 'wallet_connected',
  WALLET_DISCONNECTED = 'wallet_disconnected',
  SIWE_VERIFICATION = 'siwe_verification',

  // Content Events
  CONTENT_UPLOADED = 'content_uploaded',
  CONTENT_PUBLISHED = 'content_published',
  CONTENT_UPDATED = 'content_updated',
  CONTENT_DELETED = 'content_deleted',
  CONTENT_VIEWED = 'content_viewed',
  CONTENT_DOWNLOADED = 'content_downloaded',

  // Payment Events
  PAYMENT_INITIATED = 'payment_initiated',
  PAYMENT_COMPLETED = 'payment_completed',
  PAYMENT_FAILED = 'payment_failed',
  REVENUE_SPLIT = 'revenue_split',
  PAYOUT_REQUESTED = 'payout_requested',
  PAYOUT_COMPLETED = 'payout_completed',

  // Verification Events
  AGE_VERIFICATION_STARTED = 'age_verification_started',
  AGE_VERIFICATION_COMPLETED = 'age_verification_completed',
  AGE_VERIFICATION_FAILED = 'age_verification_failed',
  TALENT_VERIFICATION_STARTED = 'talent_verification_started',
  TALENT_VERIFICATION_COMPLETED = 'talent_verification_completed',

  // Moderation Events
  CONTENT_FLAGGED = 'content_flagged',
  MODERATION_DECISION = 'moderation_decision',
  DMCA_CLAIM_RECEIVED = 'dmca_claim_received',
  DMCA_TAKEDOWN_EXECUTED = 'dmca_takedown_executed',
  CONTENT_RESTORED = 'content_restored',

  // Consent Events
  CONSENT_REQUESTED = 'consent_requested',
  CONSENT_GRANTED = 'consent_granted',
  CONSENT_REVOKED = 'consent_revoked',
  CONSENT_VERIFIED = 'consent_verified',

  // Organization Events
  ORGANIZATION_CREATED = 'organization_created',
  MEMBER_ADDED = 'member_added',
  MEMBER_REMOVED = 'member_removed',
  ROLE_CHANGED = 'role_changed',

  // System Events
  SYSTEM_ERROR = 'system_error',
  SECURITY_ALERT = 'security_alert',
  DATA_EXPORT = 'data_export',
  DATA_DELETION = 'data_deletion',

  // Compliance Events
  LEGAL_HOLD_APPLIED = 'legal_hold_applied',
  LEGAL_HOLD_RELEASED = 'legal_hold_released',
  COMPLIANCE_REPORT_GENERATED = 'compliance_report_generated',
  AUDIT_PACK_GENERATED = 'audit_pack_generated'
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AuditEvent {
  id: string;
  timestamp: number;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  walletAddress?: string;
  organizationId?: string;
  contentId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  
  // Event-specific data
  data: Record<string, any>;
  
  // Metadata
  source: string; // Component/service that generated the event
  version: string; // Schema version
  
  // Integrity
  hash?: string; // Event hash for integrity verification
  previousHash?: string; // Chain of events
  signature?: string; // Digital signature
}

export interface AuditQuery {
  eventTypes?: AuditEventType[];
  userId?: string;
  walletAddress?: string;
  organizationId?: string;
  contentId?: string;
  startTime?: number;
  endTime?: number;
  severity?: AuditSeverity[];
  limit?: number;
  offset?: number;
}

export interface AuditStorage {
  store(event: AuditEvent): Promise<void>;
  query(query: AuditQuery): Promise<AuditEvent[]>;
  count(query: AuditQuery): Promise<number>;
  getEventChain(startEventId: string, endEventId?: string): Promise<AuditEvent[]>;
}

export class AuditLogger {
  private storage: AuditStorage;
  private previousHash?: string;
  private signingKey?: string;

  constructor(storage: AuditStorage, signingKey?: string) {
    this.storage = storage;
    this.signingKey = signingKey;
  }

  /**
   * Log an audit event
   */
  async logEvent(
    eventType: AuditEventType,
    data: Record<string, any>,
    options: {
      severity?: AuditSeverity;
      userId?: string;
      walletAddress?: string;
      organizationId?: string;
      contentId?: string;
      sessionId?: string;
      source?: string;
    } = {}
  ): Promise<string> {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      eventType,
      severity: options.severity || this.getDefaultSeverity(eventType),
      userId: options.userId,
      walletAddress: options.walletAddress,
      organizationId: options.organizationId,
      contentId: options.contentId,
      sessionId: options.sessionId || this.getCurrentSessionId(),
      ipAddress: this.getCurrentIpAddress(),
      userAgent: this.getCurrentUserAgent(),
      data,
      source: options.source || 'unknown',
      version: '1.0',
      previousHash: this.previousHash
    };

    // Generate event hash
    event.hash = await this.generateEventHash(event);
    
    // Sign event if signing key is available
    if (this.signingKey) {
      event.signature = await this.signEvent(event);
    }

    // Store event
    await this.storage.store(event);

    // Update previous hash for chaining
    this.previousHash = event.hash;

    return event.id;
  }

  /**
   * Query audit events
   */
  async queryEvents(query: AuditQuery): Promise<AuditEvent[]> {
    return await this.storage.query(query);
  }

  /**
   * Get event count for query
   */
  async countEvents(query: AuditQuery): Promise<number> {
    return await this.storage.count(query);
  }

  /**
   * Verify event chain integrity
   */
  async verifyEventChain(startEventId: string, endEventId?: string): Promise<{
    valid: boolean;
    brokenAt?: string;
    details: string;
  }> {
    const events = await this.storage.getEventChain(startEventId, endEventId);
    
    if (events.length === 0) {
      return { valid: false, details: 'No events found in chain' };
    }

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      // Verify event hash
      const expectedHash = await this.generateEventHash(event);
      if (event.hash !== expectedHash) {
        return {
          valid: false,
          brokenAt: event.id,
          details: `Event hash mismatch at ${event.id}`
        };
      }

      // Verify chain linkage
      if (i > 0) {
        const previousEvent = events[i - 1];
        if (event.previousHash !== previousEvent.hash) {
          return {
            valid: false,
            brokenAt: event.id,
            details: `Chain broken at ${event.id} - previous hash mismatch`
          };
        }
      }

      // Verify signature if present
      if (event.signature && this.signingKey) {
        const validSignature = await this.verifyEventSignature(event);
        if (!validSignature) {
          return {
            valid: false,
            brokenAt: event.id,
            details: `Invalid signature at ${event.id}`
          };
        }
      }
    }

    return { valid: true, details: 'Event chain is valid' };
  }

  /**
   * Log user action with context
   */
  async logUserAction(
    action: string,
    userId: string,
    data: Record<string, any> = {},
    severity: AuditSeverity = AuditSeverity.LOW
  ): Promise<string> {
    return await this.logEvent(
      AuditEventType.USER_LOGIN, // This would be mapped based on action
      { action, ...data },
      { severity, userId, source: 'user_interface' }
    );
  }

  /**
   * Log content access with watermark session
   */
  async logContentAccess(
    contentId: string,
    userId: string,
    watermarkId: string,
    sessionData: Record<string, any>
  ): Promise<string> {
    return await this.logEvent(
      AuditEventType.CONTENT_VIEWED,
      {
        watermarkId,
        playbackStartTime: Date.now(),
        ...sessionData
      },
      {
        severity: AuditSeverity.MEDIUM,
        userId,
        contentId,
        source: 'video_player'
      }
    );
  }

  /**
   * Log payment transaction
   */
  async logPaymentTransaction(
    transactionHash: string,
    userId: string,
    contentId: string,
    amount: string,
    currency: string,
    paymentMethod: string
  ): Promise<string> {
    return await this.logEvent(
      AuditEventType.PAYMENT_COMPLETED,
      {
        transactionHash,
        amount,
        currency,
        paymentMethod,
        blockchainNetwork: 'polygon'
      },
      {
        severity: AuditSeverity.HIGH,
        userId,
        contentId,
        source: 'payment_service'
      }
    );
  }

  /**
   * Log consent action
   */
  async logConsentAction(
    sceneHash: string,
    participantWallet: string,
    action: 'granted' | 'revoked',
    consentData: Record<string, any>
  ): Promise<string> {
    const eventType = action === 'granted' 
      ? AuditEventType.CONSENT_GRANTED 
      : AuditEventType.CONSENT_REVOKED;

    return await this.logEvent(
      eventType,
      {
        sceneHash,
        participantWallet,
        consentTimestamp: Date.now(),
        ...consentData
      },
      {
        severity: AuditSeverity.CRITICAL,
        walletAddress: participantWallet,
        source: 'consent_manager'
      }
    );
  }

  /**
   * Log moderation decision
   */
  async logModerationDecision(
    contentId: string,
    moderatorId: string,
    decision: string,
    reason: string,
    evidence: Record<string, any>
  ): Promise<string> {
    return await this.logEvent(
      AuditEventType.MODERATION_DECISION,
      {
        decision,
        reason,
        evidence,
        moderatorId
      },
      {
        severity: AuditSeverity.HIGH,
        userId: moderatorId,
        contentId,
        source: 'moderation_system'
      }
    );
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultSeverity(eventType: AuditEventType): AuditSeverity {
    switch (eventType) {
      case AuditEventType.CONSENT_REVOKED:
      case AuditEventType.DMCA_TAKEDOWN_EXECUTED:
      case AuditEventType.SECURITY_ALERT:
        return AuditSeverity.CRITICAL;
      
      case AuditEventType.PAYMENT_COMPLETED:
      case AuditEventType.MODERATION_DECISION:
      case AuditEventType.AGE_VERIFICATION_COMPLETED:
        return AuditSeverity.HIGH;
      
      case AuditEventType.CONTENT_UPLOADED:
      case AuditEventType.CONTENT_VIEWED:
      case AuditEventType.PAYMENT_INITIATED:
        return AuditSeverity.MEDIUM;
      
      default:
        return AuditSeverity.LOW;
    }
  }

  private getCurrentSessionId(): string | undefined {
    // Get from session storage or context
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('sessionId') || undefined;
    }
    return undefined;
  }

  private getCurrentIpAddress(): string | undefined {
    // This would be set by the backend or middleware
    return undefined;
  }

  private getCurrentUserAgent(): string | undefined {
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent;
    }
    return undefined;
  }

  private async generateEventHash(event: AuditEvent): Promise<string> {
    // Create a deterministic string representation
    const eventString = JSON.stringify({
      id: event.id,
      timestamp: event.timestamp,
      eventType: event.eventType,
      userId: event.userId,
      data: event.data,
      previousHash: event.previousHash
    });

    // Generate SHA-256 hash
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(eventString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback for environments without crypto.subtle
    return this.simpleHash(eventString);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private async signEvent(event: AuditEvent): Promise<string> {
    // This would use a proper digital signature algorithm
    // For now, return a placeholder
    return `sig_${event.hash}_${this.signingKey}`;
  }

  private async verifyEventSignature(event: AuditEvent): Promise<boolean> {
    if (!event.signature || !this.signingKey) {
      return false;
    }

    const expectedSignature = await this.signEvent(event);
    return event.signature === expectedSignature;
  }
}

// Singleton instance
let auditLogger: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
  if (!auditLogger) {
    throw new Error('Audit logger not initialized. Call initializeAuditLogger first.');
  }
  return auditLogger;
}

export function initializeAuditLogger(storage: AuditStorage, signingKey?: string): void {
  auditLogger = new AuditLogger(storage, signingKey);
}