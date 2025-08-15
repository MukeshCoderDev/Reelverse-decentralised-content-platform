/**
 * Evidence Pack Generator for Legal Compliance
 * Generates comprehensive evidence packages for legal requests, DMCA claims, and compliance audits
 */

import { AuditLogger, AuditEvent, AuditEventType, AuditQuery } from './AuditLogger';
import JSZip from 'jszip';

export interface EvidencePackRequest {
  type: 'legal_request' | 'dmca_claim' | 'compliance_audit' | 'user_data_export';
  requestId: string;
  requestedBy: string;
  requestDate: number;
  
  // Scope of evidence
  userId?: string;
  walletAddress?: string;
  contentId?: string;
  organizationId?: string;
  
  // Time range
  startDate?: number;
  endDate?: number;
  
  // Specific event types to include
  eventTypes?: AuditEventType[];
  
  // Additional context
  legalBasis?: string;
  jurisdiction?: string;
  caseNumber?: string;
  notes?: string;
}

export interface EvidencePackMetadata {
  packId: string;
  generatedAt: number;
  generatedBy: string;
  request: EvidencePackRequest;
  
  // Content summary
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  dateRange: {
    earliest: number;
    latest: number;
  };
  
  // Integrity information
  chainVerification: {
    verified: boolean;
    details: string;
  };
  
  // Files included
  files: Array<{
    name: string;
    type: string;
    size: number;
    hash: string;
  }>;
}

export interface ConsentEvidence {
  sceneHash: string;
  participants: Array<{
    walletAddress: string;
    role: string;
    consentGranted: boolean;
    consentTimestamp?: number;
    consentRevoked?: boolean;
    revokedTimestamp?: number;
    signatureHash: string;
  }>;
  contentId?: string;
  uploadTimestamp?: number;
  publishTimestamp?: number;
}

export interface WatermarkEvidence {
  contentId: string;
  sessions: Array<{
    sessionId: string;
    userId: string;
    walletAddress: string;
    watermarkId: string;
    startTime: number;
    endTime?: number;
    ipAddress?: string;
    userAgent?: string;
    bytesStreamed?: number;
  }>;
}

export interface PaymentEvidence {
  transactions: Array<{
    transactionHash: string;
    blockNumber?: number;
    timestamp: number;
    from: string;
    to: string;
    amount: string;
    currency: string;
    contentId?: string;
    paymentMethod: string;
    revenueSplit?: {
      creatorAmount: string;
      platformAmount: string;
    };
  }>;
}

export class EvidencePackGenerator {
  private auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  /**
   * Generate a comprehensive evidence pack
   */
  async generateEvidencePack(request: EvidencePackRequest): Promise<{
    packId: string;
    zipBuffer: ArrayBuffer;
    metadata: EvidencePackMetadata;
  }> {
    const packId = this.generatePackId();
    
    // Log the evidence pack generation
    await this.auditLogger.logEvent(
      AuditEventType.AUDIT_PACK_GENERATED,
      {
        packId,
        requestType: request.type,
        requestedBy: request.requestedBy,
        scope: {
          userId: request.userId,
          contentId: request.contentId,
          organizationId: request.organizationId
        }
      },
      {
        severity: 'high',
        userId: request.requestedBy,
        source: 'evidence_generator'
      }
    );

    // Query relevant audit events
    const auditQuery: AuditQuery = {
      userId: request.userId,
      walletAddress: request.walletAddress,
      contentId: request.contentId,
      organizationId: request.organizationId,
      startTime: request.startDate,
      endTime: request.endDate,
      eventTypes: request.eventTypes
    };

    const events = await this.auditLogger.queryEvents(auditQuery);
    
    // Verify event chain integrity
    const chainVerification = events.length > 0 
      ? await this.auditLogger.verifyEventChain(events[0].id, events[events.length - 1].id)
      : { valid: true, details: 'No events to verify' };

    // Create ZIP package
    const zip = new JSZip();
    const files: Array<{ name: string; type: string; size: number; hash: string }> = [];

    // Add main audit log
    const auditLogContent = this.generateAuditLogReport(events);
    zip.file('audit_log.json', auditLogContent);
    files.push({
      name: 'audit_log.json',
      type: 'application/json',
      size: auditLogContent.length,
      hash: await this.generateFileHash(auditLogContent)
    });

    // Add human-readable summary
    const summaryContent = this.generateSummaryReport(events, request);
    zip.file('summary_report.txt', summaryContent);
    files.push({
      name: 'summary_report.txt',
      type: 'text/plain',
      size: summaryContent.length,
      hash: await this.generateFileHash(summaryContent)
    });

    // Add consent evidence if relevant
    if (this.shouldIncludeConsentEvidence(request, events)) {
      const consentEvidence = await this.generateConsentEvidence(request, events);
      const consentContent = JSON.stringify(consentEvidence, null, 2);
      zip.file('consent_evidence.json', consentContent);
      files.push({
        name: 'consent_evidence.json',
        type: 'application/json',
        size: consentContent.length,
        hash: await this.generateFileHash(consentContent)
      });
    }

    // Add watermark evidence if relevant
    if (this.shouldIncludeWatermarkEvidence(request, events)) {
      const watermarkEvidence = await this.generateWatermarkEvidence(request, events);
      const watermarkContent = JSON.stringify(watermarkEvidence, null, 2);
      zip.file('watermark_evidence.json', watermarkContent);
      files.push({
        name: 'watermark_evidence.json',
        type: 'application/json',
        size: watermarkContent.length,
        hash: await this.generateFileHash(watermarkContent)
      });
    }

    // Add payment evidence if relevant
    if (this.shouldIncludePaymentEvidence(request, events)) {
      const paymentEvidence = await this.generatePaymentEvidence(request, events);
      const paymentContent = JSON.stringify(paymentEvidence, null, 2);
      zip.file('payment_evidence.json', paymentContent);
      files.push({
        name: 'payment_evidence.json',
        type: 'application/json',
        size: paymentContent.length,
        hash: await this.generateFileHash(paymentContent)
      });
    }

    // Add chain verification report
    const verificationContent = JSON.stringify(chainVerification, null, 2);
    zip.file('chain_verification.json', verificationContent);
    files.push({
      name: 'chain_verification.json',
      type: 'application/json',
      size: verificationContent.length,
      hash: await this.generateFileHash(verificationContent)
    });

    // Generate metadata
    const metadata: EvidencePackMetadata = {
      packId,
      generatedAt: Date.now(),
      generatedBy: request.requestedBy,
      request,
      totalEvents: events.length,
      eventsByType: this.countEventsByType(events),
      dateRange: this.getDateRange(events),
      chainVerification,
      files
    };

    // Add metadata file
    const metadataContent = JSON.stringify(metadata, null, 2);
    zip.file('metadata.json', metadataContent);

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    return {
      packId,
      zipBuffer,
      metadata
    };
  }

