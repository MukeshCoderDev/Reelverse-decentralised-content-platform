-- Migration 006: Resumable Uploads System
-- Creates upload_sessions and upload_metrics tables for YouTube/Google-style resumable uploads

-- Upload status enum type
CREATE TYPE upload_status AS ENUM (
  'uploading', 
  'uploaded', 
  'processing', 
  'playable', 
  'hd_ready', 
  'failed', 
  'aborted'
);

-- Main upload sessions table
CREATE TABLE upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(42) NOT NULL, -- Ethereum address or user identifier
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  total_bytes BIGINT NOT NULL,
  chunk_size INTEGER NOT NULL,
  storage_key TEXT NOT NULL, -- e.g., uploads/{userId}/{uuid}.bin
  storage_upload_id TEXT, -- S3/GCS multipart upload ID
  bytes_received BIGINT NOT NULL DEFAULT 0,
  parts JSONB DEFAULT '[]'::jsonb, -- Array of {partNumber, etag, size, uploadedAt}
  status upload_status DEFAULT 'uploading',
  idempotency_key TEXT, -- Client-provided idempotency key
  error_code TEXT, -- Error code if failed
  cid TEXT, -- IPFS CID after pinning
  pin_status TEXT, -- IPFS pin status: 'pending', 'pinned', 'failed'
  playback_url TEXT, -- HLS playlist URL when available
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'), -- TTL for cleanup
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT bytes_received_valid CHECK (bytes_received >= 0 AND bytes_received <= total_bytes),
  CONSTRAINT chunk_size_valid CHECK (chunk_size >= 1048576), -- Min 1MB
  CONSTRAINT total_bytes_valid CHECK (total_bytes > 0 AND total_bytes <= 137438953472) -- Max 128GB
);

-- Unique constraint for idempotency (partial unique index)
CREATE UNIQUE INDEX idx_upload_sessions_user_idempotency 
  ON upload_sessions(user_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Performance indexes
CREATE INDEX idx_upload_sessions_user_status ON upload_sessions(user_id, status);
CREATE INDEX idx_upload_sessions_expires ON upload_sessions(expires_at) WHERE status = 'uploading';
CREATE INDEX idx_upload_sessions_created ON upload_sessions(created_at);
CREATE INDEX idx_upload_sessions_status_updated ON upload_sessions(status, updated_at);
CREATE INDEX idx_upload_sessions_storage_key ON upload_sessions(storage_key);

-- Upload metrics table for monitoring and analytics
CREATE TABLE upload_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES upload_sessions(id) ON DELETE CASCADE,
  user_id VARCHAR(42) NOT NULL,
  event_type TEXT NOT NULL, -- 'session_created', 'chunk_uploaded', 'upload_completed', etc.
  chunk_number INTEGER, -- Part number for chunk events
  chunk_size_bytes INTEGER, -- Size of the chunk
  processing_time_ms INTEGER, -- Time taken to process the event
  error_code TEXT, -- Error code if applicable
  client_ip INET, -- Client IP address
  user_agent TEXT, -- Client user agent
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for upload metrics
CREATE INDEX idx_upload_metrics_upload_id ON upload_metrics(upload_id);
CREATE INDEX idx_upload_metrics_event_type ON upload_metrics(event_type, created_at);
CREATE INDEX idx_upload_metrics_user_id ON upload_metrics(user_id, created_at);

-- Update trigger for upload_sessions.updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_upload_sessions_updated_at 
  BEFORE UPDATE ON upload_sessions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Content drafts table for metadata editing during upload
CREATE TABLE content_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES upload_sessions(id) ON DELETE CASCADE,
  user_id VARCHAR(42) NOT NULL,
  title TEXT,
  description TEXT,
  tags TEXT[], -- Array of tags
  visibility TEXT DEFAULT 'public', -- 'public', 'private', 'unlisted'
  category TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for content drafts
CREATE INDEX idx_content_drafts_upload_id ON content_drafts(upload_id);
CREATE INDEX idx_content_drafts_user_id ON content_drafts(user_id);

-- Update trigger for content_drafts.updated_at
CREATE TRIGGER update_content_drafts_updated_at 
  BEFORE UPDATE ON content_drafts 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE upload_sessions IS 'Stores resumable upload session state with Google 308 semantics';
COMMENT ON COLUMN upload_sessions.parts IS 'JSON array of multipart upload parts: [{partNumber, etag, size, uploadedAt}]';
COMMENT ON COLUMN upload_sessions.idempotency_key IS 'Client-provided idempotency key for duplicate request handling';
COMMENT ON COLUMN upload_sessions.storage_key IS 'Cloud storage key path for the uploaded file';
COMMENT ON COLUMN upload_sessions.storage_upload_id IS 'Cloud storage multipart upload identifier';

COMMENT ON TABLE upload_metrics IS 'Tracks upload events and performance metrics for monitoring';
COMMENT ON TABLE content_drafts IS 'Stores editable content metadata during upload process';