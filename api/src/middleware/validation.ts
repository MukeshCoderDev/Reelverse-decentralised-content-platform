import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { logger } from '../utils/logger';

/**
 * Enhanced validation middleware for monetization endpoints
 * Provides comprehensive input validation with detailed error messages
 */

// Common validation schemas
const UUIDSchema = z.string().uuid('Invalid UUID format');
const AmountSchema = z.number()
  .min(0.01, 'Amount must be at least $0.01')
  .max(10000, 'Amount cannot exceed $10,000')
  .multipleOf(0.01, 'Amount must be in cents');

// Tip endpoint validation
export const TipValidation = z.object({
  videoId: UUIDSchema.describe('Video ID'),
  creatorId: UUIDSchema.describe('Creator ID'),
  amountUSDC: z.number()
    .min(1, 'Minimum tip amount is $1')
    .max(100, 'Maximum tip amount is $100')
    .multipleOf(0.01, 'Amount must be in cents')
    .describe('Tip amount in USDC')
});

// Subscription endpoint validation
export const SubscriptionValidation = z.object({
  creatorId: UUIDSchema.describe('Creator ID'),
  planId: UUIDSchema.describe('Subscription plan ID')
});

// Payout endpoint validation
export const PayoutValidation = z.object({
  amountUSDC: z.number()
    .min(10, 'Minimum payout amount is $10')
    .max(50000, 'Maximum payout amount is $50,000')
    .multipleOf(0.01, 'Amount must be in cents')
    .describe('Payout amount in USDC'),
  payoutMethodId: UUIDSchema.describe('Payout method ID')
});

// Referral claim validation
export const ReferralClaimValidation = z.object({
  referralCode: z.string()
    .min(3, 'Referral code must be at least 3 characters')
    .max(50, 'Referral code must be at most 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Referral code can only contain lowercase letters, numbers, and hyphens')
    .describe('Referral code'),
  metadata: z.object({
    userAgent: z.string().optional(),
    timestamp: z.number().optional(),
    url: z.string().url().optional()
  }).optional().describe('Anti-fraud metadata')
});

// Split policy validation
export const SplitPolicyValidation = z.object({
  name: z.string()
    .min(1, 'Policy name is required')
    .max(100, 'Policy name must be at most 100 characters')
    .describe('Policy name'),
  description: z.string()
    .min(1, 'Policy description is required')
    .max(500, 'Policy description must be at most 500 characters')
    .describe('Policy description'),
  payees: z.array(
    z.object({
      userId: UUIDSchema.optional().describe('User ID of payee'),
      name: z.string()
        .min(1, 'Payee name is required')
        .max(100, 'Payee name must be at most 100 characters')
        .describe('Payee full name'),
      email: z.string()
        .email('Invalid email format')
        .describe('Payee email address'),
      percentage: z.number()
        .min(0.01, 'Percentage must be at least 0.01%')
        .max(100, 'Percentage cannot exceed 100%')
        .multipleOf(0.01, 'Percentage must have at most 2 decimal places')
        .describe('Revenue share percentage')
    })
  )
  .min(1, 'At least one payee is required')
  .max(10, 'Maximum 10 payees allowed')
  .describe('List of payees')
  .refine(
    (payees) => {
      const totalPercentage = payees.reduce((sum, payee) => sum + payee.percentage, 0);
      return Math.abs(totalPercentage - 100) < 0.01;
    },
    {
      message: 'Total percentage must equal 100%'
    }
  )
});

// Plan creation validation
export const PlanValidation = z.object({
  name: z.string()
    .min(1, 'Plan name is required')
    .max(100, 'Plan name must be at most 100 characters')
    .describe('Plan name'),
  description: z.string()
    .max(500, 'Plan description must be at most 500 characters')
    .optional()
    .describe('Plan description'),
  priceUSDC: z.number()
    .min(1, 'Minimum plan price is $1')
    .max(1000, 'Maximum plan price is $1,000')
    .multipleOf(0.01, 'Price must be in cents')
    .describe('Monthly price in USDC'),
  cadence: z.enum(['monthly', 'annual'])
    .describe('Billing cadence'),
  isActive: z.boolean()
    .default(true)
    .describe('Whether plan is active')
});

