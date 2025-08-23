-- Create analytics_events table for tracking user interactions
-- This migration adds the analytics events storage system for monetization features

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Can be null for anonymous events
    event_name VARCHAR(100) NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    session_id VARCHAR(100),
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_event_time ON analytics_events(user_id, event_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_creator_content ON analytics_events((properties->>'creatorId'), (properties->>'videoId'), timestamp);

-- GIN index for JSONB properties
CREATE INDEX IF NOT EXISTS idx_analytics_events_properties ON analytics_events USING GIN(properties);

-- Partial indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_tip_events ON analytics_events(timestamp, properties) 
WHERE event_name IN ('tip_click', 'tip_success', 'tip_failed');

CREATE INDEX IF NOT EXISTS idx_analytics_events_subscription_events ON analytics_events(timestamp, properties) 
WHERE event_name IN ('subscription_click', 'subscription_started', 'subscription_canceled');

-- Function to clean up old analytics events (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_analytics_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Keep analytics events for 90 days
    DELETE FROM analytics_events 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for analytics summary
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_summary AS
SELECT 
    DATE_TRUNC('day', timestamp) as date,
    event_name,
    properties->>'creatorId' as creator_id,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT session_id) as unique_sessions,
    AVG((properties->>'amountUSDC')::numeric) FILTER (WHERE properties->>'amountUSDC' IS NOT NULL) as avg_amount_usdc,
    SUM((properties->>'amountUSDC')::numeric) FILTER (WHERE properties->>'amountUSDC' IS NOT NULL) as total_amount_usdc
FROM analytics_events
WHERE timestamp >= NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', timestamp), event_name, properties->>'creatorId';

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_summary_unique 
ON analytics_summary(date, event_name, creator_id);

-- Create indexes on materialized view
CREATE INDEX IF NOT EXISTS idx_analytics_summary_date ON analytics_summary(date);
CREATE INDEX IF NOT EXISTS idx_analytics_summary_creator ON analytics_summary(creator_id);
CREATE INDEX IF NOT EXISTS idx_analytics_summary_event ON analytics_summary(event_name);

-- Function to refresh analytics summary
CREATE OR REPLACE FUNCTION refresh_analytics_summary()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_summary;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE analytics_events IS 'Stores user interaction events for monetization analytics';
COMMENT ON COLUMN analytics_events.user_id IS 'User who performed the action, can be null for anonymous events';
COMMENT ON COLUMN analytics_events.event_name IS 'Name of the event (tip_click, subscription_started, etc.)';
COMMENT ON COLUMN analytics_events.properties IS 'Event properties as JSON (videoId, creatorId, amountUSDC, etc.)';
COMMENT ON COLUMN analytics_events.timestamp IS 'When the event occurred (client-side timestamp)';
COMMENT ON COLUMN analytics_events.session_id IS 'User session identifier for tracking user journeys';
COMMENT ON COLUMN analytics_events.created_at IS 'When the event was recorded in the database';

COMMENT ON MATERIALIZED VIEW analytics_summary IS 'Daily aggregated analytics data for efficient reporting';
COMMENT ON FUNCTION cleanup_old_analytics_events() IS 'Removes analytics events older than 90 days';
COMMENT ON FUNCTION refresh_analytics_summary() IS 'Refreshes the analytics summary materialized view';