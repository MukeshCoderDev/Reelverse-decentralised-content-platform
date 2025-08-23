-- Migration 007: Create normalized earnings ledger for video monetization
-- Supports tips, subscriptions, splits, referrals with proper USDC precision
-- Features idempotency, parent/child relationships, and error tracking

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Earnings ledger table with normalized financial fields
CREATE TABLE IF NOT EXISTS earnings_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- References users table
  gross_usdc NUMERIC(20,6) NOT NULL CHECK (gross_usdc >= 0), -- Total amount before fees
  fee_usdc NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK (fee_usdc >= 0), -- Platform/processing fees
  net_usdc NUMERIC(20,6) NOT NULL CHECK (net_usdc >= 0), -- Amount credited to user
  source VARCHAR(20) NOT NULL CHECK (source IN ('tip', 'subscription', 'ppv', 'split', 'referral', 'adshare')),
  parent_id UUID REFERENCES earnings_ledger(id), -- For linking split entries to parent transaction
  meta JSONB DEFAULT '{}', -- Additional context (video_id, transaction_id, etc.)
  error_code TEXT, -- Error code if transaction failed
  idempotency_key TEXT, -- For safe retries
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_user_id ON earnings_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_source ON earnings_ledger(source);
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_created_at ON earnings_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_parent_id ON earnings_ledger(parent_id);

-- Unique constraint for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_earnings_ledger_idempotency 
ON earnings_ledger(user_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Materialized view for fast balance lookups
CREATE MATERIALIZED VIEW IF NOT EXISTS user_balances AS
SELECT 
  user_id,
  SUM(net_usdc) as total_earned_usdc,
  SUM(CASE WHEN created_at >= CURRENT_DATE THEN net_usdc ELSE 0 END) as today_usdc,
  SUM(CASE WHEN created_at >= NOW() - INTERVAL '72 hours' THEN net_usdc ELSE 0 END) as pending_usdc,
  SUM(CASE WHEN created_at < NOW() - INTERVAL '72 hours' THEN net_usdc ELSE 0 END) as available_usdc,
  MAX(created_at) as last_earning_at
FROM earnings_ledger
WHERE error_code IS NULL -- Only successful transactions
GROUP BY user_id;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_balances_user_id ON user_balances(user_id);

-- Function to refresh balances (called by triggers)
CREATE OR REPLACE FUNCTION refresh_user_balance(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Use concurrent refresh for better performance
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_balances;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to regular refresh if concurrent fails
    REFRESH MATERIALIZED VIEW user_balances;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh balances on earnings changes
CREATE OR REPLACE FUNCTION trigger_refresh_user_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh balances for affected user(s)
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_user_balance(NEW.user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM refresh_user_balance(NEW.user_id);
    IF OLD.user_id != NEW.user_id THEN
      PERFORM refresh_user_balance(OLD.user_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM refresh_user_balance(OLD.user_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS earnings_ledger_balance_refresh ON earnings_ledger;
CREATE TRIGGER earnings_ledger_balance_refresh
  AFTER INSERT OR UPDATE OR DELETE ON earnings_ledger
  FOR EACH ROW EXECUTE FUNCTION trigger_refresh_user_balance();

-- Helper function to get user balance summary
CREATE OR REPLACE FUNCTION get_user_balance(target_user_id UUID)
RETURNS TABLE (
  total_earned_usdc NUMERIC(20,6),
  today_usdc NUMERIC(20,6),
  pending_usdc NUMERIC(20,6),
  available_usdc NUMERIC(20,6),
  last_earning_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ub.total_earned_usdc, 0),
    COALESCE(ub.today_usdc, 0),
    COALESCE(ub.pending_usdc, 0),
    COALESCE(ub.available_usdc, 0),
    ub.last_earning_at
  FROM user_balances ub
  WHERE ub.user_id = target_user_id;
  
  -- If no record exists, return zeros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      0::NUMERIC(20,6), 0::NUMERIC(20,6), 0::NUMERIC(20,6), 0::NUMERIC(20,6), NULL::TIMESTAMPTZ;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Initial refresh of materialized view
REFRESH MATERIALIZED VIEW user_balances;