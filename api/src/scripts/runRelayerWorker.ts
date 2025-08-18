import * as dotenv from 'dotenv';
import RelayerService from '../services/onchain/relayerService';
import RelayerWorker from '../services/onchain/relayerWorker';
import { FileSigner, KmsSignerStub } from '../services/onchain/signerAdapter';

dotenv.config();

async function main(){
  const rpc = process.env.RPC_URL || 'http://localhost:8545';
  const apiBase = process.env.API_BASE || 'http://localhost:3001';

  // Signer adapter selection: RELAYER_SIGNER_MODE = 'file'|'kms' (default: file if PRIVATE_KEY set)
  let signerAdapter: any = undefined;
  const mode = process.env.RELAYER_SIGNER_MODE || (process.env.PRIVATE_KEY ? 'file' : undefined);
  if (mode === 'file' && process.env.PRIVATE_KEY) {
    signerAdapter = new FileSigner(process.env.PRIVATE_KEY as string, rpc);
  } else if (mode === 'kms') {
    signerAdapter = new KmsSignerStub();
  }

  const relayer = new RelayerService({ rpcUrl: rpc, apiBaseUrl: apiBase, signerAdapter });
  const worker = new RelayerWorker(relayer, Number(process.env.RELAYER_POLL_MS || '5000'));
  await worker.start();
}

if(require.main === module) main().catch(e => { console.error(e); process.exit(2); });

export default main;
