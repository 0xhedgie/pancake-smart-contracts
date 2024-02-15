import { ethers, network, run } from "hardhat";

import { tryVerify } from '@sectafi/common/verify'
import { sleep } from '@sectafi/common/sleep'
import config from "../config";

const main = async () => {
  // Compile contracts
  await run("compile");
  console.log("Compiled contracts.");

  const networkName = network.name;

  console.log("Deploying to network:", networkName);

  // Deploy SectaFactory
  console.log("Deploying Secta Factory ..");

  const SectaFactory = await ethers.getContractFactory("SectaFactory");

  const sectaFactory = await SectaFactory.deploy();

  await sectaFactory.deployed();

  console.log("SectaFactory:", sectaFactory.address);

  // Deploy SectaFactory
  console.log("Deploying Secta Router ..");

  const SectaRouter = await ethers.getContractFactory("SectaRouter");

  const sectaRouter = await SectaRouter.deploy(
    sectaFactory.address,
    config.WETH[networkName]
  );

  await sectaRouter.deployed();

  console.log("SectaRouter:", sectaRouter.address);

  await tryVerify(sectaFactory)
  await sleep(10000)

  await tryVerify(sectaRouter, [sectaFactory.address, config.WETH[networkName]])
  await sleep(10000)
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
