import { ethers } from "hardhat";
import { Contract } from "ethers";

export async function deployTestErc20(): Promise<Contract> {
    const erc20Factory = await ethers.getContractFactory('ERC20');
    const erc20 = await erc20Factory.deploy("Test Token", "TKN");
    await erc20.deployed();

    return erc20;
}