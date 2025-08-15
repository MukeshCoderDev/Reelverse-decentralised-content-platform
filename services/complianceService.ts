/**
 * Compliance and Legal Management Service
 * Handles 2257 records, age verification, geo-blocking, and audit trails
 */

export interface ComplianceRecord {
  id: string;
  contentId: string;
  performerId: string;
  performerName: string;
  dateOfBirth: string;
  ageAtRecording: number;
  recordingDate: string;
  verificationMethod: 'government_id' | 'passport' | 'birth_certificate';
  documentId: string;
  documentUrl?: string;
  custodianName: string;
  custodianAddress: string;
  status: 'pending' | 'verified' | 'expired' | 'invalid';
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface ComplianceViolation {
  id: string;
  type: 'age_verification' | 'geo_restriction' | 'content_policy' | 'dmca' | 'legal_notice';
  severity: 'low' | 'medium' | 'high' | 'critical';
  contentId?: string;
  performerId?: string;
  organizationId?: string;
  description: string;
  detectedAt: string;
  resolvedAt?: string;
  resolution?: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  assignedTo?: string;
  evidence: string[];
  actions: ComplianceAction[];
}

export interface ComplianceAction {
  id: string;
  type: 'content_removal' | 'account_suspension' | 'geo_block' | 'key_revocation' | 'legal_notice';
  description: string;
  executedAt: string;
  executedBy: string;
  reversible: boolean;
  metadata?: Record<string, any>;
}

export interface ComplianceReport {
  id: string;
  type: '2257_report' | 'audit_trail' | 'violation_summary' | 'geo_compliance';
  organizationId?: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  generatedAt: string;
  generatedBy: string;
  status: 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
  metadata: {
    totalRecords: number;
    verifiedRecords: number;
    pendingRecords: number;
    violations: number;
    actions: number;
  };
}

export interface GeoRestriction {
  id: string;
  organizationId?: string;
  contentId?: string;
  restrictedCountries: string[];
  restrictedRegions: string[];
  reason: 'legal_requirement' | 'content_policy' | 'age_verification' | 'custom';
  enableMosaic: boolean; // For Japan
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  organizationId?: string;
}

export class ComplianceService {
  private static instance: ComplianceService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  public static getInstance(): ComplianceService {
    if (!ComplianceService.instance) {
      ComplianceService.instance = new ComplianceService();
    }
    return ComplianceService.instance;
  }

