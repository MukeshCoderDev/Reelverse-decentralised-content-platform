import { getDatabase } from '../../config/database';
import RelayerService from './relayerService';
import { RedisService } from '../../config/redis';
import * as crypto from 'crypto';
import { logger } from '../../utils/logger';

export class RelayerWorker {
  relayer: RelayerService;
  redis: ReturnType<typeof RedisService.getInstance>;
  pollIntervalMs: number;
  running = false;

  constructor(relayer: RelayerService, pollIntervalMs = 5000) {
    this.relayer = relayer;
    this.redis = RedisService.getInstance();
    this.pollIntervalMs = pollIntervalMs;
  }

  async processOnce() {
    const pool = getDatabase();
    const client = await pool.connect();
    try {
      const res = await client.query(`SELECT approval_id, org_id, amount_cents, params_hash, expires_at FROM credit_holds WHERE status='active' LIMIT 10`);
      for (const row of res.rows) {
        const approvalId = row.approval_id;
        const lockKey = `relayer:approval:${approvalId}`;
        try {
          const token = await this.redis.acquireLockToken(lockKey, 60);
          if (!token) continue; // another worker handling

          // If a PRIVATE_KEY is provided, use local signer to submit a real tx and wait for receipt.
          let txHash: string | undefined;
          let gasUsedWei = '21000';
          let effectiveGasPriceWei = '20000000000';

          try {
            const privateKey = process.env.PRIVATE_KEY;
            if (privateKey) {
              const dest = process.env.RELAYER_TX_TO || '0x0000000000000000000000000000000000000000';
              const txRequest = { to: dest, value: 0, gasLimit: 21000 } as any;
              logger.info(`Relayer: sending real tx for approval ${approvalId} to ${dest}`);
              try {
                const { receipt, settleResp } = await this.relayer.submitTxAndCallSettle({ approvalId, txRequest, privateKey, paramsHash: row.params_hash, correlationId: `relayer-${approvalId}` });
                logger.info(`Relayer: tx submitted and settled for approval ${approvalId} tx=${receipt.transactionHash || receipt.hash}`);
              } catch (e) {
                logger.error('Relayer submitTxAndCallSettle failed', e);
                // fallback to simulated path below
              }
            }

            // fallback / simulated path if no PRIVATE_KEY or submit failed
            if (!process.env.PRIVATE_KEY) {
              txHash = '0x' + crypto.createHash('sha256').update(approvalId + Date.now().toString()).digest('hex').slice(0,64);
              logger.info(`Relayer: processing approval ${approvalId}, simulated tx ${txHash}`);
              try {
                await this.relayer.callSettle({ approvalId, txHash, gasUsedWei, effectiveGasPriceWei, paramsHash: row.params_hash, correlationId: `relayer-${approvalId}` });
              } catch (e) {
                logger.error('Relayer callSettle failed', e);
              }
            }
          } catch (e) {
            logger.error('Relayer processing error during tx/settle', e);
          }

          const released = await this.redis.releaseLockToken(lockKey, token as string);
          if (!released) logger.warn(`Relayer: failed to release lock for ${approvalId}`);
        } catch (e) {
          logger.error('Relayer processing error', e);
        }
      }
    } finally {
      client.release();
    }
  }

  async start() {
    if (this.running) return;
    this.running = true;
    logger.info('RelayerWorker starting');
    while (this.running) {
      try { await this.processOnce(); } catch (e) { logger.error('Relayer loop error', e); }
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
    }
  }

  stop() { this.running = false; }
}

export default RelayerWorker;
