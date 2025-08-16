import { EventEmitter } from 'events';
import crypto from 'crypto';
import { logger } from '../logging/Logger';
import { redis } from '../redis/RedisClient';

// CDN Provider types
export enum CDNProvider {
  CLOUDFLARE = 'cloudflare',
  AWS_CLOUDFRONT = 'aws_cloudfront',
  BUNNY_CDN = 'bunny_cdn',
  FASTLY = 'fastly'
}

// CDN Configuration
export interface CDNConfig {
  provider: CDNProvider;
  name: string;
  baseUrl: string;
  signingKey: string;
  signingKeyId: string;
  regions: string[];
  priority: number; // Lower number = higher priority
  isActive: boolean;
  healthCheckUrl: string;
  maxRetries: number;
  timeoutMs: number;
}

// Signed URL configuration
export interface SignedURLConfig {
  contentId: string;
  expiresIn: number; // seconds
  allowedIPs?: string[];
  allowedCountries?: string[];
  maxDownloads?: number;
}

// CDN Health status
export interface CDNHealth {
  provider: CDNProvider;
  isHealthy: boolean;
  responseTime: number;
  lastCheck: Date;
  errorCount: number;
  consecutiveFailures: number;
}

// Failover configuration
export interface FailoverConfig {
  healthCheckInterval: number; // seconds
  failureThreshold: number; // consecutive failures before failover
  recoveryThreshold: number; // consecutive successes before recovery
  maxFailoverTime: number; // max time to stay on backup CDN
}

export class MultiCDNService extends EventEmitter {
  private cdnConfigs: Map<CDNProvider, CDNConfig> = new Map();
  private cdnHealth: Map<CDNProvider, CDNHealth> = new Map();
  private currentPrimary: CDNProvider = CDNProvider.CLOUDFLARE;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private keyRotationInterval: NodeJS.Timeout | null = null;

  private readonly failoverConfig: FailoverConfig = {
    healthCheckInterval: 30, // 30 seconds
    failureThreshold: 3,
    recoveryThreshold: 5,
    maxFailoverTime: 3600 // 1 hour
  };

  constructor() {
    super();
    this.initializeCDNs();
    this.startHealthChecks();
    this.startKeyRotation();
  }

  private initializeCDNs() {
    // Cloudflare configuration
    this.cdnConfigs.set(CDNProvider.CLOUDFLARE, {
      provider: CDNProvider.CLOUDFLARE,
      name: 'Cloudflare',
      baseUrl: 'https://cdn.platform.com',
      signingKey: process.env.CLOUDFLARE_SIGNING_KEY || 'default-key',
      signingKeyId: process.env.CLOUDFLARE_KEY_ID || 'key-1',
      regions: ['global'],
      priority: 1,
      isActive: true,
      healthCheckUrl: 'https://cdn.platform.com/health',
      maxRetries: 3,
      timeoutMs: 5000
    });

    // AWS CloudFront configuration
    this.cdnConfigs.set(CDNProvider.AWS_CLOUDFRONT, {
      provider: CDNProvider.AWS_CLOUDFRONT,
      name: 'AWS CloudFront',
      baseUrl: 'https://d123456789.cloudfront.net',
      signingKey: process.env.CLOUDFRONT_SIGNING_KEY || 'default-key',
      signingKeyId: process.env.CLOUDFRONT_KEY_ID || 'key-1',
      regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
      priority: 2,
      isActive: true,
      healthCheckUrl: 'https://d123456789.cloudfront.net/health',
      maxRetries: 3,
      timeoutMs: 5000
    });

    // BunnyCDN configuration
    this.cdnConfigs.set(CDNProvider.BUNNY_CDN, {
      provider: CDNProvider.BUNNY_CDN,
      name: 'BunnyCDN',
      baseUrl: 'https://platform.b-cdn.net',
      signingKey: process.env.BUNNY_SIGNING_KEY || 'default-key',
      signingKeyId: process.env.BUNNY_KEY_ID || 'key-1',
      regions: ['global'],
      priority: 3,
      isActive: true,
      healthCheckUrl: 'https://platform.b-cdn.net/health',
      maxRetries: 3,
      timeoutMs: 5000
    });

    // Initialize health status for all CDNs
    for (const [provider, config] of this.cdnConfigs) {
      this.cdnHealth.set(provider, {
        provider,
        isHealthy: true,
        responseTime: 0,
        lastCheck: new Date(),
        errorCount: 0,
        consecutiveFailures: 0
      });
    }

    logger.info('Multi-CDN service initialized', { 
      cdnCount: this.cdnConfigs.size,
      primary: this.currentPrimary 
    });
  }

