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

    mapping(address => Lock) private locks;

    struct Lock {
        uint256 amount;
        uint256 startTimestamp;
        uint256 duration;
    }

    uint256 public immutable BOOST; // default 10000

    uint256 public immutable DURATION; // default 365 days

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
        uint256 _boost,
        uint256 _duration,
        uint256 _penalty
    ) public {
        require(IERC20(_token).totalSupply() >= 0);
        require(_penalty < BASE_POINTS);

        token = IERC20(_token);

        BOOST = _boost;
        DURATION = _duration;

        penalty = _penalty;
    }

    function updatePenalty(uint256 _penalty) external onlyOwner {
        penalty = _penalty;
    }

    function stake(uint256 _amount, uint256 _duration) external returns (Lock memory) {
        require(_amount > 0, "amount > 0");
        require(_duration > 0, "duration > 0");

        require(_duration < type(uint32).max, "duration < 2^32");

        Lock memory newLock = locks[msg.sender];

        if (newLock.startTimestamp == 0) {
            newLock = Lock(_amount, now, _duration);
        } else {
            newLock.duration = newLock.duration.mul(newLock.amount).div(newLock.amount.add(_amount));
            newLock.amount += _amount;
        }

        locks[msg.sender] = newLock;

        token.transferFrom(msg.sender, address(this), _amount);

        return newLock;
    }

    function getLock(address _owner) external view returns (Lock memory) {
        return locks[_owner];
    }

    function unstake() external returns (uint256) {
        Lock memory userLock = locks[msg.sender];

        uint256 amount = userLock.amount;

        if (amount == 0) return 0;

        if (userLock.startTimestamp + userLock.duration > now) {
            amount = (amount * (BASE_POINTS - penalty)) / BASE_POINTS;
        }

        token.transfer(msg.sender, amount);

        delete locks[msg.sender];

        return amount;
    }

    function getPointsAt(address _owner, uint256 _time) external view returns (uint256) {
        return _getPoints(_owner, _time);
    }

    function getPoints(address _owner) external view returns (uint256) {
        return _getPoints(_owner, now);
    }

    function _getPoints(address _owner, uint256 _time) internal view returns (uint256) {
        Lock memory userLock = locks[_owner];
        uint256 total;

        uint256 elapsed = _time.sub(userLock.startTimestamp);

        uint256 min = elapsed > userLock.duration ? userLock.duration : elapsed;
        min = min > DURATION ? DURATION : min;

        total += userLock.amount;
        total += userLock.amount.mul(BOOST).mul(min).div(DURATION).div(BASE_POINTS);

        return total;
    }
}
