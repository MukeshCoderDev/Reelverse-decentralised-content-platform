@echo off
REM Reelverse18 Subgraph Deployment Script for Windows

echo 🚀 Deploying Reelverse18 Subgraph...

REM Check if required environment variables are set
if "%GRAPH_ACCESS_TOKEN%"=="" (
    echo ❌ Error: GRAPH_ACCESS_TOKEN environment variable is not set
    echo Please set your Graph Studio access token:
    echo set GRAPH_ACCESS_TOKEN=your_access_token_here
    exit /b 1
)

if "%SUBGRAPH_NAME%"=="" (
    echo ℹ️  SUBGRAPH_NAME not set, using default: reelverse18-subgraph
    set SUBGRAPH_NAME=reelverse18-subgraph
)

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Generate types
echo 🔧 Generating types...
npm run codegen

REM Build subgraph
echo 🏗️  Building subgraph...
npm run build

REM Deploy to Graph Studio
echo 🌐 Deploying to The Graph Studio...
graph auth --studio %GRAPH_ACCESS_TOKEN%
graph deploy --studio %SUBGRAPH_NAME%

echo ✅ Subgraph deployed successfully!
echo 📊 View your subgraph at: https://thegraph.com/studio/subgraph/%SUBGRAPH_NAME%