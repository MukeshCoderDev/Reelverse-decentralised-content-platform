const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("UploadManager", function () {
    let uploadManager;
    let contentRegistry;
    let creatorRegistry;
    let ageVerifiedSBT;
    let verifiedTalentSBT;
    
    let owner, creator, worker, user;
    let provisionalId;
    
    beforeEach(async function () {
        [owner, creator, worker, user] = await ethers.getSigners();
        
        // Deploy SBT contracts
        const AgeVerifiedSBT = await ethers.getContractFactory("AgeVerifiedSBT");
        ageVerifiedSBT = await AgeVerifiedSBT.deploy();
        await ageVerifiedSBT.waitForDeployment();
        
        const VerifiedTalentSBT = await ethers.getContractFactory("VerifiedTalentSBT");
        verifiedTalentSBT = await VerifiedTalentSBT.deploy();
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
        
        // Deploy UploadManager
        const UploadManager = await ethers.getContractFactory("UploadManager");
        uploadManager = await upgrades.deployProxy(UploadManager, [
            await contentRegistry.getAddress(),
            await creatorRegistry.getAddress()
        ], {
            initializer: "initialize"
        });
        await uploadManager.waitForDeployment();
        
        // Grant necessary roles
        const WORKER_ROLE = await uploadManager.WORKER_ROLE();
        const PUBLISHER_ROLE = await contentRegistry.PUBLISHER_ROLE();
        const ADMIN_ROLE_CONTENT = await contentRegistry.ADMIN_ROLE();
        const STATS_UPDATER_ROLE = await creatorRegistry.STATS_UPDATER_ROLE();
        
        await uploadManager.grantRole(WORKER_ROLE, worker.address);
        await contentRegistry.grantRole(PUBLISHER_ROLE, await uploadManager.getAddress());
        await contentRegistry.grantRole(ADMIN_ROLE_CONTENT, await uploadManager.getAddress());
        await creatorRegistry.grantRole(STATS_UPDATER_ROLE, await contentRegistry.getAddress());
        await creatorRegistry.grantRole(STATS_UPDATER_ROLE, await uploadManager.getAddress());
        
        // Register creator and UploadManager (for testing purposes)
        await creatorRegistry.registerCreator(creator.address);
        await creatorRegistry.registerCreator(await uploadManager.getAddress());
    });
    
    describe("Deployment", function () {
        it("Should initialize with correct parameters", async function () {
            expect(await uploadManager.contentRegistry()).to.equal(await contentRegistry.getAddress());
            expect(await uploadManager.creatorRegistry()).to.equal(await creatorRegistry.getAddress());
            expect(await uploadManager.maxPendingUploads()).to.equal(100);
            expect(await uploadManager.uploadTimeoutDuration()).to.equal(24 * 60 * 60); // 24 hours
        });
        
        it("Should grant correct roles", async function () {
            const ADMIN_ROLE = await uploadManager.ADMIN_ROLE();
            const WORKER_ROLE = await uploadManager.WORKER_ROLE();
            
            expect(await uploadManager.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
            expect(await uploadManager.hasRole(WORKER_ROLE, owner.address)).to.be.true;
            expect(await uploadManager.hasRole(WORKER_ROLE, worker.address)).to.be.true;
        });
    });
    
    describe("Upload Request Management", function () {
        it("Should allow creator to request upload", async function () {
            const tempURI = "temp://upload-123";
            const storageClass = 0; // Shreddable
            
            await expect(uploadManager.connect(creator).requestUpload(tempURI, storageClass))
                .to.emit(uploadManager, "UploadRequested");
            
            const request = await uploadManager.getUploadRequest(1);
            expect(request.creator).to.equal(creator.address);
            expect(request.tempURI).to.equal(tempURI);
            expect(request.storageClass).to.equal(storageClass);
            expect(request.status).to.equal(0); // REQUESTED
        });
        
        it("Should reject upload request from unregistered creator", async function () {
            await expect(
                uploadManager.connect(user).requestUpload("temp://upload-123", 0)
            ).to.be.revertedWith("Creator not registered");
        });
        
        it("Should reject invalid parameters", async function () {
            await expect(
                uploadManager.connect(creator).requestUpload("", 0)
            ).to.be.revertedWith("Temp URI cannot be empty");
            
            await expect(
                uploadManager.connect(creator).requestUpload("temp://upload-123", 2)
            ).to.be.revertedWith("Invalid storage class");
        });
        
        it("Should track upload statistics", async function () {
            const initialStats = await uploadManager.getUploadStats();
            
            await uploadManager.connect(creator).requestUpload("temp://upload-123", 0);
            
            const finalStats = await uploadManager.getUploadStats();
            expect(finalStats[0]).to.equal(initialStats[0] + 1n); // requested count increased
            expect(await uploadManager.getTotalUploads()).to.equal(1);
        });
        
        it("Should add upload to pending queue", async function () {
            await uploadManager.connect(creator).requestUpload("temp://upload-123", 0);
            
            expect(await uploadManager.getPendingQueueLength()).to.equal(1);
            
            const pendingUploads = await uploadManager.connect(worker).getPendingUploads(10);
            expect(pendingUploads.length).to.equal(1);
            expect(pendingUploads[0]).to.equal(1);
        });
    });
    
    describe("Upload Status Management", function () {
        beforeEach(async function () {
            await uploadManager.connect(creator).requestUpload("temp://upload-123", 0);
            provisionalId = 1;
        });
        
        it("Should allow worker to update upload status", async function () {
            await expect(uploadManager.connect(worker).updateUploadStatus(provisionalId, 1)) // PROCESSING
                .to.emit(uploadManager, "UploadStatusUpdated");
            
            const request = await uploadManager.getUploadRequest(provisionalId);
            expect(request.status).to.equal(1); // PROCESSING
        });
        
        it("Should remove from pending queue when moving to processing", async function () {
            expect(await uploadManager.getPendingQueueLength()).to.equal(1);
            
            await uploadManager.connect(worker).updateUploadStatus(provisionalId, 1); // PROCESSING
            
            expect(await uploadManager.getPendingQueueLength()).to.equal(0);
        });
        
        it("Should reject status update from non-worker", async function () {
            await expect(
                uploadManager.connect(creator).updateUploadStatus(provisionalId, 1)
            ).to.be.revertedWithCustomError(uploadManager, "AccessControlUnauthorizedAccount");
        });
        
        it("Should reject invalid status transitions", async function () {
            await expect(
                uploadManager.connect(worker).updateUploadStatus(provisionalId, 2) // COMPLETED
            ).to.be.revertedWith("Use finalizeUpload for completion");
        });
    });
    
    describe("Upload Finalization", function () {
        beforeEach(async function () {
            await uploadManager.connect(creator).requestUpload("temp://upload-123", 0);
            provisionalId = 1;
            await uploadManager.connect(worker).updateUploadStatus(provisionalId, 1); // PROCESSING
        });
        
        it("Should allow worker to finalize upload", async function () {
            const hlsURI = "https://cdn.example.com/content/123.m3u8";
            const perceptualHash = ethers.keccak256(ethers.toUtf8Bytes("content-hash"));
            
            await expect(uploadManager.connect(worker).finalizeUpload(provisionalId, hlsURI, perceptualHash))
                .to.emit(uploadManager, "UploadFinalized");
            
            const request = await uploadManager.getUploadRequest(provisionalId);
            expect(request.status).to.equal(2); // COMPLETED
            expect(request.contentId).to.equal(1);
            expect(request.completedAt).to.be.greaterThan(0);
        });
        
        it("Should register content in ContentRegistry", async function () {
            const hlsURI = "https://cdn.example.com/content/123.m3u8";
            const perceptualHash = ethers.keccak256(ethers.toUtf8Bytes("content-hash"));
            
            await uploadManager.connect(worker).finalizeUpload(provisionalId, hlsURI, perceptualHash);
            
            // Check that content was registered
            const content = await contentRegistry.getContent(1);
            expect(content.creator).to.equal(await uploadManager.getAddress()); // UploadManager registers on behalf
            expect(content.perceptualHash).to.equal(perceptualHash);
        });
        
        it("Should reject finalization with invalid parameters", async function () {
            const perceptualHash = ethers.keccak256(ethers.toUtf8Bytes("content-hash"));
            
            await expect(
                uploadManager.connect(worker).finalizeUpload(provisionalId, "", perceptualHash)
            ).to.be.revertedWith("HLS URI cannot be empty");
            
            await expect(
                uploadManager.connect(worker).finalizeUpload(provisionalId, "https://example.com", ethers.ZeroHash)
            ).to.be.revertedWith("Perceptual hash cannot be empty");
        });
        
        it("Should reject finalization from non-processing status", async function () {
            // Reset to requested status
            await uploadManager.connect(worker).updateUploadStatus(provisionalId, 0); // REQUESTED
            
            await expect(
                uploadManager.connect(worker).finalizeUpload(
                    provisionalId,
                    "https://example.com",
                    ethers.keccak256(ethers.toUtf8Bytes("hash"))
                )
            ).to.be.revertedWith("Upload not in processing state");
        });
    });
    
    describe("Upload Failure Management", function () {
        beforeEach(async function () {
            await uploadManager.connect(creator).requestUpload("temp://upload-123", 0);
            provisionalId = 1;
        });
        
        it("Should allow worker to mark upload as failed", async function () {
            const reason = "Transcoding failed";
            
            await expect(uploadManager.connect(worker).failUpload(provisionalId, reason))
                .to.emit(uploadManager, "UploadFailed");
            
            const request = await uploadManager.getUploadRequest(provisionalId);
            expect(request.status).to.equal(3); // FAILED
            expect(request.completedAt).to.be.greaterThan(0);
        });
        
        it("Should remove from pending queue when failed", async function () {
            expect(await uploadManager.getPendingQueueLength()).to.equal(1);
            
            await uploadManager.connect(worker).failUpload(provisionalId, "Test failure");
            
            expect(await uploadManager.getPendingQueueLength()).to.equal(0);
        });
        
        it("Should reject empty failure reason", async function () {
            await expect(
                uploadManager.connect(worker).failUpload(provisionalId, "")
            ).to.be.revertedWith("Reason cannot be empty");
        });
    });
    
    describe("Upload Cancellation", function () {
        beforeEach(async function () {
            await uploadManager.connect(creator).requestUpload("temp://upload-123", 0);
            provisionalId = 1;
        });
        
        it("Should allow creator to cancel their upload", async function () {
            await expect(uploadManager.connect(creator).cancelUpload(provisionalId))
                .to.emit(uploadManager, "UploadStatusUpdated");
            
            const request = await uploadManager.getUploadRequest(provisionalId);
            expect(request.status).to.equal(4); // CANCELLED
        });
        
        it("Should allow admin to cancel any upload", async function () {
            await uploadManager.connect(owner).cancelUpload(provisionalId);
            
            const request = await uploadManager.getUploadRequest(provisionalId);
            expect(request.status).to.equal(4); // CANCELLED
        });
        
        it("Should reject cancellation from unauthorized user", async function () {
            await expect(
                uploadManager.connect(user).cancelUpload(provisionalId)
            ).to.be.revertedWith("Unauthorized to cancel upload");
        });
        
        it("Should reject cancellation of completed upload", async function () {
            // Complete the upload first
            await uploadManager.connect(worker).updateUploadStatus(provisionalId, 1); // PROCESSING
            await uploadManager.connect(worker).finalizeUpload(
                provisionalId,
                "https://example.com",
                ethers.keccak256(ethers.toUtf8Bytes("hash"))
            );
            
            await expect(
                uploadManager.connect(creator).cancelUpload(provisionalId)
            ).to.be.revertedWith("Cannot cancel completed upload");
        });
    });
    
    describe("Worker Management", function () {
        it("Should allow admin to add workers", async function () {
            const newWorker = user;
            
            await expect(uploadManager.addWorker(newWorker.address))
                .to.emit(uploadManager, "WorkerAdded");
            
            expect(await uploadManager.isAuthorizedWorker(newWorker.address)).to.be.true;
            
            const workers = await uploadManager.getAuthorizedWorkers();
            expect(workers).to.include(newWorker.address);
        });
        
        it("Should allow admin to remove workers", async function () {
            await expect(uploadManager.removeWorker(worker.address))
                .to.emit(uploadManager, "WorkerRemoved");
            
            expect(await uploadManager.isAuthorizedWorker(worker.address)).to.be.false;
            
            const workers = await uploadManager.getAuthorizedWorkers();
            expect(workers).to.not.include(worker.address);
        });
        
        it("Should reject adding invalid worker", async function () {
            await expect(
                uploadManager.addWorker(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid worker address");
            
            await expect(
                uploadManager.addWorker(worker.address)
            ).to.be.revertedWith("Worker already authorized");
        });
        
        it("Should reject removing non-worker", async function () {
            await expect(
                uploadManager.removeWorker(user.address)
            ).to.be.revertedWith("Worker not authorized");
        });
        
        it("Should restrict worker functions to workers only", async function () {
            await expect(
                uploadManager.connect(user).getPendingUploads(10)
            ).to.be.revertedWithCustomError(uploadManager, "AccessControlUnauthorizedAccount");
        });
    });
    
    describe("Creator Upload Queries", function () {
        beforeEach(async function () {
            // Create multiple uploads
            await uploadManager.connect(creator).requestUpload("temp://upload-1", 0);
            await uploadManager.connect(creator).requestUpload("temp://upload-2", 1);
            await uploadManager.connect(creator).requestUpload("temp://upload-3", 0);
        });
        
        it("Should return creator uploads with pagination", async function () {
            const uploads = await uploadManager.getCreatorUploads(creator.address, 0, 2);
            expect(uploads.length).to.equal(2);
            expect(uploads[0]).to.equal(1);
            expect(uploads[1]).to.equal(2);
            
            const moreUploads = await uploadManager.getCreatorUploads(creator.address, 2, 2);
            expect(moreUploads.length).to.equal(1);
            expect(moreUploads[0]).to.equal(3);
        });
        
        it("Should handle pagination edge cases", async function () {
            const emptyResult = await uploadManager.getCreatorUploads(creator.address, 10, 5);
            expect(emptyResult.length).to.equal(0);
            
            const allUploads = await uploadManager.getCreatorUploads(creator.address, 0, 100);
            expect(allUploads.length).to.equal(3);
        });
    });
    
    describe("Timeout Management", function () {
        it("Should clean up timed out uploads", async function () {
            // Create an upload
            await uploadManager.connect(creator).requestUpload("temp://upload-123", 0);
            
            // Set a very short timeout for testing
            await uploadManager.updateConfiguration(100, 1); // 1 second timeout
            
            // Wait for timeout
            await new Promise(resolve => setTimeout(resolve, 1100));
            
            const tx = await uploadManager.cleanupTimedOutUploads(10);
            const receipt = await tx.wait();
            
            // Check that the upload was marked as failed
            const request = await uploadManager.getUploadRequest(1);
            expect(request.status).to.equal(3); // FAILED
        });
        
        it("Should allow worker to clean up timeouts", async function () {
            await uploadManager.connect(creator).requestUpload("temp://upload-123", 0);
            await uploadManager.updateConfiguration(100, 1);
            
            await new Promise(resolve => setTimeout(resolve, 1100));
            
            await uploadManager.connect(worker).cleanupTimedOutUploads(10);
        });
        
        it("Should reject cleanup from unauthorized user", async function () {
            await expect(
                uploadManager.connect(user).cleanupTimedOutUploads(10)
            ).to.be.revertedWith("Unauthorized");
        });
    });
    
    describe("Configuration Management", function () {
        it("Should allow admin to update configuration", async function () {
            const newMaxPending = 50;
            const newTimeout = 12 * 60 * 60; // 12 hours
            
            await expect(uploadManager.updateConfiguration(newMaxPending, newTimeout))
                .to.emit(uploadManager, "ConfigurationUpdated");
            
            expect(await uploadManager.maxPendingUploads()).to.equal(newMaxPending);
            expect(await uploadManager.uploadTimeoutDuration()).to.equal(newTimeout);
        });
        
        it("Should reject invalid configuration", async function () {
            await expect(
                uploadManager.updateConfiguration(0, 3600)
            ).to.be.revertedWith("Max pending uploads must be greater than 0");
            
            await expect(
                uploadManager.updateConfiguration(100, 0)
            ).to.be.revertedWith("Timeout duration must be greater than 0");
            
            await expect(
                uploadManager.updateConfiguration(100, 8 * 24 * 60 * 60) // 8 days
            ).to.be.revertedWith("Timeout duration too long");
        });
        
        it("Should enforce max pending uploads limit", async function () {
            // Set limit to 1
            await uploadManager.updateConfiguration(1, 24 * 60 * 60);
            
            // First upload should succeed
            await uploadManager.connect(creator).requestUpload("temp://upload-1", 0);
            
            // Second upload should fail
            await expect(
                uploadManager.connect(creator).requestUpload("temp://upload-2", 0)
            ).to.be.revertedWith("Too many pending uploads");
        });
    });
    
    describe("Registry Updates", function () {
        it("Should allow admin to update registry addresses", async function () {
            // Deploy new mock registries (using existing contracts for simplicity)
            const NewContentRegistry = await ethers.getContractFactory("ContentRegistry");
            const newContentRegistry = await upgrades.deployProxy(NewContentRegistry, [
                await creatorRegistry.getAddress()
            ], {
                initializer: "initialize"
            });
            await newContentRegistry.waitForDeployment();
            
            await uploadManager.updateRegistries(
                await newContentRegistry.getAddress(),
                await creatorRegistry.getAddress()
            );
            
            expect(await uploadManager.contentRegistry()).to.equal(await newContentRegistry.getAddress());
        });
        
        it("Should reject invalid registry addresses", async function () {
            await expect(
                uploadManager.updateRegistries(ethers.ZeroAddress, await creatorRegistry.getAddress())
            ).to.be.revertedWith("Invalid content registry");
            
            await expect(
                uploadManager.updateRegistries(await contentRegistry.getAddress(), ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid creator registry");
        });
    });
    
    describe("Error Handling", function () {
        it("Should handle non-existent upload requests", async function () {
            await expect(
                uploadManager.getUploadRequest(999)
            ).to.be.revertedWith("Upload request does not exist");
            
            await expect(
                uploadManager.connect(worker).updateUploadStatus(999, 1)
            ).to.be.revertedWith("Upload request does not exist");
        });
        
        it("Should handle empty creator uploads", async function () {
            const uploads = await uploadManager.getCreatorUploads(user.address, 0, 10);
            expect(uploads.length).to.equal(0);
        });
    });
    
    describe("Access Control", function () {
        it("Should restrict admin functions to admin role", async function () {
            await expect(
                uploadManager.connect(user).addWorker(creator.address)
            ).to.be.revertedWithCustomError(uploadManager, "AccessControlUnauthorizedAccount");
            
            await expect(
                uploadManager.connect(user).updateConfiguration(50, 3600)
            ).to.be.revertedWithCustomError(uploadManager, "AccessControlUnauthorizedAccount");
        });
        
        it("Should restrict worker functions to worker role", async function () {
            await uploadManager.connect(creator).requestUpload("temp://upload-123", 0);
            
            await expect(
                uploadManager.connect(user).updateUploadStatus(1, 1)
            ).to.be.revertedWithCustomError(uploadManager, "AccessControlUnauthorizedAccount");
            
            await expect(
                uploadManager.connect(user).failUpload(1, "Test")
            ).to.be.revertedWithCustomError(uploadManager, "AccessControlUnauthorizedAccount");
        });
    });
    
    describe("Pausable Functionality", function () {
        it("Should pause and unpause contract", async function () {
            await uploadManager.pause();
            
            await expect(
                uploadManager.connect(creator).requestUpload("temp://upload-123", 0)
            ).to.be.revertedWithCustomError(uploadManager, "EnforcedPause");
            
            await uploadManager.unpause();
            
            // Should work after unpause
            await uploadManager.connect(creator).requestUpload("temp://upload-123", 0);
        });
        
        it("Should restrict pause functions to admin", async function () {
            await expect(
                uploadManager.connect(user).pause()
            ).to.be.revertedWithCustomError(uploadManager, "AccessControlUnauthorizedAccount");
        });
    });
});

