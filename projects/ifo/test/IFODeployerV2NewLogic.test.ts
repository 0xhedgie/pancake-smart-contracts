import { parseUnits, parseEther } from "ethers/lib/utils";
import { artifacts, contract } from "hardhat";

import { assert } from "chai";
import { BN, expectEvent, expectRevert, time, ether } from "@openzeppelin/test-helpers";

const IFOInitializableV2 = artifacts.require("./IFOInitializableV2.sol");
const IFODeployerV2 = artifacts.require("./IFODeployerV2.sol");
const StakingPool = artifacts.require("./Staking.sol");

const MockERC20 = artifacts.require("./utils/MockERC20.sol");

contract("IFO DeployerV2", ([alice, bob, carol, david, erin, frank, ...accounts]) => {
  // SectaProfile
  const _totalInitSupply = parseEther("5000000"); // 50 SECTA

  // IFO block times
  let _startTimestamp;
  let _endTimestamp;

  // IFO Pool 0
  const offeringAmountPool0 = parseEther("50");
  const raisingAmountPool0 = parseEther("5");
  const limitPerUserInLp = parseEther("0.5");

  // IFO Pool 1
  const offeringAmountPool1 = parseEther("1000");
  const raisingAmountPool1 = parseEther("100");

  // offeringAmountPool0 + offeringAmountPool1
  const offeringTotalAmount = offeringAmountPool0.add(offeringAmountPool1);
  const raisingAmountTotal = parseEther("105");

  // VARIABLES
  const boost = 10000; // 100% = 2x
  const basePoints = 10000;
  const oneYear = 31536000;
  const penalty = 500; // 5%

  // Contracts
  let mockSecta;
  let mockIFO;
  let mockOC;
  let mockLP;
  let deployer;
  let stakingPool;

  // Generic result variable
  let result;

  before(async () => {
    // Deploy MockSECTA
    mockSecta = await MockERC20.new("Mock SECTA", "SECTA", _totalInitSupply);

    // Deploy MockLP
    mockLP = await MockERC20.new("Mock LP", "LP", _totalInitSupply, {
      from: alice,
    });

    // Deploy MockOfferingCoin (100M initial supply)
    mockOC = await MockERC20.new("Mock Offering Coin", "OC", parseEther("100000000"), {
      from: alice,
    });

    stakingPool = await StakingPool.new(mockSecta.address, boost, oneYear, penalty, { from: alice });

    // grant credits
    for (const user of [bob, carol]) {
      // Mint secta to all users
      await mockSecta.mint(user, ether("1000000"), { from: frank });

      // Approves secta to be spent by IFOPool
      await mockSecta.approve(stakingPool.address, parseEther("1000000"), {
        from: user,
      });

      await stakingPool.createLock(ether("1000000"), { from: user });
    }
  });

  describe("Initial contract parameters for all contracts", async () => {
    it("LP token is minted", async () => {
      for (const user of [alice, bob, carol, david, erin, frank, ...accounts]) {
        await mockLP.mint(user, ether("1000000"), { from: frank });
      }
    });
  });

  describe("IFO DeployerV2 #0 - Initial set up", async () => {
    it("The IFODeployerV2 is deployed and initialized", async () => {
      deployer = await IFODeployerV2.new({
        from: alice,
      });
    });
  });
  /*
   * IFO 1 - OVERFLOW
   * Pool 0 : Overflow with 1.6x overflow
   * Pool 1: Overflow with 10x overflow
   */

  describe("IFO #1 - Initial set up", async () => {
    it("The IFO #1 is deployed and initialized", async () => {
      _startTimestamp = new BN(await time.latest()).add(new BN("50"));
      _endTimestamp = new BN(await time.latest()).add(new BN("2950"));

      // Alice deploys the IFO setting herself as the contract admin
      let result = await deployer.createIFO(
        mockLP.address,
        mockOC.address,
        _startTimestamp,
        _endTimestamp,
        alice,
        stakingPool.address,
        1000000,
        {
          from: alice,
        }
      );

      const ifoAddress = result.receipt.logs[2].args[0];

      expectEvent(result, "NewIFOContract", { ifoAddress });

      mockIFO = await IFOInitializableV2.at(ifoAddress);

      await expectRevert(
        mockIFO.updateStartAndEndTimestamps(_endTimestamp, _startTimestamp, { from: alice }),
        "Operations: New startTimestamp must be lower than new endTimestamp"
      );

      result = await mockIFO.updateStartAndEndTimestamps(_startTimestamp, _endTimestamp, { from: alice });

      expectEvent(result, "NewStartAndEndTimestamps", { startTimestamp: _startTimestamp, endTimestamp: _endTimestamp });
    });

    it("Mock IFO is deployed without pools set", async () => {
      result = await mockIFO.viewUserAllocationPools(alice, ["0", "1"]);
      assert.equal(result[0].toString(), "0");
      assert.equal(result[1].toString(), "0");

      result = await mockIFO.viewUserInfo(alice, ["0", "1"]);
      assert.equal(result[0][0].toString(), "0");
      assert.equal(result[0][1].toString(), "0");
      assert.equal(result[1][0], false);
      assert.equal(result[1][1], false);

      assert.equal(String(await mockIFO.viewPoolTaxRateOverflow("0")), "0");
      assert.equal(String(await mockIFO.viewPoolTaxRateOverflow("1")), "0"); // Pool isn't set yet, nor in overflow

      result = await mockIFO.viewUserOfferingAndRefundingAmountsForPools(alice, [0, 1]);

      assert.equal(result[0][0].toString(), "0");
      assert.equal(result[0][1].toString(), "0");
      assert.equal(result[0][2].toString(), "0");
      assert.equal(result[1][0].toString(), "0");
      assert.equal(result[1][1].toString(), "0");
      assert.equal(result[1][2].toString(), "0");
    });

    it("Pools are set", async () => {
      assert.deepEqual(
        raisingAmountPool0.div(offeringAmountPool0),
        raisingAmountPool1.div(offeringAmountPool1),
        "MUST_BE_EQUAL_PRICES"
      );

      result = await mockIFO.setPool(
        offeringAmountPool0,
        raisingAmountPool0,
        limitPerUserInLp,
        false, // tax
        "0",
        0,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        { from: alice }
      );

      expectEvent(result, "PoolParametersSet", {
        offeringAmountPool: String(offeringAmountPool0),
        raisingAmountPool: String(raisingAmountPool0),
        pid: String(0),
      });

      assert.equal(String(await mockIFO.totalTokensOffered()), String(offeringAmountPool0));

      assert.equal(String(await mockIFO.viewPoolTaxRateOverflow("0")), "0");

      result = await mockIFO.setPool(
        offeringAmountPool1,
        raisingAmountPool1,
        "0",
        true, // tax
        "1",
        2,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        { from: alice }
      );

      assert.equal(String(await mockIFO.viewPoolTaxRateOverflow("1")), "10000000000");

      expectEvent(result, "PoolParametersSet", {
        offeringAmountPool: String(offeringAmountPool1),
        raisingAmountPool: String(raisingAmountPool1),
        pid: String(1),
      });

      assert.equal(String(await mockIFO.totalTokensOffered()), String(offeringTotalAmount));
    });

    it("All users are approving the tokens to be spent by the IFO", async () => {
      // Bob, Carol, David, Erin
      for (const thisUser of [bob, carol, david, erin]) {
        await mockLP.approve(mockIFO.address, parseEther("1000"), {
          from: thisUser,
        });
      }

      // 14 generic accounts too
      for (const thisUser of accounts) {
        // Approves LP to be spent by mockIFO
        await mockLP.approve(mockIFO.address, parseEther("1000"), {
          from: thisUser,
        });
      }
    });
  });

  describe("IFO with public sale (staking boost)", async () => {
    it("User (Bob) cannot deposit when credit used up", async () => {
      // Transfer the offering total amount to the IFO contract
      await mockOC.transfer(mockIFO.address, await mockIFO.totalTokensOffered(), {
        from: alice,
      });

      await time.increaseTo(_startTimestamp);

      await expectRevert(
        mockIFO.depositPool(parseEther("0.6"), "0", [], { from: bob }),
        "Deposit: New amount above user limit"
      );

      console.log("approximate boost points: ", (await stakingPool.balanceOf(bob)).toString());
      console.log("exact boost points: ", (await stakingPool.balanceOfAtTime(bob, _startTimestamp)).toString());
      console.log("staking token decimals: ", (await stakingPool.tokenDecimals()).toString());
      console.log("lp token decimals: ", (await mockIFO.lpTokenDecimals()).toString());

      await expectRevert(mockIFO.depositPool(parseEther("3"), "1", [], { from: bob }), "Not enough staking boost");

      result = await mockIFO.depositPool(parseEther("1"), "1", [], { from: bob });
      expectEvent(result, "Deposit", {
        user: bob,
        amount: String(parseEther("1")),
        pid: String(1),
      });

      await expectRevert(mockIFO.depositPool(parseEther("2"), "1", [], { from: bob }), "Not enough staking boost");

      result = await mockIFO.depositPool(parseEther("1"), "1", [], { from: bob });
      expectEvent(result, "Deposit", {
        user: bob,
        amount: String(parseEther("1")),
        pid: String(1),
      });

      await expectRevert(mockIFO.depositPool(parseEther("0.5"), "1", [], { from: bob }), "Not enough staking boost");

      result = await mockIFO.depositPool(parseEther("0.5"), "0", [], { from: bob });
      expectEvent(result, "Deposit", {
        user: bob,
        amount: String(parseEther("0.5")),
        pid: String(0),
      });
    });
  });
});
