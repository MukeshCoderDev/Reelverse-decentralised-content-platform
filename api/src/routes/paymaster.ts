import express from 'express';
import { Request, Response } from 'express';
import { RedisService } from '../config/redis';
import creditsService from '../../services/credits/pgCreditsService';
import { FxSnapshot } from '../../services/credits/types';
import { getDatabase } from '../config/database';
import crypto from 'crypto';

const router = express.Router();
const redis = RedisService.getInstance();

// POST /preauth { orgId, holdId, estGasWei, ... }
router.post('/preauth', async (req: Request, res: Response) => {
  const idempotencyKey = req.header('x-idempotency-key');
  const signature = req.header('x-signature');
  const { orgId, holdId, estGasWei, maxFeePerGasWei, maxPriorityFeePerGasWei, method, paramsHash, expiresAt } = req.body as any;
  if (!idempotencyKey) return res.status(400).json({ error: 'Missing X-Idempotency-Key' });
  if (!orgId || !holdId || !estGasWei) return res.status(400).json({ error: 'orgId, holdId, estGasWei required' });

  // quick idempotency replay check (DB)
  try {
    const pool = getDatabase();
    const existing = await pool.query(`SELECT response_json, status_code FROM idempotency_keys WHERE key=$1 LIMIT 1`, [idempotencyKey]);
    if (existing.rowCount > 0) {
      const r = existing.rows[0];
      return res.status(r.status_code || 200).json(r.response_json);
    }
  } catch (e) {
    // proceed — idempotency table may not exist in some environments
  }

  // Rate limiting: allow 100 preauths/day per org
  const rateKey = `rate:preauth:${orgId}`;
  const allowed = await redis.incrementRateLimit(rateKey, 24 * 3600);
  if (allowed > 100) {
    return res.status(429).set('Retry-After', '3600').json({ error: 'RATE_LIMITED' });
  }

  // signature verification (HMAC) to protect parameters
  const secret = process.env.PAYMASTER_HMAC_SECRET;
  if (!secret) return res.status(500).json({ error: 'PAYMASTER_HMAC_SECRET not configured' });
  const canonical = `${method||''}|${paramsHash||''}|${estGasWei}|${maxFeePerGasWei||''}|${maxPriorityFeePerGasWei||''}|${expiresAt||''}|${orgId}`;
  const expected = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
  if (!signature || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return res.status(400).json({ error: 'PREAUTH_MISMATCH' });
  }

  // FX snapshot stub
  const ethUsdCents = 180000;
  const fx: FxSnapshot = { ethUsdCents, takenAt: new Date().toISOString() };

  const estGas = BigInt(estGasWei);
  const maxFee = BigInt(maxFeePerGasWei || '20000000000');
  const totalWei = estGas * maxFee;
  const totalEthMulCents = (totalWei * BigInt(ethUsdCents)) / BigInt(1e18);
  const holdCents = Number(totalEthMulCents);

  // Acquire short lock per approval to avoid races across replicas
  const lockKey = `paymaster:approval:${holdId}`;
  const got = await redis.acquireLock(lockKey, 30);
  if (!got) return res.status(429).set('Retry-After', '3').json({ error: 'RATE_LIMITED' });

  try {
    // re-check idempotency in DB (race-safe)
    const pool = getDatabase();
    const existing2 = await pool.query(`SELECT response_json, status_code FROM idempotency_keys WHERE key=$1 LIMIT 1`, [idempotencyKey]);
    if (existing2.rowCount > 0) {
      const r = existing2.rows[0];
      return res.status(r.status_code || 200).json(r.response_json);
    }

    await creditsService.holdCredits(orgId, holdId, holdCents, method, paramsHash, fx, expiresAt);

    const resp = { approvalId: holdId, creditsHoldCents: holdCents, expiresAt };
    try {
      const pool = getDatabase();
      await pool.query(`INSERT INTO idempotency_keys(key, method, org_id, body_hash, response_json, status_code, expires_at) VALUES($1,$2,$3,$4,$5,$6, now() + interval '1 day') ON CONFLICT (key) DO NOTHING`, [idempotencyKey, 'POST /paymaster/preauth', orgId, null, JSON.stringify(resp), 200]);
    } catch (e) {
      // best-effort idempotency persistence
    }

    await redis.incrementCounter('paymaster_holds_total');
    return res.status(200).json(resp);
  } catch (err: any) {
    if ((err.message || '').includes('INSUFFICIENT')) return res.status(409).json({ error: 'INSUFFICIENT_CREDITS' });
    return res.status(500).json({ error: err.message || 'preauth failed' });
  } finally {
    await redis.releaseLock(lockKey);
  }
});

