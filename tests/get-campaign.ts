import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  deployCampaignSale,
  getCurrentTimeInSeconds,
  daysToSeconds,
  CampaignParams,
  launchCampaign,
  cancelCampaign,
} from "./utils/funcs";

async function verifyCampaign(
  campaignSale: Contract,
  id: number,
  params: CampaignParams
) {
  const campaign = await campaignSale.getCampaign(id);

  expect(campaign.creator).to.equal(params.creator.address);
  expect(campaign.goal).to.equal(params.goal);
  expect(campaign.pledged).to.equal(0);
  expect(campaign.startAt).to.equal(params.startTime);
  expect(campaign.endAt).to.equal(params.endTime);
  expect(campaign.claimed).to.be.false;
}

describe("Get campaign", function () {
  // accounts
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    charlie: SignerWithAddress;

  before(async function () {
    [alice, bob, charlie] = await ethers.getSigners();
    this.campaignCreators = [alice, bob, charlie];

    // deployed contract
    this.campaignSale = await deployCampaignSale();
  });

  it("should fail for id 0", async function () {
    await expect(this.campaignSale.getCampaign(0)).to.be.revertedWith(
      "campaign does not exist"
    );
  });

  it("should fail for first ID before creating a campaign", async function () {
    await expect(this.campaignSale.getCampaign(1)).to.be.revertedWith(
      "campaign does not exist"
    );
  });

  it("should succeed for first ID after creating a campaign", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(10);
    const campaign = {
      creator: alice,
      goal: 10000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(10),
    };

    await launchCampaign(this.campaignSale, campaign);
    await verifyCampaign(this.campaignSale, 1, campaign);
  });

  it("should fail for second ID after creating a campaign", async function () {
    await expect(this.campaignSale.getCampaign(2)).to.be.revertedWith(
      "campaign does not exist"
    );
  });

  it("should fail for canceled campaign", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(1);
    const campaign = {
      creator: bob,
      goal: 20000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(14),
    };

    const id = await launchCampaign(this.campaignSale, campaign);
    await cancelCampaign(this.campaignSale, campaign.creator, id);

    await expect(this.campaignSale.getCampaign(id)).to.be.revertedWith(
      "campaign does not exist"
    );
  });

  it("should still fail for id 0", async function () {
    await expect(this.campaignSale.getCampaign(0)).to.be.revertedWith(
      "campaign does not exist"
    );
  });
});
