import { ethers, network, run } from "hardhat";
import config from "../config";

const main = async () => {
  // Get network name: hardhat, testnet or mainnet.
  const { name } = network;
  if (name === "mainnet" || name === "testnet") {
    console.log(`Deploying to ${name} network...`);

    // Compile contracts.
    await run("compile");
    console.log("Compiled contracts");

    const Staking = await ethers.getContractFactory("Staking");

    const staking = await Staking.deploy(
      config.OfferingToken[name],
      config.Boost[name],
      config.Duration[name],
      config.Penalty[name]
    );

    await staking.deployed();
    console.log("Staking deployed to:", staking.address);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
