import { NetworkService } from '../NetworkService';
import { SupportedChainId } from '../../../types/wallet';
import { NETWORK_CONFIGS } from '../../../constants/wallet';

describe('NetworkService', () => {
  let networkService: NetworkService;

  beforeEach(() => {
    networkService = NetworkService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = NetworkService.getInstance();
      const instance2 = NetworkService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getSupportedNetworks', () => {
    it('should return all supported network configurations', () => {
      const networks = networkService.getSupportedNetworks();
      expect(networks).toHaveLength(6);
      expect(networks.every(network => network.chainId && network.name)).toBe(true);
    });
  });

  describe('getNetworkConfig', () => {
    it('should return correct network config for Ethereum', () => {
      const config = networkService.getNetworkConfig(SupportedChainId.ETHEREUM);
      expect(config).toEqual(NETWORK_CONFIGS[SupportedChainId.ETHEREUM]);
    });

    it('should return correct network config for Polygon', () => {
      const config = networkService.getNetworkConfig(SupportedChainId.POLYGON);
      expect(config).toEqual(NETWORK_CONFIGS[SupportedChainId.POLYGON]);
    });

    it('should return null for unsupported network', () => {
      const config = networkService.getNetworkConfig(999999);
      expect(config).toBeNull();
    });
  });

  describe('isSupportedNetwork', () => {
    it('should return true for supported networks', () => {
      expect(networkService.isSupportedNetwork(SupportedChainId.ETHEREUM)).toBe(true);
      expect(networkService.isSupportedNetwork(SupportedChainId.POLYGON)).toBe(true);
      expect(networkService.isSupportedNetwork(SupportedChainId.BNB_CHAIN)).toBe(true);
      expect(networkService.isSupportedNetwork(SupportedChainId.ARBITRUM)).toBe(true);
      expect(networkService.isSupportedNetwork(SupportedChainId.OPTIMISM)).toBe(true);
      expect(networkService.isSupportedNetwork(SupportedChainId.AVALANCHE)).toBe(true);
    });

    it('should return false for unsupported networks', () => {
      expect(networkService.isSupportedNetwork(999999)).toBe(false);
      expect(networkService.isSupportedNetwork(0)).toBe(false);
    });
  });

  describe('getRpcUrl', () => {
    it('should return correct RPC URL for supported networks', () => {
      const ethRpc = networkService.getRpcUrl(SupportedChainId.ETHEREUM);
      expect(ethRpc).toBe(NETWORK_CONFIGS[SupportedChainId.ETHEREUM].rpcUrl);

      const polygonRpc = networkService.getRpcUrl(SupportedChainId.POLYGON);
      expect(polygonRpc).toBe(NETWORK_CONFIGS[SupportedChainId.POLYGON].rpcUrl);
    });

    it('should return default RPC URL for unsupported networks', () => {
      const defaultRpc = networkService.getRpcUrl(999999);
      expect(defaultRpc).toBe(NETWORK_CONFIGS[SupportedChainId.ETHEREUM].rpcUrl);
    });
  });

  describe('getExplorerUrl', () => {
    it('should return correct explorer URL for supported networks', () => {
      const ethExplorer = networkService.getExplorerUrl(SupportedChainId.ETHEREUM);
      expect(ethExplorer).toBe(NETWORK_CONFIGS[SupportedChainId.ETHEREUM].blockExplorerUrl);
    });

    it('should return default explorer URL for unsupported networks', () => {
      const defaultExplorer = networkService.getExplorerUrl(999999);
      expect(defaultExplorer).toBe(NETWORK_CONFIGS[SupportedChainId.ETHEREUM].blockExplorerUrl);
    });
  });

  describe('formatChainId', () => {
    it('should format chain ID to hex string', () => {
      expect(networkService.formatChainId(1)).toBe('0x1');
      expect(networkService.formatChainId(137)).toBe('0x89');
      expect(networkService.formatChainId(56)).toBe('0x38');
    });
  });

  describe('parseChainId', () => {
    it('should parse hex chain ID to number', () => {
      expect(networkService.parseChainId('0x1')).toBe(1);
      expect(networkService.parseChainId('0x89')).toBe(137);
      expect(networkService.parseChainId('0x38')).toBe(56);
    });
  });

  describe('getNetworkAddParams', () => {
    it('should return correct parameters for network addition', () => {
      const params = networkService.getNetworkAddParams(SupportedChainId.POLYGON);
      const config = NETWORK_CONFIGS[SupportedChainId.POLYGON];

      expect(params).toEqual({
        chainId: '0x89',
        chainName: config.name,
        nativeCurrency: {
          name: config.name,
          symbol: config.symbol,
          decimals: config.decimals
        },
        rpcUrls: [config.rpcUrl],
        blockExplorerUrls: [config.blockExplorerUrl]
      });
    });

    it('should throw error for unsupported network', () => {
      expect(() => {
        networkService.getNetworkAddParams(999999);
      }).toThrow('Unsupported network: 999999');
    });
  });

  describe('validateNetworkConfig', () => {
    it('should validate correct network configuration', () => {
      const validConfig = {
        chainId: 1,
        name: 'Test Network',
        symbol: 'TEST',
        decimals: 18,
        rpcUrl: 'https://test.rpc.com',
        blockExplorerUrl: 'https://test.explorer.com',
        iconUrl: '🔷',
        color: 'from-blue-400 to-blue-600'
      };

      expect(networkService.validateNetworkConfig(validConfig)).toBe(true);
    });

    it('should reject invalid network configuration', () => {
      const invalidConfig = {
        chainId: 0,
        name: '',
        symbol: '',
        decimals: 0,
        rpcUrl: '',
        blockExplorerUrl: '',
        iconUrl: '',
        color: ''
      };

      expect(networkService.validateNetworkConfig(invalidConfig)).toBe(false);
    });
  });

  describe('getNetworkStatus', () => {
    it('should return correct status for Ethereum mainnet', () => {
      const status = networkService.getNetworkStatus(SupportedChainId.ETHEREUM);
      expect(status).toEqual({
        isSupported: true,
        isMainnet: true,
        isTestnet: false,
        requiresAddition: false
      });
    });

    it('should return correct status for Polygon', () => {
      const status = networkService.getNetworkStatus(SupportedChainId.POLYGON);
      expect(status).toEqual({
        isSupported: true,
        isMainnet: true,
        isTestnet: false,
        requiresAddition: true
      });
    });

    it('should return correct status for unsupported network', () => {
      const status = networkService.getNetworkStatus(999999);
      expect(status).toEqual({
        isSupported: false,
        isMainnet: false,
        isTestnet: false,
        requiresAddition: true
      });
    });
  });
});