  /**
   * Generate consent evidence for a specific content or scene
   */
  async generateConsentEvidence(
    request: EvidencePackRequest,
    events: AuditEvent[]
  ): Promise<ConsentEvidence[]> {
    const consentEvents = events.filter(event => 
      event.eventType === AuditEventType.CONSENT_GRANTED ||
      event.eventType === AuditEventType.CONSENT_REVOKED ||
      event.eventType === AuditEventType.CONSENT_REQUESTED
    );

    // Group by scene hash
    const sceneGroups = new Map<string, AuditEvent[]>();
    consentEvents.forEach(event => {
      const sceneHash = event.data.sceneHash;
      if (sceneHash) {
        if (!sceneGroups.has(sceneHash)) {
          sceneGroups.set(sceneHash, []);
        }
        sceneGroups.get(sceneHash)!.push(event);
      }
    });

    const consentEvidence: ConsentEvidence[] = [];

    for (const [sceneHash, sceneEvents] of sceneGroups) {
      // Group by participant
      const participantMap = new Map<string, any>();
      
      sceneEvents.forEach(event => {
        const wallet = event.data.participantWallet || event.walletAddress;
        if (wallet) {
          if (!participantMap.has(wallet)) {
            participantMap.set(wallet, {
              walletAddress: wallet,
              role: event.data.role || 'performer',
              consentGranted: false,
              consentRevoked: false
            });
          }

          const participant = participantMap.get(wallet);
          
          if (event.eventType === AuditEventType.CONSENT_GRANTED) {
            participant.consentGranted = true;
            participant.consentTimestamp = event.timestamp;
            participant.signatureHash = event.data.signatureHash;
          } else if (event.eventType === AuditEventType.CONSENT_REVOKED) {
            participant.consentRevoked = true;
            participant.revokedTimestamp = event.timestamp;
          }
        }
      });

      consentEvidence.push({
        sceneHash,
        participants: Array.from(participantMap.values()),
        contentId: request.contentId
      });
    }

    return consentEvidence;
  }

  /**
   * Generate watermark evidence for content access tracking
   */
  async generateWatermarkEvidence(
    request: EvidencePackRequest,
    events: AuditEvent[]
  ): Promise<WatermarkEvidence[]> {
    const viewEvents = events.filter(event => 
      event.eventType === AuditEventType.CONTENT_VIEWED
    );

    // Group by content ID
    const contentGroups = new Map<string, AuditEvent[]>();
    viewEvents.forEach(event => {
      const contentId = event.contentId;
      if (contentId) {
        if (!contentGroups.has(contentId)) {
          contentGroups.set(contentId, []);
        }
        contentGroups.get(contentId)!.push(event);
      }
    });

    const watermarkEvidence: WatermarkEvidence[] = [];

    for (const [contentId, contentEvents] of contentGroups) {
      const sessions = contentEvents.map(event => ({
        sessionId: event.sessionId || 'unknown',
        userId: event.userId || 'unknown',
        walletAddress: event.walletAddress || 'unknown',
        watermarkId: event.data.watermarkId || 'unknown',
        startTime: event.timestamp,
        endTime: event.data.endTime,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        bytesStreamed: event.data.bytesStreamed
      }));

      watermarkEvidence.push({
        contentId,
        sessions
      });
    }

    return watermarkEvidence;
  }

