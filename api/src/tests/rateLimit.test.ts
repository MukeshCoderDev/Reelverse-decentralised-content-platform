import request from 'supertest';
import express from 'express';
import { rateLimit } from '../middleware/rateLimit';
import { RedisService } from '../config/redis';
import { env } from '../config/env';
import { parseRateLimit } from '../utils/rateLimitParser';

// Mock RedisService
jest.mock('../config/redis', () => ({
  RedisService: {
    getInstance: jest.fn().mockReturnValue({
      multi: jest.fn().mockReturnThis(),
      incr: jest.fn(),
      pttl: jest.fn(),
      pexpire: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      exec: jest.fn(),
    }),
  },
}));

const mockRedis = RedisService.getInstance();

describe('rateLimit middleware', () => {
  let app: express.Application;
  const testPrefix = 'test_rl:';

  beforeAll(() => {
    // Set a test prefix for rate limiting keys
    env.RATE_LIMIT_PREFIX = testPrefix;
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Clear all keys with the test prefix before each test
    (mockRedis.keys as jest.Mock).mockResolvedValue([]); // Mock initial empty keys
    (mockRedis.del as jest.Mock).mockResolvedValue(1); // Mock successful deletion
  });

  afterEach(async () => {
    // Clean up Redis keys created during tests
    const keys = await (mockRedis.keys as jest.Mock).mockResolvedValueOnce([`${testPrefix}*`]).mock.results[0].value;
    if (keys.length > 0) {
      await (mockRedis.del as jest.Mock)(keys);
    }
    jest.clearAllMocks();
  });

  it('should allow requests within the limit', async () => {
    const { limit, windowMs } = parseRateLimit('5/min');
    app.get('/test', rateLimit({ key: 'test', limit, windowMs }), (req, res) => res.status(200).send('OK'));

    (mockRedis.multi as jest.Mock).mockReturnThis();
    (mockRedis.incr as jest.Mock).mockResolvedValueOnce(1);
    (mockRedis.pttl as jest.Mock).mockResolvedValueOnce(-1); // Key does not exist or expired
    (mockRedis.pexpire as jest.Mock).mockResolvedValueOnce(1);
    (mockRedis.exec as jest.Mock).mockResolvedValueOnce([1, -1]);

    for (let i = 0; i < limit; i++) {
      const res = await request(app).get('/test');
      expect(res.statusCode).toBe(200);
      expect(res.text).toBe('OK');
    }
  });

  it('should block requests beyond the limit with 429 and Retry-After', async () => {
    const { limit, windowMs } = parseRateLimit('2/sec');
    app.get('/test', rateLimit({ key: 'test', limit, windowMs }), (req, res) => res.status(200).send('OK'));

    // First request: allowed
    (mockRedis.multi as jest.Mock).mockReturnThis();
    (mockRedis.incr as jest.Mock).mockResolvedValueOnce(1);
    (mockRedis.pttl as jest.Mock).mockResolvedValueOnce(-1);
    (mockRedis.pexpire as jest.Mock).mockResolvedValueOnce(1);
    (mockRedis.exec as jest.Mock).mockResolvedValueOnce([1, -1]);
    await request(app).get('/test').expect(200);

    // Second request: allowed
    (mockRedis.multi as jest.Mock).mockReturnThis();
    (mockRedis.incr as jest.Mock).mockResolvedValueOnce(2);
    (mockRedis.pttl as jest.Mock).mockResolvedValueOnce(500); // 0.5 seconds remaining
    (mockRedis.pexpire as jest.Mock).mockResolvedValueOnce(0); // Not called if key exists
    (mockRedis.exec as jest.Mock).mockResolvedValueOnce([2, 500]);
    await request(app).get('/test').expect(200);

    // Third request: blocked
    (mockRedis.multi as jest.Mock).mockReturnThis();
    (mockRedis.incr as jest.Mock).mockResolvedValueOnce(3);
    (mockRedis.pttl as jest.Mock).mockResolvedValueOnce(200); // 0.2 seconds remaining
    (mockRedis.pexpire as jest.Mock).mockResolvedValueOnce(0);
    (mockRedis.exec as jest.Mock).mockResolvedValueOnce([3, 200]);
    const res = await request(app).get('/test');
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBe('1'); // Math.ceil(200/1000)
    expect(res.body).toEqual({ error: 'rate_limited', retryAfterMs: 200 });
  });

  it('should reset after the windowMs', async () => {
    jest.useFakeTimers();
    const { limit, windowMs } = parseRateLimit('1/sec');
    app.get('/test', rateLimit({ key: 'test', limit, windowMs }), (req, res) => res.status(200).send('OK'));

    // First request: allowed
    (mockRedis.multi as jest.Mock).mockReturnThis();
    (mockRedis.incr as jest.Mock).mockResolvedValueOnce(1);
    (mockRedis.pttl as jest.Mock).mockResolvedValueOnce(-1);
    (mockRedis.pexpire as jest.Mock).mockResolvedValueOnce(1);
    (mockRedis.exec as jest.Mock).mockResolvedValueOnce([1, -1]);
    await request(app).get('/test').expect(200);

    // Second request: blocked
    (mockRedis.multi as jest.Mock).mockReturnThis();
    (mockRedis.incr as jest.Mock).mockResolvedValueOnce(2);
    (mockRedis.pttl as jest.Mock).mockResolvedValueOnce(500);
    (mockRedis.pexpire as jest.Mock).mockResolvedValueOnce(0);
    (mockRedis.exec as jest.Mock).mockResolvedValueOnce([2, 500]);
    await request(app).get('/test').expect(429);

    // Advance timers past windowMs
    jest.advanceTimersByTime(windowMs + 100);

    // Third request: allowed (new window)
    (mockRedis.multi as jest.Mock).mockReturnThis();
    (mockRedis.incr as jest.Mock).mockResolvedValueOnce(1); // Count resets
    (mockRedis.pttl as jest.Mock).mockResolvedValueOnce(-1);
    (mockRedis.pexpire as jest.Mock).mockResolvedValueOnce(1);
    (mockRedis.exec as jest.Mock).mockResolvedValueOnce([1, -1]);
    await request(app).get('/test').expect(200);

    jest.useRealTimers();
  });

  it('should identify caller by req.user.id if present', async () => {
    const { limit, windowMs } = parseRateLimit('1/min');
    app.use((req, res, next) => {
      (req as any).user = { id: 'testUser123' };
      next();
    });
    app.get('/test', rateLimit({ key: 'test', limit, windowMs }), (req, res) => res.status(200).send('OK'));

    (mockRedis.multi as jest.Mock).mockReturnThis();
    (mockRedis.incr as jest.Mock).mockResolvedValueOnce(1);
    (mockRedis.pttl as jest.Mock).mockResolvedValueOnce(-1);
    (mockRedis.pexpire as jest.Mock).mockResolvedValueOnce(1);
    (mockRedis.exec as jest.Mock).mockResolvedValueOnce([1, -1]);
    await request(app).get('/test').expect(200);

    expect(mockRedis.incr).toHaveBeenCalledWith(`${testPrefix}test:testUser123:/test`);
  });

  it('should identify caller by req.ip if req.user.id is not present', async () => {
    const { limit, windowMs } = parseRateLimit('1/min');
    app.get('/test', rateLimit({ key: 'test', limit, windowMs }), (req, res) => res.status(200).send('OK'));

    (mockRedis.multi as jest.Mock).mockReturnThis();
    (mockRedis.incr as jest.Mock).mockResolvedValueOnce(1);
    (mockRedis.pttl as jest.Mock).mockResolvedValueOnce(-1);
    (mockRedis.pexpire as jest.Mock).mockResolvedValueOnce(1);
    (mockRedis.exec as jest.Mock).mockResolvedValueOnce([1, -1]);
    await request(app).get('/test').expect(200);

    // Supertest uses 127.0.0.1 as default IP
    expect(mockRedis.incr).toHaveBeenCalledWith(`${testPrefix}test:127.0.0.1:/test`);
  });

  it('should clear keys by prefix between tests (mocked)', async () => {
    const { limit, windowMs } = parseRateLimit('1/min');
    app.get('/test-clear', rateLimit({ key: 'clear', limit, windowMs }), (req, res) => res.status(200).send('OK'));

    // Simulate a key being set in a previous test
    (mockRedis.multi as jest.Mock).mockReturnThis();
    (mockRedis.incr as jest.Mock).mockResolvedValueOnce(1);
    (mockRedis.pttl as jest.Mock).mockResolvedValueOnce(-1);
    (mockRedis.pexpire as jest.Mock).mockResolvedValueOnce(1);
    (mockRedis.exec as jest.Mock).mockResolvedValueOnce([1, -1]);
    await request(app).get('/test-clear').expect(200);

    // In the afterEach, we mock keys and del to ensure cleanup logic is called
    expect(mockRedis.keys).toHaveBeenCalledWith(`${testPrefix}*`);
    expect(mockRedis.del).toHaveBeenCalledWith(expect.arrayContaining([`${testPrefix}clear:127.0.0.1:/test-clear`]));
  });
});