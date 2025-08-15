import { LeakDetectionService, DEFAULT_CRAWLER_CONFIG } from '../../services/leakDetectionService';
import { VideoFingerprintService } from '../../services/videoFingerprintService';
import { WebhookService } from '../../services/webhookService';
import Redis from 'ioredis-mock';

// Mock the external services
jest.mock('../../services/videoFingerprintService');
jest.mock('../../services/webhookService');

describe('LeakDetectionService', () => {
  let leakDetectionService: LeakDetectionService;
  let mockRedis: Redis;
  let mockFingerprintService: jest.Mocked<VideoFingerprintService>;
  let mockWebhookService: jest.Mocked<WebhookService>;

  beforeEach(() => {
    mockRedis = new Redis();
    mockFingerprintService = new VideoFingerprintService() as jest.Mocked<VideoFingerprintService>;
    mockWebhookService = new WebhookService() as jest.Mocked<WebhookService>;

    leakDetectionService = new LeakDetectionService(
      mockRedis,
      mockFingerprintService,
      mockWebhookService,
      DEFAULT_CRAWLER_CONFIG
    );
  });

  afterEach(async () => {
    await mockRedis.flushall();
  });

  describe('startMonitoring', () => {
    it('should start monitoring content and add to queue', async () => {
      const contentId = 'test-content-123';
      const fingerprint = {
        frameHashes: ['hash1', 'hash2'],
        audioChroma: [0.1, 0.2, 0.3],
        duration: 1200,
        resolution: '1920x1080'
      };

      await leakDetectionService.startMonitoring(contentId, fingerprint);

      // Check monitoring data was stored
      const monitoringData = await mockRedis.hgetall(`leak_monitor:${contentId}`);
      expect(monitoringData.contentId).toBe(contentId);
      expect(monitoringData.status).toBe('monitoring');
      expect(JSON.parse(monitoringData.fingerprint)).toEqual(fingerprint);

      // Check content was added to crawl queue
      const queueLength = await mockRedis.llen('leak_crawl_queue');
      expect(queueLength).toBe(1);
      
      const queueItem = await mockRedis.rpop('leak_crawl_queue');
      expect(queueItem).toBe(contentId);
    });

    it('should set SLA deadline correctly', async () => {
      const contentId = 'test-content-123';
      const fingerprint = {
        frameHashes: ['hash1'],
        audioChroma: [0.1],
        duration: 600,
        resolution: '1280x720'
      };

      const beforeTime = Date.now();
      await leakDetectionService.startMonitoring(contentId, fingerprint);
      const afterTime = Date.now();

      const monitoringData = await mockRedis.hgetall(`leak_monitor:${contentId}`);
      const slaDeadline = parseInt(monitoringData.slaDeadline);
      
      // SLA deadline should be 24 hours from now
      const expectedMin = beforeTime + (24 * 60 * 60 * 1000);
      const expectedMax = afterTime + (24 * 60 * 60 * 1000);
      
      expect(slaDeadline).toBeGreaterThanOrEqual(expectedMin);
      expect(slaDeadline).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('detectLeaks', () => {
    beforeEach(() => {
      // Mock fingerprint service methods
      mockFingerprintService.generateFingerprint.mockResolvedValue({
        frameHashes: ['suspect_hash1', 'suspect_hash2'],
        audioChroma: [0.15, 0.25, 0.35],
        duration: 1180,
        resolution: '1920x1080'
      });

      mockFingerprintService.compareFingerprints.mockResolvedValue({
        similarity: 0.92,
        frameMatches: 85,
        audioMatch: 0.88,
        durationMatch: 0.98
      });
    });

    it('should detect leaks when similarity exceeds threshold', async () => {
      const contentId = 'test-content-123';
      const originalFingerprint = {
        frameHashes: ['hash1', 'hash2'],
        audioChroma: [0.1, 0.2, 0.3],
        duration: 1200,
        resolution: '1920x1080'
      };

      // Set up monitoring data
      await mockRedis.hset(`leak_monitor:${contentId}`, {
        contentId,
        fingerprint: JSON.stringify(originalFingerprint),
        status: 'monitoring'
      });

      // Mock crawl results
      jest.spyOn(leakDetectionService as any, 'crawlPlatforms').mockResolvedValue([
        {
          platform: 'pornhub',
          success: true,
          videosFound: 1,
          videos: [{
            url: 'https://pornhub.com/view_video.php?viewkey=test123',
            title: 'Leaked Video',
            thumbnail: 'https://pornhub.com/thumb.jpg',
            duration: 1180,
            uploadDate: new Date(),
            platform: 'pornhub'
          }]
        }
      ]);

      const leaks = await leakDetectionService.detectLeaks(contentId);

      expect(leaks).toHaveLength(1);
      expect(leaks[0].contentId).toBe(contentId);
      expect(leaks[0].platform).toBe('pornhub');
      expect(leaks[0].matchScore).toBe(0.92);
      expect(leaks[0].status).toBe('detected');

      // Check monitoring status was updated
      const monitoringData = await mockRedis.hgetall(`leak_monitor:${contentId}`);
      expect(monitoringData.status).toBe('detected');
    });

    it('should not detect leaks when similarity is below threshold', async () => {
      const contentId = 'test-content-123';
      const originalFingerprint = {
        frameHashes: ['hash1', 'hash2'],
        audioChroma: [0.1, 0.2, 0.3],
        duration: 1200,
        resolution: '1920x1080'
      };

      // Set up monitoring data
      await mockRedis.hset(`leak_monitor:${contentId}`, {
        contentId,
        fingerprint: JSON.stringify(originalFingerprint),
        status: 'monitoring'
      });

      // Mock low similarity score
      mockFingerprintService.compareFingerprints.mockResolvedValue({
        similarity: 0.70, // Below 0.85 threshold
        frameMatches: 60,
        audioMatch: 0.65,
        durationMatch: 0.75
      });

      // Mock crawl results
      jest.spyOn(leakDetectionService as any, 'crawlPlatforms').mockResolvedValue([
        {
          platform: 'xvideos',
          success: true,
          videosFound: 1,
          videos: [{
            url: 'https://xvideos.com/video123',
            title: 'Different Video',
            thumbnail: 'https://xvideos.com/thumb.jpg',
            duration: 800,
            uploadDate: new Date(),
            platform: 'xvideos'
          }]
        }
      ]);

      const leaks = await leakDetectionService.detectLeaks(contentId);

      expect(leaks).toHaveLength(0);

      // Check monitoring status remains unchanged
      const monitoringData = await mockRedis.hgetall(`leak_monitor:${contentId}`);
      expect(monitoringData.status).toBe('monitoring');
    });

    it('should send webhook notification when leaks are detected', async () => {
      const contentId = 'test-content-123';
      const originalFingerprint = {
        frameHashes: ['hash1', 'hash2'],
        audioChroma: [0.1, 0.2, 0.3],
        duration: 1200,
        resolution: '1920x1080'
      };

      // Set up monitoring data
      await mockRedis.hset(`leak_monitor:${contentId}`, {
        contentId,
        fingerprint: JSON.stringify(originalFingerprint),
        status: 'monitoring'
      });

      // Mock crawl results with leak
      jest.spyOn(leakDetectionService as any, 'crawlPlatforms').mockResolvedValue([
        {
          platform: 'pornhub',
          success: true,
          videosFound: 1,
          videos: [{
            url: 'https://pornhub.com/view_video.php?viewkey=test123',
            title: 'Leaked Video',
            thumbnail: 'https://pornhub.com/thumb.jpg',
            duration: 1180,
            uploadDate: new Date(),
            platform: 'pornhub'
          }]
        }
      ]);

      await leakDetectionService.detectLeaks(contentId);

      // Verify webhook was called
      expect(mockWebhookService.send).toHaveBeenCalledWith(
        DEFAULT_CRAWLER_CONFIG.webhookUrl,
        expect.objectContaining({
          type: 'leak_detected',
          contentId,
          leakCount: 1
        })
      );
    });
  });

  describe('monitorSLA', () => {
    it('should detect SLA breaches and send notifications', async () => {
      const contentId = 'test-content-123';
      const pastDeadline = Date.now() - (60 * 60 * 1000); // 1 hour ago

      // Set up monitoring data with past SLA deadline
      await mockRedis.hset(`leak_monitor:${contentId}`, {
        contentId,
        status: 'monitoring',
        slaDeadline: pastDeadline.toString(),
        startedAt: (pastDeadline - 25 * 60 * 60 * 1000).toString() // 25 hours ago
      });

      await leakDetectionService.monitorSLA();

      // Check status was updated to sla_breach
      const monitoringData = await mockRedis.hgetall(`leak_monitor:${contentId}`);
      expect(monitoringData.status).toBe('sla_breach');

      // Verify webhook was called for SLA breach
      expect(mockWebhookService.send).toHaveBeenCalledWith(
        DEFAULT_CRAWLER_CONFIG.webhookUrl,
        expect.objectContaining({
          type: 'sla_breach',
          contentId,
          slaHours: 24
        })
      );
    });

    it('should not flag content within SLA window', async () => {
      const contentId = 'test-content-123';
      const futureDeadline = Date.now() + (60 * 60 * 1000); // 1 hour from now

      // Set up monitoring data with future SLA deadline
      await mockRedis.hset(`leak_monitor:${contentId}`, {
        contentId,
        status: 'monitoring',
        slaDeadline: futureDeadline.toString(),
        startedAt: Date.now().toString()
      });

      await leakDetectionService.monitorSLA();

      // Check status remains monitoring
      const monitoringData = await mockRedis.hgetall(`leak_monitor:${contentId}`);
      expect(monitoringData.status).toBe('monitoring');

      // Verify no webhook was called
      expect(mockWebhookService.send).not.toHaveBeenCalled();
    });
  });

  describe('getDetectionStats', () => {
    it('should calculate correct statistics', async () => {
      // Set up test data
      const now = Date.now();
      
      // Content 1: Detected (2 hours detection time)
      await mockRedis.hset('leak_monitor:content1', {
        contentId: 'content1',
        status: 'detected',
        startedAt: (now - 2 * 60 * 60 * 1000).toString(),
        detectedAt: now.toString()
      });

      // Content 2: Still monitoring
      await mockRedis.hset('leak_monitor:content2', {
        contentId: 'content2',
        status: 'monitoring',
        startedAt: (now - 1 * 60 * 60 * 1000).toString()
      });

      // Content 3: SLA breach
      await mockRedis.hset('leak_monitor:content3', {
        contentId: 'content3',
        status: 'sla_breach',
        startedAt: (now - 26 * 60 * 60 * 1000).toString()
      });

      const stats = await leakDetectionService.getDetectionStats();

      expect(stats.totalMonitored).toBe(3);
      expect(stats.detected).toBe(1);
      expect(stats.monitoring).toBe(1);
      expect(stats.slaBreach).toBe(1);
      expect(stats.avgDetectionTime).toBe(2); // 2 hours average
    });
  });
});