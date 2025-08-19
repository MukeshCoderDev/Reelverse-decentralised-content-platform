import express from 'express';
import bodyParser from 'body-parser';
import * as crypto from 'crypto';
import { env } from '../config/env';

const app = express();
app.use(bodyParser.json());
 
const PORT = env.PORT;
const HMAC_SECRET = env.PAYMASTER_HMAC_SECRET;
 
app.post('/api/v1/paymaster/settle', (req, res) => {
  const idempotency = req.header('x-idempotency-key');
  const signature = req.header('x-signature') as string | undefined;
  const { approvalId, txHash, gasUsedWei, effectiveGasPriceWei } = req.body as any;
  if (!idempotency || !signature) return res.status(400).json({ error: 'missing headers' });
  if (!approvalId || !txHash || !gasUsedWei || !effectiveGasPriceWei) return res.status(400).json({ error: 'missing body' });
 
  const canonical = `${''}|${approvalId}|${gasUsedWei}|${effectiveGasPriceWei}`;
  const expected = crypto.createHmac('sha256', HMAC_SECRET).update(canonical).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return res.status(400).json({ error: 'signature_mismatch' });
 
  console.log(`Stub: received settle for approval=${approvalId} tx=${txHash}`);
  return res.status(200).json({ ok: true, approvalId, txHash });
});
 
app.listen(PORT, () => console.log(`Paymaster stub listening on http://localhost:${PORT}`));
 
export default app;
