-- Scene Consent Management Schema
-- This schema supports multi-participant consent tracking for adult content

-- Scenes table to track content scenes requiring consent
CREATE TABLE scenes (
    scene_hash VARCHAR(66) PRIMARY KEY, -- bytes32 hash as hex string
    content_title VARCHAR(500) NOT NULL,
    content_description TEXT,
    creator_wallet VARCHAR(42) NOT NULL,
    total_participants INTEGER NOT NULL DEFAULT 0,
    consented_participants INTEGER NOT NULL DEFAULT 0,
    consent_complete BOOLEAN NOT NULL DEFAULT FALSE,
    terms_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Scene participants table
CREATE TABLE scene_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_hash VARCHAR(66) NOT NULL REFERENCES scenes(scene_hash) ON DELETE CASCADE,
    participant_wallet VARCHAR(42) NOT NULL,
    participant_role VARCHAR(20) NOT NULL CHECK (participant_role IN ('performer', 'director', 'producer')),
    consent_required BOOLEAN NOT NULL DEFAULT TRUE,
    consent_provided BOOLEAN NOT NULL DEFAULT FALSE,
    consent_timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(scene_hash, participant_wallet)
);

-- Consent signatures table for storing encrypted consent data
CREATE TABLE consent_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_hash VARCHAR(66) NOT NULL,
    participant_wallet VARCHAR(42) NOT NULL,
    signature_data TEXT NOT NULL, -- EIP-712 signature
    encrypted_consent_data TEXT NOT NULL, -- Encrypted ConsentData JSON
    consent_date TIMESTAMP NOT NULL,
    terms_version VARCHAR(20) NOT NULL,
    document_hashes TEXT[], -- Array of document hash references
    verification_status VARCHAR(20) NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'revoked', 'disputed')),
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP,
    revocation_reason TEXT,
    UNIQUE(scene_hash, participant_wallet),
    FOREIGN KEY (scene_hash, participant_wallet) REFERENCES scene_participants(scene_hash, participant_wallet)
);

-- Consent audit log for compliance tracking
CREATE TABLE consent_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_hash VARCHAR(66) NOT NULL,
    participant_wallet VARCHAR(42),
    action VARCHAR(50) NOT NULL, -- 'consent_provided', 'consent_revoked', 'scene_created', etc.
    actor_wallet VARCHAR(42), -- Who performed the action
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_scenes_creator ON scenes(creator_wallet);
CREATE INDEX idx_scenes_created_at ON scenes(created_at);
CREATE INDEX idx_scene_participants_scene ON scene_participants(scene_hash);
CREATE INDEX idx_scene_participants_wallet ON scene_participants(participant_wallet);
CREATE INDEX idx_consent_signatures_scene ON consent_signatures(scene_hash);
CREATE INDEX idx_consent_signatures_participant ON consent_signatures(participant_wallet);
CREATE INDEX idx_consent_signatures_status ON consent_signatures(verification_status);
CREATE INDEX idx_consent_audit_scene ON consent_audit_log(scene_hash);
CREATE INDEX idx_consent_audit_timestamp ON consent_audit_log(timestamp);

-- Function to update scene consent completion status
CREATE OR REPLACE FUNCTION update_scene_consent_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the scenes table with current consent counts
    UPDATE scenes 
    SET 
        consented_participants = (
            SELECT COUNT(*) 
            FROM scene_participants sp
            JOIN consent_signatures cs ON sp.scene_hash = cs.scene_hash 
                AND sp.participant_wallet = cs.participant_wallet
            WHERE sp.scene_hash = NEW.scene_hash 
                AND cs.verification_status = 'verified'
        ),
        consent_complete = (
            SELECT COUNT(*) 
            FROM scene_participants 
            WHERE scene_hash = NEW.scene_hash AND consent_required = TRUE
        ) = (
            SELECT COUNT(*) 
            FROM scene_participants sp
            JOIN consent_signatures cs ON sp.scene_hash = cs.scene_hash 
                AND sp.participant_wallet = cs.participant_wallet
            WHERE sp.scene_hash = NEW.scene_hash 
                AND sp.consent_required = TRUE
                AND cs.verification_status = 'verified'
        ),
        updated_at = NOW()
    WHERE scene_hash = NEW.scene_hash;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to maintain consent status
CREATE TRIGGER trigger_update_consent_status_on_signature
    AFTER INSERT OR UPDATE ON consent_signatures
    FOR EACH ROW
    EXECUTE FUNCTION update_scene_consent_status();

CREATE TRIGGER trigger_update_consent_status_on_participant
    AFTER INSERT OR UPDATE ON scene_participants
    FOR EACH ROW
    EXECUTE FUNCTION update_scene_consent_status();

-- Function to log consent actions for audit trail
CREATE OR REPLACE FUNCTION log_consent_action()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO consent_audit_log (scene_hash, participant_wallet, action, details)
        VALUES (NEW.scene_hash, NEW.participant_wallet, 'consent_provided', 
                jsonb_build_object('terms_version', NEW.terms_version, 'consent_date', NEW.consent_date));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.verification_status = 'verified' AND NEW.verification_status = 'revoked' THEN
            INSERT INTO consent_audit_log (scene_hash, participant_wallet, action, details)
            VALUES (NEW.scene_hash, NEW.participant_wallet, 'consent_revoked',
                    jsonb_build_object('revocation_reason', NEW.revocation_reason, 'revoked_at', NEW.revoked_at));
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for audit logging
CREATE TRIGGER trigger_log_consent_actions
    AFTER INSERT OR UPDATE ON consent_signatures
    FOR EACH ROW
    EXECUTE FUNCTION log_consent_action();

-- View for easy consent status checking
CREATE VIEW scene_consent_status AS
SELECT 
    s.scene_hash,
    s.content_title,
    s.creator_wallet,
    s.total_participants,
    s.consented_participants,
    s.consent_complete,
    s.terms_version,
    ROUND(
        CASE 
            WHEN s.total_participants > 0 
            THEN (s.consented_participants::DECIMAL / s.total_participants) * 100 
            ELSE 0 
        END, 2
    ) as completion_percentage,
    s.created_at,
    s.updated_at
FROM scenes s;

-- View for participant consent details
CREATE VIEW participant_consent_details AS
SELECT 
    sp.scene_hash,
    sp.participant_wallet,
    sp.participant_role,
    sp.consent_required,
    sp.consent_provided,
    cs.consent_date,
    cs.terms_version,
    cs.verification_status,
    cs.created_at as consent_created_at,
    cs.revoked_at,
    cs.revocation_reason
FROM scene_participants sp
LEFT JOIN consent_signatures cs ON sp.scene_hash = cs.scene_hash 
    AND sp.participant_wallet = cs.participant_wallet;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON scenes TO app_user;
-- GRANT SELECT, INSERT, UPDATE ON scene_participants TO app_user;
-- GRANT SELECT, INSERT, UPDATE ON consent_signatures TO app_user;
-- GRANT SELECT, INSERT ON consent_audit_log TO app_user;
-- GRANT SELECT ON scene_consent_status TO app_user;
-- GRANT SELECT ON participant_consent_details TO app_user;