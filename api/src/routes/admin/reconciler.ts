import { Router, Request, Response } from 'express';
import LedgerReconciler from '../../services/onchain/ledgerReconciler';

const router = Router();

function requireAdmin(req: Request, res: Response) {
  const key = req.header('x-admin-key');
  if (!process.env.ADMIN_API_KEY) return res.status(500).json({ error: 'ADMIN_API_KEY not configured' });
  if (!key || key !== process.env.ADMIN_API_KEY) { res.status(403).json({ error: 'forbidden' }); return false; }
  return true;
}

// Trigger a single reconciliation pass
router.post('/run', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rpc = process.env.RPC_URL || 'http://localhost:8545';
    const recon = new LedgerReconciler(rpc, 60000);
    await recon.processOnce();
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'failed' });
  }
});

export default router;
