import express from 'express';
import { hlsKeyRotationService } from '../../services/hlsKeyRotationService';
import { auditLoggingService } from '../../services/auditLoggingService';

const router = express.Router();

// Middleware for authentication and authorization
const requireAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  req.user = { 
    id: 'user123', 
    email: 'streaming@company.com', 
    role: 'streaming_service',
    sessionId: req.headers['x-session-id'] || 'session-123'
  };
  next();
};

const requireStreamingRole = (req: any, res: any, next: any) => {
  const authorizedRoles = ['streaming_service', 'content_admin', 'system_admin'];
  if (!authorizedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions for HLS operations' });
  }
  next();
};

// Initialize encrypted HLS stream
router.post('/streams/:streamId/initialize', requireAuth, requireStreamingRole, async (req, res) => {
  try {
    const { playlistUrl, cdnEndpoints, config } = req.body;

    if (!playlistUrl || !cdnEndpoints || !Array.isArray(cdnEndpoints)) {
      return res.status(400).json({ 
        error: 'Missing required fields: playlistUrl, cdnEndpoints (array)' 
      });
    }

    const streamState = await hlsKeyRotationService.initializeStream(
      req.params.streamId,
      playlistUrl,
      cdnEndpoints,
      config
    );

    // Log stream initialization
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'create',
      'hls_stream',
      req.params.streamId,
      'HLS encrypted stream initialized',
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      {
        playlistUrl,
        cdnEndpoints: cdnEndpoints.length,
        rotationInterval: streamState.rotationConfig.rotationInterval,
        keyMethod: streamState.rotationConfig.keyMethod
      }
    );

    res.status(201).json({
      streamId: streamState.streamId,
      currentKeyId: streamState.currentKeyId,
      rotationConfig: streamState.rotationConfig,
      playlistUrl: streamState.playlistUrl,
      cdnEndpoints: streamState.cdnEndpoints.length,
      lastRotation: streamState.lastRotation
    });
  } catch (error) {
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'create',
      'hls_stream',
      req.params.streamId,
      `Failed to initialize HLS stream: ${error.message}`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      false,
      error.message
    );

    res.status(400).json({ error: error.message });
  }
});

// Get HLS encryption key (for player requests)
router.get('/keys/:keyId', async (req, res) => {
  try {
    const hlsKey = await hlsKeyRotationService.getKeyForPlaylist(req.params.keyId);
    
    if (!hlsKey) {
      return res.status(404).json({ error: 'Key not found or expired' });
    }

    // Log key access (but don't include the actual key value in logs)
    await auditLoggingService.logAction(
      'player',
      'hls_player',
      'read',
      'hls_key',
      req.params.keyId,
      'HLS encryption key accessed by player',
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: 'player-session'
      },
      true,
      undefined,
      {
        streamId: hlsKey.streamId,
        keyMethod: hlsKey.method,
        keyStatus: hlsKey.status
      }
    );

    // Return the raw key bytes for HLS player
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(hlsKey.keyValue);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve encryption key' });
  }
});

