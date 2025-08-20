-- Create dmca_takedowns table
CREATE TABLE IF NOT EXISTS dmca_takedowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_email TEXT NOT NULL,
    urls TEXT[] NOT NULL,
    content_ids UUID[] NULL,
    reason TEXT NOT NULL,
    evidence_urls TEXT[] NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'acknowledged', 'removed', 'rejected')) DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_dmca_takedowns_status ON dmca_takedowns(status);
CREATE INDEX IF NOT EXISTS idx_dmca_takedowns_created_at ON dmca_takedowns(created_at);