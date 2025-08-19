import { UnifiedPaymasterService } from '../../src/services/onchain/biconomyPaymasterService';
import { currentChainConfig } from '../../src/config/chain';
import { logger } from '../../src/utils/logger';

async function runHealthCheck() {
  logger.info('Starting AA health check...');
  try {
    const paymasterService = new UnifiedPaymasterService();
    
    // Check bundler supported entry points
    const supportedEntryPoints = await paymasterService.biconomy?.getSupportedEntryPoints(); // Assuming Biconomy is the primary bundler for this check
    
    if (supportedEntryPoints && supportedEntryPoints.length > 0) {
      logger.info(`Supported EntryPoints: ${supportedEntryPoints.join(', ')}`);
      logger.info(`Current Chain ID: ${currentChainConfig.chainId}`);
      logger.info('AA health check successful.');
      process.exit(0);
    } else {
      logger.error('No supported EntryPoints found or bundler not reachable.');
      process.exit(1);
    }
  } catch (error: any) {
    logger.error(`AA health check failed: ${error.message}`);
    process.exit(1);
  }
}

runHealthCheck();