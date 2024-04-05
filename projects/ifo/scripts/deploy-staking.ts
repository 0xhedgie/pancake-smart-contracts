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

    const multiplier = ethers.utils.parseEther("2.5");
    const oneYear = 31536000;
    const penalty = 500;

    const staking = await Staking.deploy(config.OfferingToken[name], multiplier, oneYear, penalty);

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
