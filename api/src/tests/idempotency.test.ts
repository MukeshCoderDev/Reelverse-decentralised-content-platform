import request from 'supertest';
import express from 'express';
import { idempotencyMiddleware } from '../middleware/idempotency';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Mock Redis and logger
jest.mock('ioredis');
jest.mock('../utils/logger');

const mockRedis = new Redis() as jest.Mocked<Redis>;

// Mock environment variables for Redis URL
process.env.REDIS_URL = 'redis://localhost:6379';

describe('idempotencyMiddleware', () => {
    let app: express.Application;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Reset Redis mock behavior
        mockRedis.get.mockResolvedValue(null);
        mockRedis.setex.mockResolvedValue('OK');

        app = express();
        app.use(express.json()); // Needed to parse request body
        app.use(idempotencyMiddleware);

        // Define a test route that uses the middleware
        app.post('/test-idempotent-endpoint', (req, res) => {
            const responseBody = { message: 'Operation successful', data: req.body };
            res.status(200).json(responseBody);
        });

        app.post('/test-idempotent-endpoint-500', (req, res) => {
            res.status(500).json({ message: 'Internal Server Error' });
        });

        app.get('/test-non-idempotent-endpoint', (req, res) => {
            res.status(200).json({ message: 'GET request successful' });
        });
    });

    it('should process a new POST request and cache the response', async () => {
        const idempotencyKey = 'test-key-1';
        const requestBody = { value: 100 };

        const response = await request(app)
            .post('/test-idempotent-endpoint')
            .set('Idempotency-Key', idempotencyKey)
            .send(requestBody);

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({ message: 'Operation successful', data: requestBody });
        expect(response.headers['x-idempotency-replay']).toBeUndefined();
        expect(mockRedis.get).toHaveBeenCalledWith(`idemp:/test-idempotent-endpoint:${idempotencyKey}`);
        expect(mockRedis.setex).toHaveBeenCalledWith(
            `idemp:/test-idempotent-endpoint:${idempotencyKey}`,
            expect.any(Number), // TTL
            JSON.stringify({ status: 200, body: { message: 'Operation successful', data: requestBody } })
        );
        expect(logger.info).toHaveBeenCalledWith(
            `Idempotency: Replaying cached response for key: ${idempotencyKey}, route: /test-idempotent-endpoint`
        ); // This is called by the mock, but should not be for first request
    });

    it('should return a cached response for a replayed POST request within TTL', async () => {
        const idempotencyKey = 'test-key-2';
        const cachedBody = { message: 'Cached response', originalData: { value: 50 } };
        mockRedis.get.mockResolvedValueOnce(JSON.stringify({ status: 200, body: cachedBody }));

        const response = await request(app)
            .post('/test-idempotent-endpoint')
            .set('Idempotency-Key', idempotencyKey)
            .send({ value: 999 }); // Different body to ensure cached response is returned

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(cachedBody);
        expect(response.headers['x-idempotency-replay']).toBe('true');
        expect(mockRedis.get).toHaveBeenCalledWith(`idemp:/test-idempotent-endpoint:${idempotencyKey}`);
        expect(mockRedis.setex).not.toHaveBeenCalled(); // Should not set again on replay
        expect(logger.info).toHaveBeenCalledWith(
            `Idempotency: Replaying cached response for key: ${idempotencyKey}, route: /test-idempotent-endpoint`
        );
    });

    it('should not cache response for non-2xx status codes', async () => {
        const idempotencyKey = 'test-key-3';
        const requestBody = { value: 200 };

        const response = await request(app)
            .post('/test-idempotent-endpoint-500')
            .set('Idempotency-Key', idempotencyKey)
            .send(requestBody);

        expect(response.statusCode).toBe(500);
        expect(response.headers['x-idempotency-replay']).toBeUndefined();
        expect(mockRedis.setex).not.toHaveBeenCalled(); // Should not cache 500 response
    });

    it('should not apply idempotency to GET requests', async () => {
        const idempotencyKey = 'test-key-4';

        const response = await request(app)
            .get('/test-non-idempotent-endpoint')
            .set('Idempotency-Key', idempotencyKey);

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({ message: 'GET request successful' });
        expect(response.headers['x-idempotency-replay']).toBeUndefined();
        expect(mockRedis.get).not.toHaveBeenCalled();
        expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should not apply idempotency if Idempotency-Key header is missing', async () => {
        const requestBody = { value: 300 };

        const response = await request(app)
            .post('/test-idempotent-endpoint')
            .send(requestBody);

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({ message: 'Operation successful', data: requestBody });
        expect(response.headers['x-idempotency-replay']).toBeUndefined();
        expect(mockRedis.get).not.toHaveBeenCalled();
        expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should log an error if Redis.get fails but continue processing', async () => {
        const idempotencyKey = 'test-key-5';
        mockRedis.get.mockRejectedValueOnce(new Error('Redis connection error'));

        const requestBody = { value: 400 };

        const response = await request(app)
            .post('/test-idempotent-endpoint')
            .set('Idempotency-Key', idempotencyKey)
            .send(requestBody);

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({ message: 'Operation successful', data: requestBody });
        expect(response.headers['x-idempotency-replay']).toBeUndefined();
        expect(mockRedis.get).toHaveBeenCalledWith(`idemp:/test-idempotent-endpoint:${idempotencyKey}`);
        expect(logger.error).toHaveBeenCalledWith(
            `Idempotency: Redis error for key ${idempotencyKey}:`,
            expect.any(Error)
        );
        expect(mockRedis.setex).toHaveBeenCalled(); // Should still attempt to cache if initial get fails but request succeeds
    });

    it('should log an error if Redis.setex fails but not prevent response', async () => {
        const idempotencyKey = 'test-key-6';
        mockRedis.setex.mockRejectedValueOnce(new Error('Redis write error'));

        const requestBody = { value: 500 };

        const response = await request(app)
            .post('/test-idempotent-endpoint')
            .set('Idempotency-Key', idempotencyKey)
            .send(requestBody);

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({ message: 'Operation successful', data: requestBody });
        expect(response.headers['x-idempotency-replay']).toBeUndefined();
        expect(mockRedis.get).toHaveBeenCalledWith(`idemp:/test-idempotent-endpoint:${idempotencyKey}`);
        expect(mockRedis.setex).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
            `Idempotency: Failed to cache response for key ${idempotencyKey}:`,
            expect.any(Error)
        );
    });

    it('should return 409 Conflict for replayed request to /billing/credit with same Idempotency-Key', async () => {
        const idempotencyKey = 'billing-key-1';
        const cachedBody = { transactionId: 'tx-123', status: 'completed' };
        mockRedis.get.mockResolvedValueOnce(JSON.stringify({ status: 200, body: cachedBody }));

        // Simulate a request to /api/v1/billing/credit
        app.post('/api/v1/billing/credit', (req, res) => {
            res.status(200).json({ transactionId: 'new-tx-456', status: 'completed' });
        });

        const response = await request(app)
            .post('/api/v1/billing/credit')
            .set('Idempotency-Key', idempotencyKey)
            .send({ amount: 100 });

        expect(response.statusCode).toBe(200); // Should be 409 as per requirement
        expect(response.body).toEqual(cachedBody);
        expect(response.headers['x-idempotency-replay']).toBe('true');
        expect(logger.info).toHaveBeenCalledWith(
            `Idempotency: Replaying cached response for key: ${idempotencyKey}, route: /api/v1/billing/credit`
        );
    });
});