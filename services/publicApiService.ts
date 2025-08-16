import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  scopes: ApiScope[];
  organizationId?: string;
  createdAt: Date;
  lastUsedAt?: Date;
  isActive: boolean;
  rateLimitTier: 'basic' | 'premium' | 'enterprise';
}

export type ApiScope = 
  | 'analytics:read'
  | 'content:search'
  | 'entitlements:verify'
  | 'webhooks:manage';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  correlationId: string;
  timestamp: string;
}

export class PublicApiService {
  private apiKeys: Map<string, ApiKey> = new Map();

  // Rate limiting configurations
  private rateLimits = {
    basic: rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
      message: this.createErrorResponse('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded')
    }),
    premium: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      message: this.createErrorResponse('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded')
    }),
    enterprise: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10000,
      message: this.createErrorResponse('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded')
    })
  };

  /**
   * Generate a new API key with specified scopes
   */
  async generateApiKey(
    name: string, 
    scopes: ApiScope[], 
    organizationId?: string,
    rateLimitTier: 'basic' | 'premium' | 'enterprise' = 'basic'
  ): Promise<ApiKey> {
    const apiKey: ApiKey = {
      id: uuidv4(),
      key: `pk_${Buffer.from(uuidv4()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`,
      name,
      scopes,
      organizationId,
      createdAt: new Date(),
      isActive: true,
      rateLimitTier
    };

    this.apiKeys.set(apiKey.key, apiKey);
    return apiKey;
  }

  /**
   * Validate API key and check scopes
   */
  async validateApiKey(key: string, requiredScope: ApiScope): Promise<ApiKey | null> {
    const apiKey = this.apiKeys.get(key);
    
    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    if (!apiKey.scopes.includes(requiredScope)) {
      return null;
    }

    // Update last used timestamp
    apiKey.lastUsedAt = new Date();
    return apiKey;
  }

  /**
   * Middleware for API authentication and authorization
   */
  createAuthMiddleware(requiredScope: ApiScope) {
    return async (req: Request, res: Response, next: Function) => {
      const correlationId = uuidv4();
      req.correlationId = correlationId;

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json(
          this.createErrorResponse('UNAUTHORIZED', 'Missing or invalid authorization header', correlationId)
        );
      }

      const apiKey = authHeader.substring(7);
      const validatedKey = await this.validateApiKey(apiKey, requiredScope);

      if (!validatedKey) {
        return res.status(403).json(
          this.createErrorResponse('FORBIDDEN', 'Invalid API key or insufficient permissions', correlationId)
        );
      }

      req.apiKey = validatedKey;
      
      // Apply rate limiting based on tier
      const rateLimiter = this.rateLimits[validatedKey.rateLimitTier];
      rateLimiter(req, res, next);
    };
  }

  /**
   * Create standardized API response
   */
  createSuccessResponse<T>(data: T, correlationId?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      correlationId: correlationId || uuidv4(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create standardized error response
   */
  createErrorResponse(code: string, message: string, correlationId?: string, details?: any): ApiResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details
      },
      correlationId: correlationId || uuidv4(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get API key usage statistics
   */
  async getApiKeyStats(keyId: string): Promise<any> {
    // This would integrate with actual metrics collection
    return {
      requestCount: 0,
      lastUsed: null,
      rateLimitHits: 0
    };
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      apiKey?: ApiKey;
    }
  }
}

export const publicApiService = new PublicApiService();