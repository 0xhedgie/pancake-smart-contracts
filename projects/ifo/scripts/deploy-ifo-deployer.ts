import { ethers, network, run } from "hardhat";

import { tryVerify, verifyContract } from "@sectafi/common/verify";
import { sleep } from "@sectafi/common/sleep";
import config from "../config";

const main = async () => {
  // Get network name: hardhat, testnet or mainnet.
  const { name } = network;
  if (name == "mainnet" || name == "testnet") {
    console.log(`Deploying to ${name} network...`);

    // Compile contracts.
    await run("compile");
    console.log("Compiled contracts");

    const IFODeployerV2 = await ethers.getContractFactory("IFODeployerV2");
    const ifoDeployer = await IFODeployerV2.deploy();

    await ifoDeployer.deployed();
    console.log("IFODeployerV2 deployed to:", ifoDeployer.address);

    await verifyContract(ifoDeployer.address);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
