import { ethers, network, run } from "hardhat";

import { tryVerify, verifyContract } from "@sectafi/common/verify";
import { sleep } from "@sectafi/common/sleep";
import config from "../config";

const main = async () => {
  const { name } = network;

  // eslint-disable-next-line no-console
  console.log("Verifying on network:", name);

  const stakingAddress = "0xa52AB458F6e568b7b320096d77A1191060DCb218"; // update with corresponding address

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
