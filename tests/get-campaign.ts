import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  deployCampaignSale,
  getCurrentTimeInSeconds,
  daysToSeconds,
  launchCampaign,
  cancelCampaign,
  contribute,
  withdraw,
  claimCampaign,
  refundCampaign,
} from "./utils/funcs";

interface CampaignData {
  creator: SignerWithAddress;
  goal: number; // goal token quantity
  pledged: number; // pledged token quantity
  startTime: number; // block timestamp
  endTime: number; // blocktimestamp
  claimed: boolean; // flag for having reached goal and claimed tokens
}

describe("Get campaign", function () {
  // accounts
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    charlie: SignerWithAddress;

  before(async function () {
    [alice, bob, charlie] = await ethers.getSigners();

    this.campaignSale = await deployCampaignSale();
    const erc20Token = await this.campaignSale.erc20Token();
    const erc20Factory = await ethers.getContractFactory("TestERC20");
    this.erc20 = erc20Factory.attach(erc20Token);
  });

  it("should fail for id 0", async function () {
    await expect(this.campaignSale.getCampaign(0)).to.be.revertedWith(
      "campaign does not exist"
    );
  });

  it("should fail for first id before creating a campaign", async function () {
    await expect(this.campaignSale.getCampaign(1)).to.be.revertedWith(
      "campaign does not exist"
    );
  });

  it("should succeed for first id after creating a campaign", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: alice,
      goal: 10000,
      startTime: now + daysToSeconds(10),
      endTime: now + daysToSeconds(20),
    };
    await launchCampaign(this.campaignSale, campaign);

    await verifyGetCampaign(this.campaignSale, 1, {
      ...campaign,
      pledged: 0,
      claimed: false,
    });
  });

  it("should fail for second ID after creating a campaign", async function () {
    await expect(this.campaignSale.getCampaign(2)).to.be.revertedWith(
      "campaign does not exist"
    );
  });

  it("should fail for canceled campaign", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: bob,
      goal: 20000,
      startTime: now + daysToSeconds(1),
      endTime: now + daysToSeconds(15),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    await cancelCampaign(this.campaignSale, campaign.creator, id);

    await expect(this.campaignSale.getCampaign(id)).to.be.revertedWith(
      "campaign does not exist"
    );
  });

  it("should suceed for campaigns with contributions", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: charlie,
      goal: 30000,
      startTime: now + daysToSeconds(5),
      endTime: now + daysToSeconds(26),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is started
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.startTime,
    ]);

    const contributor = alice;
    const amount = 7000;
    await this.erc20.mint(contributor.address, amount);
    await this.erc20
      .connect(contributor)
      .approve(this.campaignSale.address, amount);
    await contribute(this.campaignSale, contributor, id, amount);

    await verifyGetCampaign(this.campaignSale, id, {
      ...campaign,
      pledged: amount,
      claimed: false,
    });
  });

  it("should suceed for campaigns with withdrawals", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: bob,
      goal: 10000,
      startTime: now + daysToSeconds(2),
      endTime: now + daysToSeconds(11),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is started
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.startTime,
    ]);

    // make contribution
    const contributor = alice;
    const contributeAmount = 7000;
    await this.erc20.mint(contributor.address, contributeAmount);
    await this.erc20
      .connect(contributor)
      .approve(this.campaignSale.address, contributeAmount);
    await contribute(this.campaignSale, contributor, id, contributeAmount);

    const withdrawAmount = 5000;
    await withdraw(this.campaignSale, contributor, id, withdrawAmount);

    await verifyGetCampaign(this.campaignSale, id, {
      ...campaign,
      pledged: contributeAmount - withdrawAmount,
      claimed: false,
    });
  });

  it("should suceed for claimed campaign", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: alice,
      goal: 30000,
      startTime: now + daysToSeconds(5),
      endTime: now + daysToSeconds(26),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is started
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.startTime,
    ]);

    // reach campaign goal
    const contributor = bob;
    const amount = campaign.goal;
    await this.erc20.mint(contributor.address, amount);
    await this.erc20
      .connect(contributor)
      .approve(this.campaignSale.address, amount);
    await contribute(this.campaignSale, contributor, id, amount);

    // increase blockchain time so that campaign is ended
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.endTime + 1,
    ]);

    await claimCampaign(this.campaignSale, campaign.creator, id);

    await verifyGetCampaign(this.campaignSale, id, {
      ...campaign,
      pledged: amount,
      claimed: true,
    });
  });

  it("should suceed for refunded campaigns", async function () {
    const now = await getCurrentTimeInSeconds();
    const campaign = {
      creator: charlie,
      goal: 1000,
      startTime: now + daysToSeconds(1),
      endTime: now + daysToSeconds(2),
    };
    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is started
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.startTime,
    ]);

    const contributor = alice;
    const contributeAmount = 10;
    await this.erc20.mint(contributor.address, contributeAmount);
    await this.erc20
      .connect(contributor)
      .approve(this.campaignSale.address, contributeAmount);
    await contribute(this.campaignSale, contributor, id, contributeAmount);

    // increase blockchain time so that campaign is ended
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.endTime + 1,
    ]);

    // make sure that campaign did not reach its goal
    const contractCampaign = await this.campaignSale.getCampaign(id);
    expect(contractCampaign.pledged).to.be.lessThan(contractCampaign.goal);
    // but funds are still recorded
    expect(contractCampaign.pledged).to.be.equal(contributeAmount);

    await refundCampaign(this.campaignSale, contributor, id);

    await verifyGetCampaign(this.campaignSale, id, {
      ...campaign,
      pledged: contributeAmount, // amount pledged should remain the same in spite of refunds
      claimed: false,
    });
  });

  it("should still fail for id 0", async function () {
    await expect(this.campaignSale.getCampaign(0)).to.be.revertedWith(
      "campaign does not exist"
    );
  });
});

async function verifyGetCampaign(
  campaignSale: Contract,
  id: number,
  expectedCampaign: CampaignData
) {
  const campaign = await campaignSale.getCampaign(id);

  expect(campaign.creator).to.equal(expectedCampaign.creator.address);
  expect(campaign.goal).to.equal(expectedCampaign.goal);
  expect(campaign.pledged).to.equal(expectedCampaign.pledged);
  expect(campaign.startAt).to.equal(expectedCampaign.startTime);
  expect(campaign.endAt).to.equal(expectedCampaign.endTime);
  expect(campaign.claimed).to.equal(expectedCampaign.claimed);
}
