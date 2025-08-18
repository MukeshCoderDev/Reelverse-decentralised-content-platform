import axios from 'axios';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import type { SignerAdapter } from './signerAdapter';

export type RelayerOptions = {
  rpcUrl: string;
  confirmations?: number;
  apiBaseUrl?: string; // paymaster API base (e.g. http://localhost:3001)
  signerAdapter?: SignerAdapter;
};

export class RelayerService {
  rpcUrl: string;
  confirmations: number;
  apiBaseUrl: string;
  signerAdapter?: SignerAdapter;

  constructor(opts: RelayerOptions) {
    this.rpcUrl = opts.rpcUrl;
    this.confirmations = opts.confirmations || 1;
    this.apiBaseUrl = opts.apiBaseUrl || 'http://localhost:3001';
  this.signerAdapter = opts.signerAdapter;
  }

  // Submit a raw, signed transaction hex to the RPC via eth_sendRawTransaction
  async submitRawTx(rawTxHex: string) {
    const payload = { jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: [rawTxHex] };
    const resp = await axios.post(this.rpcUrl, payload, { timeout: 30000 });
    if (resp.data && resp.data.result) {
      const txHash = resp.data.result as string;
      logger.info(`submitted raw tx ${txHash}`);
      return txHash;
    }
    throw new Error('failed to submit raw tx: ' + JSON.stringify(resp.data));
  }

  // Poll for transaction receipt and wait for confirmations
  async waitForConfirmation(txHash: string, timeoutMs = 600000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const payload = { jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash] };
        const resp = await axios.post(this.rpcUrl, payload, { timeout: 15000 });
        const receipt = resp.data && resp.data.result;
        if (receipt && receipt.blockNumber) {
          // optionally check confirmations by comparing block numbers
          logger.info(`tx ${txHash} included in block ${receipt.blockNumber}`);
          return receipt;
        }
      } catch (e) {
        // ignore and retry
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('timed out waiting for tx receipt ' + txHash);
  }

  // Use a local private key signer (ethers at runtime) to send a transaction
  // This method avoids top-level imports of ethers to reduce TS type noise.
  async sendTxFromLocalSigner(txRequest: any, privateKey: string) {
    if (!privateKey) throw new Error('privateKey required for local signer');
    // load ethers dynamically
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ethers = require('ethers');
    const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const resp = await wallet.sendTransaction(txRequest);
    logger.info(`sent tx ${resp.hash} from relayer wallet`);
    // wait for one confirmation
    const receipt = await provider.waitForTransaction(resp.hash, this.confirmations, 600000);
    return receipt;
  }

  // Submit a tx via local signer, wait for confirmation, then call paymaster settle
  async submitTxAndCallSettle(params: { approvalId: string; txRequest: any; privateKey: string; paramsHash?: string; correlationId?: string; maxAttempts?: number; }) {
    const { approvalId, txRequest, privateKey, paramsHash, correlationId } = params;
    const maxAttempts = params.maxAttempts || 3;

    let lastErr: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        let receipt: any;
        if (this.signerAdapter) {
          receipt = await this.signerAdapter.sendTransaction(txRequest);
        } else {
          receipt = await this.sendTxFromLocalSigner(txRequest, privateKey);
        }
        const txHash = receipt.transactionHash || receipt.hash;
        const gasUsedWei = receipt.gasUsed?.toString?.() ?? '21000';
        const effectiveGasPriceWei = receipt.effectiveGasPrice?.toString?.() ?? '20000000000';
        // call settle with the actual receipt-derived values
        const settleResp = await this.callSettle({ approvalId, txHash, gasUsedWei, effectiveGasPriceWei, paramsHash, correlationId });
        return { receipt, settleResp };
      } catch (err: any) {
        lastErr = err;
        logger.warn(`submitTxAndCallSettle attempt ${attempt} failed for approval=${approvalId}: ${err?.message || String(err)}`);
        // exponential backoff
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
    throw new Error(`submitTxAndCallSettle failed after ${maxAttempts} attempts: ${lastErr?.message || String(lastErr)}`);
  }

  // Call paymaster settle endpoint with HMAC signature and idempotency
  async callSettle(params: { approvalId: string; txHash: string; gasUsedWei: string; effectiveGasPriceWei: string; paramsHash?: string; correlationId?: string; }) {
    const { approvalId, txHash, gasUsedWei, effectiveGasPriceWei, paramsHash, correlationId } = params;
    const idempotencyKey = uuidv4();

    const secret = process.env.PAYMASTER_HMAC_SECRET || '';
    if (!secret) throw new Error('PAYMASTER_HMAC_SECRET not configured');

    const canonical = `${paramsHash || ''}|${approvalId}|${gasUsedWei}|${effectiveGasPriceWei}`;
    const signature = crypto.createHmac('sha256', secret).update(canonical).digest('hex');

    const url = `${this.apiBaseUrl}/api/v1/paymaster/settle`;
    const headers: Record<string,string> = {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      'X-Signature': signature,
    };
    if (correlationId) headers['X-Correlation-ID'] = correlationId;

    const body = { approvalId, txHash, gasUsedWei, effectiveGasPriceWei };
    logger.info(`calling settle for approval=${approvalId} tx=${txHash}`);
    const resp = await axios.post(url, body, { headers, timeout: 30000 });
    return resp.data;
  }

}

export default RelayerService;
