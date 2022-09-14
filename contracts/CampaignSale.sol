// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/Counters.sol";

import "./interfaces/ICampaignSale.sol";

/// @title Contract for fundraising campaigns
/// @author @mortelli
/// @dev This contract was developed as an technical exercise
contract CampaignSale is ICampaignSale {

    using Counters for Counters.Counter;

    /// @notice ERC20 token used to contribute to and fund existing campaigns
    address public erc20Token;

    /// @dev Counter used for Campaign IDs
    Counters.Counter private idCounter;

    /// @notice Maximum amount of time a campaign can last
    uint256 public maximumCampaignLength = 90 days;

    /// @dev Storage for campaigns, running or completed
    mapping(uint256 => Campaign) private campaigns;
    
    /// @param _erc20Token Contract address of the ERC20 token used to contribute to and fund existing campaigns
    constructor(address _erc20Token){
        require(_erc20Token != address(0), "erc20 cannot be zero address");
        erc20Token = _erc20Token;
    }

    /// @notice Launch a new campaign. 
    /// @param _goal The goal in token to raise to unlock the tokens for the project
    /// @param _startAt Starting date of the campaign
    /// @param _endAt Ending date of the campaign
    function launchCampaign(
        uint _goal,
        uint32 _startAt,
        uint32 _endAt
    ) external {
        require(block.timestamp < _startAt, "campaign must start in the future");
        require(_startAt < _endAt, "campaign must end after it starts");
        // if needed, user can query maximum length through the public field
        require(_endAt - _startAt < maximumCampaignLength, "campaign length exceeds maximum"); 

        idCounter.increment();
        uint256 campaignId = idCounter.current();

        Campaign memory campaign = Campaign({
            creator: msg.sender,
            goal: _goal,
            pledged: 0,
            startAt: _startAt,
            endAt: _endAt,
            claimed: false
        });
        campaigns[campaignId] = campaign;

        emit LaunchCampaign(
            campaignId,
            campaign.creator,
            campaign.goal,
            campaign.startAt,
            campaign.endAt
        );
    }  

    /// @notice Cancel a campaign
    /// @param _id Campaign's id
    function cancelCampaign(uint _id) external {

    }

    /// @notice Contribute to the campaign for the given amount
    /// @param _id Campaign's id
    /// @param _amount Amount of the contribution    
    function contribute(uint _id, uint _amount) external {

    }

    /// @notice Withdraw an amount from your contribution
    /// @param _id Campaign's id
    /// @param _amount Amount of the contribution to withdraw
    function withdraw(uint _id, uint _amount) external {

    }

    /// @notice Claim all the tokens from the campaign
    /// @param _id Campaign's id
    function claimCampaign(uint _id) external {

    }

    /// @notice Refund all the tokens to the sender
    /// @param _id Campaign's id
    function refundCampaign(uint _id) external {

    }

    /// @notice Get the campaign info
    /// @param _id Campaign's id
    function getCampaign(uint _id) external view returns (Campaign memory campaign) {
        campaign = campaigns[_id];
        require(campaign.creator != address(0), "campaign does not exist");

        return campaign;
    }
}