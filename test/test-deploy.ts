import { expect } from "chai";
import { ethers } from "hardhat";

describe("Contract deployment", function () { 
  before(async function(){
    this.campaignSaleFactory = await ethers.getContractFactory('CampaignSale');
  })

  it("should fail with zero address as ERC20 token", async function () {
    await expect(
      this.campaignSaleFactory.deploy(
        ethers.constants.AddressZero
      )
    ).to.be.revertedWith("erc20 cannot be zero address");
  });

  it("should succeed with non-zero address as ERC20 token", async function () {
    await expect(
      this.campaignSaleFactory.deploy(
        "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199"
      )
    ).not.to.be.reverted;
  });
});
