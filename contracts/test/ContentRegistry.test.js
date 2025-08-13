const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("ContentRegistry", function () {
  let contentRegistry;
  let creatorRegistry;
  let ageVerifiedSBT;
  let verifiedTalentSBT;
  let owner;
  let admin;
  let moderator;
  let publisher;
  let creator1;
  let creator2;
  let user1;

  beforeEach(async function () {
    [owner, admin, moderator, publisher, creator1, creator2, user1] = await ethers.getSigners();
    
    // Deploy SBT contracts
    const AgeVerifiedSBT = await ethers.getContractFactory("AgeVerifiedSBT");
    ageVerifiedSBT = await AgeVerifiedSBT.deploy();
    await ageVerifiedSBT.waitForDeployment();

    const VerifiedTalentSBT = await ethers.getContractFactory("VerifiedTalentSBT");
    verifiedTalentSBT = await VerifiedTalentSBT.deploy();
    await verifiedTalentSBT.waitForDeployment();

    // Deploy CreatorRegistry
    const CreatorRegistry = await ethers.getContractFactory("CreatorRegistry");
    creatorRegistry = await upgrades.deployProxy(
      CreatorRegistry,
      [await ageVerifiedSBT.getAddress(), await verifiedTalentSBT.getAddress()],
      { initializer: "initialize" }
    );
    await creatorRegistry.waitForDeployment();

    // Deploy ContentRegistry
    const ContentRegistry = await ethers.getContractFactory("ContentRegistry");
    contentRegistry = await upgrades.deployProxy(
      ContentRegistry,
      [await creatorRegistry.getAddress()],
      { initializer: "initialize" }
    );
    await contentRegistry.waitForDeployment();

    // Grant roles
    const ADMIN_ROLE = await contentRegistry.ADMIN_ROLE();
    const MODERATOR_ROLE = await contentRegistry.MODERATOR_ROLE();
    const PUBLISHER_ROLE = await contentRegistry.PUBLISHER_ROLE();
    const STATS_UPDATER_ROLE = await creatorRegistry.STATS_UPDATER_ROLE();

    await contentRegistry.grantRole(ADMIN_ROLE, admin.address);
    await contentRegistry.grantRole(MODERATOR_ROLE, moderator.address);
    await contentRegistry.grantRole(PUBLISHER_ROLE, publisher.address);
    await contentRegistry.grantRole(PUBLISHER_ROLE, creator1.address);
    await contentRegistry.grantRole(PUBLISHER_ROLE, creator2.address);
    
    // Grant content registry permission to update creator stats
    await creatorRegistry.grantRole(STATS_UPDATER_ROLE, await contentRegistry.getAddress());

    // Register creators
    await creatorRegistry.connect(creator1).registerCreator(creator1.address);
    await creatorRegistry.connect(creator2).registerCreator(creator2.address);
  });

  describe("Deployment", function () {
    it("Should initialize with correct creator registry", async function () {
      expect(await contentRegistry.creatorRegistry()).to.equal(await creatorRegistry.getAddress());
    });

    it("Should grant admin roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await contentRegistry.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await contentRegistry.ADMIN_ROLE();
      const MODERATOR_ROLE = await contentRegistry.MODERATOR_ROLE();
      const PUBLISHER_ROLE = await contentRegistry.PUBLISHER_ROLE();

      expect(await contentRegistry.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await contentRegistry.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await contentRegistry.hasRole(MODERATOR_ROLE, owner.address)).to.be.true;
      expect(await contentRegistry.hasRole(PUBLISHER_ROLE, owner.address)).to.be.true;
    });

    it("Should have correct initial statistics", async function () {
      expect(await contentRegistry.totalContent()).to.equal(0);
      expect(await contentRegistry.totalApprovedContent()).to.equal(0);
      expect(await contentRegistry.totalFlaggedContent()).to.equal(0);
    });
  });

  describe("Content Registration", function () {
    const metaURI = "ipfs://QmContent123";
    const pHash = ethers.keccak256(ethers.toUtf8Bytes("content123"));
    const priceUSDC = ethers.parseUnits("10", 6); // $10 USDC
    const storageClass = 0; // Shreddable
    const splitter = "0x1234567890123456789012345678901234567890";
    const geoMask = 0xFFFFFFFF; // Global availability

    it("Should register content successfully", async function () {
      await expect(contentRegistry.connect(creator1).registerContent(
        metaURI, pHash, priceUSDC, storageClass, splitter, geoMask
      ))
        .to.emit(contentRegistry, "ContentRegistered")
        .withArgs(1, creator1.address, splitter, priceUSDC, storageClass, await time.latest() + 1);

      expect(await contentRegistry.totalContent()).to.equal(1);
      expect(await contentRegistry.exists(1)).to.be.true;

      const content = await contentRegistry.getContent(1);
      expect(content.creator).to.equal(creator1.address);
      expect(content.metaURI).to.equal(metaURI);
      expect(content.perceptualHash).to.equal(pHash);
      expect(content.priceUSDC).to.equal(priceUSDC);
      expect(content.storageClass).to.equal(storageClass);
      expect(content.splitter).to.equal(splitter);
      expect(content.geoMask).to.equal(geoMask);
      expect(content.moderationStatus).to.equal(0); // Pending
    });

    it("Should update creator content count in registry", async function () {
      await contentRegistry.connect(creator1).registerContent(
        metaURI, pHash, priceUSDC, storageClass, splitter, geoMask
      );

      const creatorData = await creatorRegistry.getCreator(creator1.address);
      expect(creatorData.contentCount).to.equal(1);
    });

    it("Should not allow duplicate perceptual hashes", async function () {
      await contentRegistry.connect(creator1).registerContent(
        metaURI, pHash, priceUSDC, storageClass, splitter, geoMask
      );

      await expect(contentRegistry.connect(creator2).registerContent(
        "ipfs://QmContent456", pHash, priceUSDC, storageClass, splitter, geoMask
      )).to.be.revertedWith("Content with this hash already exists");
    });

    it("Should validate input parameters", async function () {
      await expect(contentRegistry.connect(creator1).registerContent(
        "", pHash, priceUSDC, storageClass, splitter, geoMask
      )).to.be.revertedWith("Meta URI cannot be empty");

      await expect(contentRegistry.connect(creator1).registerContent(
        metaURI, ethers.ZeroHash, priceUSDC, storageClass, splitter, geoMask
      )).to.be.revertedWith("Perceptual hash cannot be empty");

      await expect(contentRegistry.connect(creator1).registerContent(
        metaURI, pHash, priceUSDC, 2, splitter, geoMask
      )).to.be.revertedWith("Invalid storage class");

      await expect(contentRegistry.connect(creator1).registerContent(
        metaURI, pHash, priceUSDC, storageClass, ethers.ZeroAddress, geoMask
      )).to.be.revertedWith("Invalid splitter address");
    });

    it("Should require publisher role", async function () {
      await expect(contentRegistry.connect(user1).registerContent(
        metaURI, pHash, priceUSDC, storageClass, splitter, geoMask
      )).to.be.revertedWithCustomError(contentRegistry, "AccessControlUnauthorizedAccount");
    });

    it("Should require creator to be registered", async function () {
      // Remove publisher role and try to register content
      const PUBLISHER_ROLE = await contentRegistry.PUBLISHER_ROLE();
      await contentRegistry.revokeRole(PUBLISHER_ROLE, user1.address);
      await contentRegistry.grantRole(PUBLISHER_ROLE, user1.address);

      await expect(contentRegistry.connect(user1).registerContent(
        metaURI, pHash, priceUSDC, storageClass, splitter, geoMask
      )).to.be.revertedWith("Creator not registered");
    });
  });

  describe("Moderation", function () {
    let contentId;
    const metaURI = "ipfs://QmContent123";
    const pHash = ethers.keccak256(ethers.toUtf8Bytes("content123"));
    const priceUSDC = ethers.parseUnits("10", 6);
    const storageClass = 0;
    const splitter = "0x1234567890123456789012345678901234567890";
    const geoMask = 0xFFFFFFFF;

    beforeEach(async function () {
      const tx = await contentRegistry.connect(creator1).registerContent(
        metaURI, pHash, priceUSDC, storageClass, splitter, geoMask
      );
      const receipt = await tx.wait();
      contentId = 1; // First content ID
    });

    it("Should update moderation status", async function () {
      await expect(contentRegistry.connect(moderator).setModerationStatus(contentId, 1)) // Approved
        .to.emit(contentRegistry, "ModerationStatusUpdated")
        .withArgs(contentId, 0, 1, moderator.address, await time.latest() + 1);

      const content = await contentRegistry.getContent(contentId);
      expect(content.moderationStatus).to.equal(1);
      expect(await contentRegistry.totalApprovedContent()).to.equal(1);
    });

    it("Should update moderation status with reason", async function () {
      const reason = "Content approved after review";
      
      await expect(contentRegistry.connect(moderator).setModerationStatusWithReason(contentId, 1, reason))
        .to.emit(contentRegistry, "ModerationActionTaken")
        .withArgs(contentId, moderator.address, 0, 1, reason, await time.latest() + 1);

      expect(await contentRegistry.getModeratorActionCount(moderator.address)).to.equal(1);
    });

    it("Should flag content", async function () {
      const reason = "Inappropriate content";
      
      await expect(contentRegistry.connect(user1).flagContent(contentId, reason))
        .to.emit(contentRegistry, "ContentFlagged")
        .withArgs(contentId, user1.address, reason, await time.latest() + 1);

      const content = await contentRegistry.getContent(contentId);
      expect(content.moderationStatus).to.equal(3); // Flagged
      expect(await contentRegistry.totalFlaggedContent()).to.equal(1);
    });

    it("Should not allow setting same status twice", async function () {
      await contentRegistry.connect(moderator).setModerationStatus(contentId, 1);
      
      await expect(contentRegistry.connect(moderator).setModerationStatus(contentId, 1))
        .to.be.revertedWith("Status already set");
    });

    it("Should validate moderation status", async function () {
      await expect(contentRegistry.connect(moderator).setModerationStatus(contentId, 4))
        .to.be.revertedWith("Invalid moderation status");
    });

    it("Should require moderator role for status updates", async function () {
      await expect(contentRegistry.connect(user1).setModerationStatus(contentId, 1))
        .to.be.revertedWithCustomError(contentRegistry, "AccessControlUnauthorizedAccount");
    });

    it("Should get moderation statistics", async function () {
      // Initially all pending
      let [pending, approved, rejected, flagged] = await contentRegistry.getModerationStats();
      expect(pending).to.equal(1);
      expect(approved).to.equal(0);
      expect(rejected).to.equal(0);
      expect(flagged).to.equal(0);

      // Approve content
      await contentRegistry.connect(moderator).setModerationStatus(contentId, 1);
      
      [pending, approved, rejected, flagged] = await contentRegistry.getModerationStats();
      expect(pending).to.equal(0);
      expect(approved).to.equal(1);
    });

    it("Should get content by moderation status", async function () {
      // Register another content
      const pHash2 = ethers.keccak256(ethers.toUtf8Bytes("content456"));
      await contentRegistry.connect(creator2).registerContent(
        "ipfs://QmContent456", pHash2, priceUSDC, storageClass, splitter, geoMask
      );

      // Approve first content
      await contentRegistry.connect(moderator).setModerationStatus(1, 1);

      const [approvedContent, total] = await contentRegistry.getContentByModerationStatus(1, 0, 10);
      expect(total).to.equal(1);
      expect(approvedContent[0]).to.equal(1);

      const [pendingContent, pendingTotal] = await contentRegistry.getContentByModerationStatus(0, 0, 10);
      expect(pendingTotal).to.equal(1);
      expect(pendingContent[0]).to.equal(2);
    });
  });

  describe("Sales and Revenue", function () {
    let contentId;
    const metaURI = "ipfs://QmContent123";
    const pHash = ethers.keccak256(ethers.toUtf8Bytes("content123"));
    const priceUSDC = ethers.parseUnits("10", 6);
    const storageClass = 0;
    const splitter = "0x1234567890123456789012345678901234567890";
    const geoMask = 0xFFFFFFFF;

    beforeEach(async function () {
      await contentRegistry.connect(creator1).registerContent(
        metaURI, pHash, priceUSDC, storageClass, splitter, geoMask
      );
      contentId = 1;
    });

    it("Should record content sale", async function () {
      const salePrice = ethers.parseUnits("10", 6);
      
      await expect(contentRegistry.connect(publisher).recordSale(contentId, user1.address, salePrice))
        .to.emit(contentRegistry, "ContentSale")
        .withArgs(contentId, user1.address, salePrice, await time.latest() + 1);

      const content = await contentRegistry.getContent(contentId);
      expect(content.totalSales).to.equal(salePrice);
      
      expect(await contentRegistry.getContentRevenue(contentId)).to.equal(salePrice);
      expect(await contentRegistry.getCreatorRevenue(creator1.address)).to.equal(salePrice);
    });

    it("Should update creator earnings in registry", async function () {
      const salePrice = ethers.parseUnits("10", 6);
      
      await contentRegistry.connect(publisher).recordSale(contentId, user1.address, salePrice);

      const creatorData = await creatorRegistry.getCreator(creator1.address);
      expect(creatorData.totalEarnings).to.equal(salePrice);
    });

    it("Should increment view count", async function () {
      await contentRegistry.connect(publisher).incrementViewCount(contentId);
      
      const content = await contentRegistry.getContent(contentId);
      expect(content.viewCount).to.equal(1);
    });

    it("Should validate sale parameters", async function () {
      await expect(contentRegistry.connect(publisher).recordSale(999, user1.address, priceUSDC))
        .to.be.revertedWith("Content does not exist");

      await expect(contentRegistry.connect(publisher).recordSale(contentId, ethers.ZeroAddress, priceUSDC))
        .to.be.revertedWith("Invalid buyer address");

      await expect(contentRegistry.connect(publisher).recordSale(contentId, user1.address, 0))
        .to.be.revertedWith("Price must be greater than 0");
    });
  });

  describe("Content Management", function () {
    let contentId;
    const metaURI = "ipfs://QmContent123";
    const pHash = ethers.keccak256(ethers.toUtf8Bytes("content123"));
    const priceUSDC = ethers.parseUnits("10", 6);
    const storageClass = 0;
    const splitter = "0x1234567890123456789012345678901234567890";
    const geoMask = 0xFFFFFFFF;

    beforeEach(async function () {
      await contentRegistry.connect(creator1).registerContent(
        metaURI, pHash, priceUSDC, storageClass, splitter, geoMask
      );
      contentId = 1;
    });

    it("Should allow creator to update content", async function () {
      const newMetaURI = "ipfs://QmNewContent123";
      const newPrice = ethers.parseUnits("15", 6);
      
      await expect(contentRegistry.connect(creator1).updateContent(contentId, newMetaURI, newPrice))
        .to.emit(contentRegistry, "ContentUpdated")
        .withArgs(contentId, newMetaURI, newPrice, await time.latest() + 1);

      const content = await contentRegistry.getContent(contentId);
      expect(content.metaURI).to.equal(newMetaURI);
      expect(content.priceUSDC).to.equal(newPrice);
    });

    it("Should allow admin to update content", async function () {
      const newMetaURI = "ipfs://QmNewContent123";
      const newPrice = ethers.parseUnits("15", 6);
      
      await contentRegistry.connect(admin).updateContent(contentId, newMetaURI, newPrice);

      const content = await contentRegistry.getContent(contentId);
      expect(content.metaURI).to.equal(newMetaURI);
    });

    it("Should not allow unauthorized updates", async function () {
      await expect(contentRegistry.connect(user1).updateContent(contentId, "ipfs://test", priceUSDC))
        .to.be.revertedWith("Unauthorized to update content");
    });

    it("Should set and get content tags", async function () {
      const tags = ["adult", "premium", "hd"];
      
      await expect(contentRegistry.connect(creator1).setContentTags(contentId, tags))
        .to.emit(contentRegistry, "ContentTagsUpdated")
        .withArgs(contentId, tags, await time.latest() + 1);

      const retrievedTags = await contentRegistry.getContentTags(contentId);
      expect(retrievedTags).to.deep.equal(tags);
    });

    it("Should get content by tag", async function () {
      const tags = ["adult", "premium"];
      await contentRegistry.connect(creator1).setContentTags(contentId, tags);

      const [taggedContent, total] = await contentRegistry.getContentByTag("adult", 0, 10);
      expect(total).to.equal(1);
      expect(taggedContent[0]).to.equal(contentId);
    });

    it("Should validate tag parameters", async function () {
      await expect(contentRegistry.connect(creator1).setContentTags(contentId, []))
        .to.be.revertedWith("Invalid number of tags");

      const tooManyTags = new Array(11).fill("tag");
      await expect(contentRegistry.connect(creator1).setContentTags(contentId, tooManyTags))
        .to.be.revertedWith("Invalid number of tags");

      await expect(contentRegistry.connect(creator1).setContentTags(contentId, [""]))
        .to.be.revertedWith("Tag cannot be empty");
    });
  });

  describe("Geographic Restrictions", function () {
    let contentId;
    const metaURI = "ipfs://QmContent123";
    const pHash = ethers.keccak256(ethers.toUtf8Bytes("content123"));
    const priceUSDC = ethers.parseUnits("10", 6);
    const storageClass = 0;
    const splitter = "0x1234567890123456789012345678901234567890";

    it("Should check global availability", async function () {
      const globalGeoMask = 0; // Global availability
      
      await contentRegistry.connect(creator1).registerContent(
        metaURI, pHash, priceUSDC, storageClass, splitter, globalGeoMask
      );
      contentId = 1;

      expect(await contentRegistry.isAvailableInRegion(contentId, 1)).to.be.true; // US
      expect(await contentRegistry.isAvailableInRegion(contentId, 2)).to.be.true; // EU
    });

    it("Should check regional availability", async function () {
      const regionalGeoMask = (1 << 1) | (1 << 2); // US and EU only
      
      await contentRegistry.connect(creator1).registerContent(
        metaURI, pHash, priceUSDC, storageClass, splitter, regionalGeoMask
      );
      contentId = 1;

      expect(await contentRegistry.isAvailableInRegion(contentId, 1)).to.be.true; // US - available
      expect(await contentRegistry.isAvailableInRegion(contentId, 2)).to.be.true; // EU - available
      expect(await contentRegistry.isAvailableInRegion(contentId, 3)).to.be.false; // Asia - not available
    });
  });

  describe("Creator Content Queries", function () {
    beforeEach(async function () {
      // Register multiple content items for creator1
      for (let i = 0; i < 5; i++) {
        const pHash = ethers.keccak256(ethers.toUtf8Bytes(`content${i}`));
        await contentRegistry.connect(creator1).registerContent(
          `ipfs://QmContent${i}`, pHash, ethers.parseUnits("10", 6), 0,
          "0x1234567890123456789012345678901234567890", 0xFFFFFFFF
        );
      }
    });

    it("Should get creator content count", async function () {
      expect(await contentRegistry.getCreatorContentCount(creator1.address)).to.equal(5);
      expect(await contentRegistry.getCreatorContentCount(creator2.address)).to.equal(0);
    });

    it("Should get paginated creator content", async function () {
      const [contentIds, total] = await contentRegistry.getCreatorContent(creator1.address, 0, 3);
      
      expect(total).to.equal(5);
      expect(contentIds.length).to.equal(3);
      expect(contentIds[0]).to.equal(1);
      expect(contentIds[1]).to.equal(2);
      expect(contentIds[2]).to.equal(3);
    });

    it("Should handle pagination edge cases", async function () {
      // Offset beyond total
      const [contentIds1, total1] = await contentRegistry.getCreatorContent(creator1.address, 10, 5);
      expect(contentIds1.length).to.equal(0);
      expect(total1).to.equal(5);

      // Limit beyond remaining
      const [contentIds2, total2] = await contentRegistry.getCreatorContent(creator1.address, 3, 5);
      expect(contentIds2.length).to.equal(2);
      expect(contentIds2[0]).to.equal(4);
      expect(contentIds2[1]).to.equal(5);
    });
  });

  describe("Admin Functions", function () {
    let contentId;

    beforeEach(async function () {
      const pHash = ethers.keccak256(ethers.toUtf8Bytes("content123"));
      await contentRegistry.connect(creator1).registerContent(
        "ipfs://QmContent123", pHash, ethers.parseUnits("10", 6), 0,
        "0x1234567890123456789012345678901234567890", 0xFFFFFFFF
      );
      contentId = 1;
    });

    it("Should allow admin to pause contract", async function () {
      await contentRegistry.connect(admin).pause();
      expect(await contentRegistry.paused()).to.be.true;

      const pHash = ethers.keccak256(ethers.toUtf8Bytes("content456"));
      await expect(contentRegistry.connect(creator1).registerContent(
        "ipfs://QmContent456", pHash, ethers.parseUnits("10", 6), 0,
        "0x1234567890123456789012345678901234567890", 0xFFFFFFFF
      )).to.be.revertedWithCustomError(contentRegistry, "EnforcedPause");
    });

    it("Should allow emergency content removal", async function () {
      const reason = "Emergency removal due to legal issues";
      
      await expect(contentRegistry.connect(admin).emergencyRemoveContent(contentId, reason))
        .to.emit(contentRegistry, "ModerationActionTaken")
        .withArgs(contentId, admin.address, 0, 2, reason, await time.latest() + 1);

      const content = await contentRegistry.getContent(contentId);
      expect(content.moderationStatus).to.equal(2); // Rejected
    });

    it("Should update creator registry address", async function () {
      // Deploy new creator registry
      const CreatorRegistry = await ethers.getContractFactory("CreatorRegistry");
      const newCreatorRegistry = await upgrades.deployProxy(
        CreatorRegistry,
        [await ageVerifiedSBT.getAddress(), await verifiedTalentSBT.getAddress()],
        { initializer: "initialize" }
      );
      await newCreatorRegistry.waitForDeployment();

      await contentRegistry.connect(admin).updateCreatorRegistry(await newCreatorRegistry.getAddress());
      expect(await contentRegistry.creatorRegistry()).to.equal(await newCreatorRegistry.getAddress());
    });

    it("Should validate creator registry address", async function () {
      await expect(contentRegistry.connect(admin).updateCreatorRegistry(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid creator registry address");
    });
  });

  describe("Version", function () {
    it("Should return correct version", async function () {
      expect(await contentRegistry.version()).to.equal("1.0.0");
    });
  });
});