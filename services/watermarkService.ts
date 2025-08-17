import { v4 as uuidv4 } from 'uuid';

// Browser-compatible crypto utilities
const createHash = (algorithm: string) => {
  return {
    update: (data: string) => ({
      digest: (encoding: string) => {
        // Use Web Crypto API for browser compatibility
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        return crypto.subtle.digest('SHA-256', dataBuffer).then(hashBuffer => {
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        });
      }
    })
  };
};

export interface ForensicWatermark {
  id: string;
  userId: string;
  sessionId: string;
  contentId: string;
  timestamp: Date;
  watermarkData: string;
  extractionKey: string;
}

export interface WatermarkExtractionResult {
  watermarkId: string;
  userId: string;
  sessionId: string;
  contentId: string;
  confidence: number;
  extractedAt: Date;
}

export interface WatermarkEmbedOptions {
  strength: 'low' | 'medium' | 'high';
  position: 'distributed' | 'corner' | 'center';
  frequency: number; // frames per watermark
}

export class WatermarkService {
  private static instance: WatermarkService | null = null;

  /**
   * Backwards-compatible singleton accessor used by existing code/tests
   */
  public static getInstance(): WatermarkService {
    if (!WatermarkService.instance) {
      WatermarkService.instance = new WatermarkService();
    }
    return WatermarkService.instance;
  }
  private readonly watermarkDatabase = new Map<string, ForensicWatermark>();
  private readonly extractionKeys = new Map<string, string>();

  /**
   * Generate forensic watermark for premium content
   */
  async generateForensicWatermark(
    userId: string,
    sessionId: string,
    contentId: string
  ): Promise<ForensicWatermark> {
    const watermarkId = uuidv4();
    const timestamp = new Date();
    
    // Create unique watermark data combining user, session, and content info
    const watermarkPayload = {
      userId,
      sessionId,
      contentId,
      timestamp: timestamp.toISOString(),
      random: Math.random().toString(36)
    };
    
    const watermarkData = btoa(JSON.stringify(watermarkPayload));
    const extractionKey = await this.generateExtractionKey(watermarkId, userId);
    
    const watermark: ForensicWatermark = {
      id: watermarkId,
      userId,
      sessionId,
      contentId,
      timestamp,
      watermarkData,
      extractionKey
    };
    
    // Store watermark in database
    this.watermarkDatabase.set(watermarkId, watermark);
    this.extractionKeys.set(watermarkId, extractionKey);
    
    return watermark;
  }

  /**
   * Embed invisible watermark into video stream
   */
  async embedWatermarkInVideo(
    videoUrl: string,
    watermark: ForensicWatermark,
    options: WatermarkEmbedOptions = {
      strength: 'medium',
      position: 'distributed',
      frequency: 30 // every 30 frames
    }
  ): Promise<string> {
    try {
      // In a real implementation, this would use FFmpeg with steganography
      // For now, we'll simulate the watermarking process
      
      const watermarkedUrl = await this.processVideoWithWatermark(
        videoUrl,
        watermark.watermarkData,
        options
      );
      
      console.log(`Embedded forensic watermark ${watermark.id} in video ${videoUrl}`);
      return watermarkedUrl;
      
    } catch (error) {
      console.error('Failed to embed watermark:', error);
      throw new Error(`Watermark embedding failed: ${error.message}`);
    }
  }

  /**
   * Extract forensic watermark from suspected leaked content
   */
  async extractWatermarkFromVideo(
    suspectedLeakUrl: string
  ): Promise<WatermarkExtractionResult | null> {
    try {
      // In a real implementation, this would analyze video frames for watermark patterns
      const extractedData = await this.analyzeVideoForWatermarks(suspectedLeakUrl);
      
      if (!extractedData) {
        return null;
      }
      
      // Decode watermark data
      const watermarkPayload = JSON.parse(atob(extractedData.watermarkData));
      
      // Verify watermark authenticity
      const isValid = await this.verifyWatermarkAuthenticity(
        extractedData.watermarkId,
        extractedData.extractionKey
      );
      
      if (!isValid) {
        console.warn(`Invalid watermark detected: ${extractedData.watermarkId}`);
        return null;
      }
      
      return {
        watermarkId: extractedData.watermarkId,
        userId: watermarkPayload.userId,
        sessionId: watermarkPayload.sessionId,
        contentId: watermarkPayload.contentId,
        confidence: extractedData.confidence,
        extractedAt: new Date()
      };
      
    } catch (error) {
      console.error('Failed to extract watermark:', error);
      return null;
    }
  }

