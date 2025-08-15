-- Payment Compliance Schema
-- This schema supports 3DS/SCA, VAT/GST, tax forms, chargebacks, and international payments

-- Enhanced payment transactions table with compliance fields
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('card', 'crypto', 'bank_transfer')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'disputed', 'refunded')),
    gateway_transaction_id VARCHAR(255),
    
    -- 3DS/SCA fields
    three_ds_required BOOLEAN DEFAULT false,
    three_ds_status VARCHAR(20) CHECK (three_ds_status IN ('pending', 'authenticated', 'failed', 'bypassed')),
    sca_exemption VARCHAR(20) CHECK (sca_exemption IN ('low_value', 'trusted_merchant', 'recurring', 'corporate')),
    
    -- VAT/GST fields
    vat_amount DECIMAL(12,2) DEFAULT 0,
    vat_rate DECIMAL(5,2) DEFAULT 0,
    vat_country VARCHAR(2),
    reverse_charge BOOLEAN DEFAULT false,
    
    -- Receipt fields
    receipt_generated BOOLEAN DEFAULT false,
    receipt_url TEXT,
    receipt_number VARCHAR(100),
    
    -- International payment fields
    original_amount DECIMAL(12,2),
    original_currency VARCHAR(3),
    exchange_rate DECIMAL(10,6),
    international_fees DECIMAL(12,2) DEFAULT 0,
    
    -- Compliance fields
    compliance_checks JSONB,
    risk_score INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tax forms table
CREATE TABLE IF NOT EXISTS tax_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    form_type VARCHAR(10) NOT NULL CHECK (form_type IN ('W9', 'W8BEN', 'W8BENE', 'W8ECI', 'W8IMY')),
    tax_year INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
    form_data JSONB NOT NULL,
    document_url TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, form_type, tax_year)
);

-- VAT configurations table
CREATE TABLE IF NOT EXISTS vat_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country VARCHAR(2) NOT NULL UNIQUE,
    vat_rate DECIMAL(5,2) NOT NULL,
    threshold DECIMAL(12,2) NOT NULL DEFAULT 0,
    registration_number VARCHAR(50),
    enabled BOOLEAN NOT NULL DEFAULT true,
    reverse_charge BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Chargeback cases table
CREATE TABLE IF NOT EXISTS chargeback_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    user_id UUID NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    reason TEXT NOT NULL,
    reason_code VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'under_review', 'accepted', 'disputed', 'won', 'lost')),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    evidence_submitted BOOLEAN DEFAULT false,
    evidence_url TEXT,
    gateway_chargeback_id VARCHAR(255),
    resolution_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Purchase items table (for receipt generation)
CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    content_id UUID,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    vat_rate DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Customer communications table (for chargeback evidence)
CREATE TABLE IF NOT EXISTS customer_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    communication_type VARCHAR(50) NOT NULL CHECK (communication_type IN ('email', 'chat', 'phone', 'support_ticket')),
    subject TEXT,
    content TEXT NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    staff_member_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Content access logs table (for delivery proof)
CREATE TABLE IF NOT EXISTS content_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    content_id UUID NOT NULL,
    transaction_id UUID,
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('view', 'download', 'stream')),
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Payment method details table
CREATE TABLE IF NOT EXISTS payment_method_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    payment_method_type VARCHAR(50) NOT NULL,
    last_four VARCHAR(4),
    brand VARCHAR(50),
    country VARCHAR(2),
    fingerprint VARCHAR(255),
    is_default BOOLEAN DEFAULT false,
    expires_at DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3DS authentication logs table
CREATE TABLE IF NOT EXISTS three_ds_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    challenge_id VARCHAR(255),
    authentication_status VARCHAR(20) NOT NULL,
    liability_shift BOOLEAN DEFAULT false,
    eci VARCHAR(2), -- Electronic Commerce Indicator
    cavv VARCHAR(255), -- Cardholder Authentication Verification Value
    xid VARCHAR(255), -- Transaction Identifier
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- International payment compliance table
CREATE TABLE IF NOT EXISTS international_compliance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    source_country VARCHAR(2) NOT NULL,
    destination_country VARCHAR(2) NOT NULL,
    compliance_checks JSONB NOT NULL,
    aml_status VARCHAR(20) DEFAULT 'pending' CHECK (aml_status IN ('pending', 'approved', 'flagged', 'rejected')),
    sanctions_screening BOOLEAN DEFAULT false,
    high_risk_country BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_id ON payment_transactions(gateway_transaction_id);

