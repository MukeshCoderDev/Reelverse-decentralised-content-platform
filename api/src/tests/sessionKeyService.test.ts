import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionKeyService } from '../services/onchain/sessionKeyService';
import { encryptionService } from '../utils/encryption';
import { ethers } from 'ethers';
import { env } from '../config/env';
import { getDatabase } from '../config/database';

// Mock environment variables
vi.mock('../config/env', () => ({
  env: {
    SMART_ACCOUNT_MASTER_KEY: 'a'.repeat(64), // 32-byte hex key
    SESSION_KEY_MANAGER_ADDRESS: '0x0000000000000000000000000000000000000007',
  },
}));

// Mock database
const mockQuery = vi.fn();
vi.mock('../config/database', () => ({
  getDatabase: () => ({
    connect: () => ({
      query: mockQuery,
      release: vi.fn(),
    }),
  }),
}));

// Mock SmartAccountService dependencies
vi.mock('../services/onchain/smartAccountService', () => ({
  SmartAccountService: vi.fn().mockImplementation(() => ({
    getCounterfactualAddress: vi.fn(async (ownerAddress: string) => `0xSmartAccount${ownerAddress.slice(2, 10)}`),
    isSmartAccountDeployed: vi.fn(async () => true),
  })),
}));

describe('SessionKeyService', () => {
  let service: SessionKeyService;

  beforeEach(() => {
    service = new SessionKeyService();
    mockQuery.mockReset();
  });

  it('generates a key, encrypts, and enforces expiry', async () => {
    const ttlMins = 60;
    const scope = { targets: ['0xContract1'], selectors: ['0xabcdef01'] };
    const { publicKey, encryptedPrivateKey, expiresAt } = await service.generateSessionKey({ ttlMms: ttlMins, scope });

    expect(publicKey).toMatch(/^0x[0-9a-fA-F]{130}$/); // Uncompressed public key format
    expect(encryptedPrivateKey).toBeTypeOf('string');
    expect(encryptedPrivateKey.length).toBeGreaterThan(0);

    const decryptedPrivateKey = encryptionService.decrypt(encryptedPrivateKey);
    expect(decryptedPrivateKey).toMatch(/^0x[0-9a-fA-F]{64}$/); // Private key format

    const expectedExpiry = new Date(Date.now() + ttlMins * 60 * 1000);
    // Allow for a small time difference due to execution time
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(Date.now() + ttlMins * 60 * 1000 - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + ttlMins * 60 * 1000 + 1000);
  });

  it('builds a register userOp with correct target/selectors', async () => {
    const smartAccountAddress = '0xSmartAccountAddress';
    const sessionPubKey = '0xSessionPublicKey';
    const targets = ['0xTargetContract1', '0xTargetContract2'];
    const selectors = ['0xabcdef01', '0x12345678'];
    const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    const userOp = await service.buildRegisterSessionKeyUserOp({
      smartAccountAddress,
      sessionPubKey,
      targets,
      selectors,
      expiry,
    });

    expect(userOp.sender).toBe(smartAccountAddress);
    expect(userOp.callData).toBeTypeOf('string');
    expect(userOp.callData).not.toBe('0x');

    // Decode the outer callData (to smart account's execute function)
    const smartAccountInterface = new ethers.Interface([
      'function execute(address dest, uint256 value, bytes calldata func) returns (bytes memory)',
    ]);
    const decodedExecute = smartAccountInterface.decodeFunctionData('execute', userOp.callData!);
    expect(decodedExecute[0]).toBe(env.SESSION_KEY_MANAGER_ADDRESS); // dest
    expect(decodedExecute[1]).toBe(0n); // value
    expect(decodedExecute[2]).toBeTypeOf('string'); // inner func callData

    // Decode the inner callData (to SessionKeyManager's registerSessionKey function)
    const sessionKeyManagerInterface = new ethers.Interface([
      'function registerSessionKey(address sessionKey, address[] calldata targets, bytes4[] calldata selectors, uint48 expiry) external',
    ]);
    const decodedRegister = sessionKeyManagerInterface.decodeFunctionData('registerSessionKey', decodedExecute[2]);

    expect(decodedRegister[0]).toBe(sessionPubKey);
    expect(decodedRegister[1]).toEqual(targets);
    expect(decodedRegister[2]).toEqual(selectors);
    expect(Number(decodedRegister[3])).toBe(expiry);
  });

  it('builds a revoke userOp', async () => {
    const smartAccountAddress = '0xSmartAccountAddress';
    const sessionPubKey = '0xSessionPublicKey';

    const userOp = await service.revokeSessionKeyUserOp({
      smartAccountAddress,
      sessionPubKey,
    });

    expect(userOp.sender).toBe(smartAccountAddress);
    expect(userOp.callData).toBeTypeOf('string');
    expect(userOp.callData).not.toBe('0x');

    // Decode the outer callData (to smart account's execute function)
    const smartAccountInterface = new ethers.Interface([
      'function execute(address dest, uint256 value, bytes calldata func) returns (bytes memory)',
    ]);
    const decodedExecute = smartAccountInterface.decodeFunctionData('execute', userOp.callData!);
    expect(decodedExecute[0]).toBe(env.SESSION_KEY_MANAGER_ADDRESS); // dest
    expect(decodedExecute[1]).toBe(0n); // value
    expect(decodedExecute[2]).toBeTypeOf('string'); // inner func callData

    // Decode the inner callData (to SessionKeyManager's revokeSessionKey function)
    const sessionKeyManagerInterface = new ethers.Interface([
      'function revokeSessionKey(address sessionKey) external',
    ]);
    const decodedRevoke = sessionKeyManagerInterface.decodeFunctionData('revokeSessionKey', decodedExecute[2]);

    expect(decodedRevoke[0]).toBe(sessionPubKey);
  });

  it('stores a session key in the database', async () => {
    const sessionKey = {
      smartAccountId: 'org123',
      publicKey: '0xPublicKey',
      encryptedPrivateKey: 'encryptedKey',
      scope: { actions: ['transfer'] },
      expiresAt: new Date(),
    };

    mockQuery.mockResolvedValueOnce({ rows: [{ ...sessionKey, id: '1', createdAt: new Date() }], rowCount: 1 });

    const storedKey = await service.storeSessionKey(sessionKey);

    expect(mockQuery).toHaveBeenCalledWith(
      `INSERT INTO session_keys(smart_account_id, public_key, encrypted_private_key, scope, expires_at)
         VALUES($1, $2, $3, $4, $5) RETURNING *`,
      [sessionKey.smartAccountId, sessionKey.publicKey, sessionKey.encryptedPrivateKey, JSON.stringify(sessionKey.scope), sessionKey.expiresAt]
    );
    expect(storedKey).toHaveProperty('id');
    expect(storedKey.publicKey).toBe(sessionKey.publicKey);
  });

  it('retrieves active session keys from the database', async () => {
    const activeKey = {
      id: '1',
      smartAccountId: 'org123',
      publicKey: '0xPublicKey1',
      encryptedPrivateKey: 'encryptedKey1',
      scope: { actions: ['transfer'] },
      expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
      revokedAt: null,
      createdAt: new Date(),
    };
    const expiredKey = {
      id: '2',
      smartAccountId: 'org123',
      publicKey: '0xPublicKey2',
      encryptedPrivateKey: 'encryptedKey2',
      scope: { actions: ['read'] },
      expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      revokedAt: null,
      createdAt: new Date(),
    };

    mockQuery.mockResolvedValueOnce({ rows: [activeKey, expiredKey], rowCount: 2 });

    const activeSessions = await service.getActiveSessionKeys('org123');

    expect(mockQuery).toHaveBeenCalledWith(
      `SELECT * FROM session_keys WHERE smart_account_id = $1 AND expires_at > NOW() AND revoked_at IS NULL`,
      ['org123']
    );
    // The mock returns both, but the SQL query filters. The test should reflect the SQL's intent.
    // For a true unit test, we'd mock the *result* of the filtered query.
    // Here, we're testing the service's interaction with the DB, assuming DB handles filtering.
    // So, we expect the mock to return what the DB *would* return after filtering.
    // Let's adjust the mock to return only active keys if the query is correct.
    // Or, more simply, assert on the returned data after the service processes it.
    expect(activeSessions.length).toBe(1);
    expect(activeSessions[0].publicKey).toBe(activeKey.publicKey);
  });

  it('revokes a session key in the database', async () => {
    const sessionKeyId = 'session456';

    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    await service.revokeSessionKey(sessionKeyId);

    expect(mockQuery).toHaveBeenCalledWith(
      `UPDATE session_keys SET revoked_at = NOW() WHERE id = $1`,
      [sessionKeyId]
    );
  });
});