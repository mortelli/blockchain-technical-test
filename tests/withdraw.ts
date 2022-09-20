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

describe("Withdraw", function () {
  // accounts
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    charlie: SignerWithAddress;

  before(async function () {
    [alice, bob, charlie] = await ethers.getSigners();
    this.campaignContributors = [alice, bob, charlie];

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
      await expect(this.campaignSale.withdraw(id, amount)).to.be.revertedWith(
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
      this.campaignSale.connect(contributor).withdraw(id, 1000)
    ).to.be.revertedWith("campaign not yet started");
  });

  it("should fail for an ended campaign", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: bob,
      goal: 20000,
      startTime: now + daysToSeconds(2),
      endTime: now + daysToSeconds(22),
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
      this.campaignSale.connect(contributor).withdraw(id, 0)
    ).to.be.revertedWith("amount must be greater than 0");
  });

  it("should fail for insufficient balance", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: alice,
      goal: 10000,
      startTime: now + daysToSeconds(3),
      endTime: now + daysToSeconds(33),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is started
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.startTime,
    ]);

    const contributor = bob;

    // attempt to withdraw before contributing
    await expect(
      this.campaignSale.connect(contributor).withdraw(id, 100)
    ).to.be.revertedWith("not enough balance to withdraw");

    // contribute
    const contributeAmount = 500;
    await this.erc20
      .connect(contributor)
      .approve(this.campaignSale.address, contributeAmount);
    await contribute(this.campaignSale, contributor, id, contributeAmount);

    // then attempt to withdraw more than contributed
    const withdrawAmount = 1000;
    expect(withdrawAmount).to.be.greaterThan(contributeAmount);
    await expect(
      this.campaignSale.connect(contributor).withdraw(id, withdrawAmount)
    ).to.be.revertedWith("not enough balance to withdraw");
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

    // contribute
    const contributor = bob;
    const amount = 500;
    await this.erc20
      .connect(contributor)
      .approve(this.campaignSale.address, amount);
    await contribute(this.campaignSale, contributor, id, amount);

    // then withdraw
    await verifyWithdraw(
      this.campaignSale,
      this.erc20,
      contributor,
      amount,
      id
    );
  });

  it("should succeed for multiple valid calls", async function () {
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

    const amountOfWithdrawals = 4;
    for (let i = 0; i < amountOfWithdrawals; i++) {
      for (const contribution of contributions) {
        const contributor = contribution.contributor;
        const amount = Math.floor(contribution.amount / amountOfWithdrawals);
        const campaignId = contribution.campaignId;

        await verifyWithdraw(
          this.campaignSale,
          this.erc20,
          contributor,
          amount,
          campaignId
        );
      }
    }
  });
});

async function verifyWithdraw(
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
    .withdraw(campaignId, amount);
  const resp = await tx.wait();

  // check event data
  const event = resp.events?.find((e: Event) => e.event == "Withdraw").args;
  expect(event.id).to.equal(campaignId);
  expect(event.caller).to.equal(contributor.address);
  expect(event.amount).to.equal(amount);

  // check balances
  const finalContributorBalance = await erc20.balanceOf(contributor.address);
  const contributorBalanceDifference =
    finalContributorBalance - initialContributorBalance;
  expect(contributorBalanceDifference).to.equal(amount);

  const finalContractBalance = await erc20.balanceOf(campaignSale.address);
  const contractBalanceDifference =
    initialContractBalance - finalContractBalance;
  expect(contractBalanceDifference).to.equal(amount);
}