// Payout method validation
export const PayoutMethodValidation = z.object({
  type: z.enum(['crypto', 'bank'])
    .describe('Payout method type'),
  name: z.string()
    .min(1, 'Method name is required')
    .max(100, 'Method name must be at most 100 characters')
    .describe('Display name for payout method'),
  // Crypto-specific fields
  address: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
    .optional()
    .describe('Crypto wallet address'),
  // Bank-specific fields (for future use)
  accountNumber: z.string()
    .regex(/^\d{8,17}$/, 'Account number must be 8-17 digits')
    .optional()
    .describe('Bank account number'),
  routingNumber: z.string()
    .regex(/^\d{9}$/, 'Routing number must be 9 digits')
    .optional()
    .describe('Bank routing number'),
  accountType: z.enum(['checking', 'savings'])
    .optional()
    .describe('Bank account type')
}).refine(
  (data) => {
    if (data.type === 'crypto') {
      return !!data.address;
    }
    if (data.type === 'bank') {
      return !!(data.accountNumber && data.routingNumber && data.accountType);
    }
    return false;
  },
  {
    message: 'Required fields missing for payout method type',
    path: ['type']
  }
);

/**
 * Generic validation middleware factory
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = source === 'body' ? req.body : 
                   source === 'params' ? req.params : 
                   req.query;
      
      const validated = schema.parse(data);
      
      // Attach validated data to request
      (req as any).validated = validated;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation error:', {
          route: req.path,
          method: req.method,
          errors: error.errors,
          data: req[source]
        });
        
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: err.received
        }));
        
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: formattedErrors
        });
      }
      
      logger.error('Unexpected validation error:', error);
      return res.status(500).json({
        error: 'Internal validation error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate UUID parameters
 */
export function validateUUIDParams(...paramNames: string[]) {
  const schema = z.object(
    paramNames.reduce((acc, name) => {
      acc[name] = UUIDSchema;
      return acc;
    }, {} as Record<string, z.ZodString>)
  );
  
  return validateRequest(schema, 'params');
}

/**
 * Sanitize and validate user input to prevent XSS and injection attacks
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  const sanitizeString = (str: any): string => {
    if (typeof str !== 'string') return str;
    
    // Remove potentially dangerous HTML tags and scripts
    return str
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>.*?<\/object>/gi, '')
      .replace(/<embed[^>]*>.*?<\/embed>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  };
  
  const sanitizeObject = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    
    return obj;
  };
  
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  next();
}

/**
 * Validate required headers for monetization endpoints
 */
export function validateMonetizationHeaders(req: Request, res: Response, next: NextFunction) {
  const contentType = req.headers['content-type'];
  
  // Require JSON content type for POST requests
  if (req.method === 'POST' && !contentType?.includes('application/json')) {
    return res.status(400).json({
      error: 'Content-Type must be application/json',
      code: 'INVALID_CONTENT_TYPE'
    });
  }
  
  // Require idempotency key for financial operations
  const financialRoutes = ['/tips', '/subscriptions', '/payouts'];
  const requiresIdempotency = req.method === 'POST' && 
    financialRoutes.some(route => req.path.includes(route));
  
  if (requiresIdempotency) {
    const idempotencyKey = req.headers['idempotency-key'];
    
    if (!idempotencyKey) {
      return res.status(400).json({
        error: 'Idempotency-Key header is required for financial operations',
        code: 'MISSING_IDEMPOTENCY_KEY'
      });
    }
    
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 10) {
      return res.status(400).json({
        error: 'Idempotency-Key must be at least 10 characters long',
        code: 'INVALID_IDEMPOTENCY_KEY'
      });
    }
  }
  
  next();
}

/**
 * Validate request size limits for monetization endpoints
 */
export function validateRequestSize(maxSizeKB: number = 100) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSizeBytes = maxSizeKB * 1024;
    
    if (contentLength > maxSizeBytes) {
      return res.status(413).json({
        error: `Request too large. Maximum size is ${maxSizeKB}KB`,
        code: 'REQUEST_TOO_LARGE'
      });
    }
    
    next();
  };
}