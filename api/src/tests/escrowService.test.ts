import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EscrowService } from '../services/escrowService';
import { getDatabase } from '../config/database';
import { Pool, PoolClient } from 'pg';

// Mock the database connection
vi.mock('../config/database', () => ({
    getDatabase: vi.fn(),
}));

describe('EscrowService', () => {
    let escrowService: EscrowService;
    let mockClient: Partial<PoolClient>;
    let mockPool: Partial<Pool>;

    beforeEach(() => {
        escrowService = new EscrowService('TEST_CURRENCY');

        mockClient = {
            query: vi.fn(),
            release: vi.fn(),
        };

        mockPool = {
            connect: vi.fn(() => Promise.resolve(mockClient as PoolClient)),
        };

        (getDatabase as any).mockReturnValue(mockPool);
    });

    it('should open an escrow with status "open"', async () => {
        (mockClient.query as any).mockResolvedValueOnce({}); // Insert escrow

        const { escrowId } = await escrowService.open({
            payerId: 'payer123',
            payeeId: 'payee456',
            amount: BigInt(100),
            contentId: 'content789',
        });

        expect(escrowId).toBeDefined();
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith(
            `INSERT INTO escrow (id, payer_id, payee_id, amount, currency, content_id, status, opened_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [escrowId, 'payer123', 'payee456', '100', 'TEST_CURRENCY', 'content789', 'open']
        );
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error if amount is not positive when opening escrow', async () => {
        await expect(escrowService.open({
            payerId: 'payer123',
            payeeId: 'payee456',
            amount: BigInt(0),
        })).rejects.toThrow('Amount must be positive.');
        expect(mockClient.query).not.toHaveBeenCalledWith('BEGIN');
    });

    it('should release an open escrow', async () => {
        const mockEscrowId = uuidv4();
        (mockClient.query as any)
            .mockResolvedValueOnce({ rows: [{ status: 'open' }] }) // Select escrow
            .mockResolvedValueOnce({}); // Update escrow status

        await escrowService.release(mockEscrowId);

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith(
            `UPDATE escrow SET status = 'released', closed_at = NOW() WHERE id = $1`,
            [mockEscrowId]
        );
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error if releasing a non-open escrow', async () => {
        const mockEscrowId = uuidv4();
        (mockClient.query as any).mockResolvedValueOnce({ rows: [{ status: 'released' }] });

        await expect(escrowService.release(mockEscrowId)).rejects.toThrow(`Escrow ${mockEscrowId} is not in 'open' status. Current status: released`);
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should refund an open escrow', async () => {
        const mockEscrowId = uuidv4();
        (mockClient.query as any)
            .mockResolvedValueOnce({ rows: [{ payer_id: 'payer123', amount: '100', currency: 'TEST_CURRENCY', status: 'open' }] }) // Select escrow
            .mockResolvedValueOnce({}); // Update escrow status

        await escrowService.refund(mockEscrowId);

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith(
            `UPDATE escrow SET status = 'refunded', closed_at = NOW() WHERE id = $1`,
            [mockEscrowId]
        );
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error if refunding a non-open escrow', async () => {
        const mockEscrowId = uuidv4();
        (mockClient.query as any).mockResolvedValueOnce({ rows: [{ status: 'refunded' }] });

        await expect(escrowService.refund(mockEscrowId)).rejects.toThrow(`Escrow ${mockEscrowId} is not in 'open' status. Current status: refunded`);
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should get the status of an escrow', async () => {
        const mockEscrowId = uuidv4();
        (mockClient.query as any).mockResolvedValueOnce({ rows: [{ status: 'open' }] });

        const status = await escrowService.getStatus(mockEscrowId);
        expect(status).toBe('open');
        expect(mockClient.query).toHaveBeenCalledWith(
            `SELECT status FROM escrow WHERE id = $1`,
            [mockEscrowId]
        );
    });

    it('should return null if escrow not found for status check', async () => {
        (mockClient.query as any).mockResolvedValueOnce({ rows: [] });

        const status = await escrowService.getStatus('nonExistentEscrow');
        expect(status).toBeNull();
    });
});

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}