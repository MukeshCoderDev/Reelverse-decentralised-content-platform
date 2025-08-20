# Reelverse Decentralized Content Platform

This repository contains the backend API, smart contracts, and frontend for the Reelverse decentralized content platform.

## Quickstart

To get the project up and running locally:

1.  **Clone the repository:**
    `git clone https://github.com/your-org/reelverse.git`
    `cd reelverse`

2.  **Copy environment variables:**
    `cp api/.env.example api/.env`
    `cp .env.example .env.local`

3.  **Start Docker services (Postgres, Redis):**
    `docker-compose up -d`

4.  **Install dependencies and run API migrations:**
    ```bash
    npm install # Install root dependencies
    cd api
    npm install # Install API dependencies
    npm run migrate # Run database migrations
    cd ..
    ```

5.  **Start API and Frontend in development mode:**
    ```bash
    # In one terminal, start the API
    cd api
    npm run dev
    # In another terminal, start the frontend
    cd ..
    npm run dev
    ```

    The API will be available at `http://localhost:3001` and the frontend at `http://localhost:5173`.

6.  **Sponsor a transaction (optional):**
    To test gasless transactions, you can use the `sponsor-tx` script:
    ```bash
    cd scripts/aa
    npm install # Install script dependencies
    npm run sponsor-tx
    ```

## Scripts

Here's a table of useful scripts:

| Script          | Location | Description                                                              |
| :-------------- | :------- | :----------------------------------------------------------------------- |
| `migrate`       | `api/`   | Runs database migrations for the API.                                    |
| `test:api`      | `api/`   | Runs all unit and integration tests for the API.                         |
| `e2e:api`       | `api/`   | Runs end-to-end tests for the API (requires specific env vars/secrets).  |
| `aa:health`     | `scripts/aa/` | Checks the health and configuration of Account Abstraction components. |
| `canary:aa`     | `api/scripts/canary/` | Runs an hourly sponsored User Operation health check (non-prod). |

## CI/CD Overview (GitHub Actions)

This repository uses GitHub Actions for Continuous Integration (CI). The workflow is defined in `.github/workflows/ci.yml`.

The CI pipeline includes the following jobs:

*   **`api`**: Builds and tests the API service. It sets up Node.js 20.x, caches npm dependencies, and uses Docker services for PostgreSQL and Redis. It runs database migrations and then executes API tests (`npm run test:api`).
*   **`contracts`**: Installs dependencies, compiles, and tests the smart contracts.
*   **`frontend`**: Installs dependencies, performs type checking, linting, and builds the frontend application.
*   **`e2e`**: Runs end-to-end tests specifically for the API. This job is conditional and only runs on the `main` branch if certain GitHub secrets are provided.

### Enabling E2E Tests in CI

The `e2e` job requires the following GitHub Secrets to be configured in your repository settings (`Settings > Secrets and variables > Actions`):

*   `BUNDLER_URL`: The URL of the bundler service (e.g., Biconomy, Alchemy).
*   `ENTRY_POINT_ADDRESS`: The address of the EntryPoint contract.
*   `DEV_OWNER_PRIVATE_KEY`: The private key of the E2E test owner account. **WARNING: Do NOT use a production private key here.** This is for testing purposes only.
*   `RPC_URL`: An RPC URL for the Sepolia network (or your target testnet).
*   `PAYMASTER_URL`: The URL of the paymaster service (e.g., Biconomy, Alchemy).

Without these secrets, the `e2e` job will be skipped.

## Age-Gate Interstitial

The frontend includes an 18+ age-gate interstitial to restrict access to sensitive content.

*   **Toggle**: The age-gate is controlled by the `VITE_AGE_GATE_ENABLED` environment variable in the frontend's `.env` file. Set to `true` to enable, `false` to disable.
*   **Remember Period**: The acceptance of the age-gate is remembered for a configurable number of days, specified by `VITE_AGE_GATE_REMEMBER_DAYS` (default: 30 days). This preference is persisted in `localStorage` and a cookie.

## Documentation

*   **Launch Guide**: Detailed steps for deploying and managing the platform: [`docs/LAUNCH.md`](docs/LAUNCH.md)
*   **Alerts Runbook**: Procedures for responding to critical system alerts: [`docs/runbooks/alerts.md`](docs/runbooks/alerts.md)
*   **Legal Information**: DMCA policy and other legal notices: [`docs/legal/README.md`](docs/legal/README.md)
