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
} from "./utils/funcs";

interface CampaignData {
  creator: SignerWithAddress;
  goal: number; // goal token quantity
  pledged: number; // pledged token quantity
  startTime: number; // block timestamp
  endTime: number; // blocktimestamp
  claimed: boolean; // flag for having reached goal and claimed tokens
}

async function verifyCampaign(
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

describe("Get campaign", function () {
  // accounts
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    charlie: SignerWithAddress;

  before(async function () {
    [alice, bob, charlie] = await ethers.getSigners();

    // deployed contract
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

  it("should fail for first ID before creating a campaign", async function () {
    await expect(this.campaignSale.getCampaign(1)).to.be.revertedWith(
      "campaign does not exist"
    );
  });

  it("should succeed for first ID after creating a campaign", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(10);
    const campaign = {
      creator: alice,
      goal: 10000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(10),
    };

    await launchCampaign(this.campaignSale, campaign);
    await verifyCampaign(this.campaignSale, 1, {
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
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(1);
    const campaign = {
      creator: bob,
      goal: 20000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(14),
    };

    const id = await launchCampaign(this.campaignSale, campaign);
    await cancelCampaign(this.campaignSale, campaign.creator, id);

    await expect(this.campaignSale.getCampaign(id)).to.be.revertedWith(
      "campaign does not exist"
    );
  });

  it("should suceed for campaigns with contributions", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(5);
    const campaign = {
      creator: charlie,
      goal: 30000,
      startTime: startTime,
      endTime: startTime + daysToSeconds(21),
    };

    const id = await launchCampaign(this.campaignSale, campaign);

    // increase blockchain time so that campaign is started
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      campaign.startTime,
    ]);

    // make contribution
    const contributor = alice;
    const amount = 7000;
    await this.erc20.mint(contributor.address, amount);
    await this.erc20
      .connect(contributor)
      .approve(this.campaignSale.address, amount);
    await contribute(this.campaignSale, contributor, id, amount);

    await verifyCampaign(this.campaignSale, id, {
      ...campaign,
      pledged: amount,
      claimed: false,
    });
  });

  it("should still fail for id 0", async function () {
    await expect(this.campaignSale.getCampaign(0)).to.be.revertedWith(
      "campaign does not exist"
    );
  });
});
