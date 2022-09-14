import { expect } from "chai";
import { ethers } from "hardhat";
import { deployTestErc20 } from "./utils";

describe("Contract deployment", function () { 
  before(async function(){
    this.campaignSaleFactory = await ethers.getContractFactory('CampaignSale');
    this.erc20 = await deployTestErc20();
  });

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
        this.erc20.address
      )
    ).not.to.be.reverted;
  });
});
