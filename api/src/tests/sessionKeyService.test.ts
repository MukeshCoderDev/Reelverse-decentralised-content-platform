import { SessionKeyService } from '../services/onchain/sessionKeyService';
import { SmartAccountService } from '../services/onchain/smartAccountService';
import { encryptionService } from '../utils/encryption';
import { getDatabase } from '../config/database';
import { env } from '../config/env';
import { ethers } from 'ethers';
import { UserOperationStruct } from '@account-abstraction/contracts';
import { SessionKeyManagerModule } from '@biconomy/modules';

// Mock dependencies
jest.mock('../config/database', () => ({
  getDatabase: jest.fn().mockReturnValue({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn(),
    }),
  }),
}));

jest.mock('../utils/encryption', () => ({
  encryptionService: {
    encrypt: jest.fn((data) => `encrypted_${data}`),
    decrypt: jest.fn((data) => data.replace('encrypted_', '')),
  },
}));

jest.mock('../services/onchain/smartAccountService', () => ({
  SmartAccountService: jest.fn().mockImplementation((ownerAddress: string) => ({
    getCounterfactualAddress: jest.fn().mockResolvedValue('0xSmartAccountAddress'),
    isSmartAccountDeployed: jest.fn().mockResolvedValue(true),
    ensureDeployedSmartAccount: jest.fn().mockResolvedValue('0x'),
    buildExecuteCallUserOp: jest.fn().mockImplementation((to, data, value) => ({
      sender: '0xSmartAccountAddress',
      callData: `0xExecuteCallDataFor_${to}_${data}_${value}`,
      nonce: BigInt(0),
      initCode: '0x',
      callGasLimit: BigInt(0),
      verificationGasLimit: BigInt(0),
      preVerificationGas: BigInt(0),
      maxFeePerGas: BigInt(0),
      maxPriorityFeePerGas: BigInt(0),
      paymasterAndData: '0x',
      signature: '0x',
    })),
  })),
}));

// Mock Biconomy modules for ABI access
jest.mock('@biconomy/modules', () => ({
 SessionKeyManagerModule: jest.fn().mockImplementation((address: string) => ({
   address,
   encodeEnableModule: jest.fn((sessionKey, policy, expiry) => `0xEnableModuleCallData_${sessionKey}_${JSON.stringify(policy)}_${expiry}`),
   encodeDisableModule: jest.fn((sessionKey) => `0xDisableModuleCallData_${sessionKey}`),
 })),
 DEFAULT_SESSION_KEY_MANAGER_MODULE: '0xSessionKeyManagerModuleAddress',
}));

const mockDb = getDatabase();
const mockDb = getDatabase();
const mockSmartAccountService = new SmartAccountService('0xMockOwnerAddress'); // Pass a mock owner address

