#!/usr/bin/env node

/**
 * Script to update subgraph.yaml with deployed contract addresses
 * Usage: node scripts/update-config.js --network polygon --config config/polygon.json
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function updateSubgraphConfig(networkConfig) {
  const subgraphPath = path.join(__dirname, '..', 'subgraph.yaml');
  
  try {
    // Read current subgraph.yaml
    const subgraphContent = fs.readFileSync(subgraphPath, 'utf8');
    const subgraph = yaml.load(subgraphContent);
    
    // Update each data source with new addresses and start blocks
    subgraph.dataSources.forEach(dataSource => {
      const contractName = dataSource.name;
      const contractConfig = networkConfig.contracts[contractName];
      
      if (contractConfig) {
        dataSource.source.address = contractConfig.address;
        dataSource.source.startBlock = contractConfig.startBlock;
        dataSource.network = networkConfig.network;
        
        console.log(`✅ Updated ${contractName}:`);
        console.log(`   Address: ${contractConfig.address}`);
        console.log(`   Start Block: ${contractConfig.startBlock}`);
      } else {
        console.log(`⚠️  No config found for ${contractName}`);
      }
    });
    
    // Write updated subgraph.yaml
    const updatedYaml = yaml.dump(subgraph, {
      lineWidth: -1,
      noRefs: true,
      quotingType: '"'
    });
    
    fs.writeFileSync(subgraphPath, updatedYaml);
    console.log('\n🎉 subgraph.yaml updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating subgraph config:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const networkIndex = args.indexOf('--network');
const configIndex = args.indexOf('--config');

if (networkIndex === -1 || configIndex === -1) {
  console.log('Usage: node scripts/update-config.js --network <network> --config <config-file>');
  console.log('Example: node scripts/update-config.js --network polygon --config config/polygon.json');
  process.exit(1);
}

const network = args[networkIndex + 1];
const configFile = args[configIndex + 1];

if (!network || !configFile) {
  console.error('❌ Missing network or config file argument');
  process.exit(1);
}

// Read network configuration
const configPath = path.join(__dirname, '..', configFile);

if (!fs.existsSync(configPath)) {
  console.error(`❌ Config file not found: ${configPath}`);
  process.exit(1);
}

try {
  const networkConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log(`🔧 Updating subgraph config for ${network} network...\n`);
  updateSubgraphConfig(networkConfig);
} catch (error) {
  console.error('❌ Error reading config file:', error.message);
  process.exit(1);
}