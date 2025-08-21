import { expect } from "chai";
import { ethers } from "hardhat";

describe("ContentRegistryV2", () => {
  it("registers and updates content", async () => {
    const [admin, publisher, creator] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("ContentRegistryV2");
    const r = await Registry.deploy(admin.address);
    await r.waitForDeployment();
    await (await r.grantRole(await r.PUBLISHER_ROLE(), publisher.address)).wait();
    await r.connect(publisher).registerContent(1n, creator.address, ethers.ZeroAddress, 300, 0, ethers.ZeroHash);
    const data = await r.getContent(1n);
    expect(data[0]).to.eq(creator.address);
    await r.connect(creator).setPrice(1n, 500);
    const data2 = await r.getContent(1n);
    expect(data2[2]).to.eq(500);
  });
});