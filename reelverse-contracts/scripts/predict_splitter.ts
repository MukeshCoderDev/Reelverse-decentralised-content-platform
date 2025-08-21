import { ethers } from "hardhat";

async function main() {
  const factoryAddr = process.env.FACTORY!;
  const contentId   = BigInt(process.env.CONTENT_ID!);
  const creator     = process.env.CREATOR!;
  const saltHintHex = process.env.SALT_HINT ?? ethers.ZeroHash;

  const factory = await ethers.getContractAt("SplitterFactoryV2", factoryAddr);
  const addr = await factory.predictSplitterAddress(contentId, creator, saltHintHex as `0x${string}`);
  console.log("Predicted splitter:", addr);
}

main().catch((e)=>{console.error(e);process.exit(1);});