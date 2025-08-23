-- Migration 008: Create subscription plans and subscriptions
-- Supports monthly/annual plans with price freezing and dunning logic
-- Features grace periods, cancellation handling, and automated renewals

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Plans table - defines subscription tiers for creators
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL, -- References users table
  name TEXT NOT NULL CHECK (LENGTH(name) BETWEEN 1 AND 100),
  price_usdc NUMERIC(20,6) NOT NULL CHECK (price_usdc > 0),
  cadence VARCHAR(10) NOT NULL CHECK (cadence IN ('monthly', 'annual')),
  status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for plans
CREATE INDEX IF NOT EXISTS idx_plans_creator_id ON plans(creator_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_plans_creator_status ON plans(creator_id, status);

-- Subscriptions table - tracks user subscriptions to creator plans
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- References users table (subscriber)
  creator_id UUID NOT NULL, -- References users table (creator)
  plan_id UUID NOT NULL REFERENCES plans(id),
  
  -- Price frozen at subscription time (protection against plan changes)
  price_usdc NUMERIC(20,6) NOT NULL CHECK (price_usdc > 0),
  
  -- Subscription lifecycle
  status VARCHAR(15) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'canceled', 'past_due', 'paused')),
  
  -- Cancellation tracking
  canceled_reason VARCHAR(30) CHECK (canceled_reason IN (
    'user_canceled', 'payment_failed', 'creator_archived', 'policy_violation'
  )),
  
  -- Grace period for failed payments
  grace_until TIMESTAMPTZ,
  
  -- Dunning state for payment retries
  dunning_state VARCHAR(10) DEFAULT 'active' 
    CHECK (dunning_state IN ('active', 'retry', 'failed')),
  dunning_attempts INTEGER DEFAULT 0 CHECK (dunning_attempts >= 0),
  
  -- Timeline tracking
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  renewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  canceled_at TIMESTAMPTZ,
  next_billing_at TIMESTAMPTZ NOT NULL,
  
  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_creator_id ON subscriptions(creator_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_creator ON subscriptions(user_id, creator_id);

-- Unique constraint: one active subscription per user-creator pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_unique_active 
ON subscriptions(user_id, creator_id) 
WHERE status = 'active';

-- Index for dunning queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_dunning 
ON subscriptions(dunning_state, next_billing_at) 
WHERE status IN ('active', 'past_due');

-- Subscription history for tracking plan changes
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN (
    'created', 'renewed', 'canceled', 'reactivated', 'plan_changed', 'payment_failed'
  )),
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for subscription history
CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription_id ON subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_event_type ON subscription_history(event_type);

-- Function to calculate next billing date
CREATE OR REPLACE FUNCTION calculate_next_billing(cadence VARCHAR, from_date TIMESTAMPTZ DEFAULT NOW())
RETURNS TIMESTAMPTZ AS $$
BEGIN
  CASE cadence
    WHEN 'monthly' THEN
      RETURN from_date + INTERVAL '1 month';
    WHEN 'annual' THEN
      RETURN from_date + INTERVAL '1 year';
    ELSE
      RAISE EXCEPTION 'Invalid cadence: %', cadence;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to create subscription with proper initialization
CREATE OR REPLACE FUNCTION create_subscription(
  p_user_id UUID,
  p_creator_id UUID,
  p_plan_id UUID
) RETURNS UUID AS $$
DECLARE
  v_subscription_id UUID;
  v_plan_price NUMERIC(20,6);
  v_plan_cadence VARCHAR(10);
  v_next_billing TIMESTAMPTZ;
BEGIN
  -- Get plan details
  SELECT price_usdc, cadence 
  INTO v_plan_price, v_plan_cadence
  FROM plans 
  WHERE id = p_plan_id AND status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found or inactive: %', p_plan_id;
  END IF;
  
  -- Calculate next billing date
  v_next_billing := calculate_next_billing(v_plan_cadence);
  
  -- Create subscription
  INSERT INTO subscriptions (
    user_id, creator_id, plan_id, price_usdc,
    next_billing_at, renewed_at
  ) VALUES (
    p_user_id, p_creator_id, p_plan_id, v_plan_price,
    v_next_billing, NOW()
  ) RETURNING id INTO v_subscription_id;
  
  -- Log history
  INSERT INTO subscription_history (subscription_id, event_type, new_values)
  VALUES (v_subscription_id, 'created', jsonb_build_object(
    'plan_id', p_plan_id,
    'price_usdc', v_plan_price,
    'cadence', v_plan_cadence
  ));
  
  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql;

