# LAUNCH.md - Reelverse Release Candidate Launch Guide

This document outlines the procedures for deploying, verifying, and rolling back the Reelverse platform across different environments.

## Environments

### Local Development
*   **Purpose**: Individual developer workstations for feature development and testing.
*   **Environment Variables**:
    *   **API**:
        *   `NODE_ENV=development`
        *   `PORT=3000`
        *   `DATABASE_URL=postgresql://user:password@localhost:5432/reelverse_dev`
        *   `REDIS_URL=redis://localhost:6379`
        *   `DEV_OWNER_PRIVATE_KEY=...` (for canary script, non-prod)
        *   `BUNDLER_URL=...`
        *   `ENTRY_POINT_ADDRESS=...`
        *   `RPC_URL=...`
        *   `PAYMASTER_URL=...`
    *   **Frontend**:
        *   `VITE_API_BASE_URL=http://localhost:3000/api/v1`
        *   `VITE_AGE_GATE_ENABLED=true`
        *   `VITE_AGE_GATE_MIN_AGE=18`
        *   `VITE_AGE_GATE_REMEMBER_DAYS=30`

### Staging
*   **Purpose**: Pre-production environment for integration testing, QA, and stakeholder review. Mirrors production as closely as possible.
*   **Environment Variables**:
    *   **API**:
        *   `NODE_ENV=staging`
        *   `PORT=80`
        *   `DATABASE_URL=...` (staging DB connection string)
        *   `REDIS_URL=...` (staging Redis connection string)
        *   `DEV_OWNER_PRIVATE_KEY=...` (for canary script, non-prod)
        *   `BUNDLER_URL=...`
        *   `ENTRY_POINT_ADDRESS=...`
        *   `RPC_URL=...`
        *   `PAYMASTER_URL=...`
    *   **Frontend**:
        *   `VITE_API_BASE_URL=https://staging.reelverse.com/api/v1`
        *   `VITE_AGE_GATE_ENABLED=true`
        *   `VITE_AGE_GATE_MIN_AGE=18`
        *   `VITE_AGE_GATE_REMEMBER_DAYS=30`

### Production
*   **Purpose**: Live environment serving end-users.
*   **Environment Variables**:
    *   **API**:
        *   `NODE_ENV=production`
        *   `PORT=80`
        *   `DATABASE_URL=...` (production DB connection string)
        *   `REDIS_URL=...` (production Redis connection string)
        *   `BUNDLER_URL=...`
        *   `ENTRY_POINT_ADDRESS=...`
        *   `RPC_URL=...`
        *   `PAYMASTER_URL=...`
    *   **Frontend**:
        *   `VITE_API_BASE_URL=https://api.reelverse.com/api/v1`
        *   `VITE_AGE_GATE_ENABLED=true`
        *   `VITE_AGE_GATE_MIN_AGE=18`
        *   `VITE_AGE_GATE_REMEMBER_DAYS=30`

## Step-by-Step Deployment

1.  **Deploy Contracts**:
    *   Ensure all smart contracts are deployed to the target blockchain network (e.g., Sepolia for staging/prod).
    *   Update contract addresses in API configuration.
    *   `cd contracts && npx hardhat run scripts/deploy.ts --network <network_name>`

2.  **Run Migrations**:
    *   Apply any pending database schema migrations.
    *   `cd api && npm run migrate up`

3.  **Seed Roles**:
    *   If new roles or initial data are required, run seeding scripts.
    *   `cd api && npm run seed` (example command)

4.  **Start Services**:
    *   Deploy and start all backend API services.
    *   `cd api && npm start` (example command for local)
    *   Deploy and start frontend services.
    *   `cd frontend && npm run dev` (example command for local)

## Post-Deploy Checks

1.  **`aa:health` Check**:
    *   Verify the Account Abstraction (AA) service health.
    *   `curl -X GET http://localhost:3000/api/v1/aa/health` (adjust URL for environment)

2.  **E2E Tests**:
    *   Run end-to-end tests to validate critical user flows.
    *   `npm run test:e2e`

3.  **Billing Smoke Tests**:
    *   Perform quick checks on billing endpoints (e.g., credit, hold, escrow).
    *   `npm run test:billing-smoke` (example command)

4.  **Webhooks Ping**:
    *   Verify webhook delivery and processing.
    *   Manually trigger a test event or use a dedicated script.

5.  **Docs Verification**:
    *   Ensure OpenAPI documentation is accessible and up-to-date.
    *   `curl -X GET http://localhost:3000/api/v1/docs` (adjust URL for environment)

## Rollback Plan

In case of critical issues post-deployment:

1.  **Revert Deploy**:
    *   Rollback the deployed code to the previous stable version using your CI/CD system's rollback functionality.

2.  **Restore DB from Point-in-Time**:
    *   If database changes were part of the deployment and are causing issues, restore the database to a point-in-time backup taken just before the deployment.
    *   **DANGER**: This will lose any data written since the backup. Use with extreme caution.