import * as express from 'express';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../config/redis';
import { getDatabase } from '../config/database';
// FxSnapshot type (minimal local fallback)
type FxSnapshot = { ethUsdCents: number; takenAt: string };
import { holdsCreated, settleDebits, rateLimitHits, idempotencyPersistenceFailures, preauthLatency, settleLatency, missedRelease, preauthRejects, incCounter } from '../utils/metrics';

const router = express.Router();
const redis = RedisService.getInstance();

function requireIdempotencyHeader(req: Request, res: Response): string | null {
  const key = req.header('x-idempotency-key') as string | undefined;
  if (!key) {
    res.status(400).json({ error: 'Missing X-Idempotency-Key' });
    return null;
  }
  return key;
}

async function replayLookup(key: string) {
  try {
    const pool = getDatabase();
    const existing = await pool.query(`SELECT response_json, status_code FROM idempotency_keys WHERE key=$1 LIMIT 1`, [key]);
    if (existing.rowCount > 0) return existing.rows[0];
  } catch (e) {
    // best-effort
  }
  return null;
}

router.post('/preauth', async (req: Request, res: Response) => {
  const idempotencyKey = requireIdempotencyHeader(req, res);
  if (!idempotencyKey) return;

  const { orgId, holdId, estGasWei, maxFeePerGasWei, maxPriorityFeePerGasWei, method, paramsHash, expiresAt } = req.body as any;
  if (!orgId || !holdId || !estGasWei) return res.status(400).json({ error: 'orgId, holdId, estGasWei required' });

  const replay = await replayLookup(idempotencyKey);
  if (replay) return res.status(replay.status_code || 200).json(replay.response_json);

  const rateKey = `rate:preauth:${orgId}`;
  const allowed = await redis.incrementRateLimit(rateKey, 24 * 3600);
  if (allowed > 100) { incCounter(rateLimitHits, 1, (res.locals as any).metricsLabels); return res.status(429).set('Retry-After', '3600').json({ error: 'RATE_LIMITED' }); }

  const signature = req.header('x-signature');
  const secret = process.env.PAYMASTER_HMAC_SECRET;
  if (!secret) return res.status(500).json({ error: 'PAYMASTER_HMAC_SECRET not configured' });
  const canonical = `${method||''}|${paramsHash||''}|${estGasWei}|${maxFeePerGasWei||''}|${maxPriorityFeePerGasWei||''}|${expiresAt||''}|${orgId}`;
  const expected = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
  if (!signature || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return res.status(400).json({ error: 'PREAUTH_MISMATCH' });

  const ethUsdCents = 180000; // placeholder FX snapshot
  const fx: FxSnapshot = { ethUsdCents, takenAt: new Date().toISOString() };
  const estGas = BigInt(estGasWei);
  const maxFee = BigInt(maxFeePerGasWei || '20000000000');
  const totalWei = estGas * maxFee;
  const totalEthMulCents = (totalWei * BigInt(ethUsdCents)) / BigInt(1e18);
  const holdCents = Number(totalEthMulCents);

  const lockKey = `paymaster:approval:${holdId}`;
  const lockToken = await redis.acquireLockToken(lockKey, 30);
  if (!lockToken) { incCounter(rateLimitHits, 1, (res.locals as any).metricsLabels); return res.status(429).set('Retry-After', '3').json({ error: 'RATE_LIMITED' }); }

  const pool = getDatabase();
  const client = await pool.connect();
  try {
    const timer = preauthLatency.startTimer();
    await client.query('BEGIN');

    const existing2 = await client.query(`SELECT response_json, status_code FROM idempotency_keys WHERE key=$1 LIMIT 1`, [idempotencyKey]);
    if (existing2.rowCount > 0) { const r = existing2.rows[0]; await client.query('ROLLBACK'); timer(); return res.status(r.status_code || 200).json(r.response_json); }

    try {
      await client.query(`INSERT INTO idempotency_keys(key, method, org_id, status, created_at) VALUES($1,$2,$3,'inflight', now())`, [idempotencyKey, 'POST /paymaster/preauth', orgId]);
    } catch (e) {
      await client.query('ROLLBACK');
      incCounter(idempotencyPersistenceFailures, 1, (res.locals as any).metricsLabels);
      if (process.env.IDEMPOTENCY_STRICT === 'true') return res.status(503).json({ error: 'IDEMPOTENCY_PERSIST_FAIL' });
    }

    const accRes = await client.query(`SELECT balance_cents FROM credit_accounts WHERE org_id=$1 FOR UPDATE`, [orgId]);
    if (accRes.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'ACCOUNT_NOT_FOUND' }); }
    const balance = BigInt(accRes.rows[0].balance_cents);
    const heldRes = await client.query(`SELECT COALESCE(SUM(amount_cents),0) AS total_held FROM credit_holds WHERE org_id=$1 AND status='active'`, [orgId]);
    const totalHeld = BigInt(heldRes.rows[0].total_held || 0);
    const availableAfterHolds = balance - totalHeld;
  if (availableAfterHolds < BigInt(holdCents)) { await client.query('ROLLBACK'); incCounter(preauthRejects, 1, (res.locals as any).metricsLabels); return res.status(409).json({ error: 'INSUFFICIENT_CREDITS' }); }

    await client.query(`INSERT INTO credit_holds(approval_id, org_id, amount_cents, method, params_hash, fx_snapshot, expires_at, status) VALUES($1,$2,$3,$4,$5,$6,$7,'active')`, [holdId, orgId, holdCents, method || null, paramsHash || null, fx ? JSON.stringify(fx) : null, expiresAt || null]);
    await client.query(`UPDATE credit_accounts SET balance_cents = balance_cents - $1, updated_at = now() WHERE org_id = $2`, [holdCents, orgId]);
    const txId = uuidv4();
    await client.query(`INSERT INTO credit_transactions(id, org_id, type, amount_cents, reason, ref_id) VALUES($1,$2,'hold',$3,$4,$5)`, [txId, orgId, -Math.abs(holdCents), 'hold', holdId]);

    const resp = { approvalId: holdId, creditsHoldCents: holdCents, expiresAt };
    await client.query(`UPDATE idempotency_keys SET response_json=$1, status_code=$2, status='done', expires_at=now() + interval '72 hours' WHERE key=$3`, [JSON.stringify(resp), 200, idempotencyKey]);
    await client.query('COMMIT');

  incCounter(holdsCreated, 1, (res.locals as any).metricsLabels);
    timer();
    return res.status(200).json(resp);
  } catch (err: any) {
    if ((err.message || '').includes('INSUFFICIENT')) return res.status(409).json({ error: 'INSUFFICIENT_CREDITS' });
    return res.status(500).json({ error: err.message || 'preauth failed' });
  } finally {
    client.release();
    try { const released = await redis.releaseLockToken(lockKey, lockToken as string); if (!released) await missedRelease.inc(); } catch (e) { /* best-effort */ }
  }
});

