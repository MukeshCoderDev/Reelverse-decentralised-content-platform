CREATE TABLE IF NOT EXISTS session_keys (
    id SERIAL PRIMARY KEY,
    smart_account_id INTEGER NOT NULL REFERENCES smart_accounts(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL UNIQUE,
    encrypted_private_key TEXT NOT NULL,
    scope JSONB NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_keys_smart_account_id ON session_keys(smart_account_id);
CREATE INDEX IF NOT EXISTS idx_session_keys_public_key ON session_keys(public_key);
CREATE INDEX IF NOT EXISTS idx_session_keys_expires_at ON session_keys(expires_at);