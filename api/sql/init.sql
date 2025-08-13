-- Reelverse Database Initialization
-- This file is automatically executed when the PostgreSQL container starts

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create database user if not exists (for production)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'reelverse_api') THEN
        CREATE ROLE reelverse_api WITH LOGIN PASSWORD 'secure_password_change_in_production';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE reelverse_db TO reelverse_api;
GRANT USAGE ON SCHEMA public TO reelverse_api;
GRANT CREATE ON SCHEMA public TO reelverse_api;

-- The actual table creation will be handled by the API initialization
-- This ensures the database is ready for the API to connect and create its schema