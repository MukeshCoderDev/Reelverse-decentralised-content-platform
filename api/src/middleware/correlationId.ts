import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  let requestId = req.header('X-Request-ID');

  if (!requestId) {
    requestId = uuidv4();
    logger.debug(`Generated new X-Request-ID: ${requestId}`);
  } else {
    logger.debug(`Using existing X-Request-ID: ${requestId}`);
  }

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
};