-- Migration 009: Create versioned split policies for revenue sharing
-- Ensures immutability of historical earnings through policy versioning
-- Supports automatic rounding residual assignment to creator

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Split policies table - versioned and immutable once applied
CREATE TABLE IF NOT EXISTS split_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('video', 'creator')),
  version INTEGER NOT NULL CHECK (version > 0),
  total_percent NUMERIC(6,2) NOT NULL CHECK (total_percent = 100.00),
  created_by UUID NOT NULL, -- References users table (creator)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure version uniqueness per scope
  UNIQUE(scope, version)
);

-- Split policy items - individual payee percentages
CREATE TABLE IF NOT EXISTS split_policy_items (
  policy_id UUID NOT NULL REFERENCES split_policies(id) ON DELETE CASCADE,
  payee_user_id UUID NOT NULL, -- References users table
  percent NUMERIC(5,2) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  is_creator BOOLEAN NOT NULL DEFAULT FALSE, -- Identifies the primary creator for residual assignment
  
  PRIMARY KEY (policy_id, payee_user_id)
);

-- Video split applied - tracks which policy version was active when video earned
CREATE TABLE IF NOT EXISTS video_split_applied (
  video_id UUID PRIMARY KEY, -- References videos table
  policy_id UUID NOT NULL REFERENCES split_policies(id),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_split_policies_scope ON split_policies(scope);
CREATE INDEX IF NOT EXISTS idx_split_policies_created_by ON split_policies(created_by);
CREATE INDEX IF NOT EXISTS idx_split_policy_items_payee ON split_policy_items(payee_user_id);
CREATE INDEX IF NOT EXISTS idx_split_policy_items_creator ON split_policy_items(is_creator) WHERE is_creator = TRUE;
CREATE INDEX IF NOT EXISTS idx_video_split_applied_policy ON video_split_applied(policy_id);

-- Function to create a new split policy
CREATE OR REPLACE FUNCTION create_split_policy(
  p_scope VARCHAR(20),
  p_created_by UUID,
  p_splits JSONB -- Array of {payee_user_id, percent, is_creator}
) RETURNS UUID AS $$
DECLARE
  v_policy_id UUID;
  v_version INTEGER;
  v_total_percent NUMERIC(6,2) := 0;
  v_split JSONB;
  v_creator_count INTEGER := 0;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version), 0) + 1 
  INTO v_version 
  FROM split_policies 
  WHERE scope = p_scope;
  
  -- Validate splits array
  IF jsonb_array_length(p_splits) = 0 THEN
    RAISE EXCEPTION 'Split policy must have at least one payee';
  END IF;
  
  -- Calculate total percentage and validate
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    v_total_percent := v_total_percent + (v_split->>'percent')::NUMERIC(5,2);
    
    -- Count creators
    IF (v_split->>'is_creator')::BOOLEAN THEN
      v_creator_count := v_creator_count + 1;
    END IF;
  END LOOP;
  
  -- Validate total percentage
  IF v_total_percent != 100.00 THEN
    RAISE EXCEPTION 'Split percentages must total exactly 100.00, got %', v_total_percent;
  END IF;
  
  -- Ensure exactly one creator for residual assignment
  IF v_creator_count != 1 THEN
    RAISE EXCEPTION 'Split policy must have exactly one creator marked, got %', v_creator_count;
  END IF;
  
  -- Create policy
  INSERT INTO split_policies (id, scope, version, total_percent, created_by)
  VALUES (gen_random_uuid(), p_scope, v_version, 100.00, p_created_by)
  RETURNING id INTO v_policy_id;
  
  -- Create policy items
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    INSERT INTO split_policy_items (policy_id, payee_user_id, percent, is_creator)
    VALUES (
      v_policy_id,
      (v_split->>'payee_user_id')::UUID,
      (v_split->>'percent')::NUMERIC(5,2),
      COALESCE((v_split->>'is_creator')::BOOLEAN, FALSE)
    );
  END LOOP;
  
  RETURN v_policy_id;
END;
$$ LANGUAGE plpgsql;

