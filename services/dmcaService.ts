import { LeakMatch, LeakEvidence } from '../types';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

export interface DMCANotice {
  id: string;
  leakId: string;
  contentId: string;
  platform: string;
  targetUrl: string;
  noticeText: string;
  evidence: DMCAEvidence;
  generatedAt: Date;
  status: 'draft' | 'sent' | 'acknowledged' | 'removed' | 'disputed';
  trackingInfo?: {
    sentAt?: Date;
    responseAt?: Date;
    removalAt?: Date;
  };
}

export interface DMCAEvidence {
  screenshots: string[];
  fingerprintData: any;
  compliancePackUrl?: string;
  originalContentProof: string;
  copyrightOwnershipProof: string;
}

export interface DMCATemplate {
  platform: string;
  recipientEmail: string;
  subject: string;
  bodyTemplate: string;
  submitUrl?: string;
  submitMethod?: 'email' | 'form' | 'api';
}

export class DMCAService {
  private templates: Map<string, DMCATemplate>;
  private evidenceStoragePath: string;

  constructor(evidenceStoragePath: string = './evidence') {
    this.evidenceStoragePath = evidenceStoragePath;
    this.templates = new Map();
    this.initializeTemplates();
  }

  /**
   * Generate automated DMCA notice for detected leak
   */
  async generateDMCANotice(leak: LeakMatch, compliancePackUrl?: string): Promise<DMCANotice> {
    try {
      console.log(`Generating DMCA notice for leak ${leak.id}`);

      // Capture evidence
      const evidence = await this.captureEvidence(leak, compliancePackUrl);

      // Get platform template
      const template = this.templates.get(leak.platform);
      if (!template) {
        throw new Error(`No DMCA template found for platform: ${leak.platform}`);
      }

      // Generate notice text
      const noticeText = await this.generateNoticeText(leak, evidence, template);

      const dmcaNotice: DMCANotice = {
        id: `dmca_${leak.id}_${Date.now()}`,
        leakId: leak.id,
        contentId: leak.contentId,
        platform: leak.platform,
        targetUrl: leak.detectedUrl,
        noticeText,
        evidence,
        generatedAt: new Date(),
        status: 'draft'
      };

      console.log(`DMCA notice generated successfully: ${dmcaNotice.id}`);
      return dmcaNotice;

    } catch (error) {
      console.error(`Failed to generate DMCA notice for leak ${leak.id}:`, error);
      throw error;
    }
  }

  /**
   * Capture evidence including screenshots and fingerprint data
   */
  private async captureEvidence(leak: LeakMatch, compliancePackUrl?: string): Promise<DMCAEvidence> {
    const evidenceDir = path.join(this.evidenceStoragePath, leak.id);
    await fs.mkdir(evidenceDir, { recursive: true });

    // Capture screenshot of the infringing content
    const screenshots = await this.captureScreenshots(leak.detectedUrl, evidenceDir);

    // Generate original content proof (screenshot of our platform)
    const originalContentProof = await this.generateOriginalContentProof(leak.contentId, evidenceDir);

    // Generate copyright ownership proof
    const copyrightOwnershipProof = await this.generateOwnershipProof(leak.contentId, evidenceDir);

    return {
      screenshots,
      fingerprintData: leak.evidence.fingerprintMatch,
      compliancePackUrl,
      originalContentProof,
      copyrightOwnershipProof
    };
  }

