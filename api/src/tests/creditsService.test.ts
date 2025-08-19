import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreditsService } from '../services/creditsService';
import { getDatabase } from '../config/database';
import { Pool, PoolClient } from 'pg';

// Mock the database connection
vi.mock('../config/database', () => ({
    getDatabase: vi.fn(),
}));

describe('CreditsService', () => {
    let creditsService: CreditsService;
    let mockClient: Partial<PoolClient>;
    let mockPool: Partial<Pool>;

    beforeEach(() => {
        creditsService = new CreditsService('TEST_CURRENCY');

        mockClient = {
            query: vi.fn(),
            release: vi.fn(),
        };

        mockPool = {
            connect: vi.fn(() => Promise.resolve(mockClient as PoolClient)),
        };

        (getDatabase as any).mockReturnValue(mockPool);
    });

    it('should return 0 balance if user has no credits', async () => {
        (mockClient.query as any).mockResolvedValueOnce({ rows: [] });
        const balance = await creditsService.getBalance('user123');
        expect(balance).toBe(BigInt(0));
        expect(mockClient.query).toHaveBeenCalledWith(
            `SELECT balance FROM credits WHERE user_id = $1 AND currency = $2 FOR UPDATE`,
            ['user123', 'TEST_CURRENCY']
        );
    });

    it('should return correct balance if user has credits', async () => {
        (mockClient.query as any).mockResolvedValueOnce({ rows: [{ balance: '1000' }] });
        const balance = await creditsService.getBalance('user123');
        expect(balance).toBe(BigInt(1000));
    });

    it('should add credit to an existing user', async () => {
        (mockClient.query as any)
            .mockResolvedValueOnce({ rows: [{ balance: '1000' }] }) // Initial balance check (not used in addCredit directly, but for context)
            .mockResolvedValueOnce({ rows: [{ balance: '1500' }] }); // After update

        await creditsService.addCredit('user123', BigInt(500));

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith(
            `INSERT INTO credits (user_id, currency, balance)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (user_id, currency) DO UPDATE SET balance = credits.balance + EXCLUDED.balance, updated_at = NOW()
                 RETURNING balance`,
            ['user123', 'TEST_CURRENCY', '500']
        );
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should deduct credit from an existing user', async () => {
        (mockClient.query as any)
            .mockResolvedValueOnce({ rows: [{ balance: '1000' }] }) // getBalance for check
            .mockResolvedValueOnce({ rows: [{ balance: '500' }] }); // After update

        await creditsService.deductCredit('user123', BigInt(500));

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith(
            `UPDATE credits SET balance = balance - $3, updated_at = NOW()
                 WHERE user_id = $1 AND currency = $2
                 RETURNING balance`,
            ['user123', 'TEST_CURRENCY', '500']
        );
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error on insufficient funds for deduction', async () => {
        (mockClient.query as any).mockResolvedValueOnce({ rows: [{ balance: '100' }] }); // getBalance for check

        await expect(creditsService.deductCredit('user123', BigInt(500))).rejects.toThrow('Insufficient funds.');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should prevent concurrent deductions with SELECT ... FOR UPDATE', async () => {
        const userId = 'concurrentUser';
        const currency = 'TEST_CURRENCY';
        const initialBalance = BigInt(1000);
        const deductionAmount = BigInt(600);

        let currentMockBalance = initialBalance;

        // Mock query to simulate SELECT ... FOR UPDATE behavior
        (mockClient.query as any).mockImplementation((sql: string, params: any[]) => {
            if (sql.includes('SELECT balance FROM credits WHERE user_id = $1 AND currency = $2 FOR UPDATE')) {
                // Simulate locking: return current balance
                return Promise.resolve({ rows: [{ balance: currentMockBalance.toString() }] });
            }
            if (sql.includes('UPDATE credits SET balance = balance - $3')) {
                // Simulate a delay for the first transaction to "lock" the row and update
                return new Promise(resolve => setTimeout(() => {
                    currentMockBalance -= BigInt(params[2]);
                    resolve({ rows: [{ balance: currentMockBalance.toString() }] });
                }, 50)); // Small delay to allow concurrency
            }
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
                return Promise.resolve({});
            }
            return Promise.resolve({});
        });

        // First concurrent deduction
        const deduction1 = creditsService.deductCredit(userId, deductionAmount, currency);

        // Second concurrent deduction (should fail due to insufficient funds after first one)
        const deduction2 = creditsService.deductCredit(userId, deductionAmount, currency);

        // Wait for both promises to settle
        const results = await Promise.allSettled([deduction1, deduction2]);

        // Expect one to be fulfilled and one to be rejected
        expect(results.filter(r => r.status === 'fulfilled').length).toBe(1);
        expect(results.filter(r => r.status === 'rejected').length).toBe(1);

        const rejectedResult = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
        expect(rejectedResult.reason.message).toBe('Insufficient funds.');

        // Verify that BEGIN and COMMIT/ROLLBACK were called appropriately
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');

        // Verify the final balance (after one successful deduction)
        expect(currentMockBalance).toBe(initialBalance - deductionAmount);
    });

    it('should create a pending hold and deduct from payer balance', async () => {
        (mockClient.query as any)
            .mockResolvedValueOnce({ rows: [{ balance: '1000' }] }) // getBalance for check
            .mockResolvedValueOnce({}); // Update credits
            // .mockResolvedValueOnce({}); // Insert hold

        const { holdId } = await creditsService.transferWithHold('payer123', 'payee456', BigInt(200));

        expect(holdId).toBeDefined();
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith(
            `UPDATE credits SET balance = balance - $3, updated_at = NOW()
                 WHERE user_id = $1 AND currency = $2`,
            ['payer123', 'TEST_CURRENCY', '200']
        );
        expect(mockClient.query).toHaveBeenCalledWith(
            `INSERT INTO holds (id, user_id, amount, currency, reason, status)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
            [holdId, 'payer123', '200', 'TEST_CURRENCY', null, 'pending']
        );
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error on insufficient funds for hold', async () => {
        (mockClient.query as any).mockResolvedValueOnce({ rows: [{ balance: '100' }] }); // getBalance for check

        await expect(creditsService.transferWithHold('payer123', 'payee456', BigInt(500))).rejects.toThrow('Insufficient funds for hold.');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should release a pending hold', async () => {
        const mockHoldId = uuidv4();
        (mockClient.query as any)
            .mockResolvedValueOnce({ rows: [{ user_id: 'payer123', amount: '200', currency: 'TEST_CURRENCY', status: 'pending' }] }) // Select hold
            .mockResolvedValueOnce({}); // Update hold status

        await creditsService.releaseHold(mockHoldId);

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith(
            `UPDATE holds SET status = 'captured', updated_at = NOW() WHERE id = $1`,
            [mockHoldId]
        );
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error if releasing a non-pending hold', async () => {
        const mockHoldId = uuidv4();
        (mockClient.query as any).mockResolvedValueOnce({ rows: [{ user_id: 'payer123', amount: '200', currency: 'TEST_CURRENCY', status: 'captured' }] });

        await expect(creditsService.releaseHold(mockHoldId)).rejects.toThrow(`Hold ${mockHoldId} is not in 'pending' status. Current status: captured`);
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should void a pending hold and return funds to payer', async () => {
        const mockHoldId = uuidv4();
        (mockClient.query as any)
            .mockResolvedValueOnce({ rows: [{ user_id: 'payer123', amount: '200', currency: 'TEST_CURRENCY', status: 'pending' }] }) // Select hold
            .mockResolvedValueOnce({}); // Update credits
            // .mockResolvedValue({}); // Update hold status

        await creditsService.voidHold(mockHoldId);

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith(
            `UPDATE credits SET balance = balance + $3, updated_at = NOW()
                 WHERE user_id = $1 AND currency = $2`,
            ['payer123', 'TEST_CURRENCY', '200']
        );
        expect(mockClient.query).toHaveBeenCalledWith(
            `UPDATE holds SET status = 'void', updated_at = NOW() WHERE id = $1`,
            [mockHoldId]
        );
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error if voiding a non-pending hold', async () => {
        const mockHoldId = uuidv4();
        (mockClient.query as any).mockResolvedValueOnce({ rows: [{ user_id: 'payer123', amount: '200', currency: 'TEST_CURRENCY', status: 'released' }] });

        await expect(creditsService.voidHold(mockHoldId)).rejects.toThrow(`Hold ${mockHoldId} is not in 'pending' status. Current status: released`);
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
});

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}