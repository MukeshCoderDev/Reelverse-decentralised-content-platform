import { expect } from "chai";
import { ethers } from "hardhat";

describe("AccessGateV2", () => {
  it("verifies and consumes typed playback permits", async () => {
    const [admin, signer, creator, viewer] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("ContentRegistryV2");
    const r = await Registry.deploy(admin.address);
    await r.waitForDeployment();
    await (await r.grantRole(await r.PUBLISHER_ROLE(), admin.address)).wait();
    await r.registerContent(1n, creator.address, ethers.ZeroAddress, 300, 0, ethers.ZeroHash);

    const Gate = await ethers.getContractFactory("AccessGateV2");
    const g = await Gate.deploy(admin.address, await r.getAddress());
    await g.waitForDeployment();
    await (await g.grantRole(await g.SIGNER_ROLE(), signer.address)).wait();

    const domain = {
      name: "ReelverseAccess",
      version: "2",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await g.getAddress(),
    };
    const types = {
      PlaybackPermit: [
        { name: "viewer",    type: "address" },
        { name: "contentId", type: "uint256" },
        { name: "session",   type: "bytes32" },
        { name: "expiresAt", type: "uint256" },
      ],
    };
    const value = {
      viewer: viewer.address,
      contentId: 1n,
      session: ethers.id("session-1"),
      expiresAt: Math.floor(Date.now()/1000) + 3600,
    };

    const signature = await signer.signTypedData(domain, types, value);
    expect(await g.verifyTyped(value.viewer, value.contentId, value.session, value.expiresAt, signature)).to.eq(true);

    await g.consume(value.viewer, value.contentId, value.session, value.expiresAt, signature);
    expect(await g.isUsed(value.contentId, value.session)).to.eq(true);
  });
});