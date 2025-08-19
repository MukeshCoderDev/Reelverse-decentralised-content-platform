import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { parseRateLimit } from '../utils/rateLimitParser';

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export function rateLimit({ key, limit, windowMs }: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const caller = req.user?.id || req.ip;
    const route = req.path;
    const redisKey = `${env.RATE_LIMIT_PREFIX || 'rl:'}${key}:${caller}:${route}`;

    const [count, ttl] = await redis.multi()
      .incr(redisKey)
      .pttl(redisKey)
      .exec() as [number, number];

    if (count === 1) {
      await redis.pexpire(redisKey, windowMs);
    }

    if (count > limit) {
      const remainingMs = ttl > 0 ? ttl : windowMs; // If TTL is negative (key expired), use windowMs
      res.set('Retry-After', Math.ceil(remainingMs / 1000).toString());
      return res.status(429).json({ error: 'rate_limited', retryAfterMs: remainingMs });
    }

    next();
  };
}