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

    this.campaignSale = await deployCampaignSale();
  });

  it("should fail for invalid campaigns", async function () {
    for (const id of [0, 1]) {
      await expect(this.campaignSale.cancelCampaign(id)).to.be.revertedWith(
        "campaign does not exist"
      );
    }
  });

  it("should fail for a started campaign", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: alice,
      goal: 25000,
      startTime: now + daysToSeconds(1),
      endTime: now + daysToSeconds(10),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is started
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.startTime,
    ]);

    await expect(
      this.campaignSale.connect(campaign.creator).cancelCampaign(id)
    ).to.be.revertedWith("campaign already started");
  });

  it("should succeed for a campaign not yet started", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: bob,
      goal: 3000,
      startTime: now + daysToSeconds(2),
      endTime: now + daysToSeconds(9),
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

  it("should fail for invalid caller", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: bob,
      goal: 1500,
      startTime: now + daysToSeconds(1),
      endTime: now + daysToSeconds(15),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    await expect(
      this.campaignSale.connect(charlie).cancelCampaign(id)
    ).to.be.revertedWith("caller is not campaign creator");
  });

  it("should fail for an ended campaign", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: charlie,
      goal: 100000,
      startTime: now + daysToSeconds(3),
      endTime: now + daysToSeconds(33),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is ended
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.endTime + 1,
    ]);

    await expect(
      this.campaignSale.connect(campaign.creator).cancelCampaign(id)
    ).to.be.revertedWith("campaign already started");
  });
});
