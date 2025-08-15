// Comprehensive audit trail system for legal compliance

export interface AuditEvent {
  id: string;
  timestamp: number;
  eventType: AuditEventType;
  userId?: string;
  walletAddress?: string;
  organizationId?: string;
  contentId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  data: Record<string, any>;
  metadata: {
    requestId?: string;
    transactionHash?: string;
    blockNumber?: number;
    gasUsed?: number;
    signature?: string;
  };
}

export enum AuditEventType {
  // Authentication Events
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  WALLET_CONNECTED = 'wallet_connected',
  WALLET_DISCONNECTED = 'wallet_disconnected',
  SIWE_VERIFICATION = 'siwe_verification',
  
  // Age Verification Events
  AGE_VERIFICATION_STARTED = 'age_verification_started',
  AGE_VERIFICATION_COMPLETED = 'age_verification_completed',
  AGE_VERIFICATION_FAILED = 'age_verification_failed',
  KYC_DOCUMENT_UPLOADED = 'kyc_document_uploaded',
  
  // Content Events
  CONTENT_UPLOADED = 'content_uploaded',
  CONTENT_PUBLISHED = 'content_published',
  CONTENT_ACCESSED = 'content_accessed',
  CONTENT_DOWNLOADED = 'content_downloaded',
  CONTENT_MODERATED = 'content_moderated',
  CONTENT_FLAGGED = 'content_flagged',
  CONTENT_REMOVED = 'content_removed',
  
  // Payment Events
  PAYMENT_INITIATED = 'payment_initiated',
  PAYMENT_COMPLETED = 'payment_completed',
  PAYMENT_FAILED = 'payment_failed',
  REVENUE_DISTRIBUTED = 'revenue_distributed',
  PAYOUT_REQUESTED = 'payout_requested',
  PAYOUT_COMPLETED = 'payout_completed',
  
  // Consent Events
  CONSENT_REQUESTED = 'consent_requested',
  CONSENT_SIGNED = 'consent_signed',
  CONSENT_REVOKED = 'consent_revoked',
  SCENE_HASH_GENERATED = 'scene_hash_generated',
  
  // Moderation Events
  MODERATION_REVIEW_STARTED = 'moderation_review_started',
  MODERATION_DECISION_MADE = 'moderation_decision_made',
  DMCA_CLAIM_RECEIVED = 'dmca_claim_received',
  DMCA_TAKEDOWN_EXECUTED = 'dmca_takedown_executed',
  
  // Organization Events
  ORGANIZATION_CREATED = 'organization_created',
  MEMBER_INVITED = 'member_invited',
  MEMBER_JOINED = 'member_joined',
  MEMBER_REMOVED = 'member_removed',
  ROLE_CHANGED = 'role_changed',
  
  // Playback Events
  PLAYBACK_STARTED = 'playback_started',
  PLAYBACK_ENDED = 'playback_ended',
  WATERMARK_APPLIED = 'watermark_applied',
  PLAYBACK_TOKEN_ISSUED = 'playback_token_issued',
  
  // System Events
  FEATURE_FLAG_CHANGED = 'feature_flag_changed',
  SYSTEM_MAINTENANCE = 'system_maintenance',
  DATA_EXPORT_REQUESTED = 'data_export_requested',
  EVIDENCE_PACK_GENERATED = 'evidence_pack_generated'
}

export interface EvidencePack {
  id: string;
  requestedBy: string;
  requestedAt: number;
  generatedAt: number;
  type: 'user' | 'content' | 'organization' | 'legal_request';
  subjectId: string;
  timeRange: {
    start: number;
    end: number;
  };
  events: AuditEvent[];
  metadata: {
    totalEvents: number;
    contentItems: string[];
    paymentTransactions: string[];
    consentRecords: string[];
    moderationActions: string[];
  };
  files: EvidenceFile[];
  hash: string;
  signature?: string;
}

export interface EvidenceFile {
  id: string;
  filename: string;
  type: 'audit_log' | 'consent_document' | 'kyc_document' | 'transaction_receipt' | 'content_metadata';
  size: number;
  hash: string;
  url?: string;
  encrypted: boolean;
}

