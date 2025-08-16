import { v4 as uuidv4 } from 'uuid';

export interface Incident {
  id: string;
  type: 'dmca' | 'csam' | 'lea_request' | 'sanctions' | 'security' | 'compliance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'escalated' | 'resolved' | 'closed';
  title: string;
  description: string;
  reportedBy: string;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  metadata: Record<string, any>;
  timeline: IncidentTimelineEntry[];
  evidenceIds: string[];
}

export interface IncidentTimelineEntry {
  id: string;
  timestamp: Date;
  action: string;
  performedBy: string;
  details: string;
  metadata?: Record<string, any>;
}

export interface LEARequest {
  id: string;
  incidentId: string;
  requestingAgency: string;
  contactInfo: {
    name: string;
    email: string;
    phone: string;
    badgeNumber?: string;
  };
  requestType: 'preservation' | 'disclosure' | 'emergency' | 'subpoena' | 'warrant';
  urgency: 'routine' | 'expedited' | 'emergency';
  legalBasis: string;
  requestDetails: string;
  targetUsers: string[];
  dataRequested: string[];
  receivedAt: Date;
  responseDeadline: Date;
  status: 'received' | 'under_review' | 'legal_review' | 'responded' | 'closed';
  responseData?: string;
  legalHoldApplied: boolean;
}

export interface TakedownRequest {
  id: string;
  incidentId: string;
  requestType: 'dmca' | 'court_order' | 'tos_violation' | 'csam';
  contentIds: string[];
  requestorInfo: {
    name: string;
    email: string;
    organization?: string;
    relationship: 'copyright_holder' | 'authorized_agent' | 'court' | 'law_enforcement';
  };
  legalBasis: string;
  requestDetails: string;
  receivedAt: Date;
  processedAt?: Date;
  status: 'received' | 'processing' | 'completed' | 'disputed' | 'rejected';
  actionTaken?: string;
}

export class IncidentResponseService {
  private incidents: Map<string, Incident> = new Map();
  private leaRequests: Map<string, LEARequest> = new Map();
  private takedownRequests: Map<string, TakedownRequest> = new Map();

  async createIncident(
    type: Incident['type'],
    severity: Incident['severity'],
    title: string,
    description: string,
    reportedBy: string,
    metadata: Record<string, any> = {}
  ): Promise<Incident> {
    const incident: Incident = {
      id: uuidv4(),
      type,
      severity,
      status: 'open',
      title,
      description,
      reportedBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
      timeline: [],
      evidenceIds: []
    };

    // Add initial timeline entry
    await this.addTimelineEntry(incident.id, 'incident_created', reportedBy, 'Incident created');

    // Auto-escalate critical incidents
    if (severity === 'critical') {
      await this.escalateIncident(incident.id, 'Auto-escalated due to critical severity');
    }

    this.incidents.set(incident.id, incident);
    
    // Trigger notifications
    await this.notifyIncidentTeam(incident);
    
    return incident;
  }

  async updateIncidentStatus(
    incidentId: string,
    status: Incident['status'],
    updatedBy: string,
    notes?: string
  ): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const previousStatus = incident.status;
    incident.status = status;
    incident.updatedAt = new Date();

    if (status === 'resolved') {
      incident.resolvedAt = new Date();
    }

    await this.addTimelineEntry(
      incidentId,
      'status_changed',
      updatedBy,
      `Status changed from ${previousStatus} to ${status}`,
      { notes, previousStatus }
    );