  // Generate signed URL for content
  async generateSignedURL(config: SignedURLConfig, preferredProvider?: CDNProvider): Promise<string> {
    const provider = preferredProvider || await this.selectOptimalCDN();
    const cdnConfig = this.cdnConfigs.get(provider);
    
    if (!cdnConfig || !cdnConfig.isActive) {
      throw new Error(`CDN provider ${provider} is not available`);
    }

    const expirationTime = Math.floor(Date.now() / 1000) + config.expiresIn;
    const path = `/content/${config.contentId}`;
    
    // Create policy for signed URL
    const policy = {
      Statement: [{
        Resource: `${cdnConfig.baseUrl}${path}`,
        Condition: {
          DateLessThan: {
            'AWS:EpochTime': expirationTime
          },
          ...(config.allowedIPs && {
            IpAddress: {
              'AWS:SourceIp': config.allowedIPs
            }
          }),
          ...(config.allowedCountries && {
            StringEquals: {
              'cloudfront:viewer-country': config.allowedCountries
            }
          })
        }
      }]
    };

    const policyString = JSON.stringify(policy);
    const signature = this.signPolicy(policyString, cdnConfig.signingKey);
    
    const signedUrl = `${cdnConfig.baseUrl}${path}?` +
      `Expires=${expirationTime}&` +
      `Signature=${signature}&` +
      `Key-Pair-Id=${cdnConfig.signingKeyId}`;

    // Log URL generation for monitoring
    logger.info('Signed URL generated', {
      provider,
      contentId: config.contentId,
      expiresIn: config.expiresIn,
      hasIPRestrictions: !!config.allowedIPs,
      hasCountryRestrictions: !!config.allowedCountries
    });

    return signedUrl;
  }

  // Generate multiple signed URLs for failover
  async generateFailoverURLs(config: SignedURLConfig): Promise<{ primary: string; fallback: string[] }> {
    const healthyCDNs = await this.getHealthyCDNs();
    
    if (healthyCDNs.length === 0) {
      throw new Error('No healthy CDNs available');
    }

    const primary = await this.generateSignedURL(config, healthyCDNs[0]);
    const fallback: string[] = [];

    // Generate fallback URLs for other healthy CDNs
    for (let i = 1; i < Math.min(healthyCDNs.length, 3); i++) {
      try {
        const fallbackUrl = await this.generateSignedURL(config, healthyCDNs[i]);
        fallback.push(fallbackUrl);
      } catch (error) {
        logger.warn('Failed to generate fallback URL', { 
          provider: healthyCDNs[i], 
          error: error.message 
        });
      }
    }

    return { primary, fallback };
  }

  // Select optimal CDN based on health and priority
  private async selectOptimalCDN(): Promise<CDNProvider> {
    const healthyCDNs = await this.getHealthyCDNs();
    
    if (healthyCDNs.length === 0) {
      logger.error('No healthy CDNs available, using primary anyway');
      return this.currentPrimary;
    }

    // Return the highest priority healthy CDN
    return healthyCDNs[0];
  }

  // Get list of healthy CDNs sorted by priority
  private async getHealthyCDNs(): Promise<CDNProvider[]> {
    const healthyCDNs: { provider: CDNProvider; priority: number }[] = [];

    for (const [provider, config] of this.cdnConfigs) {
      const health = this.cdnHealth.get(provider);
      if (config.isActive && health?.isHealthy) {
        healthyCDNs.push({ provider, priority: config.priority });
      }
    }

    // Sort by priority (lower number = higher priority)
    healthyCDNs.sort((a, b) => a.priority - b.priority);
    
    return healthyCDNs.map(cdn => cdn.provider);
  }

