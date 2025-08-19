import { ethers } from 'ethers';
import { EntryPoint__factory, UserOperationStruct } from '@account-abstraction/contracts';
import { BundlerClient } from './bundlerClient';

// Re-export UserOperationStruct from contracts for consistency
export { UserOperationStruct };

export function buildCallData(to: string, data: string, value: bigint = BigInt(0)): string {
    const iface = new ethers.Interface(['function execute(address to, uint256 value, bytes data)']);
    return iface.encodeFunctionData('execute', [to, value, data]);
}

export async function fillNonce(entryPointAddress: string, sender: string, provider: ethers.JsonRpcProvider): Promise<bigint> {
    const entryPoint = EntryPoint__factory.connect(entryPointAddress, provider as any); // Cast to any to bypass strict type checking
    return await entryPoint.getNonce(sender, 0);
}

export function computeUserOpHash(userOp: UserOperationStruct, entryPointAddress: string, chainId: bigint): string {
    const userOpType = [
        'address sender',
        'uint256 nonce',
        'bytes initCode',
        'bytes callData',
        'uint256 callGasLimit',
        'uint256 verificationGasLimit',
        'uint256 preVerificationGas',
        'uint256 maxFeePerGas',
        'uint256 maxPriorityFeePerGas',
        'bytes paymasterAndData',
        'bytes signature',
    ];

    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(userOpType, [
        userOp.sender,
        userOp.nonce,
        userOp.initCode,
        userOp.callData,
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        userOp.paymasterAndData,
        userOp.signature,
    ]);

    const encodedHash = ethers.keccak256(encoded);

    const entryPointType = [
        'bytes32 userOpHash',
        'address entryPoint',
        'uint256 chainId',
    ];

    const entryPointEncoded = ethers.AbiCoder.defaultAbiCoder().encode(entryPointType, [
        encodedHash,
        entryPointAddress,
        chainId,
    ]);

    return ethers.keccak256(entryPointEncoded);
}

export async function signUserOp({ userOp, signer, entryPointAddress, chainId }: {
    userOp: UserOperationStruct;
    signer: ethers.Signer;
    entryPointAddress: string;
    chainId: bigint;
}): Promise<string> {
    const userOpHash = computeUserOpHash(userOp, entryPointAddress, chainId);
    return await signer.signMessage(ethers.getBytes(userOpHash));
}

export async function fillGas({ bundlerClient, userOp }: {
    bundlerClient: BundlerClient;
    userOp: UserOperationStruct;
}): Promise<UserOperationStruct> {
    const gasEstimates = await bundlerClient.estimateGas(userOp);

    userOp.callGasLimit = BigInt(gasEstimates.callGasLimit);
    userOp.verificationGasLimit = BigInt(gasEstimates.verificationGasLimit);
    userOp.preVerificationGas = BigInt(gasEstimates.preVerificationGas);

    // For simplicity, using fixed gas prices for now. In a real scenario, fetch from provider.
    userOp.maxFeePerGas = BigInt(1000000000); // 1 Gwei
    userOp.maxPriorityFeePerGas = BigInt(1000000000); // 1 Gwei

    return userOp;
}

export async function ensurePaymaster({ userOp, paymasterService }: {
    userOp: UserOperationStruct;
    paymasterService: any; // Replace with actual paymaster service type
}): Promise<UserOperationStruct> {
    if (paymasterService) {
        const paymasterAndData = await paymasterService.getPaymasterAndData(userOp);
        userOp.paymasterAndData = paymasterAndData;
    }
    return userOp;
}