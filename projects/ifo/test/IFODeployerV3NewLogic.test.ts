import { parseUnits, parseEther } from "ethers/lib/utils";
import { artifacts, contract, ethers } from "hardhat";

import { assert } from "chai";
import { BN, expectEvent, expectRevert, time, ether } from "@openzeppelin/test-helpers";

const IFOInitializableV3 = artifacts.require("./IFOInitializableV3.sol");
const IFODeployerV3 = artifacts.require("./IFODeployerV3.sol");

const SectaProfile = artifacts.require("profile-nft-gamification/contracts/SectaProfile.sol");
const MockERC20 = artifacts.require("./utils/MockERC20.sol");
const MockBunnies = artifacts.require("./utils/MockBunnies.sol");

const SectaToken = artifacts.require("secta-vault/contracts/test/SectaToken.sol");
const SyrupBar = artifacts.require("secta-vault/contracts/test/SyrupBar.sol");
const MasterChef = artifacts.require("secta-vault/contracts/test/MasterChef.sol");
const IFOPool = artifacts.require("secta-vault/contracts/IFOPool.sol");

const REWARDS_START_BLOCK = 100;

contract("IFO DeployerV3", ([alice, bob, carol, david, erin, frank, ...accounts]) => {
  // SectaProfile
  const _totalInitSupply = parseEther("5000000"); // 50 SECTA
  const _numberSectaToReactivate = parseEther("5"); // 5 SECTA
  const _numberSectaToRegister = parseEther("5"); // 5 SECTA
  const _numberSectaToUpdate = parseEther("2"); // 2 SECTA

  // IFO block times
  let _startBlock;
  let _endBlock;

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

  // Gamification parameters
  const campaignId = "12345678";
  const numberPoints = "100";
  const thresholdPoints = parseEther("0.035");

  // VARIABLES

  // Contracts
  let mockBunnies;
  let mockSecta;
  let mockIFO;
  let mockOC;
  let mockLP;
  let sectaProfile;
  let deployer;
  let ifopool;
  let secta;
  let syrup;
  let masterchef;
  let rewardsStartBlock;

  // Roles in SectaProfile
  let DEFAULT_ADMIN_ROLE;
  let NFT_ROLE;
  let POINT_ROLE;
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

    // Deploy Mock Bunnies
    mockBunnies = await MockBunnies.new({ from: alice });

    // Deploy Secta Profile
    sectaProfile = await SectaProfile.new(
      mockSecta.address,
      _numberSectaToReactivate,
      _numberSectaToRegister,
      _numberSectaToUpdate,
      { from: alice }
    );

    // Deploy IFOPool
    secta = await SectaToken.new({ from: frank });
    syrup = await SyrupBar.new(secta.address, { from: frank });
    rewardsStartBlock = (await time.latestBlock()).toNumber() + REWARDS_START_BLOCK;
    masterchef = await MasterChef.new(secta.address, syrup.address, frank, ether("1"), rewardsStartBlock, {
      from: frank,
    });

    ifopool = await IFOPool.new(secta.address, syrup.address, masterchef.address, frank, frank, 2000, 2050, {
      from: frank,
    });

    await syrup.transferOwnership(masterchef.address, { from: frank });
    // grant all users credits
    for (const user of [alice, bob, carol, david, erin, frank, frank, ...accounts]) {
      // Mint secta to all users
      await secta.mint(user, ether("1000000"), { from: frank });
      // Approves secta to be spent by IFOPool
      await secta.approve(ifopool.address, parseEther("1000000"), {
        from: user,
      });

      await ifopool.deposit(ether("100"), { from: user });
    }
    await secta.transferOwnership(masterchef.address, { from: frank });

    await time.advanceBlockTo(2060);

    // Assign the roles
    DEFAULT_ADMIN_ROLE = await sectaProfile.DEFAULT_ADMIN_ROLE();
    NFT_ROLE = await sectaProfile.NFT_ROLE();
    POINT_ROLE = await sectaProfile.POINT_ROLE();
  });

  describe("Initial contract parameters for all contracts", async () => {
    it("SectaProfile is correct", async () => {
      assert.equal(await sectaProfile.sectaToken(), mockSecta.address);
      assert.equal(String(await sectaProfile.numberSectaToReactivate()), String(_numberSectaToReactivate));
      assert.equal(String(await sectaProfile.numberSectaToRegister()), String(_numberSectaToRegister));
      assert.equal(String(await sectaProfile.numberSectaToUpdate()), String(_numberSectaToUpdate));

      assert.equal(await sectaProfile.getRoleMemberCount(DEFAULT_ADMIN_ROLE), "1");
    });

    it("Alice adds NFT and a team in the system", async () => {
      await sectaProfile.addNftAddress(mockBunnies.address, {
        from: alice,
      });
      await sectaProfile.addTeam("The Testers", "ipfs://hash/team1.json", {
        from: alice,
      });
    });

    it("Bob/Carol/David/Erin create a profile in the system", async () => {
      let i = 0;

      for (const thisUser of [bob, carol, david, erin]) {
        // Mints 100 SECTA
        await mockSecta.mintTokens(parseEther("100"), { from: thisUser });

        // Mints 10,000 LP tokens
        await mockLP.mintTokens(parseEther("10000"), { from: thisUser });

        // Mints a NFT
        result = await mockBunnies.mint({ from: thisUser });

        // Approves the contract to receive his NFT
        await mockBunnies.approve(sectaProfile.address, i, {
          from: thisUser,
        });

        // Approves SECTA to be spent by SectaProfile
        await mockSecta.approve(sectaProfile.address, parseEther("100"), {
          from: thisUser,
        });

        // Creates the profile
        await sectaProfile.createProfile("1", mockBunnies.address, i, {
          from: thisUser,
        });
        i++;
      }

      // 4 generic accounts too
      for (const thisUser of accounts) {
        // Mints 100 SECTA
        await mockSecta.mintTokens(parseEther("100"), { from: thisUser });

        // Mints 1,000 LP tokens
        await mockLP.mintTokens(parseEther("1000"), { from: thisUser });

        // Mnts a NFT
        result = await mockBunnies.mint({ from: thisUser });

        // Approves the contract to receive his NFT
        await mockBunnies.approve(sectaProfile.address, i, {
          from: thisUser,
        });

        // Approves SECTA to be spent by SectaProfile
        await mockSecta.approve(sectaProfile.address, parseEther("100"), {
          from: thisUser,
        });

        // Creates the profile
        await sectaProfile.createProfile("1", mockBunnies.address, i, {
          from: thisUser,
        });
        i++;
      }
    });
  });

  describe("IFO DeployerV3 #0 - Initial set up", async () => {
    it("The IFODeployerV3 is deployed and initialized", async () => {
      deployer = await IFODeployerV3.new(sectaProfile.address, {
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
      _startBlock = new BN(await time.latestBlock()).add(new BN("50"));
      _endBlock = new BN(await time.latestBlock()).add(new BN("250"));

      // Alice deploys the IFO setting herself as the contract admin
      let result = await deployer.createIFO(
        mockLP.address,
        mockOC.address,
        _startBlock,
        _endBlock,
        alice,
        ifopool.address,
        {
          from: alice,
        }
      );

      const ifoAddress = result.receipt.logs[2].args[0];

      expectEvent(result, "NewIFOContract", { ifoAddress });

      mockIFO = await IFOInitializableV3.at(ifoAddress);

      result = await mockIFO.updateStartAndEndBlocks(_startBlock, _endBlock, { from: alice });

      expectEvent(result, "NewStartAndEndBlocks", { startBlock: _startBlock, endBlock: _endBlock });

      // Grants point role to the IFO contract
      await sectaProfile.grantRole(POINT_ROLE, mockIFO.address);
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
        { from: alice }
      );

      assert.equal(String(await mockIFO.viewPoolTaxRateOverflow("1")), "10000000000");

      expectEvent(result, "PoolParametersSet", {
        offeringAmountPool: String(offeringAmountPool1),
        raisingAmountPool: String(raisingAmountPool1),
        pid: String(1),
      });

      assert.equal(String(await mockIFO.totalTokensOffered()), String(offeringTotalAmount));

      result = await mockIFO.updatePointParameters(campaignId, numberPoints, thresholdPoints, { from: alice });

      expectEvent(result, "PointParametersSet", {
        campaignId: String(campaignId),
        numberPoints: String(numberPoints),
        thresholdPoints: String(thresholdPoints),
      });
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

  describe("IFO with credit", async () => {
    it("User (Bob) cannot deposit when credit used up", async () => {
      // console.log("bob's credit is %s", await ethers.utils.formatEther((await ifopool.getUserCredit(bob)).toString()));

      // Transfer the offering total amount to the IFO contract
      await mockOC.transfer(mockIFO.address, await mockIFO.totalTokensOffered(), {
        from: alice,
      });

      await time.advanceBlockTo(2200);

      const updateBlockResult = await mockIFO.updateStartAndEndBlocks(
        (await time.latestBlock()).toNumber() + 20,
        (await time.latestBlock()).toNumber() + 50,
        { from: alice }
      );

      await time.advanceBlockTo(2222);

      await expectRevert(
        mockIFO.depositPool(parseEther("0.6"), "0", { from: bob }),
        "Deposit: New amount above user limit"
      );

      await expectRevert(mockIFO.depositPool(parseEther("101"), "0", { from: bob }), "Not enough IFO credit left");

      await expectRevert(mockIFO.depositPool(parseEther("101"), "1", { from: bob }), "Not enough IFO credit left");

      result = await mockIFO.depositPool(parseEther("50"), "1", { from: bob });

      await expectRevert(mockIFO.depositPool(parseEther("51"), "1", { from: bob }), "Not enough IFO credit left");

      result = await mockIFO.depositPool(parseEther("50"), "1", { from: bob });

      await expectRevert(mockIFO.depositPool(parseEther("0.6"), "0", { from: bob }), "Not enough IFO credit left");
    });
  });
});
