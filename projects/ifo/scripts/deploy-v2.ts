import { ethers, network, run } from "hardhat";

import { tryVerify, verifyContract } from "@sectafi/common/verify";
import { sleep } from "@sectafi/common/sleep";
import config from "../config";

const main = async () => {
  // Get network name: hardhat, testnet or mainnet.
  const { name } = network;
  if (name === "mainnet" || name === "testnet") {
    console.log(`Deploying to ${name} network...`);

    // Compile contracts.
    await run("compile");
    console.log("Compiled contracts");

    const IFODeployerV2 = await ethers.getContractFactory("IFODeployerV2");
    const ifoDeployer = await IFODeployerV2.deploy();

    await ifoDeployer.deployed();
    console.log("IFODeployerV2 deployed to:", ifoDeployer.address);

    const ifoTx = await ifoDeployer.createIFO(
      config.LPToken[name],
      config.OfferingToken[name],
      config.StartTimestamp[name],
      config.EndTimestamp[name],
      config.AdminAddress[name],
      config.StakingPool[name],
      1000000,
      { gasLimit: 10000000 }
    );

    console.log("Created an IFO v2 pool");

    console.log("Verifying IFODeployerV2 on network:", name);

    await tryVerify(ifoDeployer);
    await sleep(10000);

    const IFOV2 = await ethers.getContractFactory("IFOInitializableV2");
    const ifov2 = await IFOV2.deploy(ifoDeployer.address);

    await ifov2.deployed();
    console.log("IFOV2 deployed to:", ifov2.address);

    await tryVerify(ifov2, [ifoDeployer.address]);
    await sleep(1000);

    console.log(JSON.stringify({ IFODeployerV2: ifoDeployer.address }));
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
