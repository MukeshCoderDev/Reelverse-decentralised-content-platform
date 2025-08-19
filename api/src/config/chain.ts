import { env } from './env';

interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  bundlerUrl: string;
  paymasterUrl: string;
  entryPointAddress: string;
  usdcAddress: string;
}

const POLYGON_MAINNET: ChainConfig = {
  chainId: 137,
  name: 'Polygon Mainnet',
  rpcUrl: env.POLYGON_RPC_URL,
  bundlerUrl: env.BICONOMY_BUNDLER_URL || 'https://bundler.biconomy.io/api/v2/137/nJPK7B3ru.json', // Default Biconomy Bundler
  paymasterUrl: env.BICONOMY_PAYMASTER_URL || 'https://paymaster.biconomy.io/api/v1/137/nJPK7B3ru.json', // Default Biconomy Paymaster
  entryPointAddress: env.ENTRY_POINT_ADDRESS,
  usdcAddress: env.USDC_CONTRACT_ADDRESS,
};

const SEPOLIA_TESTNET: ChainConfig = {
  chainId: 11155111,
  name: 'Sepolia Testnet',
  rpcUrl: env.ALCHEMY_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/', // Default Alchemy Sepolia
  bundlerUrl: env.BICONOMY_BUNDLER_URL || 'https://bundler.biconomy.io/api/v2/11155111/nJPK7B3ru.json', // Default Biconomy Bundler for Sepolia
  paymasterUrl: env.BICONOMY_PAYMASTER_URL || 'https://paymaster.biconomy.io/api/v1/11155111/nJPK7B3ru.json', // Default Biconomy Paymaster for Sepolia
  entryPointAddress: env.ENTRY_POINT_ADDRESS,
  usdcAddress: env.USDC_CONTRACT_ADDRESS, // Assuming same USDC for testnet or mock
};

const MUMBAI_TESTNET: ChainConfig = {
  chainId: 80001,
  name: 'Mumbai Testnet',
  rpcUrl: env.MUMBAI_RPC_URL,
  bundlerUrl: env.BICONOMY_BUNDLER_URL || 'https://bundler.biconomy.io/api/v2/80001/nJPK7B3ru.json', // Default Biconomy Bundler
  paymasterUrl: env.BICONOMY_PAYMASTER_URL || 'https://paymaster.biconomy.io/api/v1/80001/nJPK7B3ru.json', // Default Biconomy Paymaster
  entryPointAddress: env.ENTRY_POINT_ADDRESS,
  usdcAddress: env.USDC_CONTRACT_ADDRESS, // Assuming same USDC for testnet or mock
};

const LOCAL_HARDHAT: ChainConfig = {
  chainId: 1337,
  name: 'Local Hardhat',
  rpcUrl: 'http://127.0.0.1:8545',
  bundlerUrl: 'http://localhost:4337', // Example local bundler
  paymasterUrl: 'http://localhost:3001/api/v1/paymaster', // Local paymaster stub
  entryPointAddress: env.ENTRY_POINT_ADDRESS,
  usdcAddress: env.USDC_CONTRACT_ADDRESS, // Mock USDC
};

export const getChainConfig = (chainId: number): ChainConfig => {
  switch (chainId) {
    case POLYGON_MAINNET.chainId:
      return POLYGON_MAINNET;
    case SEPOLIA_TESTNET.chainId:
      return SEPOLIA_TESTNET;
    case MUMBAI_TESTNET.chainId:
      return MUMBAI_TESTNET;
    case LOCAL_HARDHAT.chainId:
      return LOCAL_HARDHAT;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
};

export const detectChainId = (): number => {
  return env.CHAIN_ID;
};

export const currentChainConfig = getChainConfig(detectChainId());