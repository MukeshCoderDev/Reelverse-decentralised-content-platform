-- Create credits accounts, transactions, holds, and idempotency keys

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS credit_accounts (
  org_id TEXT PRIMARY KEY,
  balance_cents BIGINT NOT NULL DEFAULT 0,
  daily_gas_cap_cents BIGINT NOT NULL DEFAULT 0,
  daily_gas_spend_cents BIGINT NOT NULL DEFAULT 0,
  spend_window_start TIMESTAMPTZ NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL REFERENCES credit_accounts(org_id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- issue|debit|refund|hold|release|chargeback
  amount_cents BIGINT NOT NULL,
  reason TEXT,
  ref_type TEXT,
  ref_id TEXT,
  provider TEXT,
  provider_ref TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_provider_ref ON credit_transactions(provider, provider_ref) WHERE provider IS NOT NULL AND provider_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_idempotency_key ON credit_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS credit_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL REFERENCES credit_accounts(org_id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  method TEXT,
  params_hash TEXT,
  est_gas_wei NUMERIC,
  max_fee_per_gwei NUMERIC,
  max_priority_fee_gwei NUMERIC,
  fx_snapshot JSONB,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active', -- active|captured|released|expired
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_holds_org ON credit_holds(org_id);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  org_id TEXT,
  body_hash TEXT,
  response_json JSONB,
  status_code INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_idemp_org ON idempotency_keys(org_id);
