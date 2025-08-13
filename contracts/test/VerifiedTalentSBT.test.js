const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VerifiedTalentSBT", function () {
  let verifiedTalentSBT;
  let owner;
  let minter;
  let creator1;
  let creator2;
  let admin;

  beforeEach(async function () {
    [owner, minter, creator1, creator2, admin] = await ethers.getSigners();
    
    const VerifiedTalentSBT = await ethers.getContractFactory("VerifiedTalentSBT");
    verifiedTalentSBT = await VerifiedTalentSBT.deploy();
    await verifiedTalentSBT.waitForDeployment();

    // Grant roles
    const MINTER_ROLE = await verifiedTalentSBT.MINTER_ROLE();
    const ADMIN_ROLE = await verifiedTalentSBT.ADMIN_ROLE();
    
    await verifiedTalentSBT.grantRole(MINTER_ROLE, minter.address);
    await verifiedTalentSBT.grantRole(ADMIN_ROLE, admin.address);
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await verifiedTalentSBT.name()).to.equal("Reelverse Verified Talent");
      expect(await verifiedTalentSBT.symbol()).to.equal("REELTALENT");
    });

    it("Should grant admin roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await verifiedTalentSBT.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await verifiedTalentSBT.ADMIN_ROLE();
      const MINTER_ROLE = await verifiedTalentSBT.MINTER_ROLE();

      expect(await verifiedTalentSBT.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await verifiedTalentSBT.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await verifiedTalentSBT.hasRole(MINTER_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    const kycProvider = "persona";
    const kycHash = ethers.keccak256(ethers.toUtf8Bytes("kyc123"));
    const specializations = ["adult", "gaming"];

    it("Should mint talent verification SBT", async function () {
      await expect(verifiedTalentSBT.connect(minter).mintVerification(creator1.address, kycProvider, kycHash, specializations))
        .to.emit(verifiedTalentSBT, "TalentVerified")
        .withArgs(creator1.address, 1, kycProvider, 0, await time.latest() + 1); // 0 = VERIFIED tier

      expect(await verifiedTalentSBT.balanceOf(creator1.address)).to.equal(1);
      expect(await verifiedTalentSBT.ownerOf(1)).to.equal(creator1.address);
      expect(await verifiedTalentSBT.hasVerification(creator1.address)).to.be.true;
    });

    it("Should emit Locked event for soulbound token", async function () {
      await expect(verifiedTalentSBT.connect(minter).mintVerification(creator1.address, kycProvider, kycHash, specializations))
        .to.emit(verifiedTalentSBT, "Locked")
        .withArgs(1);
    });

    it("Should not allow minting to same creator twice", async function () {
      await verifiedTalentSBT.connect(minter).mintVerification(creator1.address, kycProvider, kycHash, specializations);
      
      await expect(verifiedTalentSBT.connect(minter).mintVerification(creator1.address, kycProvider, kycHash, specializations))
        .to.be.revertedWith("Creator already has talent verification");
    });

    it("Should validate input parameters", async function () {
      await expect(verifiedTalentSBT.connect(minter).mintVerification(ethers.ZeroAddress, kycProvider, kycHash, specializations))
        .to.be.revertedWith("Cannot mint to zero address");

      await expect(verifiedTalentSBT.connect(minter).mintVerification(creator1.address, "", kycHash, specializations))
        .to.be.revertedWith("KYC provider cannot be empty");

      await expect(verifiedTalentSBT.connect(minter).mintVerification(creator1.address, kycProvider, ethers.ZeroHash, specializations))
        .to.be.revertedWith("KYC hash cannot be empty");
    });
  });

  describe("Soulbound Properties", function () {
    const kycProvider = "persona";
    const kycHash = ethers.keccak256(ethers.toUtf8Bytes("kyc123"));
    const specializations = ["adult", "gaming"];

    beforeEach(async function () {
      await verifiedTalentSBT.connect(minter).mintVerification(creator1.address, kycProvider, kycHash, specializations);
    });

    it("Should be locked (soulbound)", async function () {
      expect(await verifiedTalentSBT.locked(1)).to.be.true;
    });

    it("Should not allow transfers", async function () {
      await expect(verifiedTalentSBT.connect(creator1).transferFrom(creator1.address, creator2.address, 1))
        .to.be.revertedWith("Soulbound tokens cannot be transferred");
    });
  });

  describe("Talent Tiers", function () {
    const kycProvider = "persona";
    const kycHash = ethers.keccak256(ethers.toUtf8Bytes("kyc123"));
    const specializations = ["adult", "gaming"];

    beforeEach(async function () {
      await verifiedTalentSBT.connect(minter).mintVerification(creator1.address, kycProvider, kycHash, specializations);
    });

    it("Should start with VERIFIED tier", async function () {
      const tier = await verifiedTalentSBT.getCreatorTier(creator1.address);
      expect(tier).to.equal(0); // VERIFIED = 0
    });

    it("Should auto-upgrade tier based on stats", async function () {
      // Update stats to trigger PREMIUM tier (100+ content, $10k+ earnings)
      const contentCount = 150;
      const totalEarnings = ethers.parseUnits("15000", 6); // $15k USDC

      await expect(verifiedTalentSBT.connect(minter).updateStats(creator1.address, contentCount, totalEarnings))
        .to.emit(verifiedTalentSBT, "TalentUpgraded")
        .withArgs(creator1.address, 1, 0, 1, await time.latest() + 1); // VERIFIED -> PREMIUM

      const tier = await verifiedTalentSBT.getCreatorTier(creator1.address);
      expect(tier).to.equal(1); // PREMIUM = 1
    });

    it("Should upgrade to ELITE tier with higher stats", async function () {
      // Update stats to trigger ELITE tier (500+ content, $50k+ earnings)
      const contentCount = 600;
      const totalEarnings = ethers.parseUnits("75000", 6); // $75k USDC

      await verifiedTalentSBT.connect(minter).updateStats(creator1.address, contentCount, totalEarnings);

      const tier = await verifiedTalentSBT.getCreatorTier(creator1.address);
      expect(tier).to.equal(2); // ELITE = 2
    });

    it("Should upgrade to LEGENDARY tier with highest stats", async function () {
      // Update stats to trigger LEGENDARY tier (1000+ content, $100k+ earnings)
      const contentCount = 1200;
      const totalEarnings = ethers.parseUnits("150000", 6); // $150k USDC

      await verifiedTalentSBT.connect(minter).updateStats(creator1.address, contentCount, totalEarnings);

      const tier = await verifiedTalentSBT.getCreatorTier(creator1.address);
      expect(tier).to.equal(3); // LEGENDARY = 3
    });

    it("Should allow admin to manually upgrade tier", async function () {
      await expect(verifiedTalentSBT.connect(admin).upgradeTier(creator1.address, 2)) // ELITE
        .to.emit(verifiedTalentSBT, "TalentUpgraded")
        .withArgs(creator1.address, 1, 0, 2, await time.latest() + 1);

      const tier = await verifiedTalentSBT.getCreatorTier(creator1.address);
      expect(tier).to.equal(2); // ELITE = 2
    });

    it("Should not allow downgrading tier", async function () {
      // First upgrade to PREMIUM
      await verifiedTalentSBT.connect(admin).upgradeTier(creator1.address, 1);
      
      // Try to downgrade back to VERIFIED
      await expect(verifiedTalentSBT.connect(admin).upgradeTier(creator1.address, 0))
        .to.be.revertedWith("Can only upgrade tier");
    });
  });

  describe("Statistics Tracking", function () {
    const kycProvider = "persona";
    const kycHash = ethers.keccak256(ethers.toUtf8Bytes("kyc123"));
    const specializations = ["adult", "gaming"];

    beforeEach(async function () {
      await verifiedTalentSBT.connect(minter).mintVerification(creator1.address, kycProvider, kycHash, specializations);
    });

    it("Should update creator statistics", async function () {
      const contentCount = 50;
      const totalEarnings = ethers.parseUnits("5000", 6); // $5k USDC

      await expect(verifiedTalentSBT.connect(minter).updateStats(creator1.address, contentCount, totalEarnings))
        .to.emit(verifiedTalentSBT, "StatsUpdated")
        .withArgs(creator1.address, 1, contentCount, totalEarnings, await time.latest() + 1);

      const talentData = await verifiedTalentSBT.getTalentData(1);
      expect(talentData.contentCount).to.equal(contentCount);
      expect(talentData.totalEarnings).to.equal(totalEarnings);
    });

    it("Should not allow updating stats for non-verified creator", async function () {
      await expect(verifiedTalentSBT.connect(minter).updateStats(creator2.address, 10, 1000))
        .to.be.revertedWith("Creator not verified");
    });
  });

  describe("Tier Statistics", function () {
    const kycProvider = "persona";
    const kycHash = ethers.keccak256(ethers.toUtf8Bytes("kyc123"));
    const specializations = ["adult", "gaming"];

    it("Should track tier counts correctly", async function () {
      // Initially no creators
      let [verified, premium, elite, legendary] = await verifiedTalentSBT.getTierStats();
      expect(verified).to.equal(0);
      expect(premium).to.equal(0);
      expect(elite).to.equal(0);
      expect(legendary).to.equal(0);

      // Add first creator (VERIFIED tier)
      await verifiedTalentSBT.connect(minter).mintVerification(creator1.address, kycProvider, kycHash, specializations);
      
      [verified, premium, elite, legendary] = await verifiedTalentSBT.getTierStats();
      expect(verified).to.equal(1);
      expect(premium).to.equal(0);

      // Upgrade to PREMIUM
      await verifiedTalentSBT.connect(minter).updateStats(creator1.address, 150, ethers.parseUnits("15000", 6));
      
      [verified, premium, elite, legendary] = await verifiedTalentSBT.getTierStats();
      expect(verified).to.equal(0);
      expect(premium).to.equal(1);
    });
  });

  describe("Talent Data", function () {
    const kycProvider = "persona";
    const kycHash = ethers.keccak256(ethers.toUtf8Bytes("kyc123"));
    const specializations = ["adult", "gaming"];

    beforeEach(async function () {
      await verifiedTalentSBT.connect(minter).mintVerification(creator1.address, kycProvider, kycHash, specializations);
    });

    it("Should store talent data correctly", async function () {
      const talentData = await verifiedTalentSBT.getTalentData(1);
      
      expect(talentData.kycProvider).to.equal(kycProvider);
      expect(talentData.kycHash).to.equal(kycHash);
      expect(talentData.tier).to.equal(0); // VERIFIED
      expect(talentData.contentCount).to.equal(0);
      expect(talentData.totalEarnings).to.equal(0);
      expect(talentData.revoked).to.be.false;
      expect(talentData.verifiedAt).to.be.greaterThan(0);
      expect(talentData.specializations).to.deep.equal(specializations);
    });

    it("Should return correct creator token ID", async function () {
      expect(await verifiedTalentSBT.getCreatorTokenId(creator1.address)).to.equal(1);
      expect(await verifiedTalentSBT.getCreatorTokenId(creator2.address)).to.equal(0);
    });
  });

  describe("Revocation", function () {
    const kycProvider = "persona";
    const kycHash = ethers.keccak256(ethers.toUtf8Bytes("kyc123"));
    const specializations = ["adult", "gaming"];
    const reason = "Fraudulent verification";

    beforeEach(async function () {
      await verifiedTalentSBT.connect(minter).mintVerification(creator1.address, kycProvider, kycHash, specializations);
    });

    it("Should allow admin to revoke verification", async function () {
      await expect(verifiedTalentSBT.connect(admin).revokeVerification(1, reason))
        .to.emit(verifiedTalentSBT, "TalentRevoked")
        .withArgs(creator1.address, 1, reason, await time.latest() + 1);

      expect(await verifiedTalentSBT.hasVerification(creator1.address)).to.be.false;
      
      const talentData = await verifiedTalentSBT.getTalentData(1);
      expect(talentData.revoked).to.be.true;
    });

    it("Should update tier counts on revocation", async function () {
      let [verified] = await verifiedTalentSBT.getTierStats();
      expect(verified).to.equal(1);

      await verifiedTalentSBT.connect(admin).revokeVerification(1, reason);

      [verified] = await verifiedTalentSBT.getTierStats();
      expect(verified).to.equal(0);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to pause contract", async function () {
      await verifiedTalentSBT.connect(admin).pause();
      expect(await verifiedTalentSBT.paused()).to.be.true;
    });

    it("Should allow emergency burn", async function () {
      const kycProvider = "persona";
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("kyc123"));
      const specializations = ["adult", "gaming"];
      
      await verifiedTalentSBT.connect(minter).mintVerification(creator1.address, kycProvider, kycHash, specializations);
      
      expect(await verifiedTalentSBT.balanceOf(creator1.address)).to.equal(1);
      
      await verifiedTalentSBT.connect(admin).emergencyBurn(1);
      
      expect(await verifiedTalentSBT.balanceOf(creator1.address)).to.equal(0);
      expect(await verifiedTalentSBT.hasVerification(creator1.address)).to.be.false;
    });
  });
});