import express from 'express';
import { Request, Response } from 'express';
import { RedisService } from '../config/redis';

const router = express.Router();
const redis = RedisService.getInstance();

// POST /requestUpload { orgId, preferPermanent }
router.post('/requestUpload', async (req: Request, res: Response) => {
  const { orgId, preferPermanent } = req.body as any;
  if (!orgId) return res.status(400).json({ error: 'orgId required' });

  // Issue a short-lived upload ticket
  const ticket = `ticket_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  await redis.set(`uploadticket:${ticket}`, { orgId, preferPermanent, createdAt: new Date().toISOString() }, 60 * 30);
  return res.status(200).json({ ticket, expiresInSeconds: 60 * 30 });
});

export default router;
