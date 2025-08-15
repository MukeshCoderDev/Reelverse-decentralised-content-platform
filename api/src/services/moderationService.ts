import crypto from 'crypto';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';

export interface ModerationFlag {
  id: string;
  contentId: string;
  reporterWallet: string;
  reason: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  moderatorWallet?: string;
  decision?: 'approved' | 'rejected' | 'takedown';
  decisionReason?: string;
  evidenceUrls: string[];
  createdAt: Date;
  resolvedAt?: Date;
}

export interface DMCARequest {
  id: string;
  contentId: string;
  claimantName: string;
  claimantEmail: string;
  claimantAddress: string;
  copyrightedWork: string;
  infringingUrls: string[];
  perceptualHashMatches: string[];
  status: 'pending' | 'processing' | 'takedown' | 'counter_notice' | 'resolved';
  submittedAt: Date;
  processedAt?: Date;
  takedownAt?: Date;
}

export interface PerceptualHashMatch {
  originalHash: string;
  matchingHash: string;
  similarity: number;
  contentId: string;
  matchedContentId: string;
}

export interface ModerationDecision {
  contentId: string;
  moderatorWallet: string;
  decision: 'approved' | 'rejected' | 'takedown';
  reason: string;
  blockchainTxHash?: string;
  auditTrail: Array<{
    action: string;
    timestamp: Date;
    actor: string;
    details: any;
  }>;
}

