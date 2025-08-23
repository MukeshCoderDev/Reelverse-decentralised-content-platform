-- Migration 010: Create referral system with fraud protection
-- Supports referral code generation, attribution tracking, and revenue sharing
-- Features device fingerprinting, IP reputation, and lifetime caps

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Referral codes table - creator-generated codes for attribution
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL, -- References users table
  code VARCHAR(20) NOT NULL UNIQUE CHECK (LENGTH(code) BETWEEN 6 AND 20),
  reward_bps INTEGER NOT NULL DEFAULT 1000 CHECK (reward_bps BETWEEN 0 AND 1000), -- Basis points (10% = 1000)
  active BOOLEAN NOT NULL DEFAULT TRUE,
  max_uses INTEGER, -- Optional usage limit
  current_uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ, -- Optional expiration
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure code uniqueness (case insensitive)
  CONSTRAINT referral_codes_code_unique UNIQUE (LOWER(code))
);

-- Referrals table - tracks referred users and their earnings attribution  
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL, -- The creator who owns the referral code
  referred_user_id UUID NOT NULL, -- The user who used the referral code
  
  -- Attribution window
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '180 days'),
  
  -- Revenue tracking
  total_attributed_usdc NUMERIC(20,6) NOT NULL DEFAULT 0,
  total_referrer_earnings_usdc NUMERIC(20,6) NOT NULL DEFAULT 0,
  
  -- Status and fraud protection
  status VARCHAR(15) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended')),
  
  -- Fraud protection fields
  signup_ip INET,
  signup_user_agent TEXT,
  device_fingerprint TEXT,
  country_code VARCHAR(2),
  risk_score INTEGER DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  verified_at TIMESTAMPTZ,
  
  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(referral_code_id, referred_user_id), -- One referral per code per user
  UNIQUE(referred_user_id) -- One referral per user total (across all codes)
);

