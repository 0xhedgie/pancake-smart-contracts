// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./IFOInitializableV2.sol";

/**
 * @title IFODeployerV2
 */
contract IFODeployerV2 is Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_BUFFER_TIME = 31 days; // previously, 200,000 blocks (6-7 days on BSC)

    event AdminTokenRecovery(address indexed tokenRecovered, uint256 amount);
    event NewIFOContract(address indexed ifoAddress);

    /**
     * @notice Constructor
     */
    constructor() public {}

    /**
     * @notice It creates the IFO contract and initializes the contract.
     * @param _lpToken: the LP token used
     * @param _offeringToken: the token that is offered for the IFO
     * @param _startTimestamp: the start timestamp for the IFO
     * @param _endTimestamp: the end timestamp for the IFO
     * @param _adminAddress: the admin address for handling tokens
     */
    function createIFO(
        address _lpToken,
        address _offeringToken,
        uint256 _startTimestamp,
        uint256 _endTimestamp,
        address _adminAddress,
        address _stakingPoolAddress
    ) external onlyOwner {
        require(IERC20(_lpToken).totalSupply() >= 0);
        require(IERC20(_offeringToken).totalSupply() >= 0);
        require(_lpToken != _offeringToken, "Operations: Tokens must be be different");
        require(_endTimestamp < (now + MAX_BUFFER_TIME), "Operations: EndTimestamp too far");
        require(_startTimestamp < _endTimestamp, "Operations: StartTimestamp must be inferior to endTimestamp");
        require(_startTimestamp > now, "Operations: StartTimestamp must be greater than current timestamp");

        bytes memory bytecode = type(IFOInitializableV2).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(_lpToken, _offeringToken, _startTimestamp));
        address ifoAddress;

        assembly {
            ifoAddress := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        IFOInitializableV2(ifoAddress).initialize(
            _lpToken,
            _offeringToken,
            _startTimestamp,
            _endTimestamp,
            MAX_BUFFER_TIME,
            _adminAddress,
            _stakingPoolAddress
        );

        emit NewIFOContract(ifoAddress);
    }

    /**
     * @notice It allows the admin to recover wrong tokens sent to the contract
     * @param _tokenAddress: the address of the token to withdraw
     * @dev This function is only callable by admin.
     */
    function recoverWrongTokens(address _tokenAddress) external onlyOwner {
        uint256 balanceToRecover = IERC20(_tokenAddress).balanceOf(address(this));
        require(balanceToRecover > 0, "Operations: Balance must be > 0");
        IERC20(_tokenAddress).safeTransfer(address(msg.sender), balanceToRecover);

        emit AdminTokenRecovery(_tokenAddress, balanceToRecover);
    }
}
