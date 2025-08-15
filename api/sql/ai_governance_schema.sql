-- AI Governance and Observability Schema
-- This schema supports model version registry, drift detection, abuse reporting, and red-team testing

-- AI models registry table
CREATE TABLE IF NOT EXISTS ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    model_type VARCHAR(50) NOT NULL CHECK (model_type IN ('classification', 'embedding', 'generation', 'detection')),
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'huggingface', 'custom')),
    endpoint TEXT,
    configuration JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'testing' CHECK (status IN ('active', 'deprecated', 'testing', 'disabled')),
    performance_metrics JSONB NOT NULL DEFAULT '{}',
    deployed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(name, version)
);

-- AI model outputs table with tagging and version tracking
CREATE TABLE IF NOT EXISTS ai_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ai_models(id),
    model_version VARCHAR(100) NOT NULL,
    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    processing_time INTEGER NOT NULL, -- in milliseconds
    user_id UUID,
    content_id UUID,
    tags JSONB NOT NULL DEFAULT '[]',
    flagged BOOLEAN NOT NULL DEFAULT false,
    flag_reason TEXT,
    review_status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (review_status IN ('pending', 'approved', 'rejected', 'escalated')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Embedding drift detection table
CREATE TABLE IF NOT EXISTS embedding_drift (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ai_models(id),
    baseline_embedding JSONB NOT NULL,
    current_embedding JSONB NOT NULL,
    drift_score DECIMAL(5,4) NOT NULL,
    threshold DECIMAL(5,4) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('normal', 'warning', 'critical')),
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    alert_sent BOOLEAN NOT NULL DEFAULT false
);

-- Abuse cases and false-positive reports table
CREATE TABLE IF NOT EXISTS abuse_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    output_id UUID NOT NULL REFERENCES ai_outputs(id),
    reported_by UUID NOT NULL,
    abuse_type VARCHAR(50) NOT NULL CHECK (abuse_type IN ('false_positive', 'false_negative', 'bias', 'inappropriate', 'other')),
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
    assigned_to UUID,
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Red-team tests table
CREATE TABLE IF NOT EXISTS red_team_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_suite VARCHAR(100) NOT NULL,
    model_id UUID NOT NULL REFERENCES ai_models(id),
    test_type VARCHAR(50) NOT NULL CHECK (test_type IN ('adversarial', 'bias', 'safety', 'robustness', 'privacy')),
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    overall_score DECIMAL(5,2) DEFAULT 0,
    pass_rate DECIMAL(5,2) DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Red-team test cases table
CREATE TABLE IF NOT EXISTS red_team_test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES red_team_tests(id),
    name VARCHAR(255) NOT NULL,
    input_data JSONB NOT NULL,
    expected_output JSONB,
    actual_output JSONB,
    passed BOOLEAN NOT NULL DEFAULT false,
    score DECIMAL(5,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Model performance history table
CREATE TABLE IF NOT EXISTS model_performance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ai_models(id),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- AI governance alerts table
CREATE TABLE IF NOT EXISTS ai_governance_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('drift', 'performance', 'abuse', 'compliance')),
    model_id UUID REFERENCES ai_models(id),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Model bias metrics table
CREATE TABLE IF NOT EXISTS model_bias_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ai_models(id),
    bias_type VARCHAR(50) NOT NULL, -- e.g., 'gender', 'race', 'age', 'geographic'
    metric_name VARCHAR(100) NOT NULL, -- e.g., 'demographic_parity', 'equalized_odds'
    metric_value DECIMAL(5,4) NOT NULL,
    threshold DECIMAL(5,4) NOT NULL,
    passed BOOLEAN NOT NULL,
    test_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_models_name_version ON ai_models(name, version);
CREATE INDEX IF NOT EXISTS idx_ai_models_status ON ai_models(status);
CREATE INDEX IF NOT EXISTS idx_ai_models_model_type ON ai_models(model_type);

