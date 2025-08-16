import { VideoFingerprint, LeakMatch, LeakEvidence, CrawlResult, PlatformMetadata } from '../types';
import { VideoFingerprintService } from './videoFingerprintService';
import { WebhookService } from './webhookService';
import { forensicWatermarkService, ForensicInvestigation } from './forensicWatermarkService';
import Redis from 'ioredis';

interface CrawlerConfig {
  platform: string;
  baseUrl: string;
  searchEndpoints: string[];
  rateLimit: number; // requests per minute
  enabled: boolean;
}

interface LeakDetectionConfig {
  crawlers: CrawlerConfig[];
  matchThreshold: number; // minimum similarity score to consider a match
  slaHours: number; // SLA for detection (24 hours)
  webhookUrl?: string;
}

export class LeakDetectionService {
  private redis: Redis;
  private fingerprintService: VideoFingerprintService;
  private webhookService: WebhookService;
  private config: LeakDetectionConfig;

  constructor(
    redis: Redis,
    fingerprintService: VideoFingerprintService,
    webhookService: WebhookService,
    config: LeakDetectionConfig
  ) {
    this.redis = redis;
    this.fingerprintService = fingerprintService;
    this.webhookService = webhookService;
    this.config = config;
  }

  /**
   * Start monitoring for leaks of specific content
   */
  async startMonitoring(contentId: string, fingerprint: VideoFingerprint): Promise<void> {
    const monitoringKey = `leak_monitor:${contentId}`;
    
    await this.redis.hset(monitoringKey, {
      contentId,
      fingerprint: JSON.stringify(fingerprint),
      startedAt: Date.now(),
      status: 'monitoring',
      slaDeadline: Date.now() + (this.config.slaHours * 60 * 60 * 1000)
    });

    // Add to crawling queue
    await this.redis.lpush('leak_crawl_queue', contentId);
    
    console.log(`Started leak monitoring for content ${contentId}`);
  }

  /**
   * Crawl configured platforms for potential leaks
   */
  async crawlPlatforms(contentIds: string[]): Promise<CrawlResult[]> {
    const results: CrawlResult[] = [];

    for (const crawler of this.config.crawlers) {
      if (!crawler.enabled) continue;

      try {
        const crawlResult = await this.crawlPlatform(crawler, contentIds);
        results.push(crawlResult);
      } catch (error) {
        console.error(`Crawling failed for ${crawler.platform}:`, error);
        results.push({
          platform: crawler.platform,
          success: false,
          error: error.message,
          videosFound: 0,
          crawledAt: new Date()
        });
      }
    }

    return results;
  }

  /**
   * Crawl a specific platform for potential matches
   */
  private async crawlPlatform(crawler: CrawlerConfig, contentIds: string[]): Promise<CrawlResult> {
    const rateLimitKey = `rate_limit:${crawler.platform}`;
    const currentRequests = await this.redis.get(rateLimitKey) || '0';
    
    if (parseInt(currentRequests) >= crawler.rateLimit) {
      throw new Error(`Rate limit exceeded for ${crawler.platform}`);
    }

    const videosFound: any[] = [];
    
    // Simulate crawling different search endpoints
    for (const endpoint of crawler.searchEndpoints) {
      await this.sleep(1000); // Rate limiting delay
      
      try {
        const searchResults = await this.searchPlatform(crawler.baseUrl + endpoint);
        videosFound.push(...searchResults);
        
        // Increment rate limit counter
        await this.redis.incr(rateLimitKey);
        await this.redis.expire(rateLimitKey, 60); // 1 minute window
        
      } catch (error) {
        console.error(`Search failed for ${endpoint}:`, error);
      }
    }

    return {
      platform: crawler.platform,
      success: true,
      videosFound: videosFound.length,
      crawledAt: new Date(),
      videos: videosFound
    };
  }

