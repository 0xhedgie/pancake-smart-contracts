import { ethers, network, run } from "hardhat";

import { tryVerify, verifyContract } from "@sectafi/common/verify";
import { sleep } from "@sectafi/common/sleep";
import config from "../config";

const main = async () => {
  const { name } = network;

  // eslint-disable-next-line no-console
  console.log("Verifying on network:", name);

  const stakingAddress = "0x08338c23cd633ca7c8e3a57372a3908498cf6853"; // update with corresponding address

  const multiplier = ethers.utils.parseEther("2.5");
  const oneYear = 31536000;
  const penalty = 500;

  await verifyContract(stakingAddress, [config.OfferingToken[name], multiplier, oneYear, penalty]);
  await sleep(10000);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
