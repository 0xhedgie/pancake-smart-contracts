import { ethers, network, run } from "hardhat";

import { tryVerify, verifyContract } from "@sectafi/common/verify";
import { sleep } from "@sectafi/common/sleep";
import { verify } from "crypto";
import config from "../config";

const main = async () => {
  // Get network name: hardhat, testnet or mainnet.
  const { name } = network;
  if (name === "mainnet" || name === "testnet") {
    console.log(`Verifying on ${name} network...`);

    // Compile contracts.
    await run("compile");
    console.log("Compiled contracts");

    const IFOV2 = await ethers.getContractFactory("IFOInitializableV2");
    const ifov2 = await IFOV2.deploy(config.IFODeployer[name]);

    await ifov2.deployed();
    console.log("IFOV2 deployed to:", ifov2.address);

    await verifyContract(ifov2.address, [config.IFODeployer[name]]);
    await sleep(1000);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