-- Referral earnings table - tracks individual earnings from referrals
CREATE TABLE IF NOT EXISTS referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  earnings_ledger_id UUID NOT NULL REFERENCES earnings_ledger(id) ON DELETE CASCADE,
  
  -- Transaction details
  source_transaction_usdc NUMERIC(20,6) NOT NULL CHECK (source_transaction_usdc > 0),
  referral_percentage NUMERIC(5,2) NOT NULL CHECK (referral_percentage > 0),
  referral_earnings_usdc NUMERIC(20,6) NOT NULL CHECK (referral_earnings_usdc > 0),
  
  -- Metadata
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('tip', 'subscription')),
  video_id UUID, -- If applicable
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one referral earning per ledger entry
  UNIQUE(earnings_ledger_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_codes_creator ON referral_codes(creator_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON referral_codes(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_referral_codes_code_lower ON referral_codes(LOWER(code));

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_expires_at ON referrals(expires_at);
CREATE INDEX IF NOT EXISTS idx_referrals_active ON referrals(status, expires_at) 
  WHERE status = 'active' AND expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_referral_earnings_referral ON referral_earnings(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_ledger ON referral_earnings(earnings_ledger_id);

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(p_creator_id UUID, p_prefix TEXT DEFAULT '')
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_attempts INTEGER := 0;
  v_max_attempts INTEGER := 10;
BEGIN
  -- Generate unique code with optional prefix
  LOOP
    -- Create 8-character alphanumeric code
    v_code := p_prefix || UPPER(
      encode(
        digest(p_creator_id::TEXT || random()::TEXT || clock_timestamp()::TEXT, 'sha256'),
        'hex'
      )
    );
    v_code := LEFT(v_code, 12); -- Limit total length
    
    -- Check uniqueness
    IF NOT EXISTS(SELECT 1 FROM referral_codes WHERE LOWER(code) = LOWER(v_code)) THEN
      RETURN v_code;
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique referral code after % attempts', v_max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create referral code
CREATE OR REPLACE FUNCTION create_referral_code(
  p_creator_id UUID,
  p_reward_bps INTEGER DEFAULT 1000,
  p_custom_code TEXT DEFAULT NULL,
  p_max_uses INTEGER DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_code TEXT;
  v_referral_code_id UUID;
BEGIN
  -- Use custom code or generate one
  IF p_custom_code IS NOT NULL THEN
    -- Validate custom code
    IF LENGTH(p_custom_code) < 6 OR LENGTH(p_custom_code) > 20 THEN
      RAISE EXCEPTION 'Custom referral code must be 6-20 characters';
    END IF;
    
    IF EXISTS(SELECT 1 FROM referral_codes WHERE LOWER(code) = LOWER(p_custom_code)) THEN
      RAISE EXCEPTION 'Referral code already exists: %', p_custom_code;
    END IF;
    
    v_code := UPPER(p_custom_code);
  ELSE
    v_code := generate_referral_code(p_creator_id);
  END IF;
  
  -- Create referral code
  INSERT INTO referral_codes (
    creator_id, code, reward_bps, max_uses, expires_at
  ) VALUES (
    p_creator_id, v_code, p_reward_bps, p_max_uses, p_expires_at
  ) RETURNING id INTO v_referral_code_id;
  
  RETURN v_referral_code_id;
END;
$$ LANGUAGE plpgsql;

-- Function to claim referral code
CREATE OR REPLACE FUNCTION claim_referral_code(
  p_code TEXT,
  p_referred_user_id UUID,
  p_signup_ip INET DEFAULT NULL,
  p_signup_user_agent TEXT DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_referral_code_id UUID;
  v_referrer_user_id UUID;
  v_reward_bps INTEGER;
  v_referral_id UUID;
  v_risk_score INTEGER := 0;
BEGIN
  -- Look up referral code
  SELECT id, creator_id, reward_bps
  INTO v_referral_code_id, v_referrer_user_id, v_reward_bps
  FROM referral_codes 
  WHERE LOWER(code) = LOWER(p_code) 
    AND active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR current_uses < max_uses);
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referral code not found or inactive: %', p_code;
  END IF;
  
  -- Prevent self-referral
  IF v_referrer_user_id = p_referred_user_id THEN
    RAISE EXCEPTION 'Cannot refer yourself';
  END IF;
  
  -- Check if user already has a referral
  IF EXISTS(SELECT 1 FROM referrals WHERE referred_user_id = p_referred_user_id) THEN
    RAISE EXCEPTION 'User already has an active referral';
  END IF;
  
  -- Calculate risk score (simplified fraud detection)
  IF p_signup_ip IS NOT NULL THEN
    -- Check for suspicious IP patterns
    IF EXISTS(
      SELECT 1 FROM referrals 
      WHERE signup_ip = p_signup_ip 
      AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY signup_ip
      HAVING COUNT(*) > 5
    ) THEN
      v_risk_score := v_risk_score + 30;
    END IF;
  END IF;
  
  IF p_device_fingerprint IS NOT NULL THEN
    -- Check for device fingerprint reuse
    IF EXISTS(
      SELECT 1 FROM referrals 
      WHERE device_fingerprint = p_device_fingerprint
      AND created_at > NOW() - INTERVAL '7 days'
    ) THEN
      v_risk_score := v_risk_score + 50;
    END IF;
  END IF;
  
  -- Create referral
  INSERT INTO referrals (
    referral_code_id, referrer_user_id, referred_user_id,
    expires_at, signup_ip, signup_user_agent, device_fingerprint,
    risk_score
  ) VALUES (
    v_referral_code_id, v_referrer_user_id, p_referred_user_id,
    NOW() + INTERVAL '180 days', p_signup_ip, p_signup_user_agent,
    p_device_fingerprint, v_risk_score
  ) RETURNING id INTO v_referral_id;
  
  -- Increment usage count
  UPDATE referral_codes 
  SET current_uses = current_uses + 1, updated_at = NOW()
  WHERE id = v_referral_code_id;
  
  RETURN v_referral_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has active referral
CREATE OR REPLACE FUNCTION get_active_referral(p_user_id UUID)
RETURNS TABLE (
  referral_id UUID,
  referrer_user_id UUID,
  reward_bps INTEGER,
  expires_at TIMESTAMPTZ,
  total_earnings_cap_usdc NUMERIC(20,6)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.referrer_user_id,
    rc.reward_bps,
    r.expires_at,
    50.00::NUMERIC(20,6) as total_earnings_cap_usdc -- $50 lifetime cap
  FROM referrals r
  JOIN referral_codes rc ON r.referral_code_id = rc.id
  WHERE r.referred_user_id = p_user_id
    AND r.status = 'active'
    AND r.expires_at > NOW()
    AND r.total_referrer_earnings_usdc < 50.00 -- Under cap
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate referral bonus and create earnings
CREATE OR REPLACE FUNCTION process_referral_earnings(
  p_referred_user_id UUID,
  p_source_transaction_usdc NUMERIC(20,6),
  p_source_type VARCHAR(20),
  p_video_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_referral RECORD;
  v_referral_earnings_usdc NUMERIC(20,6);
  v_remaining_cap NUMERIC(20,6);
  v_earnings_ledger_id UUID;
  v_referral_earnings_id UUID;
BEGIN
  -- Get active referral
  SELECT * INTO v_referral FROM get_active_referral(p_referred_user_id);
  
  IF NOT FOUND THEN
    RETURN NULL; -- No active referral
  END IF;
  
  -- Calculate referral earnings
  v_referral_earnings_usdc := p_source_transaction_usdc * (v_referral.reward_bps / 10000.0);
  
  -- Apply lifetime cap
  v_remaining_cap := v_referral.total_earnings_cap_usdc - (
    SELECT COALESCE(total_referrer_earnings_usdc, 0) 
    FROM referrals 
    WHERE id = v_referral.referral_id
  );
  
  IF v_referral_earnings_usdc > v_remaining_cap THEN
    v_referral_earnings_usdc := v_remaining_cap;
  END IF;
  
  -- Skip if no earnings (cap reached)
  IF v_referral_earnings_usdc <= 0 THEN
    RETURN NULL;
  END IF;
  
  -- Create earnings ledger entry for referrer
  INSERT INTO earnings_ledger (
    user_id, gross_usdc, fee_usdc, net_usdc, source, meta
  ) VALUES (
    v_referral.referrer_user_id,
    v_referral_earnings_usdc,
    0, -- No fee on referral earnings
    v_referral_earnings_usdc,
    'referral',
    jsonb_build_object(
      'referred_user_id', p_referred_user_id,
      'source_transaction_usdc', p_source_transaction_usdc,
      'source_type', p_source_type,
      'video_id', p_video_id,
      'reward_percentage', (v_referral.reward_bps / 100.0)
    )
  ) RETURNING id INTO v_earnings_ledger_id;
  
  -- Track referral earnings
  INSERT INTO referral_earnings (
    referral_id, earnings_ledger_id, source_transaction_usdc,
    referral_percentage, referral_earnings_usdc, source_type, video_id
  ) VALUES (
    v_referral.referral_id, v_earnings_ledger_id, p_source_transaction_usdc,
    (v_referral.reward_bps / 100.0), v_referral_earnings_usdc, p_source_type, p_video_id
  ) RETURNING id INTO v_referral_earnings_id;
  
  -- Update referral totals
  UPDATE referrals 
  SET 
    total_attributed_usdc = total_attributed_usdc + p_source_transaction_usdc,
    total_referrer_earnings_usdc = total_referrer_earnings_usdc + v_referral_earnings_usdc,
    updated_at = NOW()
  WHERE id = v_referral.referral_id;
  
  RETURN v_earnings_ledger_id;
END;
$$ LANGUAGE plpgsql;

-- Function to expire old referrals
CREATE OR REPLACE FUNCTION expire_referrals()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE referrals 
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' 
    AND expires_at <= NOW();
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_referral_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_referral_codes_updated_at
  BEFORE UPDATE ON referral_codes
  FOR EACH ROW EXECUTE FUNCTION update_referral_timestamps();

CREATE TRIGGER update_referrals_updated_at  
  BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_referral_timestamps();

-- View for referral analytics
CREATE VIEW referral_analytics AS
SELECT 
  rc.creator_id,
  rc.code,
  rc.reward_bps,
  COUNT(r.id) as total_referrals,
  COUNT(r.id) FILTER (WHERE r.status = 'active') as active_referrals,
  SUM(r.total_attributed_usdc) as total_attributed_revenue,
  SUM(r.total_referrer_earnings_usdc) as total_creator_earnings,
  AVG(r.total_attributed_usdc) as avg_attributed_per_referral,
  rc.created_at as code_created_at
FROM referral_codes rc
LEFT JOIN referrals r ON rc.id = r.referral_code_id
GROUP BY rc.id, rc.creator_id, rc.code, rc.reward_bps, rc.created_at
ORDER BY total_attributed_revenue DESC;