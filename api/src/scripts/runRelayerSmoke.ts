import RelayerService from '../services/onchain/relayerService';
import { FileSigner, KmsSignerStub } from '../services/onchain/signerAdapter';
import * as dotenv from 'dotenv';

dotenv.config();

async function main(){
  const rpc = process.env.RPC_URL || 'http://localhost:8545';
  const apiBase = process.env.API_BASE || 'http://localhost:3001';
  const relayer = new RelayerService({ rpcUrl: rpc, apiBaseUrl: apiBase });

  // For smoke, accept env vars for approvalId and gas fields
  const approvalId = process.env.SMOKE_APPROVAL_ID || 'smoke-hold-1';
  const txHash = process.env.SMOKE_TX_HASH || '0x' + '0'.repeat(64);
  const gasUsed = process.env.SMOKE_GAS_USED || '21000';
  const effectiveGasPrice = process.env.SMOKE_EFFECTIVE_GAS_PRICE || '20000000000';

  // If private key provided, use the FileSigner via signerAdapter
  const signerAdapter = process.env.PRIVATE_KEY ? new FileSigner(process.env.PRIVATE_KEY as string, rpc) : undefined;
  if (signerAdapter) relayer['signerAdapter'] = signerAdapter;

  try{
    const resp = await relayer.callSettle({ approvalId, txHash, gasUsedWei: gasUsed, effectiveGasPriceWei: effectiveGasPrice, correlationId: 'smoke-relayer' });
    console.log('settle response:', resp);
  }catch(e){
    console.error('smoke relayer error', e);
    process.exitCode = 2;
  }
}

if(require.main === module) main();

export default main;
