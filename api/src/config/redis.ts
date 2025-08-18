// Use require to avoid mismatched redis typings in this mono-repo snapshot
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createClient } = require('redis');
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

let redisClient: any;

export async function connectRedis(): Promise<any> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = createClient({
      url: redisUrl,
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.info('Redis client disconnected');
    });

    await redisClient.connect();
    
    // Test the connection
    await redisClient.ping();
    
    logger.info('Redis connection established successfully');
    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export function getRedis(): any {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
}

// Redis utility functions
export class RedisService {
  private client: any;

  constructor() {
    this.client = getRedis();
  }

  // Session management
  async setSession(sessionId: string, data: any, ttl: number = 86400): Promise<void> {
    await this.client.setEx(`session:${sessionId}`, ttl, JSON.stringify(data));
  }

  async getSession(sessionId: string): Promise<any | null> {
    const data = await this.client.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.del(`session:${sessionId}`);
  }

  // Nonce management for SIWE
  async setNonce(address: string, nonce: string, ttl: number = 300): Promise<void> {
    await this.client.setEx(`nonce:${address.toLowerCase()}`, ttl, nonce);
  }

  async getNonce(address: string): Promise<string | null> {
    return await this.client.get(`nonce:${address.toLowerCase()}`);
  }

  async deleteNonce(address: string): Promise<void> {
    await this.client.del(`nonce:${address.toLowerCase()}`);
  }

  // Rate limiting
  async incrementRateLimit(key: string, window: number): Promise<number> {
    const multi = this.client.multi();
    multi.incr(key);
    multi.expire(key, window);
    const results = await multi.exec();
    return results[0] as number;
  }

  // Caching
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setEx(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async get(key: string): Promise<any | null> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  // Queue management for upload processing
  async pushToQueue(queueName: string, data: any): Promise<void> {
    await this.client.lPush(`queue:${queueName}`, JSON.stringify(data));
  }

  async popFromQueue(queueName: string): Promise<any | null> {
    const data = await this.client.rPop(`queue:${queueName}`);
    return data ? JSON.parse(data) : null;
  }

  async getQueueLength(queueName: string): Promise<number> {
    return await this.client.lLen(`queue:${queueName}`);
  }

  // Pub/Sub for real-time updates
  async publish(channel: string, message: any): Promise<void> {
    await this.client.publish(channel, JSON.stringify(message));
  }

  // Lock mechanism for critical sections
  // Token-based Lock mechanism for critical sections
  // Returns a token string when acquired, null otherwise
  async acquireLockToken(lockKey: string, ttl: number = 30): Promise<string | null> {
    const token = crypto.randomUUID();
    const result = await this.client.set(`lock:${lockKey}`, token, {
      NX: true,
      EX: ttl
    });
    return result === 'OK' ? token : null;
  }

  // Release lock only if token matches (Lua script)
  async releaseLockToken(lockKey: string, token: string): Promise<boolean> {
    const lua = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
    const res = await this.client.eval(lua, { keys: [`lock:${lockKey}`], arguments: [token] });
    return res === 1;
  }

  // Backwards-compatible helpers
  async acquireLock(lockKey: string, ttl: number = 30): Promise<boolean> {
    const token = await this.acquireLockToken(lockKey, ttl);
    return token !== null;
  }

  async releaseLock(lockKey: string): Promise<void> {
    // best-effort: delete even without token (fallback)
    await this.client.del(`lock:${lockKey}`);
  }

  // Feature flags
  async setFeatureFlag(flagName: string, enabled: boolean, config?: any): Promise<void> {
    const flagData = { enabled, config: config || {}, updatedAt: new Date().toISOString() };
    await this.client.set(`flag:${flagName}`, JSON.stringify(flagData));
  }

  async getFeatureFlag(flagName: string): Promise<{ enabled: boolean; config: any } | null> {
    const data = await this.client.get(`flag:${flagName}`);
    return data ? JSON.parse(data) : null;
  }

  // Analytics and metrics
  async incrementCounter(key: string, amount: number = 1): Promise<number> {
    return await this.client.incrBy(`counter:${key}`, amount);
  }

  async getCounter(key: string): Promise<number> {
    const value = await this.client.get(`counter:${key}`);
    return value ? parseInt(value) : 0;
  }

  // Temporary data storage
  async setTemporary(key: string, data: any, ttl: number): Promise<void> {
    await this.client.setEx(`temp:${key}`, ttl, JSON.stringify(data));
  }

  async getTemporary(key: string): Promise<any | null> {
    const data = await this.client.get(`temp:${key}`);
    return data ? JSON.parse(data) : null;
  }

  // Additional methods for PlaybackTokenService
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  // Set operations for tracking user sessions
  async sadd(key: string, ...members: string[]): Promise<number> {
    return await this.client.sAdd(key, members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return await this.client.sRem(key, members);
  }

  async smembers(key: string): Promise<string[]> {
    return await this.client.sMembers(key);
  }

  async scard(key: string): Promise<number> {
    return await this.client.sCard(key);
  }

  // Singleton instance for PlaybackTokenService
  private static instance: RedisService;

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }
}