import { Request, Response, NextFunction } from 'express';
import { createPrivyClient } from '@privy-io/server-auth';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const privy = createPrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);

export async function requirePrivyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized', message: 'No Bearer token provided' });
    }

    const token = authHeader.split(' ')[1];
    const claims = await privy.verifyAuthToken(token);

    // Attach user information to the request
    req.user = {
      id: claims.userId,
      email: claims.email,
      ownerAddress: claims.wallet?.address || req.headers['x-owner-address'] as string, // Fallback for ownerAddress
    };

    next();
  } catch (error) {
    logger.error('Privy authentication failed:', error);
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid Privy token' });
  }
}

// Extend the Request type to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        ownerAddress?: string;
      };
    }
  }
}