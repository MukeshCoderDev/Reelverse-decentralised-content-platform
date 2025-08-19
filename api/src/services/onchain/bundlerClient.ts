import { UserOperationV06 } from './userOp';
import { EntryPoint } from '@account-abstraction/contracts';
import { ethers } from 'ethers';

export class BundlerClient {
    private bundlerRpcUrl: string;
    private provider: ethers.JsonRpcProvider;

    constructor(bundlerRpcUrl: string) {
        this.bundlerRpcUrl = bundlerRpcUrl;
        this.provider = new ethers.JsonRpcProvider(this.bundlerRpcUrl);
    }

    async estimateGas(userOp: UserOperationV06, entryPointAddress: string): Promise<any> {
        try {
            const result = await this.provider.send('eth_estimateUserOperationGas', [
                userOp,
                entryPointAddress,
            ]);
            return result;
        } catch (error) {
            console.error('Error estimating gas:', error);
            throw error;
        }
    }

    async sendUserOperation(userOp: UserOperationV06, entryPointAddress: string): Promise<string> {
        try {
            const userOpHash = await this.provider.send('eth_sendUserOperation', [
                userOp,
                entryPointAddress,
            ]);
            return userOpHash;
        } catch (error) {
            console.error('Error sending user operation:', error);
            throw error;
        }
    }

    async getUserOperationReceipt(userOpHash: string): Promise<any> {
        const maxAttempts = 10;
        const delay = 2000; // 2 seconds

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const receipt = await this.provider.send('eth_getUserOperationReceipt', [userOpHash]);
                if (receipt) {
                    return receipt;
                }
            } catch (error) {
                console.warn(`Attempt ${i + 1}: Error fetching user operation receipt:`, error);
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        throw new Error(`User operation receipt not found after ${maxAttempts} attempts.`);
    }
}