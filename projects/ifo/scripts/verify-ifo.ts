import { ethers, network, run } from "hardhat";

import { tryVerify, verifyContract } from "@sectafi/common/verify";
import { sleep } from "@sectafi/common/sleep";
import config from "../config";

const main = async () => {
  const { name } = network;

  // eslint-disable-next-line no-console
  console.log("Verifying on network:", name);

  const ifoV2Address = "0xa77f29e4fCb594D5986FE5ab5C1E1c00D72Ede39"; // update with corresponding address

  await verifyContract(ifoV2Address, [
    config.LPToken[name],
    config.OfferingToken[name],
    config.StartTimestamp[name],
    config.EndTimestamp[name],
    config.AdminAddress[name],
  ]);
  await sleep(10000);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