export class ModerationService {
  /**
   * Flag content for moderation review
   */
  async flagContent(
    contentId: string,
    reporterWallet: string,
    reason: string,
    evidenceUrls: string[] = []
  ): Promise<ModerationFlag> {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      const flagId = crypto.randomUUID();
      
      // Insert moderation flag
      await client.query(`
        INSERT INTO moderation_queue (
          id, content_id, reporter_wallet, reason, status, evidence_urls, created_at
        ) VALUES ($1, $2, $3, $4, 'pending', $5, NOW())
      `, [flagId, contentId, reporterWallet, reason, evidenceUrls]);
      
      // Log audit trail
      await client.query(`
        INSERT INTO audit_logs (event_type, user_wallet, content_id, event_data)
        VALUES ('content_flagged', $1, $2, $3)
      `, [
        reporterWallet,
        contentId,
        JSON.stringify({
          flag_id: flagId,
          reason: reason,
          evidence_count: evidenceUrls.length
        })
      ]);
      
      await client.query('COMMIT');
      
      const flag: ModerationFlag = {
        id: flagId,
        contentId,
        reporterWallet,
        reason,
        status: 'pending',
        evidenceUrls,
        createdAt: new Date()
      };
      
      logger.info(`Content flagged: ${contentId} by ${reporterWallet}, reason: ${reason}`);
      return flag;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to flag content:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get moderation queue for review
   */
  async getModerationQueue(
    status?: string,
    moderatorWallet?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ModerationFlag[]> {
    const db = getDatabase();
    
    try {
      let query = `
        SELECT 
          id, content_id, reporter_wallet, reason, status,
          moderator_wallet, decision, decision_reason, evidence_urls,
          created_at, resolved_at
        FROM moderation_queue
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;
      
      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }
      
      if (moderatorWallet) {
        query += ` AND moderator_wallet = $${paramIndex}`;
        params.push(moderatorWallet);
        paramIndex++;
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
      
      const result = await db.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        contentId: row.content_id,
        reporterWallet: row.reporter_wallet,
        reason: row.reason,
        status: row.status,
        moderatorWallet: row.moderator_wallet,
        decision: row.decision,
        decisionReason: row.decision_reason,
        evidenceUrls: row.evidence_urls || [],
        createdAt: row.created_at,
        resolvedAt: row.resolved_at
      }));
    } catch (error) {
      logger.error('Failed to get moderation queue:', error);
      throw error;
    }
  }

  /**
   * Process moderation decision
   */
  async processModerationDecision(
    flagId: string,
    moderatorWallet: string,
    decision: 'approved' | 'rejected' | 'takedown',
    reason: string,
    blockchainTxHash?: string
  ): Promise<ModerationDecision> {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get the flag details
      const flagResult = await client.query(`
        SELECT content_id, reporter_wallet FROM moderation_queue WHERE id = $1
      `, [flagId]);
      
      if (flagResult.rows.length === 0) {
        throw new Error('Moderation flag not found');
      }
      
      const contentId = flagResult.rows[0].content_id;
      
      // Update moderation queue
      await client.query(`
        UPDATE moderation_queue
        SET status = 'resolved',
            moderator_wallet = $1,
            decision = $2,
            decision_reason = $3,
            resolved_at = NOW()
        WHERE id = $4
      `, [moderatorWallet, decision, reason, flagId]);
      
      // Create audit trail entry
      const auditEntry = {
        action: 'moderation_decision',
        timestamp: new Date(),
        actor: moderatorWallet,
        details: {
          flag_id: flagId,
          decision,
          reason,
          blockchain_tx: blockchainTxHash
        }
      };
      
      await client.query(`
        INSERT INTO audit_logs (event_type, user_wallet, content_id, event_data)
        VALUES ('moderation_decision', $1, $2, $3)
      `, [moderatorWallet, contentId, JSON.stringify(auditEntry.details)]);
      
      await client.query('COMMIT');
      
      const moderationDecision: ModerationDecision = {
        contentId,
        moderatorWallet,
        decision,
        reason,
        blockchainTxHash,
        auditTrail: [auditEntry]
      };
      
      logger.info(`Moderation decision: ${decision} for content ${contentId} by ${moderatorWallet}`);
      return moderationDecision;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to process moderation decision:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Compute perceptual hash for content (placeholder - would integrate with actual hashing service)
   */
  async computePerceptualHash(contentUrl: string): Promise<string> {
    // This is a placeholder implementation
    // In production, this would integrate with a video processing service
    // that extracts frames and computes perceptual hashes
    const hash = crypto.createHash('sha256');
    hash.update(contentUrl + Date.now().toString());
    return hash.digest('hex');
  }

  /**
   * Find similar content using perceptual hash matching
   */
  async findSimilarContent(
    perceptualHash: string,
    threshold: number = 0.85
  ): Promise<PerceptualHashMatch[]> {
    const db = getDatabase();
    
    try {
      // This is a simplified implementation
      // In production, you'd use specialized similarity search algorithms
      const result = await db.query(`
        SELECT 
          content_id,
          perceptual_hash,
          -- Simplified similarity calculation (would use proper distance metrics)
          CASE 
            WHEN perceptual_hash = $1 THEN 1.0
            ELSE 0.0
          END as similarity
        FROM content_metadata
        WHERE perceptual_hash IS NOT NULL
        AND content_id != (
          SELECT content_id FROM content_metadata WHERE perceptual_hash = $1 LIMIT 1
        )
      `, [perceptualHash]);
      
      return result.rows
        .filter(row => row.similarity >= threshold)
        .map(row => ({
          originalHash: perceptualHash,
          matchingHash: row.perceptual_hash,
          similarity: row.similarity,
          contentId: 'original', // Would be determined from input
          matchedContentId: row.content_id
        }));
    } catch (error) {
      logger.error('Failed to find similar content:', error);
      throw error;
    }
  }

  /**
   * Submit DMCA takedown request
   */
  async submitDMCARequest(
    contentId: string,
    claimantName: string,
    claimantEmail: string,
    claimantAddress: string,
    copyrightedWork: string,
    infringingUrls: string[]
  ): Promise<DMCARequest> {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      const requestId = crypto.randomUUID();
      
      // Get content perceptual hash for matching
      const contentResult = await db.query(`
        SELECT perceptual_hash FROM content_metadata WHERE content_id = $1
      `, [contentId]);
      
      let perceptualHashMatches: string[] = [];
      if (contentResult.rows.length > 0 && contentResult.rows[0].perceptual_hash) {
        const matches = await this.findSimilarContent(contentResult.rows[0].perceptual_hash);
        perceptualHashMatches = matches.map(m => m.matchedContentId);
      }
      
      // Insert DMCA request
      await client.query(`
        INSERT INTO dmca_requests (
          id, content_id, claimant_name, claimant_email, claimant_address,
          copyrighted_work, infringing_urls, perceptual_hash_matches,
          status, submitted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
      `, [
        requestId, contentId, claimantName, claimantEmail, claimantAddress,
        copyrightedWork, infringingUrls, perceptualHashMatches
      ]);
      
      // Log audit trail
      await client.query(`
        INSERT INTO audit_logs (event_type, content_id, event_data)
        VALUES ('dmca_request_submitted', $1, $2)
      `, [
        contentId,
        JSON.stringify({
          request_id: requestId,
          claimant: claimantName,
          matches_found: perceptualHashMatches.length
        })
      ]);
      
      await client.query('COMMIT');
      
      const dmcaRequest: DMCARequest = {
        id: requestId,
        contentId,
        claimantName,
        claimantEmail,
        claimantAddress,
        copyrightedWork,
        infringingUrls,
        perceptualHashMatches,
        status: 'pending',
        submittedAt: new Date()
      };
      
      logger.info(`DMCA request submitted: ${requestId} for content ${contentId}`);
      return dmcaRequest;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to submit DMCA request:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process DMCA takedown
   */
  async processDMCATakedown(
    requestId: string,
    moderatorWallet: string,
    approved: boolean,
    reason: string
  ): Promise<void> {
    const db = getDatabase();
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get DMCA request details
      const requestResult = await db.query(`
        SELECT content_id, perceptual_hash_matches FROM dmca_requests WHERE id = $1
      `, [requestId]);
      
      if (requestResult.rows.length === 0) {
        throw new Error('DMCA request not found');
      }
      
      const contentId = requestResult.rows[0].content_id;
      const matches = requestResult.rows[0].perceptual_hash_matches || [];
      
      if (approved) {
        // Update DMCA request status
        await client.query(`
          UPDATE dmca_requests
          SET status = 'takedown', processed_at = NOW(), takedown_at = NOW()
          WHERE id = $1
        `, [requestId]);
        
        // Flag main content for takedown
        await client.query(`
          INSERT INTO moderation_queue (
            id, content_id, reporter_wallet, reason, status, moderator_wallet,
            decision, decision_reason, created_at, resolved_at
          ) VALUES ($1, $2, 'system', 'DMCA Takedown', 'resolved', $3, 'takedown', $4, NOW(), NOW())
        `, [crypto.randomUUID(), contentId, moderatorWallet, `DMCA Request: ${requestId}`]);
        
        // Flag similar content based on perceptual hash matches
        for (const matchContentId of matches) {
          await client.query(`
            INSERT INTO moderation_queue (
              id, content_id, reporter_wallet, reason, status, moderator_wallet,
              decision, decision_reason, created_at, resolved_at
            ) VALUES ($1, $2, 'system', 'DMCA Hash Match', 'resolved', $3, 'takedown', $4, NOW(), NOW())
          `, [crypto.randomUUID(), matchContentId, moderatorWallet, `DMCA Match: ${requestId}`]);
        }
      } else {
        // Reject DMCA request
        await client.query(`
          UPDATE dmca_requests
          SET status = 'resolved', processed_at = NOW()
          WHERE id = $1
        `, [requestId]);
      }
      
      // Log audit trail
      await client.query(`
        INSERT INTO audit_logs (event_type, user_wallet, content_id, event_data)
        VALUES ('dmca_processed', $1, $2, $3)
      `, [
        moderatorWallet,
        contentId,
        JSON.stringify({
          request_id: requestId,
          approved,
          reason,
          matches_affected: matches.length
        })
      ]);
      
      await client.query('COMMIT');
      
      logger.info(`DMCA request ${approved ? 'approved' : 'rejected'}: ${requestId} by ${moderatorWallet}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to process DMCA takedown:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get moderation statistics
   */
  async getModerationStats(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    totalFlags: number;
    pendingFlags: number;
    resolvedFlags: number;
    takedownRate: number;
    dmcaRequests: number;
    averageResolutionTime: number;
  }> {
    const db = getDatabase();
    
    try {
      let timeCondition = '';
      switch (timeframe) {
        case 'day':
          timeCondition = "created_at >= NOW() - INTERVAL '1 day'";
          break;
        case 'week':
          timeCondition = "created_at >= NOW() - INTERVAL '1 week'";
          break;
        case 'month':
          timeCondition = "created_at >= NOW() - INTERVAL '1 month'";
          break;
      }
      
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total_flags,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_flags,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_flags,
          COUNT(CASE WHEN decision = 'takedown' THEN 1 END) as takedowns,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
        FROM moderation_queue
        WHERE ${timeCondition}
      `);
      
      const dmcaResult = await db.query(`
        SELECT COUNT(*) as dmca_count
        FROM dmca_requests
        WHERE ${timeCondition.replace('created_at', 'submitted_at')}
      `);
      
      const stats = statsResult.rows[0];
      const dmcaCount = dmcaResult.rows[0].dmca_count;
      
      return {
        totalFlags: parseInt(stats.total_flags),
        pendingFlags: parseInt(stats.pending_flags),
        resolvedFlags: parseInt(stats.resolved_flags),
        takedownRate: stats.resolved_flags > 0 ? stats.takedowns / stats.resolved_flags : 0,
        dmcaRequests: parseInt(dmcaCount),
        averageResolutionTime: parseFloat(stats.avg_resolution_hours) || 0
      };
    } catch (error) {
      logger.error('Failed to get moderation stats:', error);
      throw error;
    }
  }

  /**
   * Generate audit trail for content
   */
  async generateAuditTrail(contentId: string): Promise<Array<{
    timestamp: Date;
    action: string;
    actor: string;
    details: any;
  }>> {
    const db = getDatabase();
    
    try {
      const result = await db.query(`
        SELECT created_at, event_type, user_wallet, event_data
        FROM audit_logs
        WHERE content_id = $1
        ORDER BY created_at ASC
      `, [contentId]);
      
      return result.rows.map(row => ({
        timestamp: row.created_at,
        action: row.event_type,
        actor: row.user_wallet || 'system',
        details: row.event_data
      }));
    } catch (error) {
      logger.error('Failed to generate audit trail:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const moderationService = new ModerationService();