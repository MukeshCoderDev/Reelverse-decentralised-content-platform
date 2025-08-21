import { ethers } from "hardhat";

async function main() {
  const factoryAddr = process.env.FACTORY!;
  const factory = await ethers.getContractAt("SplitterFactoryV2", factoryAddr);
  const usdc = await factory.usdc();
  console.log("USDC:", usdc);
  console.log("Min Creator BPS:", (await factory.minCreatorBps()).toString());
}

main().catch((e)=>{console.error(e);process.exit(1);});