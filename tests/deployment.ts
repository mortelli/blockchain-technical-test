import { expect } from "chai";
import { ethers } from "hardhat";
import { deployTestErc20 } from "./utils/funcs";
import { MAXIMUM_CAMPAIGN_LENGTH } from "./utils/consts";

describe("Deployment", function () {
  before(async function () {
    this.campaignSaleFactory = await ethers.getContractFactory("CampaignSale");
    this.erc20 = await deployTestErc20();
  });

  it("should fail with zero address as ERC20 token", async function () {
    await expect(
      this.campaignSaleFactory.deploy(ethers.constants.AddressZero)
    ).to.be.revertedWith("erc20 cannot be zero address");
  });

  it("should succeed for non-zero address as ERC20 token", async function () {
    this.campaignSale = await this.campaignSaleFactory.deploy(
      this.erc20.address
    );
    await expect(this.campaignSale.deployed()).not.to.be.reverted;
  });

  it("should correctly set ERC20 token", async function () {
    const erc20Token = await this.campaignSale.erc20Token();
    expect(erc20Token).to.equal(this.erc20.address);
  });

  it("should correctly get maximum campaign length", async function () {
    const maximumCampaignLength =
      await this.campaignSale.MAXIMUM_CAMPAIGN_LENGTH();
    expect(maximumCampaignLength).to.equal(MAXIMUM_CAMPAIGN_LENGTH);
  });
});
