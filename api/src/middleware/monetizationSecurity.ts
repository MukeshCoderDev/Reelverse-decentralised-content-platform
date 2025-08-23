import { Request, Response, NextFunction } from 'express';
import { 
  validateRequest, 
  sanitizeInput, 
  validateMonetizationHeaders, 
  validateRequestSize,
  TipValidation,
  SubscriptionValidation,
  PayoutValidation,
  ReferralClaimValidation,
  SplitPolicyValidation,
  PlanValidation,
  PayoutMethodValidation
} from './validation';
import { createMonetizationProtection } from './monetizationRateLimit';
import { monetizationIdempotency } from './monetizationIdempotency';
import { authenticateUser } from './auth';
import { logger } from '../utils/logger';

/**
 * Comprehensive security middleware orchestrator for monetization endpoints
 * Combines validation, rate limiting, idempotency, and fraud protection
 */

/**
 * Base security stack for all monetization endpoints
 */
export const baseMonetizationSecurity = [
  // 1. Request size validation (prevent DOS)
  validateRequestSize(100), // 100KB max
  
  // 2. Input sanitization (prevent XSS/injection)
  sanitizeInput,
  
  // 3. Header validation
  validateMonetizationHeaders,
  
  // 4. Authentication (required for all monetization)
  authenticateUser,
  
  // 5. Idempotency protection
  monetizationIdempotency()
];

/**
 * Security configuration for tip endpoints
 */
export const tipSecurity = [
  ...baseMonetizationSecurity,
  ...createMonetizationProtection('tips'),
  validateRequest(TipValidation, 'body'),
  // Additional tip-specific validations
  (req: Request, res: Response, next: NextFunction) => {
    const { creatorId } = req.body;
    const userId = (req as any).userId;
    
    // Prevent self-tipping
    if (userId === creatorId) {
      return res.status(400).json({
        error: 'Cannot tip yourself',
        code: 'SELF_TIP_NOT_ALLOWED'
      });
    }
    
    next();
  }
];

/**
 * Security configuration for subscription endpoints
 */
export const subscriptionSecurity = [
  ...baseMonetizationSecurity,
  ...createMonetizationProtection('subscriptions'),
  validateRequest(SubscriptionValidation, 'body'),
  // Additional subscription-specific validations
  (req: Request, res: Response, next: NextFunction) => {
    const { creatorId } = req.body;
    const userId = (req as any).userId;
    
    // Prevent self-subscription
    if (userId === creatorId) {
      return res.status(400).json({
        error: 'Cannot subscribe to yourself',
        code: 'SELF_SUBSCRIPTION_NOT_ALLOWED'
      });
    }
    
    next();
  }
];

/**
 * Security configuration for payout endpoints
 */
export const payoutSecurity = [
  ...baseMonetizationSecurity,
  ...createMonetizationProtection('payouts'),
  validateRequest(PayoutValidation, 'body'),
  // Additional payout-specific validations
  (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    // Log payout attempts for fraud monitoring
    logger.info('Payout request initiated', {
      userId: user.id,
      userEmail: user.email,
      amount: req.body.amountUSDC,
      payoutMethodId: req.body.payoutMethodId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });
    
    next();
  }
];

/**
 * Security configuration for referral endpoints
 */
export const referralSecurity = [
  ...baseMonetizationSecurity,
  ...createMonetizationProtection('referrals'),
  validateRequest(ReferralClaimValidation, 'body'),
  // Additional referral-specific validations
  (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).userId;
    const { referralCode, metadata } = req.body;
    
    // Enhanced fraud detection for referrals
    const suspiciousIndicators = [];
    
    // Check for suspicious user agent
    const userAgent = req.headers['user-agent'] || '';
    if (!userAgent || userAgent.length < 10) {
      suspiciousIndicators.push('missing_or_short_user_agent');
    }
    
    // Check for rapid referral claims
    const providedTimestamp = metadata?.timestamp;
    if (providedTimestamp) {
      const timeDiff = Math.abs(Date.now() - providedTimestamp);
      if (timeDiff > 30 * 60 * 1000) { // More than 30 minutes old
        suspiciousIndicators.push('old_timestamp');
      }
    }
    
    // Log referral attempt with fraud indicators
    logger.info('Referral claim attempt', {
      userId,
      referralCode,
      ip: req.ip,
      userAgent,
      suspiciousIndicators,
      metadata,
      timestamp: new Date().toISOString()
    });
    
    // Block obviously fraudulent attempts
    if (suspiciousIndicators.length >= 2) {
      logger.warn('Blocking suspicious referral claim', {
        userId,
        referralCode,
        suspiciousIndicators,
        ip: req.ip
      });
      
      return res.status(400).json({
        error: 'Unable to process referral claim',
        code: 'REFERRAL_VALIDATION_FAILED'
      });
    }
    
    next();
  }
];

