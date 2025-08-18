import * as dotenv from 'dotenv';
import LedgerReconciler from '../services/onchain/ledgerReconciler';

dotenv.config();

async function main(){
  const rpc = process.env.RPC_URL || 'http://localhost:8545';
  const poll = Number(process.env.RECONCILER_POLL_MS || '60000');
  const r = new LedgerReconciler(rpc, poll);
  await r.start();
}

if(require.main === module) main().catch(e => { console.error(e); process.exit(2); });

export default main;