describe('SessionKeyService', () => {
 let sessionKeyService: SessionKeyService;
 const mockOwnerAddress = '0xMockOwnerAddress';

 beforeAll(() => {
   env.SESSION_KEY_MANAGER_ADDRESS = '0xSessionKeyManagerModuleAddress';
   env.CONTENT_ACCESS_GATE_ADDRESS = '0xContentAccessGateAddress';
   env.UPLOAD_MANAGER_ADDRESS = '0xUploadManagerAddress';
   env.ENTRY_POINT_ADDRESS = '0xEntryPointAddress';
   env.CHAIN_ID = 1;
 });

 beforeEach(() => {
   sessionKeyService = new SessionKeyService(mockOwnerAddress);
   jest.clearAllMocks();
   (mockDb.connect as jest.Mock).mockClear();
   (mockSmartAccountService.getCounterfactualAddress as jest.Mock).mockResolvedValue('0xSmartAccountAddress');
 });
  describe('generateSessionKey', () => {
    it('should generate a session key with encrypted private key and expiry', async () => {
      const ttlMins = 60;
      const scope = { targets: ['0xTarget'], selectors: ['0xabcdef12'] };
      const { publicKey, encryptedPrivateKey, expiresAt } = await sessionKeyService.generateSessionKey({ ttlMins, scope });

      expect(publicKey).toMatch(/^0x[0-9a-fA-F]{128}$/); // Uncompressed public key format
      expect(encryptedPrivateKey).toMatch(/^encrypted_0x[0-9a-fA-F]{64}$/); // Encrypted private key
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + ttlMins * 60 * 1000);
    });
  });

  describe('buildRegisterSessionKeyUserOp', () => {
   describe('buildRegisterSessionKeyUserOp', () => {
     it('should build a UserOp to register a session key with the provided policy and store it', async () => {
       const ttlMins = 60;
       const scope = { targets: ['0xTarget'], selectors: ['0xabcdef01'] };
       const policyJson = JSON.stringify(scope);
 
       const userOp = await sessionKeyService.buildRegisterSessionKeyUserOp(policyJson, ttlMins);
 
       expect(userOp.sender).toBe('0xSmartAccountAddress');
       expect(userOp.callData).toBeDefined();
       expect(userOp.initCode).toBe('0x'); // Assuming account is already deployed for this test
 
       // Verify storeSessionKey was called
       expect(mockDb.connect().query).toHaveBeenCalledWith(
         expect.stringContaining('INSERT INTO session_keys'),
         expect.arrayContaining([
           '0xSmartAccountAddress',
           expect.any(String), // publicKey
           expect.stringContaining('encrypted_0x'), // encryptedPrivateKey
           policyJson,
           expect.any(Date), // expiresAt
         ])
       );
 
       // Verify SessionKeyManagerModule.encodeEnableModule was called with correct arguments
       const SessionKeyManagerModuleMock = SessionKeyManagerModule as jest.Mock;
       expect(SessionKeyManagerModuleMock).toHaveBeenCalledWith(env.SESSION_KEY_MANAGER_ADDRESS);
       const instance = SessionKeyManagerModuleMock.mock.results[0].value;
       expect(instance.encodeEnableModule).toHaveBeenCalledWith(
         expect.any(String), // sessionPubKey
         scope, // policy object
         expect.any(Number) // expiry timestamp
       );
 
       // Decode the outer callData (execute on Smart Account)
       const smartAccountInterface = new ethers.Interface([
         'function execute(address dest, uint256 value, bytes calldata func) returns (bytes memory)'
       ]);
       const decodedExecute = smartAccountInterface.decodeFunctionData('execute', userOp.callData);
       expect(decodedExecute[0]).toBe(env.SESSION_KEY_MANAGER_ADDRESS); // dest
       expect(decodedExecute[1]).toBe(0n); // value
       expect(decodedExecute[2]).toMatch(/^0xEnableModuleCallData_/); // func (call to enableModule)
     });
 
     it('should throw an error for invalid policy JSON', async () => {
       const invalidPolicyJson = 'not-json';
       await expect(sessionKeyService.buildRegisterSessionKeyUserOp(invalidPolicyJson, 60)).rejects.toThrow('Invalid SESSION_KEY_POLICY_JSON format. Must be a valid JSON string.');
     });
   });
 
   describe('revokeSessionKeyUserOp', () => {
     it('should build a UserOp to disable the session key module', async () => {
       const sessionPubKey = '0xSessionPublicKey';
 
       const userOp = await sessionKeyService.revokeSessionKeyUserOp(sessionPubKey);
 
       expect(userOp.sender).toBe('0xSmartAccountAddress');
       expect(userOp.callData).toBeDefined();
       expect(userOp.initCode).toBe('0x'); // Assuming account is already deployed for this test
 
       // Verify SessionKeyManagerModule.encodeDisableModule was called with correct arguments
       const SessionKeyManagerModuleMock = SessionKeyManagerModule as jest.Mock;
       expect(SessionKeyManagerModuleMock).toHaveBeenCalledWith(env.SESSION_KEY_MANAGER_ADDRESS);
       const instance = SessionKeyManagerModuleMock.mock.results[0].value;
       expect(instance.encodeDisableModule).toHaveBeenCalledWith(sessionPubKey);
 
       // Decode the outer callData (execute on Smart Account)
       const smartAccountInterface = new ethers.Interface([
         'function execute(address dest, uint256 value, bytes calldata func) returns (bytes memory)'
       ]);
       const decodedExecute = smartAccountInterface.decodeFunctionData('execute', userOp.callData);
       expect(decodedExecute[0]).toBe(env.SESSION_KEY_MANAGER_ADDRESS); // dest
       expect(decodedExecute[1]).toBe(0n); // value
       expect(decodedExecute[2]).toMatch(/^0xDisableModuleCallData_/); // func (call to disableModule)
     });
   });
 
   describe('storeSessionKey', () => {
     it('should store a session key in the database', async () => {
       const mockSessionKey = {
         smartAccountId: mockOwnerAddress,
         publicKey: '0xPublicKey',
         encryptedPrivateKey: 'encrypted_PrivateKey',
         scope: { targets: ['0xTarget'], selectors: ['0xSelector'] },
         expiresAt: new Date(),
       };
 
       (mockDb.connect().query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'new-uuid', ...mockSessionKey }], rowCount: 1 });
 
       const storedKey = await sessionKeyService['storeSessionKey'](mockSessionKey); // Access private method for test
 
       expect(mockDb.connect().query).toHaveBeenCalledWith(
         expect.stringContaining('INSERT INTO session_keys'),
         [
           mockSessionKey.smartAccountId,
           mockSessionKey.publicKey,
           mockSessionKey.encryptedPrivateKey,
           JSON.stringify(mockSessionKey.scope),
           mockSessionKey.expiresAt,
         ]
       );
       expect(storedKey).toEqual(expect.objectContaining({ id: 'new-uuid', ...mockSessionKey }));
     });
   });
 
   describe('getActiveSessionKeys', () => {
     it('should retrieve active session keys for a smart account', async () => {
       const activeKey = {
         id: 'active-uuid',
         smartAccountId: mockOwnerAddress,
         publicKey: '0xActiveKey',
         encryptedPrivateKey: 'encrypted_ActiveKey',
         scope: {},
         expiresAt: new Date(Date.now() + 100000), // Future date
         revokedAt: null,
         createdAt: new Date(),
       };
       (mockDb.connect().query as jest.Mock).mockResolvedValueOnce({ rows: [activeKey], rowCount: 1 });
 
       const activeSessions = await sessionKeyService.getActiveSessionKeys(mockOwnerAddress);
 
       expect(mockDb.connect().query).toHaveBeenCalledWith(
         expect.stringContaining('SELECT * FROM session_keys WHERE smart_account_id = $1 AND expires_at > NOW() AND revoked_at IS NULL'),
         [mockOwnerAddress]
       );
       expect(activeSessions).toEqual([activeKey]);
     });
 
     it('should not retrieve expired or revoked session keys', async () => {
       const expiredKey = {
         id: 'expired-uuid',
         smartAccountId: mockOwnerAddress,
         publicKey: '0xExpiredKey',
         encryptedPrivateKey: 'encrypted_ExpiredKey',
         scope: {},
         expiresAt: new Date(Date.now() - 100000), // Past date
         revokedAt: null,
         createdAt: new Date(),
       };
       const revokedKey = {
         id: 'revoked-uuid',
         smartAccountId: mockOwnerAddress,
         publicKey: '0xRevokedKey',
         encryptedPrivateKey: 'encrypted_RevokedKey',
         scope: {},
         expiresAt: new Date(Date.now() + 100000),
         revokedAt: new Date(), // Revoked
         createdAt: new Date(),
       };
       (mockDb.connect().query as jest.Mock).mockResolvedValueOnce({ rows: [expiredKey, revokedKey], rowCount: 2 });
 
       const activeSessions = await sessionKeyService.getActiveSessionKeys(mockOwnerAddress);
 
       expect(mockDb.connect().query).toHaveBeenCalledWith(
         expect.stringContaining('SELECT * FROM session_keys WHERE smart_account_id = $1 AND expires_at > NOW() AND revoked_at IS NULL'),
         [mockOwnerAddress]
       );
       expect(activeSessions).toEqual([]); // Should be empty as per the query logic
     });
   });
 
   describe('revokeSessionKey', () => {
     it('should mark a session key as revoked in the database', async () => {
       const sessionKeyId = 'revoke-uuid';
       await sessionKeyService['revokeSessionKey'](sessionKeyId); // Access private method for test
 
       expect(mockDb.connect().query).toHaveBeenCalledWith(
         expect.stringContaining('UPDATE session_keys SET revoked_at = NOW() WHERE id = $1'),
         [sessionKeyId]
       );
     });
   });
 });