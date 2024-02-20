import { ethers, network, run } from "hardhat";

import { tryVerify, verifyContract } from '@sectafi/common/verify'
import { sleep } from '@sectafi/common/sleep'
import config from "../config";

const main = async () => {
  const networkName = network.name;

  console.log("Verifying on network:", networkName);

  const sectaFactoryAddress = "0x8Ad39bf99765E24012A28bEb0d444DE612903C43"
  const sectaRouterAddress = "0x4cB96E7f17eA50016dB841171a30899f0497c5dB"


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
