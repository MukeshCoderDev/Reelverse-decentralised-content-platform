const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("ContentAccessGate", function () {
    let contentAccessGate;
    let contentRegistry;
    let nftAccess;
    let creatorRegistry;
    let ageVerifiedSBT;
    let mockUSDC;
    
    let owner, signer, creator, user, moderator;
    let contentId;
    
    beforeEach(async function () {
        [owner, signer, creator, user, moderator] = await ethers.getSigners();
        
        // Deploy MockUSDC
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockUSDC.deploy();
        await mockUSDC.waitForDeployment();
        
        // Deploy AgeVerifiedSBT
        const AgeVerifiedSBT = await ethers.getContractFactory("AgeVerifiedSBT");
        ageVerifiedSBT = await AgeVerifiedSBT.deploy();
        await ageVerifiedSBT.waitForDeployment();
        
        // Deploy VerifiedTalentSBT
        const VerifiedTalentSBT = await ethers.getContractFactory("VerifiedTalentSBT");
        const verifiedTalentSBT = await VerifiedTalentSBT.deploy();
        await verifiedTalentSBT.waitForDeployment();
        
        // Deploy CreatorRegistry
        const CreatorRegistry = await ethers.getContractFactory("CreatorRegistry");
        creatorRegistry = await upgrades.deployProxy(CreatorRegistry, [
            await ageVerifiedSBT.getAddress(),
            await verifiedTalentSBT.getAddress()
        ], {
            initializer: "initialize"
        });
        await creatorRegistry.waitForDeployment();
        
        // Deploy ContentRegistry
        const ContentRegistry = await ethers.getContractFactory("ContentRegistry");
        contentRegistry = await upgrades.deployProxy(ContentRegistry, [
            await creatorRegistry.getAddress()
        ], {
            initializer: "initialize"
        });
        await contentRegistry.waitForDeployment();
        
        // Deploy NFTAccess
        const NFTAccess = await ethers.getContractFactory("NFTAccess");
        nftAccess = await upgrades.deployProxy(NFTAccess, [
            await contentRegistry.getAddress(),
            await creatorRegistry.getAddress()
        ], {
            initializer: "initialize"
        });
        await nftAccess.waitForDeployment();
        
        // Deploy ContentAccessGate
        const ContentAccessGate = await ethers.getContractFactory("ContentAccessGate");
        contentAccessGate = await upgrades.deployProxy(ContentAccessGate, [
            await contentRegistry.getAddress(),
            await nftAccess.getAddress(),
            await creatorRegistry.getAddress(),
            await ageVerifiedSBT.getAddress(),
            signer.address
        ], {
            initializer: "initialize"
        });
        await contentAccessGate.waitForDeployment();
        
        // Grant necessary roles
        const PUBLISHER_ROLE = await contentRegistry.PUBLISHER_ROLE();
        const MINTER_ROLE = await nftAccess.MINTER_ROLE();
        const MODERATOR_ROLE = await contentAccessGate.MODERATOR_ROLE();
        const STATS_UPDATER_ROLE = await creatorRegistry.STATS_UPDATER_ROLE();
        
        await contentRegistry.grantRole(PUBLISHER_ROLE, creator.address);
        await nftAccess.grantRole(MINTER_ROLE, owner.address);
        await contentAccessGate.grantRole(MODERATOR_ROLE, moderator.address);
        await creatorRegistry.grantRole(STATS_UPDATER_ROLE, await contentRegistry.getAddress());
        
        // Register creator
        await creatorRegistry.registerCreator(creator.address);
        
        // Create test content
        await contentRegistry.connect(creator).registerContent(
            "ipfs://test-metadata",
            ethers.keccak256(ethers.toUtf8Bytes("test-hash")),
            ethers.parseUnits("10", 6), // 10 USDC
            0, // Shreddable
            owner.address, // Splitter (using owner for simplicity)
            0xFFFFFFFF // Global availability
        );
        contentId = 1;
        
        // Approve content for testing
        const MODERATOR_ROLE_CONTENT = await contentRegistry.MODERATOR_ROLE();
        await contentRegistry.grantRole(MODERATOR_ROLE_CONTENT, owner.address);
        await contentRegistry.setModerationStatus(contentId, 1); // Approved
    });
    
    describe("Deployment", function () {
        it("Should initialize with correct parameters", async function () {
            expect(await contentAccessGate.contentRegistry()).to.equal(await contentRegistry.getAddress());
            expect(await contentAccessGate.nftAccess()).to.equal(await nftAccess.getAddress());
            expect(await contentAccessGate.creatorRegistry()).to.equal(await creatorRegistry.getAddress());
            expect(await contentAccessGate.ageVerifiedSBT()).to.equal(await ageVerifiedSBT.getAddress());
            expect(await contentAccessGate.signer()).to.equal(signer.address);
            expect(await contentAccessGate.tokenExpiryDuration()).to.equal(24 * 60 * 60); // 24 hours
        });
        
        it("Should grant correct roles", async function () {
            const ADMIN_ROLE = await contentAccessGate.ADMIN_ROLE();
            const SIGNER_ROLE = await contentAccessGate.SIGNER_ROLE();
            
            expect(await contentAccessGate.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
            expect(await contentAccessGate.hasRole(SIGNER_ROLE, signer.address)).to.be.true;
        });
    });
    
    describe("Access Control", function () {
        it("Should deny access for unverified age", async function () {
            const accessCheck = await contentAccessGate.checkAccess(user.address, contentId);
            
            expect(accessCheck.ageVerified).to.be.false;
            expect(accessCheck.geoAllowed).to.be.true;
            expect(accessCheck.hasEntitlement).to.be.false;
            expect(accessCheck.reason).to.equal("age_verification_required");
        });
        
        it("Should deny access without entitlement", async function () {
            // Verify age first
            const MINTER_ROLE_SBT = await ageVerifiedSBT.MINTER_ROLE();
            await ageVerifiedSBT.grantRole(MINTER_ROLE_SBT, owner.address);
            await ageVerifiedSBT.mintVerification(user.address, "persona", ethers.keccak256(ethers.toUtf8Bytes("proof")));
            
            const accessCheck = await contentAccessGate.checkAccess(user.address, contentId);
            
            expect(accessCheck.ageVerified).to.be.true;
            expect(accessCheck.geoAllowed).to.be.true;
            expect(accessCheck.hasEntitlement).to.be.false;
            expect(accessCheck.reason).to.equal("no_entitlement");
        });
        
        it("Should grant access with all requirements met", async function () {
            // Verify age
            const MINTER_ROLE_SBT = await ageVerifiedSBT.MINTER_ROLE();
            await ageVerifiedSBT.grantRole(MINTER_ROLE_SBT, owner.address);
            await ageVerifiedSBT.mintVerification(user.address, "persona", ethers.keccak256(ethers.toUtf8Bytes("proof")));
            
            // Grant entitlement
            await nftAccess.mintPPV(user.address, contentId, 1);
            
            const accessCheck = await contentAccessGate.checkAccess(user.address, contentId);
            
            expect(accessCheck.ageVerified).to.be.true;
            expect(accessCheck.geoAllowed).to.be.true;
            expect(accessCheck.hasEntitlement).to.be.true;
            expect(accessCheck.reason).to.equal("access_granted");
        });
        
        it("Should deny access to paused content", async function () {
            // Setup full access first
            const MINTER_ROLE_SBT = await ageVerifiedSBT.MINTER_ROLE();
            await ageVerifiedSBT.grantRole(MINTER_ROLE_SBT, owner.address);
            await ageVerifiedSBT.mintVerification(user.address, "persona", ethers.keccak256(ethers.toUtf8Bytes("proof")));
            await nftAccess.mintPPV(user.address, contentId, 1);
            
            // Pause content
            await contentAccessGate.connect(moderator).pauseContentAccess(contentId);
            
            const accessCheck = await contentAccessGate.checkAccess(user.address, contentId);
            
            expect(accessCheck.reason).to.equal("content_paused");
        });
        
        it("Should deny access to moderated content", async function () {
            // Setup full access first
            const MINTER_ROLE_SBT = await ageVerifiedSBT.MINTER_ROLE();
            await ageVerifiedSBT.grantRole(MINTER_ROLE_SBT, owner.address);
            await ageVerifiedSBT.mintVerification(user.address, "persona", ethers.keccak256(ethers.toUtf8Bytes("proof")));
            await nftAccess.mintPPV(user.address, contentId, 1);
            
            // Reject content
            await contentRegistry.setModerationStatus(contentId, 2); // Rejected
            
            const accessCheck = await contentAccessGate.checkAccess(user.address, contentId);
            
            expect(accessCheck.reason).to.equal("content_moderated");
        });
    });
    
    describe("Playback Token Generation", function () {
        beforeEach(async function () {
            // Setup full access
            const MINTER_ROLE_SBT = await ageVerifiedSBT.MINTER_ROLE();
            await ageVerifiedSBT.grantRole(MINTER_ROLE_SBT, owner.address);
            await ageVerifiedSBT.mintVerification(user.address, "persona", ethers.keccak256(ethers.toUtf8Bytes("proof")));
            await nftAccess.mintPPV(user.address, contentId, 1);
        });
        
        it("Should generate playback token for authorized user", async function () {
            const sessionId = ethers.keccak256(ethers.toUtf8Bytes("test-session"));
            
            const payload = await contentAccessGate.issuePlaybackToken(
                user.address,
                contentId,
                sessionId
            );
            
            expect(payload).to.not.be.empty;
        });
        
        it("Should reject token generation for unauthorized user", async function () {
            const sessionId = ethers.keccak256(ethers.toUtf8Bytes("test-session"));
            
            // Give creator age verification but no entitlement
            const MINTER_ROLE_SBT = await ageVerifiedSBT.MINTER_ROLE();
            await ageVerifiedSBT.grantRole(MINTER_ROLE_SBT, owner.address);
            await ageVerifiedSBT.mintVerification(creator.address, "persona", ethers.keccak256(ethers.toUtf8Bytes("proof")));
            
            await expect(
                contentAccessGate.issuePlaybackToken(
                    creator.address,
                    contentId,
                    sessionId
                )
            ).to.be.revertedWith("Access denied: no_entitlement");
        });
        
        it("Should track issued tokens", async function () {
            const sessionId = ethers.keccak256(ethers.toUtf8Bytes("test-session"));
            const SIGNER_ROLE = await contentAccessGate.SIGNER_ROLE();
            await contentAccessGate.grantRole(SIGNER_ROLE, owner.address);
            
            const initialStats = await contentAccessGate.getAccessStats();
            
            await contentAccessGate.issueAndTrackPlaybackToken(
                user.address,
                contentId,
                sessionId
            );
            
            const finalStats = await contentAccessGate.getAccessStats();
            expect(finalStats[1]).to.equal(initialStats[1] + 1n); // totalTokensIssued increased
        });
        
        it("Should prevent reuse of session IDs", async function () {
            const sessionId = ethers.keccak256(ethers.toUtf8Bytes("test-session"));
            const SIGNER_ROLE = await contentAccessGate.SIGNER_ROLE();
            await contentAccessGate.grantRole(SIGNER_ROLE, owner.address);
            
            // First use should succeed
            await contentAccessGate.issueAndTrackPlaybackToken(
                user.address,
                contentId,
                sessionId
            );
            
            // Second use should fail
            await expect(
                contentAccessGate.issueAndTrackPlaybackToken(
                    user.address,
                    contentId,
                    sessionId
                )
            ).to.be.revertedWith("Session already used");
        });
    });
    
    describe("Token Verification", function () {
        it("Should verify valid token signature", async function () {
            const sessionId = ethers.keccak256(ethers.toUtf8Bytes("test-session"));
            const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
            
            // Create message hash
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "bytes32", "uint256", "uint256"],
                [user.address, contentId, sessionId, expiresAt, (await ethers.provider.getNetwork()).chainId]
            );
            
            // Sign with signer
            const signature = await signer.signMessage(ethers.getBytes(messageHash));
            
            const isValid = await contentAccessGate.verifyPlaybackToken(
                user.address,
                contentId,
                sessionId,
                expiresAt,
                signature
            );
            
            expect(isValid).to.be.true;
        });
        
        it("Should reject expired tokens", async function () {
            const sessionId = ethers.keccak256(ethers.toUtf8Bytes("test-session"));
            const expiresAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago (expired)
            
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "bytes32", "uint256", "uint256"],
                [user.address, contentId, sessionId, expiresAt, (await ethers.provider.getNetwork()).chainId]
            );
            
            const signature = await signer.signMessage(ethers.getBytes(messageHash));
            
            const isValid = await contentAccessGate.verifyPlaybackToken(
                user.address,
                contentId,
                sessionId,
                expiresAt,
                signature
            );
            
            expect(isValid).to.be.false;
        });
        
        it("Should reject invalid signatures", async function () {
            const sessionId = ethers.keccak256(ethers.toUtf8Bytes("test-session"));
            const expiresAt = Math.floor(Date.now() / 1000) + 3600;
            
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "bytes32", "uint256", "uint256"],
                [user.address, contentId, sessionId, expiresAt, (await ethers.provider.getNetwork()).chainId]
            );
            
            // Sign with wrong signer
            const signature = await creator.signMessage(ethers.getBytes(messageHash));
            
            const isValid = await contentAccessGate.verifyPlaybackToken(
                user.address,
                contentId,
                sessionId,
                expiresAt,
                signature
            );
            
            expect(isValid).to.be.false;
        });
    });
    
    describe("Geographic Restrictions", function () {
        it("Should check content geo availability", async function () {
            const region = 0; // Use region 0 which should be available with geoMask 0xFFFFFFFF
            
            const isAvailable = await contentAccessGate.checkGeoAvailability(contentId, region);
            expect(isAvailable).to.be.true; // Content is globally available
        });
        
        it("Should respect region restrictions", async function () {
            const region = 840; // US region code
            
            // Restrict the region
            await contentAccessGate.setRegionRestriction(region, true);
            
            const isRestricted = await contentAccessGate.isRegionRestricted(region);
            expect(isRestricted).to.be.true;
        });
        
        it("Should batch set region restrictions", async function () {
            const regions = [840, 826, 276]; // US, UK, Germany
            const restrictions = [true, false, true];
            
            await contentAccessGate.batchSetRegionRestrictions(regions, restrictions);
            
            expect(await contentAccessGate.isRegionRestricted(840)).to.be.true;
            expect(await contentAccessGate.isRegionRestricted(826)).to.be.false;
            expect(await contentAccessGate.isRegionRestricted(276)).to.be.true;
        });
    });
    
    describe("Content Management", function () {
        it("Should pause and resume content access", async function () {
            expect(await contentAccessGate.isContentPaused(contentId)).to.be.false;
            
            await contentAccessGate.connect(moderator).pauseContentAccess(contentId);
            expect(await contentAccessGate.isContentPaused(contentId)).to.be.true;
            
            await contentAccessGate.connect(moderator).resumeContentAccess(contentId);
            expect(await contentAccessGate.isContentPaused(contentId)).to.be.false;
        });
        
        it("Should prevent double pausing", async function () {
            await contentAccessGate.connect(moderator).pauseContentAccess(contentId);
            
            await expect(
                contentAccessGate.connect(moderator).pauseContentAccess(contentId)
            ).to.be.revertedWith("Content already paused");
        });
        
        it("Should prevent resuming non-paused content", async function () {
            await expect(
                contentAccessGate.connect(moderator).resumeContentAccess(contentId)
            ).to.be.revertedWith("Content not paused");
        });
    });
    
    describe("Configuration", function () {
        it("Should update signer address", async function () {
            const newSigner = creator;
            
            await contentAccessGate.setSigner(newSigner.address);
            
            expect(await contentAccessGate.getSigner()).to.equal(newSigner.address);
            
            const SIGNER_ROLE = await contentAccessGate.SIGNER_ROLE();
            expect(await contentAccessGate.hasRole(SIGNER_ROLE, newSigner.address)).to.be.true;
            expect(await contentAccessGate.hasRole(SIGNER_ROLE, signer.address)).to.be.false;
        });
        
        it("Should update token expiry duration", async function () {
            const newDuration = 12 * 60 * 60; // 12 hours
            
            await contentAccessGate.setTokenExpiryDuration(newDuration);
            
            expect(await contentAccessGate.tokenExpiryDuration()).to.equal(newDuration);
        });
        
        it("Should reject invalid expiry duration", async function () {
            await expect(
                contentAccessGate.setTokenExpiryDuration(0)
            ).to.be.revertedWith("Duration must be greater than 0");
            
            await expect(
                contentAccessGate.setTokenExpiryDuration(8 * 24 * 60 * 60) // 8 days
            ).to.be.revertedWith("Duration too long");
        });
        
        it("Should update registry addresses", async function () {
            // Deploy new mock registries
            const MockRegistry = await ethers.getContractFactory("MockUSDC"); // Using MockUSDC as placeholder
            const newRegistry = await MockRegistry.deploy();
            await newRegistry.waitForDeployment();
            
            await contentAccessGate.updateRegistries(
                await newRegistry.getAddress(),
                await nftAccess.getAddress(),
                await creatorRegistry.getAddress(),
                await ageVerifiedSBT.getAddress()
            );
            
            expect(await contentAccessGate.contentRegistry()).to.equal(await newRegistry.getAddress());
        });
    });
    
    describe("Statistics", function () {
        it("Should track access statistics", async function () {
            const initialStats = await contentAccessGate.getAccessStats();
            
            // Perform some access checks with tracking
            await contentAccessGate.checkAccessAndTrack(user.address, contentId);
            await contentAccessGate.checkAccessAndTrack(creator.address, contentId);
            
            const finalStats = await contentAccessGate.getAccessStats();
            expect(finalStats[0]).to.be.greaterThan(initialStats[0]); // totalAccessChecks increased
        });
    });
    
    describe("Error Handling", function () {
        it("Should handle non-existent content", async function () {
            const nonExistentId = 999;
            
            const accessCheck = await contentAccessGate.checkAccess(user.address, nonExistentId);
            expect(accessCheck.reason).to.equal("content_not_found");
        });
        
        it("Should reject zero addresses", async function () {
            await expect(
                contentAccessGate.setSigner(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid signer address");
        });
        
        it("Should reject invalid session IDs", async function () {
            await expect(
                contentAccessGate.issuePlaybackToken(
                    user.address,
                    contentId,
                    ethers.ZeroHash
                )
            ).to.be.revertedWith("Invalid session ID");
        });
    });
    
    describe("Access Control Restrictions", function () {
        it("Should restrict admin functions to admin role", async function () {
            await expect(
                contentAccessGate.connect(user).setSigner(creator.address)
            ).to.be.revertedWithCustomError(contentAccessGate, "AccessControlUnauthorizedAccount");
            
            await expect(
                contentAccessGate.connect(user).setTokenExpiryDuration(3600)
            ).to.be.revertedWithCustomError(contentAccessGate, "AccessControlUnauthorizedAccount");
        });
        
        it("Should restrict moderator functions to moderator role", async function () {
            await expect(
                contentAccessGate.connect(user).pauseContentAccess(contentId)
            ).to.be.revertedWithCustomError(contentAccessGate, "AccessControlUnauthorizedAccount");
        });
        
        it("Should restrict signer functions to signer role", async function () {
            const sessionId = ethers.keccak256(ethers.toUtf8Bytes("test-session"));
            
            await expect(
                contentAccessGate.connect(user).issueAndTrackPlaybackToken(
                    user.address,
                    contentId,
                    sessionId
                )
            ).to.be.revertedWithCustomError(contentAccessGate, "AccessControlUnauthorizedAccount");
        });
    });
    
    describe("Pausable Functionality", function () {
        it("Should pause and unpause contract", async function () {
            await contentAccessGate.pause();
            
            // Contract functions should be paused (this would need to be tested with functions that have whenNotPaused modifier)
            
            await contentAccessGate.unpause();
        });
        
        it("Should restrict pause functions to admin", async function () {
            await expect(
                contentAccessGate.connect(user).pause()
            ).to.be.revertedWithCustomError(contentAccessGate, "AccessControlUnauthorizedAccount");
        });
    });
});

// Helper to get current timestamp
const time = {
    latest: async () => {
        const block = await ethers.provider.getBlock('latest');
        return block.timestamp;
    }
};