import { ethers, network, run } from "hardhat";

import { tryVerify, verifyContract } from "@sectafi/common/verify";
import { sleep } from "@sectafi/common/sleep";
import config from "../config";

const main = async () => {
  const { name } = network;

  // eslint-disable-next-line no-console
  console.log("Verifying on network:", name);

  const stakingAddress = "0x9E28CA686bFc8e88Cb3415B9e722c4bc79428227"; // update with corresponding address

  await verifyContract(stakingAddress, [
    config.OfferingToken[name],
    config.Boost[name],
    config.Duration[name],
    config.Penalty[name],
  ]);
  await sleep(10000);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
