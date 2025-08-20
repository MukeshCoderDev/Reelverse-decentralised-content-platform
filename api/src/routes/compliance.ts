import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = Router();

const ageGateAcceptSchema = z.object({
    rememberDays: z.number().int().min(0).max(365).optional(), // Days to remember acceptance
});

// POST /api/v1/compliance/age-gate/accept
router.post('/age-gate/accept', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = res.locals.requestId;
    try {
        const { rememberDays } = ageGateAcceptSchema.parse(req.body);

        const maxAge = rememberDays !== undefined ? rememberDays * 24 * 60 * 60 : 30 * 24 * 60 * 60; // Default 30 days in seconds

        res.cookie('age_gate', '1', {
            maxAge: maxAge * 1000, // Convert to milliseconds
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        });

        logger.info('Age gate acceptance cookie set.', { requestId, rememberDays });
        res.status(200).json({ message: 'Age gate accepted.' });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            logger.warn(`Age gate acceptance validation error: ${error.message}`, { requestId, errors: error.errors });
            return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors });
        }
        logger.error(`Failed to set age gate acceptance cookie: ${error.message}`, { requestId, error });
        next(error);
    }
});

export default router;