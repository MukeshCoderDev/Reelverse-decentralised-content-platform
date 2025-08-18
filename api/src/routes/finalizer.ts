import express from 'express';
import { Request, Response } from 'express';
import { RedisService } from '../config/redis';

const router = express.Router();
const redis = RedisService.getInstance();

// POST /enqueue { orgId, uploadId, metadata }
router.post('/enqueue', async (req: Request, res: Response) => {
  const { orgId, uploadId, metadata } = req.body as any;
  if (!orgId || !uploadId) return res.status(400).json({ error: 'orgId and uploadId required' });

  await redis.pushToQueue('finalizer', { orgId, uploadId, metadata, enqueuedAt: new Date().toISOString() });
  return res.status(200).json({ status: 'enqueued' });
});

// GET /status?queueLength
router.get('/status', async (req: Request, res: Response) => {
  const len = await redis.getQueueLength('finalizer');
  return res.status(200).json({ queueLength: len });
});

export default router;
