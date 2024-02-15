# Secta Contracts 🥞

This repo contains all the contracts used in SectaFinance. It is divided in independent projects where each of them contains its smart contracts, test environment and unique config files.

## Existing projects

| Project name                                                          | Description                                                                                                                | Solidity version(s)      |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| [Exchange Protocol](./projects/exchange-protocol)                     | Based on Uniswap V2, it combines peripheral and core trading and liquidity protocols. It also adds new features like zaps. | 0.5.16 / 0.6.6 / 0.8.4   |
| [IFO](./projects/ifo)                                                 | Initial Farm Offerings.                                                                                                    | 0.6.12                   |
                                                                                | 0.6.12 (v1) / 0.8.4 (v2) |

## Create a new project

1 - Create a new folder inside `projects` <br/>
2 - Run `yarn init`

Commands inside the root `package.json` starting with `lerna` will run the corresponding command in each subproject.
