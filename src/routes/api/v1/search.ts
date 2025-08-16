import { Router } from 'express';
import { z } from 'zod';
import { publicAPIService, APIScope, APIRequest } from '../../../services/api/PublicAPIService';
import { vectorSearchService } from '../../../services/ai/VectorSearchService';
import { contentService } from '../../../services/content/ContentService';

const router = Router();

// Apply middleware to all search routes
router.use(publicAPIService.correlationMiddleware);
router.use(publicAPIService.rateLimitMiddleware);
router.use(publicAPIService.authenticateAPIKey);
router.use(publicAPIService.requireScope(APIScope.SEARCH_CONTENT));

// Validation schemas
const searchSchema = z.object({
  q: z.string().min(1).max(500),
  type: z.enum(['semantic', 'hybrid', 'keyword']).default('hybrid'),
  filters: z.object({
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    minDuration: z.coerce.number().optional(),
    maxDuration: z.coerce.number().optional(),
    createdAfter: z.string().datetime().optional(),
    createdBefore: z.string().datetime().optional(),
    performerId: z.string().optional()
  }).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  includeMetadata: z.coerce.boolean().default(false)
});

const contentIdSchema = z.object({
  contentId: z.string().uuid()
});

const similarContentSchema = z.object({
  limit: z.coerce.number().min(1).max(20).default(10),
  threshold: z.coerce.number().min(0).max(1).default(0.7)
});

// POST /api/v1/search/content
router.post('/content', async (req: APIRequest, res) => {
  try {
    const searchParams = searchSchema.parse(req.body);
    
    let results;
    switch (searchParams.type) {
      case 'semantic':
        results = await vectorSearchService.semanticSearch(
          searchParams.q,
          {
            organizationId: req.apiKey!.organizationId,
            filters: searchParams.filters,
            page: searchParams.page,
            limit: searchParams.limit
          }
        );
        break;
      case 'hybrid':
        results = await vectorSearchService.hybridSearch(
          searchParams.q,
          {
            organizationId: req.apiKey!.organizationId,
            filters: searchParams.filters,
            page: searchParams.page,
            limit: searchParams.limit
          }
        );
        break;
      case 'keyword':
        results = await contentService.keywordSearch(
          searchParams.q,
          {
            organizationId: req.apiKey!.organizationId,
            filters: searchParams.filters,
            page: searchParams.page,
            limit: searchParams.limit
          }
        );
        break;
    }

    // Filter sensitive data if not including metadata
    if (!searchParams.includeMetadata) {
      results.items = results.items.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        thumbnailUrl: item.thumbnailUrl,
        duration: item.duration,
        tags: item.tags,
        relevanceScore: item.relevanceScore,
        createdAt: item.createdAt
      }));
    }

    publicAPIService.sendResponse(res, req.correlationId, {
      query: searchParams.q,
      type: searchParams.type,
      results,
      searchTime: Date.now() // Add search timing
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid search parameters', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'SEARCH_ERROR', 
        'Search request failed', 500);
    }
  }
});

// GET /api/v1/search/suggestions
router.get('/suggestions', async (req: APIRequest, res) => {
  try {
    const { q } = z.object({ q: z.string().min(1).max(100) }).parse(req.query);
    
    const suggestions = await vectorSearchService.getSearchSuggestions(q, {
      organizationId: req.apiKey!.organizationId,
      limit: 10
    });

    publicAPIService.sendResponse(res, req.correlationId, {
      query: q,
      suggestions
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid query parameter', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'SUGGESTIONS_ERROR', 
        'Failed to fetch suggestions', 500);
    }
  }
});

// GET /api/v1/search/content/:contentId/similar
router.get('/content/:contentId/similar', async (req: APIRequest, res) => {
  try {
    const { contentId } = contentIdSchema.parse(req.params);
    const params = similarContentSchema.parse(req.query);
    
    const similarContent = await vectorSearchService.findSimilarContent(contentId, {
      organizationId: req.apiKey!.organizationId,
      limit: params.limit,
      threshold: params.threshold
    });

    publicAPIService.sendResponse(res, req.correlationId, {
      contentId,
      similarContent
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid parameters', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'SIMILAR_CONTENT_ERROR', 
        'Failed to find similar content', 500);
    }
  }
});

// GET /api/v1/search/trending
router.get('/trending', async (req: APIRequest, res) => {
  try {
    const { period, limit } = z.object({
      period: z.enum(['1h', '24h', '7d']).default('24h'),
      limit: z.coerce.number().min(1).max(50).default(20)
    }).parse(req.query);
    
    const trending = await contentService.getTrendingContent({
      organizationId: req.apiKey!.organizationId,
      period,
      limit
    });

    publicAPIService.sendResponse(res, req.correlationId, {
      period,
      trending
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid parameters', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'TRENDING_ERROR', 
        'Failed to fetch trending content', 500);
    }
  }
});

export default router;