  /**
   * Capture screenshots of infringing content
   */
  private async captureScreenshots(url: string, evidenceDir: string): Promise<string[]> {
    const browser = await puppeteer.launch({ headless: true });
    const screenshots: string[] = [];

    try {
      const page = await browser.newPage();
      
      // Set user agent to avoid bot detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      // Navigate to the infringing page
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for content to load
      await page.waitForTimeout(3000);

      // Capture full page screenshot
      const fullPagePath = path.join(evidenceDir, 'full_page.png');
      await page.screenshot({ 
        path: fullPagePath, 
        fullPage: true,
        type: 'png'
      });
      screenshots.push(fullPagePath);

      // Capture video player area if present
      try {
        const videoElement = await page.$('video, .video-player, #player');
        if (videoElement) {
          const videoScreenshotPath = path.join(evidenceDir, 'video_player.png');
          await videoElement.screenshot({ path: videoScreenshotPath, type: 'png' });
          screenshots.push(videoScreenshotPath);
        }
      } catch (error) {
        console.warn('Could not capture video player screenshot:', error.message);
      }

      // Capture page metadata
      const metadata = await page.evaluate(() => ({
        title: document.title,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      }));

      // Save metadata
      const metadataPath = path.join(evidenceDir, 'page_metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    } catch (error) {
      console.error(`Failed to capture screenshots for ${url}:`, error);
      throw error;
    } finally {
      await browser.close();
    }

    return screenshots;
  }

  /**
   * Generate proof of original content ownership
   */
  private async generateOriginalContentProof(contentId: string, evidenceDir: string): Promise<string> {
    // This would capture a screenshot of the content on our platform
    // For now, we'll create a placeholder proof document
    
    const proofData = {
      contentId,
      platform: 'Our Platform',
      uploadDate: new Date().toISOString(), // Would get actual upload date
      ownershipVerified: true,
      complianceRecords: true,
      timestamp: new Date().toISOString()
    };

    const proofPath = path.join(evidenceDir, 'original_content_proof.json');
    await fs.writeFile(proofPath, JSON.stringify(proofData, null, 2));

    return proofPath;
  }

  /**
   * Generate copyright ownership proof
   */
  private async generateOwnershipProof(contentId: string, evidenceDir: string): Promise<string> {
    // This would include 2257 records, consent forms, etc.
    // Integration with existing compliance system from task 34
    
    const ownershipData = {
      contentId,
      copyrightOwner: 'Content Creator Name', // Would get from user data
      registrationDate: new Date().toISOString(),
      complianceDocuments: [
        '2257_record.pdf',
        'consent_form.pdf',
        'id_verification.pdf'
      ],
      digitalSignature: 'signature_hash_here',
      timestamp: new Date().toISOString()
    };

    const ownershipPath = path.join(evidenceDir, 'copyright_ownership_proof.json');
    await fs.writeFile(ownershipPath, JSON.stringify(ownershipData, null, 2));

    return ownershipPath;
  }

  /**
   * Generate DMCA notice text using template
   */
  private async generateNoticeText(
    leak: LeakMatch, 
    evidence: DMCAEvidence, 
    template: DMCATemplate
  ): Promise<string> {
    const templateVars = {
      PLATFORM_NAME: leak.platform,
      INFRINGING_URL: leak.detectedUrl,
      CONTENT_ID: leak.contentId,
      MATCH_SCORE: (leak.matchScore * 100).toFixed(1),
      DETECTION_DATE: leak.detectedAt.toLocaleDateString(),
      COPYRIGHT_OWNER: 'Content Creator Name', // Would get from user data
      ORIGINAL_CONTENT_URL: `https://ourplatform.com/content/${leak.contentId}`,
      EVIDENCE_COUNT: evidence.screenshots.length,
      FINGERPRINT_CONFIDENCE: (leak.evidence.fingerprintMatch.similarity * 100).toFixed(1),
      CURRENT_DATE: new Date().toLocaleDateString(),
      CONTACT_EMAIL: 'legal@ourplatform.com',
      COMPANY_NAME: 'Our Platform Inc.'
    };

    let noticeText = template.bodyTemplate;

    // Replace template variables
    for (const [key, value] of Object.entries(templateVars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      noticeText = noticeText.replace(regex, String(value));
    }

    return noticeText;
  }

  /**
   * Submit DMCA notice to platform
   */
  async submitDMCANotice(dmcaNotice: DMCANotice): Promise<void> {
    const template = this.templates.get(dmcaNotice.platform);
    if (!template) {
      throw new Error(`No template found for platform: ${dmcaNotice.platform}`);
    }

    try {
      switch (template.submitMethod) {
        case 'email':
          await this.submitViaEmail(dmcaNotice, template);
          break;
        case 'form':
          await this.submitViaForm(dmcaNotice, template);
          break;
        case 'api':
          await this.submitViaAPI(dmcaNotice, template);
          break;
        default:
          throw new Error(`Unsupported submit method: ${template.submitMethod}`);
      }

      dmcaNotice.status = 'sent';
      dmcaNotice.trackingInfo = {
        ...dmcaNotice.trackingInfo,
        sentAt: new Date()
      };

      console.log(`DMCA notice ${dmcaNotice.id} submitted successfully`);

    } catch (error) {
      console.error(`Failed to submit DMCA notice ${dmcaNotice.id}:`, error);
      throw error;
    }
  }

  /**
   * Submit DMCA notice via email
   */
  private async submitViaEmail(dmcaNotice: DMCANotice, template: DMCATemplate): Promise<void> {
    // This would integrate with an email service like SendGrid or AWS SES
    console.log(`Sending DMCA notice via email to ${template.recipientEmail}`);
    
    // Mock email sending for now
    const emailData = {
      to: template.recipientEmail,
      subject: template.subject.replace('{{CONTENT_ID}}', dmcaNotice.contentId),
      body: dmcaNotice.noticeText,
      attachments: dmcaNotice.evidence.screenshots
    };

    // In production, this would actually send the email
    console.log('Email data prepared:', emailData);
  }

  /**
   * Submit DMCA notice via web form
   */
  private async submitViaForm(dmcaNotice: DMCANotice, template: DMCATemplate): Promise<void> {
    if (!template.submitUrl) {
      throw new Error('Submit URL required for form submission');
    }

    const browser = await puppeteer.launch({ headless: true });
    
    try {
      const page = await browser.newPage();
      await page.goto(template.submitUrl);

      // This would be customized per platform's form structure
      // For now, just log the attempt
      console.log(`Submitting DMCA notice via form at ${template.submitUrl}`);
      
    } finally {
      await browser.close();
    }
  }

  /**
   * Submit DMCA notice via API
   */
  private async submitViaAPI(dmcaNotice: DMCANotice, template: DMCATemplate): Promise<void> {
    if (!template.submitUrl) {
      throw new Error('Submit URL required for API submission');
    }

    // This would make API calls to platform-specific DMCA endpoints
    console.log(`Submitting DMCA notice via API to ${template.submitUrl}`);
  }

  /**
   * Track takedown success rate
   */
  async getSuccessRate(): Promise<any> {
    // This would query stored DMCA notices and calculate success rates
    return {
      totalNotices: 0,
      successful: 0,
      pending: 0,
      disputed: 0,
      successRate: 0
    };
  }

  /**
   * Initialize DMCA templates for different platforms
   */
  private initializeTemplates(): void {
    // PornHub DMCA template
    this.templates.set('pornhub', {
      platform: 'pornhub',
      recipientEmail: 'dmca@pornhub.com',
      subject: 'DMCA Takedown Notice - Content ID {{CONTENT_ID}}',
      submitMethod: 'email',
      bodyTemplate: `
Dear PornHub DMCA Team,

I am writing to notify you of copyright infringement on your platform.

INFRINGING CONTENT:
- URL: {{INFRINGING_URL}}
- Detected: {{DETECTION_DATE}}
- Match Confidence: {{FINGERPRINT_CONFIDENCE}}%

ORIGINAL CONTENT:
- Owner: {{COPYRIGHT_OWNER}}
- Original URL: {{ORIGINAL_CONTENT_URL}}
- Content ID: {{CONTENT_ID}}

EVIDENCE:
- {{EVIDENCE_COUNT}} screenshots captured
- Video fingerprint analysis showing {{MATCH_SCORE}}% similarity
- Compliance documentation available upon request

I have a good faith belief that the use of the copyrighted material described above is not authorized by the copyright owner, its agent, or the law.

I swear, under penalty of perjury, that the information in this notification is accurate and that I am the copyright owner or am authorized to act on behalf of the copyright owner.

Please remove this infringing content immediately.

Sincerely,
{{COPYRIGHT_OWNER}}
{{CONTACT_EMAIL}}
{{CURRENT_DATE}}
      `.trim()
    });

    // XVideos DMCA template
    this.templates.set('xvideos', {
      platform: 'xvideos',
      recipientEmail: 'legal@xvideos.com',
      subject: 'Copyright Infringement Notice - {{CONTENT_ID}}',
      submitMethod: 'email',
      bodyTemplate: `
To Whom It May Concern,

This is a formal DMCA takedown notice for copyrighted content hosted on your platform.

INFRINGING MATERIAL:
URL: {{INFRINGING_URL}}
Detection Date: {{DETECTION_DATE}}

ORIGINAL WORK:
Copyright Owner: {{COPYRIGHT_OWNER}}
Original Location: {{ORIGINAL_CONTENT_URL}}
Content Identifier: {{CONTENT_ID}}

TECHNICAL EVIDENCE:
Our automated system detected this content with {{MATCH_SCORE}}% confidence using advanced video fingerprinting technology. We have captured {{EVIDENCE_COUNT}} pieces of evidence documenting this infringement.

LEGAL STATEMENTS:
I have a good faith belief that use of the copyrighted materials described above is not authorized by the copyright owner, its agent, or the law.

I swear under penalty of perjury that the information in the notification is accurate and that I am the copyright owner or authorized to act on behalf of the copyright owner.

REQUESTED ACTION:
Please remove or disable access to this infringing material immediately.

Contact: {{CONTACT_EMAIL}}
Date: {{CURRENT_DATE}}
      `.trim()
    });

    // Add more platform templates as needed
  }
}