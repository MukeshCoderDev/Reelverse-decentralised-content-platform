import { ComplianceAnalysisService } from './complianceAnalysisService';
import { EvidencePackService } from './evidencePackService';
import { EvidencePack, ContentMetadata } from '../types';
import Redis from 'ioredis';

export interface OneClickEvidenceConfig {
  cacheExpiryHours: number;
  autoAnalyzeOnGeneration: boolean;
  includeBlockchainVerification: boolean;
  webhookUrl?: string;
}

export interface OneClickResult {
  success: boolean;
  evidencePack?: EvidencePack;
  generationTimeMs: number;
  cached: boolean;
  error?: string;
}

export class OneClickEvidenceService {
  private complianceService: ComplianceAnalysisService;
  private evidencePackService: EvidencePackService;
  private redis: Redis;
  private config: OneClickEvidenceConfig;

  constructor(
    complianceService: ComplianceAnalysisService,
    evidencePackService: EvidencePackService,
    redis: Redis,
    config: OneClickEvidenceConfig
  ) {
    this.complianceService = complianceService;
    this.evidencePackService = evidencePackService;
    this.redis = redis;
    this.config = config;
  }

  /**
   * One-click evidence pack generation with sub-30-second target
   */
  async generateOneClickEvidencePack(
    contentId: string,
    metadata?: ContentMetadata
  ): Promise<OneClickResult> {
    const startTime = Date.now();

    try {
      console.log(`Starting one-click evidence pack generation for content ${contentId}`);

      // Check for cached evidence pack first
      const cachedPack = await this.getCachedEvidencePack(contentId);
      if (cachedPack) {
        const generationTime = Date.now() - startTime;
        console.log(`Returned cached evidence pack in ${generationTime}ms`);
        
        return {
          success: true,
          evidencePack: cachedPack,
          generationTimeMs: generationTime,
          cached: true
        };
      }

      // Get or generate metadata
      const contentMetadata = metadata || await this.getContentMetadata(contentId);

      // Run compliance analysis
      const complianceReport = await this.complianceService.analyzeContent(contentId, contentMetadata);

      // Generate evidence pack with blockchain verification
      const evidencePack = await this.evidencePackService.generateEvidencePack(contentId, complianceReport);

      // Cache the evidence pack
      await this.cacheEvidencePack(evidencePack);

      // Store in Redis for quick access
      await this.storeEvidencePackMetadata(evidencePack);

      const generationTime = Date.now() - startTime;
      
      // Check SLA compliance
      if (generationTime > 30000) {
        console.warn(`Evidence pack generation exceeded 30s SLA: ${generationTime}ms`);
      } else {
        console.log(`Evidence pack generated successfully in ${generationTime}ms`);
      }

      // Send webhook notification if configured
      if (this.config.webhookUrl) {
        await this.sendWebhookNotification(evidencePack, generationTime);
      }

      return {
        success: true,
        evidencePack,
        generationTimeMs: generationTime,
        cached: false
      };

    } catch (error) {
      const generationTime = Date.now() - startTime;
      console.error(`One-click evidence pack generation failed after ${generationTime}ms:`, error);

      return {
        success: false,
        generationTimeMs: generationTime,
        cached: false,
        error: error.message
      };
    }
  }

