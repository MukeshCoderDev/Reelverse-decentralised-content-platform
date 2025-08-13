const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("RevenueSplitter", function () {
    let revenueSplitter;
    let mockUSDC;
    let owner, creator, collaborator1, collaborator2, user;
    let splitterAddress;

    beforeEach(async function () {
        [owner, creator, collaborator1, collaborator2, user] = await ethers.getSigners();

        // Deploy MockUSDC
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockUSDC.deploy();
        await mockUSDC.waitForDeployment();

        // Deploy RevenueSplitter as upgradeable
        const RevenueSplitter = await ethers.getContractFactory("RevenueSplitter");
        revenueSplitter = await upgrades.deployProxy(RevenueSplitter, [], {
            initializer: "initialize",
        });
        await revenueSplitter.waitForDeployment();

        // Mint USDC to user for testing
        await mockUSDC.connect(user).faucet();
    });

    describe("Deployment", function () {
        it("Should initialize correctly", async function () {
            expect(await revenueSplitter.hasRole(await revenueSplitter.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
            expect(await revenueSplitter.MIN_CREATOR_BASIS_POINTS()).to.equal(9000);
            expect(await revenueSplitter.MAX_BASIS_POINTS()).to.equal(10000);
        });

        it("Should have correct version", async function () {
            expect(await revenueSplitter.version()).to.equal("1.0.0");
        });
    });

    describe("Splitter Configuration Validation", function () {
        it("Should validate correct 90/10 split", async function () {
            const payees = [creator.address, collaborator1.address];
            const basisPoints = [9000, 1000]; // 90% creator, 10% collaborator

            const isValid = await revenueSplitter.validateSplitterConfig(
                payees,
                basisPoints,
                creator.address
            );
            expect(isValid).to.be.true;
        });

        it("Should validate correct 95/5 split", async function () {
            const payees = [creator.address, collaborator1.address];
            const basisPoints = [9500, 500]; // 95% creator, 5% collaborator

            const isValid = await revenueSplitter.validateSplitterConfig(
                payees,
                basisPoints,
                creator.address
            );
            expect(isValid).to.be.true;
        });

        it("Should reject split with creator having less than 90%", async function () {
            const payees = [creator.address, collaborator1.address];
            const basisPoints = [8000, 2000]; // 80% creator, 20% collaborator

            const isValid = await revenueSplitter.validateSplitterConfig(
                payees,
                basisPoints,
                creator.address
            );
            expect(isValid).to.be.false;
        });

        it("Should reject split not summing to 100%", async function () {
            const payees = [creator.address, collaborator1.address];
            const basisPoints = [9000, 500]; // Only 95% total

            const isValid = await revenueSplitter.validateSplitterConfig(
                payees,
                basisPoints,
                creator.address
            );
            expect(isValid).to.be.false;
        });

        it("Should reject split without creator", async function () {
            const payees = [collaborator1.address, collaborator2.address];
            const basisPoints = [5000, 5000];

            const isValid = await revenueSplitter.validateSplitterConfig(
                payees,
                basisPoints,
                creator.address
            );
            expect(isValid).to.be.false;
        });

        it("Should reject empty payees array", async function () {
            const payees = [];
            const basisPoints = [];

            const isValid = await revenueSplitter.validateSplitterConfig(
                payees,
                basisPoints,
                creator.address
            );
            expect(isValid).to.be.false;
        });

        it("Should reject mismatched array lengths", async function () {
            const payees = [creator.address, collaborator1.address];
            const basisPoints = [9000]; // Missing second element

            const isValid = await revenueSplitter.validateSplitterConfig(
                payees,
                basisPoints,
                creator.address
            );
            expect(isValid).to.be.false;
        });

        it("Should reject zero address payees", async function () {
            const payees = [creator.address, ethers.ZeroAddress];
            const basisPoints = [9000, 1000];

            const isValid = await revenueSplitter.validateSplitterConfig(
                payees,
                basisPoints,
                creator.address
            );
            expect(isValid).to.be.false;
        });

        it("Should reject zero basis points", async function () {
            const payees = [creator.address, collaborator1.address];
            const basisPoints = [10000, 0];

            const isValid = await revenueSplitter.validateSplitterConfig(
                payees,
                basisPoints,
                creator.address
            );
            expect(isValid).to.be.false;
        });

        it("Should reject duplicate payees", async function () {
            const payees = [creator.address, creator.address];
            const basisPoints = [5000, 5000];

            const isValid = await revenueSplitter.validateSplitterConfig(
                payees,
                basisPoints,
                creator.address
            );
            expect(isValid).to.be.false;
        });
    });

    describe("Splitter Creation", function () {
        it("Should create splitter with valid configuration", async function () {
            const payees = [creator.address, collaborator1.address];
            const basisPoints = [9000, 1000];

            const tx = await revenueSplitter.connect(creator).createSplitter(payees, basisPoints);
            const receipt = await tx.wait();

            // Find SplitterCreated event
            const event = receipt.logs.find(log => {
                try {
                    const parsed = revenueSplitter.interface.parseLog(log);
                    return parsed.name === "SplitterCreated";
                } catch {
                    return false;
                }
            });

            expect(event).to.not.be.undefined;
            const parsedEvent = revenueSplitter.interface.parseLog(event);
            splitterAddress = parsedEvent.args.splitter;

            expect(await revenueSplitter.isSplitter(splitterAddress)).to.be.true;
            expect(await revenueSplitter.getSplitterCreator(splitterAddress)).to.equal(creator.address);
        });

        it("Should reject invalid configuration", async function () {
            const payees = [creator.address, collaborator1.address];
            const basisPoints = [8000, 2000]; // Creator has less than 90%

            await expect(
                revenueSplitter.connect(creator).createSplitter(payees, basisPoints)
            ).to.be.revertedWith("Invalid splitter config");
        });

        it("Should reject too many payees", async function () {
            const payees = new Array(11).fill(0).map((_, i) => 
                ethers.Wallet.createRandom().address
            );
            payees[0] = creator.address;
            
            const basisPoints = new Array(11).fill(0);
            basisPoints[0] = 9100;
            for (let i = 1; i < 11; i++) {
                basisPoints[i] = 90; // 0.9% each
            }

            await expect(
                revenueSplitter.connect(creator).createSplitter(payees, basisPoints)
            ).to.be.revertedWith("Too many payees");
        });

        it("Should emit correct events", async function () {
            const payees = [creator.address, collaborator1.address];
            const basisPoints = [9000, 1000];

            await expect(
                revenueSplitter.connect(creator).createSplitter(payees, basisPoints)
            ).to.emit(revenueSplitter, "SplitterCreated")
            .and.to.emit(revenueSplitter, "SplitterDeployed");
        });
    });

    describe("Splitter Information", function () {
        beforeEach(async function () {
            const payees = [creator.address, collaborator1.address];
            const basisPoints = [9000, 1000];

            const tx = await revenueSplitter.connect(creator).createSplitter(payees, basisPoints);
            const receipt = await tx.wait();

            const event = receipt.logs.find(log => {
                try {
                    const parsed = revenueSplitter.interface.parseLog(log);
                    return parsed.name === "SplitterCreated";
                } catch {
                    return false;
                }
            });

            const parsedEvent = revenueSplitter.interface.parseLog(event);
            splitterAddress = parsedEvent.args.splitter;
        });

        it("Should return correct splitter info", async function () {
            const [payees, basisPoints] = await revenueSplitter.getSplitterInfo(splitterAddress);
            
            expect(payees).to.deep.equal([creator.address, collaborator1.address]);
            expect(basisPoints).to.deep.equal([9000n, 1000n]);
        });

        it("Should return creator splitters", async function () {
            const splitters = await revenueSplitter.getCreatorSplitters(creator.address);
            expect(splitters).to.include(splitterAddress);
        });

        it("Should track total splitters", async function () {
            const totalBefore = await revenueSplitter.getTotalSplitters();
            
            // Create another splitter
            const payees = [creator.address, collaborator2.address];
            const basisPoints = [9500, 500];
            await revenueSplitter.connect(creator).createSplitter(payees, basisPoints);

            const totalAfter = await revenueSplitter.getTotalSplitters();
            expect(totalAfter).to.equal(totalBefore + 1n);
        });
    });

    describe("USDC Payment Distribution", function () {
        beforeEach(async function () {
            const payees = [creator.address, collaborator1.address];
            const basisPoints = [9000, 1000];

            const tx = await revenueSplitter.connect(creator).createSplitter(payees, basisPoints);
            const receipt = await tx.wait();

            const event = receipt.logs.find(log => {
                try {
                    const parsed = revenueSplitter.interface.parseLog(log);
                    return parsed.name === "SplitterCreated";
                } catch {
                    return false;
                }
            });

            const parsedEvent = revenueSplitter.interface.parseLog(event);
            splitterAddress = parsedEvent.args.splitter;
        });

        it("Should distribute USDC payments correctly", async function () {
            const paymentAmount = ethers.parseUnits("100", 6); // 100 USDC

            // Send USDC to splitter
            await mockUSDC.connect(user).transfer(splitterAddress, paymentAmount);

            // Check pending payments
            const creatorPending = await revenueSplitter.getPendingPayment(
                splitterAddress, 
                await mockUSDC.getAddress(), 
                creator.address
            );
            const collaboratorPending = await revenueSplitter.getPendingPayment(
                splitterAddress, 
                await mockUSDC.getAddress(), 
                collaborator1.address
            );

            expect(creatorPending).to.equal(ethers.parseUnits("90", 6)); // 90 USDC
            expect(collaboratorPending).to.equal(ethers.parseUnits("10", 6)); // 10 USDC

            // Release payments
            const creatorBalanceBefore = await mockUSDC.balanceOf(creator.address);
            const collaboratorBalanceBefore = await mockUSDC.balanceOf(collaborator1.address);

            await expect(
                revenueSplitter.release(splitterAddress, await mockUSDC.getAddress())
            ).to.emit(revenueSplitter, "PaymentReleased");

            const creatorBalanceAfter = await mockUSDC.balanceOf(creator.address);
            const collaboratorBalanceAfter = await mockUSDC.balanceOf(collaborator1.address);

            expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(ethers.parseUnits("90", 6));
            expect(collaboratorBalanceAfter - collaboratorBalanceBefore).to.equal(ethers.parseUnits("10", 6));
        });

        it("Should handle multiple payments correctly", async function () {
            const payment1 = ethers.parseUnits("100", 6);
            const payment2 = ethers.parseUnits("50", 6);

            // First payment
            await mockUSDC.connect(user).transfer(splitterAddress, payment1);
            await revenueSplitter.release(splitterAddress, await mockUSDC.getAddress());

            // Second payment
            await mockUSDC.connect(user).transfer(splitterAddress, payment2);
            
            const creatorPending = await revenueSplitter.getPendingPayment(
                splitterAddress, 
                await mockUSDC.getAddress(), 
                creator.address
            );
            
            expect(creatorPending).to.equal(ethers.parseUnits("45", 6)); // 90% of 50 USDC
        });

        it("Should release to specific payee", async function () {
            const paymentAmount = ethers.parseUnits("100", 6);
            await mockUSDC.connect(user).transfer(splitterAddress, paymentAmount);

            const creatorBalanceBefore = await mockUSDC.balanceOf(creator.address);

            await expect(
                revenueSplitter.releaseToPayee(
                    splitterAddress, 
                    await mockUSDC.getAddress(), 
                    creator.address
                )
            ).to.emit(revenueSplitter, "PaymentReleased");

            const creatorBalanceAfter = await mockUSDC.balanceOf(creator.address);
            expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(ethers.parseUnits("90", 6));
        });

        it("Should revert when no funds to release", async function () {
            await expect(
                revenueSplitter.release(splitterAddress, await mockUSDC.getAddress())
            ).to.be.revertedWith("No funds to release");
        });

        it("Should revert when releasing to non-existent payee", async function () {
            const paymentAmount = ethers.parseUnits("100", 6);
            await mockUSDC.connect(user).transfer(splitterAddress, paymentAmount);

            await expect(
                revenueSplitter.releaseToPayee(
                    splitterAddress, 
                    await mockUSDC.getAddress(), 
                    user.address
                )
            ).to.be.revertedWith("Payee not found");
        });
    });

    describe("ETH Payment Distribution", function () {
        beforeEach(async function () {
            const payees = [creator.address, collaborator1.address];
            const basisPoints = [9000, 1000];

            const tx = await revenueSplitter.connect(creator).createSplitter(payees, basisPoints);
            const receipt = await tx.wait();

            const event = receipt.logs.find(log => {
                try {
                    const parsed = revenueSplitter.interface.parseLog(log);
                    return parsed.name === "SplitterCreated";
                } catch {
                    return false;
                }
            });

            const parsedEvent = revenueSplitter.interface.parseLog(event);
            splitterAddress = parsedEvent.args.splitter;
        });

        it("Should distribute ETH payments correctly", async function () {
            const paymentAmount = ethers.parseEther("1.0");

            // Send ETH to splitter
            await user.sendTransaction({
                to: splitterAddress,
                value: paymentAmount
            });

            // Check pending payments
            const creatorPending = await revenueSplitter.getPendingPayment(
                splitterAddress, 
                ethers.ZeroAddress, 
                creator.address
            );
            const collaboratorPending = await revenueSplitter.getPendingPayment(
                splitterAddress, 
                ethers.ZeroAddress, 
                collaborator1.address
            );

            expect(creatorPending).to.equal(ethers.parseEther("0.9")); // 90%
            expect(collaboratorPending).to.equal(ethers.parseEther("0.1")); // 10%

            // Release payments
            const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);
            const collaboratorBalanceBefore = await ethers.provider.getBalance(collaborator1.address);

            await revenueSplitter.release(splitterAddress, ethers.ZeroAddress);

            const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);
            const collaboratorBalanceAfter = await ethers.provider.getBalance(collaborator1.address);

            expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(ethers.parseEther("0.9"));
            expect(collaboratorBalanceAfter - collaboratorBalanceBefore).to.equal(ethers.parseEther("0.1"));
        });
    });

    describe("Access Control", function () {
        it("Should allow admin to pause/unpause", async function () {
            await revenueSplitter.pause();
            expect(await revenueSplitter.paused()).to.be.true;

            await revenueSplitter.unpause();
            expect(await revenueSplitter.paused()).to.be.false;
        });

        it("Should prevent non-admin from pausing", async function () {
            await expect(
                revenueSplitter.connect(user).pause()
            ).to.be.reverted;
        });

        it("Should prevent operations when paused", async function () {
            await revenueSplitter.pause();

            const payees = [creator.address, collaborator1.address];
            const basisPoints = [9000, 1000];

            await expect(
                revenueSplitter.connect(creator).createSplitter(payees, basisPoints)
            ).to.be.revertedWithCustomError(revenueSplitter, "EnforcedPause");
        });
    });

    describe("Edge Cases", function () {
        it("Should handle creator with 100% share", async function () {
            const payees = [creator.address];
            const basisPoints = [10000];

            const isValid = await revenueSplitter.validateSplitterConfig(
                payees,
                basisPoints,
                creator.address
            );
            expect(isValid).to.be.true;

            await expect(
                revenueSplitter.connect(creator).createSplitter(payees, basisPoints)
            ).to.not.be.reverted;
        });

        it("Should handle multiple collaborators with minimum creator share", async function () {
            const payees = [creator.address, collaborator1.address, collaborator2.address];
            const basisPoints = [9000, 500, 500]; // 90%, 5%, 5%

            const isValid = await revenueSplitter.validateSplitterConfig(
                payees,
                basisPoints,
                creator.address
            );
            expect(isValid).to.be.true;
        });

        it("Should return zero for invalid splitter queries", async function () {
            const fakeAddress = ethers.Wallet.createRandom().address;
            
            expect(await revenueSplitter.isSplitter(fakeAddress)).to.be.false;
            expect(await revenueSplitter.getTotalReleased(fakeAddress, await mockUSDC.getAddress())).to.equal(0);
            expect(await revenueSplitter.getPendingPayment(fakeAddress, await mockUSDC.getAddress(), creator.address)).to.equal(0);
        });
    });
});