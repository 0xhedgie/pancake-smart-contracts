import { assert } from "chai";
import { constants, expectEvent, expectRevert } from "@openzeppelin/test-helpers";

import { artifacts, contract, ethers } from "hardhat";

const SectaBunnies = artifacts.require("./SectaBunnies.sol");

contract("SectaBunnies", ([alice, bob, carol]) => {
  let sectaBunnies;
  let result;

  before(async () => {
    const _testBaseURI = "ipfs://ipfs/";
    sectaBunnies = await SectaBunnies.new(_testBaseURI, { from: alice });
  });

  // Check ticker and symbols are correct
  describe("The NFT contract is properly deployed.", async () => {
    it("Symbol is correct", async () => {
      result = await sectaBunnies.symbol();
      assert.equal(result, "PB");
    });
    it("Name is correct", async () => {
      result = await sectaBunnies.name();
      assert.equal(result, "Secta Bunnies");
    });
    it("Total supply is 0", async () => {
      result = await sectaBunnies.totalSupply();
      assert.equal(result, "0");
      result = await sectaBunnies.balanceOf(alice);
      assert.equal(result, "0");
    });
    it("Owner is Alice", async () => {
      result = await sectaBunnies.owner();
      assert.equal(result, alice);
    });
  });

  // Verify that ERC721 tokens can be minted, deposited and transferred
  describe("ERC721 are correctly minted, deposited, transferred", async () => {
    let testTokenURI = "testURI";
    let testbunnyId1 = "3";
    let testbunnyId2 = "1";

    it("NFT token is minted properly", async () => {
      result = await sectaBunnies.mint(alice, testTokenURI, testbunnyId1, {
        from: alice,
      });
      expectEvent(result, "Transfer", {
        from: constants.ZERO_ADDRESS,
        to: alice,
        tokenId: "0",
      });
      result = await sectaBunnies.totalSupply();
      assert.equal(result, "1");
      result = await sectaBunnies.tokenURI("0");
      assert.equal(result, "ipfs://ipfs/testURI");
      result = await sectaBunnies.balanceOf(alice);
      assert.equal(result, "1");
      result = await sectaBunnies.ownerOf("0");
      assert.equal(result, alice);
      result = await sectaBunnies.getBunnyId("0");
      assert.equal(result, "3");
    });

    it("NFT token is transferred to Bob", async () => {
      result = await sectaBunnies.safeTransferFrom(alice, bob, "0", {
        from: alice,
      });
      expectEvent(result, "Transfer", {
        from: alice,
        to: bob,
        tokenId: "0",
      });
      result = await sectaBunnies.balanceOf(alice);
      assert.equal(result, "0");
      result = await sectaBunnies.balanceOf(bob);
      assert.equal(result, "1");
      result = await sectaBunnies.ownerOf("0");
      assert.equal(result, bob);
    });

    it("Second token is minted to Bob", async () => {
      result = await sectaBunnies.mint(bob, testTokenURI, testbunnyId2, {
        from: alice,
      });
      expectEvent(result, "Transfer", {
        from: constants.ZERO_ADDRESS,
        to: bob,
        tokenId: "1",
      });
      result = await sectaBunnies.totalSupply();
      assert.equal(result, "2");
      result = await sectaBunnies.balanceOf(bob);
      assert.equal(result, "2");
      result = await sectaBunnies.getBunnyId("1");
      assert.equal(result, "1");
      await expectRevert(
        sectaBunnies.safeTransferFrom(alice, bob, "0", {
          from: alice,
        }),
        "ERC721: transfer caller is not owner nor approved"
      );
    });

    it("Alice let Carol spend her NFT", async () => {
      await expectRevert(
        sectaBunnies.approve(carol, "1", { from: alice }),
        "ERC721: approve caller is not owner nor approved for all"
      );

      result = await sectaBunnies.approve(carol, "1", { from: bob });
      expectEvent(result, "Approval", {
        owner: bob,
        approved: carol,
        tokenId: "1",
      });
    });
  });
});