CREATE INDEX IF NOT EXISTS idx_ai_outputs_model_id ON ai_outputs(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_created_at ON ai_outputs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_flagged ON ai_outputs(flagged);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_review_status ON ai_outputs(review_status);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_user_id ON ai_outputs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_content_id ON ai_outputs(content_id);

CREATE INDEX IF NOT EXISTS idx_embedding_drift_model_id ON embedding_drift(model_id);
CREATE INDEX IF NOT EXISTS idx_embedding_drift_status ON embedding_drift(status);
CREATE INDEX IF NOT EXISTS idx_embedding_drift_detected_at ON embedding_drift(detected_at);

CREATE INDEX IF NOT EXISTS idx_abuse_cases_output_id ON abuse_cases(output_id);
CREATE INDEX IF NOT EXISTS idx_abuse_cases_reported_by ON abuse_cases(reported_by);
CREATE INDEX IF NOT EXISTS idx_abuse_cases_status ON abuse_cases(status);
CREATE INDEX IF NOT EXISTS idx_abuse_cases_severity ON abuse_cases(severity);
CREATE INDEX IF NOT EXISTS idx_abuse_cases_created_at ON abuse_cases(created_at);

CREATE INDEX IF NOT EXISTS idx_red_team_tests_model_id ON red_team_tests(model_id);
CREATE INDEX IF NOT EXISTS idx_red_team_tests_status ON red_team_tests(status);
CREATE INDEX IF NOT EXISTS idx_red_team_tests_started_at ON red_team_tests(started_at);

CREATE INDEX IF NOT EXISTS idx_red_team_test_cases_test_id ON red_team_test_cases(test_id);
CREATE INDEX IF NOT EXISTS idx_red_team_test_cases_passed ON red_team_test_cases(passed);

CREATE INDEX IF NOT EXISTS idx_model_performance_history_model_id ON model_performance_history(model_id);
CREATE INDEX IF NOT EXISTS idx_model_performance_history_recorded_at ON model_performance_history(recorded_at);

CREATE INDEX IF NOT EXISTS idx_ai_governance_alerts_model_id ON ai_governance_alerts(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_governance_alerts_status ON ai_governance_alerts(status);
CREATE INDEX IF NOT EXISTS idx_ai_governance_alerts_severity ON ai_governance_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_ai_governance_alerts_created_at ON ai_governance_alerts(created_at);

CREATE INDEX IF NOT EXISTS idx_model_bias_metrics_model_id ON model_bias_metrics(model_id);
CREATE INDEX IF NOT EXISTS idx_model_bias_metrics_test_date ON model_bias_metrics(test_date);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_models_updated_at 
    BEFORE UPDATE ON ai_models 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_abuse_cases_updated_at 
    BEFORE UPDATE ON abuse_cases 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for AI governance reporting
CREATE OR REPLACE VIEW ai_governance_dashboard AS
SELECT 
    -- Model statistics
    (SELECT COUNT(*) FROM ai_models) as total_models,
    (SELECT COUNT(*) FROM ai_models WHERE status = 'active') as active_models,
    (SELECT COUNT(*) FROM ai_models WHERE status = 'deprecated') as deprecated_models,
    
    -- Output statistics (last 24 hours)
    (SELECT COUNT(*) FROM ai_outputs WHERE created_at > NOW() - INTERVAL '24 hours') as outputs_24h,
    (SELECT COUNT(*) FROM ai_outputs WHERE flagged = true AND created_at > NOW() - INTERVAL '24 hours') as flagged_outputs_24h,
    (SELECT AVG(confidence) FROM ai_outputs WHERE created_at > NOW() - INTERVAL '24 hours') as avg_confidence_24h,
    (SELECT AVG(processing_time) FROM ai_outputs WHERE created_at > NOW() - INTERVAL '24 hours') as avg_processing_time_24h,
    
    -- Drift alerts (last 24 hours)
    (SELECT COUNT(*) FROM embedding_drift WHERE status = 'warning' AND detected_at > NOW() - INTERVAL '24 hours') as drift_warnings_24h,
    (SELECT COUNT(*) FROM embedding_drift WHERE status = 'critical' AND detected_at > NOW() - INTERVAL '24 hours') as drift_critical_24h,
    
    -- Abuse reports (last 24 hours)
    (SELECT COUNT(*) FROM abuse_cases WHERE created_at > NOW() - INTERVAL '24 hours') as abuse_reports_24h,
    (SELECT COUNT(*) FROM abuse_cases WHERE severity IN ('high', 'critical') AND created_at > NOW() - INTERVAL '24 hours') as high_severity_abuse_24h,
    
    -- Red-team test results (last 7 days)
    (SELECT AVG(pass_rate) FROM red_team_tests WHERE status = 'completed' AND started_at > NOW() - INTERVAL '7 days') as avg_red_team_pass_rate_7d;

CREATE OR REPLACE VIEW model_performance_summary AS
SELECT 
    m.id,
    m.name,
    m.version,
    m.model_type,
    m.status,
    m.deployed_at,
    
    -- Output statistics
    COUNT(ao.id) as total_outputs,
    AVG(ao.confidence) as avg_confidence,
    AVG(ao.processing_time) as avg_processing_time,
    COUNT(ao.id) FILTER (WHERE ao.flagged = true) as flagged_outputs,
    COUNT(ao.id) FILTER (WHERE ao.review_status = 'rejected') as rejected_outputs,
    
    -- Drift statistics
    COUNT(ed.id) as drift_measurements,
    COUNT(ed.id) FILTER (WHERE ed.status = 'warning') as drift_warnings,
    COUNT(ed.id) FILTER (WHERE ed.status = 'critical') as drift_critical,
    AVG(ed.drift_score) as avg_drift_score,
    
    -- Abuse statistics
    COUNT(ac.id) as abuse_reports,
    COUNT(ac.id) FILTER (WHERE ac.severity IN ('high', 'critical')) as high_severity_abuse,
    
    -- Red-team statistics
    COUNT(rt.id) as red_team_tests,
    AVG(rt.pass_rate) as avg_red_team_pass_rate
    
FROM ai_models m
LEFT JOIN ai_outputs ao ON m.id = ao.model_id AND ao.created_at > NOW() - INTERVAL '30 days'
LEFT JOIN embedding_drift ed ON m.id = ed.model_id AND ed.detected_at > NOW() - INTERVAL '30 days'
LEFT JOIN abuse_cases ac ON ao.id = ac.output_id AND ac.created_at > NOW() - INTERVAL '30 days'
LEFT JOIN red_team_tests rt ON m.id = rt.model_id AND rt.started_at > NOW() - INTERVAL '30 days'
GROUP BY m.id, m.name, m.version, m.model_type, m.status, m.deployed_at
ORDER BY m.deployed_at DESC;

CREATE OR REPLACE VIEW abuse_case_summary AS
SELECT 
    DATE_TRUNC('day', created_at) as report_date,
    abuse_type,
    severity,
    COUNT(*) as total_reports,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_reports,
    COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed_reports,
    AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at))/3600) as avg_resolution_hours
