/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { parseUnits, parseEther } from "ethers/lib/utils";
import { artifacts, contract } from "hardhat";

import { assert } from "chai";
import { BN, expectEvent, expectRevert, time } from "@openzeppelin/test-helpers";

const Staking = artifacts.require("./Staking.sol");
const MockERC20 = artifacts.require("./utils/MockERC20.sol");

contract("Staking", async ([alice, bob, carol, david, ...accounts]) => {
  const boost = 10000; // 100% = 2x
  const basePoints = 10000;
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

      console.log("Current Timestamp", (await time.latest()) + oneYear);
    });

    it("stake", async () => {
      const startTime = Number(await time.latest());
      await mockStaking.createLock(parseEther("1000"), { from: carol });

      assert.equal(await mockStaking.balanceOf(carol), 0);

      const userInfo = await mockStaking.getUserInfo(carol);

      assert.equal(userInfo[0].toString(), String(parseEther("1000")));
      assert.equal(userInfo[1], startTime + 1);

      await time.increase(oneYear);

      assert.equal(
        (await mockStaking.balanceOf(carol)).toString(),
        String(parseEther("1000").mul(boost).div(basePoints))
      );
    });

    it("unstake", async () => {
      await mockStaking.withdrawAll({ from: carol });

      assert.equal(
        (await mockLP.balanceOf(carol)).toString(),
        String(
          parseEther("1000")
            .mul(basePoints - penalty)
            .div(basePoints)
        )
      );

      assert.equal(await mockStaking.balanceOf(carol), 0);

      await mockLP.mintTokens(parseEther("1000"), { from: carol });
      await mockLP.approve(mockStaking.address, parseEther("1000"), { from: carol });
      await mockStaking.createLock(parseEther("1000"), { from: carol });

      await mockStaking.withdrawAll({ from: carol });

      assert.equal(
        await mockLP.balanceOf(carol),
        String(
          parseEther("2000")
            .mul(basePoints - penalty)
            .div(basePoints)
        )
      );

      assert.equal(await mockStaking.balanceOf(carol), 0);
    });

    it("unstake & stake", async () => {
      assert.equal((await mockLP.balanceOf(bob)).toString(), parseEther("1000").toString());

      assert.equal(await mockStaking.balanceOf(bob), 0);

      await mockStaking.createLock(parseEther("1000"), { from: bob });

      await mockStaking.withdraw(parseEther("1000"), { from: bob });

      assert.equal(
        (await mockLP.balanceOf(bob)).toString(),
        String(
          parseEther("1000")
            .mul(basePoints - penalty)
            .div(basePoints)
        )
      );

      assert.equal(await mockStaking.balanceOf(bob), 0);

      await mockLP.approve(mockStaking.address, parseEther("500"), { from: bob });
      await mockStaking.createLock(parseEther("500"), { from: bob });

      assert.equal(await mockStaking.balanceOf(bob), 0);
    });

    it("withdrawFee", async () => {
      assert.equal(await mockLP.balanceOf(david), 0);

      const fee = await mockStaking.protocolFee();
      console.log("current fee:", fee.toString());

      await expectRevert(mockStaking.withdrawFee(david, { from: alice }), "Ownable: caller is not the owner");

      console.log("after first try (rever): ", (await mockStaking.protocolFee()).toString());
      await mockStaking.withdrawFee(david, { from: carol });

      console.log("after second try: ", (await mockStaking.protocolFee()).toString());
      assert.equal((await mockLP.balanceOf(david)).toString(), fee);
    });
  });
});
