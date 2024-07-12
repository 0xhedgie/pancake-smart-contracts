import { ethers, network, run } from "hardhat";

import { tryVerify, verifyContract } from "@sectafi/common/verify";
import { sleep } from "@sectafi/common/sleep";
import config from "../config";

const main = async () => {
  const { name } = network;

  // eslint-disable-next-line no-console
  console.log("Verifying on network:", name);

  const pairAddress = "0x1Ceb5573F53538a65dC47FAe77dEDD984f717892";

  await verifyContract(pairAddress);
  await sleep(10000);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
