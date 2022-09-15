import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployCampaignSale, getCurrentTimeInSeconds, daysToSeconds, launchCampaign } from "./utils/funcs";

describe.only("Cancel campaign", function () { 
  // accounts
  let alice: SignerWithAddress, bob: SignerWithAddress, charlie: SignerWithAddress;
 
  before(async function(){
    [alice, bob, charlie] = await ethers.getSigners();
    this.campaignCreators = [alice, bob, charlie];

    // deployed contract
    this.campaignSale = await deployCampaignSale();
  });

  it("should fail for invalid campaigns", async function () {
    await expect(
      this.campaignSale.cancelCampaign(0)
    ).to.be.revertedWith("campaign does not exist");

    await expect(
      this.campaignSale.cancelCampaign(1)
    ).to.be.revertedWith("campaign does not exist");
  });

  it("should fail for a started campaign", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + 2; // start campaign as soon as possible
    
    const campaign = {
        creator: alice,
        goal: 25000,
        startTime: startTime,
        endTime: startTime + daysToSeconds(10),  
    }

    // make sure campaign can start without figuring out next block timestamp
    await ethers.provider.send('evm_setNextBlockTimestamp', [currentTime + 1]);

    await launchCampaign(this.campaignSale, campaign);

    await expect(
        this.campaignSale.cancelCampaign(1)
      ).to.be.revertedWith("campaign cannot be canceled after start");
  });
});