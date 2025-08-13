const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting Reelverse Smart Contract Deployment...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("📋 Deployment Configuration:");
  console.log("- Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("- Deployer:", deployer.address);
  console.log("- Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Contract deployment configuration
  const contracts = {};
  
  try {
    // 1. Deploy Mock USDC (for testing)
    if (network.chainId === 1337 || network.chainId === 80001) {
      console.log("📄 Deploying Mock USDC...");
      const MockUSDC = await ethers.getContractFactory("MockUSDC");
      const mockUSDC = await MockUSDC.deploy();
      await mockUSDC.waitForDeployment();
      contracts.USDC = await mockUSDC.getAddress();
      console.log("✅ Mock USDC deployed to:", contracts.USDC);
    } else {
      // Use real USDC address for mainnet/polygon
      contracts.USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // Polygon USDC
      console.log("📄 Using existing USDC:", contracts.USDC);
    }

    // 2. Deploy SBT Contracts
    console.log("\n📄 Deploying Soul Bound Tokens...");
    
    const AgeVerifiedSBT = await ethers.getContractFactory("AgeVerifiedSBT");
    const ageVerifiedSBT = await AgeVerifiedSBT.deploy();
    await ageVerifiedSBT.waitForDeployment();
    contracts.AgeVerifiedSBT = await ageVerifiedSBT.getAddress();
    console.log("✅ AgeVerifiedSBT deployed to:", contracts.AgeVerifiedSBT);

    const VerifiedTalentSBT = await ethers.getContractFactory("VerifiedTalentSBT");
    const verifiedTalentSBT = await VerifiedTalentSBT.deploy();
    await verifiedTalentSBT.waitForDeployment();
    contracts.VerifiedTalentSBT = await verifiedTalentSBT.getAddress();
    console.log("✅ VerifiedTalentSBT deployed to:", contracts.VerifiedTalentSBT);

    // 3. Deploy Core Registry Contracts
    console.log("\n📄 Deploying Core Registries...");
    
    const CreatorRegistry = await ethers.getContractFactory("CreatorRegistry");
    const creatorRegistry = await upgrades.deployProxy(
      CreatorRegistry,
      [contracts.AgeVerifiedSBT, contracts.VerifiedTalentSBT],
      { initializer: "initialize" }
    );
    await creatorRegistry.waitForDeployment();
    contracts.CreatorRegistry = await creatorRegistry.getAddress();
    console.log("✅ CreatorRegistry deployed to:", contracts.CreatorRegistry);

    const ContentRegistry = await ethers.getContractFactory("ContentRegistry");
    const contentRegistry = await upgrades.deployProxy(
      ContentRegistry,
      [contracts.CreatorRegistry],
      { initializer: "initialize" }
    );
    await contentRegistry.waitForDeployment();
    contracts.ContentRegistry = await contentRegistry.getAddress();
    console.log("✅ ContentRegistry deployed to:", contracts.ContentRegistry);

    // 4. Deploy Revenue Splitter
    console.log("\n📄 Deploying Revenue Management...");
    
    const RevenueSplitter = await ethers.getContractFactory("RevenueSplitter");
    const revenueSplitter = await RevenueSplitter.deploy();
    await revenueSplitter.waitForDeployment();
    contracts.RevenueSplitter = await revenueSplitter.getAddress();
    console.log("✅ RevenueSplitter deployed to:", contracts.RevenueSplitter);

    // 5. Deploy NFT Access
    console.log("\n📄 Deploying Access Management...");
    
    const NFTAccess = await ethers.getContractFactory("NFTAccess");
    const nftAccess = await upgrades.deployProxy(
      NFTAccess,
      [contracts.ContentRegistry, contracts.CreatorRegistry],
      { initializer: "initialize" }
    );
    await nftAccess.waitForDeployment();
    contracts.NFTAccess = await nftAccess.getAddress();
    console.log("✅ NFTAccess deployed to:", contracts.NFTAccess);

    // 6. Deploy Content Access Gate
    console.log("\n📄 Deploying Access Control...");
    
    const ContentAccessGate = await ethers.getContractFactory("ContentAccessGate");
    const contentAccessGate = await upgrades.deployProxy(
      ContentAccessGate,
      [
        contracts.CreatorRegistry,
        contracts.ContentRegistry,
        contracts.NFTAccess,
        contracts.AgeVerifiedSBT
      ],
      { initializer: "initialize" }
    );
    await contentAccessGate.waitForDeployment();
    contracts.ContentAccessGate = await contentAccessGate.getAddress();
    console.log("✅ ContentAccessGate deployed to:", contracts.ContentAccessGate);

    // 7. Deploy Upload Manager
    console.log("\n📄 Deploying Upload Management...");
    
    const UploadManager = await ethers.getContractFactory("UploadManager");
    const uploadManager = await upgrades.deployProxy(
      UploadManager,
      [contracts.ContentRegistry, contracts.CreatorRegistry],
      { initializer: "initialize" }
    );
    await uploadManager.waitForDeployment();
    contracts.UploadManager = await uploadManager.getAddress();
    console.log("✅ UploadManager deployed to:", contracts.UploadManager);

    // 8. Deploy Subscription Manager
    console.log("\n📄 Deploying Subscription Management...");
    
    const SubscriptionManager = await ethers.getContractFactory("SubscriptionManager");
    const subscriptionManager = await upgrades.deployProxy(
      SubscriptionManager,
      [contracts.NFTAccess, contracts.CreatorRegistry, contracts.USDC],
      { initializer: "initialize" }
    );
    await subscriptionManager.waitForDeployment();
    contracts.SubscriptionManager = await subscriptionManager.getAddress();
    console.log("✅ SubscriptionManager deployed to:", contracts.SubscriptionManager);

    // 9. Set up permissions and roles
    console.log("\n🔐 Setting up permissions...");
    
    // Grant minter role to relevant contracts
    const MINTER_ROLE = await ageVerifiedSBT.MINTER_ROLE();
    await ageVerifiedSBT.grantRole(MINTER_ROLE, contracts.CreatorRegistry);
    await verifiedTalentSBT.grantRole(MINTER_ROLE, contracts.CreatorRegistry);
    
    // Grant necessary roles to contracts
    const MODERATOR_ROLE = await contentRegistry.MODERATOR_ROLE();
    await contentRegistry.grantRole(MODERATOR_ROLE, deployer.address);
    
    const WORKER_ROLE = await uploadManager.WORKER_ROLE();
    await uploadManager.grantRole(WORKER_ROLE, deployer.address);
    
    console.log("✅ Permissions configured");

    // 10. Save deployment addresses
    const deploymentInfo = {
      network: {
        name: network.name,
        chainId: network.chainId.toString(),
      },
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: contracts,
      gasUsed: "TBD", // Could track this if needed
    };

    const deploymentPath = path.join(__dirname, `../deployments/${network.chainId}.json`);
    const deploymentDir = path.dirname(deploymentPath);
    
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    
    // Also create a .env file with addresses
    const envContent = Object.entries(contracts)
      .map(([name, address]) => `${name.toUpperCase()}_ADDRESS=${address}`)
      .join('\n');
    
    fs.writeFileSync(path.join(__dirname, "../.env.local"), envContent);

    console.log("\n🎉 Deployment Complete!");
    console.log("📁 Deployment info saved to:", deploymentPath);
    console.log("📁 Environment variables saved to: contracts/.env.local");
    
    console.log("\n📋 Contract Addresses:");
    Object.entries(contracts).forEach(([name, address]) => {
      console.log(`- ${name}: ${address}`);
    });

    console.log("\n🔗 Next Steps:");
    console.log("1. Update your frontend environment variables");
    console.log("2. Verify contracts on block explorer (if on testnet/mainnet)");
    console.log("3. Set up The Graph subgraph with these addresses");
    console.log("4. Configure backend services with contract addresses");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });