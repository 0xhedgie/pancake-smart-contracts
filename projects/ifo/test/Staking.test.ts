/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { parseUnits, parseEther } from "ethers/lib/utils";
import { artifacts, contract } from "hardhat";

import { assert } from "chai";
import { BN, expectEvent, expectRevert, time } from "@openzeppelin/test-helpers";

const Staking = artifacts.require("./Staking.sol");
const MockERC20 = artifacts.require("./utils/MockERC20.sol");

contract("Staking", async ([alice, bob, carol, ...accounts]) => {
  const multiplier = 25000;
  const baseMultiplier = 10000;
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

  describe("Staking #1", async () => {
    it("The Staking #1 is deployed and initialized", async () => {
      // Alice deploys the IFO setting herself as the contract admin
      mockStaking = await Staking.new(mockLP.address, multiplier, oneYear, penalty, {
        from: carol,
      });
    });

    it("approve Staking", async () => {
      for (const thisUser of [carol, bob]) {
        await mockLP.mintTokens(parseEther("1000"), { from: thisUser });

        await mockLP.approve(mockStaking.address, parseEther("1000"), {
          from: thisUser,
        });
      }
    });

    it("stake", async () => {
      await mockStaking.stake(parseEther("1000"), oneYear, { from: carol });

      assert.equal(await mockStaking.getPoints(carol), String(parseEther("1000")));

      await time.increase(oneYear);

      assert.equal(await mockStaking.getPoints(carol), String(parseEther("1000").mul(multiplier).div(baseMultiplier)));
    });

    it("unstake", async () => {
      await mockStaking.unstake(0, { from: carol });

      assert.equal((await mockLP.balanceOf(carol)).toString(), String(parseEther("1000")));

      assert.equal(await mockStaking.getPoints(carol), 0);

      await mockLP.approve(mockStaking.address, parseEther("1000"), { from: carol });
      await mockStaking.stake(parseEther("1000"), oneYear, { from: carol });

      await expectRevert(mockStaking.unstake(0, { from: bob }), "index < length");

      await mockStaking.unstake(0, { from: carol });

      assert.equal(
        await mockLP.balanceOf(carol),
        String(
          parseEther("1000")
            .mul(baseMultiplier - penalty)
            .div(baseMultiplier)
        )
      );

      assert.equal(await mockStaking.getPoints(carol), 0);
    });
  });
});
