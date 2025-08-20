import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { getDatabase } from '../config/database';

const router = Router();

// Zod schema for DMCA takedown request body
const dmcaTakedownSchema = z.object({
    reporterEmail: z.string().email('Invalid reporter email format.'),
    urls: z.array(z.string().url('Invalid URL format in urls array.')).min(1, 'At least one URL is required.'),
    contentIds: z.array(z.string().uuid('Invalid UUID format in contentIds array.')).optional(),
    reason: z.string().min(10, 'Reason must be at least 10 characters long.'),
    evidenceUrls: z.array(z.string().url('Invalid URL format in evidenceUrls array.')).optional(),
});

// POST /api/v1/legal/dmca
router.post('/dmca', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = res.locals.requestId;
    try {
        const dmcaData = dmcaTakedownSchema.parse(req.body);

        const { reporterEmail, urls, contentIds, reason, evidenceUrls } = dmcaData;
        const pool = getDatabase();

        const result = await pool.query(
            `INSERT INTO dmca_takedowns (reporter_email, urls, content_ids, reason, evidence_urls, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, status, created_at`,
            [reporterEmail, urls, contentIds || null, reason, evidenceUrls || null, 'open']
        );

        const newDmca = result.rows[0];
        logger.info(`DMCA takedown request created: ${newDmca.id}`, { requestId, dmcaId: newDmca.id, reporterEmail });

        res.status(201).json({ id: newDmca.id, status: newDmca.status });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            logger.warn(`DMCA validation error: ${error.message}`, { requestId, errors: error.errors });
            return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors });
        }
        logger.error(`Failed to create DMCA takedown request: ${error.message}`, { requestId, error });
        next(error);
    }
});

// GET /api/v1/legal/dmca/:id
router.get('/dmca/:id', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = res.locals.requestId;
    try {
        const { id } = req.params;

        // Validate ID format (UUID)
        if (!z.string().uuid().safeParse(id).success) {
            logger.warn(`Invalid DMCA ID format: ${id}`, { requestId });
            return res.status(400).json({ code: 'INVALID_ID_FORMAT', message: 'Invalid DMCA ID format.' });
        }

        const pool = getDatabase();
        const result = await pool.query(
            `SELECT id, reporter_email, urls, content_ids, reason, evidence_urls, status, created_at, updated_at
             FROM dmca_takedowns
             WHERE id = $1`,
            [id]
        );

        const dmcaEntry = result.rows[0];

        if (!dmcaEntry) {
            logger.info(`DMCA takedown request not found: ${id}`, { requestId });
            return res.status(404).json({ code: 'NOT_FOUND', message: 'DMCA takedown request not found.' });
        }

        logger.info(`Fetched DMCA takedown request: ${id}`, { requestId, dmcaId: id });
        res.status(200).json(dmcaEntry);

    } catch (error: any) {
        logger.error(`Failed to fetch DMCA takedown request ${req.params.id}: ${error.message}`, { requestId, error });
        next(error);
    }
});

export default router;