import { ForensicWatermarkService } from '../../services/forensicWatermarkService';

describe('ForensicWatermarkService', () => {
  let service: ForensicWatermarkService;

  beforeEach(() => {
    service = new ForensicWatermarkService();
  });

  describe('generateWatermark', () => {
    it('should generate unique watermark for user session', async () => {
      const userId = 'user123';
      const sessionId = 'session456';
      const contentId = 'content789';

      const watermark = await service.generateWatermark(userId, sessionId, contentId);

      expect(watermark.id).toBeDefined();
      expect(watermark.userId).toBe(userId);
      expect(watermark.sessionId).toBe(sessionId);
      expect(watermark.contentId).toBe(contentId);
      expect(watermark.watermarkData).toBeDefined();
      expect(watermark.extractionKey).toBeDefined();
      expect(watermark.timestamp).toBeInstanceOf(Date);
    });

    it('should generate different watermarks for different sessions', async () => {
      const userId = 'user123';
      const contentId = 'content789';

      const watermark1 = await service.generateWatermark(userId, 'session1', contentId);
      const watermark2 = await service.generateWatermark(userId, 'session2', contentId);

      expect(watermark1.id).not.toBe(watermark2.id);
      expect(watermark1.watermarkData).not.toBe(watermark2.watermarkData);
      expect(watermark1.extractionKey).not.toBe(watermark2.extractionKey);
    });
  });

  describe('embedWatermarkInVideo', () => {
    it('should embed watermark in video buffer', async () => {
      const originalVideo = Buffer.from('original video content');
      const watermark = await service.generateWatermark('user123', 'session456', 'content789');

      const watermarkedVideo = await service.embedWatermarkInVideo(originalVideo, watermark);

      expect(watermarkedVideo).toBeInstanceOf(Buffer);
      expect(watermarkedVideo.length).toBeGreaterThan(originalVideo.length);
      
      // Should contain watermark data
      const videoStr = watermarkedVideo.toString();
      expect(videoStr).toContain(watermark.watermarkData);
    });
  });

  describe('extractWatermark', () => {
    it('should extract watermark from watermarked content', async () => {
      const originalVideo = Buffer.from('original video content');
      const watermark = await service.generateWatermark('user123', 'session456', 'content789');
      const watermarkedVideo = await service.embedWatermarkInVideo(originalVideo, watermark);

      const extractedWatermarks = await service.extractWatermark(watermarkedVideo);

      expect(extractedWatermarks).toHaveLength(1);
      expect(extractedWatermarks[0].watermarkId).toBe(watermark.id);
      expect(extractedWatermarks[0].userId).toBe(watermark.userId);
      expect(extractedWatermarks[0].sessionId).toBe(watermark.sessionId);
      expect(extractedWatermarks[0].confidence).toBeGreaterThan(0.9);
    });

    it('should return empty array for non-watermarked content', async () => {
      const nonWatermarkedVideo = Buffer.from('regular video content');

      const extractedWatermarks = await service.extractWatermark(nonWatermarkedVideo);

      expect(extractedWatermarks).toHaveLength(0);
    });
  });

  describe('createForensicInvestigation', () => {
    it('should create investigation with extracted watermarks', async () => {
      const leakUrl = 'https://example.com/leaked-video';
      
      // Create and embed watermark
      const watermark = await service.generateWatermark('user123', 'session456', 'content789');
      const originalVideo = Buffer.from('original video content');
      const watermarkedVideo = await service.embedWatermarkInVideo(originalVideo, watermark);

      const investigation = await service.createForensicInvestigation(leakUrl, watermarkedVideo);

      expect(investigation.id).toBeDefined();
      expect(investigation.leakUrl).toBe(leakUrl);
      expect(investigation.extractedWatermarks).toHaveLength(1);
      expect(investigation.suspectedUsers).toContain('user123');
      expect(investigation.status).toBe('analyzing');
      expect(investigation.evidencePackage).toBeDefined();
    });

    it('should mark investigation as inconclusive when no watermarks found', async () => {
      const leakUrl = 'https://example.com/leaked-video';
      const nonWatermarkedVideo = Buffer.from('regular video content');

      const investigation = await service.createForensicInvestigation(leakUrl, nonWatermarkedVideo);

      expect(investigation.extractedWatermarks).toHaveLength(0);
      expect(investigation.suspectedUsers).toHaveLength(0);
      expect(investigation.status).toBe('inconclusive');
    });
  });

  describe('getWatermarkStats', () => {
    it('should return accurate statistics', async () => {
      // Generate some test data
      await service.generateWatermark('user1', 'session1', 'content1');
      await service.generateWatermark('user2', 'session2', 'content2');
      
      const leakContent = Buffer.from('leaked content');
      await service.createForensicInvestigation('https://leak1.com', leakContent);
      await service.createForensicInvestigation('https://leak2.com', leakContent);

      const stats = await service.getWatermarkStats();

      expect(stats.totalWatermarks).toBe(2);
      expect(stats.activeInvestigations).toBe(2); // Both should be inconclusive
      expect(stats.successfulExtractions).toBe(0); // No successful extractions
    });
  });

  describe('getInvestigationsByUser', () => {
    it('should return investigations for specific user', async () => {
      const userId = 'user123';
      const watermark = await service.generateWatermark(userId, 'session456', 'content789');
      const originalVideo = Buffer.from('original video content');
      const watermarkedVideo = await service.embedWatermarkInVideo(originalVideo, watermark);

      await service.createForensicInvestigation('https://leak1.com', watermarkedVideo);
      await service.createForensicInvestigation('https://leak2.com', Buffer.from('other content'));

      const userInvestigations = await service.getInvestigationsByUser(userId);

      expect(userInvestigations).toHaveLength(1);
      expect(userInvestigations[0].suspectedUsers).toContain(userId);
    });
  });
});

