const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("NFTAccess", function () {
  let nftAccess;
  let contentRegistry;
  let creatorRegistry;
  let ageVerifiedSBT;
  let verifiedTalentSBT;
  let owner;
  let admin;
  let minter;
  let creator1;
  let creator2;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, admin, minter, creator1, creator2, user1, user2] = await ethers.getSigners();
    
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

    // Deploy NFTAccess
    const NFTAccess = await ethers.getContractFactory("NFTAccess");
    nftAccess = await upgrades.deployProxy(
      NFTAccess,
      [await contentRegistry.getAddress(), await creatorRegistry.getAddress()],
      { initializer: "initialize" }
    );
    await nftAccess.waitForDeployment();

    // Grant roles
    const ADMIN_ROLE = await nftAccess.ADMIN_ROLE();
    const MINTER_ROLE = await nftAccess.MINTER_ROLE();
    const PUBLISHER_ROLE = await contentRegistry.PUBLISHER_ROLE();
    const STATS_UPDATER_ROLE = await creatorRegistry.STATS_UPDATER_ROLE();

    await nftAccess.grantRole(ADMIN_ROLE, admin.address);
    await nftAccess.grantRole(MINTER_ROLE, minter.address);
    await contentRegistry.grantRole(PUBLISHER_ROLE, creator1.address);
    await creatorRegistry.grantRole(STATS_UPDATER_ROLE, await contentRegistry.getAddress());

    // Register creators and content
    await creatorRegistry.connect(creator1).registerCreator(creator1.address);
    await creatorRegistry.connect(creator2).registerCreator(creator2.address);

    // Register test content
    await contentRegistry.connect(creator1).registerContent(
      "ipfs://QmContent123",
      ethers.keccak256(ethers.toUtf8Bytes("content123")),
      ethers.parseUnits("10", 6), // $10 USDC
      0, // Shreddable
      "0x1234567890123456789012345678901234567890",
      0xFFFFFFFF // Global availability
    );
  });

  describe("Deployment", function () {
    it("Should initialize with correct registry addresses", async function () {
      expect(await nftAccess.contentRegistry()).to.equal(await contentRegistry.getAddress());
      expect(await nftAccess.creatorRegistry()).to.equal(await creatorRegistry.getAddress());
    });

    it("Should grant admin roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await nftAccess.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await nftAccess.ADMIN_ROLE();
      const MINTER_ROLE = await nftAccess.MINTER_ROLE();

      expect(await nftAccess.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await nftAccess.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await nftAccess.hasRole(MINTER_ROLE, owner.address)).to.be.true;
    });

    it("Should have correct initial statistics", async function () {
      expect(await nftAccess.totalAccessTokens()).to.equal(0);
      
      const [ppv, subscription, lifetime, rental] = await nftAccess.getAccessStats();
      expect(ppv).to.equal(0);
      expect(subscription).to.equal(0);
      expect(lifetime).to.equal(0);
      expect(rental).to.equal(0);
    });
  });

  describe("PPV Access Tokens", function () {
    const contentId = 1;
    const quantity = 1;

    it("Should mint PPV access token", async function () {
      const tx = await nftAccess.connect(minter).mintPPV(user1.address, contentId, quantity);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      
      await expect(tx)
        .to.emit(nftAccess, "AccessMinted")
        .withArgs(user1.address, 1, contentId, 0, quantity, 0, block.timestamp); // 0 = PPV

      expect(await nftAccess.balanceOf(user1.address, 1)).to.equal(quantity);
      expect(await nftAccess.hasAccess(user1.address, contentId)).to.be.true;
      expect(await nftAccess.getAccessType(user1.address, contentId)).to.equal("ppv");
      expect(await nftAccess.totalAccessTokens()).to.equal(1);
    });

    it("Should store correct token information", async function () {
      await nftAccess.connect(minter).mintPPV(user1.address, contentId, quantity);
      
      const token = await nftAccess.getAccessToken(1);
      expect(token.contentId).to.equal(contentId);
      expect(token.accessType).to.equal(0); // PPV
      expect(token.expiresAt).to.equal(0); // PPV doesn't expire
      expect(token.active).to.be.true;
    });

    it("Should track user access tokens", async function () {
      await nftAccess.connect(minter).mintPPV(user1.address, contentId, quantity);
      
      const userTokens = await nftAccess.getUserAccessTokens(user1.address, contentId);
      expect(userTokens.length).to.equal(1);
      expect(userTokens[0]).to.equal(1);
    });

    it("Should validate PPV minting parameters", async function () {
      await expect(nftAccess.connect(minter).mintPPV(ethers.ZeroAddress, contentId, quantity))
        .to.be.revertedWith("Cannot mint to zero address");

      await expect(nftAccess.connect(minter).mintPPV(user1.address, 999, quantity))
        .to.be.revertedWith("Content does not exist");

      await expect(nftAccess.connect(minter).mintPPV(user1.address, contentId, 0))
        .to.be.revertedWith("Quantity must be greater than 0");
    });

    it("Should require minter role", async function () {
      await expect(nftAccess.connect(user1).mintPPV(user1.address, contentId, quantity))
        .to.be.revertedWithCustomError(nftAccess, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Subscription Access Tokens", function () {
    let planId;
    const planPrice = ethers.parseUnits("50", 6); // $50 USDC
    const planDuration = 30 * 24 * 60 * 60; // 30 days
    const planName = "Premium Monthly";
    const planDescription = "Access to all premium content";
    const maxSubscribers = 1000;

    beforeEach(async function () {
      // Create subscription plan
      const tx = await nftAccess.connect(creator1).createSubscriptionPlan(
        planPrice, planDuration, planName, planDescription, maxSubscribers
      );
      const receipt = await tx.wait();
      planId = 1; // First plan ID
    });

    it("Should create subscription plan", async function () {
      const plan = await nftAccess.getSubscriptionPlan(planId);
      expect(plan.creator).to.equal(creator1.address);
      expect(plan.priceUSDC).to.equal(planPrice);
      expect(plan.duration).to.equal(planDuration);
      expect(plan.name).to.equal(planName);
      expect(plan.description).to.equal(planDescription);
      expect(plan.maxSubscribers).to.equal(maxSubscribers);
      expect(plan.currentSubscribers).to.equal(0);
      expect(plan.active).to.be.true;
    });

    it("Should mint subscription access token", async function () {
      const duration = planDuration;
      
      const tx = await nftAccess.connect(minter).mintSubscription(user1.address, planId, duration);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const expiresAt = block.timestamp + duration;
      
      // Get the actual token ID from the event
      const events = receipt.logs.filter(log => {
        try {
          return nftAccess.interface.parseLog(log).name === 'AccessMinted';
        } catch {
          return false;
        }
      });
      const tokenId = events[0] ? nftAccess.interface.parseLog(events[0]).args[1] : 2;
      
      await expect(tx)
        .to.emit(nftAccess, "AccessMinted")
        .withArgs(user1.address, tokenId, planId, 1, 1, expiresAt, block.timestamp); // 1 = SUBSCRIPTION

      expect(await nftAccess.balanceOf(user1.address, tokenId)).to.equal(1);
      
      const plan = await nftAccess.getSubscriptionPlan(planId);
      expect(plan.currentSubscribers).to.equal(1);
    });

    it("Should check subscription access to creator content", async function () {
      await nftAccess.connect(minter).mintSubscription(user1.address, planId, planDuration);
      
      // User should have subscription access to creator1's content
      expect(await nftAccess.hasAccess(user1.address, 1)).to.be.true; // contentId 1 is from creator1
      expect(await nftAccess.getAccessType(user1.address, 1)).to.equal("subscription");
    });

    it("Should update subscription plan", async function () {
      const newPrice = ethers.parseUnits("60", 6);
      const newDuration = 60 * 24 * 60 * 60; // 60 days
      
      const tx = await nftAccess.connect(creator1).updateSubscriptionPlan(planId, newPrice, newDuration, true);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      
      await expect(tx)
        .to.emit(nftAccess, "SubscriptionPlanUpdated")
        .withArgs(planId, newPrice, newDuration, true, block.timestamp);

      const plan = await nftAccess.getSubscriptionPlan(planId);
      expect(plan.priceUSDC).to.equal(newPrice);
      expect(plan.duration).to.equal(newDuration);
    });

    it("Should not allow subscription to inactive plan", async function () {
      await nftAccess.connect(creator1).updateSubscriptionPlan(planId, planPrice, planDuration, false);
      
      await expect(nftAccess.connect(minter).mintSubscription(user1.address, planId, planDuration))
        .to.be.revertedWith("Subscription plan not active");
    });

    it("Should not allow subscription when plan is full", async function () {
      // Create plan with max 1 subscriber
      const tx = await nftAccess.connect(creator1).createSubscriptionPlan(
        planPrice, planDuration, "Limited Plan", "Limited access", 1
      );
      const limitedPlanId = 2;

      // First subscription should work
      await nftAccess.connect(minter).mintSubscription(user1.address, limitedPlanId, planDuration);
      
      // Second subscription should fail
      await expect(nftAccess.connect(minter).mintSubscription(user2.address, limitedPlanId, planDuration))
        .to.be.revertedWith("Subscription plan full");
    });

    it("Should get creator plans", async function () {
      const creatorPlans = await nftAccess.getCreatorPlans(creator1.address);
      expect(creatorPlans.length).to.equal(1);
      expect(creatorPlans[0]).to.equal(planId);
    });

    it("Should validate subscription plan parameters", async function () {
      await expect(nftAccess.connect(creator1).createSubscriptionPlan(0, planDuration, planName, planDescription, maxSubscribers))
        .to.be.revertedWith("Price must be greater than 0");

      await expect(nftAccess.connect(creator1).createSubscriptionPlan(planPrice, 0, planName, planDescription, maxSubscribers))
        .to.be.revertedWith("Duration must be greater than 0");

      await expect(nftAccess.connect(creator1).createSubscriptionPlan(planPrice, planDuration, "", planDescription, maxSubscribers))
        .to.be.revertedWith("Name cannot be empty");

      await expect(nftAccess.connect(creator1).createSubscriptionPlan(planPrice, planDuration, planName, planDescription, 0))
        .to.be.revertedWith("Max subscribers must be greater than 0");
    });
  });

  describe("Lifetime Access Tokens", function () {
    const contentId = 1;

    it("Should mint lifetime access token", async function () {
      const tx = await nftAccess.connect(minter).mintLifetime(user1.address, contentId);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      
      // Get the actual token ID from the event
      const events = receipt.logs.filter(log => {
        try {
          return nftAccess.interface.parseLog(log).name === 'AccessMinted';
        } catch {
          return false;
        }
      });
      const tokenId = events[0] ? nftAccess.interface.parseLog(events[0]).args[1] : 1;
      
      await expect(tx)
        .to.emit(nftAccess, "AccessMinted")
        .withArgs(user1.address, tokenId, contentId, 2, 1, 0, block.timestamp); // 2 = LIFETIME

      expect(await nftAccess.balanceOf(user1.address, tokenId)).to.equal(1);
      expect(await nftAccess.hasAccess(user1.address, contentId)).to.be.true;
      expect(await nftAccess.getAccessType(user1.address, contentId)).to.equal("lifetime");
    });

    it("Should not expire lifetime tokens", async function () {
      await nftAccess.connect(minter).mintLifetime(user1.address, contentId);
      
      const token = await nftAccess.getAccessToken(1);
      expect(token.expiresAt).to.equal(0);
      expect(await nftAccess.isExpired(1)).to.be.false;
    });
  });

  describe("Rental Access Tokens", function () {
    const contentId = 1;
    const rentalDuration = 7 * 24 * 60 * 60; // 7 days

    it("Should mint rental access token", async function () {
      const expiresAt = (await time.latest()) + rentalDuration + 1;
      
      await expect(nftAccess.connect(minter).mintRental(user1.address, contentId, rentalDuration))
        .to.emit(nftAccess, "AccessMinted")
        .withArgs(user1.address, 1, contentId, 3, 1, expiresAt, await time.latest() + 1); // 3 = RENTAL

      expect(await nftAccess.balanceOf(user1.address, 1)).to.equal(1);
      expect(await nftAccess.hasAccess(user1.address, contentId)).to.be.true;
      expect(await nftAccess.getAccessType(user1.address, contentId)).to.equal("rental");
    });

    it("Should expire rental tokens", async function () {
      await nftAccess.connect(minter).mintRental(user1.address, contentId, rentalDuration);
      
      // Initially not expired
      expect(await nftAccess.isExpired(1)).to.be.false;
      expect(await nftAccess.hasAccess(user1.address, contentId)).to.be.true;
      
      // Fast forward past expiry
      await time.increase(rentalDuration + 1);
      
      expect(await nftAccess.isExpired(1)).to.be.true;
      expect(await nftAccess.hasAccess(user1.address, contentId)).to.be.false;
    });

    it("Should extend rental duration", async function () {
      await nftAccess.connect(minter).mintRental(user1.address, contentId, rentalDuration);
      
      const additionalDuration = 3 * 24 * 60 * 60; // 3 more days
      
      await expect(nftAccess.connect(minter).extendRental(user1.address, contentId, additionalDuration))
        .to.emit(nftAccess, "RentalExtended");

      // Should still have access after original duration
      await time.increase(rentalDuration + 1);
      expect(await nftAccess.hasAccess(user1.address, contentId)).to.be.true;
    });

    it("Should validate rental duration", async function () {
      const tooLongDuration = 31 * 24 * 60 * 60; // 31 days
      
      await expect(nftAccess.connect(minter).mintRental(user1.address, contentId, tooLongDuration))
        .to.be.revertedWith("Rental duration too long");

      await expect(nftAccess.connect(minter).mintRental(user1.address, contentId, 0))
        .to.be.revertedWith("Duration must be greater than 0");
    });
  });

  describe("Access Revocation", function () {
    const contentId = 1;

    beforeEach(async function () {
      await nftAccess.connect(minter).mintPPV(user1.address, contentId, 1);
    });

    it("Should revoke access token", async function () {
      const BURNER_ROLE = await nftAccess.BURNER_ROLE();
      await nftAccess.grantRole(BURNER_ROLE, admin.address);
      
      await expect(nftAccess.connect(admin).revokeAccess(user1.address, 1))
        .to.emit(nftAccess, "AccessRevoked")
        .withArgs(user1.address, 1, await time.latest() + 1);

      expect(await nftAccess.balanceOf(user1.address, 1)).to.equal(0);
      expect(await nftAccess.hasAccess(user1.address, contentId)).to.be.false;
      
      const token = await nftAccess.getAccessToken(1);
      expect(token.active).to.be.false;
    });

    it("Should update subscription count on revocation", async function () {
      // Create and mint subscription
      await nftAccess.connect(creator1).createSubscriptionPlan(
        ethers.parseUnits("50", 6), 30 * 24 * 60 * 60, "Test Plan", "Test", 100
      );
      await nftAccess.connect(minter).mintSubscription(user1.address, 1, 30 * 24 * 60 * 60);
      
      let plan = await nftAccess.getSubscriptionPlan(1);
      expect(plan.currentSubscribers).to.equal(1);
      
      // Revoke subscription
      const BURNER_ROLE = await nftAccess.BURNER_ROLE();
      await nftAccess.grantRole(BURNER_ROLE, admin.address);
      await nftAccess.connect(admin).revokeAccess(user1.address, 2);
      
      plan = await nftAccess.getSubscriptionPlan(1);
      expect(plan.currentSubscribers).to.equal(0);
    });

    it("Should validate revocation parameters", async function () {
      const BURNER_ROLE = await nftAccess.BURNER_ROLE();
      await nftAccess.grantRole(BURNER_ROLE, admin.address);
      
      await expect(nftAccess.connect(admin).revokeAccess(user2.address, 1))
        .to.be.revertedWith("User does not own token");
    });
  });

  describe("Access Queries", function () {
    const contentId = 1;

    it("Should return 'none' for no access", async function () {
      expect(await nftAccess.hasAccess(user1.address, contentId)).to.be.false;
      expect(await nftAccess.getAccessType(user1.address, contentId)).to.equal("none");
    });

    it("Should handle multiple access types", async function () {
      // Mint PPV access
      await nftAccess.connect(minter).mintPPV(user1.address, contentId, 1);
      expect(await nftAccess.getAccessType(user1.address, contentId)).to.equal("ppv");
      
      // Mint lifetime access (should still return first valid type)
      await nftAccess.connect(minter).mintLifetime(user1.address, contentId);
      expect(await nftAccess.getAccessType(user1.address, contentId)).to.equal("ppv");
    });

    it("Should get access statistics", async function () {
      await nftAccess.connect(minter).mintPPV(user1.address, contentId, 1);
      await nftAccess.connect(minter).mintLifetime(user2.address, contentId);
      
      const [ppv, subscription, lifetime, rental] = await nftAccess.getAccessStats();
      expect(ppv).to.equal(1);
      expect(subscription).to.equal(0);
      expect(lifetime).to.equal(1);
      expect(rental).to.equal(0);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to pause contract", async function () {
      await nftAccess.connect(admin).pause();
      expect(await nftAccess.paused()).to.be.true;

      await expect(nftAccess.connect(minter).mintPPV(user1.address, 1, 1))
        .to.be.revertedWithCustomError(nftAccess, "EnforcedPause");
    });

    it("Should allow admin to set URI", async function () {
      const newURI = "https://new-api.reelverse.com/nft/{id}.json";
      await nftAccess.connect(admin).setURI(newURI);
      
      // URI is internal, but we can test that it doesn't revert
      expect(true).to.be.true;
    });

    it("Should allow admin to update registries", async function () {
      // Deploy new registries (simplified for test)
      const CreatorRegistry = await ethers.getContractFactory("CreatorRegistry");
      const newCreatorRegistry = await upgrades.deployProxy(
        CreatorRegistry,
        [await ageVerifiedSBT.getAddress(), await verifiedTalentSBT.getAddress()],
        { initializer: "initialize" }
      );
      await newCreatorRegistry.waitForDeployment();

      const ContentRegistry = await ethers.getContractFactory("ContentRegistry");
      const newContentRegistry = await upgrades.deployProxy(
        ContentRegistry,
        [await newCreatorRegistry.getAddress()],
        { initializer: "initialize" }
      );
      await newContentRegistry.waitForDeployment();

      await nftAccess.connect(admin).updateRegistries(
        await newContentRegistry.getAddress(),
        await newCreatorRegistry.getAddress()
      );

      expect(await nftAccess.contentRegistry()).to.equal(await newContentRegistry.getAddress());
      expect(await nftAccess.creatorRegistry()).to.equal(await newCreatorRegistry.getAddress());
    });

    it("Should allow emergency burn", async function () {
      await nftAccess.connect(minter).mintPPV(user1.address, 1, 1);
      expect(await nftAccess.balanceOf(user1.address, 1)).to.equal(1);
      
      await nftAccess.connect(admin).emergencyBurn(user1.address, 1, 1);
      
      expect(await nftAccess.balanceOf(user1.address, 1)).to.equal(0);
      const token = await nftAccess.getAccessToken(1);
      expect(token.active).to.be.false;
    });
  });

  describe("Version", function () {
    it("Should return correct version", async function () {
      expect(await nftAccess.version()).to.equal("1.0.0");
    });
  });
});