#!/bin/bash

# Deployment script for The Graph subgraph
# Usage: ./deploy.sh [network] [subgraph-name]

set -e

NETWORK=${1:-polygon}
SUBGRAPH_NAME=${2:-"decentralized-adult-platform"}

echo "🚀 Deploying subgraph to $NETWORK network..."

# Check if required environment variables are set
if [ -z "$GRAPH_ACCESS_TOKEN" ]; then
    echo "❌ Error: GRAPH_ACCESS_TOKEN environment variable is not set"
    echo "Please set your Graph Protocol access token:"
    echo "export GRAPH_ACCESS_TOKEN=your_access_token_here"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Prepare network-specific configuration
echo "⚙️  Preparing configuration for $NETWORK..."
if [ -f "config/$NETWORK.json" ]; then
    npm run prepare:$NETWORK
else
    echo "❌ Error: Configuration file config/$NETWORK.json not found"
    exit 1
fi

# Generate code from schema
echo "🔧 Generating code..."
npm run codegen

# Build the subgraph
echo "🏗️  Building subgraph..."
npm run build

# Deploy to The Graph
echo "🌐 Deploying to The Graph..."
graph auth --product hosted-service $GRAPH_ACCESS_TOKEN

if [ "$NETWORK" = "local" ]; then
    # Deploy to local Graph node
    npm run create-local
    npm run deploy-local
else
    # Deploy to hosted service
    graph deploy --product hosted-service $SUBGRAPH_NAME
fi

echo "✅ Subgraph deployed successfully!"
echo "📊 You can query your subgraph at:"

if [ "$NETWORK" = "local" ]; then
    echo "   http://localhost:8000/subgraphs/name/$SUBGRAPH_NAME"
else
    echo "   https://api.thegraph.com/subgraphs/name/$SUBGRAPH_NAME"
fi

echo ""
echo "🔍 Example queries:"
echo ""
echo "# Get all creators"
echo "{"
echo "  creators {"
echo "    id"
echo "    walletAddress"
echo "    isVerified"
echo "    totalEarnings"
echo "    totalContent"
echo "  }"
echo "}"
echo ""
echo "# Get platform metrics"
echo "{"
echo "  platformMetrics(id: \"current\") {"
echo "    totalCreators"
echo "    totalContent"
echo "    totalRevenue"
echo "    uptimePercentage"
echo "    lastUpdated"
echo "  }"
echo "}"
echo ""
echo "# Get recent purchases"
echo "{"
echo "  purchases(first: 10, orderBy: timestamp, orderDirection: desc) {"
echo "    id"
echo "    buyer"
echo "    amount"
echo "    currency"
echo "    content {"
echo "      title"
echo "      creator {"
echo "        id"
echo "      }"
echo "    }"
echo "  }"
echo "}"