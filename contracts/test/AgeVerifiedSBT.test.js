const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgeVerifiedSBT", function () {
  let ageVerifiedSBT;
  let owner;
  let minter;
  let user1;
  let user2;
  let admin;

  beforeEach(async function () {
    [owner, minter, user1, user2, admin] = await ethers.getSigners();
    
    const AgeVerifiedSBT = await ethers.getContractFactory("AgeVerifiedSBT");
    ageVerifiedSBT = await AgeVerifiedSBT.deploy();
    await ageVerifiedSBT.waitForDeployment();

    // Grant roles
    const MINTER_ROLE = await ageVerifiedSBT.MINTER_ROLE();
    const ADMIN_ROLE = await ageVerifiedSBT.ADMIN_ROLE();
    
    await ageVerifiedSBT.grantRole(MINTER_ROLE, minter.address);
    await ageVerifiedSBT.grantRole(ADMIN_ROLE, admin.address);
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await ageVerifiedSBT.name()).to.equal("Reelverse Age Verified");
      expect(await ageVerifiedSBT.symbol()).to.equal("REELAGE");
    });

    it("Should grant admin roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await ageVerifiedSBT.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await ageVerifiedSBT.ADMIN_ROLE();
      const MINTER_ROLE = await ageVerifiedSBT.MINTER_ROLE();

      expect(await ageVerifiedSBT.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await ageVerifiedSBT.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await ageVerifiedSBT.hasRole(MINTER_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    const provider = "persona";
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof123"));

    it("Should mint age verification SBT", async function () {
      await expect(ageVerifiedSBT.connect(minter).mintVerification(user1.address, provider, proofHash))
        .to.emit(ageVerifiedSBT, "AgeVerified")
        .withArgs(user1.address, 1, provider, proofHash, await time.latest() + 1);

      expect(await ageVerifiedSBT.balanceOf(user1.address)).to.equal(1);
      expect(await ageVerifiedSBT.ownerOf(1)).to.equal(user1.address);
      expect(await ageVerifiedSBT.hasVerification(user1.address)).to.be.true;
    });

    it("Should emit Locked event for soulbound token", async function () {
      await expect(ageVerifiedSBT.connect(minter).mintVerification(user1.address, provider, proofHash))
        .to.emit(ageVerifiedSBT, "Locked")
        .withArgs(1);
    });

    it("Should not allow minting to same user twice", async function () {
      await ageVerifiedSBT.connect(minter).mintVerification(user1.address, provider, proofHash);
      
      await expect(ageVerifiedSBT.connect(minter).mintVerification(user1.address, provider, proofHash))
        .to.be.revertedWith("User already has age verification");
    });

    it("Should not allow non-minter to mint", async function () {
      await expect(ageVerifiedSBT.connect(user1).mintVerification(user2.address, provider, proofHash))
        .to.be.revertedWithCustomError(ageVerifiedSBT, "AccessControlUnauthorizedAccount");
    });

    it("Should validate input parameters", async function () {
      await expect(ageVerifiedSBT.connect(minter).mintVerification(ethers.ZeroAddress, provider, proofHash))
        .to.be.revertedWith("Cannot mint to zero address");

      await expect(ageVerifiedSBT.connect(minter).mintVerification(user1.address, "", proofHash))
        .to.be.revertedWith("Provider cannot be empty");

      await expect(ageVerifiedSBT.connect(minter).mintVerification(user1.address, provider, ethers.ZeroHash))
        .to.be.revertedWith("Proof hash cannot be empty");
    });
  });

  describe("Soulbound Properties", function () {
    const provider = "persona";
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof123"));

    beforeEach(async function () {
      await ageVerifiedSBT.connect(minter).mintVerification(user1.address, provider, proofHash);
    });

    it("Should be locked (soulbound)", async function () {
      expect(await ageVerifiedSBT.locked(1)).to.be.true;
    });

    it("Should not allow transfers", async function () {
      await expect(ageVerifiedSBT.connect(user1).transferFrom(user1.address, user2.address, 1))
        .to.be.revertedWith("Soulbound tokens cannot be transferred");
    });

    it("Should not allow safe transfers", async function () {
      await expect(ageVerifiedSBT.connect(user1)["safeTransferFrom(address,address,uint256)"](user1.address, user2.address, 1))
        .to.be.revertedWith("Soulbound tokens cannot be transferred");
    });

    it("Should not allow approvals", async function () {
      await expect(ageVerifiedSBT.connect(user1).approve(user2.address, 1))
        .to.be.revertedWith("Soulbound tokens cannot be transferred");
    });
  });

  describe("Verification Data", function () {
    const provider = "persona";
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof123"));

    beforeEach(async function () {
      await ageVerifiedSBT.connect(minter).mintVerification(user1.address, provider, proofHash);
    });

    it("Should store verification data correctly", async function () {
      const verificationData = await ageVerifiedSBT.getVerificationData(1);
      
      expect(verificationData.provider).to.equal(provider);
      expect(verificationData.proofHash).to.equal(proofHash);
      expect(verificationData.revoked).to.be.false;
      expect(verificationData.verifiedAt).to.be.greaterThan(0);
    });

    it("Should return correct user token ID", async function () {
      expect(await ageVerifiedSBT.getUserTokenId(user1.address)).to.equal(1);
      expect(await ageVerifiedSBT.getUserTokenId(user2.address)).to.equal(0);
    });

    it("Should track total verified count", async function () {
      expect(await ageVerifiedSBT.getTotalVerified()).to.equal(1);
      
      await ageVerifiedSBT.connect(minter).mintVerification(user2.address, provider, proofHash);
      expect(await ageVerifiedSBT.getTotalVerified()).to.equal(2);
    });
  });

  describe("Revocation", function () {
    const provider = "persona";
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof123"));
    const reason = "Fraudulent verification";

    beforeEach(async function () {
      await ageVerifiedSBT.connect(minter).mintVerification(user1.address, provider, proofHash);
    });

    it("Should allow admin to revoke verification", async function () {
      await expect(ageVerifiedSBT.connect(admin).revokeVerification(1, reason))
        .to.emit(ageVerifiedSBT, "VerificationRevoked")
        .withArgs(user1.address, 1, reason, await time.latest() + 1);

      expect(await ageVerifiedSBT.hasVerification(user1.address)).to.be.false;
      
      const verificationData = await ageVerifiedSBT.getVerificationData(1);
      expect(verificationData.revoked).to.be.true;
    });

    it("Should not allow non-admin to revoke", async function () {
      await expect(ageVerifiedSBT.connect(user1).revokeVerification(1, reason))
        .to.be.revertedWithCustomError(ageVerifiedSBT, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow revoking non-existent token", async function () {
      await expect(ageVerifiedSBT.connect(admin).revokeVerification(999, reason))
        .to.be.revertedWith("Token does not exist");
    });

    it("Should not allow revoking already revoked token", async function () {
      await ageVerifiedSBT.connect(admin).revokeVerification(1, reason);
      
      await expect(ageVerifiedSBT.connect(admin).revokeVerification(1, reason))
        .to.be.revertedWith("Already revoked");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to pause contract", async function () {
      await ageVerifiedSBT.connect(admin).pause();
      expect(await ageVerifiedSBT.paused()).to.be.true;
    });

    it("Should not allow minting when paused", async function () {
      await ageVerifiedSBT.connect(admin).pause();
      
      const provider = "persona";
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof123"));
      
      await expect(ageVerifiedSBT.connect(minter).mintVerification(user1.address, provider, proofHash))
        .to.be.revertedWithCustomError(ageVerifiedSBT, "EnforcedPause");
    });

    it("Should allow admin to set base URI", async function () {
      const baseURI = "https://api.reelverse.com/age-verified/";
      await ageVerifiedSBT.connect(admin).setBaseURI(baseURI);
      
      // Mint a token to test URI
      const provider = "persona";
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof123"));
      await ageVerifiedSBT.connect(minter).mintVerification(user1.address, provider, proofHash);
      
      expect(await ageVerifiedSBT.tokenURI(1)).to.equal(baseURI + "1");
    });

    it("Should allow emergency burn", async function () {
      const provider = "persona";
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof123"));
      await ageVerifiedSBT.connect(minter).mintVerification(user1.address, provider, proofHash);
      
      expect(await ageVerifiedSBT.balanceOf(user1.address)).to.equal(1);
      
      await ageVerifiedSBT.connect(admin).emergencyBurn(1);
      
      expect(await ageVerifiedSBT.balanceOf(user1.address)).to.equal(0);
      expect(await ageVerifiedSBT.hasVerification(user1.address)).to.be.false;
    });
  });

  describe("ERC-5192 Compliance", function () {
    const provider = "persona";
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof123"));

    it("Should support ERC-5192 interface", async function () {
      // ERC-5192 interface ID: 0xb45a3c0e
      const ERC5192_INTERFACE_ID = "0xb45a3c0e";
      expect(await ageVerifiedSBT.supportsInterface(ERC5192_INTERFACE_ID)).to.be.true;
    });

    it("Should emit Locked event on mint", async function () {
      await expect(ageVerifiedSBT.connect(minter).mintVerification(user1.address, provider, proofHash))
        .to.emit(ageVerifiedSBT, "Locked")
        .withArgs(1);
    });
  });
});