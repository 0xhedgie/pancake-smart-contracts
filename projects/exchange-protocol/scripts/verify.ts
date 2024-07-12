import { ethers, network, run } from "hardhat";

import { tryVerify, verifyContract } from '@sectafi/common/verify'
import { sleep } from '@sectafi/common/sleep'
import config from "../config";

const main = async () => {
  const networkName = network.name;

  console.log("Verifying on network:", networkName);

  const sectaFactoryAddress = config.SectaFactory[networkName]
  const sectaRouterAddress = config.SectaRouter[networkName]


  await verifyContract(sectaFactoryAddress)
  await sleep(10000)

  await verifyContract(sectaRouterAddress, [sectaFactoryAddress, config.WETH[networkName]])
  await sleep(10000)
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
