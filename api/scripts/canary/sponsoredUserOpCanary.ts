import { ethers } from 'ethers';
import { UserOperationStruct } from '@account-abstraction/contracts';
import { EntryPoint__factory } from '@account-abstraction/contracts';
import { BundlerClient } from '../../src/services/onchain/bundlerClient'; // Local import
import { PaymasterService } from '../../src/services/onchain/paymasterService'; // Local import
import { fillNonce, fillGas, ensurePaymaster, signUserOp } from '../../src/services/onchain/userOp'; // Import userOp helpers

const bundlerClient = new BundlerClient(process.env.BUNDLER_URL || 'http://localhost:4337');
const paymasterService = new PaymasterService();


async function sponsoredUserOpCanary() {
    console.log('Starting sponsored UserOp canary health check...');

    const DEV_OWNER_PRIVATE_KEY = process.env.DEV_OWNER_PRIVATE_KEY;
    const BUNDLER_URL = process.env.BUNDLER_URL;
    const ENTRY_POINT_ADDRESS = process.env.ENTRY_POINT_ADDRESS;
    const RPC_URL = process.env.RPC_URL;
    const PAYMASTER_URL = process.env.PAYMASTER_URL; // Optional, if paymaster is used

    if (!DEV_OWNER_PRIVATE_KEY || !BUNDLER_URL || !ENTRY_POINT_ADDRESS || !RPC_URL) {
        console.error('Missing required environment variables for canary script.');
        console.error('Ensure DEV_OWNER_PRIVATE_KEY, BUNDLER_URL, ENTRY_POINT_ADDRESS, RPC_URL are set.');
        process.exit(1);
    }

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const owner = new ethers.Wallet(DEV_OWNER_PRIVATE_KEY, provider);

        // 1. Build a harmless userOp (e.g., call WETH symbol() or your Noop contract)
        // For simplicity, we'll create a simple transfer to self or a Noop call.
        // Assuming a simple smart account setup for the owner.
        // This part would be highly dependent on your smart account implementation.

        // Example: A no-op call to a dummy contract or a transfer to self
        const dummyRecipient = owner.address; // Sending to self for a harmless op
        const dummyAmount = ethers.parseEther('0'); // 0 ETH transfer
        const dummyData = '0x'; // No data for a simple transfer

        // This is a simplified UserOperationStruct.
        // In a real scenario, you'd use your project's specific helpers to build this.
        let userOp: UserOperationStruct = { // Changed to 'let'
            sender: owner.address, // This would be the smart account address
            nonce: 0n, // Needs to be fetched from the smart account
            initCode: '0x', // Only if deploying a new account
            callData: '0x', // The actual call to WETH symbol() or Noop contract
            callGasLimit: 0n, // Will be estimated
            verificationGasLimit: 0n, // Will be estimated
            preVerificationGas: 0n, // Will be estimated
            maxFeePerGas: 0n, // Will be estimated
            maxPriorityFeePerGas: 0n, // Will be estimated
            paymasterAndData: '0x', // Will be filled by paymaster
            signature: '0x', // Will be signed
        };

        // Placeholder for fetching nonce and building callData
        // In a real app, you'd interact with your smart account service to get the nonce
        // and encode the call data for a harmless operation.
        console.log('Building harmless userOp...');
        // For a real scenario, you might call a view function on a known contract, e.g.:
        // const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // Mainnet WETH
        // const wethAbi = ["function symbol() view returns (string)"];
        // const iface = new ethers.Interface(wethAbi);
        // userOp.callData = iface.encodeFunctionData("symbol");
        // userOp.sender = "0xYourSmartAccountAddress"; // Replace with a test smart account

        // For this canary, let's assume a simple dummy call that doesn't require a specific contract
        // or just a transfer to self from a pre-deployed smart account.
        // For a true "harmless" op, calling a view function on a well-known contract like WETH's symbol()
        // is ideal as it doesn't change state and is cheap.

        // 2. Fill nonce, sponsor, estimate gas
        console.log('Filling nonce, estimating gas, and getting paymaster data...');
        userOp.nonce = await fillNonce(ENTRY_POINT_ADDRESS, owner.address, provider); // Assuming owner.address is the smart account sender

        // Fill gas estimates
        userOp = await fillGas({ bundlerClient, userOp });

        // Fill paymaster data if PAYMASTER_URL is provided
        if (PAYMASTER_URL) {
            userOp = await ensurePaymaster({ userOp, paymasterService });
        }

        // 3. Sign with DEV_OWNER_PRIVATE_KEY
        console.log('Signing userOp...');
        userOp.signature = await signUserOp({
            userOp,
            signer: owner,
            entryPointAddress: ENTRY_POINT_ADDRESS,
            chainId: (await provider.getNetwork()).chainId,
        });

        // 4. Submit to bundler; poll for receipt
        // 4. Submit to bundler; poll for receipt
        console.log('Submitting userOp to bundler...');
        const userOpHash = await (bundlerClient as any).sendUserOperation(userOp); // Cast to any
        console.log(`UserOp submitted. UserOpHash: ${userOpHash}`);

        console.log('Polling for receipt...');
        let txHash: string | undefined;
        const pollInterval = 3000; // 3 seconds
        const pollAttempts = 20; // Up to 60 seconds
        for (let i = 0; i < pollAttempts; i++) {
            const receipt = await (bundlerClient as any).pollUserOperationReceipt(userOpHash); // Cast to any
            if (receipt && receipt.receipt && receipt.receipt.transactionHash) {
                txHash = receipt.receipt.transactionHash;
                break;
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        if (!txHash) { // Added missing if block
            throw new Error('Failed to get transaction hash after polling.');
        }
        // 5. Log userOpHash + txHash; exit(0) on success; exit(1) on failure
        console.log(`Canary successful!`);
        console.log(`UserOpHash: ${userOpHash}`);
        console.log(`TxHash: ${txHash}`);
        process.exit(0);

    } catch (error) {
        console.error('Canary failed!');
        console.error(error);
        process.exit(1);
    }
}

sponsoredUserOpCanary();