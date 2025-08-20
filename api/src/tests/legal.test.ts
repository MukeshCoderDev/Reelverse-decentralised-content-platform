import request from 'supertest';
import express from 'express';
import legalRoutes from '../routes/legal'; // Assuming this is the correct path
import { getDatabase } from '../config/database'; // Assuming getDatabase is exported
import { Pool, QueryResult } from 'pg';
import { logger } from '../utils/logger';

// Mock the database and logger
jest.mock('../config/database');
jest.mock('../utils/logger');

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
const mockPool = {
    query: jest.fn(),
} as unknown as jest.Mocked<Pool>;

// Mock res.locals.requestId for middleware context
const mockRequestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    res.locals.requestId = 'test-request-id';
    next();
};

describe('Legal Routes', () => {
    let app: express.Application;

    beforeAll(() => {
        mockGetDatabase.mockReturnValue(mockPool);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        app.use(mockRequestIdMiddleware); // Apply mock requestId middleware
        app.use('/api/v1/legal', legalRoutes); // Mount legal routes
    });

    describe('POST /api/v1/legal/dmca', () => {
        it('should create a new DMCA takedown request and return 201', async () => {
            const mockDmcaId = 'a1b2c3d4-e5f6-4789-1234-567890abcdef';
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: mockDmcaId, status: 'open', created_at: new Date().toISOString() }],
            } as QueryResult);

            const requestBody = {
                reporterEmail: 'test@example.com',
                urls: ['http://example.com/infringing-content'],
                reason: 'This content infringes on my copyright.',
            };

            const response = await request(app)
                .post('/api/v1/legal/dmca')
                .send(requestBody);

            expect(response.statusCode).toBe(201);
            expect(response.body).toEqual({ id: mockDmcaId, status: 'open' });
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO dmca_takedowns'),
                [requestBody.reporterEmail, requestBody.urls, null, requestBody.reason, null, 'open']
            );
            expect(logger.info).toHaveBeenCalledWith(
                `DMCA takedown request created: ${mockDmcaId}`,
                expect.objectContaining({ requestId: 'test-request-id', dmcaId: mockDmcaId, reporterEmail: requestBody.reporterEmail })
            );
        });

        it('should return 400 for invalid request body', async () => {
            const requestBody = {
                reporterEmail: 'invalid-email', // Invalid email
                urls: [], // Empty URLs
                reason: 'Too short', // Too short reason
            };

            const response = await request(app)
                .post('/api/v1/legal/dmca')
                .send(requestBody);

            expect(response.statusCode).toBe(400);
            expect(response.body.code).toBe('VALIDATION_ERROR');
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('DMCA validation error'),
                expect.objectContaining({ requestId: 'test-request-id' })
            );
            expect(mockPool.query).not.toHaveBeenCalled();
        });

        it('should return 500 if database operation fails', async () => {
            mockPool.query.mockRejectedValueOnce(new Error('Database error'));

            const requestBody = {
                reporterEmail: 'test@example.com',
                urls: ['http://example.com/infringing-content'],
                reason: 'This content infringes on my copyright.',
            };

            const response = await request(app)
                .post('/api/v1/legal/dmca')
                .send(requestBody);

            expect(response.statusCode).toBe(500);
            expect(response.body.code).toBeUndefined(); // No specific error code for generic 500
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to create DMCA takedown request'),
                expect.objectContaining({ requestId: 'test-request-id', error: expect.any(Error) })
            );
        });
    });

    describe('GET /api/v1/legal/dmca/:id', () => {
        it('should return DMCA details for a valid ID', async () => {
            const mockDmcaId = 'a1b2c3d4-e5f6-4789-1234-567890abcdef';
            const mockDmcaEntry = {
                id: mockDmcaId,
                reporter_email: 'test@example.com',
                urls: ['http://example.com/infringing-content'],
                content_ids: null,
                reason: 'This content infringes on my copyright.',
                evidence_urls: null,
                status: 'open',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockPool.query.mockResolvedValueOnce({
                rows: [mockDmcaEntry],
            } as QueryResult);

            const response = await request(app)
                .get(`/api/v1/legal/dmca/${mockDmcaId}`);

            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual(mockDmcaEntry);
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT id, reporter_email'),
                [mockDmcaId]
            );
            expect(logger.info).toHaveBeenCalledWith(
                `Fetched DMCA takedown request: ${mockDmcaId}`,
                expect.objectContaining({ requestId: 'test-request-id', dmcaId: mockDmcaId })
            );
        });

        it('should return 400 for an invalid ID format', async () => {
            const invalidId = 'not-a-uuid';

            const response = await request(app)
                .get(`/api/v1/legal/dmca/${invalidId}`);

            expect(response.statusCode).toBe(400);
            expect(response.body.code).toBe('INVALID_ID_FORMAT');
            expect(logger.warn).toHaveBeenCalledWith(
                `Invalid DMCA ID format: ${invalidId}`,
                expect.objectContaining({ requestId: 'test-request-id' })
            );
            expect(mockPool.query).not.toHaveBeenCalled();
        });

        it('should return 404 if DMCA request not found', async () => {
            const nonExistentId = 'b1b2c3d4-e5f6-4789-1234-567890abcdef';
            mockPool.query.mockResolvedValueOnce({ rows: [] } as QueryResult);

            const response = await request(app)
                .get(`/api/v1/legal/dmca/${nonExistentId}`);

            expect(response.statusCode).toBe(404);
            expect(response.body.code).toBe('NOT_FOUND');
            expect(logger.info).toHaveBeenCalledWith(
                `DMCA takedown request not found: ${nonExistentId}`,
                expect.objectContaining({ requestId: 'test-request-id' })
            );
        });

        it('should return 500 if database operation fails', async () => {
            const mockDmcaId = 'c1b2c3d4-e5f6-4789-1234-567890abcdef';
            mockPool.query.mockRejectedValueOnce(new Error('Database error'));

            const response = await request(app)
                .get(`/api/v1/legal/dmca/${mockDmcaId}`);

            expect(response.statusCode).toBe(500);
            expect(response.body.code).toBeUndefined();
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Failed to fetch DMCA takedown request ${mockDmcaId}`),
                expect.objectContaining({ requestId: 'test-request-id', error: expect.any(Error) })
            );
        });
    });
});