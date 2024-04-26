import { ethers, network, run } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import config from "../config";

const main = async () => {
  // Get network name: hardhat, testnet or mainnet.
  const { name } = network;
  console.log(`Deploying to ${name} network...`);

  // Compile contracts.
  await run("compile");
  console.log("Compiled contracts!");

  const IFOV1 = await ethers.getContractFactory("IFOV1");

  if (name === "mainnet") {
    const ifoV1 = await IFOV1.deploy(
      config.LPToken[name],
      config.OfferingToken[name],
      config.StartTimestamp[name],
      config.EndTimestamp[name],
      config.AdminAddress[name]
    );

    await ifoV1.deployed();
    console.log("IFOV1 deployed to:", ifoV1.address);
  } else if (name === "testnet") {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const offeringToken = await MockERC20.deploy("Offering Coin", "HTOC", parseEther("10000000"));

    await offeringToken.deployed();
    console.log("OC32 token deployed to:", offeringToken.address);

    const ifoV1 = await IFOV1.deploy(
      config.LPToken[name],
      offeringToken.address,
      config.StartTimestamp[name],
      config.EndTimestamp[name],
      config.AdminAddress[name]
    );

    await ifoV1.deployed();
    console.log("IFOV1 deployed to:", ifoV1.address);
  }
};
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
