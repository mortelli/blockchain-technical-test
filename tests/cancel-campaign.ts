import { expect } from "chai";
import { ethers } from "hardhat";
import { Event } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  deployCampaignSale,
  getCurrentTimeInSeconds,
  daysToSeconds,
  launchCampaign,
} from "./utils/funcs";

describe("Cancel campaign", function () {
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

  it("should fail for invalid campaigns", async function () {
    await expect(this.campaignSale.cancelCampaign(0)).to.be.revertedWith(
      "campaign does not exist"
    );

    await expect(this.campaignSale.cancelCampaign(1)).to.be.revertedWith(
      "campaign does not exist"
    );
  });

  it("should fail for a started campaign", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(1); // start campaign in 1 day

    const campaign = {
      creator: alice,
      goal: 25000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(10),
    };

    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is started
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.startTime,
    ]);

    await expect(this.campaignSale.cancelCampaign(id)).to.be.revertedWith(
      "campaign cannot be canceled after started"
    );
  });

  it("should succeed for a campaign not yet started", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(2); // start campaign in 2 days

    const campaign = {
      creator: bob,
      goal: 3000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(7),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    // set blockchain time so that campaign is deterministically not yet started
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.startTime - 1,
    ]);

    // then cancel
    const tx = await this.campaignSale
      .connect(campaign.creator)
      .cancelCampaign(id);
    const resp = await tx.wait();

    // check event data
    const event = resp.events?.find(
      (e: Event) => e.event == "CancelCampaign"
    ).args;
    expect(event.id).to.equal(id);
  });

  it("should fail for a finished campaign", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(3); // start campaign in 3 days

    const campaign = {
      creator: charlie,
      goal: 100000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(30),
    };

    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is finished
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.endTime + 1,
    ]);

    await expect(this.campaignSale.cancelCampaign(id)).to.be.revertedWith(
      "campaign cannot be canceled after started"
    );
  });
});