  /**
   * Search a platform endpoint (mock implementation)
   */
  private async searchPlatform(url: string): Promise<any[]> {
    // In a real implementation, this would use web scraping libraries
    // like Puppeteer or Playwright to search tube sites
    
    // Mock search results for demonstration
    return [
      {
        url: `${url}/video1`,
        title: 'Sample Video 1',
        thumbnail: `${url}/thumb1.jpg`,
        duration: 1200,
        uploadDate: new Date(Date.now() - 86400000), // 1 day ago
        platform: url.includes('pornhub') ? 'pornhub' : 'xvideos'
      },
      {
        url: `${url}/video2`, 
        title: 'Sample Video 2',
        thumbnail: `${url}/thumb2.jpg`,
        duration: 800,
        uploadDate: new Date(Date.now() - 172800000), // 2 days ago
        platform: url.includes('pornhub') ? 'pornhub' : 'xvideos'
      }
    ];
  }

  /**
   * Detect leaks by comparing fingerprints
   */
  async detectLeaks(contentId: string): Promise<LeakMatch[]> {
    const monitoringKey = `leak_monitor:${contentId}`;
    const monitoringData = await this.redis.hgetall(monitoringKey);
    
    if (!monitoringData.fingerprint) {
      throw new Error(`No fingerprint found for content ${contentId}`);
    }

    const originalFingerprint: VideoFingerprint = JSON.parse(monitoringData.fingerprint);
    const crawlResults = await this.crawlPlatforms([contentId]);
    const leakMatches: LeakMatch[] = [];

    for (const result of crawlResults) {
      if (!result.success || !result.videos) continue;

      for (const video of result.videos) {
        try {
          // Generate fingerprint for found video
          const suspectFingerprint = await this.fingerprintService.generateFingerprint(video.url);
          
          // Compare fingerprints
          const matchResult = await this.fingerprintService.compareFingerprints(
            originalFingerprint, 
            suspectFingerprint
          );

          if (matchResult.similarity >= this.config.matchThreshold) {
            // Create forensic investigation for high-confidence matches
            let forensicInvestigation: ForensicInvestigation | undefined;
            
            if (matchResult.similarity >= 0.95) {
              try {
                // Simulate downloading leaked content for forensic analysis
                const leakContent = Buffer.from(`mock_leaked_content_${video.url}`);
                forensicInvestigation = await forensicWatermarkService.createForensicInvestigation(
                  video.url,
                  leakContent
                );
                console.log(`Created forensic investigation ${forensicInvestigation.id} for high-confidence leak`);
              } catch (error) {
                console.error('Failed to create forensic investigation:', error);
              }
            }

            const leakMatch: LeakMatch = {
              id: `leak_${contentId}_${Date.now()}`,
              contentId,
              detectedUrl: video.url,
              platform: result.platform,
              matchScore: matchResult.similarity,
              detectedAt: new Date(),
              status: 'detected',
              evidence: {
                screenshots: [video.thumbnail],
                fingerprintMatch: matchResult,
                metadata: {
                  title: video.title,
                  duration: video.duration,
                  uploadDate: video.uploadDate,
                  platform: result.platform,
                  forensicInvestigationId: forensicInvestigation?.id
                }
              }
            };

            leakMatches.push(leakMatch);
            await this.storeLeakMatch(leakMatch);
          }
        } catch (error) {
          console.error(`Error processing video ${video.url}:`, error);
        }
      }
    }

    // Update monitoring status
    if (leakMatches.length > 0) {
      await this.redis.hset(monitoringKey, 'status', 'detected');
      await this.sendLeakNotification(contentId, leakMatches);
    }

    return leakMatches;
  }

  /**
   * Store leak match in database
   */
  private async storeLeakMatch(leakMatch: LeakMatch): Promise<void> {
    const leakKey = `leak_match:${leakMatch.id}`;
    await this.redis.hset(leakKey, {
      ...leakMatch,
      evidence: JSON.stringify(leakMatch.evidence),
      detectedAt: leakMatch.detectedAt.toISOString()
    });

    // Add to leak matches list for content
    await this.redis.lpush(`leaks:${leakMatch.contentId}`, leakMatch.id);
  }

