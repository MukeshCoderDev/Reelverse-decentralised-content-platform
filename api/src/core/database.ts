/**
 * Database Connection and Migration Management
 * Supports PostgreSQL with PII redaction and connection pooling
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { createHash } from 'crypto';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
}

export class DatabaseManager {
  private pool: Pool;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    };

    this.pool = new Pool(poolConfig);
    
    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }

  /**
   * Execute query with PII redaction in logs
   */
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log query with redacted params
      console.log(`[DB] Query executed in ${duration}ms: ${this.redactQuery(text, params)}`);
      
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        command: result.command
      };
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`[DB] Query failed in ${duration}ms: ${this.redactQuery(text, params)}`, error);
      throw error;
    }
  }

  /**
   * Get pool status
   */
  getPoolStatus() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Redact sensitive data from query logs
   */
  private redactQuery(text: string, params?: any[]): string {
    let redactedText = text;
    let redactedParams = params ? [...params] : [];

    // Redact common PII patterns
    const piiPatterns = [
      /email\s*=\s*\$\d+/gi,
      /password\s*=\s*\$\d+/gi,
      /ssn\s*=\s*\$\d+/gi,
      /phone\s*=\s*\$\d+/gi,
      /address\s*=\s*\$\d+/gi,
      /credit_card\s*=\s*\$\d+/gi,
      /bank_account\s*=\s*\$\d+/gi
    ];

    for (const pattern of piiPatterns) {
      redactedText = redactedText.replace(pattern, (match) => {
        return match.replace(/\$\d+/, '[REDACTED]');
      });
    }

    // Redact parameter values that might contain PII
    if (redactedParams) {
      redactedParams = redactedParams.map((param, index) => {
        if (typeof param === 'string') {
          // Check if it looks like email, phone, etc.
          if (param.includes('@') || /^\d{10,}$/.test(param) || param.length > 50) {
            return '[REDACTED]';
          }
        }
        return param;
      });
    }

    return `${redactedText} | Params: ${JSON.stringify(redactedParams)}`;
  }
}

// Database configuration from environment
export function createDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'reelverse',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000')
  };
}

// Global database instance
export const db = new DatabaseManager(createDatabaseConfig());