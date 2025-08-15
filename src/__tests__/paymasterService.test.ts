import { PaymasterService, DEFAULT_PAYMASTER_CONFIG } from '../../services/paymasterService';
import { ethers } from 'ethers';

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBalance: jest.fn(),
      getFeeData: jest.fn(),
      getCode: jest.fn()
    })),
    Wallet: jest.fn().mockImplementation(() => ({
      sendTransaction: jest.fn(),
      signMessage: jest.fn()
    })),
    Contract: jest.fn().mockImplementation(() => ({
      withdraw: jest.fn()
    })),
    parseEther: jest.fn((value) => BigInt(value) * BigInt(10 ** 18)),
    formatEther: jest.fn((value) => (Number(value) / 10 ** 18).toString()),
    keccak256: jest.fn(() => '0x' + '1'.repeat(64)),
    AbiCoder: {
      defaultAbiCoder: {
        encode: jest.fn(() => '0x' + '2'.repeat(128))
      }
    },
    getBytes: jest.fn((data) => new Uint8Array(32)),
    zeroPadValue: jest.fn((value, length) => '0x' + '0'.repeat(length * 2 - 2)),
    toBeHex: jest.fn((value) => '0x' + value.toString(16))
  }
}));

describe('PaymasterService', () => {
  let paymasterService: PaymasterService;
  let mockProvider: any;
  let mockWallet: any;
  let mockContract: any;

  beforeEach(() => {
    const config = {
      ...DEFAULT_PAYMASTER_CONFIG,
      paymasterAddress: '0x1234567890123456789012345678901234567890',
      privateKey: '0x' + '1'.repeat(64)
    };

    paymasterService = new PaymasterService(config);
    
    // Get mocked instances
    mockProvider = (paymasterService as any).provider;
    mockWallet = (paymasterService as any).wallet;
    mockContract = (paymasterService as any).paymasterContract;

    // Setup default mock responses
    mockProvider.getBalance.mockResolvedValue(BigInt('1000000000000000000')); // 1 ETH
    mockProvider.getFeeData.mockResolvedValue({
      maxFeePerGas: BigInt('20000000000'), // 20 gwei
      maxPriorityFeePerGas: BigInt('2000000000') // 2 gwei
    });
    mockProvider.getCode.mockResolvedValue('0x608060405234801561001057600080fd5b50'); // Non-empty code
    mockWallet.signMessage.mockResolvedValue('0x' + '3'.repeat(130));
  });

  describe('sponsorUserOperation', () => {
    const mockUserOp = {
      sender: '0x1234567890123456789012345678901234567890',
      nonce: '0x0',
      callData: '0x',
      callGasLimit: '200000',
      verificationGasLimit: '100000',
      preVerificationGas: '21000'
    };

    it('should sponsor a valid user operation', async () => {
      // Mock spending limits validation
      jest.spyOn(paymasterService as any, 'getSpendingLimits').mockResolvedValue({
        dailySpent: '0',
        monthlySpent: '0',
        dailyLimit: ethers.parseEther('1').toString(),
        monthlyLimit: ethers.parseEther('10').toString(),
        lastResetDate: new Date()
      });

      const result = await paymasterService.sponsorUserOperation(mockUserOp);

      expect(result).toBeDefined();
      expect(result.paymasterAndData).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(result.preVerificationGas).toBe('21000');
      expect(result.verificationGasLimit).toBe('100000');
      expect(result.callGasLimit).toBe('200000');
      expect(result.maxFeePerGas).toBe('20000000000');
      expect(result.maxPriorityFeePerGas).toBe('2000000000');
    });

    it('should reject operation when daily spending limit exceeded', async () => {
      // Mock exceeded spending limits
      jest.spyOn(paymasterService as any, 'getSpendingLimits').mockResolvedValue({
        dailySpent: ethers.parseEther('1').toString(),
        monthlySpent: '0',
        dailyLimit: ethers.parseEther('1').toString(),
        monthlyLimit: ethers.parseEther('10').toString(),
        lastResetDate: new Date()
      });

      await expect(paymasterService.sponsorUserOperation(mockUserOp))
        .rejects.toThrow('Daily spending limit exceeded');
    });

    it('should reject operation when paymaster has insufficient balance', async () => {
      // Mock low balance
      mockProvider.getBalance.mockResolvedValue(BigInt('1000')); // Very low balance

      jest.spyOn(paymasterService as any, 'getSpendingLimits').mockResolvedValue({
        dailySpent: '0',
        monthlySpent: '0',
        dailyLimit: ethers.parseEther('1').toString(),
        monthlyLimit: ethers.parseEther('10').toString(),
        lastResetDate: new Date()
      });

      await expect(paymasterService.sponsorUserOperation(mockUserOp))
        .rejects.toThrow('Paymaster cannot sponsor operation');
    });

    it('should handle gas estimation errors gracefully', async () => {
      // Mock gas estimation failure
      mockProvider.getFeeData.mockRejectedValue(new Error('Network error'));

      jest.spyOn(paymasterService as any, 'getSpendingLimits').mockResolvedValue({
        dailySpent: '0',
        monthlySpent: '0',
        dailyLimit: ethers.parseEther('1').toString(),
        monthlyLimit: ethers.parseEther('10').toString(),
        lastResetDate: new Date()
      });

      await expect(paymasterService.sponsorUserOperation(mockUserOp))
        .rejects.toThrow('Failed to estimate gas costs');
    });
  });

  describe('getSpendingLimits', () => {
    it('should return default spending limits for new user', async () => {
      const limits = await paymasterService.getSpendingLimits('0x1234567890123456789012345678901234567890');

      expect(limits).toBeDefined();
      expect(limits.dailySpent).toBe('0');
      expect(limits.monthlySpent).toBe('0');
      expect(limits.dailyLimit).toBe(DEFAULT_PAYMASTER_CONFIG.dailySpendingLimit);
      expect(limits.monthlyLimit).toBe(DEFAULT_PAYMASTER_CONFIG.monthlySpendingLimit);
      expect(limits.lastResetDate).toBeInstanceOf(Date);
    });
  });

  describe('fundPaymaster', () => {
    it('should fund paymaster successfully', async () => {
      const mockTx = {
        hash: '0x' + '4'.repeat(64),
        wait: jest.fn().mockResolvedValue({})
      };
      mockWallet.sendTransaction.mockResolvedValue(mockTx);

      const txHash = await paymasterService.fundPaymaster('1.0');

      expect(txHash).toBe(mockTx.hash);
      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: DEFAULT_PAYMASTER_CONFIG.paymasterAddress,
        value: ethers.parseEther('1.0')
      });
    });

    it('should handle funding errors', async () => {
      mockWallet.sendTransaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(paymasterService.fundPaymaster('1.0'))
        .rejects.toThrow('Failed to fund paymaster');
    });
  });

  describe('withdrawFromPaymaster', () => {
    it('should withdraw from paymaster successfully', async () => {
      const mockTx = {
        hash: '0x' + '5'.repeat(64),
        wait: jest.fn().mockResolvedValue({})
      };
      mockContract.withdraw.mockResolvedValue(mockTx);

      const recipient = '0x9876543210987654321098765432109876543210';
      const txHash = await paymasterService.withdrawFromPaymaster('0.5', recipient);

      expect(txHash).toBe(mockTx.hash);
      expect(mockContract.withdraw).toHaveBeenCalledWith(
        recipient,
        ethers.parseEther('0.5')
      );
    });

    it('should handle withdrawal errors', async () => {
      mockContract.withdraw.mockRejectedValue(new Error('Withdrawal failed'));

      await expect(paymasterService.withdrawFromPaymaster('0.5', '0x9876543210987654321098765432109876543210'))
        .rejects.toThrow('Failed to withdraw from paymaster');
    });
  });

  describe('getPaymasterStats', () => {
    it('should return paymaster statistics', async () => {
      const stats = await paymasterService.getPaymasterStats();

      expect(stats).toBeDefined();
      expect(stats.balance).toBe('1.0'); // 1 ETH from mock
      expect(stats.balanceWei).toBe('1000000000000000000');
      expect(stats.address).toBe(DEFAULT_PAYMASTER_CONFIG.paymasterAddress);
      expect(stats.chainId).toBe(DEFAULT_PAYMASTER_CONFIG.chainId);
      expect(stats.dailySpendingLimit).toBe('1.0');
      expect(stats.monthlySpendingLimit).toBe('10.0');
      expect(stats.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('batchSponsorOperations', () => {
    const mockUserOps = [
      {
        sender: '0x1111111111111111111111111111111111111111',
        nonce: '0x0',
        callData: '0x'
      },
      {
        sender: '0x2222222222222222222222222222222222222222',
        nonce: '0x0',
        callData: '0x'
      }
    ];

    it('should batch sponsor multiple operations', async () => {
      // Mock successful sponsoring
      jest.spyOn(paymasterService, 'sponsorUserOperation').mockResolvedValue({
        paymasterAndData: '0x' + '6'.repeat(64),
        preVerificationGas: '21000',
        verificationGasLimit: '100000',
        callGasLimit: '200000',
        maxFeePerGas: '20000000000',
        maxPriorityFeePerGas: '2000000000'
      });

      const results = await paymasterService.batchSponsorOperations(mockUserOps);

      expect(results).toHaveLength(2);
      expect(results[0].paymasterAndData).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(results[1].paymasterAndData).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it('should handle partial failures in batch processing', async () => {
      // Mock first success, second failure
      jest.spyOn(paymasterService, 'sponsorUserOperation')
        .mockResolvedValueOnce({
          paymasterAndData: '0x' + '6'.repeat(64),
          preVerificationGas: '21000',
          verificationGasLimit: '100000',
          callGasLimit: '200000',
          maxFeePerGas: '20000000000',
          maxPriorityFeePerGas: '2000000000'
        })
        .mockRejectedValueOnce(new Error('Sponsoring failed'));

      const results = await paymasterService.batchSponsorOperations(mockUserOps);

      expect(results).toHaveLength(1); // Only successful operations returned
      expect(results[0].paymasterAndData).toMatch(/^0x[a-fA-F0-9]+$/);
    });
  });

  describe('validateConfiguration', () => {
    it('should validate correct configuration', async () => {
      const isValid = await paymasterService.validateConfiguration();

      expect(isValid).toBe(true);
      expect(mockProvider.getCode).toHaveBeenCalledWith(DEFAULT_PAYMASTER_CONFIG.paymasterAddress);
      expect(mockProvider.getBalance).toHaveBeenCalledWith(DEFAULT_PAYMASTER_CONFIG.paymasterAddress);
    });

    it('should reject configuration with non-existent contract', async () => {
      mockProvider.getCode.mockResolvedValue('0x'); // Empty code

      const isValid = await paymasterService.validateConfiguration();

      expect(isValid).toBe(false);
    });

    it('should warn about low balance but still validate', async () => {
      mockProvider.getBalance.mockResolvedValue(BigInt('50000000000000000')); // 0.05 ETH

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const isValid = await paymasterService.validateConfiguration();

      expect(isValid).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Paymaster balance is low'));
      
      consoleSpy.mockRestore();
    });
  });
});