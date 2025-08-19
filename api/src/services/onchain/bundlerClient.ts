import { UserOperationStruct } from '@account-abstraction/contracts';
import { EntryPoint } from '@account-abstraction/contracts';
import { ethers } from 'ethers';
import { env } from '../../config/env';
import { PaymasterService } from './paymasterService';

export class BundlerClient {
    private bundlerRpcUrl: string;
    private provider: ethers.JsonRpcProvider;

    constructor(bundlerRpcUrl: string) {
        this.bundlerRpcUrl = bundlerRpcUrl;
        this.provider = new ethers.JsonRpcProvider(this.bundlerRpcUrl);
    }

    }

    async fillNonce(userOp: UserOperationStruct): Promise<UserOperationStruct> {
      const entryPoint = new ethers.Contract(env.ENTRY_POINT_ADDRESS!, EntryPoint.abi, this.provider);
      userOp.nonce = await entryPoint.getNonce(userOp.sender, 0);
      return userOp;
    }

    async ensurePaymaster(userOp: UserOperationStruct): Promise<UserOperationStruct> {
      const paymasterService = new PaymasterService();
      const paymasterAndData = await paymasterService.getPaymasterAndData(userOp);
      userOp.paymasterAndData = paymasterAndData;
      return userOp;
    }

    async fillGas(userOp: UserOperationStruct): Promise<UserOperationStruct> {
      const gasEstimates = await this.provider.send('eth_estimateUserOperationGas', [
        userOp,
        env.ENTRY_POINT_ADDRESS!,
      ]);

      userOp.callGasLimit = BigInt(gasEstimates.callGasLimit);
      userOp.verificationGasLimit = BigInt(gasEstimates.verificationGasLimit);
      userOp.preVerificationGas = BigInt(gasEstimates.preVerificationGas);

      // For simplicity, using fixed gas prices for now. In a real scenario, fetch from provider.
      const feeData = await this.provider.getFeeData();
      userOp.maxFeePerGas = feeData.maxFeePerGas || BigInt(1000000000); // 1 Gwei
      userOp.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || BigInt(1000000000); // 1 Gwei

      return userOp;
    }

    async sendUserOperation(userOp: UserOperationStruct): Promise<string> {
        try {
            const userOpHash = await this.provider.send('eth_sendUserOperation', [
                userOp,
                env.ENTRY_POINT_ADDRESS!,
            ]);
            return userOpHash;
        } catch (error) {
            console.error('Error sending user operation:', error);
            throw error;
        }
    }

    async pollUserOperationReceipt(userOpHash: string): Promise<any> {
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