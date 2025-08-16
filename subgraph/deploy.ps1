# PowerShell deployment script for The Graph subgraph
# Usage: .\deploy.ps1 [network] [subgraph-name]

param(
    [string]$Network = "polygon",
    [string]$SubgraphName = "decentralized-adult-platform"
)

Write-Host "🚀 Deploying subgraph to $Network network..." -ForegroundColor Green

# Check if required environment variables are set
if (-not $env:GRAPH_ACCESS_TOKEN) {
    Write-Host "❌ Error: GRAPH_ACCESS_TOKEN environment variable is not set" -ForegroundColor Red
    Write-Host "Please set your Graph Protocol access token:" -ForegroundColor Yellow
    Write-Host "`$env:GRAPH_ACCESS_TOKEN = 'your_access_token_here'" -ForegroundColor Yellow
    exit 1
}

# Install dependencies if node_modules doesn't exist
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Prepare network-specific configuration
Write-Host "⚙️  Preparing configuration for $Network..." -ForegroundColor Blue
$configPath = "config/$Network.json"
if (Test-Path $configPath) {
    npm run "prepare:$Network"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to prepare configuration" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Error: Configuration file $configPath not found" -ForegroundColor Red
    exit 1
}

# Generate code from schema
Write-Host "🔧 Generating code..." -ForegroundColor Blue
npm run codegen
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate code" -ForegroundColor Red
    exit 1
}

# Build the subgraph
Write-Host "🏗️  Building subgraph..." -ForegroundColor Blue
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build subgraph" -ForegroundColor Red
    exit 1
}

# Deploy to The Graph
Write-Host "🌐 Deploying to The Graph..." -ForegroundColor Blue
graph auth --product hosted-service $env:GRAPH_ACCESS_TOKEN

if ($Network -eq "local") {
    # Deploy to local Graph node
    npm run create-local
    npm run deploy-local
} else {
    # Deploy to hosted service
    graph deploy --product hosted-service $SubgraphName
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Subgraph deployed successfully!" -ForegroundColor Green
    Write-Host "📊 You can query your subgraph at:" -ForegroundColor Cyan
    
    if ($Network -eq "local") {
        Write-Host "   http://localhost:8000/subgraphs/name/$SubgraphName" -ForegroundColor White
    } else {
        Write-Host "   https://api.thegraph.com/subgraphs/name/$SubgraphName" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "🔍 Example queries:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "# Get all creators" -ForegroundColor Gray
    Write-Host @"
{
  creators {
    id
    walletAddress
    isVerified
    totalEarnings
    totalContent
  }
}
"@ -ForegroundColor White
    
    Write-Host ""
    Write-Host "# Get platform metrics" -ForegroundColor Gray
    Write-Host @"
{
  platformMetrics(id: "current") {
    totalCreators
    totalContent
    totalRevenue
    uptimePercentage
    lastUpdated
  }
}
"@ -ForegroundColor White
    
    Write-Host ""
    Write-Host "# Get recent purchases" -ForegroundColor Gray
    Write-Host @"
{
  purchases(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    buyer
    amount
    currency
    content {
      title
      creator {
        id
      }
    }
  }
}
"@ -ForegroundColor White
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}