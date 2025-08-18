import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger, logError, logAudit } from '../utils/logger';
import { FeatureFlagService } from '../../../services/featureFlagService';

// Enhanced error interface with correlation ID and retry information
export interface UnifiedApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  correlationId?: string;
  retryable?: boolean;
  retryAfter?: number;
  context?: Record<string, any>;
}

// Error envelope for consistent API responses
export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    correlationId: string;
    timestamp: string;
    retryable?: boolean;
    retryAfter?: number;
    details?: any;
    stack?: string;
  };
  meta?: {
    requestId: string;
    path: string;
    method: string;
    userAgent?: string;
  };
}

// Enhanced error classes with correlation ID support
export class UnifiedError extends Error implements UnifiedApiError {
  public statusCode: number;
  public code: string;
  public details?: any;
  public correlationId: string;
  public retryable: boolean;
  public retryAfter?: number;
  public context?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: any,
    retryable: boolean = false,
    retryAfter?: number,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'UnifiedError';
    this.statusCode = statusCode;
    this.code = code || 'INTERNAL_ERROR';
    this.details = details;
    this.correlationId = uuidv4();
    this.retryable = retryable;
    this.retryAfter = retryAfter;
    this.context = context;

    Error.captureStackTrace(this, UnifiedError);
  }
}

// Specific error types with enhanced metadata
export class AIServiceError extends UnifiedError {
  constructor(service: string, message: string, details?: any, retryable: boolean = true) {
    super(
      `AI service ${service} error: ${message}`,
      502,
      'AI_SERVICE_ERROR',
      { service, ...details },
      retryable,
      retryable ? 30 : undefined // 30 second retry for AI services
    );
    this.name = 'AIServiceError';
  }
}

export class PaymentProcessingError extends UnifiedError {
  constructor(message: string, details?: any, retryable: boolean = false) {
    super(
      message,
      402,
      'PAYMENT_PROCESSING_ERROR',
      details,
      retryable,
      retryable ? 60 : undefined // 1 minute retry for payments
    );
    this.name = 'PaymentProcessingError';
  }
}

export class BlockchainTransactionError extends UnifiedError {
  constructor(message: string, details?: any, retryable: boolean = true) {
    super(
      message,
      502,
      'BLOCKCHAIN_TRANSACTION_ERROR',
      details,
      retryable,
      retryable ? 15 : undefined // 15 second retry for blockchain
    );
    this.name = 'BlockchainTransactionError';
  }
}

export class ComplianceViolationError extends UnifiedError {
  constructor(message: string, details?: any) {
    super(
      message,
      403,
      'COMPLIANCE_VIOLATION_ERROR',
      details,
      false // Compliance violations are not retryable
    );
    this.name = 'ComplianceViolationError';
  }
}

export class FeatureFlagError extends UnifiedError {
  constructor(flagKey: string, message: string, details?: any) {
    super(
      `Feature flag ${flagKey} error: ${message}`,
      503,
      'FEATURE_FLAG_ERROR',
      { flagKey, ...details },
      true,
      5 // 5 second retry for feature flags
    );
    this.name = 'FeatureFlagError';
  }
}

// Middleware to add correlation ID to all requests
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  // expose metrics labels for instrumentation
  (res.locals as any).metricsLabels = { correlationId };
  next();
};

// Enhanced error handler with correlation ID and retry logic
export const unifiedErrorHandler = (
  error: UnifiedApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Ensure correlation ID exists
  const correlationId = error.correlationId || req.correlationId || uuidv4();
  
  // Default error values
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  let code = error.code || 'INTERNAL_ERROR';
  let details = error.details;
  let retryable = error.retryable || false;
  let retryAfter = error.retryAfter;

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    retryable = false;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid ID format';
    retryable = false;
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
    retryable = false;
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token expired';
    retryable = false;
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    code = 'FILE_UPLOAD_ERROR';
    message = `File upload error: ${error.message}`;
    retryable = false;
  }

  // Enhanced error logging with correlation ID and context
  const errorLog = {
    correlationId,
    message: error.message,
    stack: error.stack,
    statusCode,
    code,
    details,
    retryable,
    retryAfter,
    context: error.context,
    request: {
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      organizationId: req.user?.organizationId,
    },
    timestamp: new Date().toISOString(),
  };

  // Log based on severity
  if (statusCode >= 500) {
    logError('Server Error', error, errorLog);
  } else if (statusCode >= 400) {
    logger.warn('Client Error', errorLog);
  }

  // Audit log for security-related errors
  if (statusCode === 401 || statusCode === 403) {
    logAudit(`Security error: ${code}`, req.user?.id, {
      correlationId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });
  }

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const errorResponse: ErrorEnvelope = {
    success: false,
    error: {
      code,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
    },
    meta: {
      requestId: correlationId,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
    }
  };

  // Add retry information if applicable
  if (retryable) {
    errorResponse.error.retryable = true;
    if (retryAfter) {
      errorResponse.error.retryAfter = retryAfter;
      res.setHeader('Retry-After', retryAfter.toString());
    }
  }

  // Include additional details in development or for validation errors
  if (isDevelopment || (statusCode === 400 && details)) {
    errorResponse.error.details = details;
    if (isDevelopment) {
      errorResponse.error.stack = error.stack;
    }
  }

  res.status(statusCode).json(errorResponse);
};

