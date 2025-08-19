import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../index'; // Assuming your express app is exported as default from api/src/index.ts
import { env } from '../../config/env';
import { BundlerClient } from '../../services/onchain/bundlerClient';
import { ethers } from 'ethers';

// Skip unless E2E_SEPOLIA=1 is set in environment
const E2E_SEPOLIA = process.env.E2E_SEPOLIA === '1';

describe.skipIf(!E2E_SEPOLIA)('E2E: Sponsored Playback', () => {
    let smartAccountAddress: string;
    let userOpHash: string;
    let bundlerClient: BundlerClient;

    beforeAll(() => {
        if (!env.BUNDLER_URL || !env.ENTRY_POINT_ADDRESS || !env.DEV_OWNER_PRIVATE_KEY) {
            throw new Error('E2E_SEPOLIA tests require BUNDLER_URL, ENTRY_POINT_ADDRESS, and DEV_OWNER_PRIVATE_KEY to be set in environment.');
        }
        bundlerClient = new BundlerClient(env.BUNDLER_URL);
    });

    it('should get smart account address', async () => {
        const res = await request(app).get('/api/aa/account');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('smartAccountAddress');
        expect(res.body).toHaveProperty('deployed');
        expect(res.body).toHaveProperty('entryPoint');
        expect(res.body).toHaveProperty('chainId');
        smartAccountAddress = res.body.smartAccountAddress;
        console.log(`Smart Account Address: ${smartAccountAddress}`);
    });

    it('should create a session key if SESSION_KEY_MANAGER_ADDRESS is set', async () => {
        if (env.SESSION_KEY_MANAGER_ADDRESS) {
            const res = await request(app)
                .post('/api/aa/session/create')
                .send({ ttlMins: 60, scope: { targets: [], selectors: [] } }); // Empty scope for simplicity
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('sessionKeyId');
            expect(res.body).toHaveProperty('publicKey');
            expect(res.body).toHaveProperty('expiresAt');
            expect(res.body).toHaveProperty('userOpHash');
            console.log(`Session Key UserOp Hash: ${res.body.userOpHash}`);
        } else {
            console.log('SESSION_KEY_MANAGER_ADDRESS is not set, skipping session key creation.');
        }
    }, 30000); // Increase timeout for session key creation

    it('should successfully send a sponsored transaction and log tx hash', async () => {
        // Using Sepolia WETH contract and calling its symbol() function as a harmless read-only call
        const targetContractAddress = '0xfFf9976782d46CC05630D1f6eB9Fe03089d87603'; // Sepolia WETH contract
        const targetContractABI = ['function symbol() view returns (string)'];
        const iface = new ethers.Interface(targetContractABI);
        const callData = iface.encodeFunctionData('symbol', []);

        const res = await request(app)
            .post('/api/aa/sponsor-and-send')
            .send({
                to: targetContractAddress,
                data: callData,
                value: '0',
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('userOpHash');
        userOpHash = res.body.userOpHash;
        console.log(`Sponsored UserOp Hash: ${userOpHash}`);

        // Poll for receipt
        let txHash: string | undefined;
        try {
            const receipt = await bundlerClient.getUserOperationReceipt(userOpHash);
            expect(receipt).toBeDefined();
            expect(receipt.receipt.status).toBe(1); // Expect success
            txHash = receipt.receipt.transactionHash;
            console.log(`Transaction confirmed with tx hash: ${txHash}`);
        } catch (error: any) {
            console.error(`Failed to get receipt for userOpHash ${userOpHash}:`, error);
            throw error;
        }
        expect(txHash).toBeDefined();
    }, 60000); // Increase timeout for E2E test

    afterAll(async () => {
        // Clean up if necessary, e.g., revoke session keys
        // For this E2E test, no specific cleanup is required beyond logging.
    });
});