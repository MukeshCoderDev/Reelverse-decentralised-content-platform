import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
    let requestId = req.headers['x-request-id'] as string;

    if (!requestId) {
        requestId = uuidv4();
        req.headers['x-request-id'] = requestId; // Set on request for downstream use
    }

    res.setHeader('X-Request-ID', requestId);
    // Attach to res.locals for easy access in handlers and logging
    res.locals.requestId = requestId;

    next();
}