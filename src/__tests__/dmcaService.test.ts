import { DMCAService } from '../../services/dmcaService';
import { LeakMatch } from '../../types';
import fs from 'fs/promises';
import path from 'path';

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(() => ({
    newPage: jest.fn(() => ({
      setUserAgent: jest.fn(),
      goto: jest.fn(),
      waitForTimeout: jest.fn(),
      screenshot: jest.fn(),
      $: jest.fn(() => ({
        screenshot: jest.fn()
      })),
      evaluate: jest.fn(() => ({
        title: 'Test Page',
        url: 'https://example.com/test',
        timestamp: new Date().toISOString(),
        userAgent: 'Mozilla/5.0 Test'
      }))
    })),
    close: jest.fn()
  }))
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn()
}));

describe('DMCAService', () => {
  let dmcaService: DMCAService;
  const testEvidencePath = './test-evidence';

  beforeEach(() => {
    dmcaService = new DMCAService(testEvidencePath);
    jest.clearAllMocks();
  });

  describe('generateDMCANotice', () => {
    const mockLeak: LeakMatch = {
      id: 'leak_123',
      contentId: 'content_456',
      detectedUrl: 'https://pornhub.com/view_video.php?viewkey=test123',
      platform: 'pornhub',
      matchScore: 0.92,
      detectedAt: new Date('2024-01-15T10:00:00Z'),
      status: 'detected',
      evidence: {
        screenshots: ['thumb1.jpg'],
        fingerprintMatch: {
          similarity: 0.92,
          frameMatches: 85,
          audioMatch: 0.88,
          durationMatch: 0.98
        },
        metadata: {
          title: 'Leaked Video',
          duration: 1200,
          uploadDate: new Date('2024-01-14T15:30:00Z'),
          platform: 'pornhub'
        }
      }
    };

    it('should generate DMCA notice for supported platform', async () => {
      const dmcaNotice = await dmcaService.generateDMCANotice(mockLeak);

      expect(dmcaNotice).toBeDefined();
      expect(dmcaNotice.id).toMatch(/^dmca_leak_123_\d+$/);
      expect(dmcaNotice.leakId).toBe('leak_123');
      expect(dmcaNotice.contentId).toBe('content_456');
      expect(dmcaNotice.platform).toBe('pornhub');
      expect(dmcaNotice.targetUrl).toBe('https://pornhub.com/view_video.php?viewkey=test123');
      expect(dmcaNotice.status).toBe('draft');
      expect(dmcaNotice.noticeText).toContain('PornHub DMCA Team');
      expect(dmcaNotice.noticeText).toContain('https://pornhub.com/view_video.php?viewkey=test123');
      expect(dmcaNotice.noticeText).toContain('92.0%');
    });

    it('should throw error for unsupported platform', async () => {
      const unsupportedLeak = { ...mockLeak, platform: 'unsupported-platform' };

      await expect(dmcaService.generateDMCANotice(unsupportedLeak))
        .rejects.toThrow('No DMCA template found for platform: unsupported-platform');
    });

    it('should create evidence directory', async () => {
      await dmcaService.generateDMCANotice(mockLeak);

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(testEvidencePath, 'leak_123'),
        { recursive: true }
      );
    });

    it('should generate evidence files', async () => {
      await dmcaService.generateDMCANotice(mockLeak);

      // Check that evidence files were created
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('page_metadata.json'),
        expect.any(String)
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('original_content_proof.json'),
        expect.any(String)
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('copyright_ownership_proof.json'),
        expect.any(String)
      );
    });

    it('should include compliance pack URL in evidence when provided', async () => {
      const compliancePackUrl = 'https://ourplatform.com/compliance/pack123.pdf';
      
      const dmcaNotice = await dmcaService.generateDMCANotice(mockLeak, compliancePackUrl);

      expect(dmcaNotice.evidence.compliancePackUrl).toBe(compliancePackUrl);
    });
  });

  describe('template variable replacement', () => {
    const mockLeak: LeakMatch = {
      id: 'leak_test',
      contentId: 'content_test',
      detectedUrl: 'https://xvideos.com/video123',
      platform: 'xvideos',
      matchScore: 0.87,
      detectedAt: new Date('2024-01-15T14:30:00Z'),
      status: 'detected',
      evidence: {
        screenshots: ['screenshot1.png', 'screenshot2.png'],
        fingerprintMatch: {
          similarity: 0.87,
          frameMatches: 78,
          audioMatch: 0.85,
          durationMatch: 0.92
        },
        metadata: {
          title: 'Test Video',
          duration: 900,
          uploadDate: new Date('2024-01-14T12:00:00Z'),
          platform: 'xvideos'
        }
      }
    };

    it('should replace all template variables correctly', async () => {
      const dmcaNotice = await dmcaService.generateDMCANotice(mockLeak);

      expect(dmcaNotice.noticeText).toContain('https://xvideos.com/video123');
      expect(dmcaNotice.noticeText).toContain('content_test');
      expect(dmcaNotice.noticeText).toContain('87.0%');
      expect(dmcaNotice.noticeText).toContain('1/15/2024'); // Detection date
      expect(dmcaNotice.noticeText).toContain('https://ourplatform.com/content/content_test');
      expect(dmcaNotice.noticeText).toContain('2 pieces of evidence');
      expect(dmcaNotice.noticeText).toContain('87.0% confidence');
    });

    it('should use correct template for different platforms', async () => {
      const pornhubLeak = { ...mockLeak, platform: 'pornhub' };
      const xvideosLeak = { ...mockLeak, platform: 'xvideos' };

      const pornhubNotice = await dmcaService.generateDMCANotice(pornhubLeak);
      const xvideosNotice = await dmcaService.generateDMCANotice(xvideosLeak);

      expect(pornhubNotice.noticeText).toContain('PornHub DMCA Team');
      expect(xvideosNotice.noticeText).toContain('To Whom It May Concern');
    });
  });

  describe('submitDMCANotice', () => {
    const mockDMCANotice = {
      id: 'dmca_123',
      leakId: 'leak_123',
      contentId: 'content_456',
      platform: 'pornhub',
      targetUrl: 'https://pornhub.com/test',
      noticeText: 'Test DMCA notice text',
      evidence: {
        screenshots: ['screenshot.png'],
        fingerprintData: {},
        originalContentProof: 'proof.json',
        copyrightOwnershipProof: 'ownership.json'
      },
      generatedAt: new Date(),
      status: 'draft' as const
    };

    it('should update status to sent after submission', async () => {
      await dmcaService.submitDMCANotice(mockDMCANotice);

      expect(mockDMCANotice.status).toBe('sent');
      expect(mockDMCANotice.trackingInfo?.sentAt).toBeInstanceOf(Date);
    });

    it('should throw error for unsupported platform', async () => {
      const unsupportedNotice = { ...mockDMCANotice, platform: 'unsupported' };

      await expect(dmcaService.submitDMCANotice(unsupportedNotice))
        .rejects.toThrow('No template found for platform: unsupported');
    });
  });

  describe('getSuccessRate', () => {
    it('should return success rate statistics', async () => {
      const stats = await dmcaService.getSuccessRate();

      expect(stats).toHaveProperty('totalNotices');
      expect(stats).toHaveProperty('successful');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('disputed');
      expect(stats).toHaveProperty('successRate');
      expect(typeof stats.successRate).toBe('number');
    });
  });

  describe('template initialization', () => {
    it('should initialize templates for supported platforms', () => {
      // Access private templates map through type assertion
      const templates = (dmcaService as any).templates;

      expect(templates.has('pornhub')).toBe(true);
      expect(templates.has('xvideos')).toBe(true);

      const pornhubTemplate = templates.get('pornhub');
      expect(pornhubTemplate.recipientEmail).toBe('dmca@pornhub.com');
      expect(pornhubTemplate.submitMethod).toBe('email');
      expect(pornhubTemplate.bodyTemplate).toContain('PornHub DMCA Team');

      const xvideosTemplate = templates.get('xvideos');
      expect(xvideosTemplate.recipientEmail).toBe('legal@xvideos.com');
      expect(xvideosTemplate.submitMethod).toBe('email');
      expect(xvideosTemplate.bodyTemplate).toContain('formal DMCA takedown notice');
    });
  });
});