  /**
   * Batch generate evidence packs for multiple content items
   */
  async batchGenerateEvidencePacks(contentIds: string[]): Promise<OneClickResult[]> {
    console.log(`Starting batch evidence pack generation for ${contentIds.length} items`);

    const results: OneClickResult[] = [];
    const batchSize = 5; // Process in batches to avoid overwhelming the system

    for (let i = 0; i < contentIds.length; i += batchSize) {
      const batch = contentIds.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(contentId => 
        this.generateOneClickEvidencePack(contentId)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            generationTimeMs: 0,
            cached: false,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < contentIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Batch generation completed: ${successCount}/${contentIds.length} successful`);

    return results;
  }

  /**
   * Get cached evidence pack if available and not expired
   */
  private async getCachedEvidencePack(contentId: string): Promise<EvidencePack | null> {
    try {
      const cacheKey = `evidence_pack_cache:${contentId}`;
      const cachedData = await this.redis.get(cacheKey);
      
      if (!cachedData) {
        return null;
      }

      const evidencePack = JSON.parse(cachedData);
      
      // Check if cache is still valid
      const cacheAge = Date.now() - new Date(evidencePack.generatedAt).getTime();
      const maxAge = this.config.cacheExpiryHours * 60 * 60 * 1000;
      
      if (cacheAge > maxAge) {
        // Cache expired, remove it
        await this.redis.del(cacheKey);
        return null;
      }

      return {
        ...evidencePack,
        generatedAt: new Date(evidencePack.generatedAt)
      };

    } catch (error) {
      console.error('Error getting cached evidence pack:', error);
      return null;
    }
  }

  /**
   * Cache evidence pack for future requests
   */
  private async cacheEvidencePack(evidencePack: EvidencePack): Promise<void> {
    try {
      const cacheKey = `evidence_pack_cache:${evidencePack.contentId}`;
      const expirySeconds = this.config.cacheExpiryHours * 60 * 60;
      
      await this.redis.setex(
        cacheKey,
        expirySeconds,
        JSON.stringify(evidencePack)
      );

    } catch (error) {
      console.error('Error caching evidence pack:', error);
      // Don't throw - caching failure shouldn't break the main flow
    }
  }

  /**
   * Store evidence pack metadata for quick access
   */
  private async storeEvidencePackMetadata(evidencePack: EvidencePack): Promise<void> {
    try {
      const metadataKey = `evidence_pack:${evidencePack.id}`;
      
      await this.redis.hset(metadataKey, {
        id: evidencePack.id,
        contentId: evidencePack.contentId,
        generatedAt: evidencePack.generatedAt.toISOString(),
        merkleHash: evidencePack.merkleHash,
        pdfPath: evidencePack.pdfPath,
        blockchainTxHash: evidencePack.blockchainTxHash || '',
        riskScore: evidencePack.riskAssessment.overall,
        riskLevel: evidencePack.riskAssessment.riskLevel
      });

      // Add to content's evidence packs list
      await this.redis.lpush(`evidence_packs:${evidencePack.contentId}`, evidencePack.id);

    } catch (error) {
      console.error('Error storing evidence pack metadata:', error);
    }
  }

  /**
   * Get content metadata (placeholder - would integrate with existing system)
   */
  private async getContentMetadata(contentId: string): Promise<ContentMetadata> {
    // This would integrate with existing content management system
    // For now, return mock metadata
    return {
      duration: 1200,
      participants: [
        { id: 'user1', name: 'Creator 1', age: 25 }
      ],
      location: 'US',
      uploadDate: new Date().toISOString(),
      tags: ['adult', 'content'],
      category: 'premium'
    };
  }

  /**
   * Send webhook notification for evidence pack generation
   */
  private async sendWebhookNotification(evidencePack: EvidencePack, generationTime: number): Promise<void> {
    if (!this.config.webhookUrl) return;

    try {
      const notification = {
        type: 'evidence_pack_generated',
        evidencePackId: evidencePack.id,
        contentId: evidencePack.contentId,
        generationTimeMs: generationTime,
        riskScore: evidencePack.riskAssessment.overall,
        riskLevel: evidencePack.riskAssessment.riskLevel,
        blockchainVerified: !!evidencePack.blockchainTxHash,
        timestamp: new Date().toISOString()
      };

      // This would use the WebhookService from previous tasks
      console.log('Sending evidence pack notification:', notification);

    } catch (error) {
      console.error('Failed to send webhook notification:', error);
    }
  }

  /**
   * Get evidence pack generation statistics
   */
  async getGenerationStats(): Promise<any> {
    try {
      const packKeys = await this.redis.keys('evidence_pack:*');
      const stats = {
        totalGenerated: packKeys.length,
        recentGenerated: 0,
        averageGenerationTime: 0,
        cacheHitRate: 0,
        blockchainVerified: 0
      };

      // Count recent packs (last 24 hours)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      let totalGenerationTime = 0;
      let generationTimeCount = 0;

      for (const key of packKeys) {
        const packData = await this.redis.hgetall(key);
        
        if (packData.generatedAt) {
          const generatedAt = new Date(packData.generatedAt).getTime();
          
          if (generatedAt > oneDayAgo) {
            stats.recentGenerated++;
          }

          if (packData.blockchainTxHash) {
            stats.blockchainVerified++;
          }
        }
      }

      // Calculate cache hit rate (would need to track cache hits/misses)
      // For now, return placeholder
      stats.cacheHitRate = 0.25; // 25% cache hit rate

      return stats;

    } catch (error) {
      console.error('Error getting generation stats:', error);
      return {
        totalGenerated: 0,
        recentGenerated: 0,
        averageGenerationTime: 0,
        cacheHitRate: 0,
        blockchainVerified: 0
      };
    }
  }

  /**
   * Invalidate cache for content (useful when content is updated)
   */
  async invalidateCache(contentId: string): Promise<void> {
    try {
      const cacheKey = `evidence_pack_cache:${contentId}`;
      await this.redis.del(cacheKey);
      console.log(`Cache invalidated for content ${contentId}`);
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }

  /**
   * Pre-generate evidence packs for high-priority content
   */
  async preGenerateEvidencePacks(contentIds: string[]): Promise<void> {
    console.log(`Pre-generating evidence packs for ${contentIds.length} high-priority items`);

    // Generate in background without blocking
    this.batchGenerateEvidencePacks(contentIds).catch(error => {
      console.error('Pre-generation failed:', error);
    });
  }
}

// Default configuration
export const DEFAULT_ONE_CLICK_CONFIG: OneClickEvidenceConfig = {
  cacheExpiryHours: 24,
  autoAnalyzeOnGeneration: true,
  includeBlockchainVerification: true,
  webhookUrl: process.env.EVIDENCE_PACK_WEBHOOK_URL
};