-- Add status and expires_at default behavior to idempotency_keys

ALTER TABLE IF EXISTS idempotency_keys
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'inflight',
  ADD COLUMN IF NOT EXISTS response_json JSONB;

-- Ensure created_at exists
ALTER TABLE IF EXISTS idempotency_keys
  ALTER COLUMN created_at SET DEFAULT now();

-- Add expires_at column if missing (used for TTL semantics)
ALTER TABLE IF EXISTS idempotency_keys
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add an index to query by expires_at for efficient expiry sweeps
CREATE INDEX IF NOT EXISTS idx_idemp_expires_at ON idempotency_keys(expires_at);

-- Note: PostgreSQL does not support automatic TTL deletes; this index allows a background job
-- or cron to efficiently delete expired rows: DELETE FROM idempotency_keys WHERE expires_at < now();
