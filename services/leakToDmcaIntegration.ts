import { LeakMatch, DMCANotice } from '../types';
import { DMCAService } from './dmcaService';
import { WebhookService } from './webhookService';
import Redis from 'ioredis';

export interface DMCAProcessingConfig {
  autoSubmit: boolean;
  requireManualReview: boolean;
  minMatchScore: number;
  platforms: string[];
  webhookUrl?: string;
}

export class LeakToDMCAIntegration {
  private dmcaService: DMCAService;
  private webhookService: WebhookService;
  private redis: Redis;
  private config: DMCAProcessingConfig;

  constructor(
    dmcaService: DMCAService,
    webhookService: WebhookService,
    redis: Redis,
    config: DMCAProcessingConfig
  ) {
    this.dmcaService = dmcaService;
    this.webhookService = webhookService;
    this.redis = redis;
    this.config = config;
  }

  /**
   * Process detected leak and generate DMCA notice
   */
  async processLeakForDMCA(leak: LeakMatch): Promise<DMCANotice | null> {
    try {
      console.log(`Processing leak ${leak.id} for DMCA notice generation`);

      // Check if platform is supported
      if (!this.config.platforms.includes(leak.platform)) {
        console.log(`Platform ${leak.platform} not configured for DMCA processing`);
        return null;
      }

      // Check match score threshold
      if (leak.matchScore < this.config.minMatchScore) {
        console.log(`Match score ${leak.matchScore} below threshold ${this.config.minMatchScore}`);
        return null;
      }

      // Get compliance pack URL if available
      const compliancePackUrl = await this.getCompliancePackUrl(leak.contentId);

      // Generate DMCA notice
      const dmcaNotice = await this.dmcaService.generateDMCANotice(leak, compliancePackUrl);

      // Store DMCA notice
      await this.storeDMCANotice(dmcaNotice);

      // Update leak status
      await this.updateLeakStatus(leak.id, 'dmca_generated');

      // Send notification
      if (this.config.webhookUrl) {
        await this.sendDMCANotification(dmcaNotice, 'generated');
      }

      // Auto-submit if configured
      if (this.config.autoSubmit && !this.config.requireManualReview) {
        await this.submitDMCANotice(dmcaNotice);
      } else {
        console.log(`DMCA notice ${dmcaNotice.id} requires manual review before submission`);
      }

      return dmcaNotice;

    } catch (error) {
      console.error(`Failed to process leak ${leak.id} for DMCA:`, error);
      throw error;
    }
  }

  /**
   * Submit DMCA notice after manual review or auto-submission
   */
  async submitDMCANotice(dmcaNotice: DMCANotice): Promise<void> {
    try {
      console.log(`Submitting DMCA notice ${dmcaNotice.id}`);

      await this.dmcaService.submitDMCANotice(dmcaNotice);

      // Update stored notice
      await this.updateDMCANoticeStatus(dmcaNotice.id, 'sent');

      // Update related leak status
      await this.updateLeakStatus(dmcaNotice.leakId, 'dmca_sent');

      // Send notification
      if (this.config.webhookUrl) {
        await this.sendDMCANotification(dmcaNotice, 'submitted');
      }

      console.log(`DMCA notice ${dmcaNotice.id} submitted successfully`);

    } catch (error) {
      console.error(`Failed to submit DMCA notice ${dmcaNotice.id}:`, error);
      
      // Update status to failed
      await this.updateDMCANoticeStatus(dmcaNotice.id, 'failed');
      
      throw error;
    }
  }

  /**
   * Process multiple leaks in batch
   */
  async processBatchLeaks(leaks: LeakMatch[]): Promise<DMCANotice[]> {
    console.log(`Processing batch of ${leaks.length} leaks for DMCA`);

    const dmcaNotices: DMCANotice[] = [];
    const results = {
      processed: 0,
      skipped: 0,
      failed: 0
    };

    for (const leak of leaks) {
      try {
        const dmcaNotice = await this.processLeakForDMCA(leak);
        
        if (dmcaNotice) {
          dmcaNotices.push(dmcaNotice);
          results.processed++;
        } else {
          results.skipped++;
        }

        // Add delay to avoid overwhelming external services
        await this.sleep(1000);

      } catch (error) {
        console.error(`Failed to process leak ${leak.id}:`, error);
        results.failed++;
      }
    }

    console.log(`Batch processing completed:`, results);
    return dmcaNotices;
  }

  /**
   * Get compliance pack URL for content
   */
  private async getCompliancePackUrl(contentId: string): Promise<string | undefined> {
    try {
      // This would integrate with the compliance system from task 34
      const complianceKey = `compliance_pack:${contentId}`;
      const complianceData = await this.redis.hgetall(complianceKey);
      
      return complianceData.packUrl;
    } catch (error) {
      console.warn(`Could not get compliance pack for content ${contentId}:`, error);
      return undefined;
    }
  }

