// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

/**
 * @title Staking
 * @notice Allocation boosting points by staking
 */
contract Staking is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    mapping(address => Lock[]) private locks;

    struct Lock {
        uint256 amount;
        uint256 startTimestamp;
        uint256 duration;
    }

    uint256 public immutable MULTIPLIER; // = 2.5 ether;

    uint256 public immutable DURATION; // = 365 days;

    uint256 public constant BASE_MULTIPLIER = 1 ether;
    uint256 public constant BASE_POINTS = 10000;

    uint256 public penalty;

    IERC20 public token;

    /**
     * @notice It initializes the contract (for proxy patterns)
     * @dev It can only be called once.
     * @param _token: the LP token used
     */
    constructor(
        address _token,
        uint256 _multiplier,
        uint256 _duration,
        uint256 _penalty
    ) public {
        require(IERC20(_token).totalSupply() >= 0);
        require(_penalty < BASE_POINTS);

        token = IERC20(_token);

        MULTIPLIER = _multiplier;
        DURATION = _duration;

        penalty = _penalty;
    }

    function updatePenalty(uint256 _penalty) external onlyOwner {
        penalty = _penalty;
    }

    function stake(uint256 _amount, uint256 _duration) external returns (uint256) {
        require(_amount > 0, "amount > 0");
        require(_duration > 0, "duration > 0");

        Lock[] storage userLocks = locks[msg.sender];

        userLocks.push(Lock(_amount, now, _duration));

        token.transferFrom(msg.sender, address(this), _amount);

        return userLocks.length - 1;
    }

    function getLock(address _owner, uint256 _index) external view returns (Lock memory) {
        return locks[_owner][_index];
    }

    function getLockCount(address _owner) external view returns (uint256) {
        return locks[_owner].length;
    }

    function unstake(uint256 _index) external returns (uint256) {
        Lock[] storage userLocks = locks[msg.sender];
        uint256 length = userLocks.length;

        require(_index < length, "index < length");

        Lock memory lock = userLocks[_index];
        userLocks[_index] = userLocks[length - 1];
        userLocks.pop();

        uint256 amount = lock.amount;

        if (lock.startTimestamp + lock.duration > now) {
            amount = (amount * (BASE_POINTS - penalty)) / BASE_POINTS;
        }

        token.transfer(msg.sender, amount);

        return amount;
    }

    function getPoints(address _owner) external view returns (uint256) {
        Lock[] memory userLocks = locks[_owner];
        uint256 length = userLocks.length;
        uint256 total;

        for (uint256 i = 0; i < length; i++) {
            Lock memory lock = userLocks[i];

            uint256 elapsed = now - lock.startTimestamp;

            uint256 min = elapsed > lock.duration ? lock.duration : elapsed;
            min = min > DURATION ? DURATION : min;

            total += lock.amount;
            total += (lock.amount * (MULTIPLIER - BASE_MULTIPLIER) * min) / DURATION / BASE_MULTIPLIER;
        }

        return total;
    }
}
