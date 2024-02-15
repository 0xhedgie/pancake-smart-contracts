import { ethers, network } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import config from "../../config";

const currentNetwork = network.name;

const main = async () => {
  console.log("Deploying to network:", currentNetwork);

  const _numberCakeToRegister = parseEther("1"); // 1 CAKE
  const _numberCakeToReactivate = parseEther("2"); // 2 CAKE
  const _numberCakeToUpdate = parseEther("2"); // 2 CAKE

  const SectaProfile = await ethers.getContractFactory("SectaProfile");

  const sectaProfile = await SectaProfile.deploy(
    config.CakeToken[currentNetwork],
    _numberCakeToReactivate,
    _numberCakeToRegister,
    _numberCakeToUpdate
  );

  console.log("SectaProfile deployed to:", sectaProfile.address);

  await sectaProfile.addTeam("Syrup Storm", "ipfs://QmamkDch4WBYGbchd6NV7MzPvG1NgWqWHNnYogdzreNtBn/syrup-storm.json");
  await sectaProfile.addTeam(
    "Fearsome Flippers",
    "ipfs://QmamkDch4WBYGbchd6NV7MzPvG1NgWqWHNnYogdzreNtBn/fearsome-flippers.json"
  );
  await sectaProfile.addTeam(
    "Chaotic Cakers",
    "ipfs://QmamkDch4WBYGbchd6NV7MzPvG1NgWqWHNnYogdzreNtBn/chaotic-cakers.json"
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
