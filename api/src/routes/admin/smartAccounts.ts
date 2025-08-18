import { Router, Request, Response } from 'express';
import smartAccountService from '../../services/onchain/smartAccountService';

const router = Router();

// Simple admin auth via header X-Admin-Key matching env ADMIN_API_KEY
function requireAdmin(req: Request, res: Response) {
  const key = req.header('x-admin-key');
  if (!process.env.ADMIN_API_KEY) return res.status(500).json({ error: 'ADMIN_API_KEY not configured' });
  if (!key || key !== process.env.ADMIN_API_KEY) { res.status(403).json({ error: 'forbidden' }); return false; }
  return true;
}

// Create or update smart account for an org
router.post('/', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { orgId, privateKey, address } = req.body as any;
  if (!orgId || !privateKey || !address) return res.status(400).json({ error: 'orgId, privateKey, address required' });
  try {
    await smartAccountService.createSmartAccount(orgId, privateKey, address);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'failed' });
  }
});

// Get smart account metadata (does not return private key)
router.get('/:orgId', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const orgId = req.params.orgId;
  try {
    const poolModule = await import('../../config/database');
    const pool = poolModule.getDatabase();
    const client = await pool.connect();
    try {
      const r = await client.query('SELECT org_id, address, created_at FROM smart_accounts WHERE org_id=$1 LIMIT 1', [orgId]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(r.rows[0]);
    } finally { client.release(); }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'failed' });
  }
});

export default router;
