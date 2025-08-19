import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ethers, Wallet, JsonRpcProvider } from 'ethers';
import { computeUserOpHash, fillNonce, signUserOp, UserOperationV06 } from '../services/onchain/userOp';
import { EntryPoint__factory } from '@account-abstraction/contracts';

// Mock the EntryPoint contract for testing fillNonce
vi.mock('@account-abstraction/contracts', () => ({
    EntryPoint__factory: {
        connect: vi.fn(() => ({
            getNonce: vi.fn().mockResolvedValue(BigInt(123)),
        })),
    },
}));

describe('User Operation Utilities', () => {
    const mockEntryPointAddress = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
    const mockChainId = BigInt(11155111); // Sepolia
    const mockSender = '0xYourSmartAccountAddressHere';
    const mockProvider = new JsonRpcProvider('http://localhost:8545'); // Mock provider

    let mockUserOp: UserOperationV06;
    let mockSigner: ethers.Signer; // Change type to ethers.Signer

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
        mockSigner = Wallet.createRandom(); // HDNodeWallet implements Signer
    });

    it('computeUserOpHash should return a valid hash', () => {
        const userOpHash = computeUserOpHash(mockUserOp, mockEntryPointAddress, mockChainId);
        expect(userOpHash).toBeDefined();
        expect(userOpHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });

    it('fillNonce should fetch nonce from EntryPoint', async () => {
        const nonce = await fillNonce(mockEntryPointAddress, mockSender, mockProvider);
        expect(nonce).toBe(BigInt(123));
        expect(EntryPoint__factory.connect).toHaveBeenCalledWith(mockEntryPointAddress, mockProvider);
    });

    it('signUserOp should return a 65-byte signature', async () => {
        const signature = await signUserOp({
            userOp: mockUserOp,
            signer: mockSigner,
            entryPointAddress: mockEntryPointAddress,
            chainId: mockChainId,
        });
        expect(signature).toBeDefined();
        expect(ethers.getBytes(signature).length).toBe(65);
    });
});