// Signer adapter interface + simple implementations.
// FileSigner uses a local private key to sign and send transactions (uses ethers at runtime).
// KmsSignerStub is a placeholder that throws until a real KMS adapter is implemented.

export type TxRequest = any;

export interface SignerAdapter {
  sendTransaction(txRequest: TxRequest): Promise<any>;
}

export class FileSigner implements SignerAdapter {
  rpcUrl: string;
  privateKey: string;
  constructor(privateKey: string, rpcUrl: string) {
    this.privateKey = privateKey;
    this.rpcUrl = rpcUrl;
  }

  async sendTransaction(txRequest: TxRequest) {
    // dynamic require to avoid TS typing noise for ethers
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ethers = require('ethers');
    const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    const wallet = new ethers.Wallet(this.privateKey, provider);
    const resp = await wallet.sendTransaction(txRequest);
    const receipt = await provider.waitForTransaction(resp.hash, 1, 600000);
    return receipt;
  }
}

export class KmsSignerStub implements SignerAdapter {
  constructor() {
    // placeholder
  }
  async sendTransaction(_txRequest: TxRequest) {
    throw new Error('KMS signer not implemented - please implement KmsSigner adapter for production');
  }
}
