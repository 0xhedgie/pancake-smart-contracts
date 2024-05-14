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

    const ifoV2 = await ethers.getContractFactory("IFOInitializableV2");
    const ifo = await ifoV2.deploy("0xDF7F8078D5D5aC3dDADEcC122B44fBE70d54B9a8");

    await ifo.deployed();
    console.log("ifoV2 deployed to:", ifo.address);

    await verifyContract(ifo.address, ["0xDF7F8078D5D5aC3dDADEcC122B44fBE70d54B9a8"]);
    await sleep(1000);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
