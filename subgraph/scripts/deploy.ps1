# Reelverse18 Subgraph Deployment Script for Windows

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying Reelverse18 Subgraph..." -ForegroundColor Green

# Check if required environment variables are set
if (-not $env:GRAPH_ACCESS_TOKEN) {
    Write-Host "❌ Error: GRAPH_ACCESS_TOKEN environment variable is not set" -ForegroundColor Red
    Write-Host "Please set your Graph Studio access token:" -ForegroundColor Yellow
    Write-Host "`$env:GRAPH_ACCESS_TOKEN = 'your_access_token_here'" -ForegroundColor Yellow
    exit 1
}

if (-not $env:SUBGRAPH_NAME) {
    Write-Host "ℹ️  SUBGRAPH_NAME not set, using default: reelverse18-subgraph" -ForegroundColor Blue
    $env:SUBGRAPH_NAME = "reelverse18-subgraph"
}

# Change to subgraph directory
Set-Location subgraph

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
npm install

# Generate types
Write-Host "🔧 Generating types..." -ForegroundColor Blue
npm run codegen

# Build subgraph
Write-Host "🏗️  Building subgraph..." -ForegroundColor Blue
npm run build

# Deploy to Graph Studio
Write-Host "🌐 Deploying to The Graph Studio..." -ForegroundColor Blue
npx graph auth --studio $env:GRAPH_ACCESS_TOKEN
npx graph deploy --studio $env:SUBGRAPH_NAME

Write-Host "✅ Subgraph deployed successfully!" -ForegroundColor Green
Write-Host "📊 View your subgraph at: https://thegraph.com/studio/subgraph/$($env:SUBGRAPH_NAME)" -ForegroundColor Cyan