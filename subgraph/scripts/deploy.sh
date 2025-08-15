@echo off
REM Reelverse18 Subgraph Deployment Script for Windows

echo "🚀 Deploying Reelverse18 Subgraph..."

# Check if required environment variables are set
if [ -z "$GRAPH_ACCESS_TOKEN" ]; then
    echo "❌ Error: GRAPH_ACCESS_TOKEN environment variable is not set"
    echo "Please set your Graph Studio access token:"
    echo "export GRAPH_ACCESS_TOKEN=your_access_token_here"
    exit 1
fi

if [ -z "$SUBGRAPH_NAME" ]; then
    echo "ℹ️  SUBGRAPH_NAME not set, using default: reelverse18-subgraph"
    SUBGRAPH_NAME="reelverse18-subgraph"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate types
echo "🔧 Generating types..."
npm run codegen

# Build subgraph
echo "🏗️  Building subgraph..."
npm run build

# Deploy to Graph Studio
echo "🌐 Deploying to The Graph Studio..."
graph auth --studio $GRAPH_ACCESS_TOKEN
graph deploy --studio $SUBGRAPH_NAME

echo "✅ Subgraph deployed successfully!"
echo "📊 View your subgraph at: https://thegraph.com/studio/subgraph/$SUBGRAPH_NAME"