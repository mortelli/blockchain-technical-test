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
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: alice,
      goal: 15000,
      startTime: now + daysToSeconds(1),
      endTime: now + daysToSeconds(9),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    await expect(
      this.campaignSale.connect(bob).claimCampaign(id)
    ).to.be.revertedWith("caller is not campaign creator");
  });

  it("should fail for a campaign not yet ended", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: bob,
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
      this.campaignSale.connect(campaign.creator).claimCampaign(id)
    ).to.be.revertedWith("campaign not yet ended");
  });

  it("should fail for a campaign that did not reach its goal", async function () {
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
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: bob,
      goal: 10000,
      startTime: now + daysToSeconds(3),
      endTime: now + daysToSeconds(27),
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

    await verifyClaimCampaign(
      this.campaignSale,
      this.erc20,
      campaign.creator,
      campaign.goal,
      id
    );

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

async function verifyClaimCampaign(
  campaignSale: Contract,
  erc20: Contract,
  campaignCreator: SignerWithAddress,
  campaignGoal: number,
  campaignId: number
) {
  const initialCreatorBalance = await erc20.balanceOf(campaignCreator.address);
  const initialContractBalance = await erc20.balanceOf(campaignSale.address);

  // then claim
  const tx = await campaignSale
    .connect(campaignCreator)
    .claimCampaign(campaignId);
  const resp = await tx.wait();

  // check event data
  const event = resp.events?.find(
    (e: Event) => e.event == "ClaimCampaign"
  ).args;
  expect(event.id).to.equal(campaignId);

  // check balances
  const finalCreatorBalance = await erc20.balanceOf(campaignCreator.address);
  const creatorBalanceDifference = finalCreatorBalance - initialCreatorBalance;
  expect(creatorBalanceDifference).to.equal(campaignGoal);

  const finalContractBalance = await erc20.balanceOf(campaignSale.address);
  const contractBalanceDifference =
    initialContractBalance - finalContractBalance;
  expect(contractBalanceDifference).to.equal(campaignGoal);
}
