import { ethers } from 'hardhat';
import { SessionKeyManagerModule } from '@biconomy/modules';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve(__dirname, '../../api/.env') });

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with the account:', deployer.address);

  const SessionKeyManagerModuleFactory = await ethers.getContractFactory('SessionKeyManagerModule');
  const sessionKeyManagerModule = await SessionKeyManagerModuleFactory.deploy();
  await sessionKeyManagerModule.waitForDeployment();

  console.log('SessionKeyManagerModule deployed to:', sessionKeyManagerModule.target);

  // You would typically update your .env file with this address
  console.log(`
    Please update your api/.env file with the following:
    SESSION_KEY_MANAGER_ADDRESS=${sessionKeyManagerModule.target}
  `);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });