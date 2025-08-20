import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { env } from '../config/env'; // Assuming env is configured for Redis URL
import { logger } from '../utils/logger'; // Assuming a logger utility exists

const redis = new Redis(env.REDIS_URL);
const IDEMPOTENCY_TTL_SECONDS = 10 * 60; // 10 minutes

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
    if (req.method !== 'POST') {
        return next();
    }

    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
        return next();
    }

    const route = req.baseUrl + req.path;
    const redisKey = `idemp:${route}:${idempotencyKey}`;

    redis.get(redisKey)
        .then(cachedResponse => {
            if (cachedResponse) {
                logger.info(`Idempotency: Replaying cached response for key: ${idempotencyKey}, route: ${route}`);
                const { status, body } = JSON.parse(cachedResponse);
                res.setHeader('X-Idempotency-Replay', 'true');
                return res.status(status).json(body);
            } else {
                // Store original send function
                const originalSend = res.send;
                res.send = (body: any) => {
                    // Only cache successful responses
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const responseToCache = JSON.stringify({ status: res.statusCode, body: JSON.parse(body) });
                        redis.setex(redisKey, IDEMPOTENCY_TTL_SECONDS, responseToCache)
                            .catch(err => logger.error(`Idempotency: Failed to cache response for key ${idempotencyKey}:`, err));
                    }
                    return originalSend.call(res, body);
                };
                next();
            }
        })
        .catch(err => {
            logger.error(`Idempotency: Redis error for key ${idempotencyKey}:`, err);
            next(); // Continue processing even if Redis has issues
        });
}