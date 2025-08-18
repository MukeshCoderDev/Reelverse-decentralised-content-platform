/**
 * Service Authentication for mTLS and Service Tokens
 * Provides secure inter-service communication
 */

import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';

export interface ServiceToken {
  serviceId: string;
  permissions: string[];
  expiresAt: Date;
  issuedAt: Date;
}

export interface ServiceAuthConfig {
  privateKey: string;
  publicKey: string;
  tokenTTL: number; // seconds
  allowedServices: string[];
}

export class ServiceAuthManager {
  private config: ServiceAuthConfig;
  private tokenCache: Map<string, ServiceToken> = new Map();

  constructor(config: ServiceAuthConfig) {
    this.config = config;
  }

  /**
   * Generate service token for inter-service communication
   */
  generateServiceToken(serviceId: string, permissions: string[]): string {
    if (!this.config.allowedServices.includes(serviceId)) {
      throw new Error(`Service ${serviceId} not authorized`);
    }

    const payload = {
      serviceId,
      permissions,
      type: 'service',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.tokenTTL
    };

    return jwt.sign(payload, this.config.privateKey, { algorithm: 'RS256' });
  }

  /**
   * Verify service token
   */
  verifyServiceToken(token: string): ServiceToken {
    try {
      const decoded = jwt.verify(token, this.config.publicKey, { 
        algorithms: ['RS256'] 
      }) as any;

      if (decoded.type !== 'service') {
        throw new Error('Invalid token type');
      }

      return {
        serviceId: decoded.serviceId,
        permissions: decoded.permissions,
        expiresAt: new Date(decoded.exp * 1000),
        issuedAt: new Date(decoded.iat * 1000)
      };
    } catch (error) {
      throw new Error(`Token verification failed: ${error}`);
    }
  }

  /**
   * Check if service has permission
   */
  hasPermission(token: ServiceToken, permission: string): boolean {
    return token.permissions.includes(permission) || token.permissions.includes('*');
  }
}

// Global service auth instance
export const serviceAuth = new ServiceAuthManager({
  privateKey: process.env.SERVICE_PRIVATE_KEY || 'default-private-key',
  publicKey: process.env.SERVICE_PUBLIC_KEY || 'default-public-key',
  tokenTTL: parseInt(process.env.SERVICE_TOKEN_TTL || '3600'),
  allowedServices: (process.env.ALLOWED_SERVICES || 'upload,transcode,drm,policy').split(',')
});