import { Router } from 'express';
import { z } from 'zod';
import { publicAPIService, APIScope, APIRequest } from '../../../services/api/PublicAPIService';
import { webhookService, WebhookEventType } from '../../../services/webhooks/WebhookService';

const router = Router();

// Apply middleware to all webhook routes
router.use(publicAPIService.correlationMiddleware);
router.use(publicAPIService.rateLimitMiddleware);
router.use(publicAPIService.authenticateAPIKey);
router.use(publicAPIService.requireScope(APIScope.RECEIVE_WEBHOOKS));

// Validation schemas
const createEndpointSchema = z.object({
  url: z.string().url(),
  events: z.array(z.nativeEnum(WebhookEventType)).min(1),
  retryPolicy: z.object({
    maxRetries: z.number().min(0).max(10).default(3),
    backoffMultiplier: z.number().min(1).max(5).default(2),
    maxBackoffSeconds: z.number().min(1).max(3600).default(300)
  }).optional()
});

const updateEndpointSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.nativeEnum(WebhookEventType)).min(1).optional(),
  isActive: z.boolean().optional(),
  retryPolicy: z.object({
    maxRetries: z.number().min(0).max(10),
    backoffMultiplier: z.number().min(1).max(5),
    maxBackoffSeconds: z.number().min(1).max(3600)
  }).optional()
});

const testWebhookSchema = z.object({
  eventType: z.nativeEnum(WebhookEventType),
  testData: z.record(z.any()).optional()
});

// GET /api/v1/webhooks/endpoints
router.get('/endpoints', async (req: APIRequest, res) => {
  try {
    // In production, fetch from database
    const endpoints = []; // Mock empty array for now
    
    publicAPIService.sendResponse(res, req.correlationId, {
      endpoints: endpoints.map(endpoint => ({
        id: endpoint.id,
        url: endpoint.url,
        events: endpoint.events,
        isActive: endpoint.isActive,
        createdAt: endpoint.createdAt,
        lastDeliveryAt: endpoint.lastDeliveryAt,
        lastSuccessAt: endpoint.lastSuccessAt
      }))
    });
  } catch (error) {
    publicAPIService.sendError(res, req.correlationId, 'ENDPOINTS_ERROR', 
      'Failed to fetch webhook endpoints', 500);
  }
});

// POST /api/v1/webhooks/endpoints
router.post('/endpoints', async (req: APIRequest, res) => {
  try {
    const endpointData = createEndpointSchema.parse(req.body);
    
    const endpoint = await webhookService.createEndpoint({
      organizationId: req.apiKey!.organizationId,
      url: endpointData.url,
      secret: crypto.randomBytes(32).toString('hex'), // Generate secret
      events: endpointData.events,
      isActive: true,
      retryPolicy: endpointData.retryPolicy || {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffSeconds: 300
      }
    });

    publicAPIService.sendResponse(res, req.correlationId, {
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      isActive: endpoint.isActive,
      secret: endpoint.secret, // Only return secret on creation
      retryPolicy: endpoint.retryPolicy,
      createdAt: endpoint.createdAt
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid endpoint configuration', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'CREATE_ENDPOINT_ERROR', 
        'Failed to create webhook endpoint', 500);
    }
  }
});

// GET /api/v1/webhooks/endpoints/:endpointId
router.get('/endpoints/:endpointId', async (req: APIRequest, res) => {
  try {
    const { endpointId } = z.object({ endpointId: z.string().uuid() }).parse(req.params);
    
    // Mock endpoint for now
    const endpoint = {
      id: endpointId,
      url: 'https://example.com/webhook',
      events: [WebhookEventType.PURCHASE_COMPLETED],
      isActive: true,
      createdAt: new Date(),
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffSeconds: 300
      }
    };

    publicAPIService.sendResponse(res, req.correlationId, endpoint);
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid endpoint ID', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'ENDPOINT_ERROR', 
        'Failed to fetch webhook endpoint', 500);
    }
  }
});

