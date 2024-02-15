// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "bsc-library/contracts/IERC20.sol";
import "bsc-library/contracts/SafeERC20.sol";

import "./interfaces/ISectaProfile.sol";
import "./BunnyMintingStation.sol";
import "./TradingCompV2.sol";

/** @title TradingCompV2RewardDistribution.
@notice It is a contract for users to collect points
based on off-chain events
*/
contract TradingCompV2RewardDistribution is Ownable {
    using SafeERC20 for IERC20;

    BunnyMintingStation public bunnyMintingStation;
    IERC20 public cakeToken;
    IERC20 public lazioToken;
    IERC20 public portoToken;
    IERC20 public santosToken;

    ISectaProfile public sectaProfile;
    TradingCompV2 public tradingCompV2;

    uint256 public constant numberTeams = 3;

    uint8 public bunnyId;
    uint256 public winningTeamId; // set to 0 as default
    string public tokenURI;

    enum CompetitionStatus {
        Registration,
        Open,
        Close,
        Claiming,
        Over
    }

    CompetitionStatus public currentStatus;

    mapping(address => UserStats) public userTradingStats;

    mapping(uint256 => CompetitionRewards) private _rewardCompetitions;

    struct CompetitionRewards {
        uint256[5] userCampaignId; // campaignId for user increase
        uint256[5] cakeRewards; // cake rewards per group
        uint256[5] lazioRewards; // lazio fan token rewards per group
        uint256[5] portoRewards; // porto fan token rewards per group
        uint256[5] santosRewards; // santos fan token rewards per group
        uint256[5] pointUsers; // number of points per user
    }

    struct UserStats {
        bool hasClaimed; // true or false
    }

    event NewCompetitionStatus(CompetitionStatus status);
    event TeamRewardsUpdate(uint256 teamId);
    event UserRegister(address userAddress, uint256 teamId);
    event UserUpdateMultiple(address[] userAddresses, uint256 rewardGroup);
    event WinningTeam(uint256 teamId);

    /**
     * @notice It initializes the contract.
     * @param _sectaProfileAddress: SectaProfile address
     * @param _bunnyStationAddress: BunnyMintingStation address
     * @param _cakeTokenAddress: the address of the CAKE token
     * @param _lazioTokenAddress: the address of the LAZIO fan token
     * @param _portoTokenAddress: the address of the PORTO fan token
     * @param _santosTokenAddress: the address of the SANTOS fan token
     * @param _tradingCompV2Address: the address of the TradingCompV2 fan token
     */
    constructor(
        address _sectaProfileAddress,
        address _bunnyStationAddress,
        address _cakeTokenAddress,
        address _lazioTokenAddress,
        address _portoTokenAddress,
        address _santosTokenAddress,
        address _tradingCompV2Address
    ) public {
        sectaProfile = ISectaProfile(_sectaProfileAddress);
        bunnyMintingStation = BunnyMintingStation(_bunnyStationAddress);
        cakeToken = IERC20(_cakeTokenAddress);
        lazioToken = IERC20(_lazioTokenAddress);
        portoToken = IERC20(_portoTokenAddress);
        santosToken = IERC20(_santosTokenAddress);
        tradingCompV2 = TradingCompV2(_tradingCompV2Address);
        currentStatus = CompetitionStatus.Open;
    }

    /**
     * @notice It allows users to claim reward after the end of trading competition.
     * @dev It is only available during claiming phase
     */
    function claimReward() external {
        address senderAddress = _msgSender();

        bool hasUserRegistered;
        bool hasUserClaimed;
        uint256 userRewardGroup;
        (hasUserRegistered, hasUserClaimed, userRewardGroup, , , , , , ) = tradingCompV2.claimInformation(
            senderAddress
        );

        uint256 userTeamId;
        (, , userTeamId, , , ) = sectaProfile.getUserProfile(senderAddress);

        require(hasUserRegistered, "NOT_REGISTERED");
        require(!userTradingStats[senderAddress].hasClaimed && !hasUserClaimed, "HAS_CLAIMED");
        require(currentStatus == CompetitionStatus.Claiming, "NOT_IN_CLAIMING");

        userTradingStats[senderAddress].hasClaimed = true;

        CompetitionRewards memory userRewards = _rewardCompetitions[userTeamId];

        if (userRewardGroup > 0) {
            cakeToken.safeTransfer(senderAddress, userRewards.cakeRewards[userRewardGroup]);
            lazioToken.safeTransfer(senderAddress, userRewards.lazioRewards[userRewardGroup]);
            portoToken.safeTransfer(senderAddress, userRewards.portoRewards[userRewardGroup]);
            santosToken.safeTransfer(senderAddress, userRewards.santosRewards[userRewardGroup]);

            if (userTeamId == winningTeamId) {
                bunnyMintingStation.mintCollectible(senderAddress, tokenURI, bunnyId);
            }
        }

        // User collects points
        sectaProfile.increaseUserPoints(
            senderAddress,
            userRewards.pointUsers[userRewardGroup],
            userRewards.userCampaignId[userRewardGroup]
        );
    }

    /**
     * @notice It allows the owner to change the competition status
     * @dev Only callable by owner.
     * @param _status: CompetitionStatus (uint8)
     */
    function updateCompetitionStatus(CompetitionStatus _status) external onlyOwner {
        currentStatus = _status;
        emit NewCompetitionStatus(currentStatus);
    }

    /**
     * @notice It allows the owner to claim the CAKE remainder
     * @dev Only callable by owner.
     * @param _amount: amount of CAKE to withdraw (decimals = 18)
     */
    function claimCakeRemainder(uint256 _amount) external onlyOwner {
        require(currentStatus == CompetitionStatus.Over, "NOT_OVER");
        cakeToken.safeTransfer(_msgSender(), _amount);
    }

    /**
     * @notice It allows the owner to claim the LAZIO remainder
     * @dev Only callable by owner.
     * @param _amount: amount of LAZIO to withdraw (decimals = 8)
     */
    function claimLazioRemainder(uint256 _amount) external onlyOwner {
        require(currentStatus == CompetitionStatus.Over, "NOT_OVER");
        lazioToken.safeTransfer(_msgSender(), _amount);
    }

    /**
     * @notice It allows the owner to claim the PORTO remainder
     * @dev Only callable by owner.
     * @param _amount: amount of PORTO to withdraw (decimals = 8)
     */
    function claimPortoRemainder(uint256 _amount) external onlyOwner {
        require(currentStatus == CompetitionStatus.Over, "NOT_OVER");
        portoToken.safeTransfer(_msgSender(), _amount);
    }

    /**
     * @notice It allows the owner to claim the SANTOS remainder
     * @dev Only callable by owner.
     * @param _amount: amount of SANTOS to withdraw (decimals = 8)
     */
    function claimSantosRemainder(uint256 _amount) external onlyOwner {
        require(currentStatus == CompetitionStatus.Over, "NOT_OVER");
        santosToken.safeTransfer(_msgSender(), _amount);
    }

    /**
     * @notice It allows the owner to update team rewards
     * @dev Only callable by owner.
     * @param _teamId: the teamId
     * @param _userCampaignIds: campaignIds for each user group for teamId
     * @param _cakeRewards: CAKE rewards for each user group for teamId
     * @param _lazioRewards: LAZIO rewards for each user group for teamId
     * @param _portoRewards: PORTO rewards for each user group for teamId
     * @param _santosRewards: SANTOS rewards for each user group for teamId
     * @param _pointRewards: point to collect for each user group for teamId
     */
    function updateTeamRewards(
        uint256 _teamId,
        uint256[5] calldata _userCampaignIds,
        uint256[5] calldata _cakeRewards,
        uint256[5] calldata _lazioRewards,
        uint256[5] calldata _portoRewards,
        uint256[5] calldata _santosRewards,
        uint256[5] calldata _pointRewards
    ) external onlyOwner {
        require(currentStatus == CompetitionStatus.Open, "NOT_OPEN");
        _rewardCompetitions[_teamId].userCampaignId = _userCampaignIds;
        _rewardCompetitions[_teamId].cakeRewards = _cakeRewards;
        _rewardCompetitions[_teamId].lazioRewards = _lazioRewards;
        _rewardCompetitions[_teamId].portoRewards = _portoRewards;
        _rewardCompetitions[_teamId].santosRewards = _santosRewards;
        _rewardCompetitions[_teamId].pointUsers = _pointRewards;

        emit TeamRewardsUpdate(_teamId);
    }

    /**
     * @notice It allows the owner to set the winning teamId (to collect NFT)
     * @dev Only callable by owner.
     * @param _winningTeamId: the winning teamId
     * @param _tokenURI: the tokenURI
     * @param _bunnyId: the bunnyId for winners (e.g. 15)
     */
    function updateWinningTeamAndTokenURIAndBunnyId(
        uint256 _winningTeamId,
        string calldata _tokenURI,
        uint8 _bunnyId
    ) external onlyOwner {
        require(currentStatus == CompetitionStatus.Open, "NOT_OPEN");
        require((_winningTeamId > 0) && (_winningTeamId <= numberTeams), "NOT_VALID_TEAM_ID");
        require(_bunnyId > 14, "ID_TOO_LOW");
        winningTeamId = _winningTeamId;
        tokenURI = _tokenURI;
        bunnyId = _bunnyId;
        emit WinningTeam(_winningTeamId);
    }

    /**
     * @notice It checks the claim information
     * @dev It does not check if user has a profile since registration required a profile.
     * @param _userAddress: the user address
     * @return hasRegistered: has the user registered
     * @return hasUserClaimed: whether user has claimed
     * @return userRewardGroup: the final reward group for each user (i.e. tier)
     * @return userCakeRewards: the CAKE to claim/claimed
     * @return userLazioRewards: the LAZIO to claim/claimed
     * @return userPortoRewards: the PORTO to claim/claimed
     * @return userSantosRewards: the Santos to claim/claimed
     * @return userPointReward: the number of points to claim/claimed
     * @return canClaimNFT: whether the user gets/got a NFT
     */
    function claimInformation(address _userAddress)
        external
        view
        returns (
            bool,
            bool,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            bool
        )
    {
        bool hasUserRegistered;
        bool hasUserClaimed;
        uint256 userRewardGroup;
        (hasUserRegistered, hasUserClaimed, userRewardGroup, , , , , , ) = tradingCompV2.claimInformation(_userAddress);
        hasUserClaimed = hasUserClaimed || userTradingStats[_userAddress].hasClaimed;

        uint256 userTeamId;
        (, , userTeamId, , , ) = sectaProfile.getUserProfile(_userAddress);

        bool canClaimNFT;
        if ((userTeamId == winningTeamId) && (userRewardGroup > 0)) {
            canClaimNFT = true;
        }

        return (
            hasUserRegistered,
            hasUserClaimed,
            userRewardGroup,
            _rewardCompetitions[userTeamId].cakeRewards[userRewardGroup],
            _rewardCompetitions[userTeamId].lazioRewards[userRewardGroup],
            _rewardCompetitions[userTeamId].portoRewards[userRewardGroup],
            _rewardCompetitions[userTeamId].santosRewards[userRewardGroup],
            _rewardCompetitions[userTeamId].pointUsers[userRewardGroup],
            canClaimNFT
        );
    }
}
