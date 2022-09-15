import { expect } from "chai";
import { ethers } from "hardhat";
import { Event } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MAXIMUM_CAMPAIGN_LENGTH } from "./utils/consts";
import {
  deployCampaignSale,
  getCurrentTimeInSeconds,
  daysToSeconds,
} from "./utils/funcs";

describe("Launch campaign", function () {
  // accounts
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    charlie: SignerWithAddress;

  before(async function () {
    [alice, bob, charlie] = await ethers.getSigners();
    this.campaignCreators = [alice, bob, charlie];

    // deployed contract
    this.campaignSale = await deployCampaignSale();

    // arbitrary values expected to succeed as campaign creation parameters to fill in test calls
    this.validCampaign = {
      goal: 30000, // tokens
      length: daysToSeconds(30),
    };
  });

  it("should fail for a goal of 0 tokens", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(10); // 10 days into the future

    await expect(
      this.campaignSale.launchCampaign(
        0,
        startTime,
        startTime + this.validCampaign.length
      )
    ).to.be.revertedWith("goal must be greater than 0");
  });

  it("should fail for a starting date in the past", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime - daysToSeconds(1); // 1 day into the past

    await expect(
      this.campaignSale.launchCampaign(
        this.validCampaign.goal,
        startTime,
        currentTime + this.validCampaign.length
      )
    ).to.be.revertedWith("campaign must start in the future");
  });

  it("should fail for a starting date in the present", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime;

    await expect(
      this.campaignSale.launchCampaign(
        this.validCampaign.goal,
        startTime,
        startTime + this.validCampaign.length
      )
    ).to.be.revertedWith("campaign must start in the future");
  });

  it("should fail for a negative campaign length", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(20); // 20 days into the future

    await expect(
      this.campaignSale.launchCampaign(
        this.validCampaign.goal,
        startTime,
        startTime - daysToSeconds(1) // 1 day before start time
      )
    ).to.be.revertedWith("campaign must end after it starts");
  });

  it("should fail for a campaign that lasts more than allowed", async function () {
    const currentTime = await getCurrentTimeInSeconds();
    const startTime = currentTime + daysToSeconds(5); // 5 days into the future
    const endTime = startTime + MAXIMUM_CAMPAIGN_LENGTH + 1; // 1 second past maximum length

    await expect(
      this.campaignSale.launchCampaign(
        this.validCampaign.goal,
        startTime,
        endTime
      )
    ).to.be.revertedWith("campaign length exceeds maximum");
  });

  it("should succeed for valid campaign parameters", async function () {
    // tokens to reach as campaign goals
    const goals = [1, 100, 1000000];
    // days into the future for campaign start times, in seconds
    const startTimeOffsets = [1, 10, 100].map((x) => daysToSeconds(x));
    // campaign lengths, in seconds
    const lengths = [1, 30, 90].map((x) => daysToSeconds(x));
    // first created campaign ID
    let expectedCampaignId = 1;
    // used to switch campaign creators
    let creatorIndex = 1;

    // combine valid params for campaign creation calls
    for (const goal of goals) {
      for (const offset of startTimeOffsets) {
        const currentTime = await getCurrentTimeInSeconds();
        const startTime = currentTime + offset;

        for (const length of lengths) {
          const endTime = startTime + length;

          // switch campaign creator accounts for each call
          const creator =
            this.campaignCreators[creatorIndex % this.campaignCreators.length];

          const tx = await this.campaignSale
            .connect(creator)
            .launchCampaign(goal, startTime, endTime);
          const resp = await tx.wait();

          // check event data
          const event = resp.events?.find(
            (e: Event) => e.event == "LaunchCampaign"
          ).args;
          expect(event.id).to.equal(expectedCampaignId);
          expect(event.creator).to.equal(creator.address);
          expect(event.goal).to.equal(goal);
          expect(event.startAt).to.equal(startTime);
          expect(event.endAt).to.equal(endTime);

          // increase counters for next iteration
          expectedCampaignId++;
          creatorIndex++;
        }
      }
    }
  });
});