// PUT /api/v1/webhooks/endpoints/:endpointId
router.put('/endpoints/:endpointId', async (req: APIRequest, res) => {
  try {
    const { endpointId } = z.object({ endpointId: z.string().uuid() }).parse(req.params);
    const updates = updateEndpointSchema.parse(req.body);
    
    const endpoint = await webhookService.updateEndpoint(endpointId, updates);

    publicAPIService.sendResponse(res, req.correlationId, {
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      isActive: endpoint.isActive,
      retryPolicy: endpoint.retryPolicy,
      createdAt: endpoint.createdAt,
      lastDeliveryAt: endpoint.lastDeliveryAt,
      lastSuccessAt: endpoint.lastSuccessAt
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid update data', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'UPDATE_ENDPOINT_ERROR', 
        'Failed to update webhook endpoint', 500);
    }
  }
});

// DELETE /api/v1/webhooks/endpoints/:endpointId
router.delete('/endpoints/:endpointId', async (req: APIRequest, res) => {
  try {
    const { endpointId } = z.object({ endpointId: z.string().uuid() }).parse(req.params);
    
    await webhookService.deleteEndpoint(endpointId);

    publicAPIService.sendResponse(res, req.correlationId, {
      message: 'Webhook endpoint deleted successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid endpoint ID', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'DELETE_ENDPOINT_ERROR', 
        'Failed to delete webhook endpoint', 500);
    }
  }
});

// POST /api/v1/webhooks/endpoints/:endpointId/test
router.post('/endpoints/:endpointId/test', async (req: APIRequest, res) => {
  try {
    const { endpointId } = z.object({ endpointId: z.string().uuid() }).parse(req.params);
    const { eventType, testData } = testWebhookSchema.parse(req.body);
    
    // Send test webhook
    await webhookService.emitWebhook(eventType, {
      organizationId: req.apiKey!.organizationId,
      test: true,
      ...testData
    });

    publicAPIService.sendResponse(res, req.correlationId, {
      message: 'Test webhook sent successfully',
      eventType,
      endpointId
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      publicAPIService.sendError(res, req.correlationId, 'VALIDATION_ERROR', 
        'Invalid test parameters', 400, error.errors);
    } else {
      publicAPIService.sendError(res, req.correlationId, 'TEST_WEBHOOK_ERROR', 
        'Failed to send test webhook', 500);
    }
  }
});

// GET /api/v1/webhooks/events
router.get('/events', async (req: APIRequest, res) => {
  try {
    const eventTypes = Object.values(WebhookEventType).map(type => ({
      type,
      description: getEventDescription(type)
    }));

    publicAPIService.sendResponse(res, req.correlationId, {
      eventTypes
    });
  } catch (error) {
    publicAPIService.sendError(res, req.correlationId, 'EVENTS_ERROR', 
      'Failed to fetch event types', 500);
  }
});

// Helper function to get event descriptions
function getEventDescription(eventType: WebhookEventType): string {
  const descriptions = {
    [WebhookEventType.CONTENT_UPLOADED]: 'Triggered when new content is uploaded',
    [WebhookEventType.CONTENT_PROCESSED]: 'Triggered when content processing is complete',
    [WebhookEventType.PURCHASE_COMPLETED]: 'Triggered when a purchase is successfully completed',
    [WebhookEventType.PAYOUT_PROCESSED]: 'Triggered when a payout is processed',
    [WebhookEventType.LEAK_DETECTED]: 'Triggered when content leak is detected',
    [WebhookEventType.COMPLIANCE_VIOLATION]: 'Triggered when compliance violation is found',
    [WebhookEventType.USER_REGISTERED]: 'Triggered when a new user registers',
    [WebhookEventType.SUBSCRIPTION_CREATED]: 'Triggered when a subscription is created',
    [WebhookEventType.SUBSCRIPTION_CANCELLED]: 'Triggered when a subscription is cancelled'
  };
  
  return descriptions[eventType] || 'No description available';
}

export default router;