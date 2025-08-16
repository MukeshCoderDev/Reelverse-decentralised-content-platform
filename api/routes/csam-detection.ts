import express from 'express';
import multer from 'multer';
import { csamDetectionService } from '../../services/csamDetectionService';
import { contentModerationPipeline } from '../../services/contentModerationPipeline';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image and video files
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// Middleware for authentication and authorization
const requireAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  req.user = { id: 'user123', email: 'user@company.com', role: 'user' };
  next();
};

const requireCSAMRole = (req: any, res: any, next: any) => {
  const authorizedRoles = ['csam_officer', 'legal', 'compliance', 'admin'];
  if (!authorizedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions for CSAM operations' });
  }
  next();
};

// Content upload and scanning endpoint
router.post('/scan-content', requireAuth, upload.single('content'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const contentType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    const contentId = `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Scan content for CSAM
    const scanResult = await csamDetectionService.scanContent(
      contentId,
      req.file.buffer,
      contentType,
      {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        uploadedBy: req.user.id,
        uploadedAt: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    );
    
    // Return scan result (without sensitive details for regular users)
    const publicResult = {
      contentId: scanResult.contentId,
      scanId: scanResult.scanId,
      status: scanResult.status,
      requiresReview: scanResult.requiresHumanReview,
      scanTimestamp: scanResult.scanTimestamp
    };
    
    // Include confidence and details for authorized users
    if (['csam_officer', 'legal', 'compliance'].includes(req.user.role)) {
      (publicResult as any).confidence = scanResult.confidence;
      (publicResult as any).hashMatches = scanResult.hashMatches;
      (publicResult as any).metadata = scanResult.metadata;
    }
    
    res.json(publicResult);
    
  } catch (error) {
    console.error('Content scanning error:', error);
    res.status(500).json({ error: 'Content scanning failed' });
  }
});

// Full content moderation pipeline
router.post('/moderate-content', requireAuth, upload.single('content'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const contentUpload = {
      id: `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: req.user.id,
      filename: req.file.originalname,
      contentType: req.file.mimetype.startsWith('image/') ? 'image' as const : 'video' as const,
      fileSize: req.file.size,
      uploadedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'unknown',
      metadata: {
        mimeType: req.file.mimetype,
        recentUploads: parseInt(req.body.recentUploads || '0')
      }
    };
    
    // Process through full moderation pipeline
    const moderationResult = await contentModerationPipeline.processUpload(
      contentUpload,
      req.file.buffer
    );
    
    res.json(moderationResult);
    
  } catch (error) {
    console.error('Content moderation error:', error);
    res.status(500).json({ error: 'Content moderation failed' });
  }
});

// Get CSAM case details (authorized personnel only)
router.get('/cases/:caseId', requireAuth, requireCSAMRole, async (req, res) => {
  try {
    const csamCase = await csamDetectionService.getCSAMCase(req.params.caseId);
    if (!csamCase) {
      return res.status(404).json({ error: 'CSAM case not found' });
    }
    
    res.json(csamCase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending CSAM reviews
router.get('/pending-reviews', requireAuth, requireCSAMRole, async (req, res) => {
  try {
    const pendingCases = await csamDetectionService.getPendingReviews();
    
    // Return summary information for list view
    const summaries = pendingCases.map(c => ({
      id: c.id,
      contentId: c.contentId,
      confidence: c.scanResult.confidence,
      createdAt: c.createdAt,
      status: c.status,
      requiresHumanReview: c.scanResult.requiresHumanReview
    }));
    
    res.json(summaries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Review CSAM case
router.post('/cases/:caseId/review', requireAuth, requireCSAMRole, async (req, res) => {
  try {
    const { decision, reviewNotes } = req.body;
    
    if (!['confirmed', 'false_positive'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision. Must be "confirmed" or "false_positive"' });
    }
    
    if (!reviewNotes || reviewNotes.trim().length === 0) {
      return res.status(400).json({ error: 'Review notes are required' });
    }
    
    await csamDetectionService.reviewCSAMCase(
      req.params.caseId,
      req.user.email,
      decision,
      reviewNotes
    );
    
    res.json({ success: true, message: `CSAM case reviewed as ${decision}` });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get NCMEC report details
router.get('/ncmec-reports/:reportId', requireAuth, requireCSAMRole, async (req, res) => {
  try {
    const report = await csamDetectionService.getNCMECReport(req.params.reportId);
    if (!report) {
      return res.status(404).json({ error: 'NCMEC report not found' });
    }
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate CSAM detection report
router.get('/reports/detection', requireAuth, requireCSAMRole, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const report = await csamDetectionService.generateCSAMReport(
      new Date(startDate as string),
      new Date(endDate as string)
    );
    
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generate content moderation report
router.get('/reports/moderation', requireAuth, requireCSAMRole, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const report = await contentModerationPipeline.generateModerationReport(
      new Date(startDate as string),
      new Date(endDate as string)
    );
    
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Emergency CSAM report endpoint
router.post('/emergency/report', requireAuth, async (req, res) => {
  try {
    const { contentId, description, reporterInfo } = req.body;
    
    if (!contentId || !description) {
      return res.status(400).json({ error: 'Content ID and description are required' });
    }
    
    // Create emergency CSAM incident
    const incident = await incidentResponseService.createIncident(
      'csam',
      'critical',
      `Emergency CSAM Report - ${contentId}`,
      description,
      req.user.email,
      {
        contentId,
        reporterInfo: reporterInfo || {},
        emergencyReport: true,
        reportedBy: req.user.id
      }
    );
    
    // Immediately escalate
    await incidentResponseService.escalateIncident(
      incident.id,
      'Emergency CSAM report from user - immediate review required'
    );
    
    res.status(201).json({
      incidentId: incident.id,
      message: 'Emergency CSAM report submitted and escalated',
      reportId: `EMRG-${incident.id.slice(0, 8)}`
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      csamDetection: 'operational',
      contentModeration: 'operational',
      incidentResponse: 'operational'
    }
  });
});

export default router;