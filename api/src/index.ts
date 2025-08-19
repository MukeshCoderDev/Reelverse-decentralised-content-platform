import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { rateLimit } from './middleware/rateLimit';
import { parseRateLimit } from './utils/rateLimitParser';
import { env } from './config/env';
import { requirePrivyAuth } from './middleware/authPrivy';

import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { unifiedErrorHandler } from './middleware/unifiedErrorHandler';
import { correlationIdMiddleware } from './middleware/correlationId'; // Correct import
import { idempotencyMiddleware } from './middleware/idempotency';   // Correct import
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { aiServiceManager } from './services/ai/aiServiceManager';
import { infrastructure } from './core/infrastructure';
import { eventBus } from './core/eventBus';
import { auditSink } from './core/auditSink';
import metricsRegister from './utils/metrics';
import RelayerService from './services/onchain/relayerService';
import RelayerWorker from './services/onchain/relayerWorker';

// Import routes
import authRoutes from './routes/auth';
import contentRoutes from './routes/content';
import uploadRoutes from './routes/upload';
import multipartUploadRoutes from './routes/multipartUpload';
import transcodingRoutes from './routes/transcoding';
import packagingRoutes from './routes/packaging';
import drmRoutes from './routes/drm';
import paymentRoutes from './routes/payment';
import ageVerificationRoutes from './routes/ageVerification';
import consentRoutes from './routes/consentRoutes';
import moderationRoutes from './routes/moderation';
import payoutRoutes from './routes/payout';
import webhookRoutes from './routes/webhooks';
import aiRoutes from './routes/ai';
import creatorAIRoutes from './routes/creatorAI';
import advancedSearchRoutes from './routes/advancedSearch';
import agencyConciergeRoutes from './routes/agencyConcierge';
import sloRoutes from './routes/slo';
import statusRoutes from './routes/status';
import enhancedFeatureFlagRoutes from './routes/enhancedFeatureFlags'; // Corrected path after move
import privacyRoutes from './routes/privacy';
import paymentComplianceRoutes from './routes/paymentCompliance';
import aiGovernanceRoutes from './routes/aiGovernance';
import policyRoutes from './routes/policy';
import paymasterRoutes from './routes/paymaster';
import finalizerRoutes from './routes/finalizer';
import coordinatorRoutes from './routes/coordinator';
import smartAccountsAdmin from './routes/admin/smartAccounts';
import reconcilerAdmin from './routes/admin/reconciler';
import aaRoutes from './routes/aa';
import aaClientSignRoutes from './routes/aaClientSign'; // Import new AA client signing routes
import billingRoutes from './routes/billing'; // Import new billing routes
import docsRoutes from './routes/docs'; // Import docs routes

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_VERSION = process.env.API_VERSION || 'v1';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
// Allow idempotency and correlation headers from clients
import { Request, Response, NextFunction } from 'express';

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Expose-Headers', 'X-Idempotency-Key, X-Correlation-ID');
  next();
});


// Enhanced middleware
app.use(correlationIdMiddleware);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim())
    }
  }));
}

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const aiHealth = await aiServiceManager.healthCheck();
    const infraHealth = await infrastructure.healthCheck();

    const overallHealthy = aiHealth.status === 'healthy' && infraHealth.healthy;

    res.status(overallHealthy ? 200 : 503).json({
      status: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        api: 'healthy',
        ...aiHealth.services,
        ...infraHealth.components
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', metricsRegister.contentType);
    res.end(await metricsRegister.metrics());
  } catch (err) {
    res.status(500).send('metrics error');
  }
});

