import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { aiServiceManager } from './services/ai/aiServiceManager';

// Import routes
import authRoutes from './routes/auth';
import contentRoutes from './routes/content';
import uploadRoutes from './routes/upload';
import paymentRoutes from './routes/payment';
import ageVerificationRoutes from './routes/ageVerification';
import consentRoutes from './routes/consentRoutes';
import moderationRoutes from './routes/moderation';
import payoutRoutes from './routes/payout';
import webhookRoutes from './routes/webhooks';
import aiRoutes from './routes/ai';

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

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

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
app.get('/health', async (req, res) => {
  try {
    const aiHealth = await aiServiceManager.healthCheck();
    
    res.status(200).json({
      status: aiHealth.status === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        api: 'healthy',
        ...aiHealth.services,
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

// API routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/content`, contentRoutes);
app.use(`/api/${API_VERSION}/upload`, uploadRoutes);
app.use(`/api/${API_VERSION}/payment`, paymentRoutes);
app.use(`/api/${API_VERSION}/age-verification`, ageVerificationRoutes);
app.use(`/api/${API_VERSION}/consent`, consentRoutes);
app.use(`/api/${API_VERSION}/moderation`, moderationRoutes);
app.use(`/api/${API_VERSION}/payout`, payoutRoutes);
app.use(`/api/${API_VERSION}/webhooks`, webhookRoutes);
app.use(`/api/${API_VERSION}/ai`, aiRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await aiServiceManager.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await aiServiceManager.shutdown();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected successfully');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected successfully');

    // Initialize AI services
    await aiServiceManager.initialize();
    logger.info('AI services initialized successfully');

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`🚀 Reelverse API server running on port ${PORT}`);
      logger.info(`📚 API documentation available at http://localhost:${PORT}/api/${API_VERSION}/docs`);
      logger.info(`🏥 Health check available at http://localhost:${PORT}/health`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
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