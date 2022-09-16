import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  deployCampaignSale,
  getCurrentTimeInSeconds,
  daysToSeconds,
  launchCampaign,
} from "./utils/funcs";

describe("Contribute", function () {
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
    const amount = 1000;

    await expect(this.campaignSale.contribute(0, amount)).to.be.revertedWith(
      "campaign does not exist"
    );

    await expect(this.campaignSale.contribute(1, amount)).to.be.revertedWith(
      "campaign does not exist"
    );
  });

  it("should fail for a campaign not yet started", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(1);

    const campaign = {
      creator: alice,
      goal: 10000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(10),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    // set blockchain time so that campaign is deterministically not yet started
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.startTime - 1,
    ]);

    const contributor = bob;

    await expect(
      this.campaignSale.connect(contributor).contribute(id, 1000)
    ).to.be.revertedWith("campaign not yet started");
  });

  it("should fail for an ended campaign", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(2);

    const campaign = {
      creator: bob,
      goal: 20000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(20),
    };

    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is ended
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.endTime + 1,
    ]);

    const contributor = charlie;

    await expect(
      this.campaignSale.connect(contributor).contribute(id, 2000)
    ).to.be.revertedWith("campaign already ended");
  });

  it("should fail for an amount of 0", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(3);

    const campaign = {
      creator: charlie,
      goal: 30000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(30),
    };

    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is started
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.startTime,
    ]);

    const contributor = alice;

    await expect(
      this.campaignSale.connect(contributor).contribute(id, 0)
    ).to.be.revertedWith("amount must be greater than 0");
  });
});
