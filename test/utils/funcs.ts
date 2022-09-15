import { ethers } from "hardhat";
import { Contract } from "ethers";

export async function deployTestErc20(): Promise<Contract> {
    const erc20Factory = await ethers.getContractFactory('ERC20');
    const erc20 = await erc20Factory.deploy("Test Token", "TKN");
    await erc20.deployed();

    return erc20;
}

export async function deployCampaignSale(): Promise<Contract> {
    const erc20 = await deployTestErc20();
    const campaignSaleFactory = await ethers.getContractFactory('CampaignSale');
    const campaignSale = await campaignSaleFactory.deploy(erc20.address);
    await campaignSale.deployed();

    return campaignSale;
}

export function daysToSeconds(days: number): number{
    return days * 60 * 60 * 24;
}

export async function getCurrentTimeInSeconds(): Promise<number> {
    const currentBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
    return currentBlock.timestamp;
}