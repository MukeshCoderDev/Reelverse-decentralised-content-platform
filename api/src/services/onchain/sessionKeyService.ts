import { getDatabase } from '../../config/database';
import { env } from '../../config/env';
import { currentChainConfig } from '../../config/chain';
import { ethers } from 'ethers';
import { logger } from '../../utils/logger';
import { UserOperationStruct } from '@account-abstraction/contracts';
import { SmartAccountService } from './smartAccountService';
import { encryptionService } from '../../utils/encryption';
import { SessionKeyManagerModule, DEFAULT_SESSION_KEY_MANAGER_MODULE } from '@biconomy/modules';
import { SessionKeyManagerModule as SessionKeyManagerModuleContract } from '@biconomy/modules/dist/src/contracts/SessionKeyManagerModule';
import { Interface } from 'ethers';

// Placeholder ABI for a hypothetical SessionKeyManager contract
// This ABI assumes functions like `registerSessionKey` and `revokeSessionKey`
const SessionKeyManagerModuleABI = SessionKeyManagerModule.abi;
const SessionKeyManagerModuleInterface = new Interface(SessionKeyManagerModuleABI);

interface SessionKey {
  id: string;
  smartAccountId: string;
  publicKey: string;
  encryptedPrivateKey: string;
  scope: any; // JSONB type, will define more precisely later
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export class SessionKeyService {
  private smartAccountService: SmartAccountService;
  private ownerAddress: string;

  constructor(ownerAddress: string) {
    this.ownerAddress = ownerAddress;
    this.smartAccountService = new SmartAccountService(ownerAddress);
  }

  private encryptPrivateKey(plain: string): string {
    return encryptionService.encrypt(plain);
  }

  private decryptPrivateKey(encHex: string): string {
    return encryptionService.decrypt(encHex);
  }

  /**
   * Generates a new ephemeral ECDSA keypair for a session key.
   * @param ttlMins Time-to-live in minutes for the session key.
   * @param scope Scope of the session key (allowed contracts/functions).
   * @returns publicKey, encryptedPrivateKey, and expiresAt.
   */
  async generateSessionKey({ ttlMins, scope }: { ttlMins: number; scope: any }): Promise<{ publicKey: string; encryptedPrivateKey: string; expiresAt: Date }> {
    const wallet = ethers.Wallet.createRandom();
    const privateKey = wallet.privateKey;
    const publicKey = wallet.publicKey; // This is the uncompressed public key

    const encryptedPrivateKey = this.encryptPrivateKey(privateKey);
    const expiresAt = new Date(Date.now() + ttlMins * 60 * 1000);

    return { publicKey, encryptedPrivateKey, expiresAt };
  }

  /**
   * Builds a UserOperation to register a session key on the smart account.
   * @param smartAccountAddress The address of the smart account.
   * @param sessionPubKey The public key of the session key.
   * @param targets Array of target contract addresses.
   * @param selectors Array of function selectors.
   * @param expiry Expiry timestamp for the session key.
   * @returns A Partial UserOperation object.
   */
  async buildRegisterSessionKeyUserOp(policyJson: string, ttlMins?: number): Promise<UserOperationStruct> {
    const sessionKey = ethers.Wallet.createRandom();
    const sessionPubKey = sessionKey.address;
    const encryptedPrivateKey = this.encryptPrivateKey(sessionKey.privateKey);

    let policy;
    try {
      policy = JSON.parse(policyJson);
    } catch (e) {
      throw new Error('Invalid SESSION_KEY_POLICY_JSON format. Must be a valid JSON string.');
    }

    const expiresAt = ttlMins ? Math.floor((Date.now() + ttlMins * 60 * 1000) / 1000) : Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000); // Default 30 days

    // Store the session key in the database
    const smartAccountAddress = await this.smartAccountService.getCounterfactualAddress();
    await this.storeSessionKey({
      smartAccountId: smartAccountAddress,
      publicKey: sessionPubKey,
      encryptedPrivateKey: encryptedPrivateKey,
      scope: policy,
      expiresAt: new Date(expiresAt * 1000),
    });

    const sessionKeyManagerModule = new SessionKeyManagerModule(env.SESSION_KEY_MANAGER_ADDRESS!);
    const enableModuleCallData = sessionKeyManagerModule.encodeEnableModule(sessionPubKey, policy, expiresAt);

    const smartAccountAddress = await this.smartAccountService.getCounterfactualAddress();
    const initCode = await this.smartAccountService.ensureDeployedSmartAccount(smartAccountAddress);

    const callData = new ethers.Interface(['function execute(address dest, uint256 value, bytes calldata func) returns (bytes memory)']).encodeFunctionData(
      'execute',
      [env.SESSION_KEY_MANAGER_ADDRESS, 0, enableModuleCallData]
    );

    return {
      sender: smartAccountAddress,
      nonce: BigInt(0), // Will be filled by bundler
      initCode: initCode,
      callData: callData,
      callGasLimit: BigInt(0), // Will be filled by bundler
      verificationGasLimit: BigInt(0), // Will be filled by bundler
      preVerificationGas: BigInt(0), // Will be filled by bundler
      maxFeePerGas: BigInt(0), // Will be filled by bundler
      maxPriorityFeePerGas: BigInt(0), // Will be filled by bundler
      paymasterAndData: '0x', // Will be filled by paymaster
      signature: '0x', // Will be filled by client
    };
  }

