import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

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
  confidence: number;
  extractedAt: Date;
}

export interface ForensicInvestigation {
  id: string;
  leakUrl: string;
  extractedWatermarks: WatermarkExtractionResult[];
  suspectedUsers: string[];
  evidencePackage: string;
  status: 'pending' | 'analyzing' | 'completed' | 'inconclusive';
  createdAt: Date;
}

export class ForensicWatermarkService {
  private readonly watermarkDatabase = new Map<string, ForensicWatermark>();
  private readonly investigationDatabase = new Map<string, ForensicInvestigation>();

  /**
   * Generate invisible forensic watermark for premium content
   * Embeds user/session data that can be extracted from leaked content
   */
  async generateWatermark(
    userId: string,
    sessionId: string,
    contentId: string
  ): Promise<ForensicWatermark> {
    const watermarkId = uuidv4();
    const timestamp = new Date();
    
    // Create watermark payload with user/session data
    const payload = {
      uid: userId.slice(-8), // Last 8 chars for privacy
      sid: sessionId.slice(-8),
      cid: contentId,
      ts: timestamp.getTime()
    };
    
    // Generate watermark data and extraction key
    const watermarkData = this.encodeWatermarkData(payload);
    const extractionKey = this.generateExtractionKey(watermarkId, userId);
    
    const watermark: ForensicWatermark = {
      id: watermarkId,
      userId,
      sessionId,
      contentId,
      timestamp,
      watermarkData,
      extractionKey
    };
    
    // Store watermark for future extraction
    this.watermarkDatabase.set(watermarkId, watermark);
    
    console.log(`Generated forensic watermark ${watermarkId} for user ${userId}`);
    return watermark;
  }

  /**
   * Embed watermark into video stream (invisible to viewers)
   * Uses LSB steganography in video frames
   */
  async embedWatermarkInVideo(
    videoBuffer: Buffer,
    watermark: ForensicWatermark
  ): Promise<Buffer> {
    // Simulate watermark embedding in video frames
    // In production, this would use FFmpeg with steganography filters
    const watermarkedVideo = Buffer.from(videoBuffer);
    
    // Add watermark metadata to video header (invisible)
    const watermarkHeader = Buffer.from(JSON.stringify({
      wm: watermark.watermarkData,
      key: watermark.extractionKey.slice(0, 16) // Partial key for extraction
    }));
    
    // Embed watermark data using LSB technique (simulated)
    const embeddedVideo = Buffer.concat([watermarkHeader, watermarkedVideo]);
    
    console.log(`Embedded watermark ${watermark.id} in video content`);
    return embeddedVideo;
  }

  /**
   * Extract forensic watermark from suspected leaked content
   */
  async extractWatermark(
    suspectedLeakBuffer: Buffer
  ): Promise<WatermarkExtractionResult[]> {
    const extractedWatermarks: WatermarkExtractionResult[] = [];
    
    try {
      // Extract watermark header from video
      const headerSize = 200; // Estimated header size
      const header = suspectedLeakBuffer.slice(0, headerSize);
      const headerStr = header.toString('utf8');
      
      // Look for watermark patterns
      const watermarkMatch = headerStr.match(/{"wm":"([^"]+)","key":"([^"]+)"}/);
      
      if (watermarkMatch) {
        const [, watermarkData, partialKey] = watermarkMatch;
        
        // Decode watermark data
        const decodedData = this.decodeWatermarkData(watermarkData);
        
        if (decodedData) {
          // Find matching watermark in database
          const matchingWatermark = this.findWatermarkByData(watermarkData);
          
          if (matchingWatermark) {
            extractedWatermarks.push({
              watermarkId: matchingWatermark.id,
              userId: matchingWatermark.userId,
              sessionId: matchingWatermark.sessionId,
              confidence: 0.95, // High confidence for exact match
              extractedAt: new Date()
            });
          }
        }
      }
      
      console.log(`Extracted ${extractedWatermarks.length} watermarks from leaked content`);
      return extractedWatermarks;
      
    } catch (error) {
      console.error('Watermark extraction failed:', error);
      return [];
    }
  }

  /**
   * Create forensic investigation for leaked content
   */
  async createForensicInvestigation(
    leakUrl: string,
    leakContent: Buffer
  ): Promise<ForensicInvestigation> {
    const investigationId = uuidv4();
    
    // Extract watermarks from leaked content
    const extractedWatermarks = await this.extractWatermark(leakContent);
    
    // Identify suspected users
    const suspectedUsers = extractedWatermarks.map(wm => wm.userId);
    
    // Generate evidence package
    const evidencePackage = await this.generateEvidencePackage(
      investigationId,
      leakUrl,
      extractedWatermarks
    );
    
    const investigation: ForensicInvestigation = {
      id: investigationId,
      leakUrl,
      extractedWatermarks,
      suspectedUsers,
      evidencePackage,
      status: extractedWatermarks.length > 0 ? 'analyzing' : 'inconclusive',
      createdAt: new Date()
    };
    
    this.investigationDatabase.set(investigationId, investigation);
    
    console.log(`Created forensic investigation ${investigationId} for leak: ${leakUrl}`);
    return investigation;
  }

  /**
   * Generate evidence package for legal proceedings
   */
  private async generateEvidencePackage(
    investigationId: string,
    leakUrl: string,
    watermarks: WatermarkExtractionResult[]
  ): Promise<string> {
    const evidence = {
      investigationId,
      leakUrl,
      extractedWatermarks: watermarks,
      extractionMethod: 'LSB Steganography Analysis',
      timestamp: new Date().toISOString(),
      forensicHash: createHash('sha256')
        .update(JSON.stringify(watermarks))
        .digest('hex')
    };
    
    // In production, this would generate a signed PDF with evidence
    return JSON.stringify(evidence, null, 2);
  }

  /**
   * Get forensic investigation by ID
   */
  async getInvestigation(investigationId: string): Promise<ForensicInvestigation | null> {
    return this.investigationDatabase.get(investigationId) || null;
  }

  /**
   * List investigations for a specific user
   */
  async getInvestigationsByUser(userId: string): Promise<ForensicInvestigation[]> {
    return Array.from(this.investigationDatabase.values())
      .filter(inv => inv.suspectedUsers.includes(userId));
  }

  /**
   * Get watermark statistics for monitoring
   */
  async getWatermarkStats(): Promise<{
    totalWatermarks: number;
    activeInvestigations: number;
    successfulExtractions: number;
  }> {
    const investigations = Array.from(this.investigationDatabase.values());
    
    return {
      totalWatermarks: this.watermarkDatabase.size,
      activeInvestigations: investigations.filter(inv => 
        inv.status === 'pending' || inv.status === 'analyzing'
      ).length,
      successfulExtractions: investigations.filter(inv => 
        inv.extractedWatermarks.length > 0
      ).length
    };
  }

  // Private helper methods
  private encodeWatermarkData(payload: any): string {
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  private decodeWatermarkData(watermarkData: string): any {
    try {
      return JSON.parse(Buffer.from(watermarkData, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }

  private generateExtractionKey(watermarkId: string, userId: string): string {
    return createHash('sha256')
      .update(`${watermarkId}:${userId}:forensic_key`)
      .digest('hex');
  }

  private findWatermarkByData(watermarkData: string): ForensicWatermark | null {
    for (const watermark of this.watermarkDatabase.values()) {
      if (watermark.watermarkData === watermarkData) {
        return watermark;
      }
    }
    return null;
  }
}

export const forensicWatermarkService = new ForensicWatermarkService();