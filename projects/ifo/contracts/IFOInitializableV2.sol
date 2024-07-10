// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./interfaces/IIFO.sol";
import "./interfaces/IStaking.sol";
import "./libraries/MerkleProof.sol";

/**
 * @title IFOInitializableV2
 */
contract IFOInitializableV2 is IIFO, ReentrancyGuard, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Types of sales
    uint8 public constant SALE_BASIC = 0;
    uint8 public constant SALE_PRIVATE = 1;
    uint8 public constant SALE_PUBLIC = 2;

    // Number of pools
    uint8 public constant NUMBER_POOLS = 3;

    // The address of the smart chef factory
    address public immutable IFO_FACTORY;

    // Max time (for sanity checks)
    uint256 public MAX_DURATION;

    // The LP token used
    IERC20 public lpToken;

    // The offering token
    IERC20 public offeringToken;

    // Whether it is initialized
    bool public isInitialized;

    // The now when IFO starts
    uint256 public startTimestamp;

    // The now when IFO ends
    uint256 public endTimestamp;

    // Total tokens distributed across the pools
    uint256 public totalTokensOffered;

    // Array of PoolCharacteristics of size NUMBER_POOLS
    PoolCharacteristics[NUMBER_POOLS] private _poolInformation;

    // It maps the address to pool id to UserInfo
    mapping(address => mapping(uint8 => UserInfo)) private _userInfo;

    // It maps user address to accumulative deposit lptoken amount
    mapping(address => uint256) public userAccumulateDeposits;

    uint256 public rateMultiplier;
    uint256 public constant BASE_MULTIPLIER = 1_000_000;

    // StakingPool contract
    IStaking public stakingPool;

    // Struct that contains each pool characteristics
    struct PoolCharacteristics {
        uint256 raisingAmountPool; // amount of tokens raised for the pool (in LP tokens)
        uint256 offeringAmountPool; // amount of tokens offered for the pool (in offeringTokens)
        uint256 limitPerUserInLP; // limit of tokens per user (if 0, it is ignored)
        uint256 totalAmountPool; // total amount pool deposited (in LP tokens)
        uint256 sumTaxesOverflow; // total taxes collected (starts at 0, increases with each harvest if overflow)
        bytes32 merkleRoot; // merkle merkleRoot
        bool hasTax; // tax on the overflow (if any, it works with _calculateTaxOverflow)
        uint8 saleType; // if the pool is basic or private
    }

    // Struct that contains each user information for both pools
    struct UserInfo {
        uint256 amountPool; // How many tokens the user has provided for pool
        bool claimedPool; // Whether the user has claimed (default: false) for pool
    }

    // Admin withdraw events
    event AdminWithdraw(uint256 amountLP, uint256 amountOfferingToken);

    // Admin recovers token
    event AdminTokenRecovery(address tokenAddress, uint256 amountTokens);

    // Deposit event
    event Deposit(address indexed user, uint256 amount, uint8 indexed pid);

    // Harvest event
    event Harvest(address indexed user, uint256 offeringAmount, uint256 excessAmount, uint8 indexed pid);

    // Event for new start & end timestamps
    event NewStartAndEndTimestamps(uint256 startTimestamp, uint256 endTimestamp);

    // Event when parameters are set for one of the pools
    event PoolParametersSet(uint256 offeringAmountPool, uint256 raisingAmountPool, uint8 pid);

    // Modifier to prevent contracts to participate
    modifier notContract() {
        require(!_isContract(msg.sender), "contract not allowed");
        require(msg.sender == tx.origin, "proxy contract not allowed");
        _;
    }

    /**
     * @notice Constructor
     */
    constructor(address factory) public {
        IFO_FACTORY = factory;
    }

    /**
     * @notice It initializes the contract
     * @dev It can only be called once.
     * @param _lpToken: the LP token used
     * @param _offeringToken: the token that is offered for the IFO
     * @param _stakingPoolAddress: the address of the StakingPool
     * @param _startTimestamp: the start timestamp for the IFO
     * @param _endTimestamp: the end timestamp for the IFO
     * @param _maxDuration: maximum duration of the IFO
     * @param _adminAddress: the admin address for handling tokens
     */
    function initialize(
        address _lpToken,
        address _offeringToken,
        uint256 _startTimestamp,
        uint256 _endTimestamp,
        uint256 _maxDuration,
        address _adminAddress,
        address _stakingPoolAddress,
        uint256 _rateMultiplier
    ) public {
        require(!isInitialized, "Operations: Already initialized");
        require(msg.sender == IFO_FACTORY, "Operations: Not factory");

        // Make this contract initialized
        isInitialized = true;

        lpToken = IERC20(_lpToken);
        offeringToken = IERC20(_offeringToken);
        stakingPool = IStaking(_stakingPoolAddress);
        startTimestamp = _startTimestamp;
        endTimestamp = _endTimestamp;
        MAX_DURATION = _maxDuration;

        rateMultiplier = _rateMultiplier;

        // Transfer ownership to admin
        transferOwnership(_adminAddress);
    }

    function getSaleType(uint8 _pid) external view override returns (uint8) {
        return _poolInformation[_pid].saleType;
    }

    /**
     * @notice It allows users to deposit LP tokens to pool
     * @param _amount: the number of LP token used (18 decimals)
     * @param _pid: pool id
     */
    function depositPool(
        uint256 _amount,
        uint8 _pid,
        bytes32[] memory proof
    ) external override nonReentrant notContract {
        // Checks whether the pool id is valid
        require(_pid < NUMBER_POOLS, "Deposit: Non valid pool id");

        uint256 userAccumulated = userAccumulateDeposits[msg.sender].add(_amount);

        // Checks if the user is in the merkle tree
        if (_poolInformation[_pid].saleType == SALE_PRIVATE) {
            require(_poolInformation[_pid].merkleRoot != bytes32(0), "Deposit: Merkle merkleRoot not set");
            bytes32 leaf = keccak256(abi.encodePacked(keccak256(abi.encode(msg.sender))));
            bytes32 merkleRoot = _poolInformation[_pid].merkleRoot;
            require(MerkleProof.verify(proof, merkleRoot, leaf), "Deposit: Invalid proof");
        } else if (_poolInformation[_pid].saleType == SALE_BASIC) {
            require(proof.length == 0, "Deposit: No proof needed for basic sale");
        } else if (_poolInformation[_pid].saleType == SALE_PUBLIC) {
            uint256 limit = stakingPool.balanceOfAtTime(msg.sender, startTimestamp).mul(rateMultiplier).div(
                (BASE_MULTIPLIER)
            );
            require(userAccumulated < limit, "Deposit: Not enough staking credit");
        }

        // Checks that pool was set
        require(
            _poolInformation[_pid].offeringAmountPool > 0 && _poolInformation[_pid].raisingAmountPool > 0,
            "Deposit: Pool not set"
        );

        // Checks whether the now is not too early
        require(now > startTimestamp, "Deposit: Too early");

        // Checks whether the now is not too late
        require(now < endTimestamp, "Deposit: Too late");

        // Checks that the amount deposited is not inferior to 0
        require(_amount > 0, "Deposit: Amount must be > 0");

        // Verify tokens were deposited properly
        require(offeringToken.balanceOf(address(this)) >= totalTokensOffered, "Deposit: Tokens not deposited properly");

        // Updates Accumulative deposit lptokens
        userAccumulateDeposits[msg.sender] = userAccumulated;

        uint256 userPooled = _userInfo[msg.sender][_pid].amountPool.add(_amount);

        // Check if the pool has a limit per user
        if (_poolInformation[_pid].limitPerUserInLP > 0) {
            // Checks whether the limit has been reached
            require(userPooled <= _poolInformation[_pid].limitPerUserInLP, "Deposit: New amount above user limit");
        }

        // Update the user status
        _userInfo[msg.sender][_pid].amountPool = userPooled;

        // Updates the totalAmount for pool
        _poolInformation[_pid].totalAmountPool = _poolInformation[_pid].totalAmountPool.add(_amount);

        // Transfers funds to this contract
        lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);

        emit Deposit(msg.sender, _amount, _pid);
    }

    /**
     * @notice It allows users to harvest from pool
     * @param _pid: pool id
     */
    function harvestPool(uint8 _pid) external override nonReentrant notContract {
        // Checks whether it is too early to harvest
        require(now > endTimestamp, "Harvest: Too early");

        // Checks whether pool id is valid
        require(_pid < NUMBER_POOLS, "Harvest: Non valid pool id");

        // Checks whether the user has participated
        require(_userInfo[msg.sender][_pid].amountPool > 0, "Harvest: Did not participate");

        // Checks whether the user has already harvested
        require(!_userInfo[msg.sender][_pid].claimedPool, "Harvest: Already done");

        // Updates the harvest status
        _userInfo[msg.sender][_pid].claimedPool = true;

        // Initialize the variables for offering, refunding user amounts, and tax amount
        (
            uint256 offeringTokenAmount,
            uint256 refundingTokenAmount,
            uint256 userTaxOverflow
        ) = _calculateOfferingAndRefundingAmountsPool(msg.sender, _pid);

        // Increment the sumTaxesOverflow
        if (userTaxOverflow > 0) {
            _poolInformation[_pid].sumTaxesOverflow = _poolInformation[_pid].sumTaxesOverflow.add(userTaxOverflow);
        }

        // Transfer these tokens back to the user if quantity > 0
        if (offeringTokenAmount > 0) {
            offeringToken.safeTransfer(address(msg.sender), offeringTokenAmount);
        }

        if (refundingTokenAmount > 0) {
            lpToken.safeTransfer(address(msg.sender), refundingTokenAmount);
        }

        emit Harvest(msg.sender, offeringTokenAmount, refundingTokenAmount, _pid);
    }

    /**
     * @notice It allows the admin to withdraw funds
     * @param _lpAmount: the number of LP token to withdraw (18 decimals)
     * @param _offerAmount: the number of offering amount to withdraw
     * @dev This function is only callable by admin.
     */
    function finalWithdraw(uint256 _lpAmount, uint256 _offerAmount) external override onlyOwner {
        require(now > endTimestamp, "Withdraw: Too early");

        require(_lpAmount <= lpToken.balanceOf(address(this)), "Operations: Not enough LP tokens");
        require(_offerAmount <= offeringToken.balanceOf(address(this)), "Operations: Not enough offering tokens");

        if (_lpAmount > 0) {
            lpToken.safeTransfer(address(msg.sender), _lpAmount);
        }

        if (_offerAmount > 0) {
            offeringToken.safeTransfer(address(msg.sender), _offerAmount);
        }

        emit AdminWithdraw(_lpAmount, _offerAmount);
    }

    /**
     * @notice It allows the admin to recover wrong tokens sent to the contract
     * @param _tokenAddress: the address of the token to withdraw (18 decimals)
     * @param _tokenAmount: the number of token amount to withdraw
     * @dev This function is only callable by admin.
     */
    function recoverWrongTokens(address _tokenAddress, uint256 _tokenAmount) external onlyOwner {
        require(_tokenAddress != address(lpToken), "Recover: Cannot be LP token");
        require(_tokenAddress != address(offeringToken), "Recover: Cannot be offering token");

        IERC20(_tokenAddress).safeTransfer(address(msg.sender), _tokenAmount);

        emit AdminTokenRecovery(_tokenAddress, _tokenAmount);
    }

    /**
     * @notice It sets parameters for pool
     * @param _offeringAmountPool: offering amount (in tokens)
     * @param _raisingAmountPool: raising amount (in LP tokens)
     * @param _limitPerUserInLP: limit per user (in LP tokens)
     * @param _hasTax: if the pool has a tax
     * @param _pid: pool id
     * @dev This function is only callable by admin.
     */
    function setPool(
        uint256 _offeringAmountPool,
        uint256 _raisingAmountPool,
        uint256 _limitPerUserInLP,
        bool _hasTax,
        uint8 _pid,
        uint8 _saleType,
        bytes32 _root
    ) external override onlyOwner {
        if (_saleType == SALE_BASIC) {
            require(_root == bytes32(0), "Operations: Basic sale should have empty merkle root");
        } else if (_saleType == SALE_PRIVATE) {
            require(_root != bytes32(0), "Operations: Empty merkle root for private sale");
        } else if (_saleType == SALE_PUBLIC) {
            require(_root == bytes32(0), "Operations: Public sale should have empty merkle root");
            require(address(stakingPool) != address(0), "Operations: StakingPool needed for public sale");
        } else {
            revert("Operations: Only basic or private/public sale allowed");
        }

        require(now < startTimestamp, "Operations: IFO has started");
        require(_pid < NUMBER_POOLS, "Operations: Pool does not exist");

        _poolInformation[_pid].offeringAmountPool = _offeringAmountPool;
        _poolInformation[_pid].raisingAmountPool = _raisingAmountPool;
        _poolInformation[_pid].limitPerUserInLP = _limitPerUserInLP;
        _poolInformation[_pid].hasTax = _hasTax;

        uint256 tokensDistributedAcrossPools;

        for (uint8 i = 0; i < NUMBER_POOLS; i++) {
            tokensDistributedAcrossPools = tokensDistributedAcrossPools.add(_poolInformation[i].offeringAmountPool);
        }

        // Update totalTokensOffered
        totalTokensOffered = tokensDistributedAcrossPools;

        emit PoolParametersSet(_offeringAmountPool, _raisingAmountPool, _pid);
    }

    /**
     * @notice It allows the admin to update start and end timestamps
     * @param _startTimestamp: the new start timestamp
     * @param _endTimestamp: the new end timestamp
     * @dev This function is only callable by admin.
     */
    function updateStartAndEndTimestamps(uint256 _startTimestamp, uint256 _endTimestamp) external onlyOwner {
        require(_endTimestamp < (_startTimestamp + MAX_DURATION), "Operations: Duration too long");
        require(now < startTimestamp, "Operations: IFO has started");
        require(_startTimestamp < _endTimestamp, "Operations: New startTimestamp must be lower than new endTimestamp");
        require(now < _startTimestamp, "Operations: New startTimestamp must be higher than current timestamp");

        startTimestamp = _startTimestamp;
        endTimestamp = _endTimestamp;

        emit NewStartAndEndTimestamps(_startTimestamp, _endTimestamp);
    }

    /// danger from owner! remove force* methods before deploy
    /**
     * @notice It allows the admin to update start and end timestamps
     * @param _startTimestamp: the new start timestamp
     * @param _endTimestamp: the new end timestamp
     * @dev This function is only callable by admin. This is only for development and will be removed in production.
     */
    function forceUpdateStartAndEndTimestamps(uint256 _startTimestamp, uint256 _endTimestamp) external onlyOwner {
        require(_startTimestamp < _endTimestamp, "Operations: New startTimestamp must be lower than new endTimestamp");

        startTimestamp = _startTimestamp;
        endTimestamp = _endTimestamp;

        emit NewStartAndEndTimestamps(_startTimestamp, _endTimestamp);
    }

    function forceUpdateTokens(address _lpToken, address _offeringToken) external onlyOwner {
        require(IERC20(_lpToken).totalSupply() >= 0);
        require(IERC20(_offeringToken).totalSupply() >= 0);
        require(_lpToken != _offeringToken, "Operations: Tokens must be different");

        lpToken = IERC20(_lpToken);
        offeringToken = IERC20(_offeringToken);
    }

    function forceUpdateRateMultiplier(uint256 _rateMultiplier) external onlyOwner {
        rateMultiplier = _rateMultiplier;
    }

    /**
     * @notice It returns the pool information
     * @param _pid: poolId
     * @return raisingAmountPool: amount of LP tokens raised (in LP tokens)
     * @return offeringAmountPool: amount of tokens offered for the pool (in offeringTokens)
     * @return limitPerUserInLP; // limit of tokens per user (if 0, it is ignored)
     * @return hasTax: tax on the overflow (if any, it works with _calculateTaxOverflow)
     * @return totalAmountPool: total amount pool deposited (in LP tokens)
     * @return sumTaxesOverflow: total taxes collected (starts at 0, increases with each harvest if overflow)
     */
    function viewPoolInformation(uint256 _pid)
        external
        view
        override
        returns (
            uint256,
            uint256,
            uint256,
            bool,
            uint256,
            uint256,
            bytes32,
            uint8
        )
    {
        PoolCharacteristics memory pi = _poolInformation[_pid];
        return (
            pi.raisingAmountPool,
            pi.offeringAmountPool,
            pi.limitPerUserInLP,
            pi.hasTax,
            pi.totalAmountPool,
            pi.sumTaxesOverflow,
            pi.merkleRoot,
            pi.saleType
        );
    }

    /**
     * @notice It returns the tax overflow rate calculated for a pool
     * @dev 100,000,000,000 means 0.1 (10%) / 1 means 0.0000000000001 (0.0000001%) / 1,000,000,000,000 means 1 (100%)
     * @param _pid: poolId
     * @return It returns the tax percentage
     */
    function viewPoolTaxRateOverflow(uint256 _pid) external view override returns (uint256) {
        if (!_poolInformation[_pid].hasTax) {
            return 0;
        } else {
            return
                _calculateTaxOverflow(_poolInformation[_pid].totalAmountPool, _poolInformation[_pid].raisingAmountPool);
        }
    }

    /**
     * @notice External view function to see user allocations for both pools
     * @param _user: user address
     * @param _pids[]: array of pids
     * @return
     */
    function viewUserAllocationPools(address _user, uint8[] calldata _pids)
        external
        view
        override
        returns (uint256[] memory)
    {
        uint256[] memory allocationPools = new uint256[](_pids.length);
        for (uint8 i = 0; i < _pids.length; i++) {
            allocationPools[i] = _getUserAllocationPool(_user, _pids[i]);
        }
        return allocationPools;
    }

    /**
     * @notice External view function to see user information
     * @param _user: user address
     * @param _pids[]: array of pids
     */
    function viewUserInfo(address _user, uint8[] calldata _pids)
        external
        view
        override
        returns (uint256[] memory, bool[] memory)
    {
        uint256[] memory amountPools = new uint256[](_pids.length);
        bool[] memory statusPools = new bool[](_pids.length);

        for (uint8 i = 0; i < _pids.length; i++) {
            amountPools[i] = _userInfo[_user][_pids[i]].amountPool;
            statusPools[i] = _userInfo[_user][_pids[i]].claimedPool;
        }
        return (amountPools, statusPools);
    }

    /**
     * @notice External view function to see user offering and refunding amounts for both pools
     * @param _user: user address
     * @param _pids: array of pids
     */
    function viewUserOfferingAndRefundingAmountsForPools(address _user, uint8[] calldata _pids)
        external
        view
        override
        returns (uint256[3][] memory)
    {
        uint256[3][] memory amountPools = new uint256[3][](_pids.length);

        for (uint8 i = 0; i < _pids.length; i++) {
            uint256 userOfferingAmountPool;
            uint256 userRefundingAmountPool;
            uint256 userTaxAmountPool;

            if (_poolInformation[_pids[i]].raisingAmountPool > 0) {
                (
                    userOfferingAmountPool,
                    userRefundingAmountPool,
                    userTaxAmountPool
                ) = _calculateOfferingAndRefundingAmountsPool(_user, _pids[i]);
            }

            amountPools[i] = [userOfferingAmountPool, userRefundingAmountPool, userTaxAmountPool];
        }
        return amountPools;
    }

    /**
     * @notice It calculates the tax overflow given the raisingAmountPool and the totalAmountPool.
     * @dev 100,000,000,000 means 0.1 (10%) / 1 means 0.0000000000001 (0.0000001%) / 1,000,000,000,000 means 1 (100%)
     * @return It returns the tax percentage
     */
    function _calculateTaxOverflow(uint256 _totalAmountPool, uint256 _raisingAmountPool)
        internal
        pure
        returns (uint256)
    {
        uint256 ratioOverflow = _totalAmountPool.div(_raisingAmountPool);
        if (ratioOverflow >= 1500) {
            return 500000000; // 0.05%
        } else if (ratioOverflow >= 1000) {
            return 1000000000; // 0.1%
        } else if (ratioOverflow >= 500) {
            return 2000000000; // 0.2%
        } else if (ratioOverflow >= 250) {
            return 2500000000; // 0.25%
        } else if (ratioOverflow >= 100) {
            return 3000000000; // 0.3%
        } else if (ratioOverflow >= 50) {
            return 5000000000; // 0.5%
        } else {
            return 10000000000; // 1%
        }
    }

    /**
     * @notice It calculates the offering amount for a user and the number of LP tokens to transfer back.
     * @param _user: user address
     * @param _pid: pool id
     * @return {uint256, uint256, uint256} It returns the offering amount, the refunding amount (in LP tokens),
     * and the tax (if any, else 0)
     */
    function _calculateOfferingAndRefundingAmountsPool(address _user, uint8 _pid)
        internal
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        uint256 userOfferingAmount;
        uint256 userRefundingAmount;
        uint256 taxAmount;

        if (_poolInformation[_pid].totalAmountPool > _poolInformation[_pid].raisingAmountPool) {
            // Calculate allocation for the user
            uint256 allocation = _getUserAllocationPool(_user, _pid);

            // Calculate the offering amount for the user based on the offeringAmount for the pool
            userOfferingAmount = _poolInformation[_pid].offeringAmountPool.mul(allocation).div(1e12);

            // Calculate the payAmount
            uint256 payAmount = _poolInformation[_pid].raisingAmountPool.mul(allocation).div(1e12);

            // Calculate the pre-tax refunding amount
            userRefundingAmount = _userInfo[_user][_pid].amountPool.sub(payAmount);

            // Retrieve the tax rate
            if (_poolInformation[_pid].hasTax) {
                uint256 taxOverflow = _calculateTaxOverflow(
                    _poolInformation[_pid].totalAmountPool,
                    _poolInformation[_pid].raisingAmountPool
                );

                // Calculate the final taxAmount
                taxAmount = userRefundingAmount.mul(taxOverflow).div(1e12);

                // Adjust the refunding amount
                userRefundingAmount = userRefundingAmount.sub(taxAmount);
            }
        } else {
            userRefundingAmount = 0;
            taxAmount = 0;
            // _userInfo[_user] / (raisingAmount / offeringAmount)
            userOfferingAmount = _userInfo[_user][_pid].amountPool.mul(_poolInformation[_pid].offeringAmountPool).div(
                _poolInformation[_pid].raisingAmountPool
            );
        }
        return (userOfferingAmount, userRefundingAmount, taxAmount);
    }

    /**
     * @notice It returns the user allocation for pool
     * @dev 100,000,000,000 means 0.1 (10%) / 1 means 0.0000000000001 (0.0000001%) / 1,000,000,000,000 means 1 (100%)
     * @param _user: user address
     * @param _pid: pool id
     * @return it returns the user's share of pool
     */
    function _getUserAllocationPool(address _user, uint8 _pid) internal view returns (uint256) {
        if (_poolInformation[_pid].totalAmountPool > 0) {
            return _userInfo[_user][_pid].amountPool.mul(1e18).div(_poolInformation[_pid].totalAmountPool.mul(1e6));
        } else {
            return 0;
        }
    }

    /**
     * @notice Check if an address is a contract
     */
    function _isContract(address _addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(_addr)
        }
        return size > 0;
    }
}
