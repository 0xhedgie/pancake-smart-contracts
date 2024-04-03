import { ethers, network, run } from "hardhat";
import config from "../config";

const main = async () => {
  // Get network name: hardhat, testnet or mainnet.
  const { name } = network;
  console.log(`Deploying to ${name} network...`);

  // Compile contracts.
  await run("compile");
  console.log("Compiled contracts!");

  const IFOV2 = await ethers.getContractFactory("IFOV2");
  const ifoV2Address = "0xf1c36092a19cfABaAc70B58DD6807C85d1F6C85A"; // update with corresponding deployment address

  const ifoV2 = IFOV2.attach(ifoV2Address);

  // await ifoV2.forceUpdateStartAndEndBlocks(config.StartBlock[name], config.EndBlock[name]);

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const offeringToken = MockERC20.attach(config.OfferingToken[name]);

  // IFO Pool 0 private sale pool
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
    0,
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    { gasLimit: 1000000 }
  );

  // IFO Pool 1 basic sale pool
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
    1,
    1,
    "0x4551caae2a6eac153a77a43e19c04344a830bde8dfd0f139a4c585fe0c6e619f",
    { gasLimit: 1000000 }
  );
};
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
