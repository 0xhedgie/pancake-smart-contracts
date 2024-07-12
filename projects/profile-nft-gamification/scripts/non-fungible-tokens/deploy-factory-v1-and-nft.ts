import { ethers, network } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import config from "../../config";

const currentNetwork = network.name;

const main = async () => {
  console.log("Deploying to network:", currentNetwork);

  const _totalSupplyDistributed = 600;
  const _cakePerBurn = parseEther("10");
  const _baseURI = "ipfs://";
  const _ipfsHash = "";
  const _endBlockTime = "";

  const BunnyMintingFarm = await ethers.getContractFactory("BunnyMintingFarm");

  const bunnyMintingFarm = await BunnyMintingFarm.deploy(
    config.CakeToken[currentNetwork],
    _totalSupplyDistributed,
    _cakePerBurn,
    _baseURI,
    _ipfsHash,
    _endBlockTime
  );

  await bunnyMintingFarm.deployed();
  console.log("BunnyMintingFarm deployed to:", bunnyMintingFarm.address);

  const sectaBunniesAddress = await bunnyMintingFarm.sectaBunnies();
  console.log("SectaBunnies deployed to:", sectaBunniesAddress);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
