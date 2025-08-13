import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthenticatedRequest extends Request {
  walletAddress?: string;
}

/**
 * Middleware to authenticate wallet-based requests using JWT tokens
 */
export const authenticateWallet = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        code: 'AUTH_001',
        message: 'Missing or invalid authorization header',
        timestamp: Date.now()
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({
        code: 'AUTH_002',
        message: 'Missing authentication token',
        timestamp: Date.now()
      });
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    if (!decoded.walletAddress) {
      return res.status(401).json({
        code: 'AUTH_003',
        message: 'Invalid token payload',
        timestamp: Date.now()
      });
    }

    // Add wallet address to request object
    req.walletAddress = decoded.walletAddress;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        code: 'AUTH_004',
        message: 'Invalid or expired token',
        timestamp: Date.now()
      });
    }

    return res.status(500).json({
      code: 'AUTH_005',
      message: 'Authentication service error',
      timestamp: Date.now()
    });
  }
};

/**
 * Middleware to optionally authenticate wallet requests
 * Continues even if no valid token is provided
 */
export const optionalWalletAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next(); // Continue without authentication
    }

    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    if (decoded.walletAddress) {
      req.walletAddress = decoded.walletAddress;
    }
    
    next();
  } catch (error) {
    // Log error but continue without authentication
    console.warn('Optional authentication failed:', error);
    next();
  }
};