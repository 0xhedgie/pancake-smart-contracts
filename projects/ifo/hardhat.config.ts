import type { HardhatUserConfig, NetworkUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-truffle5";
import "hardhat-abi-exporter";
import "hardhat-contract-sizer";
import "solidity-coverage";
import "dotenv/config";
import "@nomicfoundation/hardhat-verify";

const lineaTestnet: NetworkUserConfig = {
  url: "https://linea-sepolia.blockpi.network/v1/rpc/public",
  chainId: 59141,
  accounts: [process.env.KEY_TESTNET!],
};

const lineaMainnet: NetworkUserConfig = {
  url: "https://rpc.linea.build",
  chainId: 59144,
  accounts: [process.env.KEY_MAINNET!],
};

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    testnet: lineaTestnet,
    mainnet: lineaMainnet,
  },
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 99999,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  abiExporter: {
    path: "./data/abi",
    clear: true,
    flat: false,
  },
  etherscan: {
    apiKey: {
      testnet: process.env.ETHERSCAN_API_KEY!,
    },
    customChains: [
      {
        network: "testnet",
        chainId: 59141,
        urls: {
          apiURL: "https://api-sepolia.lineascan.build/api",
          browserURL: "https://sepolia.lineascan.build/",
        },
      },
      {
        network: "linea",
        chainId: 59144,
        urls: {
          apiURL: "https://api.lineascan.build/api",
          browserURL: "https://lineascan.build/",
        },
      },
    ],
  },
  sourcify: {
    // Disabled by default
    // Doesn't need an API key
    enabled: true,
  },
};

export default config;
