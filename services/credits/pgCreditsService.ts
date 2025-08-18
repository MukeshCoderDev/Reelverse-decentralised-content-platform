import { getDatabase } from '../../api/src/config/database';
import { v4 as uuidv4 } from 'uuid';
import { CreditsService, CreditTransaction, CreditAccount, FxSnapshot } from './types';

class PgCreditsService implements CreditsService {
  async topUpCredits(orgId: string, amountCents: number, provider?: string, providerRef?: string, idempotencyKey?: string): Promise<CreditTransaction> {
    const pool = getDatabase();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Ensure account exists
      await client.query(
        `INSERT INTO credit_accounts(org_id, balance_cents, currency) VALUES($1, $2, $3) ON CONFLICT (org_id) DO NOTHING`,
        [orgId, 0, 'USD']
      );

      // Idempotency check via unique provider/providerRef or idempotency_key index
      if (provider && providerRef) {
        const ex = await client.query(`SELECT id, amount_cents, created_at FROM credit_transactions WHERE provider=$1 AND provider_ref=$2 LIMIT 1`, [provider, providerRef]);
        if (ex.rowCount > 0) {
          const r = ex.rows[0];
          await client.query('COMMIT');
          return {
            id: r.id,
            orgId,
            amountCents: Number(r.amount_cents),
            type: 'issue',
            createdAt: r.created_at.toISOString()
          } as CreditTransaction;
        }
      }

      if (idempotencyKey) {
        const ex = await client.query(`SELECT response_json FROM idempotency_keys WHERE key=$1 LIMIT 1`, [idempotencyKey]);
        if (ex.rowCount > 0) {
          const resp = ex.rows[0].response_json;
          await client.query('COMMIT');
          return resp;
        }
      }

      await client.query(`UPDATE credit_accounts SET balance_cents = balance_cents + $1, updated_at = now() WHERE org_id = $2`, [amountCents, orgId]);

      const txId = uuidv4();
      const res = await client.query(
        `INSERT INTO credit_transactions(id, org_id, type, amount_cents, provider, provider_ref, idempotency_key) VALUES($1,$2,'issue',$3,$4,$5,$6) RETURNING id, org_id, amount_cents, type, reason, created_at`,
        [txId, orgId, amountCents, provider || null, providerRef || null, idempotencyKey || null]
      );

      const row = res.rows[0];

      if (idempotencyKey) {
        await client.query(`INSERT INTO idempotency_keys(key, method, org_id, body_hash, response_json, status_code, expires_at) VALUES($1,$2,$3,$4,$5,$6, now() + interval '1 day') ON CONFLICT (key) DO NOTHING`, [idempotencyKey, 'POST /credits/topup', orgId, null, JSON.stringify({ id: row.id, orgId: row.org_id, amountCents: Number(row.amount_cents), type: row.type, createdAt: row.created_at }), 200]);
      }

      await client.query('COMMIT');

      return {
        id: row.id,
        orgId: row.org_id,
        amountCents: Number(row.amount_cents),
        type: row.type,
        createdAt: row.created_at.toISOString()
      } as CreditTransaction;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async debitCredits(orgId: string, amountCents: number, reason?: string, idempotencyKey?: string): Promise<CreditTransaction> {
    const pool = getDatabase();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // idempotency check
      if (idempotencyKey) {
        const ex = await client.query(`SELECT response_json FROM idempotency_keys WHERE key=$1 LIMIT 1`, [idempotencyKey]);
        if (ex.rowCount > 0) {
          const resp = ex.rows[0].response_json;
          await client.query('COMMIT');
          return resp;
        }
      }

      const accRes = await client.query(`SELECT balance_cents FROM credit_accounts WHERE org_id=$1 FOR UPDATE`, [orgId]);
      if (accRes.rowCount === 0) { await client.query('ROLLBACK'); throw new Error('Account not found'); }
      const available = BigInt(accRes.rows[0].balance_cents);
      const debit = BigInt(amountCents);
      if (available < debit) { await client.query('ROLLBACK'); throw new Error('INSUFFICIENT_CREDITS'); }

      await client.query(`UPDATE credit_accounts SET balance_cents = balance_cents - $1, updated_at = now() WHERE org_id = $2`, [amountCents, orgId]);
      const txId = uuidv4();
      const res = await client.query(`INSERT INTO credit_transactions(id, org_id, type, amount_cents, reason, idempotency_key) VALUES($1,$2,'debit', $3, $4, $5) RETURNING id, org_id, amount_cents, type, reason, created_at`, [txId, orgId, -Math.abs(amountCents), reason || null, idempotencyKey || null]);

      if (idempotencyKey) {
        await client.query(`INSERT INTO idempotency_keys(key, method, org_id, body_hash, response_json, status_code, expires_at) VALUES($1,$2,$3,$4,$5,$6, now() + interval '1 day') ON CONFLICT (key) DO NOTHING`, [idempotencyKey, 'POST /credits/debit', orgId, null, JSON.stringify({ id: res.rows[0].id, orgId: res.rows[0].org_id, amountCents: Number(res.rows[0].amount_cents), type: res.rows[0].type, createdAt: res.rows[0].created_at }), 200]);
      }

      await client.query('COMMIT');
      const row = res.rows[0];
      return {
        id: row.id,
        orgId: row.org_id,
        amountCents: Number(row.amount_cents),
        type: row.type,
        reason: row.reason,
        createdAt: row.created_at.toISOString()
      } as CreditTransaction;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getBalance(orgId: string): Promise<CreditAccount | null> {
    const pool = getDatabase();
    const res = await pool.query(`SELECT org_id, balance_cents, daily_gas_cap_cents, daily_gas_spend_cents, spend_window_start, currency FROM credit_accounts WHERE org_id=$1`, [orgId]);
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
    return { orgId: r.org_id, balanceCents: Number(r.balance_cents), dailyGasCapCents: Number(r.daily_gas_cap_cents || 0), dailyGasSpendCents: Number(r.daily_gas_spend_cents || 0), spendWindowStart: r.spend_window_start ? r.spend_window_start.toISOString() : null, currency: r.currency } as CreditAccount;
  }

  async holdCredits(orgId: string, approvalId: string, amountCents: number, method?: string, paramsHash?: string, fxSnapshot?: FxSnapshot, expiresAt?: string) {
    const pool = getDatabase();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Lock account
  const accRes = await client.query(`SELECT balance_cents FROM credit_accounts WHERE org_id=$1 FOR UPDATE`, [orgId]);
  if (accRes.rowCount === 0) { await client.query('ROLLBACK'); throw new Error('Account not found'); }
  const balance = BigInt(accRes.rows[0].balance_cents);
  const holdAmt = BigInt(amountCents);

  // compute currently active holds sum and ensure available funds after existing holds
  const heldRes = await client.query(`SELECT COALESCE(SUM(amount_cents),0) AS total_held FROM credit_holds WHERE org_id=$1 AND status='active'`, [orgId]);
  const totalHeld = BigInt(heldRes.rows[0].total_held || 0);
  const availableAfterHolds = balance - totalHeld;
  if (availableAfterHolds < holdAmt) { await client.query('ROLLBACK'); throw new Error('INSUFFICIENT_CREDITS'); }

      // create hold
  await client.query(`INSERT INTO credit_holds(approval_id, org_id, amount_cents, method, params_hash, fx_snapshot, expires_at, status) VALUES($1,$2,$3,$4,$5,$6,$7,'active')`, [approvalId, orgId, amountCents, method || null, paramsHash || null, fxSnapshot ? JSON.stringify(fxSnapshot) : null, expiresAt || null]);

      // deduct from balance (held but still recorded in transactions as hold)
      await client.query(`UPDATE credit_accounts SET balance_cents = balance_cents - $1, updated_at = now() WHERE org_id = $2`, [amountCents, orgId]);

  const txId = uuidv4();
  const res = await client.query(`INSERT INTO credit_transactions(id, org_id, type, amount_cents, reason, ref_id) VALUES($1,$2,'hold', $3, $4, $5) RETURNING id, org_id, amount_cents, type, created_at`, [txId, orgId, -Math.abs(amountCents), 'hold', approvalId]);

      await client.query('COMMIT');
      const row = res.rows[0];
      return { holdId: approvalId, txn: { id: row.id, orgId: row.org_id, amountCents: Number(row.amount_cents), type: row.type, createdAt: row.created_at.toISOString() } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally { client.release(); }
  }

  async releaseHold(orgId: string, approvalId: string, capture: boolean = false, actualDebitCents?: number) {
    const pool = getDatabase();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const holdRes = await client.query(`SELECT id, amount_cents, status FROM credit_holds WHERE approval_id=$1 FOR UPDATE`, [approvalId]);
      if (holdRes.rowCount === 0) { await client.query('ROLLBACK'); return null; }
      const hold = holdRes.rows[0];
      if (hold.status !== 'active') { await client.query('ROLLBACK'); throw new Error('HOLD_INVALID'); }
      const amount = Number(hold.amount_cents);

      if (capture) {
        const debit = actualDebitCents !== undefined ? actualDebitCents : amount;
        // adjust total by making a debit (held already deducted from balance)
        await client.query(`UPDATE credit_holds SET status='captured' WHERE id=$1`, [hold.id]);
        const txId = uuidv4();
        const res = await client.query(`INSERT INTO credit_transactions(id, org_id, type, amount_cents, reason) VALUES($1,$2,'debit',$3,$4) RETURNING id, org_id, amount_cents, type, created_at`, [txId, orgId, -Math.abs(debit), 'capture']);
        await client.query('COMMIT');
        const row = res.rows[0];
        return { id: row.id, orgId: row.org_id, amountCents: Number(row.amount_cents), type: row.type, createdAt: row.created_at.toISOString() } as CreditTransaction;
      } else {
        // release: return funds to balance
        await client.query(`DELETE FROM credit_holds WHERE id=$1`, [hold.id]);
        await client.query(`UPDATE credit_accounts SET balance_cents = balance_cents + $1, updated_at = now() WHERE org_id = $2`, [amount, orgId]);
        const txId = uuidv4();
        const res = await client.query(`INSERT INTO credit_transactions(id, org_id, type, amount_cents, reason) VALUES($1,$2,'release',$3,$4) RETURNING id, org_id, amount_cents, type, created_at`, [txId, orgId, amount, 'release']);
        await client.query('COMMIT');
        const row = res.rows[0];
        return { id: row.id, orgId: row.org_id, amountCents: Number(row.amount_cents), type: row.type, createdAt: row.created_at.toISOString() } as CreditTransaction;
      }
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  }
}

export const pgCreditsService = new PgCreditsService();
export default pgCreditsService;
