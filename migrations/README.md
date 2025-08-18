This folder contains SQL migrations applied by the smoke harness and the MigrationService.

002_idempotency_metadata.sql
- Adds 'status' and 'expires_at' fields to `idempotency_keys` and creates an index on `expires_at`.
- Note: Postgres does not support automatic TTL deletes; use a scheduled job to DELETE expired rows:
  DELETE FROM idempotency_keys WHERE expires_at < now();

Applying migrations:
- The smoke harness (`scripts/smoke_integration_test.js`) will apply migrations automatically when run.
- To apply manually:
  psql $DATABASE_URL -f migrations/001_create_credits_tables.sql
  psql $DATABASE_URL -f migrations/002_idempotency_metadata.sql
