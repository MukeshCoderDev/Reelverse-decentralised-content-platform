Walletless UX blueprint and local scaffolding

This README explains the walletless UX implementation scaffold added to the codebase.

What was added:
- Lightweight Credits API at `api/src/routes/credits.ts` (in-memory + Redis idempotency)
- Paymaster preauth/settle stubs at `api/src/routes/paymaster.ts`
- Batch Finalizer queue endpoints at `api/src/routes/finalizer.ts`
- Coordinator upload ticket endpoint at `api/src/routes/coordinator.ts`

Next steps to productionize:
1. Implement durable credits ledger in Postgres with holds and idempotency records.
2. Integrate real Paymaster service that calls `services/paymasterService.ts` and debits Credits via ledger.
3. Implement Batch Finalizer worker that pops `finalizer` queue and calls `finalizeBatch` on threshold.
4. Add Treasury bot to maintain on-chain gas/USDC float.

How to run locally (quick smoke):

- Option A: Run in CI (recommended, no docker-compose required)
	- There's a GitHub Actions workflow at `.github/workflows/smoke-integration.yml` that will start Postgres and Redis, install deps, run migrations, and execute the smoke script. Trigger it from the Actions tab or push to `main`.

- Option B: Run locally with docker-compose
	- Start services: `docker-compose -f docker-compose.test.yml up -d --remove-orphans`
	- Run the smoke script: `npm run test:integration:smoke`
	- Tear down: `npm run test:integration:down`

Notes:
- The smoke script `scripts/smoke_integration_test.js` applies the SQL migration in `migrations/001_create_credits_tables.sql` and then exercises topup → preauth → settle and a small concurrency test.
- The CI workflow uploads `smoke.log` as an artifact for inspection.

This is a scaffold for development and demos; ensure you review security, idempotency, and audit before using in staging/production.
