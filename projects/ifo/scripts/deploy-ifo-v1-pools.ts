import { ethers, network, run } from "hardhat";
import { verifyContract } from "@sectafi/common/verify";
import { sleep } from "@sectafi/common/sleep";
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
    console.log("ethers.js version", ethers.version);

    const ifoV1 = await IFOV1.deploy(
      config.LPToken[name],
      config.OfferingToken[name],
      config.StartTimestamp[name],
      config.EndTimestamp[name],
      config.AdminAddress[name]
    );

    await ifoV1.deployed();
    console.log("IFOV1 deployed to:", ifoV1.address);

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const offeringToken = MockERC20.attach(config.OfferingToken[name]);

    // IFO Pool 0 private pool
    // 2_000_000 offering token
    const offeringAmountPool0 = ethers.utils.parseEther("2000000");
    // 200,000 usdc
    const raisingAmountPool0 = ethers.utils.parseUnits("200000", 6);

    // Transfer the offering total amount to the IFO contract

    await offeringToken.transfer(ifoV1.address, offeringAmountPool0);

    // Pool 0 is set
    await ifoV1.setPool(
      offeringAmountPool0,
      raisingAmountPool0,
      0, // limit
      false, // tax
      0, // id
      0,
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      { gasLimit: 1000000 }
    );

    // IFO Pool 1 public pool
    // 8_000_000 offering token
    const offeringAmountPool1 = ethers.utils.parseEther("8000000");
    // 800,000 usdc
    const raisingAmountPool1 = ethers.utils.parseUnits("800000", 6);

    // Transfer the offering total amount to the IFO contract
    await offeringToken.transfer(ifoV1.address, offeringAmountPool1);

    // Pool 1 is set
    await ifoV1.setPool(
      offeringAmountPool1,
      raisingAmountPool1,
      0, // limit
      false, // tax
      1, // id
      1,
      config.ROOT,
      { gasLimit: 1000000 }
    );
  }
};
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
