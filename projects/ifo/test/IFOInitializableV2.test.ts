import { parseUnits, parseEther } from "ethers/lib/utils";
import { artifacts, contract } from "hardhat";

import { assert } from "chai";
import { BN, expectEvent, expectRevert, time, ether } from "@openzeppelin/test-helpers";

const MockERC20 = artifacts.require("./utils/MockERC20.sol");
const IFOInitializableV2 = artifacts.require("./IFOInitializableV2.sol");

contract("IFO Initializable v2", ([alice, bob, carol, ...accounts]) => {
  const _totalInitSupply = parseEther("5000000");

  const MAX_DURATION = time.duration.days(31);

  // VARIABLES
  let startTimestamp;
  let endTimestamp;
  let multiplier = 1000000;

  // Contracts
  let mockSecta;
  let mockIFO;
  let mockLP;

  before(async () => {
    startTimestamp = (await time.latest()) + 1000;
    endTimestamp = startTimestamp + time.duration.days(5);

    // Deploy MockSECTA
    mockSecta = await MockERC20.new("Mock SECTA", "SECTA", _totalInitSupply);

    // Deploy MockLP
    mockLP = await MockERC20.new("Mock LP", "LP", _totalInitSupply, {
      from: alice,
    });

    // Deploy Mock Bunnies
    mockIFO = await IFOInitializableV2.new(alice, { from: alice });
    await mockIFO.initialize(
      mockLP.address,
      mockSecta.address,
      startTimestamp,
      endTimestamp,
      MAX_DURATION,
      alice,
      alice,
      multiplier
    );
  });

  describe("View", async () => {
    it("viewUserInfo is correct", async () => {
      const result = await mockIFO.viewUserInfo(alice, [0, 1]);
      assert.equal(result[0][0], 0);
      assert.equal(result[1][0], false);
    });

    it("viewUserAllocationPools is correct", async () => {
      const allocations = await mockIFO.viewUserAllocationPools(alice, [0, 1]);

      assert.equal(allocations[0], 0);
    });
  });
});
