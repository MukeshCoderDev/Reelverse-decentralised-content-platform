import { Router } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const router = Router();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Decentralized Adult Platform API',
      version: '1.0.0',
      description: 'Public API for partner integrations and analytics access',
      contact: {
        name: 'API Support',
        email: 'api-support@platform.com'
      }
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Production API'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key'
        }
      },
      schemas: {
        APIResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' }
              }
            },
            meta: {
              type: 'object',
              properties: {
                correlationId: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                version: { type: 'string' }
              }
            }
          }
        },
        SearchResult: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            thumbnailUrl: { type: 'string', format: 'uri' },
            duration: { type: 'number' },
            tags: { type: 'array', items: { type: 'string' } },
            relevanceScore: { type: 'number', minimum: 0, maximum: 1 },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        EntitlementVerification: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            contentId: { type: 'string', format: 'uuid' },
            accessType: { type: 'string', enum: ['view', 'download', 'stream'] },
            hasAccess: { type: 'boolean' },
            entitlementType: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
            restrictions: { type: 'object' }
          }
        },
        WebhookEndpoint: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            url: { type: 'string', format: 'uri' },
            events: { 
              type: 'array', 
              items: { 
                type: 'string',
                enum: [
                  'content.uploaded',
                  'content.processed', 
                  'purchase.completed',
                  'payout.processed',
                  'leak.detected',
                  'compliance.violation'
                ]
              }
            },
            isActive: { type: 'boolean' },
            retryPolicy: {
              type: 'object',
              properties: {
                maxRetries: { type: 'number' },
                backoffMultiplier: { type: 'number' },
                maxBackoffSeconds: { type: 'number' }
              }
            },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [
      {
        BearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/api/v1/*.ts'] // Path to the API files
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger UI
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerSpec, {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 50px 0 }
    .swagger-ui .info .title { color: #3b82f6 }
  `,
  customSiteTitle: 'Platform API Documentation'
}));

// Serve OpenAPI spec as JSON
router.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

export default router;