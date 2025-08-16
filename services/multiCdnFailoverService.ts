import { EventEmitter } from 'events';

export interface CDNProvider {
  id: string;
  name: string;
  baseUrl: string;
  regions: string[];
  priority: number;
  healthEndpoint: string;
  signedUrlKey: string;
  keyRotationInterval: number;
}

export interface CDNHealthStatus {
  providerId: string;
  isHealthy: boolean;
  responseTime: number;
  lastChecked: Date;
  errorCount: number;
  consecutiveFailures: number;
}

export interface FailoverEvent {
  fromProvider: string;
  toProvider: string;
  reason: string;
  timestamp: Date;
  affectedRegions: string[];
}

export interface SignedUrlConfig {
  providerId: string;
  keyId: string;
  key: string;
  expiresAt: Date;
  rotationScheduled: Date;
}

export class MultiCDNFailoverService extends EventEmitter {
  private cdnProviders: Map<string, CDNProvider> = new Map();
  private healthStatus: Map<string, CDNHealthStatus> = new Map();
  private signedUrlKeys: Map<string, SignedUrlConfig> = new Map();
  private activeProvider: string = '';
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private keyRotationInterval: NodeJS.Timeout | null = null;
  private failoverThreshold = 3; // consecutive failures before failover
  private healthCheckFrequency = 30000; // 30 seconds

  constructor() {
    super();
    this.initializeDefaultProviders();
    this.startHealthMonitoring();
    this.startKeyRotationScheduler();
  }

  private initializeDefaultProviders(): void {
    const providers: CDNProvider[] = [
      {
        id: 'cloudflare',
        name: 'Cloudflare',
        baseUrl: 'https://cdn.cloudflare.com',
        regions: ['us', 'eu', 'asia'],
        priority: 1,
        healthEndpoint: '/health',
        signedUrlKey: process.env.CLOUDFLARE_SIGNED_URL_KEY || '',
        keyRotationInterval: 24 * 60 * 60 * 1000 // 24 hours
      },
      {
        id: 'aws-cloudfront',
        name: 'AWS CloudFront',
        baseUrl: 'https://cdn.amazonaws.com',
        regions: ['us', 'eu', 'asia'],
        priority: 2,
        healthEndpoint: '/health',
        signedUrlKey: process.env.AWS_CLOUDFRONT_SIGNED_URL_KEY || '',
        keyRotationInterval: 24 * 60 * 60 * 1000
      },
      {
        id: 'fastly',
        name: 'Fastly',
        baseUrl: 'https://cdn.fastly.com',
        regions: ['us', 'eu'],
        priority: 3,
        healthEndpoint: '/health',
        signedUrlKey: process.env.FASTLY_SIGNED_URL_KEY || '',
        keyRotationInterval: 24 * 60 * 60 * 1000
      }
    ];

    providers.forEach(provider => {
      this.cdnProviders.set(provider.id, provider);
      this.healthStatus.set(provider.id, {
        providerId: provider.id,
        isHealthy: true,
        responseTime: 0,
        lastChecked: new Date(),
        errorCount: 0,
        consecutiveFailures: 0
      });
      this.initializeSignedUrlKey(provider);
    });

    // Set primary provider
    this.activeProvider = 'cloudflare';
  }

  private initializeSignedUrlKey(provider: CDNProvider): void {
    this.signedUrlKeys.set(provider.id, {
      providerId: provider.id,
      keyId: `${provider.id}-${Date.now()}`,
      key: provider.signedUrlKey,
      expiresAt: new Date(Date.now() + provider.keyRotationInterval),
      rotationScheduled: new Date(Date.now() + provider.keyRotationInterval - 60000) // 1 min before expiry
    });
  }

