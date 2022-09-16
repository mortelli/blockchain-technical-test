// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./interfaces/ICampaignSale.sol";

/// @title Contract for fundraising campaigns
/// @author @mortelli
/// @dev This contract was developed as an technical exercise
contract CampaignSale is ICampaignSale {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    /// @notice Object representing a campaign plus how many ERC20 tokens have been pleged by contributors 
    struct Sale{
        // The campaign itself
        Campaign campaign;
        // Amount pledged to a campaign per address
        mapping(address => uint256) contributions; 
    }

    /// @notice ERC20 token used to contribute to and fund existing campaigns
    address public erc20Token;

    /// @notice Maximum amount of time a campaign can last
    uint256 public maximumCampaignLength = 90 days;

    /// @dev Counter used for campaign IDs
    Counters.Counter private idCounter;

    /// @dev Storage for campaigns (running or completed) plus their contributions data; keys are campaign IDs
    mapping(uint256 => Sale) private campaignSales;
    
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
        require(_goal > 0, "goal must be greater than 0");
        require(block.timestamp < _startAt, "campaign must start in the future");
        require(_startAt < _endAt, "campaign must end after it starts");
        require(_endAt - _startAt <= maximumCampaignLength, "campaign length exceeds maximum"); 

        idCounter.increment();
        uint256 campaignId = idCounter.current();

        Campaign memory campaign = Campaign({
            creator: msg.sender,
            goal: _goal,
            pledged: 0, // campaigns start with 0 tokens pledged by default
            startAt: _startAt,
            endAt: _endAt,
            claimed: false // campaigns start unclaimed by default
        });
        campaignSales[campaignId].campaign = campaign;

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
        Campaign memory campaign = campaignSales[_id].campaign;
        require(campaign.creator != address(0), "campaign does not exist");
        require(campaign.creator == msg.sender, "caller is not campaign creator");
        require(block.timestamp < campaign.startAt, "campaign already started");

        delete campaignSales[_id];

        emit CancelCampaign(_id);
    }

    /// @notice Contribute to the campaign for the given amount
    /// @param _id Campaign's id
    /// @param _amount Amount of the contribution    
    function contribute(uint _id, uint _amount) external {
        Campaign storage campaign = campaignSales[_id].campaign;
        require(campaign.creator != address(0), "campaign does not exist");
        require(block.timestamp >= campaign.startAt, "campaign not yet started");
        require(block.timestamp < campaign.endAt, "campaign already ended");
        require(_amount > 0, "amount must be greater than 0");

        IERC20(erc20Token).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );

        campaign.pledged += _amount;
        campaignSales[_id].contributions[msg.sender] += _amount;

        emit Contribute(_id, msg.sender, _amount);
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
        campaign = campaignSales[_id].campaign;
        require(campaign.creator != address(0), "campaign does not exist");

        return campaign;
    }
}