  /**
   * Create 2257 compliance record
   */
  async create2257Record(record: Omit<ComplianceRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ComplianceRecord> {
    try {
      // For demo purposes, create mock record
      const complianceRecord: ComplianceRecord = {
        id: `2257_${Date.now()}`,
        ...record,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('Created 2257 record:', complianceRecord.id);
      return complianceRecord;
    } catch (error) {
      console.error('Error creating 2257 record:', error);
      throw new Error('Failed to create compliance record');
    }
  }

  /**
   * Get compliance records for organization
   */
  async getComplianceRecords(organizationId?: string): Promise<ComplianceRecord[]> {
    try {
      // For demo purposes, return mock records
      const mockRecords: ComplianceRecord[] = [
        {
          id: '2257_001',
          contentId: 'content_123',
          performerId: 'performer_001',
          performerName: 'Jane Doe',
          dateOfBirth: '1995-03-15',
          ageAtRecording: 28,
          recordingDate: '2023-11-15',
          verificationMethod: 'government_id',
          documentId: 'DL123456789',
          custodianName: 'John Smith',
          custodianAddress: '123 Main St, City, State 12345',
          status: 'verified',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: '2257_002',
          contentId: 'content_456',
          performerId: 'performer_002',
          performerName: 'John Smith',
          dateOfBirth: '1992-08-22',
          ageAtRecording: 31,
          recordingDate: '2023-11-10',
          verificationMethod: 'passport',
          documentId: 'P123456789',
          custodianName: 'Jane Doe',
          custodianAddress: '456 Oak Ave, City, State 12345',
          status: 'verified',
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          updatedAt: new Date(Date.now() - 172800000).toISOString()
        }
      ];

      return mockRecords;
    } catch (error) {
      console.error('Error getting compliance records:', error);
      throw new Error('Failed to load compliance records');
    }
  }

  /**
   * Get compliance violations
   */
  async getViolations(organizationId?: string): Promise<ComplianceViolation[]> {
    try {
      // For demo purposes, return mock violations
      const mockViolations: ComplianceViolation[] = [
        {
          id: 'violation_001',
          type: 'age_verification',
          severity: 'high',
          contentId: 'content_789',
          description: 'Missing age verification documentation for performer',
          detectedAt: new Date(Date.now() - 3600000).toISOString(),
          status: 'investigating',
          evidence: ['automated_scan_result.json'],
          actions: []
        },
        {
          id: 'violation_002',
          type: 'geo_restriction',
          severity: 'medium',
          contentId: 'content_101',
          description: 'Content accessed from restricted region without proper geo-blocking',
          detectedAt: new Date(Date.now() - 7200000).toISOString(),
          resolvedAt: new Date(Date.now() - 3600000).toISOString(),
          resolution: 'Geo-blocking rules updated and content access restricted',
          status: 'resolved',
          evidence: ['access_log.txt', 'geo_location_data.json'],
          actions: [
            {
              id: 'action_001',
              type: 'geo_block',
              description: 'Applied geo-blocking for restricted regions',
              executedAt: new Date(Date.now() - 3600000).toISOString(),
              executedBy: 'compliance_officer',
              reversible: true,
              metadata: { regions: ['JP', 'DE'] }
            }
          ]
        }
      ];

      return mockViolations;
    } catch (error) {
      console.error('Error getting violations:', error);
      throw new Error('Failed to load compliance violations');
    }
  }

  /**
   * Create compliance violation
   */
  async createViolation(violation: Omit<ComplianceViolation, 'id' | 'detectedAt' | 'actions'>): Promise<ComplianceViolation> {
    try {
      const newViolation: ComplianceViolation = {
        id: `violation_${Date.now()}`,
        ...violation,
        detectedAt: new Date().toISOString(),
        actions: []
      };

      console.log('Created compliance violation:', newViolation.id);
      return newViolation;
    } catch (error) {
      console.error('Error creating violation:', error);
      throw new Error('Failed to create compliance violation');
    }
  }

  /**
   * Execute compliance action
   */
  async executeAction(
    violationId: string,
    actionType: ComplianceAction['type'],
    description: string,
    metadata?: Record<string, any>
  ): Promise<ComplianceAction> {
    try {
      const action: ComplianceAction = {
        id: `action_${Date.now()}`,
        type: actionType,
        description,
        executedAt: new Date().toISOString(),
        executedBy: 'current_user', // In real app, get from auth context
        reversible: actionType !== 'content_removal',
        metadata
      };

      console.log(`Executed compliance action: ${actionType} for violation ${violationId}`);
      return action;
    } catch (error) {
      console.error('Error executing compliance action:', error);
      throw new Error('Failed to execute compliance action');
    }
  }

  /**
   * Generate compliance report
   */
  async generateReport(
    type: ComplianceReport['type'],
    dateRange: { startDate: string; endDate: string },
    organizationId?: string
  ): Promise<ComplianceReport> {
    try {
      const report: ComplianceReport = {
        id: `report_${Date.now()}`,
        type,
        organizationId,
        dateRange,
        generatedAt: new Date().toISOString(),
        generatedBy: 'current_user',
        status: 'generating',
        metadata: {
          totalRecords: 0,
          verifiedRecords: 0,
          pendingRecords: 0,
          violations: 0,
          actions: 0
        }
      };

      // Simulate report generation
      setTimeout(() => {
        report.status = 'completed';
        report.downloadUrl = `https://demo-cdn.example.com/reports/${report.id}.pdf`;
        report.metadata = {
          totalRecords: 25,
          verifiedRecords: 23,
          pendingRecords: 2,
          violations: 3,
          actions: 5
        };
      }, 3000);

      return report;
    } catch (error) {
      console.error('Error generating report:', error);
      throw new Error('Failed to generate compliance report');
    }
  }

  /**
   * Get geo restrictions
   */
  async getGeoRestrictions(organizationId?: string): Promise<GeoRestriction[]> {
    try {
      // For demo purposes, return mock restrictions
      const mockRestrictions: GeoRestriction[] = [
        {
          id: 'geo_001',
          organizationId,
          restrictedCountries: ['JP', 'DE', 'AU'],
          restrictedRegions: ['EU'],
          reason: 'legal_requirement',
          enableMosaic: true,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: 'geo_002',
          organizationId,
          contentId: 'content_specific',
          restrictedCountries: ['CN', 'KR'],
          restrictedRegions: [],
          reason: 'content_policy',
          enableMosaic: false,
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          updatedAt: new Date(Date.now() - 172800000).toISOString()
        }
      ];

      return mockRestrictions;
    } catch (error) {
      console.error('Error getting geo restrictions:', error);
      throw new Error('Failed to load geo restrictions');
    }
  }

  /**
   * Update geo restrictions
   */
  async updateGeoRestrictions(
    restrictionId: string,
    updates: Partial<GeoRestriction>
  ): Promise<GeoRestriction> {
    try {
      // For demo purposes, return updated restriction
      const updatedRestriction: GeoRestriction = {
        id: restrictionId,
        organizationId: updates.organizationId || 'demo_org',
        contentId: updates.contentId,
        restrictedCountries: updates.restrictedCountries || [],
        restrictedRegions: updates.restrictedRegions || [],
        reason: updates.reason || 'legal_requirement',
        enableMosaic: updates.enableMosaic || false,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('Updated geo restrictions:', restrictionId);
      return updatedRestriction;
    } catch (error) {
      console.error('Error updating geo restrictions:', error);
      throw new Error('Failed to update geo restrictions');
    }
  }

  /**
   * Get audit log
   */
  async getAuditLog(
    organizationId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    try {
      // For demo purposes, return mock audit entries
      const mockEntries: AuditLogEntry[] = [
        {
          id: 'audit_001',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          userId: 'user_123',
          userRole: 'compliance_officer',
          action: 'create_2257_record',
          resource: 'compliance_record',
          resourceId: '2257_001',
          details: { performerName: 'Jane Doe', contentId: 'content_123' },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0...',
          organizationId
        },
        {
          id: 'audit_002',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          userId: 'user_456',
          userRole: 'admin',
          action: 'update_geo_restrictions',
          resource: 'geo_restriction',
          resourceId: 'geo_001',
          details: { addedCountries: ['AU'], enableMosaic: true },
          ipAddress: '192.168.1.101',
          userAgent: 'Mozilla/5.0...',
          organizationId
        },
        {
          id: 'audit_003',
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          userId: 'user_789',
          userRole: 'moderator',
          action: 'execute_compliance_action',
          resource: 'compliance_violation',
          resourceId: 'violation_002',
          details: { actionType: 'geo_block', regions: ['JP', 'DE'] },
          ipAddress: '192.168.1.102',
          userAgent: 'Mozilla/5.0...',
          organizationId
        }
      ];

      return mockEntries.slice(offset, offset + limit);
    } catch (error) {
      console.error('Error getting audit log:', error);
      throw new Error('Failed to load audit log');
    }
  }

  /**
   * Log compliance action
   */
  async logAction(
    action: string,
    resource: string,
    resourceId: string,
    details: Record<string, any>,
    organizationId?: string
  ): Promise<void> {
    try {
      const logEntry: AuditLogEntry = {
        id: `audit_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: 'current_user', // In real app, get from auth context
        userRole: 'user', // In real app, get from auth context
        action,
        resource,
        resourceId,
        details,
        ipAddress: '0.0.0.0', // In real app, get from request
        userAgent: navigator.userAgent,
        organizationId
      };

      console.log('Logged compliance action:', logEntry);
    } catch (error) {
      console.error('Error logging action:', error);
      // Don't throw error for logging failures
    }
  }

  /**
   * Check compliance status
   */
  async checkComplianceStatus(organizationId?: string): Promise<{
    overallStatus: 'compliant' | 'warning' | 'violation';
    issues: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      count: number;
    }>;
    lastAudit: string;
    nextAudit: string;
  }> {
    try {
      // For demo purposes, return mock status
      return {
        overallStatus: 'warning',
        issues: [
          {
            type: 'missing_2257_records',
            severity: 'high',
            description: 'Missing age verification records for recent content',
            count: 2
          },
          {
            type: 'expired_documents',
            severity: 'medium',
            description: 'Some verification documents are nearing expiration',
            count: 3
          },
          {
            type: 'geo_violations',
            severity: 'low',
            description: 'Minor geo-blocking configuration issues',
            count: 1
          }
        ],
        lastAudit: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
        nextAudit: new Date(Date.now() + 2592000000).toISOString() // 30 days from now
      };
    } catch (error) {
      console.error('Error checking compliance status:', error);
      throw new Error('Failed to check compliance status');
    }
  }
}