  /**
   * Create forensic investigation report
   */
  async generateForensicReport(
    extractionResult: WatermarkExtractionResult,
    leakUrl: string
  ): Promise<ForensicInvestigationReport> {
    const originalWatermark = this.watermarkDatabase.get(extractionResult.watermarkId);
    
    if (!originalWatermark) {
      throw new Error(`Original watermark not found: ${extractionResult.watermarkId}`);
    }
    
    const report: ForensicInvestigationReport = {
      id: uuidv4(),
      watermarkId: extractionResult.watermarkId,
      leakUrl,
      sourceUserId: extractionResult.userId,
      sourceSessionId: extractionResult.sessionId,
      contentId: extractionResult.contentId,
      originalTimestamp: originalWatermark.timestamp,
      extractionTimestamp: extractionResult.extractedAt,
      confidence: extractionResult.confidence,
      evidenceHash: await this.generateEvidenceHash(extractionResult, leakUrl),
      investigationStatus: 'pending_review',
      createdAt: new Date()
    };
    
    return report;
  }

  /**
   * Get forensic watermark database for leak source analysis
   */
  async getWatermarkAnalytics(contentId?: string): Promise<WatermarkAnalytics> {
    const allWatermarks = Array.from(this.watermarkDatabase.values());
    const filteredWatermarks = contentId 
      ? allWatermarks.filter(w => w.contentId === contentId)
      : allWatermarks;
    
    const userDistribution = this.calculateUserDistribution(filteredWatermarks);
    const timeDistribution = this.calculateTimeDistribution(filteredWatermarks);
    
    return {
      totalWatermarks: filteredWatermarks.length,
      uniqueUsers: new Set(filteredWatermarks.map(w => w.userId)).size,
      uniqueSessions: new Set(filteredWatermarks.map(w => w.sessionId)).size,
      userDistribution,
      timeDistribution,
      contentId
    };
  }

  private async generateExtractionKey(watermarkId: string, userId: string): Promise<string> {
    const data = `${watermarkId}:${userId}:${import.meta.env.VITE_WATERMARK_SECRET || 'default-secret'}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async processVideoWithWatermark(
    videoUrl: string,
    watermarkData: string,
    options: WatermarkEmbedOptions
  ): Promise<string> {
    // Simulate FFmpeg watermarking process
    // In production, this would use actual video processing
    
    const watermarkedFilename = `watermarked_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return `${import.meta.env.VITE_CDN_BASE_URL || '/api'}/watermarked/${watermarkedFilename}`;
  }

  private async analyzeVideoForWatermarks(videoUrl: string): Promise<{
    watermarkId: string;
    watermarkData: string;
    extractionKey: string;
    confidence: number;
  } | null> {
    // Simulate watermark extraction analysis
    // In production, this would analyze video frames for steganographic patterns
    
    // For demo purposes, simulate finding a watermark 70% of the time
    if (Math.random() < 0.7) {
      const mockWatermarks = Array.from(this.watermarkDatabase.values());
      if (mockWatermarks.length > 0) {
        const randomWatermark = mockWatermarks[Math.floor(Math.random() * mockWatermarks.length)];
        return {
          watermarkId: randomWatermark.id,
          watermarkData: randomWatermark.watermarkData,
          extractionKey: randomWatermark.extractionKey,
          confidence: 0.85 + Math.random() * 0.1 // 85-95% confidence
        };
      }
    }
    
    return null;
  }

  private async verifyWatermarkAuthenticity(
    watermarkId: string,
    extractionKey: string
  ): Promise<boolean> {
    const storedKey = this.extractionKeys.get(watermarkId);
    return storedKey === extractionKey;
  }

  private async generateEvidenceHash(
    extractionResult: WatermarkExtractionResult,
    leakUrl: string
  ): Promise<string> {
    const evidenceData = {
      watermarkId: extractionResult.watermarkId,
      userId: extractionResult.userId,
      sessionId: extractionResult.sessionId,
      contentId: extractionResult.contentId,
      leakUrl,
      extractedAt: extractionResult.extractedAt.toISOString()
    };
    
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(evidenceData));
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private calculateUserDistribution(watermarks: ForensicWatermark[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    watermarks.forEach(watermark => {
      distribution[watermark.userId] = (distribution[watermark.userId] || 0) + 1;
    });
    
    return distribution;
  }

  private calculateTimeDistribution(watermarks: ForensicWatermark[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    watermarks.forEach(watermark => {
      const hour = watermark.timestamp.getHours();
      const timeSlot = `${hour}:00-${hour + 1}:00`;
      distribution[timeSlot] = (distribution[timeSlot] || 0) + 1;
    });
    
    return distribution;
  }
}

export interface ForensicInvestigationReport {
  id: string;
  watermarkId: string;
  leakUrl: string;
  sourceUserId: string;
  sourceSessionId: string;
  contentId: string;
  originalTimestamp: Date;
  extractionTimestamp: Date;
  confidence: number;
  evidenceHash: string;
  investigationStatus: 'pending_review' | 'confirmed_leak' | 'false_positive' | 'legal_action';
  createdAt: Date;
}

export interface WatermarkAnalytics {
  totalWatermarks: number;
  uniqueUsers: number;
  uniqueSessions: number;
  userDistribution: Record<string, number>;
  timeDistribution: Record<string, number>;
  contentId?: string;
}

export const watermarkService = new WatermarkService();