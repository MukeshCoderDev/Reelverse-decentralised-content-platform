import { getDatabase } from '../../config/database';
import { logger } from '../../utils/logger';

export class LedgerReconciler {
  pollMs: number;
  running = false;
  rpcUrl: string;
  constructor(rpcUrl: string, pollMs = 60_000) {
    this.rpcUrl = rpcUrl;
    this.pollMs = pollMs;
  }

  async processOnce() {
    const pool = getDatabase();
    const client = await pool.connect();
    try {
      // find captured holds without a debit tx recorded in credit_transactions
      const res = await client.query(`SELECT h.approval_id, h.org_id, h.id FROM credit_holds h WHERE h.status='captured' LIMIT 50`);
      for (const row of res.rows) {
        const approvalId = row.approval_id;
        const txRes = await client.query(`SELECT id, provider_ref FROM credit_transactions WHERE ref_id=$1 AND type='debit' LIMIT 1`, [approvalId]);
        if (txRes.rowCount === 0) {
          // no debit found — write a reconciliation log for manual review
          await client.query(`INSERT INTO reconciliation_logs(entity_type, entity_id, message, metadata) VALUES('hold','${approvalId}','missing_debit', $1)`, [JSON.stringify({ holdId: row.id, orgId: row.org_id })]);
          logger.warn(`Reconciler: missing debit for approval ${approvalId}`);
        } else {
          const tx = txRes.rows[0];
          if (!tx.provider_ref) {
            // attempt to reconcile by looking up possible txHash from onchain (skipped here) and log
            await client.query(`INSERT INTO reconciliation_logs(entity_type, entity_id, message, metadata) VALUES('hold','${approvalId}','missing_provider_ref', $1)`, [JSON.stringify({ txId: tx.id })]);
            logger.info(`Reconciler: debit exists but missing provider_ref for approval ${approvalId}`);
          }
        }
      }
    } finally { client.release(); }
  }

  async start() {
    if (this.running) return;
    this.running = true;
    while (this.running) {
      try { await this.processOnce(); } catch (e) { logger.error('Reconciler error', e); }
      await new Promise(r => setTimeout(r, this.pollMs));
    }
  }

  stop() { this.running = false; }
}

export default LedgerReconciler;
