import { logger } from '../../utils/logger';
import axios from 'axios';
import { PaymasterResult, UserOperation } from './paymasterService';
import { env } from '../../config/env';
import { currentChainConfig } from '../../config/chain';

export class BiconomyPaymasterService {
  
  constructor() {}

  /**
   * Get paymaster data from Biconomy
   */
  async getPaymasterData(userOp: Partial<UserOperation> & { requestId?: string }): Promise<PaymasterResult> {
    try {
      logger.info('Getting paymaster data from Biconomy', { requestId: userOp.requestId });

      if (!env.BICONOMY_PAYMASTER_URL || !env.BICONOMY_API_KEY) {
        throw new Error('Biconomy paymaster URL or API key is not configured in environment variables.');
      }

      const response = await axios.post(
        `${env.BICONOMY_PAYMASTER_URL}/api/v1/paymaster`,
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
            'x-api-key': env.BICONOMY_API_KEY
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

    } catch (error: any) {
      logger.error(`Biconomy paymaster request failed: ${error.message}`, { requestId: userOp.requestId, error });
      throw new Error(`Failed to get Biconomy paymaster data: ${error.message}`);
    }
  }

  /**
   * Submit user operation via Biconomy bundler
   */
  async submitUserOperation(userOp: UserOperation & { requestId?: string }): Promise<string> {
    try {
      logger.info('Submitting user operation via Biconomy bundler', { requestId: userOp.requestId });

      if (!env.BICONOMY_BUNDLER_URL || !env.BICONOMY_API_KEY) {
        throw new Error('Biconomy bundler URL or API key is not configured in environment variables.');
      }

      const response = await axios.post(
        `${env.BICONOMY_BUNDLER_URL}/api/v1/bundler`,
        {
          method: 'eth_sendUserOperation',
          params: [
            userOp,
            currentChainConfig.chainId
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.BICONOMY_API_KEY
          }
        }
      );

      if (response.data.error) {
        throw new Error(`Biconomy bundler error: ${response.data.error.message}`);
      }

      const userOpHash = response.data.result;
      logger.info(`User operation submitted: ${userOpHash}`, { requestId: userOp.requestId, userOpHash });
      
      return userOpHash;

    } catch (error: any) {
      logger.error(`Biconomy bundler submission failed: ${error.message}`, { requestId: userOp.requestId, error });
      throw new Error(`Failed to submit user operation: ${error.message}`);
    }
  }

  /**
   * Get user operation receipt
   */
  async getUserOperationReceipt(userOpHash: string, requestId?: string): Promise<any> {
    try {
      if (!env.BICONOMY_BUNDLER_URL || !env.BICONOMY_API_KEY) {
        throw new Error('Biconomy bundler URL or API key is not configured in environment variables.');
      }
      const response = await axios.post(
        `${env.BICONOMY_BUNDLER_URL}/api/v1/bundler`,
        {
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.BICONOMY_API_KEY
          }
        }
      );

      return response.data.result;

    } catch (error: any) {
      logger.error(`Failed to get user operation receipt: ${error.message}`, { requestId, userOpHash, error });
      throw error;
    }
  }

  /**
   * Get supported entry points
   */
  async getSupportedEntryPoints(requestId?: string): Promise<string[]> {
    try {
      if (!env.BICONOMY_BUNDLER_URL || !env.BICONOMY_API_KEY) {
        throw new Error('Biconomy bundler URL or API key is not configured in environment variables.');
      }
      const response = await axios.post(
        `${env.BICONOMY_BUNDLER_URL}/api/v1/bundler`,
        {
          method: 'eth_supportedEntryPoints',
          params: []
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.BICONOMY_API_KEY
          }
        }
      );

      return response.data.result;

    } catch (error: any) {
      logger.error(`Failed to get supported entry points: ${error.message}`, { requestId, error });
      throw error;
    }
  }
}

export class AlchemyPaymasterService {
 
  constructor() {}