class AuditTrailService {
  private events: Map<string, AuditEvent> = new Map();
  private eventsByUser: Map<string, string[]> = new Map();
  private eventsByContent: Map<string, string[]> = new Map();
  private eventsByOrganization: Map<string, string[]> = new Map();

  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now()
    };

    // Store event
    this.events.set(auditEvent.id, auditEvent);

    // Index by user
    if (auditEvent.userId || auditEvent.walletAddress) {
      const userId = auditEvent.userId || auditEvent.walletAddress!;
      const userEvents = this.eventsByUser.get(userId) || [];
      userEvents.push(auditEvent.id);
      this.eventsByUser.set(userId, userEvents);
    }

    // Index by content
    if (auditEvent.contentId) {
      const contentEvents = this.eventsByContent.get(auditEvent.contentId) || [];
      contentEvents.push(auditEvent.id);
      this.eventsByContent.set(auditEvent.contentId, contentEvents);
    }

    // Index by organization
    if (auditEvent.organizationId) {
      const orgEvents = this.eventsByOrganization.get(auditEvent.organizationId) || [];
      orgEvents.push(auditEvent.id);
      this.eventsByOrganization.set(auditEvent.organizationId, orgEvents);
    }

    // In production, persist to database
    await this.persistEvent(auditEvent);

    return auditEvent.id;
  }

  async getEvents(filters: {
    userId?: string;
    contentId?: string;
    organizationId?: string;
    eventTypes?: AuditEventType[];
    startTime?: number;
    endTime?: number;
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]> {
    let eventIds: string[] = [];

    // Get relevant event IDs based on filters
    if (filters.userId) {
      eventIds = this.eventsByUser.get(filters.userId) || [];
    } else if (filters.contentId) {
      eventIds = this.eventsByContent.get(filters.contentId) || [];
    } else if (filters.organizationId) {
      eventIds = this.eventsByOrganization.get(filters.organizationId) || [];
    } else {
      eventIds = Array.from(this.events.keys());
    }

    // Get events and apply filters
    let events = eventIds
      .map(id => this.events.get(id))
      .filter((event): event is AuditEvent => event !== undefined);

    // Filter by event types
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      events = events.filter(event => filters.eventTypes!.includes(event.eventType));
    }

    // Filter by time range
    if (filters.startTime) {
      events = events.filter(event => event.timestamp >= filters.startTime!);
    }
    if (filters.endTime) {
      events = events.filter(event => event.timestamp <= filters.endTime!);
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 100;
    return events.slice(offset, offset + limit);
  }

  async generateEvidencePack(request: {
    type: 'user' | 'content' | 'organization' | 'legal_request';
    subjectId: string;
    timeRange?: { start: number; end: number };
    requestedBy: string;
    includeFiles?: boolean;
  }): Promise<EvidencePack> {
    const packId = this.generatePackId();
    const now = Date.now();

    // Default time range: last 2 years
    const timeRange = request.timeRange || {
      start: now - (2 * 365 * 24 * 60 * 60 * 1000),
      end: now
    };

    // Get relevant events
    const events = await this.getEvents({
      [request.type === 'user' ? 'userId' : 
       request.type === 'content' ? 'contentId' : 
       'organizationId']: request.subjectId,
      startTime: timeRange.start,
      endTime: timeRange.end,
      limit: 10000 // Large limit for evidence packs
    });

    // Collect metadata
    const contentItems = new Set<string>();
    const paymentTransactions = new Set<string>();
    const consentRecords = new Set<string>();
    const moderationActions = new Set<string>();

    events.forEach(event => {
      if (event.contentId) contentItems.add(event.contentId);
      if (event.metadata.transactionHash) paymentTransactions.add(event.metadata.transactionHash);
      if (event.eventType.includes('consent')) consentRecords.add(event.id);
      if (event.eventType.includes('moderation')) moderationActions.add(event.id);
    });

    // Generate evidence files
    const files: EvidenceFile[] = [];
    
    // Audit log file
    const auditLogFile = await this.generateAuditLogFile(events);
    files.push(auditLogFile);

    // Include additional files if requested
    if (request.includeFiles) {
      // KYC documents
      if (request.type === 'user') {
        const kycFiles = await this.getKYCDocuments(request.subjectId);
        files.push(...kycFiles);
      }

      // Content metadata files
      if (contentItems.size > 0) {
        const contentFiles = await this.getContentMetadataFiles(Array.from(contentItems));
        files.push(...contentFiles);
      }

      // Consent documents
      if (consentRecords.size > 0) {
        const consentFiles = await this.getConsentDocuments(Array.from(consentRecords));
        files.push(...consentFiles);
      }
    }

    const evidencePack: EvidencePack = {
      id: packId,
      requestedBy: request.requestedBy,
      requestedAt: now,
      generatedAt: now,
      type: request.type,
      subjectId: request.subjectId,
      timeRange,
      events,
      metadata: {
        totalEvents: events.length,
        contentItems: Array.from(contentItems),
        paymentTransactions: Array.from(paymentTransactions),
        consentRecords: Array.from(consentRecords),
        moderationActions: Array.from(moderationActions)
      },
      files,
      hash: await this.generatePackHash(events, files)
    };

    // Log evidence pack generation
    await this.logEvent({
      eventType: AuditEventType.EVIDENCE_PACK_GENERATED,
      userId: request.requestedBy,
      data: {
        packId,
        type: request.type,
        subjectId: request.subjectId,
        eventCount: events.length,
        fileCount: files.length
      },
      metadata: {}
    });

    return evidencePack;
  }

  async verifyConsentHash(sceneHash: string, participantSignatures: string[]): Promise<boolean> {
    // Verify that all required participants have signed consent for the scene
    const consentEvents = await this.getEvents({
      eventTypes: [AuditEventType.CONSENT_SIGNED],
      limit: 1000
    });

    const sceneConsents = consentEvents.filter(event => 
      event.data.sceneHash === sceneHash
    );

    // Check that all required signatures are present
    const signedParticipants = new Set(
      sceneConsents.map(event => event.walletAddress).filter(Boolean)
    );

    return participantSignatures.every(signature => {
      // In production, verify the signature cryptographically
      return sceneConsents.some(event => 
        event.metadata.signature === signature
      );
    });
  }

  async trackWatermarkSession(sessionData: {
    contentId: string;
    userId: string;
    sessionId: string;
    watermarkId: string;
    playbackToken: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.WATERMARK_APPLIED,
      userId: sessionData.userId,
      contentId: sessionData.contentId,
      sessionId: sessionData.sessionId,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      data: {
        watermarkId: sessionData.watermarkId,
        playbackToken: sessionData.playbackToken
      },
      metadata: {}
    });
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generatePackId(): string {
    return `pack_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private async persistEvent(event: AuditEvent): Promise<void> {
    // In production, save to database with proper indexing
    // await db.auditEvents.create(event);
  }

  private async generateAuditLogFile(events: AuditEvent[]): Promise<EvidenceFile> {
    const content = JSON.stringify(events, null, 2);
    const hash = await this.hashContent(content);
    
    return {
      id: `file_${Date.now()}_audit_log`,
      filename: `audit_log_${new Date().toISOString().split('T')[0]}.json`,
      type: 'audit_log',
      size: content.length,
      hash,
      encrypted: false
    };
  }

  private async getKYCDocuments(userId: string): Promise<EvidenceFile[]> {
    // In production, fetch KYC documents from secure storage
    return [];
  }

  private async getContentMetadataFiles(contentIds: string[]): Promise<EvidenceFile[]> {
    // In production, fetch content metadata files
    return [];
  }

  private async getConsentDocuments(consentRecordIds: string[]): Promise<EvidenceFile[]> {
    // In production, fetch consent documents
    return [];
  }

  private async generatePackHash(events: AuditEvent[], files: EvidenceFile[]): Promise<string> {
    const content = JSON.stringify({ events, files });
    return this.hashContent(content);
  }

  private async hashContent(content: string): Promise<string> {
    // In production, use proper cryptographic hashing
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

// Singleton instance
export const auditTrail = new AuditTrailService();

// Utility functions for common audit events
export async function logUserLogin(userId: string, walletAddress: string, ipAddress: string, userAgent: string) {
  return auditTrail.logEvent({
    eventType: AuditEventType.USER_LOGIN,
    userId,
    walletAddress,
    ipAddress,
    userAgent,
    data: { loginMethod: 'wallet' },
    metadata: {}
  });
}

export async function logContentAccess(contentId: string, userId: string, sessionId: string, ipAddress: string) {
  return auditTrail.logEvent({
    eventType: AuditEventType.CONTENT_ACCESSED,
    userId,
    contentId,
    sessionId,
    ipAddress,
    data: { accessType: 'view' },
    metadata: {}
  });
}

export async function logPaymentCompleted(
  userId: string, 
  contentId: string, 
  amount: number, 
  transactionHash: string,
  blockNumber: number
) {
  return auditTrail.logEvent({
    eventType: AuditEventType.PAYMENT_COMPLETED,
    userId,
    contentId,
    data: { amount, currency: 'USDC' },
    metadata: { transactionHash, blockNumber }
  });
}

export async function logConsentSigned(
  sceneHash: string,
  participantWallet: string,
  signature: string,
  ipAddress: string
) {
  return auditTrail.logEvent({
    eventType: AuditEventType.CONSENT_SIGNED,
    walletAddress: participantWallet,
    ipAddress,
    data: { sceneHash, role: 'performer' },
    metadata: { signature }
  });
}

export async function logModerationDecision(
  contentId: string,
  moderatorId: string,
  decision: 'approved' | 'rejected',
  reason?: string
) {
  return auditTrail.logEvent({
    eventType: AuditEventType.MODERATION_DECISION_MADE,
    userId: moderatorId,
    contentId,
    data: { decision, reason },
    metadata: {}
  });
}