    const policyBytes = ethers.toUtf8Bytes(JSON.stringify(policy));

    // Encode the call to enableModule on the SessionKeyManagerModule
    const enableModuleCallData = SessionKeyManagerModuleInterface.encodeFunctionData(
      'enableModule',
      [sessionPubKey, policyBytes, expiry]
    );

    // The UserOperation's callData will be to the smart account's `execute` function,
    // which then calls the SessionKeyManager.
    // The UserOperation's callData will be to the smart account's `setupAndEnableModule` function,
    // which installs and enables the session key manager module.
    // This assumes the smart account factory deploys a modular account.
    // For Biconomy, this is typically handled by the SDK's `addModule` or `enableModule` on the account.
    // Here, we're directly calling `enableModule` on the SessionKeyManagerModule.
    // The smart account itself needs to call this.
    // Assuming the smart account has a generic `execute` function to call arbitrary contracts:
    const smartAccountInterface = new ethers.Interface([
      'function execute(address dest, uint256 value, bytes calldata func) returns (bytes memory)',
      'function enableModule(address module)' // For enabling the module on the smart account itself
    ]);

    // First, ensure the SessionKeyManagerModule is enabled on the smart account if it's not already.
    // This might be a separate UserOp or part of the initCode if it's the first transaction.
    // For simplicity, we'll assume it's already enabled or handled by the SDK.
    // The `enableModuleCallData` is what the smart account will execute.
    const callData = smartAccountInterface.encodeFunctionData(
      'execute',
      [env.SESSION_KEY_MANAGER_ADDRESS, 0, enableModuleCallData]
    );

    return {
      sender: smartAccountAddress,
      callData: callData,
      // Other userOp fields like nonce, gas limits, etc., will be filled by the bundler/paymaster
    };
  }

  /**
   * Builds a UserOperation to revoke a session key from the smart account.
   * @param smartAccountAddress The address of the smart account.
   * @param sessionPubKey The public key of the session key to revoke.
   * @returns A Partial UserOperation object.
   */
  async revokeSessionKeyUserOp(sessionPubKey: string): Promise<UserOperationStruct> {
    const sessionKeyManagerModule = new SessionKeyManagerModule(env.SESSION_KEY_MANAGER_ADDRESS!);
    const disableModuleCallData = sessionKeyManagerModule.encodeDisableModule(sessionPubKey);

    const smartAccountAddress = await this.smartAccountService.getCounterfactualAddress();
    const initCode = await this.smartAccountService.ensureDeployedSmartAccount(smartAccountAddress);

    const callData = new ethers.Interface(['function execute(address dest, uint256 value, bytes calldata func) returns (bytes memory)']).encodeFunctionData(
      'execute',
      [env.SESSION_KEY_MANAGER_ADDRESS, 0, disableModuleCallData]
    );

    return {
      sender: smartAccountAddress,
      nonce: BigInt(0),
      initCode: initCode,
      callData: callData,
      callGasLimit: BigInt(0),
      verificationGasLimit: BigInt(0),
      preVerificationGas: BigInt(0),
      maxFeePerGas: BigInt(0),
      maxPriorityFeePerGas: BigInt(0),
      paymasterAndData: '0x',
      signature: '0x',
    };
  }

  /**
   * Stores a new session key in the database.
   */
  async storeSessionKey(sessionKey: Omit<SessionKey, 'id' | 'createdAt' | 'revokedAt'>): Promise<SessionKey> {
    const pool = getDatabase();
    const client = await pool.connect();
    try {
      const res = await client.query(
        `INSERT INTO session_keys(smart_account_id, public_key, encrypted_private_key, scope, expires_at)
         VALUES($1, $2, $3, $4, $5) RETURNING *`,
        [sessionKey.smartAccountId, sessionKey.publicKey, sessionKey.encryptedPrivateKey, JSON.stringify(sessionKey.scope), sessionKey.expiresAt]
      );
      return res.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves active session keys for a given smart account.
   */
  async getActiveSessionKeys(smartAccountId: string): Promise<SessionKey[]> {
    const pool = getDatabase();
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT * FROM session_keys WHERE smart_account_id = $1 AND expires_at > NOW() AND revoked_at IS NULL`,
        [smartAccountId]
      );
      return res.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Revokes a session key by marking it as revoked in the database.
   */
  async revokeSessionKey(sessionKeyId: string): Promise<void> {
    const pool = getDatabase();
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE session_keys SET revoked_at = NOW() WHERE id = $1`,
        [sessionKeyId]
      );
    } finally {
      client.release();
    }
  }
}

}

export default SessionKeyService;