router.post('/settle', async (req: Request, res: Response) => {
  const idempotencyKey = requireIdempotencyHeader(req, res);
  if (!idempotencyKey) return;
  const { approvalId, txHash, gasUsedWei, effectiveGasPriceWei } = req.body as any;
  if (!approvalId || !txHash || !gasUsedWei || !effectiveGasPriceWei) return res.status(400).json({ error: 'approvalId, txHash, gasUsedWei, effectiveGasPriceWei required' });

  const replay = await replayLookup(idempotencyKey);
  if (replay) return res.status(replay.status_code || 200).json(replay.response_json);

  const lockKey = `paymaster:approval:${approvalId}`;
  const lockToken = await redis.acquireLockToken(lockKey, 60);
  if (!lockToken) { incCounter(rateLimitHits, 1, (res.locals as any).metricsLabels); return res.status(429).set('Retry-After', '3').json({ error: 'RATE_LIMITED' }); }

  const pool = getDatabase();
  const client = await pool.connect();
  try {
    const timer = settleLatency.startTimer();
    await client.query('BEGIN');

    try {
      await client.query(`INSERT INTO idempotency_keys(key, method, org_id, status, created_at) VALUES($1,$2,$3,'inflight', now())`, [idempotencyKey, 'POST /paymaster/settle', null]);
    } catch (e) {
      await client.query('ROLLBACK');
      incCounter(idempotencyPersistenceFailures, 1, (res.locals as any).metricsLabels);
      if (process.env.IDEMPOTENCY_STRICT === 'true') return res.status(503).json({ error: 'IDEMPOTENCY_PERSIST_FAIL' });
    }

    const holdRes = await client.query(`SELECT id, org_id, amount_cents, params_hash, expires_at FROM credit_holds WHERE approval_id=$1 FOR UPDATE`, [approvalId]);
    if (holdRes.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'HOLD_NOT_FOUND' }); }
    const hold = holdRes.rows[0];

    const secret = process.env.PAYMASTER_HMAC_SECRET;
    if (!secret) { await client.query('ROLLBACK'); return res.status(500).json({ error: 'PAYMASTER_HMAC_SECRET not configured' }); }
    const canonical = `${hold.params_hash||''}|${approvalId}|${gasUsedWei}|${effectiveGasPriceWei}`;
    const expected = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
    if (!req.header('x-signature') || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.header('x-signature') || ''))) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'PREAUTH_MISMATCH' }); }

    if (hold.expires_at && new Date(hold.expires_at) < new Date()) {
      await client.query('ROLLBACK');
  try { await client.query(`UPDATE idempotency_keys SET response_json=$1, status_code=$2, status='done', expires_at=now() + interval '72 hours' WHERE key=$3`, [JSON.stringify({ error: 'PREAUTH_EXPIRED' }), 409, idempotencyKey]); } catch(e) { incCounter(idempotencyPersistenceFailures, 1, (res.locals as any).metricsLabels); if (process.env.IDEMPOTENCY_STRICT === 'true') throw e; }
      return res.status(409).json({ error: 'PREAUTH_EXPIRED' });
    }

    const ethUsdCents = 180000;
    const actualWei = BigInt(gasUsedWei) * BigInt(effectiveGasPriceWei);
    const actualCents = Number((actualWei * BigInt(ethUsdCents)) / BigInt(1e18));

    const accRes = await client.query(`SELECT balance_cents, daily_gas_cap_cents, daily_gas_spend_cents, spend_window_start FROM credit_accounts WHERE org_id=$1 FOR UPDATE`, [hold.org_id]);
    if (accRes.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'ACCOUNT_NOT_FOUND' }); }
    const acc = accRes.rows[0];
    const cap = Number(acc.daily_gas_cap_cents || 0);
    let spend = Number(acc.daily_gas_spend_cents || 0);
    const start = acc.spend_window_start ? new Date(acc.spend_window_start) : null;
    const now = new Date();
    if (start === null || (now.getTime() - start.getTime()) >= 24 * 3600 * 1000) {
      spend = 0;
      await client.query(`UPDATE credit_accounts SET daily_gas_spend_cents = 0, spend_window_start = now() WHERE org_id=$1`, [hold.org_id]);
    }
    if (cap > 0 && (spend + actualCents) > cap) {
      await client.query('ROLLBACK');
  try { await client.query(`UPDATE idempotency_keys SET response_json=$1, status_code=$2, status='done', expires_at=now() + interval '72 hours' WHERE key=$3`, [JSON.stringify({ error: 'DAILY_GAS_CAP_EXCEEDED' }), 409, idempotencyKey]); } catch(e) { incCounter(idempotencyPersistenceFailures, 1, (res.locals as any).metricsLabels); if (process.env.IDEMPOTENCY_STRICT === 'true') throw e; }
      return res.status(409).json({ error: 'DAILY_GAS_CAP_EXCEEDED' });
    }

    const existingDebit = await client.query(`SELECT id, amount_cents FROM credit_transactions WHERE ref_id=$1 AND type='debit' LIMIT 1`, [approvalId]);
    if (existingDebit.rowCount > 0) {
      const row = existingDebit.rows[0];
      await client.query('COMMIT');
      const respCached = { txnId: row.id, debitedCents: Math.abs(Number(row.amount_cents)) };
  try { await client.query(`UPDATE idempotency_keys SET response_json=$1, status_code=$2, status='done', expires_at=now() + interval '72 hours' WHERE key=$3`, [JSON.stringify(respCached), 200, idempotencyKey]); } catch(e) { incCounter(idempotencyPersistenceFailures, 1, (res.locals as any).metricsLabels); if (process.env.IDEMPOTENCY_STRICT === 'true') throw e; }
  incCounter(settleDebits, 1, (res.locals as any).metricsLabels);
      timer();
      return res.status(200).json(respCached);
    }

    await client.query(`UPDATE credit_holds SET status='captured' WHERE id=$1`, [hold.id]);
  const txId = uuidv4();
  await client.query(`INSERT INTO credit_transactions(id, org_id, type, amount_cents, reason, ref_id, provider, provider_ref, created_at) VALUES($1,$2,'debit',$3,$4,$5,$6,$7, now())`, [txId, hold.org_id, -Math.abs(actualCents), 'capture', approvalId, 'onchain', txHash]);
    await client.query(`UPDATE credit_accounts SET daily_gas_spend_cents = COALESCE(daily_gas_spend_cents,0) + $1, spend_window_start = COALESCE(spend_window_start, now()) WHERE org_id=$2`, [actualCents, hold.org_id]);

    await client.query('COMMIT');
    const resp = { txnId: txId, debitedCents: actualCents };
  try { await client.query(`UPDATE idempotency_keys SET response_json=$1, status_code=$2, status='done', expires_at=now() + interval '72 hours' WHERE key=$3`, [JSON.stringify(resp), 200, idempotencyKey]); } catch(e) { incCounter(idempotencyPersistenceFailures, 1, (res.locals as any).metricsLabels); if (process.env.IDEMPOTENCY_STRICT === 'true') throw e; }

  incCounter(settleDebits, 1, (res.locals as any).metricsLabels);
    timer();
    return res.status(200).json(resp);
  } catch (err: any) {
    try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    return res.status(500).json({ error: err.message || 'settle failed' });
  } finally {
    client.release();
    try { const released = await redis.releaseLockToken(lockKey, lockToken as string); if (!released) await missedRelease.inc(); } catch (e) { /* best-effort */ }
  }
});

export default router;