// API routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/content`, contentRoutes);
app.use(`/api/${API_VERSION}/upload`, uploadRoutes);
app.use(`/api/${API_VERSION}/multipart-upload`, multipartUploadRoutes);
app.use(`/api/${API_VERSION}/transcoding`, transcodingRoutes);
app.use(`/api/${API_VERSION}/packaging`, packagingRoutes);
app.use(`/api/${API_VERSION}/drm`, drmRoutes);
app.use(`/api/${API_VERSION}/payment`, paymentRoutes);
app.use(`/api/${API_VERSION}/age-verification`, ageVerificationRoutes);
app.use(`/api/${API_VERSION}/consent`, consentRoutes);
app.use(`/api/${API_VERSION}/moderation`, moderationRoutes);
app.use(`/api/${API_VERSION}/payout`, payoutRoutes);
app.use(`/api/${API_VERSION}/webhooks`, webhookRoutes);
app.use(`/api/${API_VERSION}/ai`, aiRoutes);
app.use(`/api/${API_VERSION}/creator-ai`, creatorAIRoutes);
app.use(`/api/${API_VERSION}/advanced-search`, advancedSearchRoutes);
app.use(`/api/${API_VERSION}/agency-concierge`, agencyConciergeRoutes);
app.use(`/api/${API_VERSION}/slo`, sloRoutes);
app.use(`/api/${API_VERSION}/status`, statusRoutes);
app.use(`/api/${API_VERSION}/feature-flags`, enhancedFeatureFlagRoutes);
app.use(`/api/${API_VERSION}/privacy`, privacyRoutes);
app.use(`/api/${API_VERSION}/payment-compliance`, paymentComplianceRoutes);
app.use(`/api/${API_VERSION}/ai-governance`, aiGovernanceRoutes);
app.use(`/api/${API_VERSION}/policy`, policyRoutes);
app.use(`/api/${API_VERSION}/paymaster`, paymasterRoutes);
app.use(`/api/${API_VERSION}/finalizer`, finalizerRoutes);
app.use(`/api/${API_VERSION}/coordinator`, coordinatorRoutes);
app.use(`/api/${API_VERSION}/admin/smart-accounts`, smartAccountsAdmin);
app.use(`/api/${API_VERSION}/admin/reconciler`, reconcilerAdmin);

if (env.AUTH_PROVIDER === 'privy') {
  app.use(`/api/${API_VERSION}/aa`, requirePrivyAuth, aaClientSignRoutes); // Use new client signing routes
  app.use(`/api/${API_VERSION}/billing`, requirePrivyAuth, billingRoutes);
  app.use(`/api/${API_VERSION}/upload`, requirePrivyAuth, uploadRoutes);
} else {
  app.use(`/api/${API_VERSION}/aa`, aaRoutes); // Keep existing server-side signing for dev
  app.use(`/api/${API_VERSION}/billing`, billingRoutes);
  app.use(`/api/${API_VERSION}/upload`, uploadRoutes);
}

app.use(`/api/${API_VERSION}`, docsRoutes); // Add docs routes

// Error handling middleware
app.use(notFoundHandler);
app.use(unifiedErrorHandler);

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await aiServiceManager.shutdown();
  await infrastructure.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await aiServiceManager.shutdown();
  await infrastructure.shutdown();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Initialize core infrastructure first
    await infrastructure.initialize();
    logger.info('Core infrastructure initialized successfully');

    // Connect to database
    await connectDatabase();
    logger.info('Database connected successfully');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected successfully');

    // Optionally start relayer worker
    if (process.env.RELAYER_ENABLED === 'true') {
      try {
        const rpc = process.env.RPC_URL || 'http://localhost:8545';
        const relayer = new RelayerService({ rpcUrl: rpc, apiBaseUrl: `http://localhost:${PORT}` });
        const worker = new RelayerWorker(relayer, Number(process.env.RELAYER_POLL_MS || '5000'));
        worker.start().catch(e => logger.error('Relayer worker failed', e));
        logger.info('Relayer worker started');
      } catch (e) {
        logger.error('Failed to start relayer worker', e);
      }
    }

    // Initialize AI services
    await aiServiceManager.initialize();
    logger.info('AI services initialized successfully');

    // Emit server startup event
    await eventBus.publish({
      type: 'server.started',
      version: '1.0',
      correlationId: 'server-startup',
      payload: {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      },
      metadata: {
        source: 'api-server'
      }
    });

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`🚀 Reelverse API server running on port ${PORT}`);
      logger.info(`📚 API documentation available at http://localhost:${PORT}/api/${API_VERSION}/docs`);
      logger.info(`🏥 Health check available at http://localhost:${PORT}/health`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📊 Event bus and audit sink active`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

export default app;