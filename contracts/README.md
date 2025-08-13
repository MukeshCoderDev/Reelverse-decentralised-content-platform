# Reelverse Smart Contracts

This directory contains the smart contracts for the Reelverse decentralized adult content platform.

## 🏗️ Architecture Overview

The smart contract system is designed to work alongside your existing Reelverse frontend, adding Web3 capabilities without disrupting current functionality.

### Core Contracts

- **CreatorRegistry**: Manages creator profiles and verification status
- **ContentRegistry**: Handles content metadata, pricing, and moderation
- **NFTAccess**: ERC-1155 tokens for content access (PPV, subscriptions, etc.)
- **RevenueSplitter**: Enforces 90/10 creator/platform revenue splits
- **ContentAccessGate**: Verifies access and issues playback tokens
- **UploadManager**: Orchestrates content upload pipeline
- **SBT Contracts**: Non-transferable verification badges

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### Development

```bash
# Compile contracts
npm run compile

# Run tests
npm run test

# Deploy to local network
npm run deploy:localhost

# Deploy to Mumbai testnet
npm run deploy:mumbai
```

### Environment Variables

Create a `.env` file with:

```env
PRIVATE_KEY=your_private_key_here
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

## 📁 Directory Structure

```
contracts/
├── contracts/
│   ├── interfaces/          # Contract interfaces
│   ├── mocks/              # Mock contracts for testing
│   └── [implementation]/   # Contract implementations (to be added)
├── scripts/
│   └── deploy.js           # Deployment script
├── test/                   # Contract tests (to be added)
├── hardhat.config.js       # Hardhat configuration
└── package.json           # Dependencies
```

## 🔧 Integration with Frontend

These contracts are designed to enhance your existing Reelverse frontend:

1. **WalletContext Enhancement**: Add blockchain state management
2. **VideoPlayer Integration**: Add watermarking and access control
3. **Studio Enhancement**: Add Web3 upload and monetization features
4. **Payment Integration**: Add USDC payments alongside existing flows

## 🛡️ Security Features

- **Access Control**: Role-based permissions for all operations
- **Upgradeable Contracts**: Using OpenZeppelin's proxy pattern
- **Revenue Protection**: Enforced 90% minimum creator share
- **Content Protection**: Perceptual hashing and watermarking
- **Geographic Compliance**: Built-in geo-restriction support

## 📋 Deployment Checklist

- [ ] Deploy contracts to testnet
- [ ] Verify contracts on block explorer
- [ ] Set up The Graph subgraph
- [ ] Configure backend services
- [ ] Update frontend environment variables
- [ ] Test integration with existing UI

## 🔗 Next Steps

After deployment:

1. Update your frontend `.env` with contract addresses
2. Enhance existing components with Web3 features
3. Set up backend services for content processing
4. Configure The Graph for blockchain data indexing

## 📚 Documentation

- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Polygon Documentation](https://docs.polygon.technology/)

## 🤝 Contributing

This contracts system is designed to preserve your existing 3-month frontend investment while adding powerful Web3 capabilities. All enhancements are additive and non-breaking.