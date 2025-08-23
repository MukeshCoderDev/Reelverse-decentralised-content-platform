import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import crypto from 'crypto';

/**
 * Enhanced idempotency middleware for monetization operations
 * Provides stronger guarantees for financial operations with conflict detection
 */

interface IdempotencyRecord {
  status: number;
  body: any;
  headers: Record<string, string>;
  timestamp: number;
  userId: string;
  fingerprint: string;
}

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours for financial operations
const CONFLICT_CHECK_FIELDS = ['userId', 'amountUSDC', 'creatorId', 'videoId', 'planId', 'payoutMethodId'];

/**
 * Generate request fingerprint to detect conflicts
 */
function generateRequestFingerprint(req: Request): string {
  const relevantData = {
    userId: (req as any).userId,
    method: req.method,
    path: req.path,
    // Only include financial-relevant fields from body
    body: CONFLICT_CHECK_FIELDS.reduce((acc, field) => {
      if (req.body && req.body[field] !== undefined) {
        acc[field] = req.body[field];
      }
      return acc;
    }, {} as any)
  };
  
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(relevantData))
    .digest('hex');
}

/**
 * Enhanced idempotency middleware for monetization endpoints
 */
export function monetizationIdempotency() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only apply to POST requests
    if (req.method !== 'POST') {
      return next();
    }
    
    const idempotencyKey = req.headers['idempotency-key'] as string;
    const userId = (req as any).userId;
    
    // Require idempotency key for authenticated financial operations
    if (!idempotencyKey && userId) {
      return res.status(400).json({
        error: 'Idempotency-Key header is required for financial operations',
        code: 'MISSING_IDEMPOTENCY_KEY'
      });
    }
    
    // Skip if no idempotency key (for backwards compatibility with non-financial endpoints)
    if (!idempotencyKey) {
      return next();
    }
    
    const requestFingerprint = generateRequestFingerprint(req);
    const route = req.baseUrl + req.path;
    const redisKey = `monetization_idemp:${route}:${userId}:${idempotencyKey}`;
    
    try {
      const cachedRecord = await redis.get(redisKey);
      
      if (cachedRecord) {
        const record: IdempotencyRecord = JSON.parse(cachedRecord);
        
        // Check for conflicts (same idempotency key with different request data)
        if (record.fingerprint !== requestFingerprint) {
          logger.warn('Idempotency conflict detected', {
            userId,
            idempotencyKey,
            route,
            originalFingerprint: record.fingerprint,
            newFingerprint: requestFingerprint,
            originalTimestamp: record.timestamp,
            newTimestamp: Date.now()
          });
          
          return res.status(409).json({
            error: 'Idempotency key conflict: same key used for different request',
            code: 'IDEMPOTENCY_CONFLICT',
            originalTimestamp: new Date(record.timestamp).toISOString()
          });
        }
        
        // Return cached response
        logger.info('Returning cached idempotent response', {
          userId,
          idempotencyKey,
          route,
          originalTimestamp: record.timestamp,
          statusCode: record.status
        });
        
        res.set(record.headers);
        res.set('X-Idempotency-Replay', 'true');
        return res.status(record.status).json(record.body);
      }
      
      // No cached response, intercept the response to cache it
      const originalSend = res.send;
      const originalJson = res.json;
      let responseCached = false;
      
      const cacheResponse = async (statusCode: number, body: any) => {
        // Only cache successful responses (2xx status codes)
        if (statusCode >= 200 && statusCode < 300 && !responseCached) {
          responseCached = true;
          
          const recordToCache: IdempotencyRecord = {
            status: statusCode,
            body: typeof body === 'string' ? JSON.parse(body) : body,
            headers: {
              'Content-Type': res.get('Content-Type') || 'application/json',
              'X-Idempotency-Cached': 'true'
            },
            timestamp: Date.now(),
            userId,
            fingerprint: requestFingerprint
          };
          
          try {
            await redis.setex(redisKey, IDEMPOTENCY_TTL_SECONDS, JSON.stringify(recordToCache));
            
            logger.info('Cached successful monetization response', {
              userId,
              idempotencyKey,
              route,
              statusCode,
              ttl: IDEMPOTENCY_TTL_SECONDS
            });
          } catch (error) {
            logger.error('Failed to cache idempotent response', {
              userId,
              idempotencyKey,
              route,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            // Don't fail the request if caching fails
          }
        }
      };
      
      // Override res.json
      res.json = function(body: any) {
        cacheResponse(res.statusCode, body);
        return originalJson.call(this, body);
      };
      
      // Override res.send  
      res.send = function(body: any) {
        cacheResponse(res.statusCode, body);
        return originalSend.call(this, body);
      };
      
      next();
      
    } catch (error) {
      logger.error('Monetization idempotency middleware error', {
        userId,
        idempotencyKey,
        route,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Continue processing even if Redis has issues
      next();
    }
  };
}

/**
 * Cleanup expired idempotency records
 * Should be called periodically by a background job
 */
export async function cleanupExpiredIdempotencyRecords(): Promise<void> {
  try {
    const pattern = 'monetization_idemp:*';
    const keys = await redis.keys(pattern);
    
    let cleanedCount = 0;
    for (const key of keys) {
      const ttl = await redis.ttl(key);
      // Remove keys that are close to expiring (within 1 hour)
      if (ttl > 0 && ttl < 3600) {
        await redis.del(key);
        cleanedCount++;
      }
    }
    
    logger.info('Cleaned up expired idempotency records', {
      totalKeys: keys.length,
      cleanedCount
    });
  } catch (error) {
    logger.error('Failed to cleanup idempotency records', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get idempotency statistics for monitoring
 */
export async function getIdempotencyStats(): Promise<{
  totalRecords: number;
  recordsByRoute: Record<string, number>;
  oldestRecord: number | null;
  newestRecord: number | null;
}> {
  try {
    const pattern = 'monetization_idemp:*';
    const keys = await redis.keys(pattern);
    
    const stats = {
      totalRecords: keys.length,
      recordsByRoute: {} as Record<string, number>,
      oldestRecord: null as number | null,
      newestRecord: null as number | null
    };
    
    for (const key of keys.slice(0, 100)) { // Sample first 100 keys for performance
      try {
        const record = await redis.get(key);
        if (record) {
          const parsed: IdempotencyRecord = JSON.parse(record);
          
          // Extract route from key
          const routeMatch = key.match(/monetization_idemp:([^:]+):/);
          if (routeMatch) {
            const route = routeMatch[1];
            stats.recordsByRoute[route] = (stats.recordsByRoute[route] || 0) + 1;
          }
          
          // Track timestamps
          if (!stats.oldestRecord || parsed.timestamp < stats.oldestRecord) {
            stats.oldestRecord = parsed.timestamp;
          }
          if (!stats.newestRecord || parsed.timestamp > stats.newestRecord) {
            stats.newestRecord = parsed.timestamp;
          }
        }
      } catch (parseError) {
        // Skip corrupted records
        continue;
      }
    }
    
    return stats;
  } catch (error) {
    logger.error('Failed to get idempotency stats', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return {
      totalRecords: 0,
      recordsByRoute: {},
      oldestRecord: null,
      newestRecord: null
    };
  }
}