// Generate playlist entry with encryption info
router.get('/streams/:streamId/playlist-entry/:segmentNumber', requireAuth, requireStreamingRole, async (req, res) => {
  try {
    const segmentNumber = parseInt(req.params.segmentNumber);
    
    if (isNaN(segmentNumber)) {
      return res.status(400).json({ error: 'Invalid segment number' });
    }

    const playlistEntry = await hlsKeyRotationService.generatePlaylistEntry(
      req.params.streamId,
      segmentNumber
    );

    // Update segment count (may trigger rotation)
    await hlsKeyRotationService.updateSegmentCount(req.params.streamId);

    res.setHeader('Content-Type', 'text/plain');
    res.send(playlistEntry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Manually rotate stream key
router.post('/streams/:streamId/rotate', requireAuth, requireStreamingRole, async (req, res) => {
  try {
    const rotationEvent = await hlsKeyRotationService.rotateStreamKey(
      req.params.streamId,
      'manual'
    );

    // Log manual rotation
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'rotate',
      'hls_key',
      req.params.streamId,
      'Manual HLS key rotation triggered',
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      rotationEvent.success,
      rotationEvent.errorMessage,
      {
        oldKeyId: rotationEvent.oldKeyId,
        newKeyId: rotationEvent.newKeyId,
        affectedSegments: rotationEvent.affectedSegments
      }
    );

    res.json({
      success: rotationEvent.success,
      rotationId: rotationEvent.id,
      oldKeyId: rotationEvent.oldKeyId,
      newKeyId: rotationEvent.newKeyId,
      timestamp: rotationEvent.timestamp,
      affectedSegments: rotationEvent.affectedSegments,
      cdnSyncStatus: rotationEvent.cdnSyncStatus
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Emergency key revocation
router.post('/streams/:streamId/emergency-revoke', requireAuth, requireStreamingRole, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Reason for emergency revocation is required' });
    }

    await hlsKeyRotationService.emergencyKeyRevocation(req.params.streamId, reason);

    // Log emergency revocation
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'delete',
      'hls_key',
      req.params.streamId,
      `Emergency HLS key revocation: ${reason}`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      { reason, emergencyRevocation: true }
    );

    res.json({ 
      success: true, 
      message: 'Emergency key revocation completed',
      reason 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get stream encryption state
router.get('/streams/:streamId', requireAuth, requireStreamingRole, async (req, res) => {
  try {
    const streamState = hlsKeyRotationService.getStreamState(req.params.streamId);
    
    if (!streamState) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    res.json({
      streamId: streamState.streamId,
      currentKeyId: streamState.currentKeyId,
      nextKeyId: streamState.nextKeyId,
      segmentCount: streamState.segmentCount,
      lastRotation: streamState.lastRotation,
      rotationConfig: streamState.rotationConfig,
      playlistUrl: streamState.playlistUrl,
      cdnEndpoints: streamState.cdnEndpoints.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List active streams
router.get('/streams', requireAuth, requireStreamingRole, async (req, res) => {
  try {
    const streams = hlsKeyRotationService.listActiveStreams();
    
    const streamSummaries = streams.map(stream => ({
      streamId: stream.streamId,
      currentKeyId: stream.currentKeyId,
      segmentCount: stream.segmentCount,
      lastRotation: stream.lastRotation,
      rotationInterval: stream.rotationConfig.rotationInterval,
      keyMethod: stream.rotationConfig.keyMethod,
      cdnEndpoints: stream.cdnEndpoints.length
    }));

    res.json(streamSummaries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop encrypted stream
router.delete('/streams/:streamId', requireAuth, requireStreamingRole, async (req, res) => {
  try {
    await hlsKeyRotationService.stopStream(req.params.streamId);

    // Log stream stop
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'delete',
      'hls_stream',
      req.params.streamId,
      'HLS encrypted stream stopped',
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      { streamId: req.params.streamId }
    );

    res.json({ 
      success: true, 
      message: 'Stream stopped and keys expired',
      streamId: req.params.streamId
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get rotation events/history
router.get('/streams/:streamId/rotations', requireAuth, requireStreamingRole, async (req, res) => {
  try {
    const events = hlsKeyRotationService.getRotationEvents(req.params.streamId);
    
    // Return safe information (no key values)
    const safeEvents = events.map(event => ({
      id: event.id,
      streamId: event.streamId,
      rotationType: event.rotationType,
      timestamp: event.timestamp,
      success: event.success,
      errorMessage: event.errorMessage,
      affectedSegments: event.affectedSegments,
      cdnSyncStatus: event.cdnSyncStatus
    }));

    res.json(safeEvents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get rotation metrics
router.get('/metrics/rotation', requireAuth, requireStreamingRole, async (req, res) => {
  try {
    const { streamId, startDate, endDate } = req.query;
    
    const metrics = await hlsKeyRotationService.getRotationMetrics(
      streamId as string,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json(metrics);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get keys requiring rotation
router.get('/maintenance/overdue-rotations', requireAuth, requireStreamingRole, async (req, res) => {
  try {
    const overdueStreams = hlsKeyRotationService.getKeysRequiringRotation();
    
    res.json({
      overdueCount: overdueStreams.length,
      streams: overdueStreams
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cleanup expired keys
router.post('/maintenance/cleanup-expired', requireAuth, requireStreamingRole, async (req, res) => {
  try {
    const cleanedCount = await hlsKeyRotationService.cleanupExpiredKeys();

    // Log cleanup operation
    await auditLoggingService.logAction(
      req.user.email,
      req.user.role,
      'delete',
      'hls_keys',
      'expired_cleanup',
      `Cleaned up ${cleanedCount} expired HLS keys`,
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.user.sessionId
      },
      true,
      undefined,
      { cleanedCount }
    );

    res.json({ 
      success: true, 
      message: `Cleaned up ${cleanedCount} expired keys`,
      cleanedCount 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test key rotation (for development/testing)
router.post('/test/rotation/:streamId', requireAuth, requireStreamingRole, async (req, res) => {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Test endpoints not available in production' });
    }

    const rotationEvent = await hlsKeyRotationService.rotateStreamKey(
      req.params.streamId,
      'manual'
    );

    res.json({
      message: 'Test rotation completed',
      rotationEvent: {
        id: rotationEvent.id,
        success: rotationEvent.success,
        timestamp: rotationEvent.timestamp,
        oldKeyId: rotationEvent.oldKeyId,
        newKeyId: rotationEvent.newKeyId
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Health check
router.get('/health', (req, res) => {
  const activeStreams = hlsKeyRotationService.listActiveStreams();
  const overdueRotations = hlsKeyRotationService.getKeysRequiringRotation();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      hlsEncryption: 'operational',
      keyRotation: 'operational',
      cdnSync: 'operational'
    },
    metrics: {
      activeStreams: activeStreams.length,
      overdueRotations: overdueRotations.length,
      healthStatus: overdueRotations.length === 0 ? 'good' : 'warning'
    }
  });
});

export default router;