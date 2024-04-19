/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { parseUnits, parseEther } from "ethers/lib/utils";
import { artifacts, contract } from "hardhat";

import { assert } from "chai";
import { BN, expectEvent, expectRevert, time } from "@openzeppelin/test-helpers";

const Staking = artifacts.require("./Staking.sol");
const MockERC20 = artifacts.require("./utils/MockERC20.sol");

contract("Staking", async ([alice, bob, carol, ...accounts]) => {
  const boost = 10000; // 100% = 2x
  const basePoints = 10000;
  const boosted = boost + basePoints;
  const oneYear = 31536000;
  const penalty = 500; // 5%

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
    it("The Staking #1 is deployed and initialized, approved Staking", async () => {
      // Alice deploys the IFO setting herself as the contract admin
      mockStaking = await Staking.new(mockLP.address, boost, oneYear, penalty, {
        from: carol,
      });

      for (const thisUser of [carol, bob]) {
        await mockLP.mintTokens(parseEther("1000"), { from: thisUser });

        await mockLP.approve(mockStaking.address, parseEther("1000"), {
          from: thisUser,
        });
      }

      console.log((await time.latest()) + oneYear);
    });

    it("stake", async () => {
      const startTime = Number(await time.latest());
      await mockStaking.createLock(parseEther("1000"), startTime + 1 + oneYear, { from: carol });

      assert.equal(await mockStaking.balanceOf(carol), String(parseEther("1000")));

      const userInfo = await mockStaking.getUserInfo(carol);

      assert.equal(userInfo[0].toString(), String(parseEther("1000")));
      assert.equal(userInfo[1], startTime + 1);
      assert.equal(userInfo[2], oneYear);

      await time.increase(oneYear);

      assert.equal(
        (await mockStaking.balanceOf(carol)).toString(),
        String(parseEther("1000").mul(boosted).div(basePoints))
      );
    });

    it("unstake", async () => {
      await mockStaking.withdrawAll({ from: carol });

      assert.equal((await mockLP.balanceOf(carol)).toString(), String(parseEther("1000")));

      assert.equal(await mockStaking.balanceOf(carol), 0);

      await mockLP.approve(mockStaking.address, parseEther("1000"), { from: carol });
      await mockStaking.createLock(parseEther("1000"), Number(await time.latest()) + oneYear, { from: carol });

      await mockStaking.withdrawAll({ from: carol });

      assert.equal(
        await mockLP.balanceOf(carol),
        String(
          parseEther("1000")
            .mul(basePoints - penalty)
            .div(basePoints)
        )
      );

      assert.equal(await mockStaking.balanceOf(carol), 0);
    });
  });
});
