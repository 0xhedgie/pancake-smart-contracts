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

    /// @notice A checkpoint for marking locks from a given block
    struct Checkpoint {
        uint32 fromBlock;
        uint32 fromTimestamp;
        Lock lock;
    }

    /// @notice A record of votes checkpoints for each account, by index
    mapping(address => mapping(uint32 => Checkpoint)) public checkpoints;

    /// @notice The number of checkpoints for each account
    mapping(address => uint32) public numCheckpoints;

    event LockChanged(address user, uint256 blockNumber, uint256 timestamp);

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

    function createLock(uint256 _amount, uint256 _endTimestamp) external {
        require(_amount > 0, "amount 0");
        require(_endTimestamp > now, "endTimestamp too old");

        require(_endTimestamp < type(uint32).max, "endTimestamp too big");

        Lock memory newLock = locks[msg.sender];

        require(newLock.startTimestamp == 0, "Lock exists");

        newLock = Lock(_amount, now, _endTimestamp - now);

        locks[msg.sender] = newLock;

        token.transferFrom(msg.sender, address(this), _amount);

        _writeCheckpoint(msg.sender, numCheckpoints[msg.sender], newLock);
    }

    function increaseLockAmount(uint256 _amount) external {
        require(_amount > 0, "amount 0");

        Lock memory newLock = locks[msg.sender];

        require(newLock.startTimestamp > 0, "Lock not found");
        // require(now > newLock.startTimestamp);
        // require(newLock.startTimestamp + newLock.duration > now, "Lock expired");

        uint256 elapsed = now - newLock.startTimestamp;
        newLock.startTimestamp += elapsed.mul(_amount).div(_amount.add(newLock.amount));
        newLock.amount += _amount;

        locks[msg.sender] = newLock;

        token.transferFrom(msg.sender, address(this), _amount);

        _writeCheckpoint(msg.sender, numCheckpoints[msg.sender], newLock);
    }

    function increaseUnlockTime(uint256 _endTimestamp) external {
        Lock memory newLock = locks[msg.sender];

        require(newLock.startTimestamp > 0, "Lock not found");
        // require(newLock.startTimestamp + newLock.duration > now, "Lock expired");
        require(_endTimestamp > newLock.startTimestamp + newLock.duration, "endTimestamp too early");
        require(_endTimestamp < type(uint32).max, "endTimestamp too big");

        newLock.duration = _endTimestamp - newLock.startTimestamp;

        locks[msg.sender] = newLock;

        _writeCheckpoint(msg.sender, numCheckpoints[msg.sender], newLock);
    }

    function withdrawAll() external {
        Lock memory userLock = locks[msg.sender];

        uint256 amount = userLock.amount;

        require(userLock.startTimestamp > 0, "Lock not found");

        if (userLock.startTimestamp + userLock.duration > now) {
            amount = (amount * (BASE_POINTS - penalty)) / BASE_POINTS;
        }

        token.transfer(msg.sender, amount);

        delete locks[msg.sender];

        _writeCheckpoint(msg.sender, numCheckpoints[msg.sender], Lock(0, 0, 0));
    }

    //// View ////

    function getUserInfo(address _owner) external view returns (Lock memory) {
        return locks[_owner];
    }

    function balanceOf(address _owner) external view returns (uint256) {
        return _getPoints(_owner, now);
    }

    function balanceOfAt(address _owner, uint256 _block) external view returns (uint256) {
        return _getPointsAt(_owner, _block);
    }

    function balanceOfAtTime(address _owner, uint256 _time) external view returns (uint256) {
        return _getPointsAtTime(_owner, _time);
    }

    function _getPoints(address _owner, uint256 _time) internal view returns (uint256) {
        Lock memory userLock = locks[_owner];

        return _calcPoints(userLock, _time);
    }

    function _calcPoints(Lock memory lock, uint256 timestamp) internal view returns (uint256 points) {
        uint256 elapsed = timestamp.sub(lock.startTimestamp);

        uint256 min = elapsed > lock.duration ? lock.duration : elapsed;
        min = min > DURATION ? DURATION : min;

        points = lock.amount.mul(BOOST).mul(min).div(DURATION).div(BASE_POINTS);
    }

    function _getPointsFromCheckpoint(Checkpoint memory checkpoint) internal view returns (uint256) {
        return _calcPoints(checkpoint.lock, checkpoint.fromTimestamp);
    }

    function _getPointsAt(address account, uint256 blockNumber) internal view returns (uint256) {
        require(blockNumber < now, "block no in the future");

        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return _getPointsFromCheckpoint(checkpoints[account][nCheckpoints - 1]);
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return _getPointsFromCheckpoint(cp);
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return _getPointsFromCheckpoint(checkpoints[account][lower]);
    }

    function _getPointsAtTime(address account, uint256 time) internal view returns (uint256) {
        require(time < now, "timestamp in the future");

        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromTimestamp <= time) {
            return _getPointsFromCheckpoint(checkpoints[account][nCheckpoints - 1]);
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromTimestamp > time) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromTimestamp == time) {
                return _getPointsFromCheckpoint(cp);
            } else if (cp.fromTimestamp < time) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return _getPointsFromCheckpoint(checkpoints[account][lower]);
    }

    function _writeCheckpoint(
        address user,
        uint32 nCheckpoints,
        Lock memory newLock
    ) internal {
        uint32 blockNumber = safe32(now, "block no exceeds 32 bits");

        if (nCheckpoints > 0 && checkpoints[user][nCheckpoints - 1].fromBlock == blockNumber) {
            checkpoints[user][nCheckpoints - 1].lock = newLock;
        } else {
            checkpoints[user][nCheckpoints] = Checkpoint(blockNumber, uint32(now), newLock);
            numCheckpoints[user] = nCheckpoints + 1;
        }

        emit LockChanged(user, blockNumber, now);
    }

    function safe32(uint256 n, string memory errorMessage) internal pure returns (uint32) {
        require(n < 2**32, errorMessage);
        return uint32(n);
    }
}