  public async checkCDNHealth(providerId: string): Promise<CDNHealthStatus> {
    const provider = this.cdnProviders.get(providerId);
    const currentStatus = this.healthStatus.get(providerId);
    
    if (!provider || !currentStatus) {
      throw new Error(`CDN provider ${providerId} not found`);
    }

    const startTime = Date.now();
    
    try {
      const response = await fetch(`${provider.baseUrl}${provider.healthEndpoint}`, {
        method: 'GET',
        timeout: 5000,
        headers: {
          'User-Agent': 'CDN-Health-Monitor/1.0'
        }
      });

      const responseTime = Date.now() - startTime;
      const isHealthy = response.ok && responseTime < 2000; // 2 second threshold

      const updatedStatus: CDNHealthStatus = {
        ...currentStatus,
        isHealthy,
        responseTime,
        lastChecked: new Date(),
        consecutiveFailures: isHealthy ? 0 : currentStatus.consecutiveFailures + 1,
        errorCount: isHealthy ? currentStatus.errorCount : currentStatus.errorCount + 1
      };

      this.healthStatus.set(providerId, updatedStatus);
      
      // Trigger failover if threshold exceeded
      if (updatedStatus.consecutiveFailures >= this.failoverThreshold && providerId === this.activeProvider) {
        await this.triggerFailover(providerId, 'Health check failures exceeded threshold');
      }

      return updatedStatus;
    } catch (error) {
      const updatedStatus: CDNHealthStatus = {
        ...currentStatus,
        isHealthy: false,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        consecutiveFailures: currentStatus.consecutiveFailures + 1,
        errorCount: currentStatus.errorCount + 1
      };

      this.healthStatus.set(providerId, updatedStatus);
      
      if (updatedStatus.consecutiveFailures >= this.failoverThreshold && providerId === this.activeProvider) {
        await this.triggerFailover(providerId, `Health check error: ${error.message}`);
      }

      return updatedStatus;
    }
  }

  public async triggerFailover(failedProviderId: string, reason: string): Promise<FailoverEvent> {
    const failedProvider = this.cdnProviders.get(failedProviderId);
    if (!failedProvider) {
      throw new Error(`Failed provider ${failedProviderId} not found`);
    }

    // Find next healthy provider with highest priority
    const healthyProviders = Array.from(this.cdnProviders.values())
      .filter(provider => {
        const status = this.healthStatus.get(provider.id);
        return provider.id !== failedProviderId && status?.isHealthy;
      })
      .sort((a, b) => a.priority - b.priority);

    if (healthyProviders.length === 0) {
      throw new Error('No healthy CDN providers available for failover');
    }

    const newProvider = healthyProviders[0];
    const previousProvider = this.activeProvider;
    this.activeProvider = newProvider.id;

    const failoverEvent: FailoverEvent = {
      fromProvider: previousProvider,
      toProvider: newProvider.id,
      reason,
      timestamp: new Date(),
      affectedRegions: failedProvider.regions
    };

    // Emit failover event for monitoring
    this.emit('failover', failoverEvent);
    
    // Log failover event
    console.log(`CDN Failover: ${failoverEvent.fromProvider} -> ${failoverEvent.toProvider}. Reason: ${reason}`);

    return failoverEvent;
  }

  public async rotateSignedUrlKey(providerId: string): Promise<SignedUrlConfig> {
    const provider = this.cdnProviders.get(providerId);
    if (!provider) {
      throw new Error(`CDN provider ${providerId} not found`);
    }

    // Generate new key
    const newKeyId = `${providerId}-${Date.now()}`;
    const newKey = await this.generateSignedUrlKey(provider);
    
    const newConfig: SignedUrlConfig = {
      providerId,
      keyId: newKeyId,
      key: newKey,
      expiresAt: new Date(Date.now() + provider.keyRotationInterval),
      rotationScheduled: new Date(Date.now() + provider.keyRotationInterval - 60000)
    };

    // Update key configuration
    this.signedUrlKeys.set(providerId, newConfig);

    // Sync with CDN provider
    await this.syncKeyWithProvider(provider, newConfig);

    this.emit('keyRotated', { providerId, keyId: newKeyId, timestamp: new Date() });
    
    console.log(`Rotated signed URL key for ${providerId}: ${newKeyId}`);
    
    return newConfig;
  }

