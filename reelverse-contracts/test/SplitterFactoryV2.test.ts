import { expect } from "chai";
import { ethers } from "hardhat";

describe("SplitterFactoryV2", () => {
  it("enforces creator >= min bps and sum=100%", async () => {
    const [admin, publisher, creator, platform] = await ethers.getSigners();

    const USDC = await (await ethers.getContractFactory("MockUSDC")).connect(admin).deploy();
    await USDC.waitForDeployment();

    const Factory = await ethers.getContractFactory("SplitterFactoryV2");
    const factory = await Factory.connect(admin).deploy(admin.address, await USDC.getAddress());
    await factory.waitForDeployment();
    await (await factory.grantRole(await factory.PUBLISHER_ROLE(), publisher.address)).wait();

    // bad sum
    await expect(
      factory.connect(publisher).createSplitterForContent(1n, creator.address, [creator.address, platform.address], [8000, 1000], ethers.ZeroHash)
    ).to.be.revertedWith("sum!=100%");

    // bad creator bps
    await expect(
      factory.connect(publisher).createSplitterForContent(1n, creator.address, [creator.address, platform.address], [800, 9200], ethers.ZeroHash)
    ).to.be.revertedWith("creator<bps");
  });
});