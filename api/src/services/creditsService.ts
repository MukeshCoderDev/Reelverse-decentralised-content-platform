import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class CreditsService {
    private defaultCurrency: string;

    constructor(defaultCurrency: string = 'USDC') {
        this.defaultCurrency = defaultCurrency;
    }

    async getBalance(userId: string, currency: string = this.defaultCurrency): Promise<bigint> {
        const pool = getDatabase();
        const client = await pool.connect();
        try {
            const res = await client.query(
                `SELECT balance FROM credits WHERE user_id = $1 AND currency = $2 FOR UPDATE`,
                [userId, currency]
            );
            return res.rows.length > 0 ? BigInt(res.rows[0].balance) : BigInt(0);
        } finally {
            client.release();
        }
    }

    async addCredit(userId: string, amount: bigint, currency: string = this.defaultCurrency, txRef?: string): Promise<void> {
        if (amount <= 0) {
            throw new Error('Amount must be positive.');
        }
        const pool = getDatabase();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            if (txRef) {
                // Attempt to insert with tx_ref for idempotency
                const insertRes = await client.query(
                    `INSERT INTO credits (user_id, currency, balance, tx_ref)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (user_id, currency, tx_ref) DO NOTHING
                     RETURNING balance`,
                    [userId, currency, amount.toString(), txRef]
                );

                if (insertRes.rowCount === 0) {
                    // Conflict occurred, meaning this txRef was already processed.
                    // Fetch current balance to log, but no actual credit added.
                    const currentBalance = await this.getBalance(userId, currency);
                    logger.info(`Idempotent addCredit: txRef ${txRef} already processed for user ${userId}. Current balance: ${currentBalance}`);
                } else {
                    logger.info(`Added ${amount} ${currency} to user ${userId} with txRef ${txRef}. New balance: ${insertRes.rows[0].balance}`);
                }
            } else {
                // Original behavior without tx_ref idempotency
                const res = await client.query(
                    `INSERT INTO credits (user_id, currency, balance)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (user_id, currency) DO UPDATE SET balance = credits.balance + EXCLUDED.balance, updated_at = NOW()
                     RETURNING balance`,
                    [userId, currency, amount.toString()]
                );
                logger.info(`Added ${amount} ${currency} to user ${userId}. New balance: ${res.rows[0].balance}`);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`Error adding credit to user ${userId}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    async deductCredit(userId: string, amount: bigint, currency: string = this.defaultCurrency): Promise<void> {
        if (amount <= 0) {
            throw new Error('Amount must be positive.');
        }
        const pool = getDatabase();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const currentBalance = await this.getBalance(userId, currency); // This already uses FOR UPDATE
            if (currentBalance < amount) {
                throw new Error('Insufficient funds.');
            }

            const res = await client.query(
                `UPDATE credits SET balance = balance - $3, updated_at = NOW()
                 WHERE user_id = $1 AND currency = $2
                 RETURNING balance`,
                [userId, currency, amount.toString()]
            );
            logger.info(`Deducted ${amount} ${currency} from user ${userId}. New balance: ${res.rows[0].balance}`);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`Error deducting credit from user ${userId}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    async transferWithHold(
        payerId: string,
        payeeId: string,
        amount: bigint,
        currency: string = this.defaultCurrency,
        reason?: string
    ): Promise<{ holdId: string }> {
        if (amount <= 0) {
            throw new Error('Amount must be positive.');
        }
        const pool = getDatabase();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const currentBalance = await this.getBalance(payerId, currency); // This already uses FOR UPDATE
            if (currentBalance < amount) {
                throw new Error('Insufficient funds for hold.');
            }

            // Deduct from payer's balance
            await client.query(
                `UPDATE credits SET balance = balance - $3, updated_at = NOW()
                 WHERE user_id = $1 AND currency = $2`,
                [payerId, currency, amount.toString()]
            );

            // Create a hold row
            const holdId = uuidv4();
            await client.query(
                `INSERT INTO holds (id, user_id, amount, currency, reason, status)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [holdId, payerId, amount.toString(), currency, reason || null, 'pending']
            );

            logger.info(`Created hold ${holdId} for ${amount} ${currency} from ${payerId} to ${payeeId}.`);
            await client.query('COMMIT');
            return { holdId };
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`Error creating hold for transfer from ${payerId} to ${payeeId}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    async releaseHold(holdId: string): Promise<void> {
        const pool = getDatabase();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const res = await client.query(
                `SELECT user_id, amount, currency, status FROM holds WHERE id = $1 FOR UPDATE`,
                [holdId]
            );

            if (res.rows.length === 0) {
                throw new Error('Hold not found.');
            }
            const hold = res.rows[0];

            if (hold.status !== 'pending') {
                throw new Error(`Hold ${holdId} is not in 'pending' status. Current status: ${hold.status}`);
            }

            // Mark hold as captured
            await client.query(
                `UPDATE holds SET status = 'captured', updated_at = NOW() WHERE id = $1`,
                [holdId]
            );

            // Funds are considered moved, no direct credit addition here for simplicity as per v1 instruction
            logger.info(`Hold ${holdId} released (captured). Funds are considered moved, no auto-crediting to payee in this version.`);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`Error releasing hold ${holdId}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    async voidHold(holdId: string): Promise<void> {
        const pool = getDatabase();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const res = await client.query(
                `SELECT user_id, amount, currency, status FROM holds WHERE id = $1 FOR UPDATE`,
                [holdId]
            );

            if (res.rows.length === 0) {
                throw new Error('Hold not found.');
            }
            const hold = res.rows[0];

            if (hold.status !== 'pending') {
                throw new Error(`Hold ${holdId} is not in 'pending' status. Current status: ${hold.status}`);
            }

            // Return funds to payer
            await client.query(
                `UPDATE credits SET balance = balance + $3, updated_at = NOW()
                 WHERE user_id = $1 AND currency = $2`,
                [hold.user_id, hold.currency, hold.amount.toString()]
            );

            // Mark hold as void
            await client.query(
                `UPDATE holds SET status = 'void', updated_at = NOW() WHERE id = $1`,
                [holdId]
            );

            logger.info(`Hold ${holdId} voided and funds returned to ${hold.user_id}.`);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`Error voiding hold ${holdId}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }
}