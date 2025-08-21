import { ethers } from "hardhat";

async function main() {
  const contentId   = BigInt(process.env.CONTENT_ID!);
  const creator     = process.env.CREATOR!;
  const priceCents  = Number(process.env.PRICE_CENTS ?? "300");
  const geoMask     = Number(process.env.GEO_MASK ?? "0");
  const metaHashHex = process.env.META_HASH ?? ethers.ZeroHash;

  const factoryAddr  = process.env.FACTORY!;
  const registryAddr = process.env.REGISTRY!;

  const factory  = await ethers.getContractAt("SplitterFactoryV2", factoryAddr);
  const registry = await ethers.getContractAt("ContentRegistryV2", registryAddr);

  const platform = process.env.PLATFORM!;
  const payees = [creator, platform];
  const bps    = [9000, 1000];

  const tx1 = await factory.createSplitterForContent(
    contentId,
    creator,
    payees,
    bps,
    ethers.ZeroHash
  );
  const r1 = await tx1.wait();
  const ev = (r1!.logs as any[]).find((l) => l.fragment?.name === "SplitterCreated");
  const splitter = ev?.args?.splitter;

  const tx2 = await registry.registerContent(
    contentId, creator, splitter, priceCents, geoMask, metaHashHex as `0x${string}`
  );
  await tx2.wait();

  console.log("Splitter:", splitter);
  console.log("Content registered:", contentId.toString());
}

main().catch((e)=>{console.error(e);process.exit(1);});