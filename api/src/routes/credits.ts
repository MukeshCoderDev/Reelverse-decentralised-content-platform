import express from 'express';
import { Request, Response } from 'express';
import { RedisService } from '../config/redis';
import creditsService from '../../services/credits/pgCreditsService';

const router = express.Router();
const redis = RedisService.getInstance();

// POST /topup { orgId, amountCents, provider, providerRef }
router.post('/topup', async (req: Request, res: Response) => {
  const { orgId, amountCents, provider, providerRef } = req.body as { orgId?: string; amountCents?: number; provider?: string; providerRef?: string };
  if (!orgId || typeof amountCents !== 'number') return res.status(400).json({ error: 'orgId and amountCents required' });

  const idemp = String(req.header('X-Idempotency-Key') || '');
  try {
    const tx = await creditsService.topUpCredits(orgId, amountCents, provider, providerRef, idemp || undefined);
    const bal = await creditsService.getBalance(orgId);
    return res.status(200).json({ txnId: tx.id, newBalanceCents: bal?.balanceCents || 0 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'topup failed' });
  }
});

// POST /debit { orgId, amountCents, reason }
router.post('/debit', async (req: Request, res: Response) => {
  const { orgId, amountCents, reason } = req.body as { orgId?: string; amountCents?: number; reason?: string };
  if (!orgId || typeof amountCents !== 'number') return res.status(400).json({ error: 'orgId and amountCents required' });
  const idemp = String(req.header('X-Idempotency-Key') || '');
  try {
    const tx = await creditsService.debitCredits(orgId, amountCents, reason, idemp || undefined);
    const bal = await creditsService.getBalance(orgId);
    return res.status(200).json({ txnId: tx.id, newBalanceCents: bal?.balanceCents || 0 });
  } catch (err: any) {
    const msg = err.message || 'debit failed';
    if (msg.includes('INSUFFICIENT')) return res.status(409).json({ error: 'INSUFFICIENT_CREDITS' });
    return res.status(500).json({ error: msg });
  }
});

// GET /balance?orgId=...
router.get('/balance', async (req: Request, res: Response) => {
  const orgId = String(req.query.orgId || '');
  if (!orgId) return res.status(400).json({ error: 'orgId required' });
  const bal = await creditsService.getBalance(orgId);
  if (!bal) return res.status(404).json({ error: 'account not found' });
  return res.status(200).json(bal);
});

export default router;
