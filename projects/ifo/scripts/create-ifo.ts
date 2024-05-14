import { ethers, network, run } from "hardhat";

import { tryVerify, verifyContract } from "@sectafi/common/verify";
import { sleep } from "@sectafi/common/sleep";
import config from "../config";

const main = async () => {
  // Get network name: hardhat, testnet or mainnet.
  const { name } = network;
  if (name === "mainnet" || name === "testnet") {
    console.log(`Working on ${name} network...`);

    // Compile contracts.
    await run("compile");
    console.log("Compiled contracts");

    const IFODeployerV2 = await ethers.getContractFactory("IFODeployerV2");
    const ifoDeployerV2Address = "0xDF7F8078D5D5aC3dDADEcC122B44fBE70d54B9a8"; // update with corresponding deployment address
    const stakingPoolAddress = "0x9E28CA686bFc8e88Cb3415B9e722c4bc79428227"; // update with corresponding deployment address

    const ifoDeployerV2 = IFODeployerV2.attach(ifoDeployerV2Address);

    const ifoTx = await ifoDeployerV2.createIFO(
      config.LPToken[name],
      config.OfferingToken[name],
      config.StartTimestamp[name],
      config.EndTimestamp[name],
      config.AdminAddress[name],
      stakingPoolAddress,
      { gasLimit: 10000000 }
    );

    /* const ifoAddress = ifoTx.receipt.logs[2].args[0];
    console.log("IFODeployerV2 - created an IFO: ", ifoAddress);

    const IFOInitializableV2 = await ethers.getContractFactory("IFOInitializableV2");

    const ifoV2 = IFOInitializableV2.attach(ifoAddress);

    await tryVerify(ifoV2);
    sleep(1000); */
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
