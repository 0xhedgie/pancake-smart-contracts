// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

struct Lock {
    uint256 amount;
    uint256 startTimestamp;
}

/** @title IStaking.
 * @notice It is an interface for Staking.sol
 */
interface IStaking {
    function createLock(uint256 _amount) external;

    function increaseLockAmount(uint256 _amount) external;

    function withdraw(uint256 _amount) external;

    function withdrawAll() external;

    //// View ////

    function getUserInfo(address _owner) external view returns (Lock memory);

    function balanceOf(address _owner) external view returns (uint256);

    function balanceOfAt(address _owner, uint256 _block) external view returns (uint256);

    function balanceOfAtTime(address _owner, uint256 _time) external view returns (uint256);
}
