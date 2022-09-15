import { ethers } from "hardhat";
import { Contract, Event } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export function daysToSeconds(days: number): number{
    return days * 60 * 60 * 24;
}

export async function getCurrentTimeInSeconds(): Promise<number> {
    const currentBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
    return currentBlock.timestamp;
}

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

export interface CampaignParams {
    creator: SignerWithAddress,
    goal: number, // token quantity
    startTime: number, // block timestamp
    endTime: number,  // blocktimestamp
}

export async function launchCampaign(campaignSale: Contract, params: CampaignParams): Promise<number>{
    const tx = await campaignSale.connect(params.creator).launchCampaign(
        params.goal,
        params.startTime,
        params.endTime,
      );
    const resp =  await tx.wait();
    const event = resp.events?.find((e: Event) => e.event == 'LaunchCampaign').args;
    
    return event.id
}