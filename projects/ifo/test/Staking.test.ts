/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { parseUnits, parseEther } from "ethers/lib/utils";
import { artifacts, contract } from "hardhat";

import { assert } from "chai";
import { BN, expectEvent, expectRevert, time } from "@openzeppelin/test-helpers";

const Staking = artifacts.require("./Staking.sol");
const MockERC20 = artifacts.require("./utils/MockERC20.sol");

contract("Staking", async ([alice, bob, ...accounts]) => {
  const multiplier = parseEther("2.5");
  const baseMultiplier = parseEther("1");
  const oneYear = 31536000;
  const penalty = 500;

  // Contracts
  let mockStaking;
  let mockLP;

  const _totalInitSupply = parseEther("5000000");

  before(async () => {
    // Deploy MockLP
    mockLP = await MockERC20.new("Mock LP", "LP", _totalInitSupply, {
      from: alice,
    });
  });

  describe("Staking #1 - Initial set up", async () => {
    it("The Staking #1 is deployed and initialized", async () => {
      // Alice deploys the IFO setting herself as the contract admin
      mockStaking = await Staking.new(mockLP.address, multiplier, oneYear, penalty, {
        from: alice,
      });
    });

    it("approve Staking", async () => {
      for (const thisUser of [alice, bob]) {
        await mockLP.mintTokens(parseEther("1000"), { from: thisUser });

        await mockLP.approve(mockStaking.address, parseEther("1000"), {
          from: thisUser,
        });
      }
    });

    it("stake", async () => {
      await mockStaking.stake(parseEther("1000"), oneYear, { from: alice });

      assert.equal(await mockStaking.getPoints(alice), String(parseEther("1000")));

      await time.increase(oneYear);

      assert.equal(await mockStaking.getPoints(alice), String(parseEther("1000").mul(multiplier).div(baseMultiplier)));
    });
  });
});