CREATE INDEX IF NOT EXISTS idx_tax_forms_user_id ON tax_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_forms_status ON tax_forms(status);
CREATE INDEX IF NOT EXISTS idx_tax_forms_expires_at ON tax_forms(expires_at);

CREATE INDEX IF NOT EXISTS idx_chargeback_cases_transaction_id ON chargeback_cases(transaction_id);
CREATE INDEX IF NOT EXISTS idx_chargeback_cases_user_id ON chargeback_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_chargeback_cases_status ON chargeback_cases(status);
CREATE INDEX IF NOT EXISTS idx_chargeback_cases_due_date ON chargeback_cases(due_date);

CREATE INDEX IF NOT EXISTS idx_purchase_items_transaction_id ON purchase_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_content_id ON purchase_items(content_id);

CREATE INDEX IF NOT EXISTS idx_customer_communications_user_id ON customer_communications(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_communications_created_at ON customer_communications(created_at);

CREATE INDEX IF NOT EXISTS idx_content_access_logs_user_id ON content_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_content_access_logs_transaction_id ON content_access_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_content_access_logs_created_at ON content_access_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_payment_method_details_user_id ON payment_method_details(user_id);

CREATE INDEX IF NOT EXISTS idx_three_ds_logs_transaction_id ON three_ds_logs(transaction_id);

CREATE INDEX IF NOT EXISTS idx_international_compliance_transaction_id ON international_compliance(transaction_id);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payment_transactions_updated_at 
    BEFORE UPDATE ON payment_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_forms_updated_at 
    BEFORE UPDATE ON tax_forms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vat_configurations_updated_at 
    BEFORE UPDATE ON vat_configurations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chargeback_cases_updated_at 
    BEFORE UPDATE ON chargeback_cases 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_method_details_updated_at 
    BEFORE UPDATE ON payment_method_details 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for compliance reporting
CREATE OR REPLACE VIEW payment_compliance_summary AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    currency,
    COUNT(*) as total_transactions,
    SUM(amount) as total_amount,
    COUNT(*) FILTER (WHERE three_ds_required = true) as three_ds_transactions,
    COUNT(*) FILTER (WHERE three_ds_status = 'authenticated') as three_ds_authenticated,
    COUNT(*) FILTER (WHERE vat_amount > 0) as vat_transactions,
    SUM(vat_amount) as total_vat_collected,
    COUNT(*) FILTER (WHERE receipt_generated = true) as receipts_generated,
    COUNT(*) FILTER (WHERE status = 'disputed') as disputed_transactions
FROM payment_transactions
GROUP BY DATE_TRUNC('month', created_at), currency
ORDER BY month DESC, currency;

CREATE OR REPLACE VIEW tax_compliance_summary AS
SELECT 
    form_type,
    tax_year,
    COUNT(*) as total_submissions,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_forms,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_forms,
    COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_forms
FROM tax_forms
GROUP BY form_type, tax_year
ORDER BY tax_year DESC, form_type;

CREATE OR REPLACE VIEW chargeback_summary AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    currency,
    COUNT(*) as total_chargebacks,
    SUM(amount) as total_chargeback_amount,
    COUNT(*) FILTER (WHERE status = 'won') as chargebacks_won,
    COUNT(*) FILTER (WHERE status = 'lost') as chargebacks_lost,
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/86400) as avg_resolution_days
FROM chargeback_cases
WHERE resolved_at IS NOT NULL
GROUP BY DATE_TRUNC('month', created_at), currency
ORDER BY month DESC, currency;

