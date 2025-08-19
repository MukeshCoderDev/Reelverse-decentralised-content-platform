import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface OpenEscrowParams {
    payerId: string;
    payeeId: string;
    amount: bigint;
    currency?: string;
    contentId?: string;
}

export class EscrowService {
    private defaultCurrency: string;

    constructor(defaultCurrency: string = 'USDC') {
        this.defaultCurrency = defaultCurrency;
    }

    async open({ payerId, payeeId, amount, currency = this.defaultCurrency, contentId }: OpenEscrowParams): Promise<{ escrowId: string }> {
        if (amount <= 0) {
            throw new Error('Amount must be positive.');
        }
        const pool = getDatabase();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Optionally deduct from payer's balance if this is a direct deduction upon opening escrow
            // The task says "optionally deducts payer balance". For now, we'll assume the deduction
            // happens as part of a separate credit transfer or is handled externally.
            // If direct deduction is needed, add logic here with SELECT ... FOR UPDATE on credits table.

            const escrowId = uuidv4();
            await client.query(
                `INSERT INTO escrow (id, payer_id, payee_id, amount, currency, content_id, status, opened_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [escrowId, payerId, payeeId, amount.toString(), currency, contentId || null, 'open']
            );

            logger.info(`Opened escrow ${escrowId} for ${amount} ${currency} from ${payerId} to ${payeeId}.`);
            await client.query('COMMIT');
            return { escrowId };
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`Error opening escrow from ${payerId} to ${payeeId}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    async release(escrowId: string): Promise<void> {
        const pool = getDatabase();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const res = await client.query(
                `SELECT status FROM escrow WHERE id = $1 FOR UPDATE`,
                [escrowId]
            );

            if (res.rows.length === 0) {
                throw new Error('Escrow not found.');
            }
            const escrow = res.rows[0];

            if (escrow.status !== 'open') {
                throw new Error(`Escrow ${escrowId} is not in 'open' status. Current status: ${escrow.status}`);
            }

            await client.query(
                `UPDATE escrow SET status = 'released', closed_at = NOW() WHERE id = $1`,
                [escrowId]
            );

            // In a real system, this would trigger crediting the payee.
            logger.info(`Escrow ${escrowId} released.`);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`Error releasing escrow ${escrowId}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    async refund(escrowId: string): Promise<void> {
        const pool = getDatabase();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const res = await client.query(
                `SELECT payer_id, amount, currency, status FROM escrow WHERE id = $1 FOR UPDATE`,
                [escrowId]
            );

            if (res.rows.length === 0) {
                throw new Error('Escrow not found.');
            }
            const escrow = res.rows[0];

            if (escrow.status !== 'open') {
                throw new Error(`Escrow ${escrowId} is not in 'open' status. Current status: ${escrow.status}`);
            }

            // In a real system, this would trigger returning funds to the payer.
            // For now, we just mark the escrow as refunded.
            await client.query(
                `UPDATE escrow SET status = 'refunded', closed_at = NOW() WHERE id = $1`,
                [escrowId]
            );

            logger.info(`Escrow ${escrowId} refunded.`);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`Error refunding escrow ${escrowId}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getStatus(escrowId: string): Promise<string | null> {
        const pool = getDatabase();
        const client = await pool.connect();
        try {
            const res = await client.query(
                `SELECT status FROM escrow WHERE id = $1`,
                [escrowId]
            );
            return res.rows.length > 0 ? res.rows[0].status : null;
        } finally {
            client.release();
        }
    }
}