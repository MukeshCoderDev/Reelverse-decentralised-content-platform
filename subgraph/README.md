# Reelverse18 Subgraph

The Graph subgraph for indexing Reelverse18 decentralized adult platform smart contract events.

## Quick Setup

1. Install dependencies:
```bash
npm install
```

2. Set environment variables:
```bash
# Windows
set GRAPH_ACCESS_TOKEN=your_access_token_here
set SUBGRAPH_NAME=reelverse18-subgraph

# Linux/Mac
export GRAPH_ACCESS_TOKEN=your_access_token_here
export SUBGRAPH_NAME=reelverse18-subgraph
```

3. Update contract addresses in `subgraph.yaml`

4. Deploy:
```bash
# Windows
scripts\deploy.bat

# Linux/Mac
./scripts/deploy.sh
```

## Indexed Contracts

- **CreatorRegistry**: Creator profiles and verification
- **ContentRegistry**: Content metadata and moderation
- **NFTAccess**: Entitlements and access tokens
- **RevenueSplitter**: Payment distributions
- **OrganizationRegistry**: Agency management

## Key Entities

- `Creator`: User profiles with verification status
- `Content`: Content items with metadata
- `Entitlement`: Access tokens and subscriptions
- `Organization`: Agency structures
- `RevenueSplit`: Payment distributions
- `PlatformStats`: Global platform metrics

## Testing

```bash
npm test
```