FROM abuse_cases
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), abuse_type, severity
ORDER BY report_date DESC, severity DESC;

-- Functions for AI governance calculations
CREATE OR REPLACE FUNCTION calculate_model_health_score(
    model_id_param UUID
) RETURNS DECIMAL AS $$
DECLARE
    health_score DECIMAL := 100;
    error_rate DECIMAL;
    drift_alerts INTEGER;
    abuse_reports INTEGER;
    red_team_pass_rate DECIMAL;
BEGIN
    -- Calculate error rate (last 7 days)
    SELECT 
        COALESCE(COUNT(*) FILTER (WHERE flagged = true) * 100.0 / NULLIF(COUNT(*), 0), 0)
    INTO error_rate
    FROM ai_outputs 
    WHERE model_id = model_id_param 
    AND created_at > NOW() - INTERVAL '7 days';
    
    -- Count drift alerts (last 7 days)
    SELECT COUNT(*) INTO drift_alerts
    FROM embedding_drift 
    WHERE model_id = model_id_param 
    AND status IN ('warning', 'critical')
    AND detected_at > NOW() - INTERVAL '7 days';
    
    -- Count abuse reports (last 7 days)
    SELECT COUNT(*) INTO abuse_reports
    FROM abuse_cases ac
    JOIN ai_outputs ao ON ac.output_id = ao.id
    WHERE ao.model_id = model_id_param 
    AND ac.created_at > NOW() - INTERVAL '7 days';
    
    -- Get red-team pass rate (last 30 days)
    SELECT COALESCE(AVG(pass_rate), 100) INTO red_team_pass_rate
    FROM red_team_tests 
    WHERE model_id = model_id_param 
    AND status = 'completed'
    AND started_at > NOW() - INTERVAL '30 days';
    
    -- Calculate health score
    health_score := health_score - (error_rate * 0.5); -- Deduct for error rate
    health_score := health_score - (drift_alerts * 5); -- Deduct 5 points per drift alert
    health_score := health_score - (abuse_reports * 2); -- Deduct 2 points per abuse report
    health_score := health_score - ((100 - red_team_pass_rate) * 0.3); -- Deduct for failed red-team tests
    
    RETURN GREATEST(0, health_score);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION detect_model_anomalies(
    model_id_param UUID,
    lookback_hours INTEGER DEFAULT 24
) RETURNS TABLE(
    anomaly_type VARCHAR,
    severity VARCHAR,
    description TEXT,
    detected_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Check for sudden increase in error rate
    IF EXISTS (
        SELECT 1 FROM ai_outputs 
        WHERE model_id = model_id_param 
        AND created_at > NOW() - (lookback_hours || ' hours')::INTERVAL
        AND flagged = true
        HAVING COUNT(*) > (
            SELECT COUNT(*) * 2 FROM ai_outputs 
            WHERE model_id = model_id_param 
            AND created_at BETWEEN NOW() - (lookback_hours * 2 || ' hours')::INTERVAL 
            AND NOW() - (lookback_hours || ' hours')::INTERVAL
        )
    ) THEN
        RETURN QUERY SELECT 
            'error_rate_spike'::VARCHAR,
            'high'::VARCHAR,
            'Sudden increase in error rate detected'::TEXT,
            NOW();
    END IF;
    
    -- Check for performance degradation
    IF EXISTS (
        SELECT 1 FROM ai_outputs 
        WHERE model_id = model_id_param 
        AND created_at > NOW() - (lookback_hours || ' hours')::INTERVAL
        HAVING AVG(processing_time) > (
            SELECT AVG(processing_time) * 1.5 FROM ai_outputs 
            WHERE model_id = model_id_param 
            AND created_at BETWEEN NOW() - (lookback_hours * 2 || ' hours')::INTERVAL 
            AND NOW() - (lookback_hours || ' hours')::INTERVAL
        )
    ) THEN
        RETURN QUERY SELECT 
            'performance_degradation'::VARCHAR,
            'medium'::VARCHAR,
            'Processing time has increased significantly'::TEXT,
            NOW();
    END IF;
    
    -- Check for confidence score drops
    IF EXISTS (
        SELECT 1 FROM ai_outputs 
        WHERE model_id = model_id_param 
        AND created_at > NOW() - (lookback_hours || ' hours')::INTERVAL
        HAVING AVG(confidence) < (
            SELECT AVG(confidence) * 0.8 FROM ai_outputs 
            WHERE model_id = model_id_param 
            AND created_at BETWEEN NOW() - (lookback_hours * 2 || ' hours')::INTERVAL 
            AND NOW() - (lookback_hours || ' hours')::INTERVAL
        )
    ) THEN
        RETURN QUERY SELECT 
            'confidence_drop'::VARCHAR,
            'medium'::VARCHAR,
            'Average confidence scores have dropped significantly'::TEXT,
            NOW();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to generate governance compliance report
CREATE OR REPLACE FUNCTION generate_compliance_report(
    start_date DATE DEFAULT NOW() - INTERVAL '30 days',
    end_date DATE DEFAULT NOW()
) RETURNS TABLE(
    metric_name VARCHAR,
    metric_value DECIMAL,
    compliance_status VARCHAR,
    notes TEXT
) AS $$
BEGIN
    -- Model coverage
    RETURN QUERY SELECT 
        'active_models_with_monitoring'::VARCHAR,
        (SELECT COUNT(*) FROM ai_models WHERE status = 'active')::DECIMAL,
        CASE WHEN (SELECT COUNT(*) FROM ai_models WHERE status = 'active') > 0 THEN 'compliant' ELSE 'non_compliant' END::VARCHAR,
        'All active models should have monitoring enabled'::TEXT;
    
    -- Red-team testing coverage
    RETURN QUERY SELECT 
        'models_with_recent_red_team_tests'::VARCHAR,
        (SELECT COUNT(DISTINCT model_id) FROM red_team_tests WHERE started_at >= start_date)::DECIMAL,
        CASE WHEN (SELECT COUNT(DISTINCT model_id) FROM red_team_tests WHERE started_at >= start_date) >= 
                  (SELECT COUNT(*) FROM ai_models WHERE status = 'active') * 0.8 
             THEN 'compliant' ELSE 'non_compliant' END::VARCHAR,
        'At least 80% of active models should have red-team tests in the reporting period'::TEXT;
    
    -- Abuse response time
    RETURN QUERY SELECT 
        'avg_abuse_response_time_hours'::VARCHAR,
        (SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at))/3600) 
         FROM abuse_cases WHERE created_at >= start_date)::DECIMAL,
        CASE WHEN (SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at))/3600) 
                   FROM abuse_cases WHERE created_at >= start_date) <= 48 
             THEN 'compliant' ELSE 'non_compliant' END::VARCHAR,
        'Abuse cases should be resolved within 48 hours'::TEXT;
    
    -- Drift monitoring
    RETURN QUERY SELECT 
        'models_with_drift_monitoring'::VARCHAR,
        (SELECT COUNT(DISTINCT model_id) FROM embedding_drift WHERE detected_at >= start_date)::DECIMAL,
        CASE WHEN (SELECT COUNT(DISTINCT model_id) FROM embedding_drift WHERE detected_at >= start_date) >= 
                  (SELECT COUNT(*) FROM ai_models WHERE model_type = 'embedding' AND status = 'active') 
             THEN 'compliant' ELSE 'non_compliant' END::VARCHAR,
        'All embedding models should have drift monitoring'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;