// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/Counters.sol";

import "./interfaces/ICampaignSale.sol";

/// @title Contract for fundraising campaigns
/// @author @mortelli
/// @dev This contract was developed as an technical exercise
contract CampaignSale is ICampaignSale {

    using Counters for Counters.Counter;

    /// @dev Storage for campaigns, running or completed
    mapping(uint256 => Campaign) private campaigns;
    
    /// @notice Launch a new campaign. 
    /// @param _goal The goal in token to raise to unlock the tokens for the project
    /// @param _startAt Starting date of the campaign
    /// @param _endAt Ending date of the campaign
    function launchCampaign(
        uint _goal,
        uint32 _startAt,
        uint32 _endAt
    ) external {

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