  // Perform health check on all CDNs
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.cdnConfigs.entries()).map(
      async ([provider, config]) => {
        try {
          const startTime = Date.now();
          const response = await fetch(config.healthCheckUrl, {
            method: 'HEAD',
            timeout: config.timeoutMs
          });
          
          const responseTime = Date.now() - startTime;
          const isHealthy = response.ok;
          
          const currentHealth = this.cdnHealth.get(provider)!;
          
          if (isHealthy) {
            currentHealth.consecutiveFailures = 0;
            currentHealth.errorCount = Math.max(0, currentHealth.errorCount - 1);
          } else {
            currentHealth.consecutiveFailures++;
            currentHealth.errorCount++;
          }
          
          const wasHealthy = currentHealth.isHealthy;
          currentHealth.isHealthy = currentHealth.consecutiveFailures < this.failoverConfig.failureThreshold;
          currentHealth.responseTime = responseTime;
          currentHealth.lastCheck = new Date();
          
          // Emit events for health changes
          if (wasHealthy && !currentHealth.isHealthy) {
            this.emit('cdn:unhealthy', { provider, health: currentHealth });
            logger.warn('CDN became unhealthy', { provider, consecutiveFailures: currentHealth.consecutiveFailures });
          } else if (!wasHealthy && currentHealth.isHealthy) {
            this.emit('cdn:recovered', { provider, health: currentHealth });
            logger.info('CDN recovered', { provider });
          }
          
        } catch (error) {
          const currentHealth = this.cdnHealth.get(provider)!;
          currentHealth.consecutiveFailures++;
          currentHealth.errorCount++;
          currentHealth.isHealthy = false;
          currentHealth.lastCheck = new Date();
          
          logger.error('CDN health check failed', { 
            provider, 
            error: error.message,
            consecutiveFailures: currentHealth.consecutiveFailures 
          });
        }
      }
    );

    await Promise.allSettled(healthCheckPromises);
    
    // Check if we need to failover
    await this.checkFailover();
  }

  // Check if failover is needed
  private async checkFailover(): Promise<void> {
    const primaryHealth = this.cdnHealth.get(this.currentPrimary);
    
    if (!primaryHealth?.isHealthy) {
      const healthyCDNs = await this.getHealthyCDNs();
      
      if (healthyCDNs.length > 0 && healthyCDNs[0] !== this.currentPrimary) {
        const newPrimary = healthyCDNs[0];
        const oldPrimary = this.currentPrimary;
        
        this.currentPrimary = newPrimary;
        
        this.emit('cdn:failover', { 
          from: oldPrimary, 
          to: newPrimary,
          reason: 'primary_unhealthy'
        });
        
        logger.warn('CDN failover executed', { 
          from: oldPrimary, 
          to: newPrimary,
          primaryFailures: primaryHealth?.consecutiveFailures 
        });
      }
    }
  }

  // Start health check monitoring
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(
      () => this.performHealthChecks(),
      this.failoverConfig.healthCheckInterval * 1000
    );
    
    // Perform initial health check
    this.performHealthChecks();
  }

  // Rotate signing keys for security
  private startKeyRotation(): void {
    // Rotate keys every 24 hours
    this.keyRotationInterval = setInterval(
      () => this.rotateSigningKeys(),
      24 * 60 * 60 * 1000
    );
  }

  // Rotate signing keys with zero downtime
  private async rotateSigningKeys(): Promise<void> {
    logger.info('Starting signing key rotation');
    
    for (const [provider, config] of this.cdnConfigs) {
      try {
        // Generate new key
        const newKey = crypto.randomBytes(32).toString('hex');
        const newKeyId = `key-${Date.now()}`;
        
        // Store old key for overlap period
        await redis.setex(
          `cdn:old_key:${provider}:${config.signingKeyId}`,
          3600, // 1 hour overlap
          config.signingKey
        );
        
        // Update to new key
        config.signingKey = newKey;
        config.signingKeyId = newKeyId;
        
        // Store new key
        await redis.setex(
          `cdn:key:${provider}:${newKeyId}`,
          86400, // 24 hours
          newKey
        );
        
        logger.info('Signing key rotated', { provider, newKeyId });
        
      } catch (error) {
        logger.error('Key rotation failed', { provider, error: error.message });
      }
    }
    
    this.emit('keys:rotated', { timestamp: new Date() });
  }

  // Sign policy string for URL generation
  private signPolicy(policy: string, signingKey: string): string {
    return crypto
      .createSign('RSA-SHA1')
      .update(policy)
      .sign(signingKey, 'base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Get CDN performance metrics
  async getPerformanceMetrics(): Promise<any> {
    const metrics = {
      cdns: Array.from(this.cdnHealth.entries()).map(([provider, health]) => ({
        provider,
        isHealthy: health.isHealthy,
        responseTime: health.responseTime,
        errorCount: health.errorCount,
        consecutiveFailures: health.consecutiveFailures,
        lastCheck: health.lastCheck
      })),
      currentPrimary: this.currentPrimary,
      totalRequests: await this.getTotalRequests(),
      failoverCount: await this.getFailoverCount()
    };
    
    return metrics;
  }

  // Get regional blocklist compliance status
  async checkRegionalCompliance(region: string): Promise<boolean> {
    // Mock implementation - in production, check against compliance database
    const blockedRegions = ['CN', 'IR', 'KP']; // Example blocked regions
    return !blockedRegions.includes(region);
  }

  // Test regional access
  async testRegionalAccess(): Promise<{ region: string; accessible: boolean; responseTime: number }[]> {
    const testRegions = ['US', 'EU', 'APAC', 'CN', 'RU'];
    const results = [];
    
    for (const region of testRegions) {
      try {
        const startTime = Date.now();
        const isCompliant = await this.checkRegionalCompliance(region);
        const responseTime = Date.now() - startTime;
        
        results.push({
          region,
          accessible: isCompliant,
          responseTime
        });
      } catch (error) {
        results.push({
          region,
          accessible: false,
          responseTime: -1
        });
      }
    }
    
    return results;
  }

  private async getTotalRequests(): Promise<number> {
    // Mock implementation - get from metrics database
    return 1000000;
  }

  private async getFailoverCount(): Promise<number> {
    // Mock implementation - get from metrics database
    return 5;
  }

  // Cleanup resources
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.keyRotationInterval) {
      clearInterval(this.keyRotationInterval);
    }
  }
}

export const multiCDNService = new MultiCDNService();