  /**
   * Send webhook notification for detected leaks
   */
  private async sendLeakNotification(contentId: string, leakMatches: LeakMatch[]): Promise<void> {
    if (!this.config.webhookUrl) return;

    const notification = {
      type: 'leak_detected',
      contentId,
      leakCount: leakMatches.length,
      leaks: leakMatches.map(leak => ({
        platform: leak.platform,
        url: leak.detectedUrl,
        matchScore: leak.matchScore,
        detectedAt: leak.detectedAt
      })),
      timestamp: new Date().toISOString()
    };

    try {
      await this.webhookService.send(this.config.webhookUrl, notification);
      console.log(`Leak notification sent for content ${contentId}`);
    } catch (error) {
      console.error(`Failed to send leak notification:`, error);
    }
  }

  /**
   * Monitor SLA compliance for leak detection
   */
  async monitorSLA(): Promise<void> {
    const monitoringKeys = await this.redis.keys('leak_monitor:*');
    const now = Date.now();

    for (const key of monitoringKeys) {
      const data = await this.redis.hgetall(key);
      const slaDeadline = parseInt(data.slaDeadline);
      
      if (now > slaDeadline && data.status === 'monitoring') {
        // SLA breach - escalate
        const contentId = data.contentId;
        console.warn(`SLA breach for content ${contentId} - ${this.config.slaHours}h detection window exceeded`);
        
        await this.redis.hset(key, 'status', 'sla_breach');
        
        if (this.config.webhookUrl) {
          await this.webhookService.send(this.config.webhookUrl, {
            type: 'sla_breach',
            contentId,
            slaHours: this.config.slaHours,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  /**
   * Get leak detection statistics
   */
  async getDetectionStats(): Promise<any> {
    const monitoringKeys = await this.redis.keys('leak_monitor:*');
    const stats = {
      totalMonitored: monitoringKeys.length,
      detected: 0,
      monitoring: 0,
      slaBreach: 0,
      avgDetectionTime: 0
    };

    let totalDetectionTime = 0;
    let detectedCount = 0;

    for (const key of monitoringKeys) {
      const data = await this.redis.hgetall(key);
      
      switch (data.status) {
        case 'detected':
          stats.detected++;
          if (data.detectedAt && data.startedAt) {
            totalDetectionTime += parseInt(data.detectedAt) - parseInt(data.startedAt);
            detectedCount++;
          }
          break;
        case 'monitoring':
          stats.monitoring++;
          break;
        case 'sla_breach':
          stats.slaBreach++;
          break;
      }
    }

    if (detectedCount > 0) {
      stats.avgDetectionTime = totalDetectionTime / detectedCount / (1000 * 60 * 60); // hours
    }

    return stats;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Default crawler configurations
export const DEFAULT_CRAWLER_CONFIG: LeakDetectionConfig = {
  crawlers: [
    {
      platform: 'pornhub',
      baseUrl: 'https://www.pornhub.com',
      searchEndpoints: ['/video/search?search=', '/videos?o=mr&t=w'],
      rateLimit: 30, // 30 requests per minute
      enabled: true
    },
    {
      platform: 'xvideos',
      baseUrl: 'https://www.xvideos.com',
      searchEndpoints: ['/?k=', '/new/'],
      rateLimit: 20,
      enabled: true
    },
    {
      platform: 'xhamster',
      baseUrl: 'https://xhamster.com',
      searchEndpoints: ['/search/', '/newest/'],
      rateLimit: 25,
      enabled: true
    }
  ],
  matchThreshold: 0.85, // 85% similarity threshold
  slaHours: 24,
  webhookUrl: process.env.LEAK_DETECTION_WEBHOOK_URL
};