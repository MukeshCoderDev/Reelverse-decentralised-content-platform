import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

let pool: Pool;

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'reelverse_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

export async function connectDatabase(): Promise<Pool> {
  try {
    pool = new Pool(dbConfig);
    
    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info('Database connection established successfully');
    return pool;
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

export function getDatabase(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
}

// Database schema initialization
export async function initializeSchema(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Users table for off-chain data
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        wallet_address VARCHAR(42) PRIMARY KEY,
        age_verified BOOLEAN DEFAULT FALSE,
        talent_verified BOOLEAN DEFAULT FALSE,
        kyc_provider VARCHAR(50),
        kyc_reference VARCHAR(100),
        geo_country VARCHAR(2),
        created_at TIMESTAMP DEFAULT NOW(),
        last_active TIMESTAMP DEFAULT NOW(),
        profile_data JSONB DEFAULT '{}'::jsonb
      )
    `);
    
    // Content sessions for audit trail
    await client.query(`
      CREATE TABLE IF NOT EXISTS content_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content_id BIGINT NOT NULL,
        user_wallet VARCHAR(42) NOT NULL,
        session_id VARCHAR(64) NOT NULL UNIQUE,
        watermark_id VARCHAR(64) NOT NULL,
        playback_token VARCHAR(500) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        started_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP,
        bytes_streamed BIGINT DEFAULT 0,
        quality_levels TEXT[] DEFAULT ARRAY[]::TEXT[]
      )
    `);
    
    // Moderation queue
    await client.query(`
      CREATE TABLE IF NOT EXISTS moderation_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content_id BIGINT NOT NULL,
        reporter_wallet VARCHAR(42),
        reason VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        moderator_wallet VARCHAR(42),
        decision VARCHAR(20),
        decision_reason TEXT,
        evidence_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP
      )
    `);
    
    // DMCA requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS dmca_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content_id BIGINT NOT NULL,
        claimant_name VARCHAR(200) NOT NULL,
        claimant_email VARCHAR(200) NOT NULL,
        claimant_address TEXT,
        copyrighted_work TEXT NOT NULL,
        infringing_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
        perceptual_hash_matches TEXT[] DEFAULT ARRAY[]::TEXT[],
        status VARCHAR(20) DEFAULT 'pending',
        submitted_at TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP,
        takedown_at TIMESTAMP
      )
    `);
    
    // Content metadata for perceptual hashing
    await client.query(`
      CREATE TABLE IF NOT EXISTS content_metadata (
        content_id BIGINT PRIMARY KEY,
        title VARCHAR(500),
        description TEXT,
        creator_wallet VARCHAR(42),
        perceptual_hash VARCHAR(64),
        file_hash VARCHAR(64),
        duration_seconds INTEGER,
        resolution VARCHAR(20),
        file_size_bytes BIGINT,
        upload_date TIMESTAMP DEFAULT NOW(),
        last_accessed TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Creator earnings tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS creator_earnings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_wallet VARCHAR(42) NOT NULL,
        amount DECIMAL(20,6) NOT NULL,
        currency VARCHAR(10) NOT NULL, -- 'USDC', 'USD'
        source VARCHAR(50) NOT NULL, -- 'content_sale', 'subscription', 'tip'
        source_id VARCHAR(100), -- Reference to content/subscription/etc
        status VARCHAR(20) DEFAULT 'available', -- 'available', 'pending', 'paid_out'
        earned_at TIMESTAMP DEFAULT NOW(),
        paid_out_at TIMESTAMP
      )
    `);
    
    // Payout methods
    await client.query(`
      CREATE TABLE IF NOT EXISTS payout_methods (
        id VARCHAR(100) PRIMARY KEY,
        creator_wallet VARCHAR(42) NOT NULL,
        type VARCHAR(20) NOT NULL, -- 'usdc', 'paxum', 'bank_transfer'
        details JSONB NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Payout requests
    await client.query(`
      CREATE TABLE IF NOT EXISTS payout_requests (
        id VARCHAR(100) PRIMARY KEY,
        creator_wallet VARCHAR(42) NOT NULL,
        amount DECIMAL(20,6) NOT NULL,
        currency VARCHAR(10) NOT NULL, -- 'USDC', 'USD'
        payout_method_id VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
        transaction_hash VARCHAR(66),
        paxum_transaction_id VARCHAR(100),
        failure_reason TEXT,
        requested_at TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);
    
    // Upload tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS upload_tracking (
        provisional_id BIGINT PRIMARY KEY,
        creator_wallet VARCHAR(42) NOT NULL,
        temp_uri TEXT NOT NULL,
        storage_class SMALLINT NOT NULL,
        status VARCHAR(20) DEFAULT 'requested',
        processing_stage VARCHAR(50),
        progress_percentage SMALLINT DEFAULT 0,
        error_message TEXT,
        worker_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Payment tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content_id BIGINT,
        user_wallet VARCHAR(42) NOT NULL,
        payment_method VARCHAR(20) NOT NULL, -- 'usdc', 'ccbill', 'segpay'
        amount_usd DECIMAL(10,2) NOT NULL,
        amount_crypto DECIMAL(20,6),
        provider_reference VARCHAR(200),
        transaction_hash VARCHAR(66),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);
    
    // Age verification tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS age_verification_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_wallet VARCHAR(42) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        provider_reference VARCHAR(200),
        status VARCHAR(20) DEFAULT 'pending',
        verification_data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);
    
    // Feature flags
    await client.query(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        flag_name VARCHAR(100) PRIMARY KEY,
        enabled BOOLEAN DEFAULT FALSE,
        config JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by VARCHAR(42)
      )
    `);
    
    // Audit logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(50) NOT NULL,
        user_wallet VARCHAR(42),
        content_id BIGINT,
        event_data JSONB NOT NULL,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Scene Consent Management Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS scenes (
        scene_hash VARCHAR(66) PRIMARY KEY,
        content_title VARCHAR(500) NOT NULL,
        content_description TEXT,
        creator_wallet VARCHAR(42) NOT NULL,
        total_participants INTEGER NOT NULL DEFAULT 0,
        consented_participants INTEGER NOT NULL DEFAULT 0,
        consent_complete BOOLEAN NOT NULL DEFAULT FALSE,
        terms_version VARCHAR(20) NOT NULL DEFAULT '1.0',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS scene_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scene_hash VARCHAR(66) NOT NULL REFERENCES scenes(scene_hash) ON DELETE CASCADE,
        participant_wallet VARCHAR(42) NOT NULL,
        participant_role VARCHAR(20) NOT NULL CHECK (participant_role IN ('performer', 'director', 'producer')),
        consent_required BOOLEAN NOT NULL DEFAULT TRUE,
        consent_provided BOOLEAN NOT NULL DEFAULT FALSE,
        consent_timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(scene_hash, participant_wallet)
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS consent_signatures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scene_hash VARCHAR(66) NOT NULL,
        participant_wallet VARCHAR(42) NOT NULL,
        signature_data TEXT NOT NULL,
        encrypted_consent_data TEXT NOT NULL,
        consent_date TIMESTAMP NOT NULL,
        terms_version VARCHAR(20) NOT NULL,
        document_hashes TEXT[] DEFAULT ARRAY[]::TEXT[],
        verification_status VARCHAR(20) NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'revoked', 'disputed')),
        created_at TIMESTAMP DEFAULT NOW(),
        revoked_at TIMESTAMP,
        revocation_reason TEXT,
        UNIQUE(scene_hash, participant_wallet)
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS consent_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scene_hash VARCHAR(66) NOT NULL,
        participant_wallet VARCHAR(42),
        action VARCHAR(50) NOT NULL,
        actor_wallet VARCHAR(42),
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_content_sessions_content ON content_sessions(content_id);
      CREATE INDEX IF NOT EXISTS idx_content_sessions_user ON content_sessions(user_wallet);
      CREATE INDEX IF NOT EXISTS idx_content_sessions_session ON content_sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON moderation_queue(status);
      CREATE INDEX IF NOT EXISTS idx_moderation_queue_moderator ON moderation_queue(moderator_wallet);
      CREATE INDEX IF NOT EXISTS idx_moderation_queue_content ON moderation_queue(content_id);
      CREATE INDEX IF NOT EXISTS idx_dmca_requests_status ON dmca_requests(status);
      CREATE INDEX IF NOT EXISTS idx_dmca_requests_content ON dmca_requests(content_id);
      CREATE INDEX IF NOT EXISTS idx_content_metadata_hash ON content_metadata(perceptual_hash);
      CREATE INDEX IF NOT EXISTS idx_content_metadata_creator ON content_metadata(creator_wallet);
      CREATE INDEX IF NOT EXISTS idx_creator_earnings_wallet ON creator_earnings(creator_wallet);
      CREATE INDEX IF NOT EXISTS idx_creator_earnings_status ON creator_earnings(status);
      CREATE INDEX IF NOT EXISTS idx_creator_earnings_currency ON creator_earnings(currency);
      CREATE INDEX IF NOT EXISTS idx_payout_methods_creator ON payout_methods(creator_wallet);
      CREATE INDEX IF NOT EXISTS idx_payout_methods_default ON payout_methods(creator_wallet, is_default);
      CREATE INDEX IF NOT EXISTS idx_payout_requests_creator ON payout_requests(creator_wallet);
      CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
      CREATE INDEX IF NOT EXISTS idx_upload_tracking_creator ON upload_tracking(creator_wallet);
      CREATE INDEX IF NOT EXISTS idx_upload_tracking_status ON upload_tracking(status);
      CREATE INDEX IF NOT EXISTS idx_payment_tracking_user ON payment_tracking(user_wallet);
      CREATE INDEX IF NOT EXISTS idx_payment_tracking_status ON payment_tracking(status);
      CREATE INDEX IF NOT EXISTS idx_age_verification_user ON age_verification_tracking(user_wallet);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_wallet);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_scenes_creator ON scenes(creator_wallet);
      CREATE INDEX IF NOT EXISTS idx_scenes_created_at ON scenes(created_at);
      CREATE INDEX IF NOT EXISTS idx_scene_participants_scene ON scene_participants(scene_hash);
      CREATE INDEX IF NOT EXISTS idx_scene_participants_wallet ON scene_participants(participant_wallet);
      CREATE INDEX IF NOT EXISTS idx_consent_signatures_scene ON consent_signatures(scene_hash);
      CREATE INDEX IF NOT EXISTS idx_consent_signatures_participant ON consent_signatures(participant_wallet);
      CREATE INDEX IF NOT EXISTS idx_consent_signatures_status ON consent_signatures(verification_status);
      CREATE INDEX IF NOT EXISTS idx_consent_audit_scene ON consent_audit_log(scene_hash);
      CREATE INDEX IF NOT EXISTS idx_consent_audit_timestamp ON consent_audit_log(timestamp);
    `);
    
    await client.query('COMMIT');
    logger.info('Database schema initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to initialize database schema:', error);
    throw error;
  } finally {
    client.release();
  }
}