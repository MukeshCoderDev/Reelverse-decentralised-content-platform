import express from 'express';
import { auditTrail, AuditEventType } from '../../src/lib/auditTrail';

const router = express.Router();

// Middleware to check admin/compliance officer permissions
const requireComplianceAccess = (req: any, res: any, next: any) => {
  // In production, implement proper role-based access control
  const hasAccess = req.headers['x-compliance-key'] === process.env.COMPLIANCE_KEY ||
                   req.headers['x-admin-key'] === process.env.ADMIN_KEY;
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'Compliance access required' });
  }
  next();
};

// Get audit events with filters
router.get('/events', requireComplianceAccess, async (req, res) => {
  try {
    const {
      userId,
      contentId,
      organizationId,
      eventTypes,
      startTime,
      endTime,
      limit = 100,
      offset = 0
    } = req.query;

    const filters: any = {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    if (userId) filters.userId = userId as string;
    if (contentId) filters.contentId = contentId as string;
    if (organizationId) filters.organizationId = organizationId as string;
    if (startTime) filters.startTime = parseInt(startTime as string);
    if (endTime) filters.endTime = parseInt(endTime as string);
    
    if (eventTypes) {
      const types = (eventTypes as string).split(',') as AuditEventType[];
      filters.eventTypes = types;
    }

    const events = await auditTrail.getEvents(filters);
    
    res.json({
      events,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        hasMore: events.length === filters.limit
      }
    });
  } catch (error) {
    console.error('Error fetching audit events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate evidence pack
router.post('/evidence-pack', requireComplianceAccess, async (req, res) => {
  try {
    const {
      type,
      subjectId,
      timeRange,
      includeFiles = false
    } = req.body;

    if (!type || !subjectId) {
      return res.status(400).json({ 
        error: 'Missing required fields: type, subjectId' 
      });
    }

    if (!['user', 'content', 'organization', 'legal_request'].includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid type. Must be: user, content, organization, or legal_request' 
      });
    }

    const requestedBy = req.user?.id || 'system'; // Get from auth middleware

    const evidencePack = await auditTrail.generateEvidencePack({
      type,
      subjectId,
      timeRange,
      requestedBy,
      includeFiles
    });

    res.json(evidencePack);
  } catch (error) {
    console.error('Error generating evidence pack:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify consent hash
router.post('/verify-consent', requireComplianceAccess, async (req, res) => {
  try {
    const { sceneHash, participantSignatures } = req.body;

    if (!sceneHash || !Array.isArray(participantSignatures)) {
      return res.status(400).json({ 
        error: 'Missing required fields: sceneHash, participantSignatures' 
      });
    }

    const isValid = await auditTrail.verifyConsentHash(sceneHash, participantSignatures);
    
    res.json({ 
      sceneHash,
      isValid,
      verifiedAt: Date.now()
    });
  } catch (error) {
    console.error('Error verifying consent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Track watermark session (called by video player)
router.post('/watermark-session', async (req, res) => {
  try {
    const {
      contentId,
      userId,
      sessionId,
      watermarkId,
      playbackToken
    } = req.body;

    if (!contentId || !userId || !sessionId || !watermarkId) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await auditTrail.trackWatermarkSession({
      contentId,
      userId,
      sessionId,
      watermarkId,
      playbackToken,
      ipAddress,
      userAgent
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking watermark session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get audit statistics
router.get('/stats', requireComplianceAccess, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    let startTime: number;
    const now = Date.now();
    
    switch (timeRange) {
      case '24h':
        startTime = now - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startTime = now - (90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = now - (30 * 24 * 60 * 60 * 1000);
    }

    // Get events for the time range
    const allEvents = await auditTrail.getEvents({
      startTime,
      endTime: now,
      limit: 10000
    });

    // Calculate statistics
    const stats = {
      totalEvents: allEvents.length,
      eventsByType: {} as Record<string, number>,
      uniqueUsers: new Set<string>(),
      uniqueContent: new Set<string>(),
      paymentEvents: 0,
      moderationEvents: 0,
      consentEvents: 0,
      timeRange: {
        start: startTime,
        end: now,
        label: timeRange as string
      }
    };

    allEvents.forEach(event => {
      // Count by type
      stats.eventsByType[event.eventType] = (stats.eventsByType[event.eventType] || 0) + 1;
      
      // Track unique users
      if (event.userId) stats.uniqueUsers.add(event.userId);
      if (event.walletAddress) stats.uniqueUsers.add(event.walletAddress);
      
      // Track unique content
      if (event.contentId) stats.uniqueContent.add(event.contentId);
      
      // Count specific event categories
      if (event.eventType.includes('payment')) stats.paymentEvents++;
      if (event.eventType.includes('moderation')) stats.moderationEvents++;
      if (event.eventType.includes('consent')) stats.consentEvents++;
    });

    res.json({
      ...stats,
      uniqueUsers: stats.uniqueUsers.size,
      uniqueContent: stats.uniqueContent.size
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export audit data (for legal requests)
router.post('/export', requireComplianceAccess, async (req, res) => {
  try {
    const {
      format = 'json',
      filters = {},
      includePersonalData = false
    } = req.body;

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({ 
        error: 'Invalid format. Must be json or csv' 
      });
    }

    const events = await auditTrail.getEvents({
      ...filters,
      limit: 50000 // Large limit for exports
    });

    // Sanitize data if personal data not included
    const sanitizedEvents = includePersonalData ? events : events.map(event => ({
      ...event,
      userId: event.userId ? 'user_' + event.userId.slice(-8) : undefined,
      walletAddress: event.walletAddress ? event.walletAddress.slice(0, 6) + '...' + event.walletAddress.slice(-4) : undefined,
      ipAddress: event.ipAddress ? event.ipAddress.split('.').slice(0, 2).join('.') + '.xxx.xxx' : undefined
    }));

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit_export_${Date.now()}.json"`);
      res.json(sanitizedEvents);
    } else {
      // Convert to CSV
      const csv = convertToCSV(sanitizedEvents);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_export_${Date.now()}.csv"`);
      res.send(csv);
    }
  } catch (error) {
    console.error('Error exporting audit data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to convert events to CSV
function convertToCSV(events: any[]): string {
  if (events.length === 0) return '';
  
  const headers = Object.keys(events[0]).filter(key => typeof events[0][key] !== 'object');
  const csvRows = [headers.join(',')];
  
  events.forEach(event => {
    const row = headers.map(header => {
      const value = event[header];
      return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
    });
    csvRows.push(row.join(','));
  });
  
  return csvRows.join('\n');
}

export default router;