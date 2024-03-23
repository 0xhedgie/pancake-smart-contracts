import { ethers, network, run } from "hardhat";

import { tryVerify, verifyContract } from "@sectafi/common/verify";
import { sleep } from "@sectafi/common/sleep";
import config from "../config";

const main = async () => {
  const { name } = network;

  // eslint-disable-next-line no-console
  console.log("Verifying on network:", name);

  const ifoV2Address = "0xd285a3D9ce1F44F4Ba2a6773eB64302a1E826569"; // update with corresponding address

  await verifyContract(ifoV2Address, [
    config.LPToken[name],
    config.OfferingToken[name],
    config.StartBlock[name],
    config.EndBlock[name],
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
