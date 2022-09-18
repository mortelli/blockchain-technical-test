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

describe("Refund campaign", function () {
  // accounts
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    charlie: SignerWithAddress;

  before(async function () {
    [alice, bob, charlie] = await ethers.getSigners();

    // deployed contract
    this.campaignSale = await deployCampaignSale();
    const erc20Token = await this.campaignSale.erc20Token();

    const tokenAmount = 100000;
    const erc20Factory = await ethers.getContractFactory("TestERC20");
    this.erc20 = erc20Factory.attach(erc20Token);

    // mint for contributions
    await this.erc20.mint(alice.address, tokenAmount);
    await this.erc20.mint(bob.address, tokenAmount);
  });

  it("should fail for invalid campaigns", async function () {
    await expect(this.campaignSale.refundCampaign(0)).to.be.revertedWith(
      "campaign does not exist"
    );

    await expect(this.campaignSale.refundCampaign(1)).to.be.revertedWith(
      "campaign does not exist"
    );
  });

  it("should fail for a campaign not yet ended", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(2);

    const campaign = {
      creator: alice,
      goal: 5000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(16),
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
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(1);

    const campaign = {
      creator: charlie,
      goal: 100000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(31),
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

  it("should succeed for a valid conditions", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(1);

    const campaign = {
      creator: alice,
      goal: 1000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(4),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is started
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.startTime,
    ]);

    const contributor = bob;
    const amount = campaign.goal - 100;
    await expect(
      this.erc20.connect(contributor).approve(this.campaignSale.address, amount)
    ).not.to.be.reverted;
    await contribute(this.campaignSale, contributor, id, amount);

    // increase blockchain time so that campaign is ended
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.endTime + 1,
    ]);

    const intialContributorBalance = await this.erc20.balanceOf(
      contributor.address
    );
    const initialContractBalance = await this.erc20.balanceOf(
      this.campaignSale.address
    );

    // then claim
    const tx = await this.campaignSale.connect(contributor).refundCampaign(id);
    const resp = await tx.wait();

    // check event data
    const event = resp.events?.find(
      (e: Event) => e.event == "RefundCampaign"
    ).args;
    expect(event.id).to.equal(id);

    // check balances
    const finalContributorBalance = await this.erc20.balanceOf(
      contributor.address
    );
    const contributorBalanceDifference =
      finalContributorBalance - intialContributorBalance;
    expect(contributorBalanceDifference).to.equal(amount);

    const finalContractBalance = await this.erc20.balanceOf(
      this.campaignSale.address
    );
    const contractBalanceDifference =
      initialContractBalance - finalContractBalance;
    expect(contractBalanceDifference).to.equal(amount);

    // save campaign for next test
    this.campaign = campaign;
    this.campaign.id = id;
    this.contributor = contributor;
  });

  it("should fail for a contributor with no balance", async function () {
    await expect(
      this.campaignSale
        .connect(this.contributor)
        .refundCampaign(this.campaign.id)
    ).to.be.revertedWith("no balance to refund");

    await expect(
      this.campaignSale.connect(charlie).refundCampaign(this.campaign.id)
    ).to.be.revertedWith("no balance to refund");
  });
});
