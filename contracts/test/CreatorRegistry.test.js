const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("CreatorRegistry", function () {
  let creatorRegistry;
  let ageVerifiedSBT;
  let verifiedTalentSBT;
  let owner;
  let admin;
  let verifier;
  let statsUpdater;
  let creator1;
  let creator2;
  let creator3;

  beforeEach(async function () {
    [owner, admin, verifier, statsUpdater, creator1, creator2, creator3] = await ethers.getSigners();
    
    // Deploy SBT contracts
    const AgeVerifiedSBT = await ethers.getContractFactory("AgeVerifiedSBT");
    ageVerifiedSBT = await AgeVerifiedSBT.deploy();
    await ageVerifiedSBT.waitForDeployment();

    const VerifiedTalentSBT = await ethers.getContractFactory("VerifiedTalentSBT");
    verifiedTalentSBT = await VerifiedTalentSBT.deploy();
    await verifiedTalentSBT.waitForDeployment();

    // Deploy CreatorRegistry as upgradeable proxy
    const CreatorRegistry = await ethers.getContractFactory("CreatorRegistry");
    creatorRegistry = await upgrades.deployProxy(
      CreatorRegistry,
      [await ageVerifiedSBT.getAddress(), await verifiedTalentSBT.getAddress()],
      { initializer: "initialize" }
    );
    await creatorRegistry.waitForDeployment();

    // Grant roles
    const ADMIN_ROLE = await creatorRegistry.ADMIN_ROLE();
    const VERIFIER_ROLE = await creatorRegistry.VERIFIER_ROLE();
    const STATS_UPDATER_ROLE = await creatorRegistry.STATS_UPDATER_ROLE();
    const MINTER_ROLE = await ageVerifiedSBT.MINTER_ROLE();

    await creatorRegistry.grantRole(ADMIN_ROLE, admin.address);
    await creatorRegistry.grantRole(VERIFIER_ROLE, verifier.address);
    await creatorRegistry.grantRole(STATS_UPDATER_ROLE, statsUpdater.address);
    
    // Grant minter roles to registry for SBTs
    await ageVerifiedSBT.grantRole(MINTER_ROLE, await creatorRegistry.getAddress());
    await verifiedTalentSBT.grantRole(MINTER_ROLE, await creatorRegistry.getAddress());
  });

  describe("Deployment", function () {
    it("Should initialize with correct SBT addresses", async function () {
      expect(await creatorRegistry.ageVerifiedSBT()).to.equal(await ageVerifiedSBT.getAddress());
      expect(await creatorRegistry.verifiedTalentSBT()).to.equal(await verifiedTalentSBT.getAddress());
    });

    it("Should grant admin roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await creatorRegistry.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await creatorRegistry.ADMIN_ROLE();
      const VERIFIER_ROLE = await creatorRegistry.VERIFIER_ROLE();
      const STATS_UPDATER_ROLE = await creatorRegistry.STATS_UPDATER_ROLE();

      expect(await creatorRegistry.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await creatorRegistry.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await creatorRegistry.hasRole(VERIFIER_ROLE, owner.address)).to.be.true;
      expect(await creatorRegistry.hasRole(STATS_UPDATER_ROLE, owner.address)).to.be.true;
    });

    it("Should have correct initial statistics", async function () {
      expect(await creatorRegistry.totalCreators()).to.equal(0);
      expect(await creatorRegistry.totalVerifiedCreators()).to.equal(0);
      expect(await creatorRegistry.totalAgeVerifiedCreators()).to.equal(0);
    });
  });

  describe("Creator Registration", function () {
    it("Should allow creator to register themselves", async function () {
      await expect(creatorRegistry.connect(creator1).registerCreator(creator1.address))
        .to.emit(creatorRegistry, "CreatorRegistered")
        .withArgs(creator1.address, await time.latest() + 1);

      expect(await creatorRegistry.isRegistered(creator1.address)).to.be.true;
      expect(await creatorRegistry.totalCreators()).to.equal(1);

      const creatorData = await creatorRegistry.getCreator(creator1.address);
      expect(creatorData.wallet).to.equal(creator1.address);
      expect(creatorData.ageVerified).to.be.false;
      expect(creatorData.talentVerified).to.be.false;
      expect(creatorData.totalEarnings).to.equal(0);
      expect(creatorData.contentCount).to.equal(0);
    });

    it("Should allow admin to register creator", async function () {
      await expect(creatorRegistry.connect(admin).registerCreator(creator1.address))
        .to.emit(creatorRegistry, "CreatorRegistered");

      expect(await creatorRegistry.isRegistered(creator1.address)).to.be.true;
    });

    it("Should not allow duplicate registration", async function () {
      await creatorRegistry.connect(creator1).registerCreator(creator1.address);
      
      await expect(creatorRegistry.connect(creator1).registerCreator(creator1.address))
        .to.be.revertedWith("Creator already registered");
    });

    it("Should not allow unauthorized registration", async function () {
      await expect(creatorRegistry.connect(creator2).registerCreator(creator1.address))
        .to.be.revertedWith("Unauthorized registration");
    });

    it("Should validate creator address", async function () {
      await expect(creatorRegistry.connect(creator1).registerCreator(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid creator address");
    });
  });

  describe("Verification Status", function () {
    beforeEach(async function () {
      await creatorRegistry.connect(creator1).registerCreator(creator1.address);
    });

    it("Should update verification status when SBTs are minted", async function () {
      // Initially not verified
      expect(await creatorRegistry.isVerified(creator1.address, 0)).to.be.false; // age
      expect(await creatorRegistry.isVerified(creator1.address, 1)).to.be.false; // talent

      // Mint age verification SBT
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof123"));
      await ageVerifiedSBT.mintVerification(creator1.address, "persona", proofHash);

      // Update verification status
      await expect(creatorRegistry.connect(verifier).setVerificationStatus(creator1.address, true, false))
        .to.emit(creatorRegistry, "VerificationStatusUpdated")
        .withArgs(creator1.address, true, false, await time.latest() + 1);

      expect(await creatorRegistry.isVerified(creator1.address, 0)).to.be.true; // age
      expect(await creatorRegistry.totalAgeVerifiedCreators()).to.equal(1);
    });

    it("Should require SBT ownership for verification", async function () {
      // Try to set verification without SBT
      await creatorRegistry.connect(verifier).setVerificationStatus(creator1.address, true, false);
      
      // Should still be false because no SBT
      expect(await creatorRegistry.isVerified(creator1.address, 0)).to.be.false;
    });

    it("Should track fully verified creators", async function () {
      // Mint both SBTs
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof123"));
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("kyc123"));
      
      await ageVerifiedSBT.mintVerification(creator1.address, "persona", proofHash);
      await verifiedTalentSBT.mintVerification(creator1.address, "persona", kycHash, ["adult"]);

      // Set verification status
      await creatorRegistry.connect(verifier).setVerificationStatus(creator1.address, true, true);

      expect(await creatorRegistry.totalVerifiedCreators()).to.equal(1);
      expect(await creatorRegistry.totalAgeVerifiedCreators()).to.equal(1);
    });

    it("Should not allow non-verifier to update status", async function () {
      await expect(creatorRegistry.connect(creator1).setVerificationStatus(creator1.address, true, false))
        .to.be.revertedWithCustomError(creatorRegistry, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Statistics Management", function () {
    beforeEach(async function () {
      await creatorRegistry.connect(creator1).registerCreator(creator1.address);
    });

    it("Should add earnings to creator", async function () {
      const earnings = ethers.parseUnits("1000", 6); // 1000 USDC

      await expect(creatorRegistry.connect(statsUpdater).addEarnings(creator1.address, earnings))
        .to.emit(creatorRegistry, "EarningsUpdated")
        .withArgs(creator1.address, earnings, earnings, await time.latest() + 1);

      const creatorData = await creatorRegistry.getCreator(creator1.address);
      expect(creatorData.totalEarnings).to.equal(earnings);
    });

    it("Should increment content count", async function () {
      await creatorRegistry.connect(statsUpdater).incrementContentCount(creator1.address);

      const creatorData = await creatorRegistry.getCreator(creator1.address);
      expect(creatorData.contentCount).to.equal(1);
    });

    it("Should add creator content", async function () {
      const contentId = 123;
      
      await creatorRegistry.connect(statsUpdater).addCreatorContent(creator1.address, contentId);

      const contentList = await creatorRegistry.getCreatorContent(creator1.address);
      expect(contentList).to.deep.equal([BigInt(contentId)]);

      const creatorData = await creatorRegistry.getCreator(creator1.address);
      expect(creatorData.contentCount).to.equal(1);
    });

    it("Should update talent SBT stats when creator has verification", async function () {
      // First mint talent SBT and set verification
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("kyc123"));
      await verifiedTalentSBT.mintVerification(creator1.address, "persona", kycHash, ["adult"]);
      await creatorRegistry.connect(verifier).setVerificationStatus(creator1.address, false, true);

      // Add earnings - should trigger talent SBT update
      const earnings = ethers.parseUnits("1000", 6);
      await creatorRegistry.connect(statsUpdater).addEarnings(creator1.address, earnings);

      // Check that talent SBT was updated
      const talentData = await verifiedTalentSBT.getTalentData(1);
      expect(talentData.totalEarnings).to.equal(earnings);
    });

    it("Should validate earnings amount", async function () {
      await expect(creatorRegistry.connect(statsUpdater).addEarnings(creator1.address, 0))
        .to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should not allow non-stats-updater to modify stats", async function () {
      await expect(creatorRegistry.connect(creator1).addEarnings(creator1.address, 1000))
        .to.be.revertedWithCustomError(creatorRegistry, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Creator Queries", function () {
    beforeEach(async function () {
      // Register multiple creators
      await creatorRegistry.connect(creator1).registerCreator(creator1.address);
      await creatorRegistry.connect(creator2).registerCreator(creator2.address);
      await creatorRegistry.connect(creator3).registerCreator(creator3.address);
    });

    it("Should get paginated creator list", async function () {
      const [creators, total] = await creatorRegistry.getCreators(0, 2);
      
      expect(total).to.equal(3);
      expect(creators.length).to.equal(2);
      expect(creators[0]).to.equal(creator1.address);
      expect(creators[1]).to.equal(creator2.address);
    });

    it("Should handle pagination edge cases", async function () {
      // Offset beyond total
      const [creators1, total1] = await creatorRegistry.getCreators(10, 5);
      expect(creators1.length).to.equal(0);
      expect(total1).to.equal(3);

      // Limit beyond remaining
      const [creators2, total2] = await creatorRegistry.getCreators(2, 5);
      expect(creators2.length).to.equal(1);
      expect(creators2[0]).to.equal(creator3.address);
    });

    it("Should get verified creators only", async function () {
      // Verify creator1 only
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof123"));
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("kyc123"));
      
      await ageVerifiedSBT.mintVerification(creator1.address, "persona", proofHash);
      await verifiedTalentSBT.mintVerification(creator1.address, "persona", kycHash, ["adult"]);
      await creatorRegistry.connect(verifier).setVerificationStatus(creator1.address, true, true);

      const [verifiedCreators, total] = await creatorRegistry.getVerifiedCreators(0, 10);
      
      expect(total).to.equal(1);
      expect(verifiedCreators.length).to.equal(1);
      expect(verifiedCreators[0]).to.equal(creator1.address);
    });

    it("Should get platform statistics", async function () {
      // Add some earnings
      await creatorRegistry.connect(statsUpdater).addEarnings(creator1.address, ethers.parseUnits("1000", 6));
      await creatorRegistry.connect(statsUpdater).addEarnings(creator2.address, ethers.parseUnits("500", 6));

      const [totalCreators, totalVerified, totalAgeVerified, totalEarnings] = await creatorRegistry.getPlatformStats();
      
      expect(totalCreators).to.equal(3);
      expect(totalVerified).to.equal(0); // None fully verified
      expect(totalAgeVerified).to.equal(0);
      expect(totalEarnings).to.equal(ethers.parseUnits("1500", 6));
    });
  });

  describe("Profile Management", function () {
    beforeEach(async function () {
      await creatorRegistry.connect(creator1).registerCreator(creator1.address);
    });

    it("Should allow creator to update profile", async function () {
      const profileURI = "ipfs://QmProfile123";
      
      await expect(creatorRegistry.connect(creator1).updateCreatorProfile(creator1.address, profileURI))
        .to.emit(creatorRegistry, "CreatorProfileUpdated")
        .withArgs(creator1.address, profileURI, await time.latest() + 1);
    });

    it("Should allow admin to update creator profile", async function () {
      const profileURI = "ipfs://QmProfile123";
      
      await expect(creatorRegistry.connect(admin).updateCreatorProfile(creator1.address, profileURI))
        .to.emit(creatorRegistry, "CreatorProfileUpdated");
    });

    it("Should not allow unauthorized profile updates", async function () {
      await expect(creatorRegistry.connect(creator2).updateCreatorProfile(creator1.address, "ipfs://test"))
        .to.be.revertedWith("Unauthorized");
    });

    it("Should validate profile URI", async function () {
      await expect(creatorRegistry.connect(creator1).updateCreatorProfile(creator1.address, ""))
        .to.be.revertedWith("Profile URI cannot be empty");
    });

    it("Should set creator status", async function () {
      await expect(creatorRegistry.connect(creator1).setCreatorStatus(creator1.address, false))
        .to.emit(creatorRegistry, "CreatorStatusChanged")
        .withArgs(creator1.address, false, await time.latest() + 1);
    });
  });

  describe("Admin Functions", function () {
    beforeEach(async function () {
      await creatorRegistry.connect(creator1).registerCreator(creator1.address);
    });

    it("Should allow admin to sync verification status", async function () {
      // Mint SBT directly
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof123"));
      await ageVerifiedSBT.mintVerification(creator1.address, "persona", proofHash);

      // Sync verification status
      await expect(creatorRegistry.connect(admin).syncVerificationStatus(creator1.address))
        .to.emit(creatorRegistry, "VerificationStatusUpdated")
        .withArgs(creator1.address, true, false, await time.latest() + 1);

      expect(await creatorRegistry.isVerified(creator1.address, 0)).to.be.true;
    });

    it("Should allow admin to pause contract", async function () {
      await creatorRegistry.connect(admin).pause();
      expect(await creatorRegistry.paused()).to.be.true;

      await expect(creatorRegistry.connect(creator2).registerCreator(creator2.address))
        .to.be.revertedWithCustomError(creatorRegistry, "EnforcedPause");
    });

    it("Should allow admin to update SBT contracts", async function () {
      // Deploy new SBT contracts
      const AgeVerifiedSBT = await ethers.getContractFactory("AgeVerifiedSBT");
      const newAgeSBT = await AgeVerifiedSBT.deploy();
      await newAgeSBT.waitForDeployment();

      const VerifiedTalentSBT = await ethers.getContractFactory("VerifiedTalentSBT");
      const newTalentSBT = await VerifiedTalentSBT.deploy();
      await newTalentSBT.waitForDeployment();

      await creatorRegistry.connect(admin).updateSBTContracts(
        await newAgeSBT.getAddress(),
        await newTalentSBT.getAddress()
      );

      expect(await creatorRegistry.ageVerifiedSBT()).to.equal(await newAgeSBT.getAddress());
      expect(await creatorRegistry.verifiedTalentSBT()).to.equal(await newTalentSBT.getAddress());
    });

    it("Should validate SBT contract addresses", async function () {
      await expect(creatorRegistry.connect(admin).updateSBTContracts(ethers.ZeroAddress, await verifiedTalentSBT.getAddress()))
        .to.be.revertedWith("Invalid age SBT address");
    });
  });

  describe("Activity Tracking", function () {
    beforeEach(async function () {
      await creatorRegistry.connect(creator1).registerCreator(creator1.address);
    });

    it("Should track last activity time", async function () {
      const initialTime = await creatorRegistry.getLastActivityTime(creator1.address);
      expect(initialTime).to.be.greaterThan(0);

      // Add earnings should update activity time
      await creatorRegistry.connect(statsUpdater).addEarnings(creator1.address, ethers.parseUnits("100", 6));
      
      const updatedTime = await creatorRegistry.getLastActivityTime(creator1.address);
      expect(updatedTime).to.be.greaterThan(initialTime);
    });
  });

  describe("Version", function () {
    it("Should return correct version", async function () {
      expect(await creatorRegistry.version()).to.equal("1.0.0");
    });
  });
});