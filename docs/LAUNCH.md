# LAUNCH.md - Reelverse Release Candidate Launch Plan

This document outlines the step-by-step process for deploying and validating the Reelverse Release Candidate across different environments, along with a rollback strategy.

## 1. Environments

### Local Development
- **Purpose:** Local development and testing.
- **Environment Variables:**
    - **API:**
        - `PORT`: 3000
        - `DATABASE_URL`: `postgresql://user:password@localhost:5432/reelverse_dev`
        - `REDIS_URL`: `redis://localhost:6379`
        - `DEV_OWNER_PRIVATE_KEY`: (Required for canary script, non-prod)
        - `BUNDLER_URL`: (Required for canary script)
        - `ENTRY_POINT_ADDRESS`: (Required for canary script)
        - `RPC_URL`: (Required for canary script)
        - `PAYMASTER_URL`: (Optional, for canary script if needed)
        - `LOG_LEVEL`: debug
    - **Frontend:**
        - `VITE_API_BASE_URL`: `http://localhost:3000/api/v1`
        - `VITE_AGE_GATE_ENABLED`: true
        - `VITE_AGE_GATE_MIN_AGE`: 18
        - `VITE_AGE_GATE_REMEMBER_DAYS`: 30

### Staging
- **Purpose:** Pre-production testing, integration, and UAT.
- **Environment Variables:**
    - **API:**
        - `PORT`: 80
        - `DATABASE_URL`: (Staging DB connection string)
        - `REDIS_URL`: (Staging Redis connection string)
        - `DEV_OWNER_PRIVATE_KEY`: (Required for canary script, non-prod)
        - `BUNDLER_URL`: (Required for canary script)
        - `ENTRY_POINT_ADDRESS`: (Required for canary script)
        - `RPC_URL`: (Required for canary script)
        - `PAYMASTER_URL`: (Optional, for canary script if needed)
        - `LOG_LEVEL`: info
    - **Frontend:**
        - `VITE_API_BASE_URL`: `https://staging.reelverse.com/api/v1`
        - `VITE_AGE_GATE_ENABLED`: true
        - `VITE_AGE_GATE_MIN_AGE`: 18
        - `VITE_AGE_GATE_REMEMBER_DAYS`: 30

### Production
- **Purpose:** Live environment for end-users.
- **Environment Variables:**
    - **API:**
        - `PORT`: 80
        - `DATABASE_URL`: (Production DB connection string)
        - `REDIS_URL`: (Production Redis connection string)
        - `LOG_LEVEL`: warn
    - **Frontend:**
        - `VITE_API_BASE_URL`: `https://api.reelverse.com/api/v1`
        - `VITE_AGE_GATE_ENABLED`: true
        - `VITE_AGE_GATE_MIN_AGE`: 18
        - `VITE_AGE_GATE_REMEMBER_DAYS`: 30

## 2. Step-by-Step Deployment

1.  **Deploy Contracts:**
    - Ensure all smart contracts are deployed to the target blockchain network (e.g., Sepolia for testing, Mainnet for production).
    - Update contract addresses in the API configuration.
    ```bash
    # Example (adjust based on actual contract deployment scripts)
    cd contracts
    npx hardhat run scripts/deploy.ts --network <network_name>
    ```

2.  **Run Migrations:**
    - Apply all pending database migrations to the target database.
    ```bash
    # Example (adjust based on actual migration tool)
    cd api
    npm run migrate up
    ```

3.  **Seed Roles:**
    - Execute scripts to seed initial user roles and permissions if necessary.
    ```bash
    # Example
    cd api
    npm run seed:roles
    ```

4.  **Start Services:**
    - Deploy and start all backend API services.
    - Deploy and start the frontend application.
    ```bash
    # Example for API (e.g., using PM2 or Kubernetes)
    cd api
    npm run start

    # Example for Frontend (e.g., using a web server like Nginx or a CDN)
    cd frontend
    npm run build
    # Deploy 'dist' folder
    ```

## 3. Post-Deploy Checks

After deployment, perform the following checks to ensure system health and functionality:

1.  **API Health Check:**
    - Verify the API is responsive and healthy.
    ```bash
    curl -v GET https://api.reelverse.com/api/v1/health
    ```

2.  **End-to-End (E2E) Tests:**
    - Run a suite of E2E tests to validate critical user flows.
    ```bash
    # Example
    npm run test:e2e
    ```

3.  **Billing Smoke Tests:**
    - Perform a quick smoke test on billing endpoints (e.g., credit, hold, escrow) to ensure basic functionality.
    ```bash
    # Manual test or dedicated script
    curl -X POST -H "Content-Type: application/json" -d '{"amount": 100}' https://api.reelverse.com/api/v1/billing/credit
    ```

4.  **Webhooks Ping:**
    - Verify that webhook endpoints are correctly configured and receiving pings.
    ```bash
    # Check webhook logs or trigger a test event
    ```

5.  **Canary Health Check:**
    - Run the sponsored user operation canary script to ensure bundler and paymaster integrations are working.
    ```bash
    cd api
    npm run canary:aa
    ```

## 4. Rollback Plan

In case of critical issues post-deployment, follow these steps to revert to the previous stable state:

1.  **Revert Deploy:**
    - Rollback the deployed application code to the previous stable version. This typically involves reverting the deployment artifact or Git commit.
    ```bash
    # Example (Kubernetes)
    kubectl rollout undo deployment/reelverse-api
    # Example (GitOps)
    git revert <bad_commit_hash> && git push
    ```

2.  **Restore Database from Point-in-Time:**
    - If database schema changes or data corruption occurred, restore the database to a point in time before the problematic deployment.
    - **WARNING:** This will result in data loss for transactions that occurred after the restore point.
    ```bash
    # Example (PostgreSQL with pg_restore)
    pg_restore -h <db_host> -p <db_port> -U <db_user> -d <db_name> -F c -v "path/to/backup.dump"
    ```
    - Ensure you have recent database backups.