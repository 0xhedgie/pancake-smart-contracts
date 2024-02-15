import { ethers } from 'hardhat'

const main = async () => {

  const SectaPair = await ethers.getContractFactory("SectaPair");

  const hash = ethers.utils.keccak256(SectaPair.bytecode)
  console.log(hash)
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
