const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockUSDC", function () {
  let mockUSDC;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await mockUSDC.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      expect(await mockUSDC.name()).to.equal("Mock USD Coin");
      expect(await mockUSDC.symbol()).to.equal("USDC");
    });

    it("Should have 6 decimals like real USDC", async function () {
      expect(await mockUSDC.decimals()).to.equal(6);
    });

    it("Should mint initial supply to owner", async function () {
      const balance = await mockUSDC.balanceOf(owner.address);
      expect(balance).to.equal(ethers.parseUnits("1000000", 6)); // 1M USDC
    });
  });

  describe("Faucet", function () {
    it("Should allow users to get USDC from faucet", async function () {
      await mockUSDC.connect(user1).faucet();
      const balance = await mockUSDC.balanceOf(user1.address);
      expect(balance).to.equal(ethers.parseUnits("1000", 6)); // 1000 USDC
    });

    it("Should not allow faucet if user already has enough USDC", async function () {
      await mockUSDC.connect(user1).faucet();
      await expect(mockUSDC.connect(user1).faucet()).to.be.revertedWith("Already has enough USDC");
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      await mockUSDC.mint(user1.address, 500); // 500 USDC
      const balance = await mockUSDC.balanceOf(user1.address);
      expect(balance).to.equal(ethers.parseUnits("500", 6));
    });

    it("Should not allow non-owner to mint tokens", async function () {
      await expect(mockUSDC.connect(user1).mint(user2.address, 500))
        .to.be.revertedWithCustomError(mockUSDC, "OwnableUnauthorizedAccount");
    });
  });

  describe("Permit functionality", function () {
    it("Should support ERC20Permit", async function () {
      const domain = await mockUSDC.eip712Domain();
      expect(domain.name).to.equal("Mock USD Coin");
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their tokens", async function () {
      await mockUSDC.connect(user1).faucet();
      const initialBalance = await mockUSDC.balanceOf(user1.address);
      
      await mockUSDC.connect(user1).burn(ethers.parseUnits("100", 6));
      const finalBalance = await mockUSDC.balanceOf(user1.address);
      
      expect(finalBalance).to.equal(initialBalance - ethers.parseUnits("100", 6));
    });
  });
});