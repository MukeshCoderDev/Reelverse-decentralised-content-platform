import { getDatabase, connectDatabase, closeDatabase } from '../config/database';
import { logger } from '../utils/logger';

async function sweep() {
  // ensure DB is connected when running standalone
  await connectDatabase();
  const pool = getDatabase();
  const client = await pool.connect();
  try {
    const res = await client.query(`DELETE FROM idempotency_keys WHERE expires_at IS NOT NULL AND expires_at < now()`);
    logger.info(`Idempotency sweep deleted ${res.rowCount} rows`);
  } catch (e) {
    logger.error('Idempotency sweep failed', e);
    process.exitCode = 2;
  } finally {
    try { client.release(); } catch {};
    await closeDatabase();
  }
}

if (require.main === module) {
  sweep().then(() => process.exit(0)).catch(() => process.exit(2));
}

export default sweep;
