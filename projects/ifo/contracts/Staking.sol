// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./interfaces/IStaking.sol";

/**
 * @title Staking
 * @notice Allocation boosting points by staking
 */
contract Staking is Ownable, IStaking {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    mapping(address => Lock) private locks;

    uint256 public immutable BOOST; // default 10000

    uint256 public immutable MAX_DURATION; // default 365 days

    uint256 public constant BASE_POINTS = 10000;

    uint256 public protocolFee;

    uint256 public penaltyPoints;

    IERC20 public token;

    uint8 public override tokenDecimals;

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
        tokenDecimals = IERC20Extended(_token).decimals();

        BOOST = _boost;
        MAX_DURATION = _duration;

        penaltyPoints = _penalty;
    }

    function updatePenalty(uint256 _penalty) external onlyOwner {
        penaltyPoints = _penalty;
    }

    function createLock(uint256 _amount) external override {
        require(_amount > 0, "amount 0");

        Lock memory newLock = locks[msg.sender];

        require(newLock.startTimestamp == 0, "Lock exists");

        newLock = Lock(_amount, now);

        locks[msg.sender] = newLock;

        token.transferFrom(msg.sender, address(this), _amount);

        _writeCheckpoint(msg.sender, numCheckpoints[msg.sender], newLock);
    }

    function increaseLockAmount(uint256 _amount) external override {
        require(_amount > 0, "amount 0");

        Lock memory newLock = locks[msg.sender];

        require(newLock.startTimestamp > 0, "Lock not found");
        // require(now > newLock.startTimestamp);

        uint256 elapsed = now - newLock.startTimestamp;
        newLock.startTimestamp += elapsed.mul(_amount).div(_amount.add(newLock.amount));
        newLock.amount += _amount;

        locks[msg.sender] = newLock;

        token.transferFrom(msg.sender, address(this), _amount);

        _writeCheckpoint(msg.sender, numCheckpoints[msg.sender], newLock);
    }

    function withdraw(uint256 _amount) external override {
        Lock memory userLock = locks[msg.sender];

        require(userLock.startTimestamp > 0, "Lock not found");
        require(userLock.amount >= _amount, "Incorrect amount");

        userLock.amount -= _amount;

        uint256 fee = (penaltyPoints * _amount) / BASE_POINTS;
        _amount -= fee;

        protocolFee += fee;

        if (_amount > 0) token.transfer(msg.sender, _amount);

        if (userLock.amount == 0) delete locks[msg.sender];
        else locks[msg.sender].amount = userLock.amount;

        _writeCheckpoint(msg.sender, numCheckpoints[msg.sender], userLock);
    }

    function withdrawAll() external override {
        Lock memory userLock = locks[msg.sender];

        uint256 amount = userLock.amount;

        require(userLock.startTimestamp > 0, "Lock not found");

        amount -= (penaltyPoints * amount) / BASE_POINTS;

        if (amount > 0) token.transfer(msg.sender, amount);

        delete locks[msg.sender];

        _writeCheckpoint(msg.sender, numCheckpoints[msg.sender], Lock(0, 0));
    }

    function withdrawFee(address _to) external onlyOwner {
        if (protocolFee > 0) {
            uint256 fee = protocolFee;
            protocolFee = 0;
            token.transfer(_to, fee);
        }
    }

    //// View ////

    function getUserInfo(address _owner) external view override returns (Lock memory) {
        return locks[_owner];
    }

    function balanceOf(address _owner) external view override returns (uint256) {
        return _getPoints(_owner, now);
    }

    function balanceOfAt(address _owner, uint256 _block) external view override returns (uint256) {
        return _getPointsAt(_owner, _block);
    }

    function balanceOfAtTime(address _owner, uint256 _time) external view override returns (uint256) {
        return _getPointsAtTime(_owner, _time);
    }

    function _getPoints(address _owner, uint256 _time) internal view returns (uint256) {
        Lock memory userLock = locks[_owner];

        return _calcPoints(userLock, _time);
    }

    function _calcPoints(Lock memory lock, uint256 timestamp) internal view returns (uint256 points) {
        if (lock.amount == 0 || lock.startTimestamp == 0) return 0;

        uint256 elapsed = timestamp.sub(lock.startTimestamp);

        uint256 min = elapsed > MAX_DURATION ? MAX_DURATION : elapsed;

        points = lock.amount.mul(BOOST).mul(min).div(MAX_DURATION).div(BASE_POINTS);
    }

    function _getPointsFromCheckpoint(Checkpoint memory checkpoint) internal view returns (uint256) {
        return _calcPoints(checkpoint.lock, checkpoint.fromTimestamp);
    }

    function _getPointsFromCheckpointWith(Checkpoint memory checkpoint, uint256 timestamp)
        internal
        view
        returns (uint256)
    {
        return _calcPoints(checkpoint.lock, timestamp);
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
            return _getPointsFromCheckpointWith(checkpoints[account][nCheckpoints - 1], time);
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
                return _getPointsFromCheckpointWith(cp, time);
            } else if (cp.fromTimestamp < time) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return _getPointsFromCheckpointWith(checkpoints[account][lower], time);
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
