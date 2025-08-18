import { Pool } from 'pg';
import { getDatabase } from '../config/database';
import { RedisService } from '../config/redis';
import { logger } from '../utils/logger';
import { createHash, createHmac } from 'crypto';
import { eventBus, EventTypes } from './eventBus';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  eventType: string;
  payload?: any;
}

export class AuditService {
  private static instance: AuditService | null = null;
  private pool: Pool;

  private constructor() {
    this.pool = getDatabase();
  }

  static getInstance() {
    if (!AuditService.instance) AuditService.instance = new AuditService();
    return AuditService.instance;
  }

  async record(entry: AuditEntry) {
    try {
      // best-effort write to audit table if present
      await this.pool.query(`INSERT INTO audit_log(id, event_type, payload, created_at) VALUES($1,$2,$3, now())`, [entry.id, entry.eventType, entry.payload ? JSON.stringify(entry.payload) : null]);
    } catch (e) {
      logger.warn('Audit write failed', e as any);
    }
  }
}
