import { getDatabase } from '../../config/database';
import { env } from '../../config/env';
import { currentChainConfig } from '../../config/chain';
import { ethers } from 'ethers';
import { logger } from '../../utils/logger';
import { EntryPoint__factory, SimpleAccountFactory__factory } from '@account-abstraction/contracts';
import { encryptionService } from '../../utils/encryption';

export class SmartAccountService {
  private provider: ethers.JsonRpcProvider;
  private entryPointContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(currentChainConfig.rpcUrl);
    this.entryPointContract = new ethers.Contract(
      currentChainConfig.entryPointAddress,
      EntryPoint__factory.abi,
      this.provider
    );
  }

  encryptPrivateKey(plain: string): string {
    return encryptionService.encrypt(plain);
  }

  decryptPrivateKey(encHex: string): string {
    return encryptionService.decrypt(encHex);
  }

  /**
   * Generates a counterfactual smart account address for a given owner.
   * This address is deterministic and does not require on-chain deployment.
   * @param ownerAddress The address of the EOA owner of the smart account.
   * @returns The counterfactual smart account address.
   */
  async getCounterfactualAddress(ownerAddress: string): Promise<string> {
    const factory = new ethers.Contract(
      env.SIMPLE_ACCOUNT_FACTORY_ADDRESS,
      SimpleAccountFactory__factory.abi,
      this.provider
    );
    const salt = 0; // Using a fixed salt for simplicity, can be derived from ownerAddress
    const initCode = ethers.solidityPacked(
      ['address', 'bytes'],
      [
        env.SIMPLE_ACCOUNT_FACTORY_ADDRESS,
        factory.interface.encodeFunctionData('createAccount', [ownerAddress, salt]),
      ]
    );
    const senderAddress = await this.entryPointContract.getSenderAddress(initCode);
    return senderAddress;
  }

  /**
   * Builds the initCode for deploying a smart account.
   * This is used in the first UserOperation to deploy the account on-chain.
   * @param ownerAddress The address of the EOA owner.
   * @returns The initCode as a hex string.
   */
  async buildInitCode(ownerAddress: string): Promise<string> {
    const factory = new ethers.Contract(
      env.SIMPLE_ACCOUNT_FACTORY_ADDRESS,
      SimpleAccountFactory__factory.abi,
      this.provider
    );
    const salt = 0; // Using a fixed salt for simplicity, can be derived from ownerAddress
    const initCode = ethers.solidityPacked(
      ['address', 'bytes'],
      [
        env.SIMPLE_ACCOUNT_FACTORY_ADDRESS,
        factory.interface.encodeFunctionData('createAccount', [ownerAddress, salt]),
      ]
    );
    return initCode;
  }

  /**
   * Ensures the smart account is deployed. If not, it returns the initCode
   * to be included in the first UserOperation.
   * @param smartAccountAddress The address of the smart account.
   * @param ownerAddress The address of the EOA owner.
   * @returns initCode if the account is not deployed, otherwise '0x'.
   */
  async ensureDeployedSmartAccount(smartAccountAddress: string, ownerAddress: string): Promise<string> {
    const code = await this.provider.getCode(smartAccountAddress);
    if (code === '0x') {
      logger.info(`Smart account ${smartAccountAddress} not deployed, building initCode.`);
      return this.buildInitCode(ownerAddress);
    }
    logger.info(`Smart account ${smartAccountAddress} already deployed.`);
    return '0x';
  }

  async createSmartAccount(orgId: string, privateKey: string, address: string) {
    const pool = getDatabase();
    const client = await pool.connect();
    try {
      const enc = this.encryptPrivateKey(privateKey);
      // Never log secrets
      await client.query(
        `INSERT INTO smart_accounts(org_id, address, encrypted_private_key)
         VALUES($1,$2,$3)
         ON CONFLICT (org_id) DO UPDATE SET address = EXCLUDED.address, encrypted_private_key = EXCLUDED.encrypted_private_key`,
        [orgId, address, enc]
      );
    } finally {
      client.release();
    }
  }

  async getPrivateKeyForOrg(orgId: string): Promise<string | null> {
    const pool = getDatabase();
    const client = await pool.connect();
    try {
      const res = await client.query(`SELECT encrypted_private_key FROM smart_accounts WHERE org_id=$1 LIMIT 1`, [orgId]);
      if (res.rowCount === 0) return null;
      return this.decryptPrivateKey(res.rows[0].encrypted_private_key);
    } finally {
      client.release();
    }
  }

  /**
   * Checks if a smart account is deployed on-chain.
   * @param smartAccountAddress The address of the smart account.
   * @returns True if deployed, false otherwise.
   */
  async isSmartAccountDeployed(smartAccountAddress: string): Promise<boolean> {
    const code = await this.provider.getCode(smartAccountAddress);
    return code !== '0x';
  }
}

export default new SmartAccountService();
