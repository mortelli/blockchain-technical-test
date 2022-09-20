import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Event } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  deployCampaignSale,
  getCurrentTimeInSeconds,
  daysToSeconds,
  launchCampaign,
  contribute,
} from "./utils/funcs";

describe("Refund campaign", function () {
  // accounts
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    charlie: SignerWithAddress;

  before(async function () {
    [alice, bob, charlie] = await ethers.getSigners();
    this.campaignContributors = [alice, bob, charlie];

    // deployed contract
    this.campaignSale = await deployCampaignSale();
    const erc20Token = await this.campaignSale.erc20Token();

    const tokenAmount = 1000000;
    const erc20Factory = await ethers.getContractFactory("TestERC20");
    this.erc20 = erc20Factory.attach(erc20Token);

    // mint for contributions
    await this.erc20.mint(alice.address, tokenAmount);
    await this.erc20.mint(bob.address, tokenAmount);
    await this.erc20.mint(charlie.address, tokenAmount);
  });

  it("should fail for invalid campaigns", async function () {
    for (const id of [0, 1]) {
      await expect(this.campaignSale.refundCampaign(id)).to.be.revertedWith(
        "campaign does not exist"
      );
    }
  });

  it("should fail for a campaign not yet ended", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: alice,
      goal: 5000,
      startTime: now + daysToSeconds(2),
      endTime: now + daysToSeconds(18),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    // set blockchain time so that campaign is deterministically not yet ended
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.endTime - 1,
    ]);

    await expect(
      this.campaignSale.connect(bob).refundCampaign(id)
    ).to.be.revertedWith("campaign not yet ended");
  });

  it("should fail for a campaign that reached its goal", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: charlie,
      goal: 100000,
      startTime: now + daysToSeconds(1),
      endTime: now + daysToSeconds(31),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is started
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.startTime,
    ]);

    const contributor = alice;
    const amount = campaign.goal;
    await expect(
      this.erc20.connect(contributor).approve(this.campaignSale.address, amount)
    ).not.to.be.reverted;
    await contribute(this.campaignSale, contributor, id, amount);

    // increase blockchain time so that campaign is ended
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.endTime + 1,
    ]);

    // make sure that campaign reached its goal
    const contractCampaign = await this.campaignSale.getCampaign(id);
    expect(contractCampaign.pledged).to.be.greaterThanOrEqual(
      contractCampaign.goal
    );

    await expect(
      this.campaignSale.connect(contributor).refundCampaign(id)
    ).to.be.revertedWith("campaign reached its goal");
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

    const contributions = [{ contributor: bob, campaignId: id, amount: 500 }];

    // make contribution
    for (const contribution of contributions) {
      const contributor = contribution.contributor;
      const amount = contribution.amount;

      await this.erc20
        .connect(contributor)
        .approve(this.campaignSale.address, amount);
      await contribute(
        this.campaignSale,
        contributor,
        contribution.campaignId,
        amount
      );
    }

    // increase blockchain time so that campaign is ended
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.endTime + 1,
    ]);

    verifyRefundCampaign(this.campaignSale, this.erc20, contributions);
  });

  it("should succeed for a multiple valid calls", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaigns = [
      {
        creator: alice,
        goal: 100000,
        startTime: now + daysToSeconds(1),
        endTime: now + daysToSeconds(4),
      },
      {
        creator: bob,
        goal: 50000,
        startTime: now + daysToSeconds(2),
        endTime: now + daysToSeconds(5),
      },
    ];

    const campaignIds = [];
    let maxStartTime = campaigns[0].startTime;
    let maxEndTime = campaigns[1].endTime;

    for (const campaign of campaigns) {
      const id = await launchCampaign(this.campaignSale, campaign);
      campaignIds.push(id);

      if (campaign.startTime > maxStartTime) {
        maxStartTime = campaign.startTime;
      }
      if (campaign.endTime > maxEndTime) {
        maxEndTime = campaign.endTime;
      }
    }

    // increase blockchain time so that all campaigns are started
    await ethers.provider.send("evm_setNextBlockTimestamp", [maxStartTime]);

    const contributions = [
      { contributor: bob, campaignId: campaignIds[0], amount: 90000 },
      { contributor: charlie, campaignId: campaignIds[0], amount: 5000 },
      { contributor: alice, campaignId: campaignIds[1], amount: 1000 },
      { contributor: alice, campaignId: campaignIds[1], amount: 2000 },
      { contributor: charlie, campaignId: campaignIds[1], amount: 35000 },
    ];

    // make contributions
    for (const contribution of contributions) {
      const contributor = contribution.contributor;
      const amount = contribution.amount;

      await this.erc20
        .connect(contributor)
        .approve(this.campaignSale.address, amount);
      await contribute(
        this.campaignSale,
        contributor,
        contribution.campaignId,
        amount
      );
    }

    // increase blockchain time so that all campaigns are ended
    await ethers.provider.send("evm_setNextBlockTimestamp", [maxEndTime + 1]);

    // make sure that campaigns did not reach their goal
    for (const id of campaignIds) {
      const contractCampaign = await this.campaignSale.getCampaign(id);
      expect(contractCampaign.pledged).to.be.lessThan(contractCampaign.goal);
    }

    await verifyRefundCampaign(this.campaignSale, this.erc20, contributions);

    // save a campaign for next test
    this.campaign = campaigns[0];
    this.campaign.id = campaignIds[0];
  });

  it("should fail for a contributor with no balance", async function () {
    for (const contributor of this.campaignContributors) {
      await expect(
        this.campaignSale.connect(contributor).refundCampaign(this.campaign.id)
      ).to.be.revertedWith("no balance to refund");
    }
  });
});

async function verifyRefundCampaign(
  campaignSale: Contract,
  erc20: Contract,
  contributions: {
    contributor: SignerWithAddress;
    campaignId: number;
    amount: number;
  }[]
) {
  let totalContributed = 0;
  const campaignIds = [];
  const campaignContributors = [];

  for (const contribution of contributions) {
    totalContributed += contribution.amount;

    if (campaignIds.indexOf(contribution.campaignId) === -1) {
      campaignIds.push(contribution.campaignId);
    }
    if (campaignContributors.indexOf(contribution.contributor) === -1) {
      campaignContributors.push(contribution.contributor);
    }
  }

  const initialContractBalance = await erc20.balanceOf(campaignSale.address);

  for (const contributor of campaignContributors) {
    for (const id of campaignIds) {
      const userContributions = contributions.filter(
        (contribution) =>
          contribution.contributor == contributor &&
          contribution.campaignId == id
      );

      // only claim if user contributed to campaign
      if (userContributions.length > 0) {
        const intialContributorBalance = await erc20.balanceOf(
          contributor.address
        );

        let userContributed = 0; // all balance from all contributions should be claimed in 1 call
        for (const contribution of userContributions) {
          userContributed += contribution.amount;
        }

        const tx = await campaignSale.connect(contributor).refundCampaign(id);
        const resp = await tx.wait();

        // check event data
        const event = resp.events?.find(
          (e: Event) => e.event == "RefundCampaign"
        ).args;
        expect(event.id).to.equal(id);

        // check balances
        const finalContributorBalance = await erc20.balanceOf(
          contributor.address
        );
        const contributorBalanceDifference =
          finalContributorBalance - intialContributorBalance;
        expect(contributorBalanceDifference).to.equal(userContributed);
      }
    }
  }

  const finalContractBalance = await erc20.balanceOf(campaignSale.address);
  const contractBalanceDifference =
    initialContractBalance - finalContractBalance;
  expect(contractBalanceDifference).to.equal(totalContributed);
}