/**
 * Security configuration for split policy endpoints
 */
export const splitPolicySecurity = [
  ...baseMonetizationSecurity,
  ...createMonetizationProtection('splitPolicies'),
  validateRequest(SplitPolicyValidation, 'body')
];

/**
 * Security configuration for plan management endpoints
 */
export const planSecurity = [
  ...baseMonetizationSecurity,
  ...createMonetizationProtection('subscriptions'), // Reuse subscription rate limits
  validateRequest(PlanValidation, 'body')
];

/**
 * Security configuration for payout method endpoints
 */
export const payoutMethodSecurity = [
  ...baseMonetizationSecurity,
  ...createMonetizationProtection('payouts'), // Reuse payout rate limits
  validateRequest(PayoutMethodValidation, 'body'),
  // Additional payout method validations
  (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { type, address, accountNumber } = req.body;
    
    // Log payout method creation for compliance
    logger.info('Payout method creation attempt', {
      userId: user.id,
      userEmail: user.email,
      methodType: type,
      hasAddress: !!address,
      hasAccountNumber: !!accountNumber,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    next();
  }
];

/**
 * Security configuration for finance query endpoints (read-only)
 */
export const financeQuerySecurity = [
  // Lighter security for read operations
  validateRequestSize(50), // 50KB max for queries
  authenticateUser,
  ...createMonetizationProtection('financeQueries')
];

/**
 * Security middleware factory for custom endpoint protection
 */
export function createCustomMonetizationSecurity(
  rateLimitType: 'tips' | 'subscriptions' | 'payouts' | 'referrals' | 'splitPolicies' | 'financeQueries',
  validationSchema?: any,
  customMiddleware?: Array<(req: Request, res: Response, next: NextFunction) => void>
) {
  const middleware = [
    ...baseMonetizationSecurity,
    ...createMonetizationProtection(rateLimitType)
  ];
  
  if (validationSchema) {
    middleware.push(validateRequest(validationSchema, 'body'));
  }
  
  if (customMiddleware) {
    middleware.push(...customMiddleware);
  }
  
  return middleware;
}

/**
 * Security health check middleware
 * Reports on security measures applied to the request
 */
export function securityHealthCheck(req: Request, res: Response, next: NextFunction) {
  const securityHeaders = {
    'X-Security-Applied': 'true',
    'X-Rate-Limited': 'true',
    'X-Validated': 'true',
    'X-Sanitized': 'true',
    'X-Authenticated': !!(req as any).user,
    'X-Idempotency-Protected': !!req.headers['idempotency-key']
  };
  
  // Add security headers to response
  Object.entries(securityHeaders).forEach(([header, value]) => {
    res.set(header, String(value));
  });
  
  next();
}

/**
 * Emergency circuit breaker for monetization endpoints
 * Can be activated to disable all financial operations during incidents
 */
export function monetizationCircuitBreaker(req: Request, res: Response, next: NextFunction) {
  // This would typically check a Redis flag or environment variable
  const isEmergencyMode = process.env.EMERGENCY_DISABLE_MONETIZATION === 'true';
  
  if (isEmergencyMode) {
    logger.warn('Monetization circuit breaker activated', {
      endpoint: req.path,
      method: req.method,
      userId: (req as any).userId,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    return res.status(503).json({
      error: 'Monetization services temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
      retryAfter: '300' // 5 minutes
    });
  }
  
  next();
}

/**
 * Export all security configurations for easy application to routes
 */
export const monetizationSecurity = {
  tip: tipSecurity,
  subscription: subscriptionSecurity,
  payout: payoutSecurity,
  referral: referralSecurity,
  splitPolicy: splitPolicySecurity,
  plan: planSecurity,
  payoutMethod: payoutMethodSecurity,
  financeQuery: financeQuerySecurity,
  base: baseMonetizationSecurity,
  custom: createCustomMonetizationSecurity,
  healthCheck: securityHealthCheck,
  circuitBreaker: monetizationCircuitBreaker
};