-- Insert default VAT configurations
INSERT INTO vat_configurations (country, vat_rate, threshold, enabled, reverse_charge) VALUES
    ('DE', 19.00, 0, true, true),   -- Germany
    ('FR', 20.00, 0, true, true),   -- France
    ('GB', 20.00, 0, true, false),  -- United Kingdom
    ('ES', 21.00, 0, true, true),   -- Spain
    ('IT', 22.00, 0, true, true),   -- Italy
    ('NL', 21.00, 0, true, true),   -- Netherlands
    ('BE', 21.00, 0, true, true),   -- Belgium
    ('AT', 20.00, 0, true, true),   -- Austria
    ('SE', 25.00, 0, true, true),   -- Sweden
    ('DK', 25.00, 0, true, true),   -- Denmark
    ('FI', 24.00, 0, true, true),   -- Finland
    ('NO', 25.00, 0, true, false),  -- Norway (not EU)
    ('CH', 7.70, 0, true, false),   -- Switzerland
    ('CA', 13.00, 0, true, false),  -- Canada (HST average)
    ('AU', 10.00, 0, true, false),  -- Australia (GST)
    ('NZ', 15.00, 0, true, false),  -- New Zealand (GST)
    ('JP', 10.00, 0, true, false),  -- Japan
    ('US', 0.00, 0, false, false)   -- United States (no federal VAT)
ON CONFLICT (country) DO NOTHING;

-- Functions for compliance calculations
CREATE OR REPLACE FUNCTION calculate_vat_amount(
    base_amount DECIMAL,
    vat_rate DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    RETURN ROUND((base_amount * vat_rate / 100), 2);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_3ds_required(
    amount DECIMAL,
    currency VARCHAR(3),
    customer_country VARCHAR(2)
) RETURNS BOOLEAN AS $$
BEGIN
    -- EU SCA requirements
    IF currency = 'EUR' AND amount > 30 THEN
        RETURN true;
    END IF;
    
    -- UK requirements
    IF currency = 'GBP' AND amount > 30 THEN
        RETURN true;
    END IF;
    
    -- Default to false for other cases
    RETURN false;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_receipt_number(
    transaction_id UUID
) RETURNS VARCHAR AS $$
DECLARE
    receipt_number VARCHAR;
BEGIN
    receipt_number := 'RV-' || EXTRACT(YEAR FROM NOW()) || '-' || 
                     LPAD(EXTRACT(DOY FROM NOW())::TEXT, 3, '0') || '-' ||
                     UPPER(SUBSTRING(transaction_id::TEXT FROM 1 FOR 8));
    RETURN receipt_number;
END;
$$ LANGUAGE plpgsql;

-- Compliance monitoring functions
CREATE OR REPLACE FUNCTION check_tax_form_expiry()
RETURNS TABLE(user_id UUID, form_type VARCHAR, expires_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
    RETURN QUERY
    SELECT tf.user_id, tf.form_type, tf.expires_at
    FROM tax_forms tf
    WHERE tf.expires_at <= NOW() + INTERVAL '30 days'
    AND tf.status = 'approved';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_chargeback_rate(
    user_id_param UUID DEFAULT NULL,
    days_back INTEGER DEFAULT 90
) RETURNS DECIMAL AS $$
DECLARE
    total_transactions INTEGER;
    total_chargebacks INTEGER;
    chargeback_rate DECIMAL;
BEGIN
    -- Get total transactions
    SELECT COUNT(*) INTO total_transactions
    FROM payment_transactions pt
    WHERE (user_id_param IS NULL OR pt.user_id = user_id_param)
    AND pt.created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND pt.status IN ('completed', 'disputed');
    
    -- Get total chargebacks
    SELECT COUNT(*) INTO total_chargebacks
    FROM chargeback_cases cc
    WHERE (user_id_param IS NULL OR cc.user_id = user_id_param)
    AND cc.created_at >= NOW() - (days_back || ' days')::INTERVAL;
    
    -- Calculate rate
    IF total_transactions > 0 THEN
        chargeback_rate := (total_chargebacks::DECIMAL / total_transactions::DECIMAL) * 100;
    ELSE
        chargeback_rate := 0;
    END IF;
    
    RETURN ROUND(chargeback_rate, 2);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;