// POST /settle { orgId, holdId, capture }
router.post('/settle', async (req: Request, res: Response) => {
  const idempotencyKey = req.header('x-idempotency-key');
  const signature = req.header('x-signature');
  const { approvalId, txHash, gasUsedWei, effectiveGasPriceWei } = req.body as any;
  if (!idempotencyKey) return res.status(400).json({ error: 'Missing X-Idempotency-Key' });
  if (!approvalId || !txHash || !gasUsedWei || !effectiveGasPriceWei) return res.status(400).json({ error: 'approvalId, txHash, gasUsedWei, effectiveGasPriceWei required' });

  // idempotency replay check
  try {
    const pool = getDatabase();
    const existing = await pool.query(`SELECT response_json, status_code FROM idempotency_keys WHERE key=$1 LIMIT 1`, [idempotencyKey]);
    if (existing.rowCount > 0) {
      const r = existing.rows[0];
      return res.status(r.status_code || 200).json(r.response_json);
    }
  } catch (e) {
    // continue
  }

  // Acquire lock on approvalId
  const lockKey = `paymaster:approval:${approvalId}`;
  const got = await redis.acquireLock(lockKey, 30);
  if (!got) return res.status(429).set('Retry-After', '3').json({ error: 'RATE_LIMITED' });

  const pool = getDatabase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // fetch hold and lock it
    const holdRes = await client.query(`SELECT id, org_id, amount_cents, params_hash, expires_at FROM credit_holds WHERE approval_id=$1 FOR UPDATE`, [approvalId]);
    if (holdRes.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'HOLD_NOT_FOUND' }); }
    const hold = holdRes.rows[0];

    // verify signature against stored params_hash and gas values
    const secret = process.env.PAYMASTER_HMAC_SECRET;
    if (!secret) { await client.query('ROLLBACK'); return res.status(500).json({ error: 'PAYMASTER_HMAC_SECRET not configured' }); }
    const canonical = `${hold.params_hash||''}|${approvalId}|${gasUsedWei}|${effectiveGasPriceWei}`;
    const expected = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
    if (!signature || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'PREAUTH_MISMATCH' }); }

    // check expiry
    if (hold.expires_at && new Date(hold.expires_at) < new Date()) { await client.query('ROLLBACK');
      // persist idempotency as expired response
      try { await pool.query(`INSERT INTO idempotency_keys(key, method, org_id, body_hash, response_json, status_code, expires_at) VALUES($1,$2,$3,$4,$5,$6, now() + interval '1 day') ON CONFLICT (key) DO NOTHING`, [idempotencyKey, 'POST /paymaster/settle', hold.org_id, null, JSON.stringify({ error: 'PREAUTH_EXPIRED' }), 409]); } catch(e){}
      return res.status(409).json({ error: 'PREAUTH_EXPIRED' }); }

  // compute actual cents
    const ethUsdCents = 180000;
    const actualWei = BigInt(gasUsedWei) * BigInt(effectiveGasPriceWei);
    const actualCents = Number((actualWei * BigInt(ethUsdCents)) / BigInt(1e18));

    // load account and enforce daily cap window
    const accRes = await client.query(`SELECT balance_cents, daily_gas_cap_cents, daily_gas_spend_cents, spend_window_start FROM credit_accounts WHERE org_id=$1 FOR UPDATE`, [hold.org_id]);
    if (accRes.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'ACCOUNT_NOT_FOUND' }); }
    const acc = accRes.rows[0];
    const cap = Number(acc.daily_gas_cap_cents || 0);
    let spend = Number(acc.daily_gas_spend_cents || 0);
    const start = acc.spend_window_start ? new Date(acc.spend_window_start) : null;
    const now = new Date();
    if (start === null || (now.getTime() - start.getTime()) >= 24 * 3600 * 1000) {
      // reset window
      spend = 0;
      await client.query(`UPDATE credit_accounts SET daily_gas_spend_cents = 0, spend_window_start = now() WHERE org_id=$1`, [hold.org_id]);
    }
    if (cap > 0 && (spend + actualCents) > cap) { await client.query('ROLLBACK');
      try { await pool.query(`INSERT INTO idempotency_keys(key, method, org_id, body_hash, response_json, status_code, expires_at) VALUES($1,$2,$3,$4,$5,$6, now() + interval '1 day') ON CONFLICT (key) DO NOTHING`, [idempotencyKey, 'POST /paymaster/settle', hold.org_id, null, JSON.stringify({ error: 'DAILY_GAS_CAP_EXCEEDED' }), 409]); } catch(e){}
      return res.status(409).json({ error: 'DAILY_GAS_CAP_EXCEEDED' }); }

    // if a debit transaction already exists for this approvalId, return it (idempotent settle)
    const existingDebit = await client.query(`SELECT id, amount_cents FROM credit_transactions WHERE ref_id=$1 AND type='debit' LIMIT 1`, [approvalId]);
    if (existingDebit.rowCount > 0) {
      const row = existingDebit.rows[0];
      await client.query('COMMIT');
      const respCached = { txnId: row.id, debitedCents: Math.abs(Number(row.amount_cents)) };
      try { await pool.query(`INSERT INTO idempotency_keys(key, method, org_id, body_hash, response_json, status_code, expires_at) VALUES($1,$2,$3,$4,$5,$6, now() + interval '1 day') ON CONFLICT (key) DO NOTHING`, [idempotencyKey, 'POST /paymaster/settle', hold.org_id, null, JSON.stringify(respCached), 200]); } catch(e){}
      await redis.incrementCounter('paymaster_settles_total');
      return res.status(200).json(respCached);
    }

    // capture: mark hold captured, insert debit transaction, increment daily spend
    await client.query(`UPDATE credit_holds SET status='captured' WHERE id=$1`, [hold.id]);
    const txId = require('uuid').v4();
    await client.query(`INSERT INTO credit_transactions(id, org_id, type, amount_cents, reason, ref_id, created_at) VALUES($1,$2,'debit',$3,$4,$5, now())`, [txId, hold.org_id, -Math.abs(actualCents), 'capture', approvalId]);
    await client.query(`UPDATE credit_accounts SET daily_gas_spend_cents = COALESCE(daily_gas_spend_cents,0) + $1, spend_window_start = COALESCE(spend_window_start, now()) WHERE org_id=$2`, [actualCents, hold.org_id]);

    await client.query('COMMIT');

    const resp = { txnId: txId, debitedCents: actualCents };
    try { await pool.query(`INSERT INTO idempotency_keys(key, method, org_id, body_hash, response_json, status_code, expires_at) VALUES($1,$2,$3,$4,$5,$6, now() + interval '1 day') ON CONFLICT (key) DO NOTHING`, [idempotencyKey, 'POST /paymaster/settle', hold.org_id, null, JSON.stringify(resp), 200]); } catch(e){}

    await redis.incrementCounter('paymaster_settles_total');
    return res.status(200).json(resp);
  } catch (err: any) {
    try { await client.query('ROLLBACK'); } catch(e){}
    return res.status(500).json({ error: err.message || 'settle failed' });
  } finally {
    client.release();
    await redis.releaseLock(lockKey);
  }
});

export default router;
