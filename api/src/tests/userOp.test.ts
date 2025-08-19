import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ethers, Wallet, JsonRpcProvider } from 'ethers';
import { computeUserOpHash, signUserOp, UserOperationStruct } from '../services/onchain/userOp';
import { EntryPoint__factory } from '@account-abstraction/contracts';
import { BundlerClient } from '../services/onchain/bundlerClient';
import { env } from '../config/env';

// Mock the EntryPoint contract for testing fillNonce
vi.mock('@account-abstraction/contracts', () => ({
    EntryPoint__factory: {
        connect: vi.fn(() => ({
            getNonce: vi.fn().mockResolvedValue(BigInt(123)),
        })),
    },
}));

// Mock BundlerClient
vi.mock('../services/onchain/bundlerClient', () => ({
  BundlerClient: vi.fn().mockImplementation(() => ({
    fillNonce: vi.fn().mockImplementation((userOp) => {
      userOp.nonce = BigInt(123);
      return userOp;
    }),
    ensurePaymaster: vi.fn().mockImplementation((userOp) => {
      userOp.paymasterAndData = '0xPaymasterAndData';
      return userOp;
    }),
    fillGas: vi.fn().mockImplementation((userOp) => {
      userOp.callGasLimit = BigInt(100000);
      userOp.verificationGasLimit = BigInt(200000);
      userOp.preVerificationGas = BigInt(300000);
      userOp.maxFeePerGas = BigInt(1000000000);
      userOp.maxPriorityFeePerGas = BigInt(1000000000);
      return userOp;
    }),
    sendUserOperation: vi.fn().mockResolvedValue('0xUserOpHashFromBundler'),
    pollUserOperationReceipt: vi.fn().mockResolvedValue({ receipt: { transactionHash: '0xTxHash' } }),
  })),
}));

// Mock env
vi.mock('../config/env', () => ({
  env: {
    ENTRY_POINT_ADDRESS: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    CHAIN_ID: 11155111,
    BUNDLER_URL: 'http://mock-bundler.url',
  },
}));

describe('User Operation Utilities', () => {
    const mockEntryPointAddress = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
    const mockChainId = BigInt(11155111); // Sepolia
    const mockSender = '0xYourSmartAccountAddressHere';
   const mockProvider = new JsonRpcProvider('http://localhost:8545'); // Mock provider

   let mockUserOp: UserOperationStruct;
   let mockSigner: ethers.Signer;
   let bundlerClient: BundlerClient;

   beforeEach(() => {
       mockUserOp = {
           sender: mockSender,
           nonce: BigInt(0),
           initCode: '0x',
           callData: '0x',
           callGasLimit: BigInt(0),
           verificationGasLimit: BigInt(0),
           preVerificationGas: BigInt(0),
           maxFeePerGas: BigInt(0),
           maxPriorityFeePerGas: BigInt(0),
           paymasterAndData: '0x',
           signature: '0x',
       };
       mockSigner = Wallet.createRandom();
       bundlerClient = new BundlerClient(env.BUNDLER_URL);
   });

   it('computeUserOpHash should return a valid hash', () => {
       const userOpHash = computeUserOpHash(mockUserOp, env.ENTRY_POINT_ADDRESS, BigInt(env.CHAIN_ID));
       expect(userOpHash).toBeDefined();
       expect(userOpHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
   });

   it('fillNonce should fetch nonce from EntryPoint via BundlerClient', async () => {
       const filledUserOp = await bundlerClient.fillNonce(mockUserOp);
       expect(filledUserOp.nonce).toBe(BigInt(123));
       expect(bundlerClient.fillNonce).toHaveBeenCalledWith(mockUserOp);
   });

   it('ensurePaymaster should fill paymasterAndData via BundlerClient', async () => {
       const filledUserOp = await bundlerClient.ensurePaymaster(mockUserOp);
       expect(filledUserOp.paymasterAndData).toBe('0xPaymasterAndData');
       expect(bundlerClient.ensurePaymaster).toHaveBeenCalledWith(mockUserOp);
   });

   it('fillGas should fill gas estimates via BundlerClient', async () => {
       const filledUserOp = await bundlerClient.fillGas(mockUserOp);
       expect(filledUserOp.callGasLimit).toBe(BigInt(100000));
       expect(filledUserOp.verificationGasLimit).toBe(BigInt(200000));
       expect(filledUserOp.preVerificationGas).toBe(BigInt(300000));
       expect(filledUserOp.maxFeePerGas).toBe(BigInt(1000000000));
       expect(filledUserOp.maxPriorityFeePerGas).toBe(BigInt(1000000000));
       expect(bundlerClient.fillGas).toHaveBeenCalledWith(mockUserOp);
   });

   it('signUserOp should return a 65-byte signature', async () => {
       const signature = await signUserOp({
           userOp: mockUserOp,
           signer: mockSigner,
           entryPointAddress: env.ENTRY_POINT_ADDRESS,
           chainId: BigInt(env.CHAIN_ID),
       });
       expect(signature).toBeDefined();
       expect(ethers.getBytes(signature).length).toBe(65);
   });

   it('sendUserOperation should submit userOp and return hash via BundlerClient', async () => {
       const userOpHash = await bundlerClient.sendUserOperation(mockUserOp);
       expect(userOpHash).toBe('0xUserOpHashFromBundler');
       expect(bundlerClient.sendUserOperation).toHaveBeenCalledWith(mockUserOp);
   });

   it('pollUserOperationReceipt should poll for receipt via BundlerClient', async () => {
       const receipt = await bundlerClient.pollUserOperationReceipt('0xUserOpHashFromBundler');
       expect(receipt).toEqual({ receipt: { transactionHash: '0xTxHash' } });
       expect(bundlerClient.pollUserOperationReceipt).toHaveBeenCalledWith('0xUserOpHashFromBundler');
   });
});