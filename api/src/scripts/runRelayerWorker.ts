import { env } from '../config/env';
import { currentChainConfig } from '../config/chain';
import RelayerService from '../services/onchain/relayerService';
import RelayerWorker from '../services/onchain/relayerWorker';
import { FileSigner, KmsSignerStub } from '../services/onchain/signerAdapter';

async function main(){
  const rpc = currentChainConfig.rpcUrl;
  const apiBase = env.API_BASE_URL;
 
  // Signer adapter selection: RELAYER_SIGNER_MODE = 'file'|'kms' (default: file if PRIVATE_KEY set)
  let signerAdapter: any = undefined;
  const mode = env.RELAYER_SIGNER_MODE || (env.PLATFORM_PRIVATE_KEY ? 'file' : undefined);
  if (mode === 'file' && env.PLATFORM_PRIVATE_KEY) {
    signerAdapter = new FileSigner(env.PLATFORM_PRIVATE_KEY as string, rpc);
  } else if (mode === 'kms') {
    signerAdapter = new KmsSignerStub();
  }
 
  const relayer = new RelayerService({ rpcUrl: rpc, apiBaseUrl: apiBase, signerAdapter });
  const worker = new RelayerWorker(relayer, env.RELAYER_POLL_MS);
  await worker.start();
}

if(require.main === module) main().catch(e => { console.error(e); process.exit(2); });

export default main;