  /**
   * Store DMCA notice in Redis
   */
  private async storeDMCANotice(dmcaNotice: DMCANotice): Promise<void> {
    const noticeKey = `dmca_notice:${dmcaNotice.id}`;
    
    await this.redis.hset(noticeKey, {
      ...dmcaNotice,
      evidence: JSON.stringify(dmcaNotice.evidence),
      trackingInfo: JSON.stringify(dmcaNotice.trackingInfo || {}),
      generatedAt: dmcaNotice.generatedAt.toISOString()
    });

    // Add to content's DMCA notices list
    await this.redis.lpush(`dmca_notices:${dmcaNotice.contentId}`, dmcaNotice.id);

    // Add to platform's DMCA notices list
    await this.redis.lpush(`dmca_notices:platform:${dmcaNotice.platform}`, dmcaNotice.id);
  }

  /**
   * Update leak status
   */
  private async updateLeakStatus(leakId: string, status: string): Promise<void> {
    const leakKey = `leak_match:${leakId}`;
    await this.redis.hset(leakKey, {
      status,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Update DMCA notice status
   */
  private async updateDMCANoticeStatus(dmcaId: string, status: string): Promise<void> {
    const noticeKey = `dmca_notice:${dmcaId}`;
    await this.redis.hset(noticeKey, {
      status,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Send webhook notification for DMCA events
   */
  private async sendDMCANotification(dmcaNotice: DMCANotice, event: string): Promise<void> {
    if (!this.config.webhookUrl) return;

    const notification = {
      type: `dmca_${event}`,
      dmcaId: dmcaNotice.id,
      leakId: dmcaNotice.leakId,
      contentId: dmcaNotice.contentId,
      platform: dmcaNotice.platform,
      targetUrl: dmcaNotice.targetUrl,
      status: dmcaNotice.status,
      timestamp: new Date().toISOString()
    };

    try {
      await this.webhookService.send(this.config.webhookUrl, notification);
    } catch (error) {
      console.error(`Failed to send DMCA notification:`, error);
    }
  }

  /**
   * Get DMCA processing statistics
   */
  async getDMCAStats(): Promise<any> {
    const noticeKeys = await this.redis.keys('dmca_notice:*');
    const stats = {
      totalNotices: noticeKeys.length,
      byStatus: {
        draft: 0,
        sent: 0,
        acknowledged: 0,
        removed: 0,
        disputed: 0,
        failed: 0
      },
      byPlatform: {} as Record<string, number>,
      successRate: 0
    };

    for (const key of noticeKeys) {
      const noticeData = await this.redis.hgetall(key);
      
      // Count by status
      if (stats.byStatus.hasOwnProperty(noticeData.status)) {
        stats.byStatus[noticeData.status]++;
      }

      // Count by platform
      if (noticeData.platform) {
        stats.byPlatform[noticeData.platform] = (stats.byPlatform[noticeData.platform] || 0) + 1;
      }
    }

    // Calculate success rate (removed + acknowledged / total sent)
    const totalSent = stats.byStatus.sent + stats.byStatus.acknowledged + stats.byStatus.removed + stats.byStatus.disputed;
    const successful = stats.byStatus.acknowledged + stats.byStatus.removed;
    
    if (totalSent > 0) {
      stats.successRate = (successful / totalSent) * 100;
    }

    return stats;
  }

  /**
   * Get pending DMCA notices requiring manual review
   */
  async getPendingReview(): Promise<DMCANotice[]> {
    const noticeKeys = await this.redis.keys('dmca_notice:*');
    const pendingNotices: DMCANotice[] = [];

    for (const key of noticeKeys) {
      const noticeData = await this.redis.hgetall(key);
      
      if (noticeData.status === 'draft') {
        pendingNotices.push({
          ...noticeData,
          evidence: JSON.parse(noticeData.evidence),
          trackingInfo: JSON.parse(noticeData.trackingInfo || '{}'),
          generatedAt: new Date(noticeData.generatedAt)
        } as DMCANotice);
      }
    }

    return pendingNotices.sort((a, b) => a.generatedAt.getTime() - b.generatedAt.getTime());
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Default configuration
export const DEFAULT_DMCA_CONFIG: DMCAProcessingConfig = {
  autoSubmit: false, // Require manual review by default
  requireManualReview: true,
  minMatchScore: 0.85, // 85% similarity threshold
  platforms: ['pornhub', 'xvideos', 'xhamster'],
  webhookUrl: process.env.DMCA_WEBHOOK_URL
};