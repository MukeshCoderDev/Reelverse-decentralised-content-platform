import { Router } from 'express';
import { aiServiceManager } from '../services/ai/aiServiceManager';
import { getQueueHealth, getQueueStats, autoTaggingQueue, JobPriority, createJobOptions } from '../config/queues';
import { vectorSearchService } from '../services/ai/vectorSearchService';
import { logger } from '../utils/logger';
import { body, query, validationResult } from 'express-validator';

const router = Router();

// AI services health check
router.get('/health', async (req, res) => {
  try {
    const health = await aiServiceManager.healthCheck();
    res.json(health);
  } catch (error) {
    logger.error('AI health check failed', { error: (error as Error).message });
    res.status(503).json({
      status: 'unhealthy',
      error: 'AI services health check failed',
    });
  }
});

// Queue statistics
router.get('/queues/stats', async (req, res) => {
  try {
    const queueHealth = await getQueueHealth();
    res.json({
      status: 'success',
      data: queueHealth,
    });
  } catch (error) {
    logger.error('Failed to get queue stats', { error: (error as Error).message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve queue statistics',
    });
  }
});

// AI service status
router.get('/status', async (req, res) => {
  try {
    const isInitialized = aiServiceManager.isInitialized();
    const health = isInitialized ? await aiServiceManager.healthCheck() : null;
    
    res.json({
      initialized: isInitialized,
      health: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get AI service status', { error: (error as Error).message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve AI service status',
    });
  }
});

// Trigger auto-tagging for content
router.post('/auto-tag', [
  body('contentId').notEmpty().withMessage('Content ID is required'),
  body('mediaUrl').isURL().withMessage('Valid media URL is required'),
  body('existingTags').optional().isArray().withMessage('Existing tags must be an array'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { contentId, mediaUrl, existingTags = [] } = req.body;

    // Queue auto-tagging job
    const job = await autoTaggingQueue.add(
      'auto-tagging',
      {
        jobId: `manual-autotag-${contentId}-${Date.now()}`,
        contentId,
        operation: 'auto-tagging',
        priority: 'high',
        mediaUrl,
        existingTags,
      },
      createJobOptions(JobPriority.HIGH)
    );

    logger.info('Manual auto-tagging job queued', {
      jobId: job.id,
      contentId,
      mediaUrl,
    });

    res.json({
      status: 'success',
      message: 'Auto-tagging job queued successfully',
      data: {
        jobId: job.id,
        contentId,
        queuePosition: await job.getState(),
      },
    });
  } catch (error) {
    logger.error('Failed to queue auto-tagging job', { 
      error: (error as Error).message,
      contentId: req.body.contentId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to queue auto-tagging job',
    });
  }
});

// Get AI tags for content
router.get('/tags/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    
    // This would query the database for AI tags
    // For now, return a placeholder response
    res.json({
      status: 'success',
      data: {
        contentId,
        aiTags: [], // Will be populated from database
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get AI tags', { 
      error: (error as Error).message,
      contentId: req.params.contentId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve AI tags',
    });
  }
});

