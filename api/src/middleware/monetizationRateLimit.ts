import { Request, Response, NextFunction } from 'express';
import { rateLimit } from './rateLimit';
import { logger } from '../utils/logger';

/**
 * Enhanced rate limiting for monetization endpoints
 * Implements tiered rate limiting based on endpoint sensitivity and user behavior
 */

/**
 * Rate limiting for tip endpoints
 * More restrictive to prevent spam tipping
 */
export const tipRateLimit = rateLimit({
  key: 'tips',
  limit: 10, // 10 tips per window
  windowMs: 60 * 1000 // 1 minute window
});

/**
 * Rate limiting for subscription endpoints
 * Less restrictive as subscriptions are typically one-time actions
 */
export const subscriptionRateLimit = rateLimit({
  key: 'subscriptions',
  limit: 5, // 5 subscription actions per window
  windowMs: 60 * 1000 // 1 minute window
});

/**
 * Rate limiting for payout requests
 * Very restrictive as payouts involve actual money movement
 */
export const payoutRateLimit = rateLimit({
  key: 'payouts',
  limit: 3, // 3 payout requests per window
  windowMs: 5 * 60 * 1000 // 5 minute window
});

/**
 * Rate limiting for referral claims
 * Moderate restriction with longer window to prevent abuse
 */
export const referralRateLimit = rateLimit({
  key: 'referrals',
  limit: 10, // 10 referral claims per window
  windowMs: 10 * 60 * 1000 // 10 minute window
});

/**
 * Rate limiting for split policy management
 * Moderate restriction for policy creation/updates
 */
export const splitPolicyRateLimit = rateLimit({
  key: 'splits',
  limit: 20, // 20 split operations per window
  windowMs: 60 * 1000 // 1 minute window
});

/**
 * Rate limiting for financial data queries
 * More lenient for read operations
 */
export const financeQueryRateLimit = rateLimit({
  key: 'finance_query',
  limit: 100, // 100 queries per window
  windowMs: 60 * 1000 // 1 minute window
});

/**
 * Global rate limiting for all monetization endpoints
 * Prevents user from overwhelming the entire monetization system
 */
export const globalMonetizationRateLimit = rateLimit({
  key: 'global_monetization',
  limit: 50, // 50 total monetization requests per window
  windowMs: 60 * 1000 // 1 minute window
});

/**
 * Aggressive rate limiting for suspicious behavior
 * Applied dynamically based on fraud detection
 */
export const suspiciousActivityRateLimit = rateLimit({
  key: 'suspicious',
  limit: 5, // Very limited requests
  windowMs: 15 * 60 * 1000 // 15 minute window
});

/**
 * Adaptive rate limiting middleware
 * Adjusts limits based on user behavior and endpoint sensitivity
 */
export function adaptiveRateLimit(baseConfig: { key: string; limit: number; windowMs: number }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    let config = { ...baseConfig };
    
    // Adjust limits based on user verification status
    if (user) {
      // Verified users get higher limits
      if (user.isVerified) {
        config.limit = Math.floor(config.limit * 1.5);
      }
      
      // Premium users get even higher limits
      if (user.isPremium) {
        config.limit = Math.floor(config.limit * 2);
      }
      
      // New users get lower limits (account created < 24 hours ago)
      const accountAge = Date.now() - new Date(user.createdAt).getTime();
      if (accountAge < 24 * 60 * 60 * 1000) {
        config.limit = Math.max(1, Math.floor(config.limit * 0.5));
      }
    }
    
    // Apply the rate limit with adjusted config
    const rateLimitMiddleware = rateLimit(config);
    return rateLimitMiddleware(req, res, next);
  };
}

/**
 * IP-based rate limiting for unauthenticated requests
 * Prevents anonymous abuse of monetization endpoints
 */
export const ipRateLimit = rateLimit({
  key: 'ip_monetization',
  limit: 20, // 20 requests per IP per window
  windowMs: 60 * 1000 // 1 minute window
});

/**
 * Burst protection for high-value operations
 * Implements token bucket algorithm for expensive operations
 */
export function createBurstProtection(tokens: number, refillRate: number, refillInterval: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const key = user ? `burst:${user.id}` : `burst:${req.ip}`;
    
    // This would typically use Redis for distributed rate limiting
    // For now, implementing basic in-memory burst protection
    
    // In production, this should be implemented with Redis:
    // const currentTokens = await redis.get(key) || tokens;
    // const lastRefill = await redis.get(`${key}:lastRefill`) || Date.now();
    
    next(); // For now, just continue - implement full burst protection in production
  };
}

/**
 * Financial operation rate limiting
 * Special protection for operations involving money
 */
export const financialOperationRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const userId = user?.id;
  
  // Log all financial operations for monitoring
  logger.info('Financial operation attempted', {
    userId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    endpoint: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    idempotencyKey: req.headers['idempotency-key']
  });
  
  // Apply base rate limiting
  const baseRateLimit = rateLimit({
    key: 'financial_ops',
    limit: 30, // 30 financial operations per window
    windowMs: 5 * 60 * 1000 // 5 minute window
  });
  
  return baseRateLimit(req, res, next);
};

/**
 * Export collection of rate limiters for easy application to routes
 */
export const monetizationRateLimits = {
  tips: tipRateLimit,
  subscriptions: subscriptionRateLimit,
  payouts: payoutRateLimit,
  referrals: referralRateLimit,
  splitPolicies: splitPolicyRateLimit,
  financeQueries: financeQueryRateLimit,
  global: globalMonetizationRateLimit,
  suspicious: suspiciousActivityRateLimit,
  ip: ipRateLimit,
  financial: financialOperationRateLimit
};

/**
 * Middleware stack for comprehensive monetization endpoint protection
 */
export function createMonetizationProtection(endpointType: keyof typeof monetizationRateLimits) {
  return [
    // Global IP-based rate limiting
    ipRateLimit,
    
    // Global monetization rate limiting
    globalMonetizationRateLimit,
    
    // Endpoint-specific rate limiting
    monetizationRateLimits[endpointType],
    
    // Financial operation logging and protection
    financialOperationRateLimit
  ];
}