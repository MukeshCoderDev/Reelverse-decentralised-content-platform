import * as dotenv from 'dotenv';
import RelayerService from '../services/onchain/relayerService';

dotenv.config();

async function main() {
  const rpc = process.env.RPC_URL || 'http://localhost:8545';
  const apiBase = process.env.API_BASE || 'http://localhost:3001';
  const privateKey = process.env.PRIVATE_KEY;
  const approvalId = process.env.SMOKE_APPROVAL_ID || 'smoke-hold-1';
  const dest = process.env.RELAYER_TX_TO || '0x0000000000000000000000000000000000000000';

  if (!privateKey) {
    console.error('PRIVATE_KEY is required for integration smoke');
    process.exitCode = 2;
    return;
  }

  const { FileSigner, KmsSignerStub } = await import('../services/onchain/signerAdapter');
  // prefer file signer when PRIVATE_KEY is set
  const signerAdapter = privateKey ? new FileSigner(privateKey, rpc) : undefined;
  const relayer = new RelayerService({ rpcUrl: rpc, apiBaseUrl: apiBase, signerAdapter });

  const txRequest = { to: dest, value: 0, gasLimit: 21000 } as any;

  try {
    console.log('Submitting real tx and calling settle...');
    const result = await relayer.submitTxAndCallSettle({ approvalId, txRequest, privateKey, paramsHash: process.env.SMOKE_PARAMS_HASH, correlationId: 'relayer-integration-smoke' });
    console.log('OK result:', result && (result as any).settleResp ? (result as any).settleResp : result);
    process.exitCode = 0;
  } catch (err) {
    console.error('Integration smoke failed', err);
    process.exitCode = 3;
  }
}

if (require.main === module) main();

export default main;
