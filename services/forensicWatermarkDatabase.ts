import { Pool } from 'pg';
import { ForensicWatermark, ForensicInvestigation, WatermarkExtractionResult } from './forensicWatermarkService';

export class ForensicWatermarkDatabase {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Initialize forensic watermark database tables
   */
  async initializeTables(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Forensic watermarks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS forensic_watermarks (
          id UUID PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          session_id VARCHAR(255) NOT NULL,
          content_id VARCHAR(255) NOT NULL,
          watermark_data TEXT NOT NULL,
          extraction_key VARCHAR(512) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          INDEX (user_id),
          INDEX (content_id),
          INDEX (session_id)
        )
      `);

      // Forensic investigations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS forensic_investigations (
          id UUID PRIMARY KEY,
          leak_url TEXT NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          evidence_package TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Watermark extractions table (many-to-many with investigations)
      await client.query(`
        CREATE TABLE IF NOT EXISTS watermark_extractions (
          id UUID PRIMARY KEY,
          investigation_id UUID REFERENCES forensic_investigations(id) ON DELETE CASCADE,
          watermark_id UUID REFERENCES forensic_watermarks(id) ON DELETE CASCADE,
          user_id VARCHAR(255) NOT NULL,
          session_id VARCHAR(255) NOT NULL,
          confidence DECIMAL(3,2) NOT NULL,
          extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          INDEX (investigation_id),
          INDEX (watermark_id),
          INDEX (user_id)
        )
      `);

      // Suspected users table (for investigations)
      await client.query(`
        CREATE TABLE IF NOT EXISTS investigation_suspects (
          investigation_id UUID REFERENCES forensic_investigations(id) ON DELETE CASCADE,
          user_id VARCHAR(255) NOT NULL,
          confidence_score DECIMAL(3,2) NOT NULL,
          PRIMARY KEY (investigation_id, user_id)
        )
      `);

      console.log('Forensic watermark database tables initialized');
      
    } finally {
      client.release();
    }
  }

  /**
   * Store forensic watermark in database
   */
  async storeWatermark(watermark: ForensicWatermark): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO forensic_watermarks (
          id, user_id, session_id, content_id, watermark_data, extraction_key, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        watermark.id,
        watermark.userId,
        watermark.sessionId,
        watermark.contentId,
        watermark.watermarkData,
        watermark.extractionKey,
        watermark.timestamp
      ]);
      
      console.log(`Stored forensic watermark ${watermark.id} in database`);
      
    } finally {
      client.release();
    }
  }

  /**
   * Find watermark by watermark data
   */
  async findWatermarkByData(watermarkData: string): Promise<ForensicWatermark | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM forensic_watermarks 
        WHERE watermark_data = $1
        LIMIT 1
      `, [watermarkData]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        sessionId: row.session_id,
        contentId: row.content_id,
        watermarkData: row.watermark_data,
        extractionKey: row.extraction_key,
        timestamp: row.created_at
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Store forensic investigation in database
   */
  async storeInvestigation(investigation: ForensicInvestigation): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.begin();
      
      // Insert investigation
      await client.query(`
        INSERT INTO forensic_investigations (
          id, leak_url, status, evidence_package, created_at
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        investigation.id,
        investigation.leakUrl,
        investigation.status,
        investigation.evidencePackage,
        investigation.createdAt
      ]);
      
      // Insert watermark extractions
      for (const extraction of investigation.extractedWatermarks) {
        await client.query(`
          INSERT INTO watermark_extractions (
            id, investigation_id, watermark_id, user_id, session_id, confidence, extracted_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          `extraction_${investigation.id}_${extraction.watermarkId}`,
          investigation.id,
          extraction.watermarkId,
          extraction.userId,
          extraction.sessionId,
          extraction.confidence,
          extraction.extractedAt
        ]);
      }
      
      // Insert suspected users
      for (const userId of investigation.suspectedUsers) {
        const confidence = investigation.extractedWatermarks
          .filter(wm => wm.userId === userId)
          .reduce((max, wm) => Math.max(max, wm.confidence), 0);
          
        await client.query(`
          INSERT INTO investigation_suspects (investigation_id, user_id, confidence_score)
          VALUES ($1, $2, $3)
          ON CONFLICT (investigation_id, user_id) 
          DO UPDATE SET confidence_score = GREATEST(investigation_suspects.confidence_score, $3)
        `, [investigation.id, userId, confidence]);
      }
      
