import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  const admin      = process.env.ADMIN      ?? deployer.address;
  const publisher  = process.env.PUBLISHER  ?? deployer.address;
  const moderator  = process.env.MODERATOR  ?? deployer.address;
  const accessSigner = process.env.ACCESS_SIGNER ?? deployer.address;
  const usdc       = process.env.USDC_ADDRESS!; // required

  if (!usdc) throw new Error("USDC_ADDRESS missing");

  console.log("Deployer:", deployer.address);

  const Registry = await ethers.getContractFactory("ContentRegistryV2");
  const registry = await Registry.deploy(admin);
  await registry.waitForDeployment();

  const Factory = await ethers.getContractFactory("SplitterFactoryV2");
  const factory = await Factory.deploy(admin, usdc);
  await factory.waitForDeployment();

  const Gate = await ethers.getContractFactory("AccessGateV2");
  const gate = await Gate.deploy(admin, await registry.getAddress());
  await gate.waitForDeployment();

  // Roles
  await (await registry.grantRole(await registry.ADMIN_ROLE(), admin)).wait();
  await (await registry.grantRole(await registry.PUBLISHER_ROLE(), publisher)).wait();
  await (await registry.grantRole(await registry.MODERATOR_ROLE(), moderator)).wait();

  await (await factory.grantRole(await factory.ADMIN_ROLE(), admin)).wait();
  await (await factory.grantRole(await factory.PUBLISHER_ROLE(), publisher)).wait();

  await (await gate.grantRole(await gate.ADMIN_ROLE(), admin)).wait();
  await (await gate.grantRole(await gate.SIGNER_ROLE(), accessSigner)).wait();

  const out = {
    network: (await ethers.provider.getNetwork()).name,
    registry: await registry.getAddress(),
    factory: await factory.getAddress(),
    gate: await gate.getAddress(),
    usdc,
    timestamp: Date.now()
  };
  console.log(out);

  // write to exports/
  const file = `exports/${(await ethers.provider.getNetwork()).chainId}.json`;
  fs.mkdirSync("exports", { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("Saved:", file);
}

main().catch((e) => { console.error(e); process.exit(1); });