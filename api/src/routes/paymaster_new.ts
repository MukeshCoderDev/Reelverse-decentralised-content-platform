import express from 'express';
import { Request, Response } from 'express';
import { RedisService } from '../config/redis';
import { getDatabase } from '../config/database';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { FxSnapshot } from '../../services/credits/types';
import metrics, { holdsCreated, settleDebits, rateLimitHits, idempotencyPersistenceFailures, preauthLatency, settleLatency, missedRelease, preauthRejects } from '../utils/metrics';

const router = express.Router();
const redis = RedisService.getInstance();

function requireIdempotencyHeader(req: Request, res: Response): string | null {
  const key = (req.header('x-idempotency-key')) as string | undefined;
  if (!key) {
    res.status(400).json({ error: 'Missing X-Idempotency-Key' });
    return null;
  }
  return key;
}

// POST /preauth - create a temporary hold (reserve credits)
router.post('/preauth', async (req: Request, res: Response) => {
  const idempotencyKey = requireIdempotencyHeader(req, res);
  if (!idempotencyKey) return;

  const signature = req.header('x-signature');
  const { orgId, holdId, estGasWei, maxFeePerGasWei, maxPriorityFeePerGasWei, method, paramsHash, expiresAt } = req.body as any;
  if (!orgId || !holdId || !estGasWei) return res.status(400).json({ error: 'orgId, holdId, estGasWei required' });

  // quick replay check outside tx
  try {
    const pool = getDatabase();
    const existing = await pool.query(`SELECT response_json, status_code FROM idempotency_keys WHERE key=$1 LIMIT 1`, [idempotencyKey]);
    if (existing.rowCount > 0) {
      const r = existing.rows[0];
      return res.status(r.status_code || 200).json(r.response_json);
    }
  } catch (e) { /* best-effort */ }

  // simple rate limiting
  const rateKey = `rate:preauth:${orgId}`;
  const allowed = await redis.incrementRateLimit(rateKey, 24 * 3600);
  if (allowed > 100) { await rateLimitHits.inc(); return res.status(429).set('Retry-After', '3600').json({ error: 'RATE_LIMITED' }); }

  // HMAC signature check
  const secret = process.env.PAYMASTER_HMAC_SECRET;
  if (!secret) return res.status(500).json({ error: 'PAYMASTER_HMAC_SECRET not configured' });
  const canonical = `${method||''}|${paramsHash||''}|${estGasWei}|${maxFeePerGasWei||''}|${maxPriorityFeePerGasWei||''}|${expiresAt||''}|${orgId}`;
  const expected = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
  if (!signature || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return res.status(400).json({ error: 'PREAUTH_MISMATCH' });

  // compute hold amount (cents) - simplified FX snapshot
  const ethUsdCents = 180000; // 1800.00 USD
  const fx: FxSnapshot = { ethUsdCents, takenAt: new Date().toISOString() };
  const estGas = BigInt(estGasWei);
  const maxFee = BigInt(maxFeePerGasWei || '20000000000');
  const totalWei = estGas * maxFee;
  const totalEthMulCents = (totalWei * BigInt(ethUsdCents)) / BigInt(1e18);
  const holdCents = Number(totalEthMulCents);

  // Acquire token lock for this approval
  const lockKey = `paymaster:approval:${holdId}`;
  const lockToken = await redis.acquireLockToken(lockKey, 30);
  if (!lockToken) { await rateLimitHits.inc(); return res.status(429).set('Retry-After', '3').json({ error: 'RATE_LIMITED' }); }

  const pool = getDatabase();
  const client = await pool.connect();
  try {
    const timer = preauthLatency.startTimer();
    await client.query('BEGIN');

    // replay check inside tx
    const existing2 = await client.query(`SELECT response_json, status_code FROM idempotency_keys WHERE key=$1 LIMIT 1`, [idempotencyKey]);
    if (existing2.rowCount > 0) { const r = existing2.rows[0]; await client.query('ROLLBACK'); timer(); return res.status(r.status_code || 200).json(r.response_json); }

    // persist inflight idempotency BEFORE mutating
    try {
      await client.query(`INSERT INTO idempotency_keys(key, method, org_id, status, created_at) VALUES($1,$2,$3,'inflight', now())`, [idempotencyKey, 'POST /paymaster/preauth', orgId]);
    } catch (e) {
      await client.query('ROLLBACK');
      await idempotencyPersistenceFailures.inc();
      if (process.env.IDEMPOTENCY_STRICT === 'true') {
        return res.status(503).json({ error: 'IDEMPOTENCY_PERSIST_FAIL' });
      }
      // otherwise, fallthrough to best-effort behavior
    }

    // inline hold creation for atomicity
    const accRes = await client.query(`SELECT balance_cents FROM credit_accounts WHERE org_id=$1 FOR UPDATE`, [orgId]);
    if (accRes.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'ACCOUNT_NOT_FOUND' }); }
    const balance = BigInt(accRes.rows[0].balance_cents);
    const holdAmt = BigInt(holdCents);
    const heldRes = await client.query(`SELECT COALESCE(SUM(amount_cents),0) AS total_held FROM credit_holds WHERE org_id=$1 AND status='active'`, [orgId]);
    const totalHeld = BigInt(heldRes.rows[0].total_held || 0);
    const availableAfterHolds = balance - totalHeld;
    if (availableAfterHolds < holdAmt) { await client.query('ROLLBACK'); await preauthRejects.inc(); return res.status(409).json({ error: 'INSUFFICIENT_CREDITS' }); }

    await client.query(`INSERT INTO credit_holds(approval_id, org_id, amount_cents, method, params_hash, fx_snapshot, expires_at, status) VALUES($1,$2,$3,$4,$5,$6,$7,'active')`, [holdId, orgId, holdCents, method || null, paramsHash || null, fx ? JSON.stringify(fx) : null, expiresAt || null]);
    await client.query(`UPDATE credit_accounts SET balance_cents = balance_cents - $1, updated_at = now() WHERE org_id = $2`, [holdCents, orgId]);
    const txId = uuidv4();
    await client.query(`INSERT INTO credit_transactions(id, org_id, type, amount_cents, reason, ref_id) VALUES($1,$2,'hold',$3,$4,$5)`, [txId, orgId, -Math.abs(holdCents), 'hold', holdId]);

    const resp = { approvalId: holdId, creditsHoldCents: holdCents, expiresAt };
    await client.query(`UPDATE idempotency_keys SET response_json=$1, status_code=$2, status='done', expires_at=now() + interval '72 hours' WHERE key=$3`, [JSON.stringify(resp), 200, idempotencyKey]);
    await client.query('COMMIT');

    await holdsCreated.inc();
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

export default router;
