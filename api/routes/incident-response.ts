import express from 'express';
import { incidentResponseService } from '../../services/incidentResponseService';
import { legalDocumentService } from '../../services/legalDocumentService';

const router = express.Router();

// Middleware for authentication and authorization
const requireAuth = (req: any, res: any, next: any) => {
  // Mock authentication - would integrate with actual auth system
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Mock user extraction
  req.user = { id: 'user123', email: 'user@company.com', role: 'compliance' };
  next();
};

const requireRole = (roles: string[]) => (req: any, res: any, next: any) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// Create incident
router.post('/incidents', requireAuth, requireRole(['compliance', 'legal', 'security']), async (req, res) => {
  try {
    const { type, severity, title, description, metadata } = req.body;
    
    const incident = await incidentResponseService.createIncident(
      type,
      severity,
      title,
      description,
      req.user.email,
      metadata
    );
    
    res.status(201).json(incident);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get incident
router.get('/incidents/:id', requireAuth, async (req, res) => {
  try {
    const incident = await incidentResponseService.getIncident(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    res.json(incident);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update incident status
router.patch('/incidents/:id/status', requireAuth, requireRole(['compliance', 'legal']), async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    await incidentResponseService.updateIncidentStatus(
      req.params.id,
      status,
      req.user.email,
      notes
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Escalate incident
router.post('/incidents/:id/escalate', requireAuth, requireRole(['compliance', 'legal']), async (req, res) => {
  try {
    const { reason } = req.body;
    
    await incidentResponseService.escalateIncident(req.params.id, reason);
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create LEA request
router.post('/lea-requests', requireAuth, requireRole(['legal']), async (req, res) => {
  try {
    const {
      incidentId,
      requestingAgency,
      contactInfo,
      requestType,
      urgency,
      legalBasis,
      requestDetails,
      targetUsers,
      dataRequested,
      responseDeadline
    } = req.body;
    
    const leaRequest = await incidentResponseService.createLEARequest(
      incidentId,
      requestingAgency,
      contactInfo,
      requestType,
      urgency,
      legalBasis,
      requestDetails,
      targetUsers,
      dataRequested,
      new Date(responseDeadline)
    );
    
    res.status(201).json(leaRequest);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Process LEA request
router.patch('/lea-requests/:id/process', requireAuth, requireRole(['legal']), async (req, res) => {
  try {
    const { responseData, status } = req.body;
    
    await incidentResponseService.processLEARequest(
      req.params.id,
      req.user.email,
      responseData,
      status
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create takedown request
router.post('/takedown-requests', requireAuth, async (req, res) => {
  try {
    const {
      contentIds,
      requestType,
      requestorInfo,
      legalBasis,
      requestDetails
    } = req.body;
    
    const takedownRequest = await incidentResponseService.createTakedownRequest(
      contentIds,
      requestType,
      requestorInfo,
      legalBasis,
      requestDetails
    );
    
    res.status(201).json(takedownRequest);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Process takedown request
router.patch('/takedown-requests/:id/process', requireAuth, requireRole(['compliance', 'legal']), async (req, res) => {
  try {
    const { actionTaken, status } = req.body;
    
    await incidentResponseService.processTakedown(
      req.params.id,
      req.user.email,
      actionTaken,
      status
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create evidence package
router.post('/evidence-packages', requireAuth, requireRole(['legal', 'compliance']), async (req, res) => {
  try {
    const { incidentId, caseNumber, evidenceItems, accessRestrictions } = req.body;
    
    const evidencePackage = await legalDocumentService.createEvidencePackage(
      incidentId,
      caseNumber,
      req.user.email,
      evidenceItems,
      accessRestrictions
    );
    
    res.status(201).json(evidencePackage);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Access evidence package
router.get('/evidence-packages/:id', requireAuth, requireRole(['legal', 'compliance']), async (req, res) => {
  try {
    const evidencePackage = await legalDocumentService.accessEvidencePackage(
      req.params.id,
      req.user.email,
      req.ip,
      req.get('User-Agent') || 'unknown'
    );
    
    res.json(evidencePackage);
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// Verify evidence integrity
router.post('/evidence-packages/:id/verify', requireAuth, requireRole(['legal', 'compliance']), async (req, res) => {
  try {
    const isValid = await legalDocumentService.verifyEvidenceIntegrity(req.params.id);
    
    res.json({ valid: isValid });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generate compliance report
router.get('/compliance-report', requireAuth, requireRole(['compliance', 'legal']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const report = await incidentResponseService.generateComplianceReport(
      new Date(startDate as string),
      new Date(endDate as string)
    );
    
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generate LEA response document
router.post('/lea-responses', requireAuth, requireRole(['legal']), async (req, res) => {
  try {
    const { leaRequestId, responseData } = req.body;
    
    const responseDocument = await legalDocumentService.generateLEAResponse(
      leaRequestId,
      responseData,
      req.user.email
    );
    
    res.status(201).json(responseDocument);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Emergency endpoints for critical incidents
router.post('/emergency/csam-report', requireAuth, async (req, res) => {
  try {
    const { contentId, reporterInfo, description } = req.body;
    
    // Create critical CSAM incident
    const incident = await incidentResponseService.createIncident(
      'csam',
      'critical',
      `CSAM Report - Content ${contentId}`,
      description,
      req.user.email,
      { contentId, reporterInfo, emergencyReport: true }
    );
    
    // Immediately escalate
    await incidentResponseService.escalateIncident(
      incident.id,
      'Emergency CSAM report - immediate escalation required'
    );
    
    res.status(201).json({ 
      incidentId: incident.id,
      message: 'CSAM report processed and escalated',
      emergencyProtocol: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/emergency/security-breach', requireAuth, requireRole(['security']), async (req, res) => {
  try {
    const { breachType, affectedSystems, description } = req.body;
    
    const incident = await incidentResponseService.createIncident(
      'security',
      'critical',
      `Security Breach - ${breachType}`,
      description,
      req.user.email,
      { breachType, affectedSystems, emergencyReport: true }
    );
    
    await incidentResponseService.escalateIncident(
      incident.id,
      'Emergency security breach - immediate response required'
    );
    
    res.status(201).json({
      incidentId: incident.id,
      message: 'Security breach reported and escalated',
      emergencyProtocol: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;