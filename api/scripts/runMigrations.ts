import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { logger } from '../src/utils/logger';

dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Load .env from api directory

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    logger.error('DATABASE_URL is not set in the environment variables.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
});

async function runMigrations() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create migrations table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        const migrationsDir = path.resolve(__dirname, '../../migrations'); // points to repo-root/migrations
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        for (const file of migrationFiles) {
            const migrationName = path.basename(file);
            const { rows } = await client.query(
                `SELECT id FROM migrations WHERE name = $1`,
                [migrationName]
            );

            if (rows.length === 0) {
                logger.info(`Applying migration: ${migrationName}`);
                const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                await client.query(sql);
                await client.query(
                    `INSERT INTO migrations (name) VALUES ($1)`,
                    [migrationName]
                );
                logger.info(`Successfully applied migration: ${migrationName}`);
            } else {
                logger.info(`Migration already applied: ${migrationName}`);
            }
        }

        await client.query('COMMIT');
        logger.info('All migrations applied successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error applying migrations:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

if (require.main === module) {
    runMigrations();
}