// Semantic search endpoint
router.get('/search/semantic', [
  query('q').notEmpty().withMessage('Query is required'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().isString(),
  query('creatorId').optional().isString(),
  query('minDuration').optional().isInt({ min: 0 }),
  query('maxDuration').optional().isInt({ min: 0 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { q: query, limit = 20, category, creatorId, minDuration, maxDuration } = req.query;

    const filters: any = {};
    if (category) filters.category = category as string;
    if (creatorId) filters.creatorId = creatorId as string;
    if (minDuration) filters.minDuration = parseInt(minDuration as string);
    if (maxDuration) filters.maxDuration = parseInt(maxDuration as string);

    const results = await vectorSearchService.semanticSearch(query as string, filters);
    
    res.json({
      status: 'success',
      data: {
        query,
        results: results.slice(0, parseInt(limit as string)),
        total: results.length,
        searchType: 'semantic',
      },
    });
  } catch (error) {
    logger.error('Semantic search failed', { 
      error: (error as Error).message,
      query: req.query.q,
    });
    res.status(500).json({
      status: 'error',
      message: 'Semantic search failed',
    });
  }
});

// Hybrid search endpoint
router.get('/search/hybrid', [
  query('q').notEmpty().withMessage('Query is required'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().isString(),
  query('creatorId').optional().isString(),
  query('minDuration').optional().isInt({ min: 0 }),
  query('maxDuration').optional().isInt({ min: 0 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { q: query, limit = 20, category, creatorId, minDuration, maxDuration } = req.query;

    const filters: any = {};
    if (category) filters.category = category as string;
    if (creatorId) filters.creatorId = creatorId as string;
    if (minDuration) filters.minDuration = parseInt(minDuration as string);
    if (maxDuration) filters.maxDuration = parseInt(maxDuration as string);

    const results = await vectorSearchService.hybridSearch(query as string, filters);
    
    res.json({
      status: 'success',
      data: {
        query,
        results: results.slice(0, parseInt(limit as string)),
        total: results.length,
        searchType: 'hybrid',
      },
    });
  } catch (error) {
    logger.error('Hybrid search failed', { 
      error: (error as Error).message,
      query: req.query.q,
    });
    res.status(500).json({
      status: 'error',
      message: 'Hybrid search failed',
    });
  }
});

// Get similar content
router.get('/similar/:contentId', [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { contentId } = req.params;
    const { limit = 10 } = req.query;

    const results = await vectorSearchService.getSimilarContent(contentId, parseInt(limit as string));
    
    res.json({
      status: 'success',
      data: {
        contentId,
        similarContent: results,
        total: results.length,
      },
    });
  } catch (error) {
    logger.error('Similar content search failed', { 
      error: (error as Error).message,
      contentId: req.params.contentId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Similar content search failed',
    });
  }
});

// Generate video fingerprint
router.post('/fingerprint', [
  body('contentId').notEmpty().withMessage('Content ID is required'),
  body('videoUrl').isURL().withMessage('Valid video URL is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { contentId, videoUrl } = req.body;

    // Queue fingerprinting job
    const { fingerprintingQueue } = await import('../config/queues');
    const job = await fingerprintingQueue.add(
      'fingerprinting',
      {
        jobId: `manual-fingerprint-${contentId}-${Date.now()}`,
        contentId,
        operation: 'fingerprinting',
        priority: 'high',
        videoUrl,
      },
      createJobOptions(JobPriority.HIGH)
    );

    logger.info('Manual fingerprinting job queued', {
      jobId: job.id,
      contentId,
      videoUrl,
    });

    res.json({
      status: 'success',
      message: 'Fingerprinting job queued successfully',
      data: {
        jobId: job.id,
        contentId,
        queuePosition: await job.getState(),
      },
    });
  } catch (error) {
    logger.error('Failed to queue fingerprinting job', { 
      error: (error as Error).message,
      contentId: req.body.contentId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to queue fingerprinting job',
    });
  }
});

// Find similar fingerprints (leak detection)
router.post('/fingerprint/search', [
  body('contentId').notEmpty().withMessage('Content ID is required'),
  body('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { contentId, limit = 10 } = req.body;

    // This would use the video fingerprint service to find similar fingerprints
    // For now, return a placeholder response
    res.json({
      status: 'success',
      data: {
        contentId,
        similarFingerprints: [], // Will be populated with actual results
        total: 0,
        searchTime: Date.now(),
      },
    });
  } catch (error) {
    logger.error('Failed to search fingerprints', { 
      error: (error as Error).message,
      contentId: req.body.contentId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to search fingerprints',
    });
  }
});

// Get fingerprint metadata
router.get('/fingerprint/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    
    // This would query the database for fingerprint metadata
    // For now, return a placeholder response
    res.json({
      status: 'success',
      data: {
        contentId,
        fingerprint: null, // Will be populated from database
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get fingerprint', { 
      error: (error as Error).message,
      contentId: req.params.contentId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve fingerprint',
    });
  }
});

export default router;