  /**
   * Generate payment evidence for financial transactions
   */
  async generatePaymentEvidence(
    request: EvidencePackRequest,
    events: AuditEvent[]
  ): Promise<PaymentEvidence> {
    const paymentEvents = events.filter(event => 
      event.eventType === AuditEventType.PAYMENT_COMPLETED ||
      event.eventType === AuditEventType.REVENUE_SPLIT
    );

    const transactions = paymentEvents.map(event => ({
      transactionHash: event.data.transactionHash || 'unknown',
      blockNumber: event.data.blockNumber,
      timestamp: event.timestamp,
      from: event.data.from || event.walletAddress || 'unknown',
      to: event.data.to || 'unknown',
      amount: event.data.amount || '0',
      currency: event.data.currency || 'USDC',
      contentId: event.contentId,
      paymentMethod: event.data.paymentMethod || 'crypto',
      revenueSplit: event.data.revenueSplit
    }));

    return { transactions };
  }

  private generatePackId(): string {
    return `evidence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAuditLogReport(events: AuditEvent[]): string {
    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      totalEvents: events.length,
      events: events.map(event => ({
        ...event,
        timestampISO: new Date(event.timestamp).toISOString()
      }))
    }, null, 2);
  }

  private generateSummaryReport(events: AuditEvent[], request: EvidencePackRequest): string {
    const summary = [
      'EVIDENCE PACK SUMMARY REPORT',
      '================================',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Request ID: ${request.requestId}`,
      `Request Type: ${request.type}`,
      `Requested By: ${request.requestedBy}`,
      '',
      'SCOPE:',
      `- User ID: ${request.userId || 'N/A'}`,
      `- Wallet Address: ${request.walletAddress || 'N/A'}`,
      `- Content ID: ${request.contentId || 'N/A'}`,
      `- Organization ID: ${request.organizationId || 'N/A'}`,
      '',
      'TIME RANGE:',
      `- Start: ${request.startDate ? new Date(request.startDate).toISOString() : 'N/A'}`,
      `- End: ${request.endDate ? new Date(request.endDate).toISOString() : 'N/A'}`,
      '',
      'EVENTS SUMMARY:',
      `- Total Events: ${events.length}`,
      ''
    ];

    // Add event type breakdown
    const eventsByType = this.countEventsByType(events);
    Object.entries(eventsByType).forEach(([type, count]) => {
      summary.push(`- ${type}: ${count}`);
    });

    summary.push('');
    summary.push('LEGAL BASIS:');
    summary.push(`- Basis: ${request.legalBasis || 'N/A'}`);
    summary.push(`- Jurisdiction: ${request.jurisdiction || 'N/A'}`);
    summary.push(`- Case Number: ${request.caseNumber || 'N/A'}`);

    if (request.notes) {
      summary.push('');
      summary.push('NOTES:');
      summary.push(request.notes);
    }

    return summary.join('\n');
  }

  private countEventsByType(events: AuditEvent[]): Record<AuditEventType, number> {
    const counts: Record<AuditEventType, number> = {} as any;
    
    events.forEach(event => {
      counts[event.eventType] = (counts[event.eventType] || 0) + 1;
    });

    return counts;
  }

  private getDateRange(events: AuditEvent[]): { earliest: number; latest: number } {
    if (events.length === 0) {
      const now = Date.now();
      return { earliest: now, latest: now };
    }

    const timestamps = events.map(e => e.timestamp);
    return {
      earliest: Math.min(...timestamps),
      latest: Math.max(...timestamps)
    };
  }

  private shouldIncludeConsentEvidence(request: EvidencePackRequest, events: AuditEvent[]): boolean {
    return events.some(event => 
      event.eventType === AuditEventType.CONSENT_GRANTED ||
      event.eventType === AuditEventType.CONSENT_REVOKED
    );
  }

  private shouldIncludeWatermarkEvidence(request: EvidencePackRequest, events: AuditEvent[]): boolean {
    return events.some(event => 
      event.eventType === AuditEventType.CONTENT_VIEWED &&
      event.data.watermarkId
    );
  }

  private shouldIncludePaymentEvidence(request: EvidencePackRequest, events: AuditEvent[]): boolean {
    return events.some(event => 
      event.eventType === AuditEventType.PAYMENT_COMPLETED ||
      event.eventType === AuditEventType.REVENUE_SPLIT
    );
  }

  private async generateFileHash(content: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback simple hash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}