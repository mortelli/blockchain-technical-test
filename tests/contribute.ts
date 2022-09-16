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

describe("Contribute", function () {
  // accounts
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    charlie: SignerWithAddress,
    dave: SignerWithAddress;

  before(async function () {
    [alice, bob, charlie, dave] = await ethers.getSigners();
    this.campaignContributors = [alice, bob, charlie, dave];

    // deployed contract
    this.campaignSale = await deployCampaignSale();
    const erc20Token = await this.campaignSale.erc20Token();

    // mint tokens to callers
    const tokenAmount = 100000;
    const erc20Factory = await ethers.getContractFactory("TestERC20");
    this.erc20 = erc20Factory.attach(erc20Token);

    for (const contributor of this.campaignContributors) {
      await this.erc20.mint(contributor.address, tokenAmount);
    }
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

  it("should succeed for valid conditions", async function () {
    // create campaigns to contribute to
    const campaigns = [
      {
        creator: alice,
        goal: 100000,
        startTime: (await getCurrentTimeInSeconds()) + daysToSeconds(1),
        endTime: (await getCurrentTimeInSeconds()) + daysToSeconds(7),
      },
      {
        creator: bob,
        goal: 200000,
        startTime: (await getCurrentTimeInSeconds()) + daysToSeconds(1),
        endTime: (await getCurrentTimeInSeconds()) + daysToSeconds(14),
      },
    ];

    const campaignIds = [];
    let maxStartTime = campaigns[0].startTime;

    for (const campaign of campaigns) {
      const id = await launchCampaign(this.campaignSale, campaign);
      campaignIds.push(id);

      if (campaign.startTime > maxStartTime) {
        maxStartTime = campaign.startTime;
      }
    }

    // increase blockchain time so that all campaigns are started
    await ethers.provider.send("evm_setNextBlockTimestamp", [maxStartTime]);

    // used to switch campaigns and contributors
    let contributorIndex = 1;
    let campaignIndex = 1;
    const amountOfContributions = 7;

    for (let i = 0; i < amountOfContributions; i++) {
      // switch campaigns, contributors and amounts for each call
      const campaignId = campaignIds[campaignIndex % campaignIds.length];
      const contributor =
        this.campaignContributors[
          contributorIndex % this.campaignContributors.length
        ];
      const amount = 1000 * (i + 1);

      await expect(
        this.erc20
          .connect(contributor)
          .approve(this.campaignSale.address, amount)
      ).not.to.be.reverted;

      const tx = await this.campaignSale
        .connect(contributor)
        .contribute(campaignId, amount);
      const resp = await tx.wait();

      // check event data
      const event = resp.events?.find(
        (e: Event) => e.event == "Contribute"
      ).args;
      expect(event.id).to.equal(campaignId);
      expect(event.caller).to.equal(contributor.address);
      expect(event.amount).to.equal(amount);

      // increase counters for next iteration
      contributorIndex++;
      campaignIndex++;
    }
  });
});
