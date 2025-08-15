import axios from 'axios';
import { PaymasterResult, UserOperation } from './paymasterService';

export interface BiconomyConfig {
  apiKey: string;
  bundlerUrl: string;
  paymasterUrl: string;
  chainId: number;
  dappId: string;
}

export interface BiconomyPaymasterResponse {
  paymasterAndData: string;
  preVerificationGas: string;
  verificationGasLimit: string;
  callGasLimit: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}

export interface AlchemyConfig {
  apiKey: string;
  policyId: string;
  rpcUrl: string;
  chainId: number;
}

export class BiconomyPaymasterService {
  private config: BiconomyConfig;

  constructor(config: BiconomyConfig) {
    this.config = config;
  }

  /**
   * Get paymaster data from Biconomy
   */
  async getPaymasterData(userOp: Partial<UserOperation>): Promise<PaymasterResult> {
    try {
      console.log('Getting paymaster data from Biconomy');

      const response = await axios.post(
        `${this.config.paymasterUrl}/api/v1/paymaster`,
        {
          method: 'pm_sponsorUserOperation',
          params: [
            {
              sender: userOp.sender,
              nonce: userOp.nonce,
              initCode: userOp.initCode || '0x',
              callData: userOp.callData,
              callGasLimit: userOp.callGasLimit,
              verificationGasLimit: userOp.verificationGasLimit,
              preVerificationGas: userOp.preVerificationGas,
              maxFeePerGas: userOp.maxFeePerGas,
              maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
              paymasterAndData: '0x',
              signature: '0x'
            },
            {
              mode: 'SPONSORED',
              expiryDuration: 300, // 5 minutes
              calculateGasLimits: true
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey
          }
        }
      );

      if (response.data.error) {
        throw new Error(`Biconomy error: ${response.data.error.message}`);
      }

      const result = response.data.result;
      
      return {
        paymasterAndData: result.paymasterAndData,
        preVerificationGas: result.preVerificationGas,
        verificationGasLimit: result.verificationGasLimit,
        callGasLimit: result.callGasLimit,
        maxFeePerGas: result.maxFeePerGas,
        maxPriorityFeePerGas: result.maxPriorityFeePerGas
      };

    } catch (error) {
      console.error('Biconomy paymaster request failed:', error);
      throw new Error(`Failed to get Biconomy paymaster data: ${error.message}`);
    }
  }

  /**
   * Submit user operation via Biconomy bundler
   */
  async submitUserOperation(userOp: UserOperation): Promise<string> {
    try {
      console.log('Submitting user operation via Biconomy bundler');

      const response = await axios.post(
        `${this.config.bundlerUrl}/api/v1/bundler`,
        {
          method: 'eth_sendUserOperation',
          params: [
            userOp,
            this.config.chainId
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey
          }
        }
      );

      if (response.data.error) {
        throw new Error(`Biconomy bundler error: ${response.data.error.message}`);
      }

      const userOpHash = response.data.result;
      console.log(`User operation submitted: ${userOpHash}`);
      
      return userOpHash;

    } catch (error) {
      console.error('Biconomy bundler submission failed:', error);
      throw new Error(`Failed to submit user operation: ${error.message}`);
    }
  }

  /**
   * Get user operation receipt
   */
  async getUserOperationReceipt(userOpHash: string): Promise<any> {
    try {
      const response = await axios.post(
        `${this.config.bundlerUrl}/api/v1/bundler`,
        {
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey
          }
        }
      );

      return response.data.result;

    } catch (error) {
      console.error('Failed to get user operation receipt:', error);
      throw error;
    }
  }

  /**
   * Get supported entry points
   */
  async getSupportedEntryPoints(): Promise<string[]> {
    try {
      const response = await axios.post(
        `${this.config.bundlerUrl}/api/v1/bundler`,
        {
          method: 'eth_supportedEntryPoints',
          params: []
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey
          }
        }
      );

      return response.data.result;

    } catch (error) {
      console.error('Failed to get supported entry points:', error);
      throw error;
    }
  }
}

export class AlchemyPaymasterService {
  private config: AlchemyConfig;

  constructor(config: AlchemyConfig) {
    this.config = config;
  }

  /**
   * Get paymaster data from Alchemy
   */
  async getPaymasterData(userOp: Partial<UserOperation>): Promise<PaymasterResult> {
    try {
      console.log('Getting paymaster data from Alchemy');

      const response = await axios.post(
        this.config.rpcUrl,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_requestPaymasterAndData',
          params: [
            {
              policyId: this.config.policyId,
              entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
              userOperation: {
                sender: userOp.sender,
                nonce: userOp.nonce,
                initCode: userOp.initCode || '0x',
                callData: userOp.callData,
                callGasLimit: userOp.callGasLimit,
                verificationGasLimit: userOp.verificationGasLimit,
                preVerificationGas: userOp.preVerificationGas,
                maxFeePerGas: userOp.maxFeePerGas,
                maxPriorityFeePerGas: userOp.maxPriorityFeePerGas
              }
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          }
        }
      );

      if (response.data.error) {
        throw new Error(`Alchemy error: ${response.data.error.message}`);
      }

      const result = response.data.result;
      
      return {
        paymasterAndData: result.paymasterAndData,
        preVerificationGas: result.preVerificationGas,
        verificationGasLimit: result.verificationGasLimit,
        callGasLimit: result.callGasLimit,
        maxFeePerGas: result.maxFeePerGas,
        maxPriorityFeePerGas: result.maxPriorityFeePerGas
      };

    } catch (error) {
      console.error('Alchemy paymaster request failed:', error);
      throw new Error(`Failed to get Alchemy paymaster data: ${error.message}`);
    }
  }

