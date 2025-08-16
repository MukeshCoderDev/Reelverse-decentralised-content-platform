import { csamDetectionService } from './csamDetectionService';
import { incidentResponseService } from './incidentResponseService';

export interface ContentUpload {
  id: string;
  userId: string;
  filename: string;
  contentType: 'image' | 'video' | 'audio' | 'document';
  fileSize: number;
  uploadedAt: Date;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, any>;
}

export interface ModerationResult {
  contentId: string;
  status: 'approved' | 'rejected' | 'pending_review' | 'blocked';
  reasons: string[];
  confidence: number;
  reviewRequired: boolean;
  moderatedAt: Date;
  moderatedBy: 'system' | 'human';
  checks: {
    csam: boolean;
    adult: boolean;
    violence: boolean;
    copyright: boolean;
    spam: boolean;
  };
}

export class ContentModerationPipeline {
  async processUpload(upload: ContentUpload, contentBuffer: Buffer): Promise<ModerationResult> {
    console.log(`Processing upload: ${upload.id} (${upload.contentType})`);
    
    const moderationResult: ModerationResult = {
      contentId: upload.id,
      status: 'approved',
      reasons: [],
      confidence: 0,
      reviewRequired: false,
      moderatedAt: new Date(),
      moderatedBy: 'system',
      checks: {
        csam: false,
        adult: false,
        violence: false,
        copyright: false,
        spam: false
      }
    };
    
    try {
      // Step 1: CSAM Detection (highest priority)
      if (upload.contentType === 'image' || upload.contentType === 'video') {
        const csamResult = await csamDetectionService.scanContent(
          upload.id,
          contentBuffer,
          upload.contentType,
          {
            userId: upload.userId,
            filename: upload.filename,
            uploadedAt: upload.uploadedAt,
            ipAddress: upload.ipAddress
          }
        );
        
        moderationResult.checks.csam = true;
        
        if (csamResult.status === 'flagged' || csamResult.status === 'confirmed') {
          moderationResult.status = 'blocked';
          moderationResult.reasons.push(`CSAM detected (${csamResult.confidence}% confidence)`);
          moderationResult.confidence = Math.max(moderationResult.confidence, csamResult.confidence);
          moderationResult.reviewRequired = csamResult.requiresHumanReview;
          
          // CSAM detection automatically blocks content - no further processing needed
          return moderationResult;
        }
      }
      
      // Step 2: Adult Content Classification
      const adultResult = await this.checkAdultContent(contentBuffer, upload.contentType);
      moderationResult.checks.adult = true;
      
      if (adultResult.isAdult && !adultResult.compliant) {
        moderationResult.status = 'rejected';
        moderationResult.reasons.push('Non-compliant adult content');
        moderationResult.confidence = Math.max(moderationResult.confidence, adultResult.confidence);
      }
      
      // Step 3: Violence Detection
      const violenceResult = await this.checkViolence(contentBuffer, upload.contentType);
      moderationResult.checks.violence = true;
      
      if (violenceResult.hasViolence && violenceResult.severity === 'extreme') {
        moderationResult.status = 'rejected';
        moderationResult.reasons.push('Extreme violence detected');
        moderationResult.confidence = Math.max(moderationResult.confidence, violenceResult.confidence);
      }
      
      // Step 4: Copyright Detection
      const copyrightResult = await this.checkCopyright(contentBuffer, upload.contentType);
      moderationResult.checks.copyright = true;
      
      if (copyrightResult.hasCopyrightIssue) {
        moderationResult.status = 'pending_review';
        moderationResult.reasons.push('Potential copyright infringement');
        moderationResult.reviewRequired = true;
        moderationResult.confidence = Math.max(moderationResult.confidence, copyrightResult.confidence);
      }
      
      // Step 5: Spam Detection
      const spamResult = await this.checkSpam(upload, contentBuffer);
      moderationResult.checks.spam = true;
      
      if (spamResult.isSpam) {
        moderationResult.status = 'rejected';
        moderationResult.reasons.push('Spam content detected');
        moderationResult.confidence = Math.max(moderationResult.confidence, spamResult.confidence);
      }
      
      // Step 6: User History Check
      const userRiskResult = await this.checkUserRisk(upload.userId);
      if (userRiskResult.isHighRisk) {
        moderationResult.reviewRequired = true;
        moderationResult.reasons.push('High-risk user - manual review required');
      }
      
      // Final status determination
      if (moderationResult.status === 'approved' && moderationResult.reviewRequired) {
        moderationResult.status = 'pending_review';
      }
      
      // Log moderation result
      await this.logModerationResult(upload, moderationResult);
      
      return moderationResult;
      
    } catch (error) {
      console.error(`Moderation pipeline error for ${upload.id}:`, error);
      
      // Default to manual review on error
      moderationResult.status = 'pending_review';
      moderationResult.reasons.push('Moderation system error - manual review required');
      moderationResult.reviewRequired = true;
      
      return moderationResult;
    }
  }
  
