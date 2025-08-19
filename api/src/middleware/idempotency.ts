import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis'; // Assuming a redis client getter
import { logger } from '../utils/logger';
import { env } from '../config/env';

const IDEMPOTENCY_KEY_PREFIX = 'idemp';
const IDEMPOTENCY_TTL_SECONDS = 10 * 60; // 10 minutes

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'POST') {
    return next();
  }

  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) {
    return next();
  }

  const redisClient = getRedisClient();
  const route = req.baseUrl + req.path;
  const redisKey = `${IDEMPOTENCY_KEY_PREFIX}:${route}:${idempotencyKey}`;

  try {
    const cachedResponse = await redisClient.get(redisKey);

    if (cachedResponse) {
      logger.info(`Idempotency replay detected for key: ${redisKey}`);
      const { status, body } = JSON.parse(cachedResponse);
      res.setHeader('X-Idempotency-Replay', 'true');
      return res.status(status).json(body);
    }

    // Monkey-patch res.send and res.json to cache the response
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function (body?: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const responseToCache = JSON.stringify({ status: res.statusCode, body: body ? JSON.parse(body) : {} });
        redisClient.setex(redisKey, IDEMPOTENCY_TTL_SECONDS, responseToCache).catch(err => {
          logger.error(`Failed to cache idempotency response for key ${redisKey}:`, err);
        });
      }
      return originalSend.apply(res, arguments as any);
    } as Response['send'];

    res.json = function (body?: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const responseToCache = JSON.stringify({ status: res.statusCode, body: body });
        redisClient.setex(redisKey, IDEMPOTENCY_TTL_SECONDS, responseToCache).catch(err => {
          logger.error(`Failed to cache idempotency response for key ${redisKey}:`, err);
        });
      }
      return originalJson.apply(res, arguments as any);
    } as Response['json'];

    next();
  } catch (error: any) {
    logger.error(`Error in idempotency middleware for key ${redisKey}:`, error);
    next(error); // Pass error to next middleware
  }
};