// Enhanced async handler with correlation ID propagation
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Ensure correlation ID is propagated
      if (!error.correlationId && req.correlationId) {
        error.correlationId = req.correlationId;
      }
      next(error);
    });
  };
};

// Error factory functions with correlation ID support
export const createUnifiedError = {
  validation: (message: string, details?: any, correlationId?: string) => {
    const error = new UnifiedError(message, 400, 'VALIDATION_ERROR', details, false);
    if (correlationId) error.correlationId = correlationId;
    return error;
  },
  
  authentication: (message?: string, correlationId?: string) => {
    const error = new UnifiedError(message || 'Authentication required', 401, 'AUTHENTICATION_ERROR', undefined, false);
    if (correlationId) error.correlationId = correlationId;
    return error;
  },
  
  authorization: (message?: string, correlationId?: string) => {
    const error = new UnifiedError(message || 'Insufficient permissions', 403, 'AUTHORIZATION_ERROR', undefined, false);
    if (correlationId) error.correlationId = correlationId;
    return error;
  },
  
  notFound: (message?: string, correlationId?: string) => {
    const error = new UnifiedError(message || 'Resource not found', 404, 'NOT_FOUND_ERROR', undefined, false);
    if (correlationId) error.correlationId = correlationId;
    return error;
  },
  
  conflict: (message: string, details?: any, correlationId?: string) => {
    const error = new UnifiedError(message, 409, 'CONFLICT_ERROR', details, false);
    if (correlationId) error.correlationId = correlationId;
    return error;
  },
  
  rateLimit: (message?: string, retryAfter?: number, correlationId?: string) => {
    const error = new UnifiedError(message || 'Rate limit exceeded', 429, 'RATE_LIMIT_ERROR', undefined, true, retryAfter);
    if (correlationId) error.correlationId = correlationId;
    return error;
  },
  
  aiService: (service: string, message: string, details?: any, retryable: boolean = true, correlationId?: string) => {
    const error = new AIServiceError(service, message, details, retryable);
    if (correlationId) error.correlationId = correlationId;
    return error;
  },
  
  payment: (message: string, details?: any, retryable: boolean = false, correlationId?: string) => {
    const error = new PaymentProcessingError(message, details, retryable);
    if (correlationId) error.correlationId = correlationId;
    return error;
  },
  
  blockchain: (message: string, details?: any, retryable: boolean = true, correlationId?: string) => {
    const error = new BlockchainTransactionError(message, details, retryable);
    if (correlationId) error.correlationId = correlationId;
    return error;
  },
  
  compliance: (message: string, details?: any, correlationId?: string) => {
    const error = new ComplianceViolationError(message, details);
    if (correlationId) error.correlationId = correlationId;
    return error;
  },
  
  featureFlag: (flagKey: string, message: string, details?: any, correlationId?: string) => {
    const error = new FeatureFlagError(flagKey, message, details);
    if (correlationId) error.correlationId = correlationId;
    return error;
  },
  
  internal: (message: string, details?: any, retryable: boolean = false, correlationId?: string) => {
    const error = new UnifiedError(message, 500, 'INTERNAL_ERROR', details, retryable);
    if (correlationId) error.correlationId = correlationId;
    return error;
  },
};

// Idempotency middleware for POST/PUT/PATCH requests
export const idempotencyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !idempotencyKey) {
    // Generate idempotency key if not provided
    const generatedKey = uuidv4();
    req.idempotencyKey = generatedKey;
    res.setHeader('X-Idempotency-Key', generatedKey);
  } else if (idempotencyKey) {
    req.idempotencyKey = idempotencyKey;
    res.setHeader('X-Idempotency-Key', idempotencyKey);
  }
  
  next();
};

// Declare module augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      idempotencyKey?: string;
      user?: {
        id: string;
        organizationId?: string;
        [key: string]: any;
      };
    }
  }
}