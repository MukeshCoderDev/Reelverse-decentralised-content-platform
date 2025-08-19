-- Migration: 002_create_credits_holds_and_escrow.sql
-- Create tables for credits, holds, and escrow with idempotency checks.

DO $$
BEGIN

    -- Create credits table
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credits') THEN
        CREATE TABLE credits (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            currency TEXT NOT NULL DEFAULT 'USDC',
            balance BIGINT NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_credits_user_currency ON credits (user_id, currency);
        CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits (user_id);

        -- Add tx_ref for idempotency on addCredit
        ALTER TABLE credits ADD COLUMN IF NOT EXISTS tx_ref TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_credits_user_currency_tx_ref ON credits (user_id, currency, tx_ref) WHERE tx_ref IS NOT NULL;

        -- Function to update updated_at column
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Trigger for updated_at on credits table
        CREATE TRIGGER update_credits_updated_at
        BEFORE UPDATE ON credits
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Create holds table
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'holds') THEN
        CREATE TABLE holds (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            amount BIGINT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'USDC',
            reason TEXT,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'captured', 'released', 'void')),
            tx_ref TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_holds_user_status ON holds (user_id, status);
        CREATE INDEX IF NOT EXISTS idx_holds_user_id ON holds (user_id);

        -- Trigger for updated_at on holds table
        CREATE TRIGGER update_holds_updated_at
        BEFORE UPDATE ON holds
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Create escrow table
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'escrow') THEN
        CREATE TABLE escrow (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            payer_id UUID NOT NULL,
            payee_id UUID NOT NULL,
            amount BIGINT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'USDC',
            content_id UUID,
            status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'released', 'refunded', 'void')),
            opened_at TIMESTAMPTZ DEFAULT NOW(),
            closed_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_escrow_payer_status ON escrow (payer_id, status);
        CREATE INDEX IF NOT EXISTS idx_escrow_payee_status ON escrow (payee_id, status);
        CREATE INDEX IF NOT EXISTS idx_escrow_payer_id ON escrow (payer_id);
        CREATE INDEX IF NOT EXISTS idx_escrow_payee_id ON escrow (payee_id);
    END IF;

END
$$;