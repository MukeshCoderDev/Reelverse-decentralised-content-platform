/**
 * Database-based audit storage implementation
 * Stores audit events in PostgreSQL with proper indexing and querying
 */

import { AuditEvent, AuditQuery, AuditStorage } from '../AuditLogger';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export class DatabaseAuditStorage implements AuditStorage {
  private config: DatabaseConfig;
  private pool: any; // pg.Pool type

  constructor(config: DatabaseConfig)