import { expect } from "chai";
import { deployCampaignSale, getCurrentTimeInSeconds, daysToSeconds } from "./utils/funcs";

describe("Launch campaign", function () { 
  before(async function(){
    // deployed contract
    this.campaignSale = await deployCampaignSale();
    
    // arbitrary values expected to succeed as campaign creation parameters to fill in test calls
    this.validCampaign = {
      goal: 30000, // tokens 
      length: daysToSeconds(30),
    }
  });

  it("should fail for a goal of 0 tokens", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(10); // 10 days into the future

    await expect(
      this.campaignSale.launchCampaign(
        0,
        startTime,
        startTime + this.validCampaign.length,
      )
    ).to.be.revertedWith("goal must be greater than 0");
  });

  it("should fail for a starting date in the past", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime - daysToSeconds(1); // 1 day into the past

    await expect(
      this.campaignSale.launchCampaign(
        this.validCampaign.goal,
        startTime,
        currentTime + this.validCampaign.length,
      )
    ).to.be.revertedWith("campaign must start in the future");
  });

  it("should fail for a starting date in the present", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime;

    await expect(
      this.campaignSale.launchCampaign(
        this.validCampaign.goal,
        startTime,
        startTime + this.validCampaign.length,
      )
    ).to.be.revertedWith("campaign must start in the future");
  });
});