  private async generateSignedUrlKey(provider: CDNProvider): Promise<string> {
    // Generate cryptographically secure key
    const crypto = await import('crypto');
    return crypto.randomBytes(32).toString('base64');
  }

  private async syncKeyWithProvider(provider: CDNProvider, config: SignedUrlConfig): Promise<void> {
    // Implementation would sync with actual CDN provider APIs
    // This is a placeholder for the actual CDN-specific key sync
    console.log(`Syncing key ${config.keyId} with ${provider.name}`);
  }

  public generateSignedUrl(path: string, expiresIn: number = 3600, region?: string): string {
    const provider = this.getActiveProvider(region);
    const keyConfig = this.signedUrlKeys.get(provider.id);
    
    if (!keyConfig) {
      throw new Error(`No signed URL key found for provider ${provider.id}`);
    }

    const expiry = Math.floor(Date.now() / 1000) + expiresIn;
    const stringToSign = `${path}${expiry}`;
    
    // Simple HMAC signing (in production, use proper CDN-specific signing)
    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', keyConfig.key)
      .update(stringToSign)
      .digest('hex');

    return `${provider.baseUrl}${path}?expires=${expiry}&signature=${signature}&keyid=${keyConfig.keyId}`;
  }

  public getActiveProvider(region?: string): CDNProvider {
    const activeProvider = this.cdnProviders.get(this.activeProvider);
    if (!activeProvider) {
      throw new Error('No active CDN provider found');
    }

    // If region specified, check if active provider supports it
    if (region && !activeProvider.regions.includes(region)) {
      // Find alternative provider for region
      const regionalProvider = Array.from(this.cdnProviders.values())
        .filter(provider => {
          const status = this.healthStatus.get(provider.id);
          return provider.regions.includes(region) && status?.isHealthy;
        })
        .sort((a, b) => a.priority - b.priority)[0];

      return regionalProvider || activeProvider;
    }

    return activeProvider;
  }

  public getAllHealthStatus(): Map<string, CDNHealthStatus> {
    return new Map(this.healthStatus);
  }

  public getFailoverHistory(): FailoverEvent[] {
    // In production, this would be stored in a database
    return [];
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      const providers = Array.from(this.cdnProviders.keys());
      
      await Promise.all(
        providers.map(providerId => 
          this.checkCDNHealth(providerId).catch(error => 
            console.error(`Health check failed for ${providerId}:`, error)
          )
        )
      );
    }, this.healthCheckFrequency);
  }

  private startKeyRotationScheduler(): void {
    this.keyRotationInterval = setInterval(async () => {
      const now = new Date();
      
      for (const [providerId, config] of this.signedUrlKeys) {
        if (now >= config.rotationScheduled) {
          try {
            await this.rotateSignedUrlKey(providerId);
          } catch (error) {
            console.error(`Key rotation failed for ${providerId}:`, error);
          }
        }
      }
    }, 60000); // Check every minute
  }

  public async validateFailoverCapability(): Promise<boolean> {
    try {
      // Test failover by temporarily marking active provider as unhealthy
      const originalProvider = this.activeProvider;
      const testReason = 'Failover capability validation test';
      
      await this.triggerFailover(originalProvider, testReason);
      
      // Verify new provider is active and healthy
      const newProvider = this.activeProvider;
      const newProviderStatus = this.healthStatus.get(newProvider);
      
      if (newProvider !== originalProvider && newProviderStatus?.isHealthy) {
        // Restore original provider if it's healthy
        const originalStatus = this.healthStatus.get(originalProvider);
        if (originalStatus?.isHealthy) {
          this.activeProvider = originalProvider;
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failover validation failed:', error);
      return false;
    }
  }

  public destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.keyRotationInterval) {
      clearInterval(this.keyRotationInterval);
    }
    this.removeAllListeners();
  }
}

export const multiCdnFailoverService = new MultiCDNFailoverService();