  /**
   * Submit user operation via Alchemy
   */
  async submitUserOperation(userOp: UserOperation): Promise<string> {
    try {
      console.log('Submitting user operation via Alchemy');

      const response = await axios.post(
        this.config.rpcUrl,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_sendUserOperation',
          params: [
            userOp,
            '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' // EntryPoint address
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          }
        }
      );

      if (response.data.error) {
        throw new Error(`Alchemy error: ${response.data.error.message}`);
      }

      const userOpHash = response.data.result;
      console.log(`User operation submitted via Alchemy: ${userOpHash}`);
      
      return userOpHash;

    } catch (error) {
      console.error('Alchemy submission failed:', error);
      throw new Error(`Failed to submit user operation via Alchemy: ${error.message}`);
    }
  }

  /**
   * Get gas estimates from Alchemy
   */
  async estimateUserOperationGas(userOp: Partial<UserOperation>): Promise<any> {
    try {
      const response = await axios.post(
        this.config.rpcUrl,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_estimateUserOperationGas',
          params: [
            userOp,
            '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          }
        }
      );

      return response.data.result;

    } catch (error) {
      console.error('Alchemy gas estimation failed:', error);
      throw error;
    }
  }
}

/**
 * Unified paymaster service that can use multiple providers
 */
export class UnifiedPaymasterService {
  private biconomy?: BiconomyPaymasterService;
  private alchemy?: AlchemyPaymasterService;
  private preferredProvider: 'biconomy' | 'alchemy';

  constructor(
    biconomyConfig?: BiconomyConfig,
    alchemyConfig?: AlchemyConfig,
    preferredProvider: 'biconomy' | 'alchemy' = 'biconomy'
  ) {
    if (biconomyConfig) {
      this.biconomy = new BiconomyPaymasterService(biconomyConfig);
    }
    
    if (alchemyConfig) {
      this.alchemy = new AlchemyPaymasterService(alchemyConfig);
    }

    this.preferredProvider = preferredProvider;
  }

  /**
   * Get paymaster data with fallback between providers
   */
  async getPaymasterData(userOp: Partial<UserOperation>): Promise<PaymasterResult> {
    const providers = this.getProviderOrder();

    for (const provider of providers) {
      try {
        if (provider === 'biconomy' && this.biconomy) {
          return await this.biconomy.getPaymasterData(userOp);
        } else if (provider === 'alchemy' && this.alchemy) {
          return await this.alchemy.getPaymasterData(userOp);
        }
      } catch (error) {
        console.warn(`${provider} paymaster failed, trying next provider:`, error.message);
        continue;
      }
    }

    throw new Error('All paymaster providers failed');
  }

  /**
   * Submit user operation with fallback
   */
  async submitUserOperation(userOp: UserOperation): Promise<string> {
    const providers = this.getProviderOrder();

    for (const provider of providers) {
      try {
        if (provider === 'biconomy' && this.biconomy) {
          return await this.biconomy.submitUserOperation(userOp);
        } else if (provider === 'alchemy' && this.alchemy) {
          return await this.alchemy.submitUserOperation(userOp);
        }
      } catch (error) {
        console.warn(`${provider} submission failed, trying next provider:`, error.message);
        continue;
      }
    }

    throw new Error('All paymaster providers failed to submit user operation');
  }

  /**
   * Get provider order based on preference
   */
  private getProviderOrder(): ('biconomy' | 'alchemy')[] {
    if (this.preferredProvider === 'biconomy') {
      return ['biconomy', 'alchemy'];
    } else {
      return ['alchemy', 'biconomy'];
    }
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<{ biconomy: boolean; alchemy: boolean }> {
    const health = { biconomy: false, alchemy: false };

    if (this.biconomy) {
      try {
        await this.biconomy.getSupportedEntryPoints();
        health.biconomy = true;
      } catch (error) {
        console.warn('Biconomy health check failed:', error.message);
      }
    }

    if (this.alchemy) {
      try {
        // Simple test call to check Alchemy availability
        await this.alchemy.estimateUserOperationGas({
          sender: '0x0000000000000000000000000000000000000000',
          nonce: '0x0',
          callData: '0x'
        });
        health.alchemy = true;
      } catch (error) {
        // Expected to fail with invalid data, but service should be reachable
        if (error.message.includes('invalid') || error.message.includes('revert')) {
          health.alchemy = true;
        } else {
          console.warn('Alchemy health check failed:', error.message);
        }
      }
    }

    return health;
  }
}

// Default configurations
export const DEFAULT_BICONOMY_CONFIG: BiconomyConfig = {
  apiKey: process.env.BICONOMY_API_KEY || '',
  bundlerUrl: process.env.BICONOMY_BUNDLER_URL || 'https://bundler.biconomy.io',
  paymasterUrl: process.env.BICONOMY_PAYMASTER_URL || 'https://paymaster.biconomy.io',
  chainId: 137, // Polygon
  dappId: process.env.BICONOMY_DAPP_ID || ''
};

export const DEFAULT_ALCHEMY_CONFIG: AlchemyConfig = {
  apiKey: process.env.ALCHEMY_API_KEY || '',
  policyId: process.env.ALCHEMY_POLICY_ID || '',
  rpcUrl: process.env.ALCHEMY_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/',
  chainId: 137 // Polygon
};