    this.incidents.set(incidentId, incident);
  }

  async escalateIncident(incidentId: string, reason: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    incident.status = 'escalated';
    incident.updatedAt = new Date();

    await this.addTimelineEntry(
      incidentId,
      'escalated',
      'system',
      `Incident escalated: ${reason}`
    );

    // Notify legal team and management
    await this.notifyEscalationTeam(incident, reason);

    this.incidents.set(incidentId, incident);
  }

  async createLEARequest(
    incidentId: string,
    requestingAgency: string,
    contactInfo: LEARequest['contactInfo'],
    requestType: LEARequest['requestType'],
    urgency: LEARequest['urgency'],
    legalBasis: string,
    requestDetails: string,
    targetUsers: string[],
    dataRequested: string[],
    responseDeadline: Date
  ): Promise<LEARequest> {
    const leaRequest: LEARequest = {
      id: uuidv4(),
      incidentId,
      requestingAgency,
      contactInfo,
      requestType,
      urgency,
      legalBasis,
      requestDetails,
      targetUsers,
      dataRequested,
      receivedAt: new Date(),
      responseDeadline,
      status: 'received',
      legalHoldApplied: false
    };

    // Apply legal hold for preservation requests
    if (requestType === 'preservation' || urgency === 'emergency') {
      await this.applyLegalHold(leaRequest.id, targetUsers);
      leaRequest.legalHoldApplied = true;
    }

    this.leaRequests.set(leaRequest.id, leaRequest);

    // Update incident timeline
    await this.addTimelineEntry(
      incidentId,
      'lea_request_received',
      'system',
      `LEA request received from ${requestingAgency}`,
      { leaRequestId: leaRequest.id, urgency }
    );

    // Notify legal team
    await this.notifyLegalTeam(leaRequest);

    return leaRequest;
  }

  async processLEARequest(
    requestId: string,
    processedBy: string,
    responseData: string,
    status: LEARequest['status'] = 'responded'
  ): Promise<void> {
    const leaRequest = this.leaRequests.get(requestId);
    if (!leaRequest) {
      throw new Error(`LEA request ${requestId} not found`);
    }

    leaRequest.status = status;
    leaRequest.responseData = responseData;

    this.leaRequests.set(requestId, leaRequest);

    // Update incident timeline
    await this.addTimelineEntry(
      leaRequest.incidentId,
      'lea_request_processed',
      processedBy,
      `LEA request processed with status: ${status}`
    );
  }

  async createTakedownRequest(
    contentIds: string[],
    requestType: TakedownRequest['requestType'],
    requestorInfo: TakedownRequest['requestorInfo'],
    legalBasis: string,
    requestDetails: string
  ): Promise<TakedownRequest> {
    // Create associated incident
    const incident = await this.createIncident(
      'dmca',
      'medium',
      `Takedown request for ${contentIds.length} content items`,
      requestDetails,
      requestorInfo.email,
      { contentIds, requestType }
    );

    const takedownRequest: TakedownRequest = {
      id: uuidv4(),
      incidentId: incident.id,
      requestType,
      contentIds,
      requestorInfo,
      legalBasis,
      requestDetails,
      receivedAt: new Date(),
      status: 'received'
    };

    this.takedownRequests.set(takedownRequest.id, takedownRequest);

    // Auto-process CSAM takedowns
    if (requestType === 'csam') {
      await this.processTakedown(takedownRequest.id, 'system', 'Content immediately removed due to CSAM');
    }

    return takedownRequest;
  }

  async processTakedown(
    requestId: string,
    processedBy: string,
    actionTaken: string,
    status: TakedownRequest['status'] = 'completed'
  ): Promise<void> {
    const takedownRequest = this.takedownRequests.get(requestId);
    if (!takedownRequest) {
      throw new Error(`Takedown request ${requestId} not found`);
    }

    takedownRequest.status = status;
    takedownRequest.processedAt = new Date();
    takedownRequest.actionTaken = actionTaken;

    this.takedownRequests.set(requestId, takedownRequest);

    // Update incident
    await this.updateIncidentStatus(
      takedownRequest.incidentId,
      status === 'completed' ? 'resolved' : 'investigating',
      processedBy,
      actionTaken
    );
  }

  private async addTimelineEntry(
    incidentId: string,
    action: string,
    performedBy: string,
    details: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const entry: IncidentTimelineEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      action,
      performedBy,
      details,
      metadata
    };

    incident.timeline.push(entry);
    incident.updatedAt = new Date();
    this.incidents.set(incidentId, incident);
  }

  private async applyLegalHold(requestId: string, targetUsers: string[]): Promise<void> {
    // Implementation would integrate with data retention systems
    console.log(`Legal hold applied for LEA request ${requestId} on users:`, targetUsers);
    
    // In a real implementation, this would:
    // 1. Mark user data for preservation
    // 2. Prevent automated deletion
    // 3. Create audit trail
    // 4. Notify data retention systems
  }

  private async notifyIncidentTeam(incident: Incident): Promise<void> {
    // Implementation would send notifications via Slack, email, etc.
    console.log(`Incident team notified of ${incident.severity} incident: ${incident.title}`);
  }

  private async notifyEscalationTeam(incident: Incident, reason: string): Promise<void> {
    // Implementation would notify legal team and management
    console.log(`Escalation team notified for incident ${incident.id}: ${reason}`);
  }

  private async notifyLegalTeam(leaRequest: LEARequest): Promise<void> {
    // Implementation would notify legal team of LEA request
    console.log(`Legal team notified of ${leaRequest.urgency} LEA request from ${leaRequest.requestingAgency}`);
  }

  // Query methods
  async getIncident(incidentId: string): Promise<Incident | undefined> {
    return this.incidents.get(incidentId);
  }

  async getIncidentsByStatus(status: Incident['status']): Promise<Incident[]> {
    return Array.from(this.incidents.values()).filter(i => i.status === status);
  }

  async getLEARequest(requestId: string): Promise<LEARequest | undefined> {
    return this.leaRequests.get(requestId);
  }

  async getTakedownRequest(requestId: string): Promise<TakedownRequest | undefined> {
    return this.takedownRequests.get(requestId);
  }

  async generateComplianceReport(startDate: Date, endDate: Date): Promise<any> {
    const incidents = Array.from(this.incidents.values())
      .filter(i => i.createdAt >= startDate && i.createdAt <= endDate);
    
    const leaRequests = Array.from(this.leaRequests.values())
      .filter(r => r.receivedAt >= startDate && r.receivedAt <= endDate);
    
    const takedownRequests = Array.from(this.takedownRequests.values())
      .filter(r => r.receivedAt >= startDate && r.receivedAt <= endDate);

    return {
      period: { startDate, endDate },
      summary: {
        totalIncidents: incidents.length,
        incidentsByType: this.groupBy(incidents, 'type'),
        incidentsBySeverity: this.groupBy(incidents, 'severity'),
        totalLEARequests: leaRequests.length,
        leaRequestsByType: this.groupBy(leaRequests, 'requestType'),
        totalTakedowns: takedownRequests.length,
        takedownsByType: this.groupBy(takedownRequests, 'requestType')
      },
      incidents,
      leaRequests,
      takedownRequests
    };
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, number> {
    return array.reduce((acc, item) => {
      const value = String(item[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

export const incidentResponseService = new IncidentResponseService();