-- Function to cancel subscription
CREATE OR REPLACE FUNCTION cancel_subscription(
  p_subscription_id UUID,
  p_reason VARCHAR(30) DEFAULT 'user_canceled'
) RETURNS BOOLEAN AS $$
DECLARE
  v_old_status VARCHAR(15);
BEGIN
  -- Update subscription
  UPDATE subscriptions 
  SET 
    status = 'canceled',
    canceled_reason = p_reason,
    canceled_at = NOW(),
    updated_at = NOW()
  WHERE id = p_subscription_id
  RETURNING status INTO v_old_status;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Log history
  INSERT INTO subscription_history (subscription_id, event_type, old_values, new_values, reason)
  VALUES (p_subscription_id, 'canceled', 
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', 'canceled', 'canceled_reason', p_reason),
    p_reason
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to handle payment failure and dunning
CREATE OR REPLACE FUNCTION handle_payment_failure(
  p_subscription_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_attempts INTEGER;
  v_max_attempts INTEGER := 3;
  v_grace_hours INTEGER := 72;
BEGIN
  -- Increment dunning attempts
  UPDATE subscriptions 
  SET 
    dunning_attempts = dunning_attempts + 1,
    dunning_state = CASE 
      WHEN dunning_attempts + 1 >= v_max_attempts THEN 'failed'
      ELSE 'retry'
    END,
    status = CASE 
      WHEN dunning_attempts + 1 >= v_max_attempts THEN 'past_due'
      ELSE status
    END,
    grace_until = CASE 
      WHEN dunning_attempts + 1 >= v_max_attempts THEN NOW() + (v_grace_hours || ' hours')::INTERVAL
      ELSE grace_until
    END,
    next_billing_at = NOW() + INTERVAL '24 hours', -- Retry in 24 hours
    updated_at = NOW()
  WHERE id = p_subscription_id
  RETURNING dunning_attempts INTO v_current_attempts;
  
  -- Log history
  INSERT INTO subscription_history (subscription_id, event_type, new_values)
  VALUES (p_subscription_id, 'payment_failed', jsonb_build_object(
    'dunning_attempts', v_current_attempts,
    'retry_scheduled', NOW() + INTERVAL '24 hours'
  ));
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to renew subscription successfully  
CREATE OR REPLACE FUNCTION renew_subscription(
  p_subscription_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_cadence VARCHAR(10);
  v_next_billing TIMESTAMPTZ;
BEGIN
  -- Get subscription cadence
  SELECT p.cadence INTO v_cadence
  FROM subscriptions s
  JOIN plans p ON s.plan_id = p.id
  WHERE s.id = p_subscription_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate next billing
  v_next_billing := calculate_next_billing(v_cadence);
  
  -- Update subscription
  UPDATE subscriptions 
  SET 
    status = 'active',
    dunning_state = 'active',
    dunning_attempts = 0,
    grace_until = NULL,
    renewed_at = NOW(),
    next_billing_at = v_next_billing,
    updated_at = NOW()
  WHERE id = p_subscription_id;
  
  -- Log history
  INSERT INTO subscription_history (subscription_id, event_type, new_values)
  VALUES (p_subscription_id, 'renewed', jsonb_build_object(
    'renewed_at', NOW(),
    'next_billing_at', v_next_billing
  ));
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_subscriptions_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_subscriptions_updated_at();

-- View for subscription analytics
CREATE VIEW subscription_metrics AS
SELECT 
  creator_id,
  COUNT(*) as total_subscribers,
  COUNT(*) FILTER (WHERE status = 'active') as active_subscribers,
  COUNT(*) FILTER (WHERE status = 'canceled') as canceled_subscribers,
  COUNT(*) FILTER (WHERE status = 'past_due') as past_due_subscribers,
  SUM(price_usdc) FILTER (WHERE status = 'active') as monthly_recurring_revenue,
  AVG(price_usdc) FILTER (WHERE status = 'active') as average_price,
  MIN(started_at) as first_subscriber_at,
  MAX(started_at) as latest_subscriber_at
FROM subscriptions
GROUP BY creator_id;