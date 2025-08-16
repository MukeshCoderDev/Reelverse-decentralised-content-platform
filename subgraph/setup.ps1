# PowerShell setup script for The Graph subgraph development
# This script sets up the development environment and creates necessary directories

Write-Host "🚀 Setting up The Graph subgraph development environment..." -ForegroundColor Green

# Create necessary directories
$directories = @("abis", "src", "config", "generated")
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force
        Write-Host "📁 Created directory: $dir" -ForegroundColor Blue
    }
}

# Check if Graph CLI is installed
Write-Host "🔍 Checking Graph CLI installation..." -ForegroundColor Blue
try {
    $graphVersion = graph --version 2>$null
    if ($graphVersion) {
        Write-Host "✅ Graph CLI is installed: $graphVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Graph CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g @graphprotocol/graph-cli
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Graph CLI installed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to install Graph CLI" -ForegroundColor Red
        exit 1
    }
}

# Install project dependencies
Write-Host "📦 Installing project dependencies..." -ForegroundColor Blue
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Create placeholder ABI files
Write-Host "📄 Creating placeholder ABI files..." -ForegroundColor Blue
$abiFiles = @(
    "CreatorRegistry.json",
    "ContentRegistry.json", 
    "NFTAccess.json",
    "RevenueSplitter.json",
    "OrganizationRegistry.json",
    "AgeVerifiedSBT.json"
)

foreach ($abiFile in $abiFiles) {
    $abiPath = "abis/$abiFile"
    if (-not (Test-Path $abiPath)) {
        @"
[
  {
    "anonymous": false,
    "inputs": [],
    "name": "PlaceholderEvent",
    "type": "event"
  }
]
"@ | Out-File -FilePath $abiPath -Encoding UTF8
        Write-Host "📄 Created placeholder ABI: $abiFile" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Replace placeholder contract addresses in config/polygon.json with actual deployed addresses" -ForegroundColor White
Write-Host "2. Replace placeholder ABI files in abis/ with actual contract ABIs" -ForegroundColor White
Write-Host "3. Set your Graph Protocol access token:" -ForegroundColor White
Write-Host "   `$env:GRAPH_ACCESS_TOKEN = 'your_access_token_here'" -ForegroundColor Yellow
Write-Host "4. Deploy the subgraph:" -ForegroundColor White
Write-Host "   .\deploy.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔗 Useful links:" -ForegroundColor Cyan
Write-Host "- The Graph Dashboard: https://thegraph.com/hosted-service/dashboard" -ForegroundColor White
Write-Host "- Graph CLI Docs: https://thegraph.com/docs/en/developer/graph-cli/" -ForegroundColor White
Write-Host "- Subgraph Development: https://thegraph.com/docs/en/developer/create-subgraph-hosted/" -ForegroundColor White