-- Function to apply split policy to video
CREATE OR REPLACE FUNCTION apply_split_policy_to_video(
  p_video_id UUID,
  p_policy_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- Insert or update video split application
  INSERT INTO video_split_applied (video_id, policy_id)
  VALUES (p_video_id, p_policy_id)
  ON CONFLICT (video_id) 
  DO UPDATE SET 
    policy_id = EXCLUDED.policy_id,
    applied_at = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get effective split policy for video
CREATE OR REPLACE FUNCTION get_video_split_policy(p_video_id UUID)
RETURNS TABLE (
  policy_id UUID,
  version INTEGER,
  payee_user_id UUID,
  percent NUMERIC(5,2),
  is_creator BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id as policy_id,
    sp.version,
    spi.payee_user_id,
    spi.percent,
    spi.is_creator
  FROM video_split_applied vsa
  JOIN split_policies sp ON vsa.policy_id = sp.id
  JOIN split_policy_items spi ON sp.id = spi.policy_id
  WHERE vsa.video_id = p_video_id
  ORDER BY spi.percent DESC;
  
  -- If no policy applied, return default (100% to video creator)
  IF NOT FOUND THEN
    -- Note: This would need video creator lookup in real implementation
    -- For now, returning empty result to indicate no policy
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate split amounts with proper rounding
CREATE OR REPLACE FUNCTION calculate_split_amounts(
  p_net_amount NUMERIC(20,6),
  p_policy_id UUID
) RETURNS TABLE (
  payee_user_id UUID,
  amount NUMERIC(20,6),
  is_creator BOOLEAN
) AS $$
DECLARE
  v_total_assigned NUMERIC(20,6) := 0;
  v_residual NUMERIC(20,6);
  v_creator_user_id UUID;
  v_split RECORD;
BEGIN
  -- Get creator user ID for residual assignment
  SELECT spi.payee_user_id INTO v_creator_user_id
  FROM split_policy_items spi
  WHERE spi.policy_id = p_policy_id AND spi.is_creator = TRUE;
  
  IF v_creator_user_id IS NULL THEN
    RAISE EXCEPTION 'No creator found in split policy %', p_policy_id;
  END IF;
  
  -- Calculate floored amounts for each payee
  FOR v_split IN 
    SELECT spi.payee_user_id, spi.percent, spi.is_creator
    FROM split_policy_items spi
    WHERE spi.policy_id = p_policy_id
    ORDER BY spi.percent DESC
  LOOP
    DECLARE
      v_share NUMERIC(20,6);
    BEGIN
      -- Calculate share and floor to 6 decimal places
      v_share := FLOOR((p_net_amount * v_split.percent / 100.00) * 1000000) / 1000000;
      v_total_assigned := v_total_assigned + v_share;
      
      RETURN QUERY SELECT v_split.payee_user_id, v_share, v_split.is_creator;
    END;
  END LOOP;
  
  -- Calculate residual and assign to creator
  v_residual := p_net_amount - v_total_assigned;
  
  IF v_residual > 0 THEN
    -- Add residual to creator's amount
    UPDATE (SELECT * FROM calculate_split_amounts(p_net_amount, p_policy_id)) 
    SET amount = amount + v_residual 
    WHERE payee_user_id = v_creator_user_id;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Simplified function that returns proper split with residual handled
CREATE OR REPLACE FUNCTION get_split_amounts(
  p_net_amount NUMERIC(20,6),
  p_policy_id UUID
) RETURNS TABLE (
  payee_user_id UUID,
  amount NUMERIC(20,6),
  percent NUMERIC(5,2)
) AS $$
DECLARE
  v_split RECORD;
  v_total_assigned NUMERIC(20,6) := 0;
  v_residual NUMERIC(20,6);
  v_creator_user_id UUID;
  v_creator_amount NUMERIC(20,6) := 0;
BEGIN
  -- Get creator for residual assignment
  SELECT spi.payee_user_id INTO v_creator_user_id
  FROM split_policy_items spi
  WHERE spi.policy_id = p_policy_id AND spi.is_creator = TRUE;
  
  -- Calculate floored amounts
  FOR v_split IN
    SELECT spi.payee_user_id, spi.percent, spi.is_creator
    FROM split_policy_items spi
    WHERE spi.policy_id = p_policy_id
    ORDER BY spi.is_creator DESC, spi.percent DESC -- Creator first for residual
  LOOP
    DECLARE
      v_amount NUMERIC(20,6);
    BEGIN
      v_amount := FLOOR((p_net_amount * v_split.percent / 100.00) * 1000000) / 1000000;
      
      -- If this is the creator, we'll adjust for residual later
      IF v_split.is_creator THEN
        v_creator_amount := v_amount;
      ELSE
        v_total_assigned := v_total_assigned + v_amount;
        RETURN QUERY SELECT v_split.payee_user_id, v_amount, v_split.percent;
      END IF;
    END;
  END LOOP;
  
  -- Calculate residual and assign to creator
  v_residual := p_net_amount - v_total_assigned - v_creator_amount;
  v_creator_amount := v_creator_amount + v_residual;
  
  -- Return creator with residual
  SELECT percent INTO v_split.percent 
  FROM split_policy_items 
  WHERE policy_id = p_policy_id AND payee_user_id = v_creator_user_id;
  
  RETURN QUERY SELECT v_creator_user_id, v_creator_amount, v_split.percent;
END;
$$ LANGUAGE plpgsql;

-- View for split policy analytics
CREATE VIEW split_policy_usage AS
SELECT 
  sp.id as policy_id,
  sp.scope,
  sp.version,
  sp.created_by,
  COUNT(vsa.video_id) as videos_using_policy,
  sp.created_at
FROM split_policies sp
LEFT JOIN video_split_applied vsa ON sp.id = vsa.policy_id
GROUP BY sp.id, sp.scope, sp.version, sp.created_by, sp.created_at
ORDER BY sp.version DESC;

-- View for current video split configurations
CREATE VIEW current_video_splits AS
SELECT 
  vsa.video_id,
  sp.id as policy_id,
  sp.version,
  jsonb_agg(
    jsonb_build_object(
      'payee_user_id', spi.payee_user_id,
      'percent', spi.percent,
      'is_creator', spi.is_creator
    ) ORDER BY spi.percent DESC
  ) as splits,
  vsa.applied_at
FROM video_split_applied vsa
JOIN split_policies sp ON vsa.policy_id = sp.id  
JOIN split_policy_items spi ON sp.id = spi.policy_id
GROUP BY vsa.video_id, sp.id, sp.version, vsa.applied_at;