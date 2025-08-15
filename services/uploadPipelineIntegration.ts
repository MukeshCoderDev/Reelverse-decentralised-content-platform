import { LeakDetectionService } from './leakDetectionService';
import { LeakDetectionQueue } from './leakDetectionQueue';
import { VideoFingerprintService } from './videoFingerprintService';

export interface UploadCompletedEvent {
  contentId: string;
  videoUrl: string;
  userId: string;
  metadata: {
    title: string;
    duration: number;
    resolution: string;
    fileSize: number;
  };
}

export class UploadPipelineIntegration {
  private leakDetectionService: LeakDetectionService;
  private leakDetectionQueue: LeakDetectionQueue;
  private fingerprintService: VideoFingerprintService;

  constructor(
    leakDetectionService: LeakDetectionService,
    leakDetectionQueue: LeakDetectionQueue,
    fingerprintService: VideoFingerprintService
  ) {
    this.leakDetectionService = leakDetectionService;
    this.leakDetectionQueue = leakDetectionQueue;
    this.fingerprintService = fingerprintService;
  }

  /**
   * Handle upload completion and start leak monitoring
   * This should be called after video transcoding is complete
   */
  async handleUploadCompleted(event: UploadCompletedEvent): Promise<void> {
    try {
      console.log(`Starting leak monitoring for uploaded content ${event.contentId}`);

      // Generate fingerprint for the uploaded video
      const fingerprint = await this.fingerprintService.generateFingerprint(event.videoUrl);
      
      // Start leak monitoring
      await this.leakDetectionService.startMonitoring(event.contentId, fingerprint);
      
      // Add to processing queue with high priority for new uploads
      await this.leakDetectionQueue.addToMonitoring(event.contentId, 10);

      console.log(`Leak monitoring started successfully for content ${event.contentId}`);

    } catch (error) {
      console.error(`Failed to start leak monitoring for content ${event.contentId}:`, error);
      
      // Don't fail the upload process, but log the error for investigation
      // In production, you might want to send this to an error tracking service
      throw new Error(`Leak monitoring setup failed: ${error.message}`);
    }
  }

  /**
   * Handle content deletion - stop monitoring
   */
  async handleContentDeleted(contentId: string): Promise<void> {
    try {
      console.log(`Stopping leak monitoring for deleted content ${contentId}`);

      // Remove from monitoring (implementation depends on Redis setup)
      const redis = this.leakDetectionService['redis']; // Access private redis instance
      
      await redis.del(`leak_monitor:${contentId}`);
      await redis.del(`leaks:${contentId}`);
      
      // Remove any leak match records
      const leakIds = await redis.lrange(`leaks:${contentId}`, 0, -1);
      for (const leakId of leakIds) {
        await redis.del(`leak_match:${leakId}`);
      }

      console.log(`Leak monitoring stopped for content ${contentId}`);

    } catch (error) {
      console.error(`Failed to stop leak monitoring for content ${contentId}:`, error);
    }
  }

  /**
   * Bulk start monitoring for existing content
   * Useful for migrating existing content to leak detection
   */
  async bulkStartMonitoring(contentItems: { contentId: string; videoUrl: string }[]): Promise<void> {
    console.log(`Starting bulk leak monitoring for ${contentItems.length} items`);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const item of contentItems) {
      try {
        const fingerprint = await this.fingerprintService.generateFingerprint(item.videoUrl);
        await this.leakDetectionService.startMonitoring(item.contentId, fingerprint);
        await this.leakDetectionQueue.addToMonitoring(item.contentId, 1); // Lower priority for bulk
        
        results.success++;
        
        // Add small delay to avoid overwhelming the system
        await this.sleep(100);
        
      } catch (error) {
        results.failed++;
        results.errors.push(`${item.contentId}: ${error.message}`);
        console.error(`Failed to start monitoring for ${item.contentId}:`, error);
      }
    }

    console.log(`Bulk monitoring completed: ${results.success} success, ${results.failed} failed`);
    
    if (results.errors.length > 0) {
      console.error('Bulk monitoring errors:', results.errors);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Event handler for integration with existing upload system
export function createUploadEventHandler(
  leakDetectionService: LeakDetectionService,
  leakDetectionQueue: LeakDetectionQueue,
  fingerprintService: VideoFingerprintService
) {
  const integration = new UploadPipelineIntegration(
    leakDetectionService,
    leakDetectionQueue,
    fingerprintService
  );

  return {
    onUploadCompleted: (event: UploadCompletedEvent) => integration.handleUploadCompleted(event),
    onContentDeleted: (contentId: string) => integration.handleContentDeleted(contentId),
    bulkStartMonitoring: (items: { contentId: string; videoUrl: string }[]) => 
      integration.bulkStartMonitoring(items)
  };
}