  private async checkAdultContent(content: Buffer, contentType: string): Promise<{
    isAdult: boolean;
    compliant: boolean;
    confidence: number;
    categories: string[];
  }> {
    // Mock adult content detection
    const isAdult = Math.random() < 0.3; // 30% chance for testing
    const confidence = isAdult ? 70 + Math.random() * 30 : Math.random() * 30;
    
    // Check compliance with platform policies
    const compliant = isAdult ? Math.random() < 0.9 : true; // 90% of adult content is compliant
    
    return {
      isAdult,
      compliant,
      confidence,
      categories: isAdult ? ['adult'] : []
    };
  }
  
  private async checkViolence(content: Buffer, contentType: string): Promise<{
    hasViolence: boolean;
    severity: 'mild' | 'moderate' | 'extreme';
    confidence: number;
  }> {
    // Mock violence detection
    const hasViolence = Math.random() < 0.1; // 10% chance for testing
    const severities: ('mild' | 'moderate' | 'extreme')[] = ['mild', 'moderate', 'extreme'];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const confidence = hasViolence ? 60 + Math.random() * 40 : Math.random() * 40;
    
    return {
      hasViolence,
      severity,
      confidence
    };
  }
  
  private async checkCopyright(content: Buffer, contentType: string): Promise<{
    hasCopyrightIssue: boolean;
    confidence: number;
    matches: string[];
  }> {
    // Mock copyright detection
    const hasCopyrightIssue = Math.random() < 0.05; // 5% chance for testing
    const confidence = hasCopyrightIssue ? 75 + Math.random() * 25 : Math.random() * 25;
    
    return {
      hasCopyrightIssue,
      confidence,
      matches: hasCopyrightIssue ? ['Known copyrighted material'] : []
    };
  }
  
  private async checkSpam(upload: ContentUpload, content: Buffer): Promise<{
    isSpam: boolean;
    confidence: number;
    reasons: string[];
  }> {
    // Mock spam detection based on upload patterns
    const reasons: string[] = [];
    let spamScore = 0;
    
    // Check upload frequency
    if (upload.metadata.recentUploads > 10) {
      reasons.push('High upload frequency');
      spamScore += 30;
    }
    
    // Check file size patterns
    if (upload.fileSize < 1000) {
      reasons.push('Suspiciously small file size');
      spamScore += 20;
    }
    
    // Random spam detection for testing
    if (Math.random() < 0.02) {
      reasons.push('Content pattern matches spam');
      spamScore += 50;
    }
    
    return {
      isSpam: spamScore >= 50,
      confidence: spamScore,
      reasons
    };
  }
  
  private async checkUserRisk(userId: string): Promise<{
    isHighRisk: boolean;
    riskScore: number;
    factors: string[];
  }> {
    // Mock user risk assessment
    const factors: string[] = [];
    let riskScore = 0;
    
    // Simulate risk factors
    if (Math.random() < 0.1) {
      factors.push('New account');
      riskScore += 20;
    }
    
    if (Math.random() < 0.05) {
      factors.push('Previous violations');
      riskScore += 40;
    }
    
    if (Math.random() < 0.02) {
      factors.push('Suspicious activity pattern');
      riskScore += 30;
    }
    
    return {
      isHighRisk: riskScore >= 50,
      riskScore,
      factors
    };
  }
  
  private async logModerationResult(upload: ContentUpload, result: ModerationResult): Promise<void> {
    // Log moderation decision for audit trail
    console.log(`Moderation result for ${upload.id}:`, {
      status: result.status,
      reasons: result.reasons,
      confidence: result.confidence,
      reviewRequired: result.reviewRequired,
      checks: result.checks
    });
    
    // Create incident for rejected content
    if (result.status === 'rejected' || result.status === 'blocked') {
      await incidentResponseService.createIncident(
        'compliance',
        result.status === 'blocked' ? 'critical' : 'medium',
        `Content ${result.status}: ${upload.id}`,
        `Content moderation ${result.status}: ${result.reasons.join(', ')}`,
        'system',
        {
          contentId: upload.id,
          userId: upload.userId,
          moderationResult: result,
          uploadMetadata: upload
        }
      );
    }
  }
  
  async getContentStatus(contentId: string): Promise<ModerationResult | null> {
    // Mock implementation - would query actual database
    console.log(`Checking status for content: ${contentId}`);
    return null;
  }
  
  async requestHumanReview(contentId: string, requestedBy: string, reason: string): Promise<void> {
    // Create incident for human review request
    await incidentResponseService.createIncident(
      'compliance',
      'medium',
      `Human review requested: ${contentId}`,
      `Manual review requested by ${requestedBy}: ${reason}`,
      requestedBy,
      {
        contentId,
        reviewType: 'human_requested',
        reason
      }
    );
    
    console.log(`Human review requested for content ${contentId} by ${requestedBy}: ${reason}`);
  }
  
  async generateModerationReport(startDate: Date, endDate: Date): Promise<any> {
    // Mock implementation - would generate actual moderation statistics
    return {
      period: { startDate, endDate },
      summary: {
        totalProcessed: 1000,
        approved: 850,
        rejected: 100,
        pendingReview: 30,
        blocked: 20,
        averageProcessingTime: 2.5, // seconds
        humanReviewRate: 0.15 // 15%
      },
      checks: {
        csamScans: 800,
        csamDetections: 5,
        adultContentFlags: 120,
        violenceDetections: 25,
        copyrightFlags: 15,
        spamDetections: 45
      }
    };
  }
}

export const contentModerationPipeline = new ContentModerationPipeline();