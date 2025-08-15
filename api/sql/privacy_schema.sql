-- Privacy and Data Compliance Schema
-- This schema supports GDPR, CCPA, and other privacy regulations

-- Data export requests table
CREATE TABLE IF NOT EXISTS data_export_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    export_type VARCHAR(20) NOT NULL CHECK (export_type IN ('gdpr', 'ccpa', 'custom')),
    data_types JSONB NOT NULL,
    download_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    requested_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Data deletion requests table
CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    deletion_type VARCHAR(20) NOT NULL CHECK (deletion_type IN ('full', 'partial', 'anonymization')),
    data_types JSONB NOT NULL,
    retention_period INTEGER,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    verification_required BOOLEAN NOT NULL DEFAULT true,
    verification_token UUID,
    requested_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Consent records table (detailed history)
CREATE TABLE IF NOT EXISTS consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN ('essential', 'analytics', 'marketing', 'personalization', 'third_party', 'data_processing')),
    granted BOOLEAN NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    version VARCHAR(10) NOT NULL DEFAULT '1.0',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Current consent status table (for quick lookups)
CREATE TABLE IF NOT EXISTS user_consent_status (
    user_id UUID NOT NULL,
    consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN ('essential', 'analytics', 'marketing', 'personalization', 'third_party', 'data_processing')),
    granted BOOLEAN NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, consent_type)
);

-- Data retention policies table
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_type VARCHAR(50) NOT NULL UNIQUE CHECK (data_type IN ('profile', 'content', 'financial', 'analytics', 'communications', 'verification', 'consent', 'logs')),
    retention_period INTEGER NOT NULL, -- in days
    auto_delete BOOLEAN NOT NULL DEFAULT false,
    legal_basis TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- PII access logs table
CREATE TABLE IF NOT EXISTS pii_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    accessed_by UUID NOT NULL,
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('view', 'export', 'modify', 'delete')),
    data_types JSONB NOT NULL,
    purpose TEXT NOT NULL,
    ip_address INET NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    correlation_id UUID
);

-- Login logs table (for audit trail)
CREATE TABLE IF NOT EXISTS login_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    logout_at TIMESTAMP WITH TIME ZONE,
    login_method VARCHAR(50) NOT NULL DEFAULT 'password',
    session_id UUID,
    success BOOLEAN NOT NULL DEFAULT true,
    failure_reason TEXT
);

-- User engagement table (for analytics data type)
CREATE TABLE IF NOT EXISTS user_engagement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    content_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB,
    session_id UUID,
    ip_address INET
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_export_requests_user_id ON data_export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_export_requests_status ON data_export_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_export_requests_created_at ON data_export_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_user_id ON data_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_status ON data_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_verification_token ON data_deletion_requests(verification_token);

CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_consent_type ON consent_records(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_records_created_at ON consent_records(created_at);

CREATE INDEX IF NOT EXISTS idx_user_consent_status_user_id ON user_consent_status(user_id);

CREATE INDEX IF NOT EXISTS idx_pii_access_logs_user_id ON pii_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_pii_access_logs_accessed_by ON pii_access_logs(accessed_by);
CREATE INDEX IF NOT EXISTS idx_pii_access_logs_timestamp ON pii_access_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_pii_access_logs_correlation_id ON pii_access_logs(correlation_id);

CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_login_at ON login_logs(login_at);
CREATE INDEX IF NOT EXISTS idx_login_logs_ip_address ON login_logs(ip_address);

CREATE INDEX IF NOT EXISTS idx_user_engagement_user_id ON user_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_user_engagement_timestamp ON user_engagement(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_engagement_event_type ON user_engagement(event_type);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_data_export_requests_updated_at 
    BEFORE UPDATE ON data_export_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_deletion_requests_updated_at 
    BEFORE UPDATE ON data_deletion_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_retention_policies_updated_at 
    BEFORE UPDATE ON data_retention_policies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_consent_status_updated_at 
    BEFORE UPDATE ON user_consent_status 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE OR REPLACE VIEW user_privacy_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.created_at as user_created_at,
    -- Consent status
    (SELECT jsonb_object_agg(consent_type, granted) 
     FROM user_consent_status 
     WHERE user_id = u.id) as consent_status,
    -- Export requests
    (SELECT COUNT(*) 
     FROM data_export_requests 
     WHERE user_id = u.id) as export_requests_count,
    -- Deletion requests
    (SELECT COUNT(*) 
     FROM data_deletion_requests 
     WHERE user_id = u.id) as deletion_requests_count,
    -- Last PII access
    (SELECT MAX(timestamp) 
     FROM pii_access_logs 
     WHERE user_id = u.id) as last_pii_access,
    -- Data retention compliance
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM data_deletion_requests 
            WHERE user_id = u.id AND status = 'completed'
        ) THEN 'deleted'
        WHEN EXISTS (
            SELECT 1 FROM data_deletion_requests 
            WHERE user_id = u.id AND status IN ('pending', 'processing')
        ) THEN 'deletion_pending'
        ELSE 'active'
    END as privacy_status
FROM users u;

-- Compliance reporting view
CREATE OR REPLACE VIEW privacy_compliance_report AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    -- Export requests
    COUNT(*) FILTER (WHERE table_name = 'data_export_requests') as export_requests,
    COUNT(*) FILTER (WHERE table_name = 'data_export_requests' AND status = 'completed') as export_requests_completed,
    -- Deletion requests
    COUNT(*) FILTER (WHERE table_name = 'data_deletion_requests') as deletion_requests,
    COUNT(*) FILTER (WHERE table_name = 'data_deletion_requests' AND status = 'completed') as deletion_requests_completed,
    -- Consent changes
    COUNT(*) FILTER (WHERE table_name = 'consent_records') as consent_changes,
    COUNT(*) FILTER (WHERE table_name = 'consent_records' AND granted = true) as consent_granted,
    COUNT(*) FILTER (WHERE table_name = 'consent_records' AND granted = false) as consent_revoked
FROM (
    SELECT created_at, 'data_export_requests' as table_name, status, NULL::boolean as granted FROM data_export_requests
    UNION ALL
    SELECT created_at, 'data_deletion_requests' as table_name, status, NULL::boolean as granted FROM data_deletion_requests
    UNION ALL
    SELECT created_at, 'consent_records' as table_name, NULL as status, granted FROM consent_records
) combined
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- Data retention cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS INTEGER AS $$
DECLARE
    policy RECORD;
    cutoff_date TIMESTAMP WITH TIME ZONE;
    deleted_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- Loop through retention policies
    FOR policy IN 
        SELECT data_type, retention_period 
        FROM data_retention_policies 
        WHERE auto_delete = true
    LOOP
        cutoff_date := NOW() - (policy.retention_period || ' days')::INTERVAL;
        
        CASE policy.data_type
            WHEN 'logs' THEN
                DELETE FROM pii_access_logs WHERE timestamp < cutoff_date;
                GET DIAGNOSTICS temp_count = ROW_COUNT;
                deleted_count := deleted_count + temp_count;
                
                DELETE FROM login_logs WHERE login_at < cutoff_date;
                GET DIAGNOSTICS temp_count = ROW_COUNT;
                deleted_count := deleted_count + temp_count;
                
            WHEN 'analytics' THEN
                DELETE FROM user_engagement WHERE timestamp < cutoff_date;
                GET DIAGNOSTICS temp_count = ROW_COUNT;
                deleted_count := deleted_count + temp_count;
                
            WHEN 'communications' THEN
                -- This would delete from messages/notifications tables if they exist
                -- DELETE FROM messages WHERE sent_at < cutoff_date;
                -- DELETE FROM notifications WHERE sent_at < cutoff_date;
                NULL;
                
            ELSE
                -- Handle other data types as needed
                NULL;
        END CASE;
    END LOOP;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert default retention policies
INSERT INTO data_retention_policies (data_type, retention_period, auto_delete, legal_basis) VALUES
    ('logs', 365, true, 'Legitimate interest for security and fraud prevention'),
    ('analytics', 1095, true, 'Legitimate interest for business analytics'),
    ('financial', 2555, false, 'Legal obligation for tax compliance'),
    ('communications', 1095, true, 'Legitimate interest for customer support'),
    ('consent', 2555, false, 'Legal obligation for consent proof'),
    ('verification', 2555, false, 'Legal obligation for identity verification'),
    ('profile', -1, false, 'Contract performance and legitimate interest'),
    ('content', -1, false, 'Contract performance')
ON CONFLICT (data_type) DO NOTHING;

-- Grant permissions (adjust as needed for your user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;