import { expect } from "chai";
import { ethers } from "hardhat";
import { Event } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  deployCampaignSale,
  getCurrentTimeInSeconds,
  daysToSeconds,
  launchCampaign,
  contribute,
} from "./utils/funcs";

describe("Withdraw", function () {
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

    await expect(this.campaignSale.withdraw(0, amount)).to.be.revertedWith(
      "campaign does not exist"
    );

    await expect(this.campaignSale.withdraw(1, amount)).to.be.revertedWith(
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
      this.campaignSale.connect(contributor).withdraw(id, 1000)
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
      this.campaignSale.connect(contributor).withdraw(id, 2000)
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
      this.campaignSale.connect(contributor).withdraw(id, 0)
    ).to.be.revertedWith("amount must be greater than 0");
  });

  it("should succeed for multiple calls", async function () {
    // create campaigns to withdraw from
    const now = await getCurrentTimeInSeconds();
    const campaigns = [
      {
        creator: charlie,
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
      {
        creator: alice,
        goal: 25000,
        startTime: now + daysToSeconds(3),
        endTime: now + daysToSeconds(6),
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

    const contributions = [
      { contributor: alice, campaignId: campaignIds[0], amount: 1000 },
      { contributor: charlie, campaignId: campaignIds[1], amount: 500 },
      { contributor: bob, campaignId: campaignIds[2], amount: 2000 },
    ];

    // make contributions
    let amountContributed = 0;
    for (const contribution of contributions) {
      const contributor = contribution.contributor;
      const amount = contribution.amount;

      await this.erc20.mint(contributor.address, amount);
      await this.erc20
        .connect(contributor)
        .approve(this.campaignSale.address, amount);

      await contribute(
        this.campaignSale,
        contributor,
        contribution.campaignId,
        amount
      );

      amountContributed += amount;
    }

    const amountOfWithdrawals = 4;

    let contractBalance = await this.erc20.balanceOf(this.campaignSale.address);
    expect(contractBalance).to.equal(amountContributed);

    for (let i = 0; i < amountOfWithdrawals; i++) {
      for (const contribution of contributions) {
        const contributor = contribution.contributor;
        const amount = contribution.amount / amountOfWithdrawals;
        const campaignId = contribution.campaignId;

        const initialContributorBalance = await this.erc20.balanceOf(
          contributor.address
        );
        const initialContractBalance = await this.erc20.balanceOf(
          this.campaignSale.address
        );

        await expect(
          this.erc20
            .connect(contributor)
            .approve(this.campaignSale.address, amount)
        ).not.to.be.reverted;

        const tx = await this.campaignSale
          .connect(contributor)
          .withdraw(campaignId, amount);
        const resp = await tx.wait();

        // check event data
        const event = resp.events?.find(
          (e: Event) => e.event == "Withdraw"
        ).args;
        expect(event.id).to.equal(campaignId);
        expect(event.caller).to.equal(contributor.address);
        expect(event.amount).to.equal(amount);

        // check balances
        const finalContributorBalance = await this.erc20.balanceOf(
          contributor.address
        );
        const contributorBalanceDifference =
          finalContributorBalance - initialContributorBalance;
        expect(contributorBalanceDifference).to.equal(amount);

        const finalContractBalance = await this.erc20.balanceOf(
          this.campaignSale.address
        );
        const contractBalanceDifference =
          initialContractBalance - finalContractBalance;
        expect(contractBalanceDifference).to.equal(amount);
      }
    }

    contractBalance = await this.erc20.balanceOf(this.campaignSale.address);
    expect(contractBalance).to.equal(0);
  });
});
