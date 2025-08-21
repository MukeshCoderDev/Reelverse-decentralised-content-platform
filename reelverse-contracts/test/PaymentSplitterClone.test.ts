import { expect } from "chai";
import { ethers } from "hardhat";

describe("PaymentSplitterClone USDC-only", () => {
  it("splits 90/10 USDC", async () => {
    const [admin, publisher, creator, platform, buyer] = await ethers.getSigners();

    const USDC = await (await ethers.getContractFactory("MockUSDC")).connect(admin).deploy();
    await USDC.waitForDeployment();

    const Factory = await ethers.getContractFactory("SplitterFactoryV2");
    const factory = await Factory.connect(admin).deploy(admin.address, await USDC.getAddress());
    await factory.waitForDeployment();
    await (await factory.grantRole(await factory.PUBLISHER_ROLE(), publisher.address)).wait();

    const payees = [creator.address, platform.address];
    const bps = [9000, 1000];
    const contentId = 1n;
    await factory.connect(publisher).createSplitterForContent(contentId, creator.address, payees, bps, ethers.ZeroHash);
    const splitter = await factory.splitterOf(contentId);

    // fund with USDC
    await USDC.connect(admin).transfer(buyer.address, 1_000_000); // 1 USDC (6 decimals)
    await USDC.connect(buyer).approve(splitter, 1_000_000);
    await (await ethers.getContractAt("PaymentSplitterClone", splitter)).connect(buyer).depositUSDC(1_000_000);

    const ps = await ethers.getContractAt("PaymentSplitterClone", splitter);
    expect(await ps.pending(await USDC.getAddress(), creator.address)).to.eq(900_000);
    expect(await ps.pending(await USDC.getAddress(), platform.address)).to.eq(100_000);

    await ps.connect(creator).release(await USDC.getAddress());
    await ps.connect(platform).release(await USDC.getAddress());

    expect(await USDC.balanceOf(creator.address)).to.eq(900_000);
    expect(await USDC.balanceOf(platform.address)).to.eq(100_000);
  });
});