  /**
   * Get paymaster data from Alchemy
   */
  async getPaymasterData(userOp: Partial<UserOperation> & { requestId?: string }): Promise<PaymasterResult> {
    try {
      logger.info('Getting paymaster data from Alchemy', { requestId: userOp.requestId });

      if (!env.ALCHEMY_RPC_URL || !env.ALCHEMY_API_KEY || !env.ALCHEMY_POLICY_ID) {
        throw new Error('Alchemy RPC URL, API key, or Policy ID is not configured in environment variables.');
      }

      const response = await axios.post(
        env.ALCHEMY_RPC_URL,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_requestPaymasterAndData',
          params: [
            {
              policyId: env.ALCHEMY_POLICY_ID,
              entryPoint: currentChainConfig.entryPointAddress,
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
            'Authorization': `Bearer ${env.ALCHEMY_API_KEY}`
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

    } catch (error: any) {
      logger.error(`Alchemy paymaster request failed: ${error.message}`, { requestId: userOp.requestId, error });
      throw new Error(`Failed to get Alchemy paymaster data: ${error.message}`);
    }
  }

  /**
   * Submit user operation via Alchemy
   */
  async submitUserOperation(userOp: UserOperation & { requestId?: string }): Promise<string> {
    try {
      logger.info('Submitting user operation via Alchemy', { requestId: userOp.requestId });

      if (!env.ALCHEMY_RPC_URL || !env.ALCHEMY_API_KEY) {
        throw new Error('Alchemy RPC URL or API key is not configured in environment variables.');
      }

      const response = await axios.post(
        env.ALCHEMY_RPC_URL,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_sendUserOperation',
          params: [
            userOp,
            currentChainConfig.entryPointAddress
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.ALCHEMY_API_KEY}`
          }
        }
      );

      if (response.data.error) {
        throw new Error(`Alchemy error: ${response.data.error.message}`);
      }

      const userOpHash = response.data.result;
      logger.info(`User operation submitted via Alchemy: ${userOpHash}`, { requestId: userOp.requestId, userOpHash });
      
      return userOpHash;

    } catch (error: any) {
      logger.error(`Alchemy submission failed: ${error.message}`, { requestId: userOp.requestId, error });
      throw new Error(`Failed to submit user operation via Alchemy: ${error.message}`);
    }
  }

  /**
   * Get gas estimates from Alchemy
   */
  async estimateUserOperationGas(userOp: Partial<UserOperation> & { requestId?: string }): Promise<any> {
    try {
      if (!env.ALCHEMY_RPC_URL || !env.ALCHEMY_API_KEY) {
        throw new Error('Alchemy RPC URL or API key is not configured in environment variables.');
      }
      const response = await axios.post(
        env.ALCHEMY_RPC_URL,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_estimateUserOperationGas',
          params: [
            userOp,
            currentChainConfig.entryPointAddress
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.ALCHEMY_API_KEY}`
          }
        }
      );
      return response.data.result;

    } catch (error: any) {
      logger.error(`Alchemy gas estimation failed: ${error.message}`, { requestId: userOp.requestId, error });
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

  constructor() {
    // Assuming env.WALLETLESS_PROVIDER exists and is configured
    if (env.WALLETLESS_PROVIDER === 'biconomy' || env.WALLETLESS_PROVIDER === 'alchemy') {
      this.preferredProvider = env.WALLETLESS_PROVIDER;
    } else {
      this.preferredProvider = 'biconomy'; // Default to Biconomy if local or unknown
    }
    
    if (env.BICONOMY_API_KEY && env.BICONOMY_BUNDLER_URL && env.BICONOMY_PAYMASTER_URL) {
      this.biconomy = new BiconomyPaymasterService();
    }
    
    if (env.ALCHEMY_API_KEY && env.ALCHEMY_POLICY_ID && env.ALCHEMY_RPC_URL) {
      this.alchemy = new AlchemyPaymasterService();
    }
  }

  /**
   * Get paymaster data with fallback between providers
   */
  async getPaymasterData(userOp: Partial<UserOperation> & { requestId?: string }): Promise<PaymasterResult> {
    const providers = this.getProviderOrder();

    for (const provider of providers) {
      try {
        if (provider === 'biconomy' && this.biconomy) {
          return await this.biconomy.getPaymasterData(userOp);
        } else if (provider === 'alchemy' && this.alchemy) {
          return await this.alchemy.getPaymasterData(userOp);
        }
      } catch (error: any) {
        logger.warn(`${provider} paymaster failed, trying next provider: ${error.message}`, { requestId: userOp.requestId, provider, error });
        continue;
      }
    }

    throw new Error('All paymaster providers failed');
  }

  /**
   * Submit user operation with fallback
   */
  async submitUserOperation(userOp: UserOperation & { requestId?: string }): Promise<string> {
    const providers = this.getProviderOrder();

    for (const provider of providers) {
      try {
        if (provider === 'biconomy' && this.biconomy) {
          return await this.biconomy.submitUserOperation(userOp);
        } else if (provider === 'alchemy' && this.alchemy) {
          return await this.alchemy.submitUserOperation(userOp);
        }
      } catch (error: any) {
        logger.warn(`${provider} submission failed, trying next provider: ${error.message}`, { requestId: userOp.requestId, provider, error });
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
  async healthCheck(requestId?: string): Promise<{ biconomy: boolean; alchemy: boolean }> {
    const health = { biconomy: false, alchemy: false };

    if (this.biconomy) {
      try {
        await this.biconomy.getSupportedEntryPoints(requestId);
        health.biconomy = true;
      } catch (error: any) {
        logger.warn(`Biconomy health check failed: ${error.message}`, { requestId, error });
      }
    }

    if (this.alchemy) {
      try {
        // Simple test call to check Alchemy availability
        await this.alchemy.estimateUserOperationGas({
          sender: '0x0000000000000000000000000000000000000000',
          nonce: '0x0',
          callData: '0x'
        }); // Removed requestId
        health.alchemy = true;
      } catch (error: any) {
        // Expected to fail with invalid data, but service should be reachable
        if (error.message.includes('invalid') || error.message.includes('revert')) {
          health.alchemy = true;
        } else {
          logger.warn(`Alchemy health check failed: ${error.message}`, { requestId, error });
        }
      }
    }

    return health;
  }
}