describe('Forensic Watermark Integration', () => {
  let service: ForensicWatermarkService;

  beforeEach(() => {
    service = new ForensicWatermarkService();
  });

  it('should handle complete watermark lifecycle', async () => {
    const userId = 'user123';
    const sessionId = 'session456';
    const contentId = 'content789';
    const leakUrl = 'https://pirate-site.com/stolen-video';

    // 1. Generate watermark for premium content
    const watermark = await service.generateWatermark(userId, sessionId, contentId);
    expect(watermark.userId).toBe(userId);

    // 2. Embed watermark in video during streaming
    const originalVideo = Buffer.from('premium video content');
    const watermarkedVideo = await service.embedWatermarkInVideo(originalVideo, watermark);
    expect(watermarkedVideo.length).toBeGreaterThan(originalVideo.length);

    // 3. Detect leak and create forensic investigation
    const investigation = await service.createForensicInvestigation(leakUrl, watermarkedVideo);
    expect(investigation.status).toBe('analyzing');
    expect(investigation.suspectedUsers).toContain(userId);

    // 4. Verify evidence package contains forensic data
    const evidenceData = JSON.parse(investigation.evidencePackage);
    expect(evidenceData.extractedWatermarks).toHaveLength(1);
    expect(evidenceData.forensicHash).toBeDefined();

    // 5. Check investigation can be retrieved
    const retrievedInvestigation = await service.getInvestigation(investigation.id);
    expect(retrievedInvestigation).toBeTruthy();
    expect(retrievedInvestigation!.id).toBe(investigation.id);
  });

  it('should handle multiple users in same leaked content', async () => {
    const contentId = 'content789';
    const leakUrl = 'https://pirate-site.com/stolen-video';

    // Generate watermarks for multiple users
    const watermark1 = await service.generateWatermark('user1', 'session1', contentId);
    const watermark2 = await service.generateWatermark('user2', 'session2', contentId);

    // Simulate leaked content with multiple watermarks
    const video1 = await service.embedWatermarkInVideo(Buffer.from('video'), watermark1);
    const video2 = await service.embedWatermarkInVideo(video1, watermark2);

    const investigation = await service.createForensicInvestigation(leakUrl, video2);

    expect(investigation.extractedWatermarks.length).toBeGreaterThan(0);
    expect(investigation.suspectedUsers.length).toBeGreaterThan(0);
    expect(investigation.status).toBe('analyzing');
  });
});