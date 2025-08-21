import { ethers } from "hardhat";

async function main() {
  const target = process.env.TARGET!;
  const role   = process.env.ROLE!;   // e.g., ADMIN_ROLE / PUBLISHER_ROLE / SIGNER_ROLE
  const grantee = process.env.GRANTEE!;

  const c = await ethers.getContractAt(role === "SIGNER_ROLE" ? "AccessGateV2" :
                                       role.endsWith("PUBLISHER_ROLE") || role.endsWith("ADMIN_ROLE") ? "ContentRegistryV2" :
                                       "ContentRegistryV2", target);

  const roleHash = await (c as any)[role]();
  const tx = await (c as any).grantRole(roleHash, grantee);
  await tx.wait();
  console.log("Granted", role, "to", grantee, "on", target);
}

main().catch((e)=>{console.error(e);process.exit(1);});