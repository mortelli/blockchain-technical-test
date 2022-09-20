import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Event } from "ethers";
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

    this.campaignSale = await deployCampaignSale();
    const erc20Token = await this.campaignSale.erc20Token();

    // mint tokens so that contributions can be made
    const tokenAmount = 100000;
    const erc20Factory = await ethers.getContractFactory("TestERC20");
    this.erc20 = erc20Factory.attach(erc20Token);

    for (const contributor of this.campaignContributors) {
      await this.erc20.mint(contributor.address, tokenAmount);
    }
  });

  it("should fail for invalid campaigns", async function () {
    const amount = 1000;

    for (const id of [0, 1]) {
      await expect(this.campaignSale.contribute(id, amount)).to.be.revertedWith(
        "campaign does not exist"
      );
    }
  });

  it("should fail for a campaign not yet started", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: alice,
      goal: 10000,
      startTime: now + daysToSeconds(1),
      endTime: now + daysToSeconds(11),
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
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: bob,
      goal: 20000,
      startTime: now + daysToSeconds(2),
      endTime: now + daysToSeconds(21),
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
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: charlie,
      goal: 30000,
      startTime: now + daysToSeconds(3),
      endTime: now + daysToSeconds(33),
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

  it("should succeed for a single valid call", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: bob,
      goal: 10000,
      startTime: now + daysToSeconds(1),
      endTime: now + daysToSeconds(8),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is started
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.startTime,
    ]);

    const amount = 500;
    const contributor = bob;

    await verifyContribute(
      this.campaignSale,
      this.erc20,
      contributor,
      amount,
      id
    );
  });

  it("should succeed for multiple valid calls", async function () {
    // create campaigns to contribute to
    const now = await getCurrentTimeInSeconds();
    const campaigns = [
      {
        creator: alice,
        goal: 100000,
        startTime: now + daysToSeconds(1),
        endTime: now + daysToSeconds(8),
      },
      {
        creator: bob,
        goal: 200000,
        startTime: now + daysToSeconds(2),
        endTime: now + daysToSeconds(16),
      },
      {
        creator: charlie,
        goal: 300000,
        startTime: now + daysToSeconds(3),
        endTime: now + daysToSeconds(24),
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

      await verifyContribute(
        this.campaignSale,
        this.erc20,
        contributor,
        amount,
        campaignId
      );

      // increase counters for next iteration
      contributorIndex++;
      campaignIndex++;
    }
  });
});

async function verifyContribute(
  campaignSale: Contract,
  erc20: Contract,
  contributor: SignerWithAddress,
  amount: number,
  campaignId: number
) {
  const initialContributorBalance = await erc20.balanceOf(contributor.address);
  const initialContractBalance = await erc20.balanceOf(campaignSale.address);

  await expect(erc20.connect(contributor).approve(campaignSale.address, amount))
    .not.to.be.reverted;

  const tx = await campaignSale
    .connect(contributor)
    .contribute(campaignId, amount);
  const resp = await tx.wait();

  // check event data
  const event = resp.events?.find((e: Event) => e.event == "Contribute").args;
  expect(event.id).to.equal(campaignId);
  expect(event.caller).to.equal(contributor.address);
  expect(event.amount).to.equal(amount);

  // check balances
  const finalContributorBalance = await erc20.balanceOf(contributor.address);
  const contributorBalanceDifference =
    initialContributorBalance - finalContributorBalance;
  expect(contributorBalanceDifference).to.equal(amount);

  const finalContractBalance = await erc20.balanceOf(campaignSale.address);
  const contractBalanceDifference =
    finalContractBalance - initialContractBalance;
  expect(contractBalanceDifference).to.equal(amount);
}
