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

  const IFOV2 = await ethers.getContractFactory("IFOV2");

  if (name === "mainnet") {
    const ifoV2 = await IFOV2.deploy(
      config.LPToken[name],
      config.OfferingToken[name],
      config.StartBlock[name],
      config.EndBlock[name],
      config.AdminAddress[name]
    );

    await ifoV2.deployed();
    console.log("IFOV2 deployed to:", ifoV2.address);
  } else if (name === "testnet") {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const offeringToken = await MockERC20.deploy("HiYield Test Offering Coin", "HTOC", parseEther("10000000"));

    await offeringToken.deployed();
    console.log("OC32 token deployed to:", offeringToken.address);

    const ifoV2 = await IFOV2.deploy(
      config.LPToken[name],
      offeringToken.address,
      config.StartBlock[name],
      config.EndBlock[name],
      config.AdminAddress[name]
    );

    await ifoV2.deployed();
    console.log("IFOV2 deployed to:", ifoV2.address);
  }
};
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