      await client.commit();
      console.log(`Stored forensic investigation ${investigation.id} in database`);
      
    } catch (error) {
      await client.rollback();
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get investigation by ID
   */
  async getInvestigation(investigationId: string): Promise<ForensicInvestigation | null> {
    const client = await this.pool.connect();
    
    try {
      // Get investigation details
      const invResult = await client.query(`
        SELECT * FROM forensic_investigations WHERE id = $1
      `, [investigationId]);
      
      if (invResult.rows.length === 0) {
        return null;
      }
      
      const invRow = invResult.rows[0];
      
      // Get extracted watermarks
      const extractionsResult = await client.query(`
        SELECT * FROM watermark_extractions WHERE investigation_id = $1
      `, [investigationId]);
      
      const extractedWatermarks: WatermarkExtractionResult[] = extractionsResult.rows.map(row => ({
        watermarkId: row.watermark_id,
        userId: row.user_id,
        sessionId: row.session_id,
        confidence: parseFloat(row.confidence),
        extractedAt: row.extracted_at
      }));
      
      // Get suspected users
      const suspectsResult = await client.query(`
        SELECT user_id FROM investigation_suspects WHERE investigation_id = $1
      `, [investigationId]);
      
      const suspectedUsers = suspectsResult.rows.map(row => row.user_id);
      
      return {
        id: invRow.id,
        leakUrl: invRow.leak_url,
        extractedWatermarks,
        suspectedUsers,
        evidencePackage: invRow.evidence_package,
        status: invRow.status,
        createdAt: invRow.created_at
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * List investigations for a user
   */
  async getInvestigationsByUser(userId: string): Promise<ForensicInvestigation[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT DISTINCT fi.* 
        FROM forensic_investigations fi
        JOIN investigation_suspects s ON fi.id = s.investigation_id
        WHERE s.user_id = $1
        ORDER BY fi.created_at DESC
      `, [userId]);
      
      const investigations: ForensicInvestigation[] = [];
      
      for (const row of result.rows) {
        const investigation = await this.getInvestigation(row.id);
        if (investigation) {
          investigations.push(investigation);
        }
      }
      
      return investigations;
      
    } finally {
      client.release();
    }
  }

  /**
   * Get watermark statistics
   */
  async getWatermarkStats(): Promise<{
    totalWatermarks: number;
    activeInvestigations: number;
    successfulExtractions: number;
    topSuspectedUsers: Array<{userId: string; investigationCount: number}>;
  }> {
    const client = await this.pool.connect();
    
    try {
      // Total watermarks
      const watermarksResult = await client.query(`
        SELECT COUNT(*) as count FROM forensic_watermarks
      `);
      
      // Active investigations
      const activeResult = await client.query(`
        SELECT COUNT(*) as count FROM forensic_investigations 
        WHERE status IN ('pending', 'analyzing')
      `);
      
      // Successful extractions
      const extractionsResult = await client.query(`
        SELECT COUNT(*) as count FROM forensic_investigations 
        WHERE status = 'completed'
      `);
      
      // Top suspected users
      const topUsersResult = await client.query(`
        SELECT user_id, COUNT(*) as investigation_count
        FROM investigation_suspects
        GROUP BY user_id
        ORDER BY investigation_count DESC
        LIMIT 10
      `);
      
      return {
        totalWatermarks: parseInt(watermarksResult.rows[0].count),
        activeInvestigations: parseInt(activeResult.rows[0].count),
        successfulExtractions: parseInt(extractionsResult.rows[0].count),
        topSuspectedUsers: topUsersResult.rows.map(row => ({
          userId: row.user_id,
          investigationCount: parseInt(row.investigation_count)
        }))
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Update investigation status
   */
  async updateInvestigationStatus(
    investigationId: string, 
    status: ForensicInvestigation['status']
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        UPDATE forensic_investigations 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `, [status, investigationId]);
      
      console.log(`Updated investigation ${investigationId} status to ${status}`);
      
    } finally {
      client.release();
    }
  }

  /**
   * Get watermarks for content
   */
  async getWatermarksForContent(contentId: string): Promise<ForensicWatermark[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM forensic_watermarks 
        WHERE content_id = $1
        ORDER BY created_at DESC
      `, [contentId]);
      
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        sessionId: row.session_id,
        contentId: row.content_id,
        watermarkData: row.watermark_data,
        extractionKey: row.extraction_key,
        timestamp: row.created_at
      }));
      
    } finally {
      client.release();
    }
  }
}

export const forensicWatermarkDatabase = new ForensicWatermarkDatabase(
  new Pool({
    connectionString: process.env.DATABASE_URL
  })
);