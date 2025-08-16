import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '../redis/RedisClient';
import { logger } from '../logging/Logger';

// API Key scopes
export enum APIScope {
  READ_ANALYTICS = 'read:analytics',
  SEARCH_CONTENT = 'search:content',
  VERIFY_ENTITLEMENTS = 'verify:entitlements',
  RECEIVE_WEBHOOKS = 'receive:webhooks'
}

// API Key model
export interface APIKey {
  id: string;
  keyHash: string;
  name: string;
  scopes: APIScope[];
  organizationId: string;
  isActive: boolean;
  rateLimit: number; // requests per minute
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
}

// Request with API context
export interface APIRequest extends Request {
  correlationId: string;
  apiKey?: APIKey;
  rateLimitInfo?: {
    remaining: number;
    resetTime: Date;
  };
}

// Standard API response envelope
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    correlationId: string;
    timestamp: string;
    version: string;
  };
}

export class PublicAPIService {
  private rateLimiters: Map<string, RateLimiterRedis> = new Map();

  constructor() {
    this.setupRateLimiters();
  }

  private setupRateLimiters() {
    // Default rate limiter for public endpoints
    this.rateLimiters.set('default', new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: 'rl_api_default',
      points: 100, // requests
      duration: 60, // per 60 seconds
    }));

    // Premium rate limiter for authenticated API keys
    this.rateLimiters.set('premium', new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: 'rl_api_premium',
      points: 1000, // requests
      duration: 60, // per 60 seconds
    }));
  }

  // Middleware to add correlation ID to all requests
  correlationMiddleware = (req: APIRequest, res: Response, next: NextFunction) => {
    req.correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    res.setHeader('X-Correlation-ID', req.correlationId);
    next();
  };

  // Middleware to authenticate API keys
  authenticateAPIKey = async (req: APIRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return this.sendError(res, req.correlationId, 'MISSING_API_KEY', 'API key required', 401);
      }

      const apiKey = authHeader.substring(7);
      const keyData = await this.validateAPIKey(apiKey);
      
      if (!keyData) {
        return this.sendError(res, req.correlationId, 'INVALID_API_KEY', 'Invalid or expired API key', 401);
      }

      req.apiKey = keyData;
      await this.updateLastUsed(keyData.id);
      next();
    } catch (error) {
      logger.error('API key authentication error', { 
        correlationId: req.correlationId, 
        error: error.message 
      });
      return this.sendError(res, req.correlationId, 'AUTH_ERROR', 'Authentication failed', 500);
    }
  };

  // Middleware to check API scopes
  requireScope = (requiredScope: APIScope) => {
    return (req: APIRequest, res: Response, next: NextFunction) => {
      if (!req.apiKey) {
        return this.sendError(res, req.correlationId, 'MISSING_AUTH', 'Authentication required', 401);
      }

      if (!req.apiKey.scopes.includes(requiredScope)) {
        return this.sendError(res, req.correlationId, 'INSUFFICIENT_SCOPE', 
          `Required scope: ${requiredScope}`, 403);
      }

      next();
    };
  };

  // Rate limiting middleware
  rateLimitMiddleware = async (req: APIRequest, res: Response, next: NextFunction) => {
    try {
      const identifier = req.apiKey ? `api_${req.apiKey.id}` : `ip_${req.ip}`;
      const limiterType = req.apiKey ? 'premium' : 'default';
      const rateLimiter = this.rateLimiters.get(limiterType)!;

      // Use custom rate limit if specified in API key
      if (req.apiKey?.rateLimit) {
        const customLimiter = new RateLimiterRedis({
          storeClient: redis,
          keyPrefix: `rl_api_${req.apiKey.id}`,
          points: req.apiKey.rateLimit,
          duration: 60,
        });
        
        const result = await customLimiter.consume(identifier);
        req.rateLimitInfo = {
          remaining: result.remainingPoints || 0,
          resetTime: new Date(Date.now() + result.msBeforeNext)
        };
      } else {
        const result = await rateLimiter.consume(identifier);
        req.rateLimitInfo = {
          remaining: result.remainingPoints || 0,
          resetTime: new Date(Date.now() + result.msBeforeNext)
        };
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Remaining', req.rateLimitInfo.remaining);
      res.setHeader('X-RateLimit-Reset', req.rateLimitInfo.resetTime.toISOString());
      
      next();
    } catch (rateLimiterRes) {
      const resetTime = new Date(Date.now() + rateLimiterRes.msBeforeNext);
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', resetTime.toISOString());
      res.setHeader('Retry-After', Math.round(rateLimiterRes.msBeforeNext / 1000));
      
      return this.sendError(res, req.correlationId, 'RATE_LIMIT_EXCEEDED', 
        'Rate limit exceeded', 429);
    }
  };

  // Standard response helper
  sendResponse<T>(res: Response, correlationId: string, data: T, statusCode = 200): void {
    const response: APIResponse<T> = {
      success: true,
      data,
      meta: {
        correlationId,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    };
    res.status(statusCode).json(response);
  }

  // Standard error response helper
  sendError(res: Response, correlationId: string, code: string, message: string, 
           statusCode = 400, details?: any): void {
    const response: APIResponse = {
      success: false,
      error: {
        code,
        message,
        details
      },
      meta: {
        correlationId,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    };
    
    logger.error('API Error Response', { correlationId, code, message, statusCode });
    res.status(statusCode).json(response);
  }

  private async validateAPIKey(keyString: string): Promise<APIKey | null> {
    // In production, this would query the database
    // For now, return a mock API key for testing
    const mockKey: APIKey = {
      id: 'test-key-1',
      keyHash: 'hashed-key',
      name: 'Test API Key',
      scopes: [APIScope.READ_ANALYTICS, APIScope.SEARCH_CONTENT],
      organizationId: 'org-1',
      isActive: true,
      rateLimit: 500,
      createdAt: new Date(),
    };
    
    return keyString === 'test-api-key' ? mockKey : null;
  }

  private async updateLastUsed(keyId: string): Promise<void> {
    // Update last used timestamp in database
    logger.info('API key used', { keyId, timestamp: new Date() });
  }
}

export const publicAPIService = new PublicAPIService();