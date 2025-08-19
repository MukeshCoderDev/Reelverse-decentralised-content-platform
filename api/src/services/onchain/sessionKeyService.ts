import { getDatabase } from '../../config/database';
import { env } from '../../config/env';
import { currentChainConfig } from '../../config/chain';
import { ethers } from 'ethers';
import { logger } from '../../utils/logger';
import { UserOperation } from './paymasterService';
import { SmartAccountService } from './smartAccountService';
import { encryptionService } from '../../utils/encryption';
import { env } from '../../config/env'; // Import env for SESSION_KEY_MANAGER_ADDRESS

// Placeholder ABI for a hypothetical SessionKeyManager contract
// This ABI assumes functions like `registerSessionKey` and `revokeSessionKey`
const SESSION_KEY_MANAGER_ABI = [
  'function registerSessionKey(address sessionKey, address[] calldata targets, bytes4[] calldata selectors, uint48 expiry) external',
  'function revokeSessionKey(address sessionKey) external',
  'function execute(address dest, uint256 value, bytes calldata func) returns (bytes memory)',
];

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

  constructor() {
    this.smartAccountService = new SmartAccountService();
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
  async buildRegisterSessionKeyUserOp({ smartAccountAddress, sessionPubKey, targets, selectors, expiry }: { smartAccountAddress: string; sessionPubKey: string; targets: string[]; selectors: string[]; expiry: number }): Promise<Partial<UserOperation>> {
    const sessionKeyManagerInterface = new ethers.Interface(SESSION_KEY_MANAGER_ABI);
    
    // Encode the call to registerSessionKey on the SessionKeyManager contract
    const registerCallData = sessionKeyManagerInterface.encodeFunctionData(
      'registerSessionKey',
      [sessionPubKey, targets, selectors, expiry]
    );

    // The UserOperation's callData will be to the smart account's `execute` function,
    // which then calls the SessionKeyManager.
    // Assuming SimpleAccount has an `execute` function: `function execute(address dest, uint256 value, bytes calldata func)`
    const smartAccountInterface = new ethers.Interface(SESSION_KEY_MANAGER_ABI); // Re-using for execute, assuming it's part of the smart account's ABI or a common interface
    const callData = smartAccountInterface.encodeFunctionData(
      'execute',
      [env.SESSION_KEY_MANAGER_ADDRESS, 0, registerCallData]
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
  async revokeSessionKeyUserOp({ smartAccountAddress, sessionPubKey }: { smartAccountAddress: string; sessionPubKey: string }): Promise<Partial<UserOperation>> {
    const sessionKeyManagerInterface = new ethers.Interface(SESSION_KEY_MANAGER_ABI);

    // Encode the call to revokeSessionKey on the SessionKeyManager contract
    const revokeCallData = sessionKeyManagerInterface.encodeFunctionData(
      'revokeSessionKey',
      [sessionPubKey]
    );

    // The UserOperation's callData will be to the smart account's `execute` function,
    // which then calls the SessionKeyManager.
    const smartAccountInterface = new ethers.Interface(SESSION_KEY_MANAGER_ABI); // Re-using for execute
    const callData = smartAccountInterface.encodeFunctionData(
      'execute',
      [env.SESSION_KEY_MANAGER_ADDRESS, 0, revokeCallData]
    );

    return {
      sender: smartAccountAddress,
      callData: callData,
      // Other userOp fields like nonce, gas limits, etc., will be filled by the bundler/paymaster
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

export default new SessionKeyService();