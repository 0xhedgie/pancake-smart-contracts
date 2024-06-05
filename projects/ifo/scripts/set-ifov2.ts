import { ethers, network, run } from "hardhat";
import config from "../config";

const main = async () => {
  // Get network name: hardhat, testnet or mainnet.
  const { name } = network;
  console.log(`Setting on ${name} network...`);

  const IFOV2 = await ethers.getContractFactory("IFOInitializableV2");
  const ifoV2Address = "0xadb044D26afd3B85a3733648Ec745dcAb24d1631"; // update with corresponding deployment address

  const ifoV2 = IFOV2.attach(ifoV2Address);

  await ifoV2.forceUpdateStartAndEndTimestamps(config.StartTimestamp[name], config.EndTimestamp[name]);

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const offeringToken = MockERC20.attach(config.OfferingToken[name]);

  /* ======================================================================== */

  // IFO Pool 0 basic sale pool
  // 2_000_000 offering token
  const offeringAmountPool0 = ethers.utils.parseEther("2000000");
  // 200,000 usdc
  const raisingAmountPool0 = ethers.utils.parseUnits("200000", 6);

  // Transfer the offering total amount to the IFO contract
  await offeringToken.transfer(ifoV2.address, offeringAmountPool0);

  // Pool 0 is set
  await ifoV2.setPool(
    offeringAmountPool0,
    raisingAmountPool0,
    0, // limit
    false, // tax
    0, // id
    0, // basic
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    { gasLimit: 1000000 }
  );

  /* ======================================================================== */

  // IFO Pool 1 private sale pool
  // 8_000_000 offering token
  const offeringAmountPool1 = ethers.utils.parseEther("8000000");
  // 800,000 usdc
  const raisingAmountPool1 = ethers.utils.parseUnits("800000", 6);

  // Transfer the offering total amount to the IFO contract
  await offeringToken.transfer(ifoV2.address, offeringAmountPool1);

  // Pool 1 is set
  await ifoV2.setPool(
    offeringAmountPool1,
    raisingAmountPool1,
    0,
    false, // tax
    1, // id
    1,
    config.ROOT,
    { gasLimit: 1000000 }
  );

  /* ======================================================================== */

  // IFO Pool 2 public sale pool
  // 5_000_000 offering token
  const offeringAmountPool2 = ethers.utils.parseEther("5000000");
  // 500,000 usdc
  const raisingAmountPool2 = ethers.utils.parseUnits("500000", 6);

  // Transfer the offering total amount to the IFO contract
  // await offeringToken.transfer(ifoV2.address, offeringAmountPool2);

  // Pool 0 is set
  await ifoV2.setPool(
    offeringAmountPool2,
    raisingAmountPool2,
    0, // limit
    false, // tax
    2, // id
    2,
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    { gasLimit: 1000000 }
  );
};
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
