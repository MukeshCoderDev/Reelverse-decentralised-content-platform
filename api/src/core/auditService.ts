import { Pool } from 'pg';
import { getDatabase } from '../config/database';
import { RedisService } from '../config/redis';
import { logger } from '../utils/logger';
import { createHash, createHmac } from 'crypto';
import { eventBus, EventTypes } from './eventBus';

export interface AuditEntry {
  id: string;
  timestamp: Date;
 