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

describe("Claim campaign", function () {
  // accounts
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    charlie: SignerWithAddress;

  before(async function () {
    [alice, bob, charlie] = await ethers.getSigners();

    this.campaignSale = await deployCampaignSale();
    const erc20Token = await this.campaignSale.erc20Token();

    // mint tokens so that contributions can be made
    const tokenAmount = 100000;
    const erc20Factory = await ethers.getContractFactory("TestERC20");
    this.erc20 = erc20Factory.attach(erc20Token);

    await this.erc20.mint(alice.address, tokenAmount);
  });

  it("should fail for invalid campaigns", async function () {
    for (const id of [0, 1]) {
      await expect(this.campaignSale.claimCampaign(id)).to.be.revertedWith(
        "campaign does not exist"
      );
    }
  });

  it("should fail for invalid caller", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(1);

    const campaign = {
      creator: alice,
      goal: 15000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(8),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    await expect(
      this.campaignSale.connect(bob).claimCampaign(id)
    ).to.be.revertedWith("caller is not campaign creator");
  });

  it("should fail for a campaign not yet ended", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(2);

    const campaign = {
      creator: bob,
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
      this.campaignSale.connect(campaign.creator).claimCampaign(id)
    ).to.be.revertedWith("campaign not yet ended");
  });

  it("should fail for a campaign that did not reach its goal", async function () {
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
    const amount = 10000;
    await expect(
      this.erc20.connect(contributor).approve(this.campaignSale.address, amount)
    ).not.to.be.reverted;
    await contribute(this.campaignSale, contributor, id, amount);

    // increase blockchain time so that campaign is ended
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.endTime + 1,
    ]);

    // make sure that campaign did not reach its goal
    const contractCampaign = await this.campaignSale.getCampaign(id);
    expect(contractCampaign.pledged).to.be.lessThan(contractCampaign.goal);

    await expect(
      this.campaignSale.connect(campaign.creator).claimCampaign(id)
    ).to.be.revertedWith("campaign did not reach goal");
  });

  it("should succeed for a campaign that reached its goal", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(3);

    const campaign = {
      creator: bob,
      goal: 10000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(24),
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

    const initialCreatorBalance = await this.erc20.balanceOf(
      campaign.creator.address
    );
    const initialContractBalance = await this.erc20.balanceOf(
      this.campaignSale.address
    );

    // then claim
    const tx = await this.campaignSale
      .connect(campaign.creator)
      .claimCampaign(id);
    const resp = await tx.wait();

    // check event data
    const event = resp.events?.find(
      (e: Event) => e.event == "ClaimCampaign"
    ).args;
    expect(event.id).to.equal(id);

    // check balances
    const finalCreatorBalance = await this.erc20.balanceOf(
      campaign.creator.address
    );
    const creatorBalanceDifference =
      finalCreatorBalance - initialCreatorBalance;
    expect(creatorBalanceDifference).to.equal(campaign.goal);

    const finalContractBalance = await this.erc20.balanceOf(
      this.campaignSale.address
    );
    const contractBalanceDifference =
      initialContractBalance - finalContractBalance;
    expect(contractBalanceDifference).to.equal(campaign.goal);

    // save campaign for next test
    this.campaign = campaign;
    this.campaign.id = id;
  });

  it("should fail for a campaign already claimed", async function () {
    await expect(
      this.campaignSale
        .connect(this.campaign.creator)
        .claimCampaign(this.campaign.id)
    ).to.be.revertedWith("campaign already claimed");
  });
});
